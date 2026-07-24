import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
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
  TrendingUp,
  CreditCard,
  X,
  ChevronRight,
  BookOpen,
  UserCheck,
  Users,
} from 'lucide-react-native';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock Customers Data
const INITIAL_CUSTOMERS = [
  {
    id: 'cust_1',
    name: 'Aman Sharma',
    phone: '9876543210',
    ordersCount: 24,
    lifetimeSpending: 12450.00,
    outstandingCredit: 0.00,
    avatar: 'AS',
    status: 'active',
    history: [
      { id: 'h_1', type: 'order', detail: 'Order #LS-94821 delivered', amount: '₹997.00', date: '20 July 2026' },
      { id: 'h_2', type: 'order', detail: 'Order #LS-91122 delivered', amount: '₹1,450.00', date: '14 July 2026' },
    ]
  },
  {
    id: 'cust_2',
    name: 'Priya Patel',
    phone: '9123456789',
    ordersCount: 15,
    lifetimeSpending: 8900.00,
    outstandingCredit: 1200.00,
    avatar: 'PP',
    status: 'active',
    history: [
      { id: 'h_3', type: 'credit', detail: 'Goods bought on credit', amount: '+₹1,200.00', date: 'Yesterday' },
      { id: 'h_4', type: 'order', detail: 'Order #LS-28491 placed', amount: '₹1,300.00', date: '23 July 2026' },
    ]
  },
  {
    id: 'cust_3',
    name: 'Rohan Mehta',
    phone: '9825012345',
    ordersCount: 8,
    lifetimeSpending: 4200.00,
    outstandingCredit: 4500.00,
    avatar: 'RM',
    status: 'active',
    history: [
      { id: 'h_5', type: 'credit', detail: 'Bulk grocery booking on credit', amount: '+₹4,500.00', date: 'Today, 11:20 AM' },
    ]
  },
  {
    id: 'cust_4',
    name: 'Sneha Shah',
    phone: '9724388888',
    ordersCount: 31,
    lifetimeSpending: 22800.00,
    outstandingCredit: 0.00,
    avatar: 'SS',
    status: 'active',
    history: [
      { id: 'h_6', type: 'order', detail: 'Order #LS-48291 delivered', amount: '₹2,450.00', date: '18 July 2026' },
    ]
  },
  {
    id: 'cust_5',
    name: 'Amit Kumar',
    phone: '9999911111',
    ordersCount: 19,
    lifetimeSpending: 11400.00,
    outstandingCredit: 0.00,
    avatar: 'AK',
    status: 'inactive',
    history: [
      { id: 'h_7', type: 'payment', detail: 'Cleared ledger amount via UPI', amount: '-₹2,000.00', date: '22 July 2026' },
    ]
  },
];

