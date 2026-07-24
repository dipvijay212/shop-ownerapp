import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  TextInput,
  Image,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import {
  User,
  Mail,
  Phone,
  LogOut,
  Bell,
  Star,
  Trash2,
  CheckCircle,
  ChevronRight,
  Image as ImageIcon,
  Globe,
  Settings,
  Clock,
  MapPin,
  CreditCard,
  Sliders,
  ChevronLeft,
  X,
  Award,
  Sparkles,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import {
  getMockReviews,
  getMockNotifications,
  markMockNotificationRead,
  resetMockOwnerStorage,
  simulateNewMockOrder,
  getMockShop,
  updateMockShopStatus,
} from '../mockOwnerData';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { owner, shop, logout, updateShopState, checkNewOrders } = useContext(AuthContext);

  // viewMode: 'more' | 'edit_shop' | 'reviews' | 'notifications' | 'hours' | 'delivery' | 'subscription'
  const [viewMode, setViewMode] = useState('more');

  // Lists & States
  const [reviews, setReviews] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Form states
  const [editShopName, setEditShopName] = useState(shop?.name || '');
  const [editShopAddress, setEditShopAddress] = useState(shop?.address || '');
  const [editBannerUri, setEditBannerUri] = useState(shop?.banner_url || null);
  const [editLogoUri, setEditLogoUri] = useState(shop?.logo_url || null);
  const [savingShop, setSavingShop] = useState(false);

  // Delivery Settings States
  const [minOrder, setMinOrder] = useState('100');
  const [deliveryFee, setDeliveryFee] = useState('30');
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState('500');

  // Work Hours States
  const [openTime, setOpenTime] = useState('08:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  const [daysOpen, setDaysOpen] = useState({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: true
  });

  // Settings States
  const [notifyNewOrders, setNotifyNewOrders] = useState(true);
  const [notifyMarketing, setNotifyMarketing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  // Load language from storage
  useEffect(() => {
    const loadLang = async () => {
      try {
        const stored = await AsyncStorage.getItem('owner_language');
        if (stored) setSelectedLanguage(stored);
      } catch (e) {
        console.error(e);
      }
    };
    loadLang();
  }, []);

  // Prefill details
  useEffect(() => {
    if (shop) {
      setEditShopName(shop.name);
      setEditShopAddress(shop.address);
      setEditBannerUri(shop.banner_url);
    }
  }, [shop]);

  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const data = await getMockReviews();
      setReviews(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await getMockNotifications();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
    fetchNotifications();
  }, [fetchReviews, fetchNotifications]);

  const handleSelectLanguage = async (lang) => {
    try {
      setSelectedLanguage(lang);
      await AsyncStorage.setItem('owner_language', lang);
      Toast.show({
        type: 'success',
        text1: 'Language Updated',
        text2: `App interface language changed to ${lang}.`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectPhoto = (type) => {
    const options = { mediaType: 'photo', quality: 0.8 };
    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorCode) return;
      if (response.assets && response.assets.length > 0) {
        if (type === 'banner') {
          setEditBannerUri(response.assets[0].uri);
        } else {
          setEditLogoUri(response.assets[0].uri);
        }
      }
    });
  };

  const handleSaveShop = async () => {
    if (!editShopName.trim() || !editShopAddress.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Store name and address are required.',
      });
      return;
    }

    setSavingShop(true);
    try {
      // Simulate save
      const mockShopData = {
        ...shop,
        name: editShopName.trim(),
        address: editShopAddress.trim(),
        banner_url: editBannerUri,
        logo_url: editLogoUri,
      };

      if (updateShopState) {
        updateShopState(mockShopData);
      }
      Toast.show({
        type: 'success',
        text1: 'Settings Saved',
        text2: 'Shop business profile updated successfully.',
      });
      setViewMode('more');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingShop(false);
    }
  };

  const handleSimulateNewOrder = async () => {
    try {
      await simulateNewMockOrder();
      Toast.show({
        type: 'success',
        text1: 'Simulation Triggered',
        text2: 'Flashed a new mock order request on Dashboard!',
      });
      if (checkNewOrders) checkNewOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetApp = async () => {
    try {
      await resetMockOwnerStorage();
      Toast.show({
        type: 'success',
        text1: 'Cache Cleared',
        text2: 'App mock databases have been reset.',
      });
      setTimeout(() => logout(), 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const renderHeader = (title) => (
    <View style={[styles.formHeader, { paddingTop: insets.top + 6, height: 56 + insets.top }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('more')}>
        <ChevronLeft color={theme.colors.textDark} size={24} />
      </TouchableOpacity>
      <Text style={styles.formHeaderTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  // VIEW MODE: MORE (MAIN MENU)
  if (viewMode === 'more') {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Shop cover / header */}
          <View style={styles.profileCoverBox}>
            <Image
              source={{ uri: editBannerUri || 'https://images.unsplash.com/photo-1542838132-92c53300491e' }}
              style={styles.coverImg}
            />
            <View style={styles.logoWrapper}>
              {editLogoUri ? (
                <Image source={{ uri: editLogoUri }} style={styles.logoImg} />
              ) : (
                <View style={[styles.logoImg, styles.logoPlaceholder]}>
                  <Text style={styles.logoText}>{shop?.name?.charAt(0) || 'S'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.storeMainInfo}>
            <Text style={styles.storeNameText}>{shop?.name || 'Fresh Mart'}</Text>
            <Text style={styles.storeAddressText}>Category: {shop?.category || 'Groceries'}</Text>
            <View style={styles.planBadge}>
              <Award color={theme.colors.primary} size={14} style={{ marginRight: 4 }} />
              <Text style={styles.planBadgeText}>Gold Partner Plan</Text>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <Text style={styles.menuSectionHeader}>Store Configuration</Text>
            
            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('edit_shop')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#DCFCE7' }]}>
                <Settings color={theme.colors.primary} size={20} />
              </View>
              <Text style={styles.menuLabel}>Business Profile</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('hours')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#DBEAFE' }]}>
                <Clock color="#2563EB" size={20} />
              </View>
              <Text style={styles.menuLabel}>Store Working Hours</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('DeliveryArea')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FFE4E6' }]}>
                <Sliders color="#E11D48" size={20} />
              </View>
              <Text style={styles.menuLabel}>Delivery Route Settings</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('subscription')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Award color="#D97706" size={20} />
              </View>
              <Text style={styles.menuLabel}>Partner Subscription Plan</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <Text style={styles.menuSectionHeader}>Feedback & Logs</Text>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('reviews')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                <Star color="#9333EA" size={20} />
              </View>
              <Text style={styles.menuLabel}>Customer Reviews ({reviews.length})</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('notifications')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#E0F2FE' }]}>
                <Bell color="#0369A1" size={20} />
              </View>
              <Text style={styles.menuLabel}>Inbox Alerts ({notifications.length})</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <Text style={styles.menuSectionHeader}>System Utilities</Text>

            <View style={styles.settingsSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>FCM Order Sound Notifications</Text>
                <Text style={styles.switchSub}>Triggers alert sound on new orders</Text>
              </View>
              <Switch
                value={notifyNewOrders}
                onValueChange={setNotifyNewOrders}
                trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }}
                thumbColor={notifyNewOrders ? theme.colors.primary : '#F1F5F9'}
              />
            </View>

            <View style={styles.settingsSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Promotions Alerts</Text>
                <Text style={styles.switchSub}>Triggers weekly stats & trends reports</Text>
              </View>
              <Switch
                value={notifyMarketing}
                onValueChange={setNotifyMarketing}
                trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }}
                thumbColor={notifyMarketing ? theme.colors.primary : '#F1F5F9'}
              />
            </View>

            <View style={styles.langPickerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>App Language</Text>
                <Text style={styles.switchSub}>Selected: {selectedLanguage}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                {['English', 'Hindi'].map(lang => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langBtn, selectedLanguage === lang && styles.langBtnActive]}
                    onPress={() => handleSelectLanguage(lang)}
                  >
                    <Text style={[styles.langBtnText, selectedLanguage === lang && styles.langBtnTextActive]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.simOrderBtn} onPress={handleSimulateNewOrder}>
              <Sparkles color={theme.colors.primary} size={18} style={{ marginRight: 8 }} />
              <Text style={styles.simOrderText}>Simulate New Order Flow</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetApp}>
              <Text style={styles.resetBtnText}>Reset App Cache Database</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <LogOut color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.logoutBtnText}>Logout Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // VIEW MODE: EDIT BUSINESS PROFILE
  if (viewMode === 'edit_shop') {
    return (
      <View style={styles.container}>
        {renderHeader('Edit Business Profile')}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.formSectionTitle}>Cover Banner</Text>
          {editBannerUri ? (
            <View style={styles.bannerContainer}>
              <Image source={{ uri: editBannerUri }} style={styles.bannerImg} />
              <TouchableOpacity style={styles.changeBannerBtn} onPress={() => handleSelectPhoto('banner')}>
                <Text style={styles.changeBannerText}>Change Cover</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.bannerPlaceholder} onPress={() => handleSelectPhoto('banner')}>
              <ImageIcon color={theme.colors.primary} size={28} />
              <Text style={styles.bannerPlaceholderText}>Select Cover Image</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.formSectionTitle, { marginTop: 16 }]}>Store Logo Icon</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={styles.logoPreviewBox}>
              {editLogoUri ? (
                <Image source={{ uri: editLogoUri }} style={styles.logoPreviewImg} />
              ) : (
                <Text style={styles.logoPreviewTxt}>{editShopName.charAt(0) || 'S'}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.uploadLogoBtn} onPress={() => handleSelectPhoto('logo')}>
              <Text style={styles.uploadLogoText}>Upload Custom Logo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Shop Name *</Text>
            <TextInput
              style={styles.fieldInput}
              value={editShopName}
              onChangeText={setEditShopName}
              placeholder="e.g. Fresh Mart Retail"
              placeholderTextColor={theme.colors.textLight}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Business Address *</Text>
            <TextInput
              style={[styles.fieldInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
              multiline={true}
              numberOfLines={3}
              value={editShopAddress}
              onChangeText={setEditShopAddress}
              placeholder="Store address, floor number, locality..."
              placeholderTextColor={theme.colors.textLight}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveShop} disabled={savingShop}>
            {savingShop ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile Settings</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // VIEW MODE: HOURS CONFIGURATION
  if (viewMode === 'hours') {
    return (
      <View style={styles.container}>
        {renderHeader('Store Hours Settings')}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitleLabel}>Set store online operation window</Text>
          
          <View style={styles.timePickerCard}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.timePickerLabel}>Opening Time</Text>
              <TextInput style={styles.timePickerInput} value={openTime} onChangeText={setOpenTime} />
            </View>
            <View style={{ width: 1.5, backgroundColor: theme.colors.border, height: '80%' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.timePickerLabel}>Closing Time</Text>
              <TextInput style={styles.timePickerInput} value={closeTime} onChangeText={setCloseTime} />
            </View>
          </View>

          <Text style={styles.daySelectorHeader}>Weekly Schedule</Text>
          {Object.keys(daysOpen).map((day) => (
            <View key={day} style={styles.dayRow}>
              <Text style={styles.dayName}>{day}day</Text>
              <Switch
                value={daysOpen[day]}
                onValueChange={(val) => setDaysOpen(prev => ({ ...prev, [day]: val }))}
                trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }}
                thumbColor={daysOpen[day] ? theme.colors.primary : '#F1F5F9'}
              />
            </View>
          ))}

          <TouchableOpacity style={styles.saveBtn} onPress={() => {
            Toast.show({ type: 'success', text1: 'Working Hours Saved', text2: 'Weekly operating hours updated.' });
            setViewMode('more');
          }}>
            <Text style={styles.saveBtnText}>Save Operations Timing</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // VIEW MODE: DELIVERY ROUTING SETTINGS
  if (viewMode === 'delivery') {
    return (
      <View style={styles.container}>
        {renderHeader('Delivery Pricing Settings')}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitleLabel}>Configure geofence minimum orders & pricing rules</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Minimum Order Value (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="numeric"
              value={minOrder}
              onChangeText={setMinOrder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Flat Delivery Fee (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="numeric"
              value={deliveryFee}
              onChangeText={setDeliveryFee}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Free Delivery Threshold Amount (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="numeric"
              value={freeDeliveryAbove}
              onChangeText={setFreeDeliveryAbove}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={() => {
            Toast.show({ type: 'success', text1: 'Delivery settings saved', text2: 'Pricing thresholds updated.' });
            setViewMode('more');
          }}>
            <Text style={styles.saveBtnText}>Save Route Pricing</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // VIEW MODE: SUBSCRIPTION PLAN DETAILS
  if (viewMode === 'subscription') {
    return (
      <View style={styles.container}>
        {renderHeader('Partner Subscription plan')}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          <View style={styles.subCard}>
            <Sparkles color="#D97706" size={32} />
            <Text style={styles.subCardTitle}>Gold Partner Plan</Text>
            <Text style={styles.subCardPrice}>₹999 / month</Text>
            <Text style={styles.subCardExpiry}>Expires: 24 December 2026</Text>
            
            <View style={styles.subFeatureList}>
              <Text style={styles.subFeatureItem}>✓ Unlimited inventory products catalog uploads</Text>
              <Text style={styles.subFeatureItem}>✓ Real-time custom geofence draw routing bounds</Text>
              <Text style={styles.subFeatureItem}>✓ Custom UPI payment QR generator overlay</Text>
              <Text style={styles.subFeatureItem}>✓ 0% commission on orders processed</Text>
            </View>
          </View>

          <Text style={styles.otherPlansTitle}>Alternative Partner Plans</Text>
          {[
            { name: 'Silver Partner', price: '₹499/mo', desc: 'Up to 100 products limit. Flat delivery fee configs.' },
            { name: 'Enterprise Platinum', price: 'Custom pricing', desc: 'Custom branding & analytics features.' },
          ].map((plan, index) => (
            <View key={index} style={styles.otherPlanRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.otherPlanName}>{plan.name}</Text>
                <Text style={styles.otherPlanDesc}>{plan.desc}</Text>
              </View>
              <TouchableOpacity style={styles.otherPlanBuyBtn} onPress={() => Toast.show({ type: 'info', text1: 'Upgrade Plan', text2: 'Please contact support.' })}>
                <Text style={styles.otherPlanBuyText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // VIEW MODE: CUSTOMER REVIEWS
  if (viewMode === 'reviews') {
    return (
      <View style={styles.container}>
        {renderHeader('Customer Reviews')}
        {loadingReviews ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }]}
            renderItem={({ item }) => (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewUser}>{item.customer_name || 'Anonymous'}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        color={s <= item.rating ? '#F59E0B' : '#CBD5E1'}
                        fill={s <= item.rating ? '#F59E0B' : 'transparent'}
                        style={{ marginRight: 2 }}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewComment}>{item.comment}</Text>
                <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // VIEW MODE: INBOX ALERTS (NOTIFICATIONS)
  if (viewMode === 'notifications') {
    return (
      <View style={styles.container}>
        {renderHeader('Inbox Alerts')}
        {loadingNotifications ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }]}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.notificationCard, !item.read && styles.notificationUnread]}
                onPress={async () => {
                  if (!item.read) {
                    await markMockNotificationRead(item.id);
                    fetchNotifications();
                    if (checkNewOrders) checkNewOrders();
                  }
                }}
              >
                <View style={styles.notificationInfo}>
                  <Text style={[styles.notificationTitle, !item.read && { fontWeight: '900' }]}>{item.title}</Text>
                  <Text style={styles.notificationBodyText}>{item.message}</Text>
                  <Text style={styles.notificationDate}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  formHeader: {
    height: 56,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  profileCoverBox: {
    height: 140,
    position: 'relative',
    backgroundColor: '#ECEFF1',
    marginBottom: 44,
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  logoWrapper: {
    position: 'absolute',
    bottom: -32,
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  storeMainInfo: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  storeNameText: {
    fontSize: 22,
    fontWeight: '850',
    color: theme.colors.textDark,
  },
  storeAddressText: {
    fontSize: 14,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primaryDark,
  },
  menuContainer: {
    paddingHorizontal: theme.spacing.m,
  },
  menuSectionHeader: {
    fontSize: 12,
    fontWeight: '850',
    color: theme.colors.textLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  menuIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    flex: 1,
  },
  settingsSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  switchSub: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 2,
    fontWeight: '700',
  },
  langPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginLeft: 6,
  },
  langBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  langBtnTextActive: {
    color: theme.colors.primary,
  },
  simOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
    marginTop: 16,
  },
  simOrderText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    height: 1.5,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },
  resetBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  resetBtnText: {
    color: theme.colors.textLight,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutBtn: {
    backgroundColor: theme.colors.error,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '850',
  },
  // Form elements for edit_shop
  formScroll: {
    padding: theme.spacing.m,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '850',
    color: theme.colors.textLight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bannerContainer: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  changeBannerBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeBannerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bannerPlaceholder: {
    height: 100,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPlaceholderText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '800',
    marginTop: 4,
  },
  logoPreviewBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoPreviewImg: {
    width: '100%',
    height: '100%',
  },
  logoPreviewTxt: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.textDark,
  },
  uploadLogoBtn: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  uploadLogoText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...theme.shadows.medium,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '850',
  },
  // Operation hours
  subtitleLabel: {
    fontSize: 13,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginBottom: 16,
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 18,
  },
  timePickerLabel: {
    fontSize: 12,
    fontWeight: '850',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
  },
  timePickerInput: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 6,
    textAlign: 'center',
    paddingVertical: 0,
  },
  daySelectorHeader: {
    fontSize: 14,
    fontWeight: '850',
    color: theme.colors.textDark,
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  // Sub card styles
  subCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FEF3C7',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  subCardTitle: {
    fontSize: 22,
    fontWeight: '850',
    color: '#D97706',
    marginTop: 10,
  },
  subCardPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 4,
  },
  subCardExpiry: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 4,
  },
  subFeatureList: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    paddingTop: 14,
    marginTop: 14,
  },
  subFeatureItem: {
    fontSize: 13,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginBottom: 8,
  },
  otherPlansTitle: {
    fontSize: 15,
    fontWeight: '850',
    color: theme.colors.textDark,
    marginBottom: 10,
  },
  otherPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  otherPlanName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  otherPlanDesc: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
    fontWeight: '700',
  },
  otherPlanBuyBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  otherPlanBuyText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  // Reviews List & Notification Lists
  listContent: {
    padding: theme.spacing.m,
  },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewUser: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  starsRow: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 13,
    color: theme.colors.textDark,
    fontWeight: '700',
    lineHeight: 18,
  },
  reviewDate: {
    fontSize: 10,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  notificationUnread: {
    backgroundColor: '#F0FDF4',
    borderColor: theme.colors.primaryLight,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  notificationBodyText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    marginTop: 2,
  },
  notificationDate: {
    fontSize: 10,
    color: theme.colors.textLight,
    fontWeight: '800',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
});
