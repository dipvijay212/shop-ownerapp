import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, ExternalLink, Info, ShieldAlert, Trash2 } from 'lucide-react-native';
import { api } from '../api';
import { DELETE_ACCOUNT_URL } from '../api/config';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../constants/translations';

// Where each review action leads. Tabs live inside MainTabs, which only the
// approved-shop stack mounts — an action whose screen is not mounted in the
// current stack (pending / suspended / onboarding) is simply not offered.
const ACTION_ROUTES = {
  view_orders: { route: 'MainTabs', params: { screen: 'Orders' }, label: 'delActViewOrders', fallback: 'View Orders' },
  view_khata: { route: 'Customers', label: 'delActViewKhata', fallback: 'View Khata' },
  manage_subscriptions: { route: 'MainTabs', params: { screen: 'Subscriptions' }, label: 'delActViewSubscribers', fallback: 'View Subscribers' },
  manage_plan: { route: 'SubscriptionPayment', label: 'delActManagePlan', fallback: 'Manage Plan' },
  view_round: { route: 'MainTabs', params: { screen: 'Subscriptions' }, label: 'delActOpenRound', fallback: "Open Today's Round" },
  view_payments: { route: 'MainTabs', params: { screen: 'Profile' }, label: 'delActViewPayments', fallback: 'View Payments' },
};

const SEVERITY_ORDER = { blocking: 0, warning: 1, clear: 2, info: 3 };


/**
 * Delete Account (Profile → Delete Account, and the shop status screen).
 *
 *   1. intro   — what a deletion REQUEST means (locked now, deleted only if approved)
 *   2. review  — what is still attached to the account, from the server
 *   3. website — "Continue" opens the public deletion page for this app, where
 *                the OTP is verified and the request submitted
 *
 * Submitting on the website locks the account and ends every session. When the
 * person comes back to the app, the next authenticated call fails; that is
 * taken as the request having gone through and the "request submitted" notice
 * is shown (RootNavigator, outside this stack).
 */
