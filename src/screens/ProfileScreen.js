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
  resetMockOwnerStorage,
  getMockShop,
  updateMockShopStatus,
} from '../mockOwnerData';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export const ProfileScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { owner, shop, logout, updateShopState, checkNewOrders } = useContext(AuthContext);

  // viewMode: 'more' | 'edit_shop' | 'reviews' | 'notifications' | 'hours' | 'delivery' | 'subscription'
  const [viewMode, setViewMode] = useState(route?.params?.initialMode || 'more');

  useEffect(() => {
    if (route?.params?.initialMode) {
      setViewMode(route.params.initialMode);
      navigation.setParams({ initialMode: undefined });
    }
  }, [route?.params?.initialMode, navigation]);

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
    Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true, Sunday: true
  });

  // Time Picker Modal States
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState('open'); // 'open' | 'close'
  const [tempHour, setTempHour] = useState('08');
  const [tempMinute, setTempMinute] = useState('00');
  const [tempAmPm, setTempAmPm] = useState('AM');
  const [pickerMode, setPickerMode] = useState('hour'); // 'hour' | 'minute'

  const handleOpenTimePicker = (field) => {
    setActiveTimeField(field);
    const currentTimeString = field === 'open' ? openTime : closeTime;
    const parts = currentTimeString.split(' ');
    const timeParts = (parts[0] || '08:00').split(':');
    setTempHour(timeParts[0] || '08');
    setTempMinute(timeParts[1] || '00');
    setTempAmPm(parts[1] || 'AM');
    setPickerMode('hour');
    setTimePickerVisible(true);
  };

  const handleConfirmTime = () => {
    const formattedTime = `${tempHour}:${tempMinute} ${tempAmPm}`;
    if (activeTimeField === 'open') {
      setOpenTime(formattedTime);
    } else {
      setCloseTime(formattedTime);
    }
    setTimePickerVisible(false);
  };

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
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.switchLabel}>App Language</Text>
                <Text style={styles.switchSub}>Selected: {selectedLanguage}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {['English', 'Hindi', 'Gujarati'].map(lang => (
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
            <TouchableOpacity 
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }} 
              onPress={() => handleOpenTimePicker('open')}
              activeOpacity={0.7}
            >
              <Text style={styles.timePickerLabel}>OPENING TIME</Text>
              <View style={styles.timeDisplayBtn}>
                <Clock size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.timeDisplayText}>{openTime}</Text>
              </View>
            </TouchableOpacity>
            <View style={{ width: 1.5, backgroundColor: theme.colors.border, height: '80%', marginHorizontal: 8 }} />
            <TouchableOpacity 
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }} 
              onPress={() => handleOpenTimePicker('close')}
              activeOpacity={0.7}
            >
              <Text style={styles.timePickerLabel}>CLOSING TIME</Text>
              <View style={styles.timeDisplayBtn}>
                <Clock size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.timeDisplayText}>{closeTime}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.daySelectorHeader}>Weekly Schedule</Text>
          {Object.keys(daysOpen).map((day) => (
            <View key={day} style={styles.dayRow}>
              <Text style={styles.dayName}>{day}</Text>
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

        {/* Interactive Time Picker Modal */}
        <Modal
          visible={timePickerVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setTimePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.timeModalContainer}>
              <View style={styles.timeModalHeader}>
                <Text style={styles.timeModalTitle}>
                  Set {activeTimeField === 'open' ? 'Opening' : 'Closing'} Time
                </Text>
                <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                  <X color={theme.colors.textDark} size={22} />
                </TouchableOpacity>
              </View>

              {/* Big Time Preview & Selector Tabs */}
              <View style={styles.timePreviewCard}>
                <View style={styles.timeDigitsRow}>
                  <TouchableOpacity
                    style={[styles.timeDigitBox, pickerMode === 'hour' && styles.timeDigitBoxActive]}
                    onPress={() => setPickerMode('hour')}
                  >
                    <Text style={[styles.timeDigitText, pickerMode === 'hour' && styles.timeDigitTextActive]}>
                      {tempHour}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.timeColon}>:</Text>
                  <TouchableOpacity
                    style={[styles.timeDigitBox, pickerMode === 'minute' && styles.timeDigitBoxActive]}
                    onPress={() => setPickerMode('minute')}
                  >
                    <Text style={[styles.timeDigitText, pickerMode === 'minute' && styles.timeDigitTextActive]}>
                      {tempMinute}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.amPmContainer}>
                  <TouchableOpacity
                    style={[styles.amPmBtn, tempAmPm === 'AM' && styles.amPmBtnActive]}
                    onPress={() => setTempAmPm('AM')}
                  >
                    <Text style={[styles.amPmText, tempAmPm === 'AM' && styles.amPmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.amPmBtn, tempAmPm === 'PM' && styles.amPmBtnActive]}
                    onPress={() => setTempAmPm('PM')}
                  >
                    <Text style={[styles.amPmText, tempAmPm === 'PM' && styles.amPmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modeInstructionRow}>
                <Text style={styles.modeInstructionText}>
                  {pickerMode === 'hour' ? 'Select Hour (1 - 12)' : 'Select Minute'}
                </Text>
              </View>

              {/* Hours / Minutes Grid */}
              <View style={styles.pickerGrid}>
                {pickerMode === 'hour' ? (
                  ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((hr) => {
                    const isSelected = tempHour === hr;
                    return (
                      <TouchableOpacity
                        key={hr}
                        style={[styles.gridCircle, isSelected && styles.gridCircleSelected]}
                        onPress={() => {
                          setTempHour(hr);
                          setPickerMode('minute');
                        }}
                      >
                        <Text style={[styles.gridCircleText, isSelected && styles.gridCircleTextSelected]}>{hr}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((min) => {
                    const isSelected = tempMinute === min;
                    return (
                      <TouchableOpacity
                        key={min}
                        style={[styles.gridCircle, isSelected && styles.gridCircleSelected]}
                        onPress={() => setTempMinute(min)}
                      >
                        <Text style={[styles.gridCircleText, isSelected && styles.gridCircleTextSelected]}>{min}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Action buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTimePickerVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmTime}>
                  <Text style={styles.modalConfirmText}>Confirm Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
        {renderHeader('Partner Subscription Plan')}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          <View style={styles.subCard}>
            <View style={styles.subBadgeRow}>
              <Sparkles color="#16A34A" size={28} />
              <View style={styles.subPillBadge}>
                <Text style={styles.subPillText}>RECOMMENDED</Text>
              </View>
            </View>

            <Text style={styles.subCardTitle}>Partner Pro Plan</Text>
            <View style={styles.subPriceContainer}>
              <Text style={styles.subPriceAmount}>Rs. 200</Text>
              <Text style={styles.subPricePeriod}> / Month</Text>
            </View>
            <Text style={styles.subCardDesc}>Get complete access to all digital commerce tools with zero commission on orders.</Text>

            <View style={styles.subFeatureList}>
              <Text style={styles.subFeatureItem}>✓ Unlimited inventory products catalog uploads</Text>
              <Text style={styles.subFeatureItem}>✓ 0% commission on all customer orders processed</Text>
              <Text style={styles.subFeatureItem}>✓ Real-time delivery area & geofence configuration</Text>
              <Text style={styles.subFeatureItem}>✓ Custom store QR generator & online operations</Text>
              <Text style={styles.subFeatureItem}>✓ Complete digital Khata customer ledger access</Text>
            </View>

            <TouchableOpacity
              style={styles.subscribeBtn}
              activeOpacity={0.8}
              onPress={() => Toast.show({ type: 'success', text1: 'Subscription Activated', text2: 'You are subscribed to the Rs. 200/Month Partner Plan!' })}
            >
              <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: 8,
    marginTop: 4,
  },
  langBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  langBtnTextActive: {
    color: theme.colors.primary,
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
  timeDisplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  timeDisplayText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeModalContainer: {
    width: '90%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  timeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  timePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  timeDigitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeDigitBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  timeDigitBoxActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  timeDigitText: {
    fontSize: 28,
    fontWeight: '850',
    color: theme.colors.textDark,
  },
  timeDigitTextActive: {
    color: theme.colors.primary,
  },
  timeColon: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginHorizontal: 8,
  },
  amPmContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  amPmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amPmBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  amPmText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  amPmTextActive: {
    color: '#FFF',
  },
  modeInstructionRow: {
    marginBottom: 10,
  },
  modeInstructionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gridCircle: {
    width: '23%',
    aspectRatio: 1.5,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  gridCircleSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  gridCircleText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  gridCircleTextSelected: {
    color: '#FFF',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    marginLeft: 8,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
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
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  subBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  subPillBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  subPillText: {
    fontSize: 11,
    fontWeight: '850',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  subCardTitle: {
    fontSize: 24,
    fontWeight: '850',
    color: theme.colors.textDark,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  subPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  subPriceAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  subPricePeriod: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  subCardDesc: {
    fontSize: 14,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 20,
  },
  subFeatureList: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 18,
    marginTop: 18,
  },
  subFeatureItem: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
    marginBottom: 12,
  },
  subscribeBtn: {
    backgroundColor: theme.colors.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
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
