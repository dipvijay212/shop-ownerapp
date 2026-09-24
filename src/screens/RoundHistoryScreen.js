import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarRange, Truck } from 'lucide-react-native';
import { theme } from '../theme';
import DateRangeSheet from '../components/DateRangeSheet';
import { api } from '../api';
import { adaptRoundHistory } from '../api/adapters';
import { useTranslation } from '../constants/translations';
import { useScreenPadding } from '../hooks/useScreenPadding';
import { openWhatsApp } from '../utils/phone';
import OwnerOrderCard from '../components/OwnerOrderCard';

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const pretty = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const formatAddress = (a) =>
  !a ? '' : [a.address_line, a.area, a.pincode].filter(Boolean).join(', ');

/**
 * Past standing deliveries.
 *
 * Thirty days by default — "everything" on a shop running a daily round is a
 * very long list, and the recent past is what gets looked at. A single date or
 * a range covers the rest.
 */
export const RoundHistoryScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { bottom: paddingBottom } = useScreenPadding();

  const [range, setRange] = useState({ from: null, to: null });
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['roundHistory', range.from, range.to],
    queryFn: async () => {
      return adaptRoundHistory(await api.subscriptions.getHistory({ from: range.from, to: range.to }));
    },
  });

  const call = (num) => num && Linking.openURL(`tel:${num}`);
  const whatsApp = (num, name) => {
    if (!num) return;
    const msg = `Hello ${name || ''}, about your delivery.`;
    openWhatsApp(num, msg, () =>
      Toast.show({ type: 'error', text1: t('badPhone', 'That number cannot be opened in WhatsApp') }),
    );
  };

  const statusFor = (status) =>
    status === 'delivered'
      ? { bg: '#DCFCE7', text: '#15803D', label: t('markDeliveredOne') }
      : status === 'not_delivered'
        ? { bg: '#FEE2E2', text: '#B91C1C', label: t('markNotDelivered') }
        : { bg: '#DBEAFE', text: '#1D4ED8', label: t('roundToConfirm') };


  const presets = [
    { key: '30', label: t('historyLast30'), from: null, to: null },
    { key: '7', label: t('historyLast7'), from: addDays(istToday(), -7), to: istToday() },
    { key: 'today', label: t('roundDayToday'), from: istToday(), to: istToday() },
  ];
  const activeKey =
    !range.from ? '30' : range.from === istToday() && range.to === istToday() ? 'today'
    : range.from === addDays(istToday(), -7) && range.to === istToday() ? '7' : 'custom';

  const items = data?.items ?? [];
  const totals = data?.totals;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('deliveryHistory')}</Text>
          {data?.from ? (
            <Text style={styles.headerDate}>{pretty(data.from)} – {pretty(data.to)}</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filters}>
        {presets.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.chip, activeKey === p.key && styles.chipOn]}
            onPress={() => setRange({ from: p.from, to: p.to })}
          >
            <Text style={[styles.chipText, activeKey === p.key && styles.chipTextOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, activeKey === 'custom' && styles.chipOn]}
          onPress={() => setPickerOpen(true)}
        >
          <CalendarRange
            size={13}
            color={activeKey === 'custom' ? '#15803D' : '#64748B'}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.chipText, activeKey === 'custom' && styles.chipTextOn]}>
            {activeKey === 'custom' && range.from
              ? `${pretty(range.from)} – ${pretty(range.to ?? range.from)}`
              : t('historyRangeChip')}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OwnerOrderCard
              order={item}
              statusConfig={statusFor(item.status)}
              placedLabel={pretty(item.scheduledDate)}
              addressLine={formatAddress(item.address)}
              onCall={call}
              onWhatsApp={whatsApp}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom },
            items.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListHeaderComponent={
            items.length > 0 && totals ? (
              <View style={styles.summary}>
                <View style={styles.summaryCell}>
                  <Text style={[styles.summaryValue, styles.ok]}>{totals.delivered}</Text>
                  <Text style={styles.summaryLabel}>{t('markDeliveredOne')}</Text>
                </View>
                {totals.notDelivered > 0 ? (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryCell}>
                      <Text style={[styles.summaryValue, styles.miss]}>{totals.notDelivered}</Text>
                      <Text style={styles.summaryLabel}>{t('markNotDelivered')}</Text>
                    </View>
                  </>
                ) : null}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>₹{totals.value.toFixed(2)}</Text>
                  <Text style={styles.summaryLabel}>{t('historyValue')}</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Truck color="#CBD5E1" size={46} />
              <Text style={styles.emptyTitle}>{t('historyEmpty')}</Text>
              <Text style={styles.emptySub}>{t('historyEmptySub')}</Text>
            </View>
          }
        />
      )}

      <DateRangeSheet
        visible={pickerOpen}
        today={istToday()}
        initialFrom={range.from}
        initialTo={range.to}
        onClose={() => setPickerOpen(false)}
        onApply={({ from, to }) => {
          setRange({ from, to });
          setPickerOpen(false);
        }}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  headerDate: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 1 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    marginTop: 6,
  },
  chipOn: { backgroundColor: '#DCFCE7' },
  chipText: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  chipTextOn: { color: '#15803D' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#334155', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#F1F5F9' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#475569' },
  ok: { color: '#15803D' },
  miss: { color: '#B91C1C' },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 2 },
});

export default RoundHistoryScreen;
