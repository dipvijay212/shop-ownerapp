import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { X, Repeat } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';

// Shown when a line has no image snapshot; the API returns null for those.
const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400';

/**
 * One order in full: what was bought, where it went, and how it was paid for.
 *
 * Lifted out of OrdersScreen so the Khata tab's order list can open the very
 * same sheet. Two copies of a settlement breakdown is exactly how the two
 * copies in this app drifted apart in the first place.
 */

const parseOrderDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatOrderDate = (d) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const formatOrderAddress = (address) => {
  if (!address) return '';
  return [address.address_line, address.area, address.pincode].filter(Boolean).join(', ');
};

// `labelKey`, not `label`: this map is module-level, so a literal here would
// freeze the badge to whatever language the bundle was written in.
const STATUS_STYLE = {
  placed: { bg: '#FEF3C7', text: '#D97706', labelKey: 'statusNewPlaced' },
  accepted: { bg: '#DBEAFE', text: '#2563EB', labelKey: 'statusPreparing' },
  preparing: { bg: '#DBEAFE', text: '#2563EB', labelKey: 'statusPreparing' },
  ready: { bg: '#E0E7FF', text: '#4338CA', labelKey: 'statusReady' },
  out_for_delivery: { bg: '#E0E7FF', text: '#4338CA', labelKey: 'statusOutForDelivery' },
  delivered: { bg: '#DCFCE7', text: '#15803D', labelKey: 'statusDelivered' },
  not_delivered: { bg: '#FEE2E2', text: '#B91C1C', labelKey: 'statusNotDelivered' },
  cancelled: { bg: '#F1F5F9', text: '#64748B', labelKey: 'statusCancelledLabel' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C', labelKey: 'statusRejected' },
};
const getStatusStyle = (status) =>
  STATUS_STYLE[String(status || '').toLowerCase()] || STATUS_STYLE.placed;

export const OrderDetailSheet = ({ visible, order, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'android' ? 36 : 28) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('orderDetailsTitle')}</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color={theme.colors.textDark} />
              </TouchableOpacity>
            </View>

            {order && (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalSummaryBox}>
                  <View>
                    <Text style={styles.modalOrderId}>Order #{order.orderNumber || order.id}</Text>
                    <Text style={styles.modalOrderDate}>
                      {(() => {
                        const d = parseOrderDate(order.createdAt);
                        return d
                          ? `${formatOrderDate(d)} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : '';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.summaryBadges}>
                    {/* The ledger stopped calling these out, on the grounds
                        that the order would say so. This is the order. */}
                    {order.isSubscription ? (
                      <View style={styles.subBadge}>
                        <Repeat size={11} color="#7C3AED" style={styles.subBadgeIcon} />
                        <Text style={styles.subBadgeText}>{t('subscriptionTag')}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(order.status).bg }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusStyle(order.status).text }]}>
                        {t(getStatusStyle(order.status).labelKey)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Customer Section */}
                <Text style={styles.modalSectionTitle}>{t('customerAndAddress')}</Text>
                <View style={styles.modalDetailCard}>
                  <Text style={styles.modalCustName}>{order.customer_name}</Text>
                  <Text style={styles.modalCustPhone}>Mobile: {order.customer_phone?.startsWith('+') || order.customer_phone?.startsWith('91') ? order.customer_phone : `+91 ${order.customer_phone}`}</Text>
                  <Text style={styles.modalAddress}>{formatOrderAddress(order.address)}</Text>
                  {order.customerNote && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteTitle}>{t('customerInstructionNote')}</Text>
                      <Text style={styles.noteContent}>"{order.customerNote}"</Text>
                    </View>
                  )}
                </View>

                {/* Items Section */}
                <Text style={styles.modalSectionTitle}>{t('itemizedInvoice')}</Text>
                <View style={styles.modalDetailCard}>
                  {/* The API sends an image snapshot per line — what was
                      actually sold, not whatever the catalogue holds now — and
                      the invoice was throwing it away. A name alone is hard to
                      match against a shelf. */}
                  {order.items?.map((item, index) => (
                    <View key={index} style={styles.invoiceItemRow}>
                      <Image
                        source={{ uri: item.image_url || PLACEHOLDER_IMAGE }}
                        style={styles.invoiceThumb}
                      />
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.invoiceItemName}>
                          {item.name} <Text style={{ color: theme.colors.textLight }}>x{item.quantity}</Text>
                        </Text>
                        {item.kind === 'both' && (
                          <View style={styles.kindBadgeBoth}>
                            <Repeat size={10} color="#047857" style={{ marginRight: 3 }} />
                            <Text style={styles.kindBadgeTextBoth}>{t('mixSubscriptionNormal')}</Text>
                          </View>
                        )}
                        {item.kind === 'subscription' && (
                          <View style={styles.kindBadgeSub}>
                            <Repeat size={10} color="#7C3AED" style={{ marginRight: 3 }} />
                            <Text style={styles.kindBadgeTextSub}>{t('mixSubscriptionOnly')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.invoiceItemPrice}>
                        ₹{(item.line_total ?? parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  
                  <View style={styles.invoiceDivider} />

                  {/* The lines listed only ever added up to items_total, so an
                      order with a delivery fee showed ₹50 of goods above a ₹80
                      total and looked like broken arithmetic. Name the fee. */}
                  {order.deliveryFee > 0 ? (
                    <>
                      <View style={styles.invoiceItemRow}>
                        <Text style={styles.invoiceItemName}>{t('itemsSubtotal')}</Text>
                        <Text style={styles.invoiceItemPrice}>
                          ₹{Number(order.itemsTotal ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.invoiceItemRow}>
                        <Text style={styles.invoiceItemName}>{t('deliveryFeeLabel')}</Text>
                        <Text style={styles.invoiceItemPrice}>
                          ₹{Number(order.deliveryFee).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.invoiceDivider} />
                    </>
                  ) : null}

                  <View style={styles.invoiceTotalRow}>
                    <Text style={styles.invoiceTotalLabel}>{t('grandTotalLabel')}</Text>
                    <Text style={styles.invoiceTotalVal}>₹{order.total.toFixed(2)}</Text>
                  </View>

                  <View style={styles.paymentInfoBox}>
                    <Text style={styles.paymentMethodText}>
                      Payment Method:{' '}
                      <Text style={{ fontWeight: '800' }}>
                        {/* adaptOrder emits `paymentMethod`; `payment_method`
                            was undefined, so this line rendered blank. Udhar
                            orders travel as cod + khata_requested, which is
                            what makes them read as Udhar rather than COD. */}
                        {order.khataRequested
                          ? 'Udhar / Khata'
                          : order.paymentMethod === 'cod'
                            ? 'Payment on Delivery'
                            : order.paymentMethod === 'upi'
                              ? 'Online Payment (UPI)'
                              : '—'}
                      </Text>
                    </Text>
                  </View>

                  {/* Settlement Breakdown Card
                      Same wrong field names as the list strip: `type` (the
                      adapter emits `mode`) tested against 'full_cod' and
                      'partial_khata', which are not settlement_mode values, so
                      every order fell through to "Prepaid Online"; and
                      `paid_amount` / `khata_amount` both read undefined and
                      printed ₹0.00 over real money. */}
                  {order.settlement && (
                    <View style={styles.modalSettlementCard}>
                      <Text style={styles.modalSettlementTitle}>{t('deliveryPaymentSettlement')}</Text>
                      <View style={styles.modalSettlementRow}>
                        <Text style={styles.modalSettlementLabel}>{t('settlementModeLabel')}</Text>
                        <Text style={styles.modalSettlementValue}>
                          {order.settlement.mode === 'full_khata'
                            ? '100% Khata Udhar'
                            : order.settlement.mode === 'partial'
                            ? 'Partial Cash + Partial Khata'
                            : '100% Cash / UPI'}
                        </Text>
                      </View>
                      <View style={styles.modalSettlementRow}>
                        <Text style={styles.modalSettlementLabel}>{t('orderTotalColon')}</Text>
                        <Text style={styles.modalSettlementValue}>
                          ₹{order.total.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.modalSettlementRow}>
                        <Text style={styles.modalSettlementLabel}>{t('cashUpiPaidColon')}</Text>
                        <Text style={[styles.modalSettlementValue, { color: '#16A34A' }]}>
                          ₹{order.settlement.cash.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.modalSettlementRow}>
                        <Text style={styles.modalSettlementLabel}>{t('addedToKhataColon')}</Text>
                        <Text style={[
                          styles.modalSettlementValue,
                          { color: order.settlement.khata > 0 ? '#B45309' : theme.colors.textLight },
                        ]}>
                          ₹{order.settlement.khata.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
  );
};

const styles = StyleSheet.create({
  invoiceDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  invoiceItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
    flex: 1,
  },
  invoiceItemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  summaryBadges: { flexDirection: 'row', alignItems: 'center' },
  subBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginRight: 8,
  },
  subBadgeIcon: { marginRight: 4 },
  subBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#7C3AED' },
  invoiceThumb: {
    width: 40, height: 40, borderRadius: 9,
    backgroundColor: '#F1F5F9', marginRight: 10,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  kindBadgeBoth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  kindBadgeTextBoth: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  kindBadgeSub: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  kindBadgeTextSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  invoiceTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  invoiceTotalVal: {
    fontSize: 20,
    fontWeight: '850',
    color: theme.colors.primary,
  },
  modalAddress: {
    fontSize: 13,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginTop: 6,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBody: {
    marginTop: 14,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.m,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalCustName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  modalCustPhone: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  modalDetailCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  modalOrderDate: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  modalOrderId: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalSettlementCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalSettlementLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  modalSettlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  modalSettlementTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textDark,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalSettlementValue: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  modalSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  noteBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  noteContent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 2,
    fontStyle: 'italic',
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  paymentInfoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
  },
  paymentMethodText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

export default OrderDetailSheet;
