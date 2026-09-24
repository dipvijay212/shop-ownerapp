import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { ArrowLeft, BadgeCheck, CreditCard, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { theme } from '../theme';
import { api, newIdempotencyKey } from '../api';
import { adaptPlan, adaptPlanInvoice, adaptPlanSubscription } from '../api/adapters';
import { getErrorText } from '../api/errors';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../constants/translations';
import { useScreenPadding } from '../hooks/useScreenPadding';
import { startPayment, CashfreePaymentError } from '../services/cashfreeService';

const prettyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** When the payment actually went through — a receipt needs the time too. */
const prettyDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

const rupees = (n) => `₹${Number(n ?? 0).toFixed(2).replace(/\.00$/, '')}`;

/**
 * O-26 — the partner plan the SHOP buys, so its listing stays visible to
 * customers (D7). Not to be confused with the "Subscriptions" tab, which is
 * the standing-order round customers subscribe to.
 *
 * Payment is a three-step handshake and each step has to stay in its lane:
 *   1. our server opens a Cashfree order and hands back a session,
 *   2. the Cashfree SDK collects the money,
 *   3. Cashfree's webhook tells our server it happened.
 * Only (3) is authoritative. The SDK's success callback carries no payment
 * status, so this screen polls the server rather than believing the sheet.
 */
export const SubscriptionPaymentScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { bottom: paddingBottom } = useScreenPadding(8);
  const queryClient = useQueryClient();
  const { refreshSubscription } = useContext(AuthContext);

  // 'idle' | 'starting' (creating the invoice) | 'paying' (sheet open)
  // | 'confirming' (waiting on the webhook)
  const [phase, setPhase] = useState('idle');
  const abortRef = useRef(null);

  const subscription = useQuery({
    queryKey: ['planSubscription'],
    queryFn: async () => adaptPlanSubscription(await api.business.getSubscription()),
  });
  const plan = useQuery({
    queryKey: ['plan'],
    queryFn: async () => adaptPlan(await api.business.getSubscriptionPlan()),
  });
  const invoices = useQuery({
    queryKey: ['planInvoices'],
    queryFn: async () => (await api.business.getSubscriptionInvoices())?.map(adaptPlanInvoice) ?? [],
  });

  // A half-finished poll must not outlive the screen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const sub = subscription.data;
  const busy = phase !== 'idle';

  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['planSubscription'] }),
      queryClient.invalidateQueries({ queryKey: ['planInvoices'] }),
    ]);
    // The dashboard's live/offline banner reads this.
    await refreshSubscription?.();
  }, [queryClient, refreshSubscription]);

  // Self-heal a payment this screen never got to see finish — the owner paid,
  // then killed the app, lost signal, or the webhook simply never arrived.
  // Reading the status makes the server reconcile against the gateway, so an
  // invoice that is really paid stops showing "Pending" the moment it is
  // opened. One attempt per invoice per mount, so a genuinely unpaid one does
  // not loop.
  const healedRef = useRef(new Set());
  useEffect(() => {
    if (busy) return;
    const pending = (invoices.data ?? []).find((i) => i.status === 'pending');
    if (!pending || healedRef.current.has(pending.id)) return;
    healedRef.current.add(pending.id);

    let cancelled = false;
    (async () => {
      try {
        const result = await api.business.getInvoicePaymentStatus(pending.id);
        if (cancelled || result?.status !== 'paid') return;
        await refreshAll();
        Toast.show({
          type: 'success',
          text1: t('planPaymentSuccess'),
          text2: t('planActiveUntil', { date: prettyDate(result.coverage_ends_at) }),
        });
      } catch {
        // Offline or the invoice is gone — the screen still renders what it has.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices.data, busy]);

  const runPayment = useCallback(async () => {
    // One key for THIS attempt: a retry inside the same attempt replays the
    // same Cashfree session, while a fresh tap after a failure gets a new one.
    // Reusing a key across attempts would hand back a dead session for 24h.
    const idempotencyKey = newIdempotencyKey();
    setPhase('starting');
    try {
      const session = await api.business.subscribe(idempotencyKey);

      setPhase('paying');
      await startPayment({
        paymentSessionId: session.payment_session_id,
        orderId: session.cf_order_id,
        environment: session.cf_environment,
      });

      // The sheet closed on a completed payment. That is NOT proof it settled
      // — wait for our own server to see the webhook.
      setPhase('confirming');
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await api.business.pollInvoicePaymentStatus(session.invoice_id, {
        signal: controller.signal,
      });

      await refreshAll();

      if (result?.status === 'paid') {
        Toast.show({
          type: 'success',
          text1: t('planPaymentSuccess'),
          text2: t('planActiveUntil', { date: prettyDate(result.coverage_ends_at) }),
        });
      } else if (result?.status === 'failed' || result?.gateway_status === 'failed') {
        Toast.show({ type: 'error', text1: t('planPaymentFailed'), text2: t('planPaymentFailedSub') });
      } else {
        // Ran out of polling budget. Claiming either outcome here would be a
        // guess, and the webhook may still be seconds away.
        Toast.show({ type: 'info', text1: t('planPaymentPending'), text2: t('planPaymentPendingSub') });
      }
    } catch (err) {
      if (err instanceof CashfreePaymentError) {
        if (!err.cancelled) {
          Toast.show({ type: 'error', text1: t('planPaymentFailed'), text2: err.message });
        }
        // A cancelled sheet leaves a pending invoice the server sweeps up on
        // the next subscribe — nothing to announce.
      } else {
        Toast.show({ type: 'error', text1: getErrorText(err) });
      }
      await refreshAll();
    } finally {
      abortRef.current = null;
      setPhase('idle');
    }
  }, [refreshAll, t]);

  // There is only something to buy once the shop has run out of cover. While a
  // trial or a paid month is still running the owner already has everything
  // the plan gives them, so paying again would just take money for nothing —
  // the button is hidden during the trial and disabled on a live plan.
  const canPurchase = sub?.state === 'expired';

  const onSubscribePress = useCallback(() => {
    if (busy || !canPurchase) return;
    runPayment();
  }, [busy, canPurchase, runPayment]);

  /**
   * The trial gets its own layout rather than the shared status card, because
   * there is nothing to sell yet: no price, no features, no button. Showing a
   * ₹200 plan card to someone who already has everything free for two more
   * months reads as a sales pitch for something they cannot use. So the days
   * remaining become the whole screen.
   */
  const trialCard = () => (
    <View style={styles.trialCard}>
      <View style={styles.statusRow}>
        <ShieldCheck color="#1D4ED8" size={20} />
        <Text style={styles.trialTitle}>{t('planTrialActive')}</Text>
      </View>
      <Text style={styles.trialDays}>{sub.trialDaysLeft}</Text>
      <Text style={styles.trialDaysUnit}>
        {sub.trialDaysLeft === 1 ? t('planTrialDayUnit') : t('planTrialDaysUnit')}
      </Text>
      {/* This line used to read "your free trial covers everything until
          {coverageEndsAt}" — and coverageEndsAt already includes a paid month
          stacked after the trial. So an owner who had just paid ₹200 was told
          the FREE trial covered the period they had bought, with no mention of
          the payment anywhere on the screen. The trial's own end date is the
          only date the trial can honestly claim; the paid month gets its own
          line below. */}
      <Text style={styles.trialBody}>
        {sub.upcomingPeriod
          ? t('planTrialThenPaid', {
              trialDate: prettyDate(sub.trialEndsAt),
              date: prettyDate(sub.upcomingPeriod.endsAt),
            })
          : t('planTrialNoPurchase', { date: prettyDate(sub.trialEndsAt) })}
      </Text>
      {sub.upcomingPeriod ? (
        <View style={styles.paidChip}>
          <BadgeCheck color="#15803D" size={16} />
          <Text style={styles.paidChipText}>
            {t('planPaidStartsOn', { date: prettyDate(sub.upcomingPeriod.startsAt) })}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // Only reached for active/expired — the caller handles loading and trial.
  const statusCard = () => {
    if (!sub) return null;

    const map = {
      active: {
        bg: theme.colors.primaryLight,
        fg: theme.colors.primaryDark,
        Icon: BadgeCheck,
        title: t('planActive'),
        body: t('planActiveUntil', { date: prettyDate(sub.coverageEndsAt) }),
      },
      expired: {
        bg: '#FEE2E2',
        fg: '#B91C1C',
        Icon: TriangleAlert,
        title: t('planExpired'),
        body: sub.visibilityNote || t('planExpiredSub'),
      },
    };
    const s = map[sub.state] ?? map.expired;
    const Icon = s.Icon;

    return (
      <View style={[styles.statusCard, { backgroundColor: s.bg }]}>
        <View style={styles.statusRow}>
          <Icon color={s.fg} size={20} />
          <Text style={[styles.statusTitle, { color: s.fg }]}>{s.title}</Text>
        </View>
        <Text style={[styles.statusBody, { color: s.fg }]}>{s.body}</Text>
        {sub.state !== 'expired' && sub.coverageEndsAt ? (
          <Text style={[styles.statusMeta, { color: s.fg }]}>
            {t('planCoverageUntil', { date: prettyDate(sub.coverageEndsAt) })}
          </Text>
        ) : null}
      </View>
    );
  };

  const invoiceList = invoices.data ?? [];
  // Nothing has ever been billed — an empty "Billing history" heading only
  // takes up space, so the section stays away until there is a receipt in it.
  const hasInvoices = invoiceList.length > 0;
  // With no history below it the trial card is the whole screen, so it sits in
  // the middle of it rather than stranded at the top above a blank page.
  const centerTrial = sub?.state === 'trial' && !hasInvoices;

  const ctaLabel =
    phase === 'starting' ? t('planPreparing')
    : phase === 'paying' ? t('planOpeningCheckout')
    : phase === 'confirming' ? t('planConfirming')
    : canPurchase ? t('subscribeNow')
    : t('planRenewCta');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} disabled={busy}>
          <ArrowLeft color={busy ? theme.colors.textLight : '#1E293B'} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('partnerSubscriptionPlan')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, centerTrial && styles.scrollCentered, { paddingBottom }]}
        refreshControl={
          <RefreshControl
            refreshing={subscription.isRefetching && !busy}
            onRefresh={() => {
              subscription.refetch();
              invoices.refetch();
            }}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {subscription.isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
        ) : sub?.state === 'trial' ? (
          trialCard()
        ) : (
          <>
            {statusCard()}

            {/* Plan card — price and features come from the server because an
                admin can change both without shipping a new app build. */}
            <View style={styles.planCard}>
              {plan.isLoading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : plan.error ? (
                <Text style={styles.errorText}>{getErrorText(plan.error)}</Text>
              ) : (
                <>
                  <View style={styles.planHead}>
                    <CreditCard color={theme.colors.primary} size={20} />
                    <Text style={styles.planName}>{plan.data?.name}</Text>
                  </View>
                  <Text style={styles.planPrice}>
                    {rupees(plan.data?.priceMonth)}
                    {/* planPricePeriod already carries its own " / " separator. */}
                    <Text style={styles.planPeriod}>{t('planPricePeriod')}</Text>
                  </Text>
                  {(plan.data?.features ?? []).map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <BadgeCheck color={theme.colors.primary} size={16} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[styles.cta, busy && styles.ctaBusy, !canPurchase && !busy && styles.ctaDisabled]}
              onPress={onSubscribePress}
              // A live plan already covers the shop; renewal opens when it ends.
              disabled={busy || plan.isLoading || !canPurchase}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} /> : null}
              <Text style={[styles.ctaText, !canPurchase && !busy && styles.ctaTextDisabled]}>{ctaLabel}</Text>
            </TouchableOpacity>

            {sub?.state === 'active' && !busy ? (
              <Text style={styles.confirmNote}>
                {t('planActiveNoPurchase', { date: prettyDate(sub.coverageEndsAt) })}
              </Text>
            ) : null}
          </>
        )}

        {phase === 'confirming' ? (
          <Text style={styles.confirmNote}>{t('planConfirmingNote')}</Text>
        ) : null}

        {/* Billing history — hidden entirely until the first invoice exists. */}
        {hasInvoices ? (
          <>
            <Text style={styles.sectionTitle}>{t('planBillingHistory')}</Text>
            {invoiceList.map((inv) => {
              const tone =
                inv.status === 'paid' ? { bg: theme.colors.primaryLight, fg: theme.colors.primaryDark }
                : inv.status === 'failed' ? { bg: '#FEE2E2', fg: '#B91C1C' }
                : { bg: '#FEF3C7', fg: '#B45309' };
              return (
                <View key={inv.id} style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceAmount}>{rupees(inv.amount)}</Text>
                    {/* When the money actually moved leads, because that is what
                        an owner looks for in a receipt. The month it bought is
                        secondary — and for an unpaid attempt there is no
                        transaction date to show at all. */}
                    {inv.paidAt ? (
                      <Text style={styles.invoicePaidAt}>
                        {t('planPaidOn', { datetime: prettyDateTime(inv.paidAt) })}
                        {inv.paidVia ? ` · ${inv.paidVia.toUpperCase()}` : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.invoiceMeta}>
                      {t('planInvoiceFor', {
                        from: prettyDate(inv.periodStart),
                        to: prettyDate(inv.periodEnd),
                      })}
                    </Text>
                  </View>
                  <View style={[styles.invoiceBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.invoiceBadgeText, { color: tone.fg }]}>
                      {t(`planInvoice_${inv.status}`)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  scroll: { padding: theme.spacing.m },
  scrollCentered: { flexGrow: 1, justifyContent: 'center' },

  statusCard: { borderRadius: 16, padding: theme.spacing.m, marginBottom: theme.spacing.m },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontSize: 16, fontWeight: '700' },
  statusBody: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  statusMeta: { marginTop: 4, fontSize: 12, opacity: 0.85 },

  planCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
  },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  planPrice: { marginTop: 8, fontSize: 30, fontWeight: '800', color: theme.colors.text },
  planPeriod: { fontSize: 14, fontWeight: '500', color: theme.colors.textLight },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  featureText: { flex: 1, fontSize: 14, color: theme.colors.textDark, lineHeight: 20 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: theme.spacing.m,
  },
  ctaBusy: { opacity: 0.75 },
  // Reads as unavailable rather than merely faded — an owner on a live plan
  // should not be left wondering whether the tap failed.
  ctaDisabled: { backgroundColor: '#E2E8F0' },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  ctaTextDisabled: { color: theme.colors.textLight },
  // Trial hero: the days remaining are the only thing worth reading here, so
  // they get the weight a price would otherwise have taken.
  trialCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    paddingHorizontal: theme.spacing.m,
    paddingTop: theme.spacing.m,
    paddingBottom: theme.spacing.l,
    alignItems: 'center',
  },
  trialTitle: { fontSize: 16, fontWeight: '700', color: '#1D4ED8' },
  trialDays: {
    marginTop: theme.spacing.m,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  trialDaysUnit: { fontSize: 15, fontWeight: '600', color: '#1D4ED8', opacity: 0.9 },
  paidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  paidChipText: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  trialBody: {
    marginTop: theme.spacing.m,
    fontSize: 14,
    lineHeight: 20,
    color: '#1E40AF',
    textAlign: 'center',
  },
  confirmNote: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },

  sectionTitle: {
    marginTop: theme.spacing.l,
    marginBottom: theme.spacing.s,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  errorText: { fontSize: 14, color: theme.colors.error },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  invoiceAmount: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  invoicePaidAt: { marginTop: 3, fontSize: 12.5, fontWeight: '600', color: theme.colors.textDark },
  invoiceMeta: { marginTop: 2, fontSize: 12, color: theme.colors.textLight },
  invoiceBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  invoiceBadgeText: { fontSize: 12, fontWeight: '700' },
});

export default SubscriptionPaymentScreen;
