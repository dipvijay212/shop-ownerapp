import React, { useCallback, useContext, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CalendarOff, Check, CheckCheck, Clock, History,
  AlertTriangle, ArrowRight, PauseCircle, Phone, Repeat, Trash2, X,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { theme } from '../theme';
import { formatWindow, to12h } from '../utils/time';
import { api } from '../api';
import { getErrorText } from '../api/errors';
import { adaptRound } from '../api/adapters';
import { useTranslation } from '../constants/translations';
import { AuthContext } from '../context/AuthContext';
import { useScreenPadding } from '../hooks/useScreenPadding';
import { openWhatsApp } from '../utils/phone';
import OwnerOrderCard from '../components/OwnerOrderCard';
import ConfirmSheet from '../components/ConfirmSheet';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LIVE = ['placed', 'preparing', 'ready', 'out_for_delivery'];

// Why a subscriber will not appear in the round. Nothing here is the shop's
// fault to fix in a hurry, but an unexplained absence is worse than a reason.
const BLOCKED_COPY = {
  product_unavailable: 'subBlockedProduct',
  shop_unavailable: 'subBlockedShop',
  shop_closed_those_days: 'subBlockedHours',
};

const prettyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
// "8:35 AM" today, "9:00 PM, 26 Sep" on another day — IST, whatever the phone says.
const answerByText = (iso) => {
  if (!iso) return '';
  const ist = new Date(Date.parse(iso) + 5.5 * 3600 * 1000).toISOString();
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const time = to12h(ist.slice(11, 16));
  return ist.slice(0, 10) === today ? time : `${time}, ${prettyDate(ist.slice(0, 10))}`;
};
const addDaysIso = (iso, n) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const formatAddress = (a) =>
  !a ? '' : [a.address_line, a.area, a.pincode].filter(Boolean).join(', ');

/**
 * Subscriptions — the whole standing-order side of the shop on one screen.
 *
 * Today's deliveries sit on top because they are the only thing needing action;
 * the arrangements behind them follow. Anything confirmed drops straight out
 * and into History. Deliveries and Delivery Times used to be separate screens,
 * which meant the work and the reason for it never appeared together.
 */
export const SubscribersScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { insets, bottom: paddingBottom, footer: footerPad } = useScreenPadding();
  const { markSubscriptionsSeen, newSubscriptionsCount, refreshCounters } = useContext(AuthContext);
  const isFocused = useIsFocused();

  const [busyId, setBusyId] = useState(null);
  const [showClosures, setShowClosures] = useState(false);
  const [pickingClosure, setPickingClosure] = useState(false);
  const [closureReason, setClosureReason] = useState('');

  const { data: round, isLoading: roundLoading, refetch: refetchRound, isRefetching } = useQuery({
    queryKey: ['round'],
    queryFn: async () => adaptRound(await api.subscriptions.getRound()),
    refetchInterval: 60000,
  });

  const { data: subs, isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ['subscribers'],
    queryFn: async () => (await api.subscriptions.listSubscribers()) ?? { items: [], totals: {} },
  });

  // Quantity changes waiting on the shop. Polled like the round: a request
  // has a deadline, and one found after it has expired is no use to anyone.
  const { data: changeRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['changeRequests'],
    queryFn: async () => (await api.subscriptions.listChangeRequests())?.items ?? [],
    refetchInterval: 60000,
  });
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const afterDecision = () => {
    setBusyId(null);
    queryClient.invalidateQueries({ queryKey: ['changeRequests'] });
    queryClient.invalidateQueries({ queryKey: ['round'] });
    refreshCounters?.();
  };
  const approveChange = useMutation({
    mutationFn: (id) => api.subscriptions.approveChangeRequest(id),
    onSuccess: () => Toast.show({ type: 'success', text1: t('changeApproved', 'Approved — the customer has been told') }),
    onError: (err) => Toast.show({ type: 'error', text1: getErrorText(err) }),
    onSettled: afterDecision,
  });
  const rejectChange = useMutation({
    mutationFn: ({ id, reason }) => api.subscriptions.rejectChangeRequest(id, reason),
    onSuccess: () => {
      setRejecting(null);
      setRejectReason('');
      Toast.show({ type: 'success', text1: t('changeRejected', 'Declined — the customer has been told') });
    },
    onError: (err) => { setRejecting(null); Toast.show({ type: 'error', text1: getErrorText(err) }); },
    onSettled: afterDecision,
  });

  const { data: closures } = useQuery({
    queryKey: ['closures'],
    queryFn: async () => (await api.subscriptions.listClosures())?.items ?? [],
    enabled: showClosures,
  });

  // Seeing this screen IS having seen the new subscriptions.
  //
  // On focus, not on mount. The tab bar never unmounts its screens, so a
  // mount-only clear ran exactly once — for whatever was waiting the first time
  // the owner ever opened the round. Every subscription that arrived after that
  // lit the dot and nothing the owner did in the app could put it out.
  useFocusEffect(
    useCallback(() => {
      // Locally first: the owner is looking at the list, so the dot has already
      // done its job and should not wait on a round trip. Stamped again when the
      // server confirms, so a counter poll that was already in flight cannot
      // come back with the pre-clear count and light it up again.
      markSubscriptionsSeen?.();
      api.subscriptions.clearUnseen()
        .then(() => markSubscriptionsSeen?.())
        .catch(() => {});
    }, [markSubscriptionsSeen]),
  );

  // And the other half of it: a subscription can land while the round is
  // already open. The counter poll would light the dot on the very tab the
  // owner is looking at, and clearing only on focus cannot put that out
  // without them leaving the screen and coming back to it.
  useEffect(() => {
    if (!isFocused || !newSubscriptionsCount) return;
    markSubscriptionsSeen?.();
    api.subscriptions.clearUnseen().catch(() => {});
  }, [isFocused, newSubscriptionsCount, markSubscriptionsSeen]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['round'] });
    queryClient.invalidateQueries({ queryKey: ['roundHistory'] });
  };

  const deliverAll = useMutation({
    mutationFn: () => api.subscriptions.deliverAll(round?.date),
    onSuccess: (res) => {
      const body = res?.data ?? res;
      Toast.show({ type: 'success', text1: t('deliveredCount', { count: body?.delivered ?? 0 }) });
      invalidate();
    },
    onError: (err) => Toast.show({ type: 'error', text1: getErrorText(err) }),
  });
  const deliverOne = useMutation({
    mutationFn: (id) => api.subscriptions.markDelivered(id),
    onSettled: () => { setBusyId(null); invalidate(); },
    onError: (err) => Toast.show({ type: 'error', text1: getErrorText(err) }),
  });
  const notDelivered = useMutation({
    mutationFn: (id) => api.subscriptions.markNotDelivered(id, t('notDeliveredReason')),
    onSuccess: () => Toast.show({ type: 'success', text1: t('notDeliveredNoCharge') }),
    onSettled: () => { setBusyId(null); invalidate(); },
    onError: (err) => Toast.show({ type: 'error', text1: getErrorText(err) }),
  });
  const addClosure = useMutation({
    mutationFn: (date) => api.subscriptions.addClosure(date, closureReason.trim() || undefined),
    onSuccess: () => {
      setClosureReason('');
      Toast.show({ type: 'success', text1: t('closedDateAdded') });
      queryClient.invalidateQueries({ queryKey: ['closures'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: getErrorText(err) }),
  });
  const removeClosure = useMutation({
    mutationFn: (date) => api.subscriptions.removeClosure(date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['closures'] }),
    onError: (err) => Toast.show({ type: 'error', text1: getErrorText(err) }),
  });

  const call = (num) => num && Linking.openURL(`tel:${num}`);
  const whatsApp = (num, name) => {
    if (!num) return;
    const msg = `Hello ${name || ''}, about your delivery.`;
    openWhatsApp(num, msg, () =>
      Toast.show({ type: 'error', text1: t('badPhone', 'That number cannot be opened in WhatsApp') }),
    );
  };

  // Confirming the whole round at once writes a khata charge per delivery, so
  // it asks — in the app's own voice rather than an OS dialog.
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const statusFor = (s) =>
    s === 'delivered' ? { bg: '#DCFCE7', text: '#15803D', label: t('markDeliveredOne') }
    : s === 'not_delivered' ? { bg: '#FEE2E2', text: '#B91C1C', label: t('markNotDelivered') }
    // The customer skipped it after it was made up — nothing to deliver.
    : s === 'cancelled' ? { bg: '#F1F5F9', text: '#64748B', label: t('roundCancelledByCustomer', 'Cancelled by customer') }
    : { bg: '#DBEAFE', text: '#1D4ED8', label: t('roundToConfirm') };

  const renderDelivery = (item) => {
    const live = LIVE.includes(item.status);
    const busy = busyId === item.id;
    return (
      <OwnerOrderCard
        order={item}
        statusConfig={statusFor(item.status)}
        addressLine={formatAddress(item.address)}
        onCall={call}
        onWhatsApp={whatsApp}
        actions={live ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              disabled={busy}
              onPress={() => { setBusyId(item.id); deliverOne.mutate(item.id); }}
            >
              {busy && deliverOne.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check color="#FFFFFF" size={15} style={{ marginRight: 5 }} />
                  <Text style={styles.actionPrimaryText}>{t('markDeliveredOne')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionGhost]}
              disabled={busy}
              onPress={() => { setBusyId(item.id); notDelivered.mutate(item.id); }}
            >
              <X color="#DC2626" size={15} style={{ marginRight: 5 }} />
              <Text style={styles.actionGhostText}>{t('markNotDelivered')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      />
    );
  };

  // A customer asking for a different quantity on ONE delivery. Spelled out in
  // full — which product and pack, which delivery, usual against requested,
  // what it does to the bill — because "curd 1 → 3" left the owner guessing
  // what was being counted and whether the subscription itself was changing.
  const renderRequest = (item) => {
    const busy = busyId === item.id;
    const more = item.quantity > item.usual_quantity;
    const tomorrow = item.today ? addDaysIso(item.today, 1) : null;
    const day = item.date === item.today
      ? t('changeDayToday', "Today's delivery")
      : item.date === tomorrow
        ? t('changeDayTomorrow', "Tomorrow's delivery")
        : t('changeDayOn', 'Delivery on {date}', { date: prettyDate(item.date) });
    const when = [
      prettyDate(item.date),
      item.delivery_window ? formatWindow(item.delivery_window.starts_at, item.delivery_window.ends_at) : null,
    ].filter(Boolean).join(' · ');
    const name = item.customer?.name || item.customer?.phone;
    return (
      <View style={styles.reqCard}>
        <View style={styles.reqKickerRow}>
          <Repeat color="#B45309" size={13} style={{ marginRight: 5 }} />
          <Text style={styles.reqKicker}>{t('changeKicker', 'Quantity change for one delivery')}</Text>
        </View>

        <View style={styles.reqProductRow}>
          {item.product?.image_url ? (
            <Image source={{ uri: item.product.image_url }} style={styles.reqThumb} />
          ) : (
            <View style={styles.reqThumb} />
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.subProduct} numberOfLines={1}>
              {item.product?.name}
              {item.pack_label ? <Text style={styles.reqPack}>{`  ·  ${item.pack_label}`}</Text> : null}
            </Text>
            <Text style={styles.subCustomer} numberOfLines={1}>
              {t('changeFromCustomer', 'Asked by {name}', { name })}
            </Text>
          </View>
          {item.customer?.phone ? (
            <TouchableOpacity style={styles.reqCallBtn} onPress={() => call(item.customer.phone)}>
              <Phone color={theme.colors.primary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.reqWhenBox}>
          <Text style={styles.reqWhenDay}>{day}</Text>
          <Text style={styles.reqWhenText}>{when}</Text>
        </View>

        {/* Usual against requested, side by side, each with what it costs. */}
        <View style={styles.reqCompare}>
          <View style={styles.reqCol}>
            <Text style={styles.reqColLabel}>{t('changeUsual', 'Usual')}</Text>
            <Text style={styles.reqColQty}>{item.usual_label}</Text>
            {item.usual_total ? <Text style={styles.reqColPrice}>₹{item.usual_total}</Text> : null}
          </View>
          <ArrowRight color="#94A3B8" size={18} />
          <View style={[styles.reqCol, more ? styles.reqColMore : styles.reqColLess]}>
            <Text style={styles.reqColLabel}>
              {more ? t('changeWantsMore', 'Wants more') : t('changeWantsLess', 'Wants less')}
            </Text>
            <Text style={[styles.reqColQty, more ? styles.reqQtyMoreText : styles.reqQtyLessText]}>
              {item.requested_label}
            </Text>
            {item.requested_total ? <Text style={styles.reqColPrice}>₹{item.requested_total}</Text> : null}
          </View>
        </View>

        <Text style={styles.reqNote}>
          {t('changeOnlyThis', 'Only this delivery changes. The subscription stays at {usual}.', { usual: item.usual_label })}
        </Text>
        <Text style={styles.reqDeadline}>
          {t('changeAnswerByFull', 'Answer by {time} — otherwise the usual quantity goes out.', {
            time: answerByText(item.answer_by),
          })}
        </Text>

        <View style={styles.reqActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionPrimary, { flex: 1, justifyContent: 'center' }]}
            disabled={busy}
            onPress={() => { setBusyId(item.id); approveChange.mutate(item.id); }}
          >
            {busy && approveChange.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Check color="#FFFFFF" size={15} style={{ marginRight: 5 }} />
                <Text style={styles.actionPrimaryText}>
                  {t('changeApproveSend', 'Send {qty}', { qty: item.requested_label })}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionGhost, { flex: 1, justifyContent: 'center' }]}
            disabled={busy}
            onPress={() => { setRejectReason(''); setRejecting(item); }}
          >
            <X color="#DC2626" size={15} style={{ marginRight: 5 }} />
            <Text style={styles.actionGhostText}>{t('changeKeepUsual', 'Keep usual')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSubscriber = (item) => {
    const paused = item.status === 'paused';
    // A pause the SHOP caused by going out of stock explains itself and ends by
    // itself; the generic "product unavailable" reads like the subscription is
    // finished, which it is not.
    const blockedKey = item.pause_reason === 'out_of_stock'
      ? 'subPausedOutOfStock'
      : BLOCKED_COPY[item.blocked_reason];
    return (
      <View style={[styles.subCard, paused && styles.subCardPaused]}>
        <View style={styles.subTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subProduct} numberOfLines={1}>
              {item.product?.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
            </Text>
            <Text style={styles.subCustomer} numberOfLines={1}>
              {item.customer?.name || item.customer?.phone}
            </Text>
          </View>
          {paused ? (
            <View style={styles.pausedPill}>
              <PauseCircle color="#B45309" size={12} style={{ marginRight: 4 }} />
              <Text style={styles.pausedPillText}>{t('subscribersPaused')}</Text>
            </View>
          ) : item.khata_requested ? (
            <View style={styles.khataPill}><Text style={styles.khataPillText}>{t('onKhata', 'Khata')}</Text></View>
          ) : null}
        </View>

        {item.delivery_window ? (
          <View style={styles.slotRow}>
            <Clock color={theme.colors.primary} size={13} style={{ marginRight: 5 }} />
            <Text style={styles.slotText}>
              {formatWindow(item.delivery_window.starts_at, item.delivery_window.ends_at)}
            </Text>
          </View>
        ) : null}

        <View style={styles.daysRow}>
          {DAY_LETTERS.map((letter, idx) => {
            const on = (item.weekdays ?? []).includes(idx);
            return (
              <View key={idx} style={[styles.dayDot, on && styles.dayDotOn]}>
                <Text style={[styles.dayDotText, on && styles.dayDotTextOn]}>{letter}</Text>
              </View>
            );
          })}
          <Text style={styles.nextLine}>
            {item.next_delivery ? t('nextDeliveryOn', { date: prettyDate(item.next_delivery) }) : t('nextDeliveryNone')}
          </Text>
        </View>

        {blockedKey ? (
          <View style={styles.blockedRow}>
            <AlertTriangle color="#B45309" size={13} style={styles.blockedIcon} />
            <Text style={styles.blockedText}>{t(blockedKey)}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const deliveries = useMemo(() => {
    const items = [...(round?.items ?? [])];
    items.sort((a, b) => {
      // Unconfirmed (live/pending action) deliveries show at the top
      const liveA = LIVE.includes(a.status) ? 1 : 0;
      const liveB = LIVE.includes(b.status) ? 1 : 0;
      if (liveA !== liveB) return liveB - liveA;

      // By order number, then by when it was raised — never by `id`, which is
      // an opaque public id whose scraped-out digits sort arbitrarily.
      const seq = (o) => parseInt(String(o.orderNumber ?? '').replace(/\D/g, ''), 10) || 0;
      const bySeq = seq(b) - seq(a);
      if (bySeq !== 0) return bySeq;
      return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
    });
    return items;
  }, [round?.items]);

  const subscribers = subs?.items ?? [];
  const pending = round?.pendingCount ?? 0;
  const away = round?.customersAway ?? 0;

  // Two sections rather than one sorted list. Pending deliveries were already
  // sorted to the top, but with nothing marking where they ended the boundary
  // was invisible — a settled delivery directly under a pending one reads as
  // part of the same run of work.
  const toConfirm = deliveries.filter((d) => LIVE.includes(d.status));
  const settled = deliveries.filter((d) => !LIVE.includes(d.status));

  const requests = changeRequests ?? [];
  const sections = [
    // Waiting on the shop, with a deadline — above everything else.
    ...(requests.length
      ? [{ key: 'requests', title: t('changeRequestsSection', 'Quantity requests'), data: requests, kind: 'request' }]
      : []),
    ...(toConfirm.length
      ? [{ key: 'today', title: t('todaysDeliveries'), data: toConfirm, kind: 'delivery' }]
      : []),
    ...(settled.length
      ? [{ key: 'done', title: t('roundDone', 'Done today'), data: settled, kind: 'delivery' }]
      : []),
    // Nothing at all today still needs the section header to say so.
    ...(deliveries.length === 0
      ? [{ key: 'today', title: t('todaysDeliveries'), data: [], kind: 'delivery' }]
      : []),
    { key: 'subs', title: t('subscribersSection'), data: subscribers, kind: 'sub' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {/* A bottom tab has nothing behind it. The arrow is left over from when
            this screen was pushed from More. */}
        <Text style={styles.headerTitleFirst}>{t('subscribers')}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowClosures(true)}>
          <CalendarOff color="#B45309" size={19} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('RoundHistory')}>
          <History color={theme.colors.primary} size={19} />
        </TouchableOpacity>
      </View>

      {roundLoading && subsLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          stickySectionHeadersEnabled={false}
          renderItem={({ item, section }) =>
            section.kind === 'delivery'
              ? renderDelivery(item)
              : section.kind === 'request'
                ? renderRequest(item)
                : renderSubscriber(item)
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.key === 'today' && away > 0 ? (
                <Text style={styles.awayInline}>
                  {away === 1 ? t('roundAwayOne') : t('roundAway', { count: away })}
                </Text>
              ) : null}
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <View style={styles.sectionEmptyBox}>
                <Text style={styles.sectionEmptyTitle}>
                  {section.key === 'today' ? t('nothingToday') : t('noSubscribers')}
                </Text>
                <Text style={styles.sectionEmpty}>
                  {section.key === 'today' ? t('nothingTodaySub') : t('noSubscribersSub')}
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: paddingBottom + (pending > 0 ? 78 : 0) }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => { refetchRound(); refetchSubs(); refetchRequests(); }}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {pending > 0 ? (
        <View style={[styles.footer, { paddingBottom: footerPad }]}>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setConfirmAllOpen(true)} disabled={deliverAll.isPending}>
            {deliverAll.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <CheckCheck color="#FFFFFF" size={19} style={{ marginRight: 8 }} />
                <Text style={styles.bulkBtnText}>{t('markAllDelivered')} ({pending})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <ConfirmSheet
        visible={confirmAllOpen}
        busy={deliverAll.isPending}
        title={t('markAllDelivered')}
        body={t('roundPending', { count: round?.pendingCount ?? 0 })}
        cancelLabel={t('cancel', 'Cancel')}
        confirmLabel={t('markAllDelivered')}
        onCancel={() => setConfirmAllOpen(false)}
        onConfirm={() => {
          setConfirmAllOpen(false);
          deliverAll.mutate();
        }}
      />

      {/* Closed dates — "the shop is shut that day", the same idea as a closed
          weekday. Nothing generates and every subscriber is told. */}
      <Modal visible={showClosures} transparent animationType="slide" onRequestClose={() => setShowClosures(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowClosures(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(footerPad, 20) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('closedDatesShort')}</Text>
              <TouchableOpacity onPress={() => setShowClosures(false)}>
                <X color="#1E293B" size={22} />
              </TouchableOpacity>
            </View>

            {(closures ?? []).length === 0 ? (
              <Text style={styles.sectionEmpty}>{t('noClosedDates')}</Text>
            ) : (
              (closures ?? []).map((c) => (
                <View key={c.date} style={styles.closureRow}>
                  <CalendarOff color="#B45309" size={16} style={{ marginRight: 9 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.closureDate}>{prettyDate(c.date)}</Text>
                    {c.reason ? <Text style={styles.closureReason}>{c.reason}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => removeClosure.mutate(c.date)} style={{ padding: 6 }}>
                    <Trash2 color="#DC2626" size={16} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TextInput
              style={styles.reasonInput}
              placeholder={t('closedDateReason')}
              placeholderTextColor="#94A3B8"
              value={closureReason}
              onChangeText={setClosureReason}
            />
            <TouchableOpacity style={styles.addClosureBtn} onPress={() => setPickingClosure(true)}>
              <CalendarOff color="#FFFFFF" size={16} style={{ marginRight: 6 }} />
              <Text style={styles.addClosureText}>{t('addClosedDate')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Declining says why — "out of stock tomorrow" is worth more to the
          customer than a bare no. The reason is optional. */}
      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRejecting(null)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(footerPad, 20) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('rejectChangeTitle', 'Decline this request?')}</Text>
              <TouchableOpacity onPress={() => setRejecting(null)}>
                <X color="#1E293B" size={22} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionEmpty}>
              {t('rejectChangeBody', 'The customer gets their usual quantity on {date}.', { date: prettyDate(rejecting?.date) })}
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder={t('rejectChangeReason', 'Reason (optional)')}
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              maxLength={120}
            />
            <TouchableOpacity
              style={[styles.addClosureBtn, styles.rejectBtn]}
              disabled={rejectChange.isPending}
              onPress={() => {
                setBusyId(rejecting.id);
                rejectChange.mutate({ id: rejecting.id, reason: rejectReason.trim() || undefined });
              }}
            >
              {rejectChange.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.addClosureText}>{t('changeKeepUsual', 'Keep usual')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {pickingClosure ? (
        <DateTimePicker
          value={new Date()}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setPickingClosure(false);
            if (event?.type === 'dismissed' || !date) return;
            addClosure.mutate(date.toISOString().slice(0, 10));
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitleFirst: { flex: 1, fontSize: 19, fontWeight: '800', color: '#1E293B', marginLeft: 4 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, flexGrow: 1 },
  sectionHeader: { marginTop: 6, marginBottom: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  awayInline: { fontSize: 11.5, fontWeight: '700', color: '#B45309', marginTop: 4 },
  sectionEmptyBox: {
    backgroundColor: '#FFFFFF', borderRadius: 15, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center',
  },
  sectionEmptyTitle: { fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 3 },
  sectionEmpty: { fontSize: 12.5, color: '#94A3B8', fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, marginRight: 9,
  },
  actionPrimary: { backgroundColor: theme.colors.primary },
  actionPrimaryText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' },
  actionGhost: { backgroundColor: '#FEF2F2' },
  actionGhostText: { fontSize: 12.5, fontWeight: '800', color: '#DC2626' },
  subCard: {
    backgroundColor: '#FFFFFF', borderRadius: 15, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  subCardPaused: { backgroundColor: '#FCFCFD' },
  subTop: { flexDirection: 'row', alignItems: 'flex-start' },
  subProduct: { fontSize: 14.5, fontWeight: '800', color: '#1E293B' },
  subCustomer: { fontSize: 12.5, fontWeight: '600', color: '#64748B', marginTop: 2 },
  khataPill: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  khataPillText: { fontSize: 10.5, fontWeight: '800', color: '#1D4ED8' },
  pausedPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8,
  },
  pausedPillText: { fontSize: 10.5, fontWeight: '800', color: '#B45309' },
  slotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  slotText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  daysRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  dayDot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  },
  dayDotOn: { backgroundColor: theme.colors.primary },
  dayDotText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  dayDotTextOn: { color: '#FFFFFF' },
  nextLine: { fontSize: 11.5, fontWeight: '700', color: '#334155', marginLeft: 8, flexShrink: 1 },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    backgroundColor: '#FEF3C7', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7,
  },
  blockedIcon: { marginRight: 6 },
  blockedText: { flex: 1, fontSize: 11.5, fontWeight: '700', color: '#92400E' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.primary, borderRadius: 13, paddingVertical: 15,
  },
  bulkBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 18, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  closureRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  closureDate: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  closureReason: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 1 },
  reasonInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B', marginTop: 14,
  },
  addClosureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#D97706', borderRadius: 11, paddingVertical: 12, marginTop: 12,
  },
  addClosureText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' },
  rejectBtn: { backgroundColor: '#DC2626' },
  reqCard: {
    backgroundColor: '#FFFFFF', borderRadius: 15, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  reqKickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reqKicker: {
    fontSize: 11, fontWeight: '800', color: '#B45309',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  reqProductRow: { flexDirection: 'row', alignItems: 'center' },
  reqThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1F5F9' },
  reqPack: { fontSize: 12.5, fontWeight: '600', color: '#64748B' },
  reqCallBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  reqWhenBox: {
    marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  reqWhenDay: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  reqWhenText: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 2 },
  reqCompare: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  reqCol: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 10, paddingVertical: 8,
  },
  reqColMore: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  reqColLess: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  reqColLabel: { fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  reqColQty: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginTop: 3 },
  reqColPrice: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 1 },
  reqQtyMoreText: { color: '#15803D' },
  reqQtyLessText: { color: '#B45309' },
  reqNote: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 10, lineHeight: 17 },
  reqDeadline: { fontSize: 11.5, fontWeight: '600', color: '#B45309', marginTop: 4, lineHeight: 16 },
  reqActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});

export default SubscribersScreen;
