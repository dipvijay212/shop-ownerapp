import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import {
  Search,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  MapPin,
  ChevronRight,
  Filter,
  ArrowUpDown,
  X,
  User,
  ShoppingBag,
} from 'lucide-react-native';
import { getMockOrders, updateMockOrderStatus, markMockPaymentReceived } from '../mockOwnerData';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORDER_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'New Request', value: 'placed' },
  { label: 'Preparing', value: 'accepted' }, // accepted maps to preparing in UI
  { label: 'Ready', value: 'ready' },
  { label: 'Out for Delivery', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'rejected' },
  { label: 'UPI / Paid', value: 'upi' },
  { label: 'Cash / COD', value: 'cod' },
];

export const OrdersScreen = () => {
  const insets = useSafeAreaInsets();
  const { checkNewOrders } = useContext(AuthContext);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMockOrders('all');
      setOrders(data);
    } catch (e) {
      console.error('[OrdersScreen] Error fetching orders:', e);
      Toast.show({
        type: 'error',
        text1: 'Fetch Error',
        text2: 'Could not load orders.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateMockOrderStatus(orderId, newStatus);
      Toast.show({
        type: 'success',
        text1: 'Order Updated',
        text2: `Order status is now: ${newStatus}`,
      });
      fetchOrders();
      if (checkNewOrders) checkNewOrders();
      
      // Sync modal view details
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update order status.',
      });
    }
  };

  const handleMarkPaymentReceived = async (orderId) => {
    try {
      await markMockPaymentReceived(orderId);
      Toast.show({
        type: 'success',
        text1: 'Payment Success',
        text2: 'Order payment marked as Completed.',
      });
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, payment_status: 'completed' }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCall = (num) => {
    Linking.openURL(`tel:${num}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Calling not supported.',
      });
    });
  };

  const handleWhatsApp = (num, name) => {
    const msg = `Hello ${name}, this is Fresh Mart.`;
    Linking.openURL(`whatsapp://send?phone=${num}&text=${encodeURIComponent(msg)}`).catch(() => {
      Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
    });
  };

  // Filter & Search Logic
  const processedOrders = useMemo(() => {
    let result = [...orders];

    // Filter Chip logic
    if (activeFilter !== 'all') {
      if (activeFilter === 'upi' || activeFilter === 'cod') {
        result = result.filter(o => o.payment_method?.toLowerCase() === activeFilter);
      } else if (activeFilter === 'accepted') {
        result = result.filter(o => o.status === 'accepted' || o.status === 'preparing');
      } else {
        result = result.filter(o => o.status === activeFilter);
      }
    }

    // Search bar logic
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderNumber?.toLowerCase().includes(q) || 
        o.customer_name?.toLowerCase().includes(q) ||
        o.id.toString().includes(q)
      );
    }

    // Sort order logic
    result.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortAscending ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [orders, activeFilter, searchQuery, sortAscending]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'placed':
        return { bg: '#FEF3C7', text: '#D97706', label: 'New Request' };
      case 'accepted':
      case 'preparing':
        return { bg: '#DBEAFE', text: '#2563EB', label: 'Preparing' };
      case 'ready':
        return { bg: '#E0F2FE', text: '#0369A1', label: 'Ready' };
      case 'out_for_delivery':
        return { bg: '#F5F3FF', text: '#7C3AED', label: 'Out for Delivery' };
      case 'delivered':
        return { bg: '#D1FAE5', text: '#065F46', label: 'Delivered' };
      default:
        return { bg: '#F1F5F9', text: '#64748B', label: status };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Filter and Search section */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Order Manager</Text>
        <View style={styles.actionRow}>
          <View style={styles.searchBar}>
            <Search color={theme.colors.textLight} size={20} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by Order ID or Name..."
              placeholderTextColor={theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity 
            style={[styles.sortBtn, sortAscending && styles.sortBtnActive]} 
            onPress={() => setSortAscending(!sortAscending)}
          >
            <ArrowUpDown color={sortAscending ? '#FFF' : theme.colors.textDark} size={18} />
          </TouchableOpacity>
        </View>

        {/* Horizontal filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={{ paddingRight: 16 }}>
          {ORDER_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, activeFilter === f.value && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.value)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.value && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loaderText}>Fetching active orders...</Text>
        </View>
      ) : (
        <FlatList
          data={processedOrders}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptySub}>No orders matched your active filter rules.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusConfig = getStatusStyle(item.status);
            return (
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>#{item.orderNumber || item.id}</Text>
                    <Text style={styles.orderTime}>
                      {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.customerRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.customer_name ? item.customer_name.charAt(0) : 'C'}
                    </Text>
                  </View>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{item.customer_name}</Text>
                    <Text style={styles.customerPhone}>+91 {item.customer_phone}</Text>
                  </View>
                  <View style={styles.comms}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleCall(item.customer_phone)}>
                      <Phone size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={() => handleWhatsApp(item.customer_phone, item.customer_name)}>
                      <MessageCircle size={16} color="#22C55E" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Address Summary */}
                <View style={styles.addressBox}>
                  <MapPin size={14} color={theme.colors.textLight} style={{ marginRight: 6, marginTop: 2 }} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.delivery_address}
                  </Text>
                </View>

                {/* Items Summarized */}
                <Text style={styles.itemSummary} numberOfLines={1}>
                  {item.items?.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                </Text>

                <View style={styles.divider} />

                {/* Footer details & primary action trigger */}
                <View style={styles.footerRow}>
                  <View>
                    <Text style={styles.priceLabel}>Order Total ({item.items?.length} items)</Text>
                    <Text style={styles.priceValue}>₹{item.total.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity 
                    style={styles.detailsBtn} 
                    onPress={() => {
                      setSelectedOrder(item);
                    }}
                  >
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>

                  {item.status === 'placed' && (
                    <>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.declineBtn]}
                        onPress={() => handleUpdateOrderStatus(item.id, 'rejected')}
                      >
                        <Text style={styles.declineText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.acceptBtn]}
                        onPress={() => handleUpdateStatus(item.id, 'accepted')}
                      >
                        <Text style={styles.acceptText}>Accept</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {(item.status === 'accepted' || item.status === 'preparing') && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.readyBtn, { flex: 2 }]}
                      onPress={() => handleUpdateStatus(item.id, 'ready')}
                    >
                      <Text style={styles.readyText}>Mark Ready</Text>
                    </TouchableOpacity>
                  )}

                  {item.status === 'ready' && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.deliverBtn, { flex: 2 }]}
                      onPress={() => handleUpdateStatus(item.id, 'out_for_delivery')}
                    >
                      <Text style={styles.deliverText}>Ship Out</Text>
                    </TouchableOpacity>
                  )}

                  {item.status === 'out_for_delivery' && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.completeBtn, { flex: 2 }]}
                      onPress={() => handleUpdateStatus(item.id, 'delivered')}
                    >
                      <Text style={styles.completeText}>Complete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* DETAIL MODAL */}
      <Modal visible={!!selectedOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <X size={24} color={theme.colors.textDark} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalSummaryBox}>
                  <View>
                    <Text style={styles.modalOrderId}>Order #{selectedOrder.orderNumber || selectedOrder.id}</Text>
                    <Text style={styles.modalOrderDate}>
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(selectedOrder.status).bg }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusStyle(selectedOrder.status).text }]}>
                      {getStatusStyle(selectedOrder.status).label}
                    </Text>
                  </View>
                </View>

                {/* Customer Section */}
                <Text style={styles.modalSectionTitle}>Customer & Address</Text>
                <View style={styles.modalDetailCard}>
                  <Text style={styles.modalCustName}>{selectedOrder.customer_name}</Text>
                  <Text style={styles.modalCustPhone}>Mobile: +91 {selectedOrder.customer_phone}</Text>
                  <Text style={styles.modalAddress}>{selectedOrder.delivery_address}</Text>
                  {selectedOrder.customer_note && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteTitle}>Customer Instruction Note:</Text>
                      <Text style={styles.noteContent}>"{selectedOrder.customer_note}"</Text>
                    </View>
                  )}
                </View>

                {/* Items Section */}
                <Text style={styles.modalSectionTitle}>Itemized Invoice</Text>
                <View style={styles.modalDetailCard}>
                  {selectedOrder.items?.map((item, index) => (
                    <View key={index} style={styles.invoiceItemRow}>
                      <Text style={styles.invoiceItemName}>
                        {item.name} <Text style={{ color: theme.colors.textLight }}>x{item.quantity}</Text>
                      </Text>
                      <Text style={styles.invoiceItemPrice}>₹{(parseFloat(item.price) * item.quantity).toFixed(2)}</Text>
                    </View>
                  ))}
                  
                  <View style={styles.invoiceDivider} />

                  <View style={styles.invoiceTotalRow}>
                    <Text style={styles.invoiceTotalLabel}>Grand Total</Text>
                    <Text style={styles.invoiceTotalVal}>₹{selectedOrder.total.toFixed(2)}</Text>
                  </View>

                  <View style={styles.paymentInfoBox}>
                    <Text style={styles.paymentMethodText}>
                      Payment Method: <Text style={{ textTransform: 'uppercase', fontWeight: '800' }}>{selectedOrder.payment_method}</Text>
                    </Text>
                    <View style={[
                      styles.paymentStatusBadge,
                      selectedOrder.payment_status === 'completed' ? styles.paymentStatusPaid : styles.paymentStatusUnpaid
                    ]}>
                      <Text style={[
                        styles.paymentStatusBadgeText,
                        selectedOrder.payment_status === 'completed' ? styles.paymentStatusPaidText : styles.paymentStatusUnpaidText
                      ]}>
                        {selectedOrder.payment_status === 'completed' ? 'Paid' : 'Payment Pending'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Ledger & actions */}
                {selectedOrder.payment_status !== 'completed' && selectedOrder.status === 'delivered' && (
                  <TouchableOpacity 
                    style={styles.repayBtn} 
                    onPress={() => handleMarkPaymentReceived(selectedOrder.id)}
                  >
                    <CheckCircle color="#FFF" size={18} style={{ marginRight: 8 }} />
                    <Text style={styles.repayBtnText}>Mark Payment Received (Cash/UPI)</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.m,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    height: '100%',
  },
  sortBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sortBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filtersScroll: {
    marginHorizontal: -4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  listContent: {
    padding: theme.spacing.m,
    paddingBottom: 40,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    ...theme.shadows.soft,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  orderTime: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
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
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  customerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  customerPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  comms: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  addressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    flex: 1,
  },
  itemSummary: {
    fontSize: 14,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '800',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  detailsBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  actionBtn: {
    flex: 1.2,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    flex: 1.2,
    backgroundColor: '#FEE2E2',
    marginRight: 8,
  },
  declineText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 1.2,
    backgroundColor: theme.colors.primary,
  },
  acceptText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  readyBtn: {
    backgroundColor: '#D1FAE5',
  },
  readyText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
  },
  deliverBtn: {
    backgroundColor: '#F5F3FF',
  },
  deliverText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '800',
  },
  completeBtn: {
    backgroundColor: '#E0F2FE',
  },
  completeText: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modal Style
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.m,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  modalBody: {
    marginTop: 14,
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
  modalOrderId: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  modalOrderDate: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalDetailCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
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
  modalAddress: {
    fontSize: 13,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginTop: 6,
  },
  noteBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  noteContent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 2,
    fontStyle: 'italic',
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  invoiceDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  invoiceTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  invoiceTotalVal: {
    fontSize: 20,
    fontWeight: '850',
    color: theme.colors.primary,
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
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  paymentStatusPaid: {
    backgroundColor: '#D1FAE5',
  },
  paymentStatusPaidText: {
    color: '#065F46',
  },
  paymentStatusUnpaid: {
    backgroundColor: '#FEE2E2',
  },
  paymentStatusUnpaidText: {
    color: '#B91C1C',
  },
  repayBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  repayBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
