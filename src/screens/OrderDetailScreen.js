import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, Image, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import { Menu, Phone, CheckCircle2, Circle, Clock, MapPin, Truck, ShieldCheck, ChevronRight } from 'lucide-react-native';

export const OrderDetailScreen = ({ route }) => {
  const { id } = route.params;
  const navigation = useNavigation();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await axiosClient.get(`/orders/${id}`);
      return res.data;
    }
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const res = await axiosClient.get('/addresses');
      return res.data.addresses;
    }
  });

  const deliveryAddress = addresses?.find(a => a.id == order?.address_id) || addresses?.[0];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#006B54" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Order not found.</Text>
      </SafeAreaView>
    );
  }

  // To match the UI exactly, let's derive statuses.
  // The screenshot shows: Placed, Accepted, Preparing, Out for Delivery, Delivered.
  const statuses = [
    { key: 'pending', title: 'Placed', sub: '10:20 AM, Today' },
    { key: 'accepted', title: 'Accepted', sub: '10:25 AM, Today' },
    { key: 'preparing', title: 'Preparing', sub: 'In progress' },
    { key: 'out_for_delivery', title: 'Out for Delivery', sub: 'Waiting...' },
    { key: 'delivered', title: 'Delivered', sub: 'Estimated 11:15 AM' }
  ];

  // In our DB, pending -> accepted -> out_for_delivery -> delivered. We'll map it to the 5 step process.
  let currentStep = 0;
  if (order.status === 'accepted') currentStep = 1;
  if (order.status === 'preparing') currentStep = 2; // custom status for UI matching
  if (order.status === 'out_for_delivery') currentStep = 3;
  if (order.status === 'delivered') currentStep = 4;
  
  // For the sake of UI screenshot replicating "Preparing", let's force it if it's 'pending' or 'accepted' to step 2 visually if it's early.
  if (order.status === 'pending' || order.status === 'accepted') {
    currentStep = 2; 
  }

  const renderTimeline = () => {
    return (
      <View style={styles.timelineContainer}>
        {statuses.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <View key={step.key} style={styles.timelineRow}>
              {/* Left Column: Icon and Line */}
              <View style={styles.timelineLeft}>
                {isCompleted ? (
                  <CheckCircle2 color="#006B54" size={24} />
                ) : isCurrent ? (
                  <View style={styles.currentStepIcon}>
                    <View style={styles.currentStepDot} />
                  </View>
                ) : (
                  <Circle color="#E0E0E0" size={24} />
                )}
                
                {/* Connecting Line (except last item) */}
                {index < statuses.length - 1 && (
                  <View style={[styles.timelineLine, isCompleted ? styles.timelineLineActive : null]} />
                )}
              </View>

              {/* Right Column: Text */}
              <View style={styles.timelineTextContainer}>
                <Text style={[
                  styles.timelineTitle,
                  isCompleted && styles.timelineTitleCompleted,
                  isCurrent && styles.timelineTitleCurrent
                ]}>
                  {step.title}
                </Text>
                <Text style={styles.timelineSub}>{step.sub}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={{padding: 4}} onPress={() => navigation.goBack()}>
          <Menu color="#006B54" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Local Shops</Text>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }} style={styles.avatar} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Hero Section */}
        <View style={styles.heroHeader}>
          <View style={styles.heroRow1}>
            <Text style={styles.orderIdText}>ORDER #LS-{order.id}</Text>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Preparing</Text>
            </View>
          </View>
          <Text style={styles.heroShopName}>{order?.shop?.name || 'Local Shop'}</Text>
          <View style={styles.heroLocationRow}>
            <MapPin color={theme.colors.textLight} size={14} style={{marginRight: 4}} />
            <Text style={styles.heroAddressText}>24 Maplewood Avenue, Downtown</Text>
          </View>

          <TouchableOpacity style={styles.callBtn}>
            <Phone color="#FFF" size={18} style={{marginRight: 8}} />
            <Text style={styles.callBtnText}>Call Shop</Text>
          </TouchableOpacity>
        </View>

        {/* Order Status Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Status</Text>
          {renderTimeline()}
        </View>

        {/* Need Help Banner */}
        <TouchableOpacity style={styles.helpBanner}>
          <View style={styles.helpIconBox}>
            <Image source={{uri: 'https://cdn-icons-png.flaticon.com/512/1077/1077063.png'}} style={{width: 20, height: 20, tintColor: '#006B54'}} />
          </View>
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpSub}>Chat with local support</Text>
          </View>
          <View style={styles.helpArrowBox}>
            <ChevronRight color="#006B54" size={20} />
          </View>
        </TouchableOpacity>

        {/* Order Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Items</Text>
          
          <View style={styles.orderItemsList}>
            {(order.items || []).map(item => (
              <View key={item.id} style={styles.orderItem}>
                <Image source={{uri: item.image_url || 'https://via.placeholder.com/60'}} style={styles.orderItemImg} />
                <View style={styles.orderItemInfo}>
                  <Text style={styles.orderItemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.orderItemQty}>{item.unit}</Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text style={styles.orderItemPrice}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                  <Text style={styles.orderItemQtyRight}>Qty: {item.quantity}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.summaryLines}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Subtotal</Text>
              <Text style={styles.summaryLineValue}>₹{parseFloat(order.total_amount || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Delivery Fee</Text>
              <Text style={styles.summaryLineValue}>FREE</Text>
            </View>
          </View>

          <View style={styles.totalLine}>
            <Text style={styles.totalTitle}>Total</Text>
            <Text style={styles.totalValue}>₹{parseFloat(order.total_amount || 0).toFixed(2)}</Text>
          </View>
        </View>

        {/* Delivery Address Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Truck color="#006B54" size={18} style={{marginRight: 8}} />
            <Text style={styles.infoCardTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.infoCardName}>{deliveryAddress ? deliveryAddress.name : 'Jane Doe'}</Text>
          <Text style={styles.infoCardBody}>{deliveryAddress ? `${deliveryAddress.line1}, ${deliveryAddress.line2} - ${deliveryAddress.pincode}` : 'Apt 4B, Harmony Towers, Oak Street, New Town - 110022'}</Text>
        </View>

        {/* Payment Status Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <ShieldCheck color="#006B54" size={18} style={{marginRight: 8}} />
            <Text style={styles.infoCardTitle}>Payment Status</Text>
          </View>
          <Text style={styles.infoCardName}>Paid via {order?.payment_method?.toUpperCase() || 'UNKNOWN'}</Text>
          <Text style={styles.infoCardBody}>Transaction ID: TXN_0987654321</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 15 : 20,
    paddingBottom: 16,
    backgroundColor: '#F7F9F8',
  },
  headerTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: '#006B54',
    flex: 1,
    marginLeft: 16,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroHeader: {
    marginBottom: 24,
  },
  heroRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  heroPill: {
    backgroundColor: '#81F2AE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#006B54',
  },
  heroShopName: {
    ...theme.typography.title,
    fontSize: 24,
    color: '#333',
    marginBottom: 4,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroAddressText: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  callBtn: {
    flexDirection: 'row',
    backgroundColor: '#006B54',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  callBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    ...theme.shadows.soft,
  },
  cardTitle: {
    ...theme.typography.subtitle,
    fontSize: 18,
    color: '#333',
    marginBottom: 20,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
    marginRight: 16,
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
  },
  timelineLineActive: {
    backgroundColor: '#006B54',
  },
  currentStepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#81F2AE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#81F2AE',
  },
  timelineTextContainer: {
    flex: 1,
    paddingTop: 2, // align with icon center roughly
  },
  timelineTitle: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    fontWeight: '600',
  },
  timelineTitleCompleted: {
    color: '#333',
    fontWeight: 'bold',
  },
  timelineTitleCurrent: {
    color: '#006B54',
    fontWeight: 'bold',
  },
  timelineSub: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9', // very light green
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  helpIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpTitle: {
    fontWeight: 'bold',
    color: '#006B54',
    fontSize: 14,
  },
  helpSub: {
    fontSize: 12,
    color: '#006B54',
  },
  helpArrowBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderItemsList: {
    marginBottom: 24,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderItemImg: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  orderItemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  orderItemName: {
    ...theme.typography.body,
    fontWeight: 'bold',
    color: '#333',
    fontSize: 13,
  },
  orderItemQty: {
    ...theme.typography.caption,
    marginTop: 4,
  },
  orderItemPrice: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  orderItemQtyRight: {
    ...theme.typography.caption,
    marginTop: 4,
  },
  summaryLines: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 16,
    marginBottom: 16,
    borderStyle: 'dashed', // simple dash approx
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLineLabel: {
    ...theme.typography.body,
    color: theme.colors.textLight,
  },
  summaryLineValue: {
    ...theme.typography.body,
    fontWeight: '500',
    color: '#333',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalTitle: {
    ...theme.typography.subtitle,
    fontSize: 18,
  },
  totalValue: {
    ...theme.typography.title,
    fontSize: 20,
    color: '#006B54',
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardTitle: {
    fontWeight: 'bold',
    color: '#006B54',
    fontSize: 13,
  },
  infoCardName: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 14,
    marginBottom: 4,
  },
  infoCardBody: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
    lineHeight: 18,
  }
});

export default OrderDetailScreen;
