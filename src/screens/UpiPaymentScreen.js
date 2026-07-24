import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';

export const UpiPaymentScreen = ({ route, navigation }) => {
  const { orderId, orderNumber, total } = route.params;
  const [utr, setUtr] = useState('');
  const queryClient = useQueryClient();

  const upiId = 'localshops@upi'; // Mock UPI ID

  const verifyPaymentMutation = useMutation({
    mutationFn: async (utrString) => {
      await axiosClient.patch(`/orders/${orderId}/payment`, {
        payment_status: 'paid',
        payment_reference: utrString
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      navigation.navigate('OrderConfirmation', { orderNumber });
    },
    onError: (err) => {
      Alert.alert('Verification Failed', err.response?.data?.message || err.message);
    }
  });

  const handleOpenUpiApp = () => {
    // In a real app, this would construct a upi://pay URI
    // e.g. upi://pay?pa=${upiId}&pn=LocalShops&am=${total}&cu=INR&tn=Order_${orderNumber}
    const upiUrl = `upi://pay?pa=${upiId}&pn=LocalShops&am=${total}&cu=INR&tn=Order_${orderNumber}`;
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert('No UPI App', 'Could not open UPI app on this device.');
    });
  };

  const handleVerify = () => {
    if (!utr.trim()) {
      Alert.alert('Error', 'Please enter the transaction reference (UTR) number');
      return;
    }
    verifyPaymentMutation.mutate(utr);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>UPI Payment</Text>
      
      <View style={styles.card}>
        <Text style={styles.amount}>Total: ₹{total.toFixed(2)}</Text>
        <Text style={styles.instruction}>Please pay via your preferred UPI app.</Text>
        
        <View style={styles.upiBox}>
          <Text style={styles.upiLabel}>Pay to UPI ID:</Text>
          <Text style={styles.upiId}>{upiId}</Text>
        </View>

        <TouchableOpacity style={styles.openAppBtn} onPress={handleOpenUpiApp}>
          <Text style={styles.openAppText}>Open UPI App</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.verifySection}>
        <Text style={styles.verifyInstruction}>After successful payment, enter the 12-digit UTR/Reference number below:</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter UTR Number"
          value={utr}
          onChangeText={setUtr}
          keyboardType="number-pad"
          maxLength={12}
        />
        <TouchableOpacity 
          style={styles.verifyBtn} 
          onPress={handleVerify}
          disabled={verifyPaymentMutation.isPending}
        >
          {verifyPaymentMutation.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify & Complete Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.m,
  },
  headerTitle: {
    ...theme.typography.title,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.l,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.l,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: theme.spacing.l,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  amount: {
    ...theme.typography.title,
    color: theme.colors.primary,
    marginBottom: theme.spacing.s,
  },
  instruction: {
    ...theme.typography.body,
    textAlign: 'center',
    marginBottom: theme.spacing.m,
  },
  upiBox: {
    backgroundColor: '#F0F0F0',
    padding: theme.spacing.m,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  upiLabel: {
    ...theme.typography.caption,
  },
  upiId: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
  },
  openAppBtn: {
    backgroundColor: '#333',
    paddingVertical: theme.spacing.m,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 8,
  },
  openAppText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  verifySection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.l,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  verifyInstruction: {
    ...theme.typography.body,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.m,
    ...theme.typography.body,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
    letterSpacing: 2,
  },
  verifyBtn: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.m,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default UpiPaymentScreen;
