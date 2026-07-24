import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { Check, Truck, Home, HelpCircle, ChevronRight } from 'lucide-react-native';

export const OrderConfirmationScreen = ({ route }) => {
  const { orderNumber = 'LS-12345' } = route.params || {};
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconOuterCircle}>
          <View style={styles.iconInnerCircle}>
            <Check color="#006B54" size={48} strokeWidth={4} />
          </View>
        </View>

        {/* Text Details */}
        <Text style={styles.title}>Order Placed{'\n'}Successfully!</Text>
        <Text style={styles.subtitle}>Fresh & Local is{'\n'}preparing your items.</Text>
        
        <View style={styles.orderIdPill}>
          <Text style={styles.orderIdText}>ORDER ID: <Text style={{color: '#006B54'}}>#{orderNumber}</Text></Text>
        </View>

        {/* Expected Delivery Card */}
        <TouchableOpacity style={styles.deliveryCard}>
          <Image source={{uri: 'https://via.placeholder.com/60'}} style={styles.shopImage} />
          <View style={styles.deliveryInfo}>
            <Text style={styles.shopName}>Fresh & Local Market</Text>
            <Text style={styles.deliveryTime}>Expected delivery:{'\n'}35-45 mins</Text>
          </View>
          <ChevronRight color={theme.colors.textLight} size={20} />
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
          >
            <Truck color="#FFF" size={20} style={{marginRight: 8}} />
            <Text style={styles.primaryButtonText}>Track Order</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          >
            <Home color="#006B54" size={20} style={{marginRight: 8}} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <HelpCircle color={theme.colors.textLight} size={16} style={{marginRight: 6}} />
        <Text style={styles.footerText}>
          Need help with your order? <Text style={styles.contactSupport}>Contact Support</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F8',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconOuterCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconInnerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#81F2AE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...theme.typography.title,
    fontSize: 28,
    color: '#006B54',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 16,
  },
  orderIdPill: {
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 32,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 16,
    borderRadius: 16,
    width: '100%',
    marginBottom: 32,
  },
  shopImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
  },
  deliveryInfo: {
    flex: 1,
  },
  shopName: {
    ...theme.typography.body,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deliveryTime: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  buttonContainer: {
    width: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#006B54',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.shadows.medium,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#006B54',
    backgroundColor: '#FFF',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#006B54',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  contactSupport: {
    color: '#006B54',
    fontWeight: 'bold',
  }
});

export default OrderConfirmationScreen;
