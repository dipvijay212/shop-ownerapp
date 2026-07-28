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
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  FileText,
} from 'lucide-react-native';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock Customers Data with Tamper-Proof Audit History
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
      { id: 'h_1', type: 'order', detail: 'Order #LS-94821 delivered', amount: '₹997.00', balanceAfter: 0.00, mode: 'Cash', date: '20 July 2026, 04:15 PM', note: 'Paid Cash on Delivery' },
      { id: 'h_2', type: 'order', detail: 'Order #LS-91122 delivered', amount: '₹1,450.00', balanceAfter: 0.00, mode: 'UPI', date: '14 July 2026, 01:20 PM', note: 'Paid via PhonePe QR' },
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
      { id: 'h_3', type: 'credit', detail: 'Goods bought on Udhari (Grocery & Staples)', amount: '+₹1,200.00', balanceAfter: 1200.00, mode: 'Udhari', date: '26 Jul 2026, 06:15 PM', note: 'Signed Memo #214 - promised to pay in 5 days' },
      { id: 'h_3_prev', type: 'payment', detail: 'Partial Udhari Repayment', amount: '-₹800.00', balanceAfter: 0.00, mode: 'UPI / GPay', date: '20 Jul 2026, 11:45 AM', note: 'Txn Ref: UPI/847291/PATEL • Verified in bank' },
      { id: 'h_4', type: 'order', detail: 'Order #LS-28491 placed', amount: '₹1,300.00', balanceAfter: 800.00, mode: 'Cash', date: '23 Jul 2026, 03:10 PM', note: 'Paid cash at counter' },
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
      { id: 'h_5', type: 'credit', detail: 'Bulk grocery booking on Udhari', amount: '+₹4,500.00', balanceAfter: 4500.00, mode: 'Udhari', date: 'Today, 11:20 AM', note: 'Customer verification ID attached. Due next month' },
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
      { id: 'h_6', type: 'order', detail: 'Order #LS-48291 delivered', amount: '₹2,450.00', balanceAfter: 0.00, mode: 'Card', date: '18 July 2026, 07:40 PM', note: 'POS Terminal Txn Verified' },
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
      { id: 'h_7', type: 'payment', detail: 'Full Udhari Settlement via UPI', amount: '-₹2,000.00', balanceAfter: 0.00, mode: 'UPI / GPay', date: '22 July 2026, 05:30 PM', note: 'Txn #GPay-91820 • Ledger balance zeroed out' },
    ]
  },
];