export const CustomersScreen = () => {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'orders' | 'credit'

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  const handleCall = (num) => {
    Linking.openURL(`tel:${num}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Call handler not supported.',
      });
    });
  };

  const handleWhatsApp = (num, name) => {
    const msg = `Hello ${name}, this is Fresh Mart.`;
    Linking.openURL(`whatsapp://send?phone=${num}&text=${encodeURIComponent(msg)}`).catch(() => {
      Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
    });
  };

  const handleRecordPayment = () => {
    if (!selectedCustomer) return;
    
    // Repay mock credit
    const updated = customers.map(c => {
      if (c.id === selectedCustomer.id) {
        return {
          ...c,
          outstandingCredit: 0.00,
          history: [
            { id: `pay_${Date.now()}`, type: 'payment', detail: 'Cleared outstanding credit', amount: `-₹${c.outstandingCredit.toFixed(2)}`, date: 'Just now' },
            ...c.history
          ]
        };
      }
      return c;
    });

    setCustomers(updated);
    // Find updated customer details
    const updatedCust = updated.find(c => c.id === selectedCustomer.id);
    setSelectedCustomer(updatedCust);

    Toast.show({
      type: 'success',
      text1: 'Credit Cleared',
      text2: `Successfully recorded repayment for ${selectedCustomer.name}.`,
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Search Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>My Customers</Text>
        <View style={styles.searchBar}>
          <Search color={theme.colors.textLight} size={20} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or mobile number..."
            placeholderTextColor={theme.colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Users size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No Customers Found</Text>
            <Text style={styles.emptySub}>No results matched your search query.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.customerCard}>
            {/* Header info */}
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
              </View>
              <View style={styles.details}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>+91 {item.phone}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                item.status === 'active' ? styles.statusActive : styles.statusInactive
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  item.status === 'active' ? styles.statusActiveText : styles.statusInactiveText
                ]}>
                  {item.status === 'active' ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            {/* Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Total Orders</Text>
                <Text style={styles.metricValue}>{item.ordersCount}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Life Spending</Text>
                <Text style={[styles.metricValue, { color: theme.colors.primary }]}>₹{item.lifetimeSpending.toFixed(0)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Outstanding</Text>
                <Text style={[
                  styles.metricValue,
                  { color: item.outstandingCredit > 0 ? theme.colors.error : theme.colors.textDark }
                ]}>
                  ₹{item.outstandingCredit.toFixed(0)}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <View style={styles.communicationRow}>
                <TouchableOpacity style={styles.btnSmall} onPress={() => handleCall(item.phone)}>
                  <Phone size={16} color={theme.colors.textDark} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnSmall, { marginLeft: 8 }]} onPress={() => handleWhatsApp(item.phone, item.name)}>
                  <MessageCircle size={16} color="#22C55E" />
                </TouchableOpacity>
              </View>

              <View style={styles.navActionsRow}>
                <TouchableOpacity
                  style={[styles.btnAction, styles.btnSecondary]}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setModalMode('orders');
                  }}
                >
                  <Text style={styles.btnSecondaryText}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnAction,
                    styles.btnPrimary,
                    item.outstandingCredit === 0 && { opacity: 0.5 }
                  ]}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setModalMode('credit');
                  }}
                >
                  <Text style={styles.btnPrimaryText}>Khata</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      {/* CUSTOMER DETAIL MODAL */}
      <Modal visible={!!selectedCustomer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.avatar, { width: 36, height: 36, borderRadius: 18 }]}>
                  <Text style={[styles.avatarText, { fontSize: 14 }]}>{selectedCustomer?.avatar}</Text>
                </View>
                <Text style={styles.modalTitle}>{selectedCustomer?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {modalMode === 'orders' ? (
                <>
                  <Text style={styles.modalSubtitle}>Order & Activity History</Text>
                  {selectedCustomer?.history?.map((h) => (
                    <View key={h.id} style={styles.historyRow}>
                      <View style={styles.historyDetailColumn}>
                        <Text style={styles.historyDetailText}>{h.detail}</Text>
                        <Text style={styles.historyDateText}>{h.date}</Text>
                      </View>
                      <Text style={[
                        styles.historyAmountText,
                        { color: h.type === 'paid' || h.type === 'payment' ? theme.colors.success : theme.colors.textDark }
                      ]}>
                        {h.amount}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.modalSubtitle}>Credit & Ledger Profile</Text>
                  <View style={styles.creditBox}>
                    <Text style={styles.creditLabel}>Total Outstanding Balance</Text>
                    <Text style={styles.creditAmount}>₹{selectedCustomer?.outstandingCredit.toFixed(2)}</Text>
                    <Text style={styles.creditLimit}>Credit Limit: ₹25,000.00</Text>
                  </View>

                  <Text style={styles.historyHeader}>Recent Ledger Transactions</Text>
                  {selectedCustomer?.history.filter(h => h.type === 'credit' || h.type === 'payment').map((h) => (
                    <View key={h.id} style={styles.historyRow}>
                      <View style={styles.historyDetailColumn}>
                        <Text style={styles.historyDetailText}>{h.detail}</Text>
                        <Text style={styles.historyDateText}>{h.date}</Text>
                      </View>
                      <Text style={[
                        styles.historyAmountText,
                        { color: h.type === 'payment' ? theme.colors.success : theme.colors.error }
                      ]}>
                        {h.amount}
                      </Text>
                    </View>
                  ))}

                  {selectedCustomer?.outstandingCredit > 0 && (
                    <TouchableOpacity style={styles.repayBtn} onPress={handleRecordPayment}>
                      <UserCheck color="#FFF" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.repayBtnText}>Record Cash/UPI Payment (Repay)</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
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
  searchBar: {
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
  listContent: {
    padding: theme.spacing.m,
    paddingBottom: 30,
  },
  customerCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  details: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  phone: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusActiveText: {
    color: '#15803D',
  },
  statusInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusInactiveText: {
    color: '#64748B',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  communicationRow: {
    flexDirection: 'row',
  },
  btnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActionsRow: {
    flexDirection: 'row',
  },
  btnAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  btnSecondaryText: {
    color: theme.colors.textDark,
    fontSize: 13,
    fontWeight: '800',
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
    marginTop: 4,
  },
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
    maxHeight: '80%',
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
    marginLeft: 10,
  },
  modalBody: {
    marginTop: 14,
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 12,
  },
  historyDetailColumn: {
    flex: 1,
    marginRight: 10,
  },
  historyDetailText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  historyDateText: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  historyAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  creditBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FED7D7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  creditLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  creditAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.error,
    marginTop: 4,
  },
  creditLimit: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
    marginTop: 8,
  },
  historyHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 8,
  },
  repayBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  repayBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
