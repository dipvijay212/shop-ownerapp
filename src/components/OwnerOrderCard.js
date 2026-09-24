import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Phone, MessageCircle, MapPin, FileText, Clock } from 'lucide-react-native';
import { theme } from '../theme';
import { formatWindow } from '../utils/time';
import { CollapsibleOrderItems } from './CollapsibleOrderItems';
import { useTranslation } from '../constants/translations';

/**
 * One order, as the owner sees it.
 *
 * Lifted out of OrdersScreen so the subscription round renders the SAME card:
 * a standing delivery is an ordinary order and reading it should feel that way.
 * Only the row of buttons differs between the two screens, so that is a prop —
 * everything above it is identical by construction rather than by discipline.
 */
const OwnerOrderCard = ({
  order,
  statusConfig,
  placedLabel,
  addressLine,
  onCall,
  onWhatsApp,
  actions,
  // Optional: makes the whole card open the order. The call and WhatsApp
  // buttons stop propagation of their own accord, being separate touchables.
  onPress,
  loading,
}) => {
  const { t } = useTranslation();
  const phone = order.customer_phone;
  const itemCount = order.items?.length || order.itemsCount || 0;
  const prettyPhone =
    phone?.startsWith('+') || phone?.startsWith('91') ? phone : `+91 ${phone ?? ''}`;

  const Card = onPress ? TouchableOpacity : View;

  return (
    <Card
      style={[styles.orderCard, loading && styles.orderCardBusy]}
      {...(onPress ? { onPress, activeOpacity: 0.85, disabled: loading } : {})}
    >
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>#{order.orderNumber || order.id}</Text>
          {placedLabel ? <Text style={styles.orderTime}>{placedLabel}</Text> : null}
          {/* A standing delivery says WHEN it goes out; a one-off has no window. */}
          {order.deliveryWindow ? (
            <View style={styles.windowRow}>
              <Clock size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.windowText}>
                {formatWindow(order.deliveryWindow.startsAt, order.deliveryWindow.endsAt)}
              </Text>
            </View>
          ) : null}
        </View>
        {statusConfig ? (
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
              {/* `labelKey` for maps built at module level (they cannot call a
                  hook); `label` for callers that already resolved it with t. */}
              {statusConfig.labelKey ? t(statusConfig.labelKey) : statusConfig.label}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.customerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {order.customer_name ? order.customer_name.charAt(0) : 'C'}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{order.customer_name}</Text>
          <Text style={styles.customerPhone}>{prettyPhone}</Text>
        </View>
        <View style={styles.comms}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => onCall?.(phone)}>
            <Phone size={16} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: 8 }]}
            onPress={() => onWhatsApp?.(phone, order.customer_name)}
          >
            <MessageCircle size={16} color="#22C55E" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hidden rather than shown empty when the order carries no snapshot. */}
      {addressLine ? (
        <View style={styles.addressBox}>
          <MapPin size={14} color={theme.colors.textLight} style={{ marginRight: 6, marginTop: 2 }} />
          <Text style={styles.addressText} numberOfLines={2}>{addressLine}</Text>
        </View>
      ) : null}

      {order.customerNote ? (
        <View style={styles.readOnlyNoteStrip}>
          <FileText size={14} color="#D97706" style={{ marginRight: 6, marginTop: 1 }} />
          <Text style={styles.readOnlyNoteText} numberOfLines={2}>
            <Text style={{ fontWeight: '800', color: '#B45309' }}>{t('noteLabel')} </Text>
            {order.customerNote.replace(/^Customer Note:\s*/i, '')}
          </Text>
        </View>
      ) : null}

      <CollapsibleOrderItems items={order.items} />

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <View>
          {/* The list endpoint carries `items_count` but no items array, so a
              card fed from it counted an empty array and said "0 items". Use
              whichever the caller actually has. */}
          <Text style={styles.priceLabel}>
            Order Total ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </Text>
          <Text style={styles.priceValue}>₹{Number(order.total ?? 0).toFixed(2)}</Text>
        </View>
        {order.khataRequested ? (
          <View style={styles.khataTag}>
            <Text style={styles.khataTagText}>{t('khataShort')}</Text>
          </View>
        ) : null}
      </View>

      {order.notDeliveredReason ? (
        <Text style={styles.reasonText}>{order.notDeliveredReason}</Text>
      ) : null}

      {actions ? <View style={styles.actionsRow}>{actions}</View> : null}

      {loading ? (
        <View style={styles.cardBusyOverlay}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  orderCardBusy: { opacity: 0.6 },
  cardBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 15, fontWeight: '800', color: theme.colors.textDark },
  orderTime: { fontSize: 11.5, color: theme.colors.textLight, marginTop: 2, fontWeight: '600' },
  windowRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  windowText: { fontSize: 11.5, fontWeight: '700', color: theme.colors.primary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginLeft: 10 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '800' },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#DCFCE7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  customerInfo: { flex: 1, marginLeft: 10 },
  customerName: { fontSize: 14, fontWeight: '800', color: theme.colors.textDark },
  customerPhone: { fontSize: 12, color: theme.colors.textLight, fontWeight: '600', marginTop: 1 },
  comms: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  addressBox: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F8FAFC',
    borderRadius: 10, padding: 10, marginTop: 12,
  },
  addressText: { flex: 1, fontSize: 12, color: theme.colors.textLight, lineHeight: 17, fontWeight: '500' },
  readOnlyNoteStrip: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFBEB',
    borderRadius: 10, padding: 10, marginTop: 10,
  },
  readOnlyNoteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17, fontWeight: '500' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontSize: 11.5, color: theme.colors.textLight, fontWeight: '600' },
  priceValue: { fontSize: 18, fontWeight: '800', color: theme.colors.textDark, marginTop: 1 },
  khataTag: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
  },
  khataTagText: { fontSize: 10.5, fontWeight: '800', color: '#1D4ED8' },
  reasonText: { fontSize: 11.5, fontWeight: '600', color: theme.colors.textLight, marginTop: 8 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
});

export default OwnerOrderCard;
