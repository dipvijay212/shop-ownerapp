import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
  Share,
  FlatList,
  SafeAreaView,
  Animated,
} from 'react-native';
import {
  Bell,
  User,
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Plus,
  QrCode,
  Users,
  Grid,
  Percent,
  MapPin,
  ChevronRight,
  ClipboardList,
  Phone,
  BarChart2,
  BookOpen,
  MessageCircle,
  Map,
  X,
  Share2,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import {
  getMockOrders,
  updateMockOrderStatus,
  getMockShop,
  updateMockShopStatus,
  getMockNotifications,
  markMockNotificationRead,
} from '../mockOwnerData';
import Toast from 'react-native-toast-message';
import { CollapsibleOrderItems } from '../components/CollapsibleOrderItems';

const { width } = Dimensions.get('window');

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { shop, updateShopState, checkNewOrders } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [shopOnline, setShopOnline] = useState(shop?.status === 'active');
  const slideAnim = useRef(new Animated.Value(shop?.status === 'active' ? 0 : 1)).current;
  const [toggleBoxWidth, setToggleBoxWidth] = useState(width - 64);
  const isTogglingRef = useRef(false);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shopOnline ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [shopOnline, slideAnim]);

  const capsuleWidth = Math.max(20, (toggleBoxWidth - 12) / 2);
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, capsuleWidth],
  });
  const greenOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const [orders, setOrders] = useState([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCategory, setNotificationCategory] = useState('all');
  
  // Quick Metric states
  const [metrics, setMetrics] = useState({
    revenue: 0,
    totalOrders: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0,
  });

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Load Shop
      const shopData = await getMockShop();
      if (!isTogglingRef.current) {
        setShopOnline(shopData.status === 'active');
        if (updateShopState && shopData.status !== shop?.status) {
          updateShopState(shopData);
        }
      }

      // Load Orders for Metrics & Recent List
      const ordersData = await getMockOrders('all');
      setOrders(ordersData);

      // Load Notifications & AI Advisory Alerts
      const notifs = await getMockNotifications();
      setNotifications(notifs);

      // Compute Metrics
      let rev = 0;
      let total = 0;
      let pend = 0;
      let prep = 0;
      let rdy = 0;
      let del = 0;
      let canc = 0;

      ordersData.forEach((order) => {
        total++;
        if (order.status === 'placed') pend++;
        else if (order.status === 'accepted' || order.status === 'preparing') prep++;
        else if (order.status === 'ready') rdy++;
        else if (order.status === 'delivered') {
          del++;
          rev += order.total;
        } else if (order.status === 'cancelled' || order.status === 'rejected') {
          canc++;
        }
      });

      setMetrics({
        revenue: rev,
        totalOrders: total,
        pending: pend,
        preparing: prep,
        ready: rdy,
        delivered: del,
        cancelled: canc,
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Load Error',
        text2: 'Failed to sync dashboard metrics.',
      });
    } finally {
      setLoading(false);
    }
  }, [updateShopState]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const handleToggleShopStatus = (targetOnline) => {
    if (isTogglingRef.current) return;
    const nextState = targetOnline !== undefined ? targetOnline : !shopOnline;
    if (nextState === shopOnline) return;

    isTogglingRef.current = true;
    const newStatus = nextState ? 'active' : 'inactive';
    // Instantly update UI state so GPU animation triggers with zero lag
    setShopOnline(nextState);

    // Defer heavy storage operations so UI thread doesn't hang during animation
    setTimeout(async () => {
      try {
        const updatedShop = await updateMockShopStatus(newStatus);
        if (updateShopState) {
          updateShopState(updatedShop);
        }
        Toast.show({
          type: 'success',
          text1: 'Shop Status Updated',
          text2: `Your shop is now ${nextState ? 'Open (Online)' : 'Closed (Offline)'}.`,
        });
      } catch (e) {
        setShopOnline(!nextState);
        console.error(e);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not change status.',
        });
      } finally {
        setTimeout(() => {
          isTogglingRef.current = false;
        }, 200);
      }
    }, 80);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateMockOrderStatus(orderId, newStatus);
      Toast.show({
        type: 'success',
        text1: 'Order Updated',
        text2: `Status changed to ${newStatus}.`,
      });
      loadDashboardData();
      if (checkNewOrders) checkNewOrders();
    } catch (e) {
      console.error(e);
    }
  };

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
    const msg = `Hello ${name}, this is Fresh Mart regarding your order.`;
    Linking.openURL(`whatsapp://send?phone=${num}&text=${encodeURIComponent(msg)}`).catch(() => {
      // Fallback web WhatsApp link
      Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
    });
  };

  const recentOrders = orders.filter(o => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing').slice(0, 3);

  const quickActions = [
    { id: 'orders', title: 'Manage Orders', icon: ClipboardList, color: '#16A34A', bg: '#DCFCE7', onPress: () => navigation.navigate('Orders') },
    { id: 'add_product', title: 'Add Product', icon: Plus, color: '#15803D', bg: '#DCFCE7', onPress: () => navigation.navigate('Products') },
    { id: 'qr', title: 'QR Code', icon: QrCode, color: '#0F172A', bg: '#F1F5F9', onPress: () => setShowQrModal(true) },
    { id: 'ledger', title: 'Khata', icon: BookOpen, color: '#D97706', bg: '#FEF3C7', onPress: () => setShowLedgerModal(true) },
    { id: 'delivery', title: 'Delivery Area', icon: Map, color: '#0D9488', bg: '#CCFBF1', onPress: () => navigation.navigate('DeliveryArea') },
    { id: 'timing', title: 'Shop timing', icon: Clock, color: '#EA580C', bg: '#FFEDD5', onPress: () => navigation.navigate('Profile', { initialMode: 'hours' }) },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 6, height: 72 + insets.top }]}>
        <View style={styles.headerProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{shop?.name ? shop.name.charAt(0) : 'S'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.shopName} numberOfLines={1}>{shop?.name || 'Fresh Mart'}</Text>
            <Text style={styles.ownerName}>{shop?.ownerName || 'Partner Portal'}</Text>
          </View>
        </View>
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotificationsModal(true)}>
            <Bell color={theme.colors.textDark} size={22} />
            {notifications.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{notifications.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Prominent Store Status Banner & Custom Animated Toggle */}
        <View style={styles.statusBannerCard}>
          <View style={styles.statusBannerTopRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={[styles.statusIndicatorDot, { backgroundColor: shopOnline ? '#22C55E' : '#94A3B8' }]} />
                <Text style={styles.statusBannerTitle}>Store Status</Text>
              </View>
              <Text style={styles.statusBannerSubtitle}>
                {shopOnline ? 'Store is LIVE & accepting orders from customers.' : 'Store is OFFLINE. New orders are paused.'}
              </Text>
            </View>
            <View style={styles.syncBadge}>
              <Clock size={12} color={theme.colors.textLight} style={{ marginRight: 4 }} />
              <Text style={styles.syncBadgeText}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>

          {/* Huge Animated Pill Switcher (Hardware Accelerated) */}
          <View
            style={[styles.animatedToggleContainer, { backgroundColor: '#475569', overflow: 'hidden' }]}
            onLayout={(e) => setToggleBoxWidth(e.nativeEvent.layout.width)}
          >
            {/* Green Background Overlay with GPU Opacity Animation */}
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: '#16A34A', opacity: greenOpacity }
              ]}
            />

            <Animated.View
              style={[
                styles.animatedToggleCapsule,
                { width: capsuleWidth, transform: [{ translateX }] }
              ]}
            />

            {/* Online Option */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.animatedToggleTab}
              onPress={() => {
                handleToggleShopStatus(true);
              }}
            >
              <Text style={[
                styles.animatedToggleText,
                { color: shopOnline ? '#15803D' : '#FFFFFF' }
              ]}>
                Online
              </Text>
            </TouchableOpacity>

            {/* Offline Option */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.animatedToggleTab}
              onPress={() => {
                handleToggleShopStatus(false);
              }}
            >
              <Text style={[
                styles.animatedToggleText,
                { color: !shopOnline ? '#334155' : '#FFFFFF' }
              ]}>
                Offline
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analytics Section */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsContainer}>
          <View style={[styles.metricCard, { borderColor: theme.colors.primary }]}>
            <TrendingUp color={theme.colors.primary} size={24} />
            <Text style={styles.metricValue}>₹{metrics.revenue.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Today's Revenue</Text>
            <Text style={styles.metricSubText}>+12.4% vs yesterday</Text>
          </View>

          <View style={styles.metricCard}>
            <ShoppingBag color="#3B82F6" size={24} />
            <Text style={styles.metricValue}>{metrics.totalOrders}</Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
            <Text style={styles.metricSubText}>All statuses today</Text>
          </View>

          <View style={[styles.metricCard, metrics.pending > 0 && { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }]}>
            <Clock color="#F59E0B" size={24} />
            <Text style={styles.metricValue}>{metrics.pending}</Text>
            <Text style={styles.metricLabel}>Pending Orders</Text>
            <Text style={styles.metricSubText}>Needs Accept/Reject</Text>
          </View>

          <View style={styles.metricCard}>
            <Truck color="#8B5CF6" size={24} />
            <Text style={styles.metricValue}>{metrics.preparing}</Text>
            <Text style={styles.metricLabel}>Processing / Packing</Text>
            <Text style={styles.metricSubText}>Preparing orders</Text>
          </View>

          <View style={styles.metricCard}>
            <CheckCircle color="#10B981" size={24} />
            <Text style={styles.metricValue}>{metrics.delivered}</Text>
            <Text style={styles.metricLabel}>Delivered</Text>
            <Text style={styles.metricSubText}>Success handovers</Text>
          </View>
        </ScrollView>

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>Quick Operations</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity key={action.id} style={styles.quickActionCard} onPress={action.onPress}>
                <View style={[styles.quickActionIconBg, { backgroundColor: action.bg }]}>
                  <Icon color={action.color} size={24} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active/Recent orders preview */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Orders Queue ({recentOrders.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.viewAllLink}>Go to Queue</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingBag size={48} color={theme.colors.border} />
            <Text style={styles.emptyStateTitle}>All Orders Cleared!</Text>
            <Text style={styles.emptyStateSub}>Any incoming order requests will flash here.</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View style={styles.orderMetadata}>
                  <Text style={styles.orderIdText}>#{order.orderNumber || order.id}</Text>
                  <Text style={styles.orderTimeText}>
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  order.status === 'placed' ? styles.statusPlaced : styles.statusAccepted
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    order.status === 'placed' ? styles.statusPlacedText : styles.statusAcceptedText
                  ]}>
                    {order.status === 'placed' ? 'New Request' : 'Preparing'}
                  </Text>
                </View>
              </View>

              <View style={styles.orderCustomerRow}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {order.customer_name ? order.customer_name.charAt(0) : 'C'}
                  </Text>
                </View>
                <View style={styles.customerDetails}>
                  <Text style={styles.customerName}>{order.customer_name}</Text>
                  <Text style={styles.customerPhone}>{order.customer_phone}</Text>
                </View>
                <View style={styles.customerContactActions}>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => handleCall(order.customer_phone)}>
                    <Phone size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => handleWhatsApp(order.customer_phone, order.customer_name)}>
                    <MessageCircle size={18} color="#22C55E" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.orderDetailsDivider} />
              
              <CollapsibleOrderItems items={order.items} />

              <View style={styles.orderCardFooter}>
                <View>
                  <Text style={styles.footerPriceLabel}>Total Amount</Text>
                  <Text style={styles.footerPrice}>₹{order.total.toFixed(2)}</Text>
                </View>

                <View style={styles.orderActionsRow}>
                  {order.status === 'placed' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleUpdateOrderStatus(order.id, 'rejected')}
                      >
                        <Text style={styles.rejectBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.acceptBtn]}
                        onPress={() => handleUpdateOrderStatus(order.id, 'accepted')}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.readyBtn]}
                      onPress={() => handleUpdateOrderStatus(order.id, 'ready')}
                    >
                      <Text style={styles.readyBtnText}>Mark Ready</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* QR CODE MODAL */}
      <Modal visible={showQrModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Store Payment QR</Text>
              <TouchableOpacity onPress={() => setShowQrModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.qrContainer}>
              <Text style={styles.qrStoreName}>{shop?.name || 'Fresh Mart'}</Text>
              <Text style={styles.qrStoreCategory}>{shop?.category || 'Groceries'}</Text>
              <View style={styles.qrWrapper}>
                {/* Mock QR graphic */}
                <Image
                  source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=freshmart@ybl%26pn=Fresh%20Mart%26am=0%26cu=INR' }}
                  style={styles.qrImage}
                />
              </View>
              <Text style={styles.qrUpiText}>UPI ID: freshmart@upi</Text>
              <Text style={styles.qrDesc}>Display this QR code at your shop counter for direct merchant payments.</Text>
            </View>
            <TouchableOpacity style={styles.shareQrBtn} onPress={() => Share.share({ message: 'Pay Fresh Mart using UPI ID: freshmart@upi' })}>
              <Share2 color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.shareQrText}>Share QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CREDIT LEDGER MODAL */}
      <Modal visible={showLedgerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Credit Ledger (Khata)</Text>
              <TouchableOpacity onPress={() => setShowLedgerModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.ledgerScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.ledgerSummaryBox}>
                <Text style={styles.ledgerLabel}>Total Outstanding Credit</Text>
                <Text style={styles.ledgerAmount}>₹14,890.00</Text>
                <View style={styles.ledgerSubRow}>
                  <Text style={styles.ledgerSubText}>Limit: ₹50,000</Text>
                  <Text style={styles.ledgerSubText}>Active Customers: 8</Text>
                </View>
              </View>

              <Text style={styles.ledgerHeader}>Recent Khata Repayments & Dues</Text>
              {[
                { name: 'Priya Patel', amt: '₹500', type: 'partial', desc: 'Partial Repayment (UPI)', bal: '₹700 due', date: 'Today, 03:45 PM' },
                { name: 'Rohan Mehta', amt: '₹4,500', type: 'due', desc: 'Bulk goods given on Udhari', bal: '₹4,500 due', date: 'Today, 11:20 AM' },
                { name: 'Sunita Rao', amt: '₹1,200', type: 'due', desc: 'Monthly groceries credit', bal: '₹1,200 due', date: 'Yesterday' },
                { name: 'Amit Kumar', amt: '₹2,000', type: 'paid', desc: 'Full Ledger Clear (GPay)', bal: '₹0 due', date: '22 July 2026' },
                { name: 'Rajesh Patel', amt: '₹600', type: 'partial', desc: 'Partial Repayment (Cash)', bal: '₹1,290 due', date: '19 July 2026' },
              ].map((item, idx) => (
                <View key={idx} style={styles.ledgerRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.ledgerCustomerName}>{item.name}</Text>
                    <Text style={[styles.ledgerDate, { color: '#475569', fontWeight: '700' }]}>{item.desc}</Text>
                    <Text style={styles.ledgerDate}>{item.date}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[
                      styles.ledgerRowAmount,
                      { color: item.type === 'due' ? theme.colors.error : theme.colors.success }
                    ]}>
                      {item.type === 'due' ? '+' : '-'}{item.amt}
                    </Text>
                    <Text style={[styles.ledgerRowStatus, item.type === 'partial' && { color: '#D97706', fontWeight: '800' }]}>
                      {item.type === 'due' ? 'Outstanding' : item.type === 'partial' ? `Partial (${item.bal})` : 'Fully Paid'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.shareQrBtn} onPress={() => Toast.show({ type: 'success', text1: 'Statement', text2: 'PDF statement downloaded to folder.' })}>
              <Text style={styles.shareQrText}>Download PDF Statement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COUPONS MODAL */}
      <Modal visible={showCouponModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Store Coupons & Discounts</Text>
              <TouchableOpacity onPress={() => setShowCouponModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.ledgerScroll}>
              {[
                { code: 'FRESH20', desc: '20% OFF on vegetables & fruits', active: true, usage: 'Used 42 times' },
                { code: 'WELCOME100', desc: 'Flat ₹100 discount on first purchase above ₹800', active: true, usage: 'Used 129 times' },
                { code: 'WEEKEND50', desc: 'Flat ₹50 off on weekends', active: false, usage: 'Expired' },
              ].map((coupon, idx) => (
                <View key={idx} style={[styles.couponCard, !coupon.active && { opacity: 0.6 }]}>
                  <View style={styles.couponHeader}>
                    <View style={styles.couponTag}>
                      <Text style={styles.couponCode}>{coupon.code}</Text>
                    </View>
                    <Switch value={coupon.active} onValueChange={() => {}} />
                  </View>
                  <Text style={styles.couponDesc}>{coupon.desc}</Text>
                  <Text style={styles.couponUsage}>{coupon.usage}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.shareQrBtn} onPress={() => Toast.show({ type: 'success', text1: 'Coupon Created', text2: 'New promotional coupon active.' })}>
              <Text style={styles.shareQrText}>Create New Coupon</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CATEGORIES MODAL */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Product Categories</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.ledgerScroll}>
              {[
                { name: 'Vegetables', count: '12 products', image: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=100' },
                { name: 'Fruits', count: '8 products', image: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=100' },
                { name: 'Dairy', count: '15 products', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100' },
                { name: 'Staples', count: '24 products', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100' },
              ].map((cat, idx) => (
                <View key={idx} style={styles.categoryRow}>
                  <Image source={{ uri: cat.image }} style={styles.categoryImg} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.categoryNameText}>{cat.name}</Text>
                    <Text style={styles.categoryCountText}>{cat.count}</Text>
                  </View>
                  <TouchableOpacity style={styles.catEditBtn}>
                    <Text style={styles.catEditBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.shareQrBtn} onPress={() => Toast.show({ type: 'info', text1: 'Info', text2: 'Please add a product and select category.' })}>
              <Text style={styles.shareQrText}>Create Custom Category</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NOTIFICATION CENTER & AI INSIGHTS MODAL */}
      <Modal visible={showNotificationsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '88%', height: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Bell color={theme.colors.textDark} size={22} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Merchant Alert Center</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>

            {/* Category Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.notifFilterScroll} contentContainerStyle={styles.notifFilterContainer}>
              {[
                { key: 'all', label: `All (${notifications.length})` },
                { key: 'orders', label: 'Orders' },
                { key: 'subscription', label: 'Subscription' },
                { key: 'ai_insights', label: '🤖 AI Insights' },
                { key: 'shop_profile', label: 'Shop & Profile' },
              ].map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.notifFilterPill, notificationCategory === tab.key && styles.notifFilterPillActive]}
                  onPress={() => setNotificationCategory(tab.key)}
                >
                  <Text style={[styles.notifFilterText, notificationCategory === tab.key && styles.notifFilterTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 6 }}>
              {notifications
                .filter(n => {
                  if (notificationCategory === 'all') return true;
                  if (notificationCategory === 'shop_profile') return n.category === 'shop' || n.category === 'profile';
                  return n.category === notificationCategory;
                })
                .map(notif => (
                  <View key={notif.id} style={[styles.notifCard, !notif.is_read && styles.notifCardUnread]}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitle, { color: notif.color || theme.colors.textDark }]}>
                        {notif.title}
                      </Text>
                      <Text style={styles.notifTime}>
                        {notif.created_at ? new Date(notif.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today'}
                      </Text>
                    </View>
                    <Text style={styles.notifBody}>{notif.body}</Text>
                    
                    {notif.actionLabel && (
                      <TouchableOpacity
                        style={[styles.notifActionBtn, { backgroundColor: notif.bgColor || '#F1F5F9', borderColor: notif.color || '#CBD5E1' }]}
                        onPress={() => {
                          setShowNotificationsModal(false);
                          if (notif.actionRoute === 'Orders') {
                            navigation.navigate('Orders');
                          } else if (notif.actionRoute === 'Shop' || notif.category === 'profile') {
                            navigation.navigate('Shop');
                          } else if (notif.actionRoute === 'Customers') {
                            navigation.navigate('Customers');
                          } else if (notif.actionRoute === 'Products') {
                            navigation.navigate('Products');
                          } else if (notif.category === 'subscription') {
                            navigation.navigate('More', { screen: 'Profile' });
                          } else {
                            Toast.show({
                              type: 'success',
                              text1: 'Action Launched',
                              text2: `${notif.actionLabel} applied.`,
                            });
                          }
                        }}
                      >
                        <Text style={[styles.notifActionText, { color: notif.color || theme.colors.textDark }]}>
                          {notif.actionLabel} →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
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
    height: 72,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statusToggleContainer: {
    alignItems: 'center',
    marginRight: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  scrollContent: {
    padding: theme.spacing.m,
    paddingBottom: 40,
  },
  statusBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  statusBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBannerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 18,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  animatedToggleContainer: {
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    padding: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  animatedToggleCapsule: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  animatedToggleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  animatedToggleText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  syncText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primaryDark,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  metricsContainer: {
    paddingBottom: 16,
  },
  metricCard: {
    width: 140,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 14,
    marginRight: 12,
    ...theme.shadows.soft,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 10,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  metricSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickActionCard: {
    width: '30%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 12,
    ...theme.shadows.soft,
  },
  quickActionIconBg: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    ...theme.shadows.soft,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 10,
  },
  emptyStateSub: {
    fontSize: 13,
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
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  orderTimeText: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginLeft: 8,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPlaced: {
    backgroundColor: '#FEF3C7',
  },
  statusPlacedText: {
    color: '#D97706',
  },
  statusAccepted: {
    backgroundColor: '#DBEAFE',
  },
  statusAcceptedText: {
    color: '#2563EB',
  },
  orderCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  customerDetails: {
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
  customerContactActions: {
    flexDirection: 'row',
  },
  contactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  orderDetailsDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  itemsSummary: {
    fontSize: 14,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginBottom: 12,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  footerPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  orderActionsRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  rejectBtnText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    backgroundColor: theme.colors.primary,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  readyBtn: {
    backgroundColor: '#D1FAE5',
  },
  readyBtnText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modal Overlays
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
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  qrStoreName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  qrStoreCategory: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  qrWrapper: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 18,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrUpiText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  qrDesc: {
    fontSize: 12,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  shareQrBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  shareQrText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  ledgerScroll: {
    marginBottom: 12,
  },
  ledgerSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  ledgerLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  ledgerAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.error,
    marginTop: 4,
  },
  ledgerSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
  ledgerSubText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  ledgerHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 10,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  ledgerCustomerName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  ledgerDate: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 2,
    fontWeight: '700',
  },
  ledgerRowAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  ledgerRowStatus: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  couponCard: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  couponCode: {
    color: '#9333EA',
    fontWeight: '800',
    fontSize: 12,
  },
  couponDesc: {
    fontSize: 14,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginTop: 8,
  },
  couponUsage: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '800',
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ECEFF1',
  },
  categoryNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  categoryCountText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  catEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  catEditBtnText: {
    color: theme.colors.textDark,
    fontSize: 12,
    fontWeight: '800',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  notifFilterScroll: {
    maxHeight: 46,
    marginBottom: 8,
  },
  notifFilterContainer: {
    paddingVertical: 4,
  },
  notifFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifFilterPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  notifFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  notifFilterTextActive: {
    color: '#FFF',
    fontWeight: '850',
  },
  notifCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...theme.shadows.small,
  },
  notifCardUnread: {
    backgroundColor: '#FAFAFC',
    borderColor: '#CBD5E1',
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notifTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '850',
    marginRight: 8,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  notifBody: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  notifActionBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  notifActionText: {
    fontSize: 12,
    fontWeight: '850',
  },
});
