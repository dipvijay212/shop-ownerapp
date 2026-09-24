import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  X,
  CheckCircle2,
  BookOpen,
  Banknote,
  AlertCircle,
  User,
  ShieldCheck,
  ArrowRight,
  Wallet,
} from 'lucide-react-native';
import { theme } from '../theme';
import KeyboardAwareForm from './KeyboardAwareForm';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../constants/translations';

export const PaymentSettlementModal = ({ visible, order, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [settlementType, setSettlementType] = useState('full_cod'); // 'full_cod' | 'khata' | 'prepaid'
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [customerAdvanceBalance, setCustomerAdvanceBalance] = useState(0);
  const [useAdvanceBalance, setUseAdvanceBalance] = useState(true);
  // onConfirm is a network call. Until it settles, the sheet stays open and
  // both buttons are live — a second tap sent a second /deliver.
  const [submitting, setSubmitting] = useState(false);

  const orderTotal = order?.total || 0;

  useEffect(() => {
    if (visible && order) {
      if (order.payment_status === 'completed' && order.payment_method !== 'cod') {
        setSettlementType('prepaid');
        setCashAmountInput(orderTotal.toFixed(2));
      } else if (order.khataRequested) {
        // The customer placed this ON UDHARI, so that is what the sheet opens
        // on — an empty cash box, the whole amount on the khata. Defaulting to
        // full_cod here meant one tap of Confirm recorded an udhari order as
        // paid in cash, which is how subscription deliveries kept showing up
        // as "paid" on a khata that never moved. Cash can still be typed in if
        // the customer does hand something over.
        setSettlementType('khata');
        setCashAmountInput('');
      } else {
        setSettlementType('full_cod');
        setCashAmountInput(orderTotal.toFixed(2));
      }
      setErrorMsg('');

      // Advance balance is not part of the khata API — the ledger only tracks
      // credit the shop extends and repayments against it — so there is nothing
      // to apply here. Settlement is cash / khata / split, as /deliver models it.
      setCustomerAdvanceBalance(0);
      setUseAdvanceBalance(false);
      setSubmitting(false);
    }
  }, [visible, order, orderTotal]);

  if (!order) return null;

  // Advance balance calculations
  const isAdvanceToggled = useAdvanceBalance && customerAdvanceBalance > 0;
  const advanceCutAmount = isAdvanceToggled ? Math.min(customerAdvanceBalance, orderTotal) : 0;
  const remainingToSettle = Math.max(0, orderTotal - advanceCutAmount);
  const remainingAdvanceAfterCut = isAdvanceToggled ? Math.max(0, customerAdvanceBalance - advanceCutAmount) : customerAdvanceBalance;

  const parsedCash = parseFloat(cashAmountInput) || 0;
  const calculatedKhata = Math.max(0, remainingToSettle - parsedCash);
  // Paying over the total is normal at a counter — the change is kept as an
  // advance rather than handed back, and it comes off the next udhari.
  const advanceFromChange = Math.max(0, parsedCash - remainingToSettle);

  const handleTypeChange = (type) => {
    setSettlementType(type);
    setErrorMsg('');
    if (type === 'full_cod' || type === 'prepaid') {
      setCashAmountInput(remainingToSettle.toFixed(2));
    } else if (type === 'khata') {
      setCashAmountInput('');
    }
  };

  const handleCashInputChange = (val) => {
    setCashAmountInput(val);
    if (val.trim() === '') {
      setErrorMsg('');
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setErrorMsg('Please enter a valid numeric amount.');
    } else if (num < 0) {
      setErrorMsg('Amount cannot be negative.');
    } else {
      setErrorMsg('');
    }
  };

  const handleSubmit = async () => {
    let cashPaid = 0;
    let khataAdded = 0;

    if (remainingToSettle === 0) {
      cashPaid = 0;
      khataAdded = 0;
    } else if (settlementType === 'prepaid' || settlementType === 'full_cod') {
      cashPaid = remainingToSettle;
      khataAdded = 0;
    } else if (settlementType === 'khata') {
      // Empty means nothing was handed over — the whole amount goes on the
      // khata. Anything typed is what was paid, and the rest follows.
      const raw = cashAmountInput.trim();
      const num = raw === '' ? 0 : parseFloat(raw);
      if (isNaN(num) || num < 0) {
        Toast.show({
          type: 'error',
          text1: t('invalidAmountTitle'),
          text2: t('invalidAmountSub'),
        });
        return;
      }
      cashPaid = num;
      khataAdded = Math.max(0, remainingToSettle - num);
    }

    const finalPaid = advanceCutAmount + cashPaid;
    const finalKhata = khataAdded;

    const settlementData = {
      type: settlementType,
      paid_amount: finalPaid,
      khata_amount: finalKhata,
      balance_cut_amount: advanceCutAmount,
      // Change the customer left behind. The screen needs this to keep the
      // settlement in `partial` mode, which is the only one that carries a
      // cash_amount to the server — otherwise the overpayment is dropped.
      extra_deposited: advanceFromChange,
      settled_at: new Date().toISOString(),
    };

    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(order.id, settlementData);
    } finally {
      // The parent closes the sheet on success; on failure it stays open with
      // the amounts intact so the shop can correct and try again.
      setSubmitting(false);
    }
  };

  const isPrepaid = order.payment_status === 'completed' && order.payment_method !== 'cod';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        // Android resizes the window itself (adjustResize); doing it here too
        // makes the sheet oscillate while the input has focus.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'android' ? 36 : 28) }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{t('confirmDeliveryPayment')}</Text>
              <Text style={styles.modalSub}>
                Order #{order.orderNumber || order.id} • Total ₹{orderTotal.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={theme.colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* A Modal is its own window, so the manifest's adjustResize never
              applied here and the amount field sat under the keyboard. */}
          <KeyboardAwareForm
            style={styles.scrollBody}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            {/* Customer Brief */}
            <View style={styles.customerBox}>
              <View style={styles.custAvatar}>
                <User size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.custName}>{order.customer_name}</Text>
                <Text style={styles.custPhone}>
                  {order.customer_phone?.startsWith('+') || order.customer_phone?.startsWith('91')
                    ? order.customer_phone
                    : `+91 ${order.customer_phone}`}
                </Text>
              </View>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeLabel}>{t('orderTotalLabel')}</Text>
                <Text style={styles.totalBadgeVal}>₹{orderTotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* Advance Balance Toggle Card */}
            {customerAdvanceBalance > 0 && (
              <View style={[
                styles.advanceToggleCard,
                isAdvanceToggled && { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }
              ]}>
                <TouchableOpacity
                  style={styles.advanceToggleHeader}
                  activeOpacity={0.8}
                  onPress={() => {
                    const next = !useAdvanceBalance;
                    setUseAdvanceBalance(next);
                    if (next) {
                      const newRem = Math.max(0, orderTotal - Math.min(customerAdvanceBalance, orderTotal));
                      setCashAmountInput(newRem.toFixed(2));
                    } else {
                      setCashAmountInput(orderTotal.toFixed(2));
                    }
                  }}
                >
                  <View style={styles.walletIconBox}>
                    <Wallet size={20} color={isAdvanceToggled ? '#15803D' : theme.colors.textLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.advanceToggleTitle, isAdvanceToggled && { color: '#166534' }]}>
                      {t('useAdvanceBalance')}
                    </Text>
                    <Text style={[styles.advanceToggleSub, isAdvanceToggled && { color: '#15803D' }]}>
                      Available: ₹{customerAdvanceBalance.toFixed(2)} • Will cut ₹{Math.min(customerAdvanceBalance, orderTotal).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.checkboxBox, isAdvanceToggled && styles.checkboxBoxActive]}>
                    {isAdvanceToggled && <CheckCircle2 size={18} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>

                {isAdvanceToggled && (
                  <View style={styles.advanceCalcBox}>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>{t('advanceBalanceAvailable')}</Text>
                      <Text style={[styles.calcValue, { color: '#166534' }]}>₹{customerAdvanceBalance.toFixed(2)}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>{t('amountCutForOrder')}</Text>
                      <Text style={[styles.calcValue, { color: '#15803D', fontWeight: '800' }]}>-₹{advanceCutAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>{t('remainingCustomerBalance')}</Text>
                      <Text style={[styles.calcValue, { color: '#166534' }]}>₹{remainingAdvanceAfterCut.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.calcRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#BBF7D0' }]}>
                      <Text style={styles.calcLabelBold}>{t('remainingOrderToSettle')}</Text>
                      <Text style={[styles.calcValueBold, { color: remainingToSettle > 0 ? '#D97706' : '#16A34A' }]}>
                        ₹{remainingToSettle.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {!(isAdvanceToggled && remainingToSettle === 0) && (
              <Text style={styles.sectionTitle}>
                {isAdvanceToggled && remainingToSettle > 0
                  ? `Select Settlement Mode for Remaining ₹${remainingToSettle.toFixed(2)}`
                  : 'Select Payment Settlement Mode'}
              </Text>
            )}

            {isPrepaid ? (
              <View style={[styles.optionCard, styles.optionCardActive]}>
                <View style={styles.optionHeader}>
                  <CheckCircle2 size={22} color="#16A34A" />
                  <View style={styles.optionTextGroup}>
                    <Text style={styles.optionTitle}>{t('prepaidOnline')}</Text>
                    <Text style={styles.optionSub}>Full payment ₹{orderTotal.toFixed(2)} received online upfront.</Text>
                  </View>
                </View>
              </View>
            ) : isAdvanceToggled && remainingToSettle === 0 ? null : (
              <>
                {/* Option 1: Full COD Cash/UPI for remaining amount */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.optionCard, settlementType === 'full_cod' && styles.optionCardActive]}
                  onPress={() => handleTypeChange('full_cod')}
                >
                  <View style={styles.optionHeader}>
                    <View style={[styles.radioCircle, settlementType === 'full_cod' && styles.radioCircleActive]}>
                      {settlementType === 'full_cod' && <View style={styles.radioDot} />}
                    </View>
                    <Banknote size={20} color={settlementType === 'full_cod' ? '#16A34A' : theme.colors.textLight} />
                    <View style={styles.optionTextGroup}>
                      <Text style={styles.optionTitle}>
                        {isAdvanceToggled && remainingToSettle > 0
                          ? `Full Payment in Cash / UPI (₹${remainingToSettle.toFixed(2)})`
                          : 'Full Payment (COD / Cash / UPI)'}
                      </Text>
                      <Text style={styles.optionSub}>
                        {isAdvanceToggled && remainingToSettle > 0
                          ? `Customer pays remaining ₹${remainingToSettle.toFixed(2)} on delivery.`
                          : `Customer paid full ₹${orderTotal.toFixed(2)} on delivery.`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Khata — full or part, decided by the amount rather than by
                    picking between two cards that only differed by a number.
                    Leave the field empty (or 0) and the whole thing goes on
                    the khata; type what was handed over and the rest does. */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.optionCard, settlementType === 'khata' && styles.optionCardActive]}
                  onPress={() => handleTypeChange('khata')}
                >
                  <View style={styles.optionHeader}>
                    <View style={[styles.radioCircle, settlementType === 'khata' && styles.radioCircleActive]}>
                      {settlementType === 'khata' && <View style={styles.radioDot} />}
                    </View>
                    <BookOpen size={20} color={settlementType === 'khata' ? '#7C3AED' : theme.colors.textLight} />
                    <View style={styles.optionTextGroup}>
                      <Text style={styles.optionTitle}>{t('khataShort')}</Text>
                      <Text style={styles.optionSub}>
                        {advanceFromChange > 0
                          ? `₹${remainingToSettle.toFixed(2)} settled, ₹${advanceFromChange.toFixed(2)} kept as advance.`
                          : parsedCash > 0
                            ? `₹${parsedCash.toFixed(2)} paid now, ₹${calculatedKhata.toFixed(2)} on khata.`
                            : `Full ₹${remainingToSettle.toFixed(2)} on khata. Enter an amount if some was paid.`}
                      </Text>
                    </View>
                  </View>

                  {settlementType === 'khata' && (
                    <View style={styles.partialInputBox}>
                      <Text style={styles.inputLabel}>{t('cashOnlineReceivedAmount')}</Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.currencyPrefix}>₹</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="decimal-pad"
                          value={cashAmountInput}
                          onChangeText={handleCashInputChange}
                          placeholder={t('enterPaidAmount')}
                          placeholderTextColor={theme.colors.textLight}
                        />
                      </View>

                      {errorMsg ? (
                        <View style={styles.errorRow}>
                          <AlertCircle size={14} color="#DC2626" />
                          <Text style={styles.errorText}>{errorMsg}</Text>
                        </View>
                      ) : null}

                      {/* Partial calculation live preview */}
                      <View style={styles.calcPreviewBox}>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>{t('cashUpiPaidColon')}</Text>
                          <Text style={[styles.calcValue, { color: '#16A34A' }]}>₹{parsedCash.toFixed(2)}</Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>
                            {advanceFromChange > 0 ? 'Kept as advance:' : 'Remaining to Customer Khata:'}
                          </Text>
                          <Text style={[styles.calcValue, { color: '#D97706', fontWeight: '800' }]}>
                            ₹{(advanceFromChange > 0 ? advanceFromChange : calculatedKhata).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

              </>
            )}

            {/* Summary Breakdown Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{t('settlementSummary')}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('orderTotalColon')}</Text>
                <Text style={styles.summaryValue}>₹{orderTotal.toFixed(2)}</Text>
              </View>
              {advanceCutAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('cutFromAdvance')}</Text>
                  <Text style={[styles.summaryValue, { color: '#15803D', fontWeight: '800' }]}>
                    -₹{advanceCutAmount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('amountCollected')}</Text>
                <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
                  ₹{(
                    settlementType === 'prepaid' ? orderTotal :
                    isAdvanceToggled && remainingToSettle === 0 ? 0 :
                    settlementType === 'full_cod' ? remainingToSettle : parsedCash
                  ).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('amountAddedToKhata')}</Text>
                <Text style={[
                  styles.summaryValue,
                  { color: settlementType === 'khata' && calculatedKhata > 0 ? '#7C3AED' : theme.colors.textLight }
                ]}>
                  ₹{(
                    isAdvanceToggled && remainingToSettle === 0 ? 0 :
                    settlementType === 'khata' ? calculatedKhata : 0
                  ).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={{ height: 16 }} />
          </KeyboardAwareForm>

          {/* Footer Action Buttons */}
          <View style={[
            styles.footerRow,
            { paddingBottom: Math.max(insets.bottom + 12, Platform.OS === 'ios' ? 24 : 16) }
          ]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.confirmBtnBusy]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <ShieldCheck size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>{t('confirmMarkDelivered')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    ...theme.shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 18,
  },
  custAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  custPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  totalBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  totalBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
  },
  totalBadgeVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A',
  },
  advanceToggleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 16,
  },
  advanceToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  advanceToggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  advanceToggleSub: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxBoxActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  advanceCalcBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  calcLabelBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  calcValueBold: {
    fontSize: 14,
    fontWeight: '900',
  },
  fullyCoveredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  fullyCoveredTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  fullyCoveredSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  optionCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  optionTextGroup: {
    flex: 1,
    marginLeft: 10,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  optionSub: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  partialInputBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textDark,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingHorizontal: 12,
    height: 46,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
    height: '100%',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 4,
  },
  calcPreviewBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 6,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },

  // Extra Deposit Styles
  extraDepositCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  extraDepositToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  extraDepositTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  extraDepositSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
    marginTop: 1,
  },
  extraDepositInputBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#86EFAC',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  confirmBtnBusy: { opacity: 0.75 },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    ...theme.shadows.soft,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