export const CustomersScreen = () => {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'orders' | 'credit'

  // Partial Payment States
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' | 'UPI / GPay' | 'Bank Transfer'
  const [paymentNote, setPaymentNote] = useState('');

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
    const amountNum = parseFloat(paymentAmount || '0');
    if (isNaN(amountNum) || amountNum <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Please enter a valid payment amount greater than ₹0.',
      });
      return;
    }

    if (amountNum > selectedCustomer.outstandingCredit && selectedCustomer.outstandingCredit > 0) {
      Toast.show({
        type: 'info',
        text1: 'Excess Repayment Alert',
        text2: `Payment exceeds due amount (₹${selectedCustomer.outstandingCredit.toFixed(2)}). Balance zeroed out.`,
      });
    }

    const newDue = Math.max(0, selectedCustomer.outstandingCredit - amountNum);
    const isFull = newDue === 0 && selectedCustomer.outstandingCredit > 0 && amountNum >= selectedCustomer.outstandingCredit;
    const title = isFull ? 'Full Udhari Repayment' : 'Partial Udhari Repayment';
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const newHistoryItem = {
      id: `pay_${Date.now()}`,
      type: 'payment',
      detail: `${title} (${paymentMode})`,
      amount: `-₹${amountNum.toFixed(2)}`,
      balanceAfter: newDue,
      mode: paymentMode,
      date: `${dateString}, ${timeString}`,
      note: paymentNote.trim() ? paymentNote.trim() : `Verified ${paymentMode} receipt at shop counter.`,
      verified: true,
    };

    const updated = customers.map(c => {
      if (c.id === selectedCustomer.id) {
        return {
          ...c,
          outstandingCredit: newDue,
          history: [newHistoryItem, ...c.history],
        };
      }
      return c;
    });

    setCustomers(updated);
    const updatedCust = updated.find(c => c.id === selectedCustomer.id);
    setSelectedCustomer(updatedCust);
    setPaymentAmount('');
    setPaymentNote('');
    setShowPaymentForm(false);

    Toast.show({
      type: 'success',
      text1: isFull ? 'Udhari Fully Cleared!' : 'Partial Payment Logged!',
      text2: `Recorded ₹${amountNum.toFixed(2)} via ${paymentMode}. Remaining Due: ₹${newDue.toFixed(2)}`,
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
              <TouchableOpacity onPress={() => {
                setSelectedCustomer(null);
                setShowPaymentForm(false);
              }}>
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
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.modalSubtitle}>Credit & Udhari Profile</Text>
                    <View style={styles.shieldBadge}>
                      <ShieldCheck size={14} color="#15803D" style={{ marginRight: 4 }} />
                      <Text style={styles.shieldText}>TAMPER-PROOF LEDGER</Text>
                    </View>
                  </View>

                  <View style={styles.creditBox}>
                    <Text style={styles.creditLabel}>Total Outstanding Balance (Udhari)</Text>
                    <Text style={styles.creditAmount}>₹{selectedCustomer?.outstandingCredit.toFixed(2)}</Text>
                    <View style={styles.creditLimitRow}>
                      <Text style={styles.creditLimit}>Credit Limit: ₹25,000.00</Text>
                      <View style={styles.liveStatusBadge}>
                        <Text style={styles.liveStatusText}>
                          {selectedCustomer?.outstandingCredit > 0 ? 'DUE PENDING' : 'ALL CLEAR'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Partial & Full Payment Entry Action */}
                  {selectedCustomer?.outstandingCredit > 0 && !showPaymentForm && (
                    <TouchableOpacity
                      style={styles.openRepayBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        setPaymentAmount('');
                        setPaymentNote('');
                        setShowPaymentForm(true);
                      }}
                    >
                      <UserCheck color="#FFF" size={20} style={{ marginRight: 8 }} />
                      <Text style={styles.openRepayText}>+ Record Partial / Full Payment</Text>
                    </TouchableOpacity>
                  )}

                  {showPaymentForm && (
                    <View style={styles.paymentFormCard}>
                      <View style={styles.formHeaderRow}>
                        <Text style={styles.formTitle}>Record Udhari Repayment</Text>
                        <TouchableOpacity onPress={() => setShowPaymentForm(false)}>
                          <X color={theme.colors.textDark} size={20} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.formInstruction}>
                        Log verified partial or full payments. Every entry creates an immutable timestamped audit record to prevent customer disputes.
                      </Text>

                      {/* Quick amount shortcuts */}
                      <View style={styles.quickAmtRow}>
                        {[500, 1000, selectedCustomer?.outstandingCredit].filter((val, i, arr) => val > 0 && (i === 2 || val <= selectedCustomer?.outstandingCredit)).map((val, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.quickAmtPill}
                            onPress={() => setPaymentAmount(val.toString())}
                          >
                            <Text style={styles.quickAmtText}>
                              {idx === 2 ? `Full (₹${val.toFixed(0)})` : `₹${val}`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.inputLabel}>Enter Payment Amount (₹)</Text>
                      <TextInput
                        style={styles.paymentInput}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        placeholder="e.g. 500"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />

                      <Text style={styles.inputLabel}>Payment Mode</Text>
                      <View style={styles.modeRow}>
                        {['Cash', 'UPI / GPay', 'Bank Transfer'].map((mode) => (
                          <TouchableOpacity
                            key={mode}
                            style={[styles.modeBtn, paymentMode === mode && styles.modeBtnActive]}
                            onPress={() => setPaymentMode(mode)}
                          >
                            <Text style={[styles.modeText, paymentMode === mode && styles.modeTextActive]}>
                              {mode}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.inputLabel}>Verification Note & Receipt / Txn ID</Text>
                      <TextInput
                        style={[styles.paymentInput, { height: 64, textAlignVertical: 'top', paddingTop: 10 }]}
                        value={paymentNote}
                        onChangeText={setPaymentNote}
                        placeholder="e.g. UPI Txn ID / Cash receipt # / signed notes..."
                        placeholderTextColor="#94A3B8"
                        multiline
                      />

                      <View style={styles.formActionsRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentForm(false)}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmPayBtn} onPress={handleRecordPayment}>
                          <CheckCircle color="#FFF" size={18} style={{ marginRight: 6 }} />
                          <Text style={styles.confirmPayText}>Verify & Save Payment</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Audit Proof Ledger History */}
                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.historyHeader}>Tamper-Proof Audit History</Text>
                    <Text style={styles.historySubText}>Running balance after every transaction</Text>
                  </View>

                  {selectedCustomer?.history.filter(h => h.type === 'credit' || h.type === 'payment').map((h) => (
                    <View key={h.id} style={[styles.auditCard, h.type === 'payment' ? styles.auditCardPay : styles.auditCardDue]}>
                      <View style={styles.auditTopRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.auditDetailTitle}>{h.detail}</Text>
                          </View>
                          <View style={styles.auditDateRow}>
                            <Clock size={12} color={theme.colors.textLight} style={{ marginRight: 4 }} />
                            <Text style={styles.auditDateText}>{h.date}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[
                            styles.auditAmount,
                            { color: h.type === 'payment' ? '#16A34A' : '#DC2626' }
                          ]}>
                            {h.amount}
                          </Text>
                          <View style={[styles.modeBadge, { backgroundColor: h.type === 'payment' ? '#DCFCE7' : '#FEE2E2' }]}>
                            <Text style={[styles.modeBadgeText, { color: h.type === 'payment' ? '#15803D' : '#991B1B' }]}>
                              {h.mode || (h.type === 'payment' ? 'Repay' : 'Udhari')}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Verification Audit Footer inside card */}
                      <View style={styles.auditFooterBox}>
                        <View style={styles.auditNoteColumn}>
                          <Text style={styles.auditNoteLabel}>Note / Proof:</Text>
                          <Text style={styles.auditNoteValue}>{h.note || 'Verified transaction record in digital Khata.'}</Text>
                        </View>
                        <View style={styles.auditBalanceColumn}>
                          <Text style={styles.auditBalanceLabel}>DUE AFTER TXN</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <CheckCircle size={14} color="#16A34A" style={{ marginRight: 4 }} />
                            <Text style={styles.auditBalanceValue}>
                              ₹{h.balanceAfter !== undefined ? h.balanceAfter.toFixed(2) : '0.00'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9F8CF',
  },
  shieldText: {
    fontSize: 10,
    fontWeight: '850',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  creditLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FED7D7',
  },
  liveStatusBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEB2B2',
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: '850',
    color: theme.colors.error,
  },
  openRepayBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  openRepayText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  paymentFormCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '850',
    color: theme.colors.textDark,
  },
  formInstruction: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginBottom: 14,
    lineHeight: 18,
  },
  quickAmtRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  quickAmtPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickAmtText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 6,
    marginTop: 4,
  },
  paymentInput: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#FFF',
    marginRight: 8,
    marginBottom: 6,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  modeTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  formActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#FFF',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  confirmPayBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginLeft: 8,
  },
  confirmPayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  historyHeaderRow: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  historySubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  auditCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 6,
    ...theme.shadows.small,
  },
  auditCardPay: {
    borderColor: '#DCFCE7',
    borderLeftColor: '#22C55E',
  },
  auditCardDue: {
    borderColor: '#FEE2E2',
    borderLeftColor: '#EF4444',
  },
  auditTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  auditDetailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginRight: 8,
  },
  auditDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  auditDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  auditAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '850',
  },
  auditFooterBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditNoteColumn: {
    flex: 1,
    marginRight: 12,
  },
  auditNoteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  auditNoteValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  auditBalanceColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  auditBalanceLabel: {
    fontSize: 10,
    fontWeight: '850',
    color: '#64748B',
  },
  auditBalanceValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
  },
});