export const DeleteAccountScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { endSessionAfterDeletionRequest, markDeletionPending, owner } = useContext(AuthContext);
  const bottomPad = Math.max(insets.bottom + 24, Platform.OS === 'android' ? 40 : 24);

  const [step, setStep] = useState('intro');
  const [review, setReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [openError, setOpenError] = useState(null);
  // Set once the website has been opened, so a return to the app re-checks.
  const openedRef = useRef(false);

  // A key's translation when this app has one, else the server's English text
  // (t's second argument is the fallback).
  const tx = useCallback((key, fallback, params) => t(key, fallback, params), [t]);

  const itemTitle = (item) => tx(`delItem_${item.key}_title`, item.title);
  const itemMessage = (item) =>
    tx(`delItem_${item.key}_${item.severity}`, item.message, { count: item.count ?? 0, amount: item.amount ?? '0' });

  const loadReview = useCallback(async () => {
    setLoadingReview(true);
    setReviewError(null);
    try {
      setReview(await api.accountDeletion.getReview());
    } catch (e) {
      setReviewError(e.message || t('delLoadFailed', 'Could not load your account review.'));
    } finally {
      setLoadingReview(false);
    }
  }, [t]);

  useEffect(() => {
    if (step === 'review') loadReview();
  }, [step, loadReview]);

  // Coming back from Orders / Khata / Subscriptions: re-check.
  useEffect(() => navigation.addListener('focus', () => {
    if (step === 'review') loadReview();
  }), [navigation, step, loadReview]);

  // Deletion is completed on the website (OTP + submit). The registered number
  // is prefilled; the OTP it receives is still what proves the account is theirs.
  const openWebsite = async () => {
    setOpenError(null);
    const phone = String(owner?.phone || '').replace(/\D/g, '').slice(-10);
    const url = phone ? `${DELETE_ACCOUNT_URL}?phone=${phone}` : DELETE_ACCOUNT_URL;
    try {
      markDeletionPending();
      openedRef.current = true;
      await Linking.openURL(url);
    } catch (e) {
      openedRef.current = false;
      setOpenError(t('delOpenFailed', 'Could not open the website. Please try again.'));
    }
  };

  // Back from the browser: if the request was submitted there, this session is
  // gone and the call fails with 401 — show the submitted notice. Otherwise the
  // review simply refreshes (they may have resolved something meanwhile).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !openedRef.current) return;
      try {
        setReview(await api.accountDeletion.getReview());
      } catch (e) {
        if (e.status === 401) {
          openedRef.current = false;
          await endSessionAfterDeletionRequest({ kind: 'deletion_submitted' });
        }
      }
    });
    return () => sub.remove();
  }, [endSessionAfterDeletionRequest]);

  const goBack = () => {
    if (step === 'review') setStep('intro');
    else navigation.goBack();
  };

  // ── render ────────────────────────────────────────────────────────────────

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel={t('delBack', 'Back')}>
        <ArrowLeft color="#1A1A1A" size={24} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('deleteAccount', 'Delete Account')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (step === 'intro') {
    const points = ['delPoint1', 'delPointShop', 'delPoint2', 'delPoint3', 'delPoint4', 'delPoint5', 'delPoint6'];
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F9F8" />
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <View style={styles.heroIcon}>
            <Trash2 color={theme.colors.error} size={32} />
          </View>
          <Text style={styles.title}>{t('delTitle', 'Delete your account?')}</Text>
          <Text style={styles.body}>{t('delIntro', 'Deleting your account will start an account deletion request.')}</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeading}>{t('delAfterConfirm', 'After you confirm this request:')}</Text>
            {points.map((k) => (
              <View key={k} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{t(k)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.noteBox}>
            <Info color="#0369A1" size={18} />
            <Text style={styles.noteText}>{t('delNotDeletedYet', 'Confirming does not delete your account straight away.')}</Text>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => navigation.goBack()}>
              <Text style={styles.btnGhostText}>{t('delCancel', 'Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => setStep('review')}>
              <Text style={styles.btnDangerText}>{t('delContinue', 'Continue')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'review') {
    const mountedRoutes = navigation.getState()?.routeNames ?? [];
    const items = review ? [...review.items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) : [];
    const blocking = items.filter((i) => i.severity === 'blocking');
    const checks = items.filter((i) => i.severity !== 'info');
    const infos = items.filter((i) => i.severity === 'info');
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F9F8" />
        {header}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl
              refreshing={loadingReview && !!review}
              onRefresh={loadReview}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          <Text style={styles.title}>{t('delReviewTitle', 'Review Before Account Deletion')}</Text>
          <Text style={styles.body}>{t('delReviewIntro', "Before requesting account deletion, please review your shop's current activity and outstanding items.")}</Text>

          {!review && loadingReview && (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.muted}>{t('delLoading', 'Checking your account…')}</Text>
            </View>
          )}
          {!review && reviewError && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{reviewError}</Text>
              <TouchableOpacity style={[styles.btn, styles.btnGhost, { marginTop: 12, flex: 0, paddingHorizontal: 24 }]} onPress={loadReview}>
                <Text style={styles.btnGhostText}>{t('delRetry', 'Try again')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {review && (
            <>
              {blocking.length > 0 && (
                <View style={styles.actionRequired}>
                  <ShieldAlert color={theme.colors.error} size={20} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.actionRequiredTitle}>{t('delActionRequired', 'Action Required')}</Text>
                    <Text style={styles.actionRequiredSub}>{t('delActionRequiredSub', 'You still have items that must be resolved before you can request deletion.')}</Text>
                  </View>
                </View>
              )}

              {checks.map((item) => {
                const candidate = item.action && ACTION_ROUTES[item.action];
                const act = candidate && mountedRoutes.includes(candidate.route) ? candidate : null;
                const tone =
                  item.severity === 'blocking' ? styles.itemBlocking : item.severity === 'warning' ? styles.itemWarning : styles.itemClear;
                return (
                  <View key={item.key} style={[styles.item, tone]}>
                    <View style={styles.itemHead}>
                      {item.severity === 'clear' ? (
                        <CheckCircle2 color={theme.colors.primary} size={18} />
                      ) : (
                        <AlertTriangle color={item.severity === 'blocking' ? theme.colors.error : '#D97706'} size={18} />
                      )}
                      <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                    </View>
                    <Text style={styles.itemMessage}>{itemMessage(item)}</Text>
                    {item.severity !== 'clear' && item.details?.length > 0 && (
                      <View style={styles.details}>
                        {item.details.slice(0, 5).map((d, i) => (
                          <View key={i} style={styles.detailRow}>
                            <Text style={styles.detailLabel} numberOfLines={1}>{d.label}</Text>
                            {d.value ? <Text style={styles.detailValue}>{String(d.value).replace(/_/g, ' ')}</Text> : null}
                          </View>
                        ))}
                      </View>
                    )}
                    {act && item.severity !== 'clear' && (
                      <TouchableOpacity style={styles.itemAction} onPress={() => navigation.navigate(act.route, act.params)}>
                        <Text style={styles.itemActionText}>{t(act.label, act.fallback)}</Text>
                        <ChevronRight color={theme.colors.primary} size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {infos.map((item) => (
                <View key={item.key} style={[styles.item, styles.itemInfo]}>
                  <View style={styles.itemHead}>
                    <Info color={theme.colors.textLight} size={18} />
                    <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                  </View>
                  <Text style={styles.itemMessage}>{itemMessage(item)}</Text>
                </View>
              ))}

              {review.can_submit && (
                <View style={styles.clearBox}>
                  <CheckCircle2 color={theme.colors.primary} size={18} />
                  <Text style={styles.clearText}>{t('delAllClear', 'No blocking items — you can request deletion.')}</Text>
                </View>
              )}

              {openError ? <Text style={[styles.errorText, { marginTop: 12 }]}>{openError}</Text> : null}

              {review.can_submit && (
                <View style={styles.noteBox}>
                  <Info color="#0369A1" size={18} />
                  <Text style={styles.noteText}>{t('delWebsiteNote', 'You will finish on the Paasora website: verify the OTP sent to your registered number and submit the request. Your account is locked as soon as you submit.')}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnDanger, styles.btnBlock, !review.can_submit && styles.btnDisabled]}
                disabled={!review.can_submit}
                onPress={openWebsite}
              >
                <View style={styles.btnRow}>
                  <Text style={styles.btnDangerText}>{t('delContinueWebsite', 'Continue on website')}</Text>
                  <ExternalLink color="#FFF" size={18} />
                </View>
              </TouchableOpacity>
              {!review.can_submit && <Text style={styles.hint}>{t('delResolveFirst', 'Resolve the items marked above, then pull down to refresh.')}</Text>}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', ...theme.shadows.soft },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16, marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  body: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, ...theme.shadows.soft },
  cardHeading: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.error, marginTop: 8, marginRight: 10 },
  bulletText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 21 },
  noteBox: { flexDirection: 'row', gap: 10, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 12, marginVertical: 12, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 13, color: '#075985', lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnBlock: { flex: 0, marginTop: 16 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnGhost: { borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#FFF' },
  btnGhostText: { fontSize: 16, fontWeight: '700', color: '#334155' },
  btnDanger: { backgroundColor: theme.colors.error },
  btnDangerText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  btnDisabled: { backgroundColor: '#CBD5E1' },
  centerBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  muted: { color: '#64748B', fontSize: 14 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actionRequired: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2',
    borderColor: '#FECACA', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12,
  },
  actionRequiredTitle: { fontSize: 15, fontWeight: '800', color: '#B91C1C' },
  actionRequiredSub: { fontSize: 13, color: '#7F1D1D', marginTop: 2, lineHeight: 18 },
  item: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1 },
  itemBlocking: { borderColor: '#FCA5A5' },
  itemWarning: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  itemClear: { borderColor: '#E2E8F0' },
  itemInfo: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  itemMessage: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 19 },
  details: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  detailLabel: { flex: 1, fontSize: 12, color: '#334155' },
  detailValue: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  itemAction: { flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' },
  itemActionText: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 },
  clearBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, marginTop: 4 },
  clearText: { flex: 1, color: '#166534', fontWeight: '700', fontSize: 14 },
  hint: { textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 8 },
});

export default DeleteAccountScreen;
