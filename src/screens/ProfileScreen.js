import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
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
  BackHandler,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  Check,
  Search,
  Truck,
  CalendarClock,
  BookOpen,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import { theme } from '../theme';
import KeyboardAwareForm from '../components/KeyboardAwareForm';
import { to12h } from '../utils/time';
import { CATEGORY_ITEMS, getCategoryColor } from '../constants/shopCategories';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation, SUPPORTED_LANGUAGES } from '../constants/translations';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

// The API keys hours by weekday number (0=Sunday … 6=Saturday).
// These stay English: they are the KEYS of `dayWindows` and map to the API's
// numeric weekday column. The label shown on the card is translated separately
// via t(`dayName${index}`) — translating these would break the lookup.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "08:00 AM" -> "08:00" (what the API's HH:mm pattern expects). */
const to24h = (label) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label ?? '').trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
};

/** "07:00" -> "07:00 AM", for showing a stored 24h time. */

/** "08:00" -> "08:00 AM" for display, plus a Date for the native picker. */
const from24h = (value, fallbackHour) => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  const hour = m ? parseInt(m[1], 10) : fallbackHour;
  const minute = m ? parseInt(m[2], 10) : 0;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return {
    label: `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`,
    date,
  };
};

export const ProfileScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { owner, shop, logout, updateShopState, updateOwnerState, refreshShop, checkNewOrders, appLanguage, setAppLanguage, newSubscriptionsCount, pendingKhataCount, subscription, refreshSubscription } = useContext(AuthContext);
  const { t } = useTranslation();

  // viewMode: 'more' | 'edit_shop' | 'reviews' | 'notifications' | 'hours' | 'delivery'
  const [viewMode, setViewMode] = useState(route?.params?.initialMode || 'more');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => {
    if (route?.params?.initialMode) {
      setViewMode(route.params.initialMode);
      navigation.setParams({ initialMode: undefined });
    }
  }, [route?.params?.initialMode, navigation]);

  // Handle hardware back button navigation for ProfileScreen subviews
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (viewMode !== 'more') {
          setViewMode('more');
          return true; // Intercept hardware back and return to 'more' menu
        }
        return false; // Default hardware back behavior
      };

      // Named for what it is — `subscription` now means the plan, from context.
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [viewMode])
  );

  // The plan badge below reports real state, so it needs real data. Nothing
  // else in the app called this, which is why `subscription` sat null forever.
  useFocusEffect(
    useCallback(() => {
      refreshSubscription?.();
    }, [refreshSubscription]),
  );

  const planBadgeTone =
    subscription?.state === 'expired'
      ? { fg: '#B91C1C', label: t('planExpired') }
      : subscription?.state === 'trial'
        ? { fg: '#1D4ED8', label: t('planTrialDaysLeft', { count: subscription?.trial?.days_left ?? 0 }) }
        : subscription?.state === 'active'
          ? { fg: theme.colors.primary, label: t('planActive') }
          : { fg: theme.colors.primary, label: t('goldPartnerPlan') };

  // Reset viewMode when user re-taps the 'More' tab item
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setViewMode('more');
    });
    return unsubscribe;
  }, [navigation]);

  // Form states - Owner Personal Details
  const [editOwnerName, setEditOwnerName] = useState(owner?.full_name || owner?.name || '');
  const [editOwnerEmail, setEditOwnerEmail] = useState(owner?.email || '');
  const [editOwnerPhone, setEditOwnerPhone] = useState(owner?.phone || '');

  // Form states - Shop Business Details
  const [editShopName, setEditShopName] = useState(shop?.name || '');
  const [editShopCategories, setEditShopCategories] = useState(
    Array.isArray(shop?.categories) && shop.categories.length > 0
      ? shop.categories.map((c) => (typeof c === 'string' ? c : c.name || c.id))
      : Array.isArray(shop?.category)
        ? shop.category
        : shop?.category
          ? [shop.category]
          : ['Groceries']
  );
  const [editShopPhone, setEditShopPhone] = useState(shop?.contact_phone || shop?.phone || owner?.phone || '');
  const [editShopAddress, setEditShopAddress] = useState(shop?.address_line || shop?.address || '');
  const [editBannerUri, setEditBannerUri] = useState(shop?.banner_url || null);
  const [editLogoUri, setEditLogoUri] = useState(shop?.logo_url || null);
  // The API field is `online_payments_enabled` (plural). Reading the mock's
  // singular `online_payment_enabled` gave undefined, and `undefined !== false`
  // is true — so this switch showed ON for every shop regardless of the real
  // setting, including ones the server has it disabled for.
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(
    shop?.online_payments_enabled === true
  );
  const [savingShop, setSavingShop] = useState(false);

  // ScrollRef & Category Inline Dropdown
  const ownerScrollRef = useRef(null);
  const editShopScrollRef = useRef(null);
  // Each of this screen's forms named its problem in a toast and then left the
  // owner to find the field. Errors now sit on the field, and the view moves
  // to the first one that failed.
  const [profileErrors, setProfileErrors] = useState({});
  const profileFieldY = useRef({});
  const captureProfileY = (field) => (e) => { profileFieldY.current[field] = e.nativeEvent.layout.y; };
  const clearProfileError = (field) =>
    setProfileErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  const failProfile = (scrollRef, field, message) => {
    setProfileErrors({ [field]: message });
    const y = profileFieldY.current[field];
    if (y !== undefined) scrollRef?.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  };
  const deliveryScrollRef = useRef(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Native Built-in Time Picker States
  const [openTime, setOpenTime] = useState('08:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  const [openTimeDate, setOpenTimeDate] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [closeTimeDate, setCloseTimeDate] = useState(() => {
    const d = new Date();
    d.setHours(22, 0, 0, 0);
    return d;
  });
  const [showNativePicker, setShowNativePicker] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState('open'); // 'open' | 'close'

  const handleOpenNativePicker = (field) => {
    setActiveTimeField(field);
    setShowNativePicker(true);
  };

  const handleWindowTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowNativePicker(false);
    if (!selectedDate || !windowPickerTarget) return;
    const hh = String(selectedDate.getHours()).padStart(2, '0');
    const mm = String(selectedDate.getMinutes()).padStart(2, '0');
    setWindowTime(windowPickerTarget.day, windowPickerTarget.index, windowPickerTarget.field, `${hh}:${mm}`);
  };

  const handleNativeTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowNativePicker(false);
    }
    if (selectedDate) {
      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      const formattedHoursStr = formattedHours < 10 ? `0${formattedHours}` : formattedHours;
      const formattedTimeString = `${formattedHoursStr}:${formattedMinutes} ${ampm}`;

      if (activeTimeField === 'open') {
        setOpenTimeDate(selectedDate);
        setOpenTime(formattedTimeString);
      } else {
        setCloseTimeDate(selectedDate);
        setCloseTime(formattedTimeString);
      }
    }
  };

  // Delivery Settings States
  // Seeded from the shop record. A fee of 0 means the shop does not charge for
  // delivery, which is the default for every shop until an owner sets one.
  const [isDeliveryChargeEnabled, setIsDeliveryChargeEnabled] = useState(
    Number(shop?.delivery_fee ?? 0) > 0
  );
  const [minOrder, setMinOrder] = useState('100');
  const [deliveryFee, setDeliveryFee] = useState(
    shop?.delivery_fee != null ? String(Math.round(Number(shop.delivery_fee))) : ''
  );
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState(
    shop?.free_delivery_min != null ? String(Math.round(Number(shop.free_delivery_min))) : ''
  );
  const [savingDelivery, setSavingDelivery] = useState(false);

  // Work Hours States.
  //
  // The API keys hours by weekday NUMBER (0=Sunday … 6=Saturday) and uses 24h
  // "HH:mm"; this screen shows day names and 12h times, so the two helpers
  // below convert between them. Nothing here used to reach the server at all —
  // the Save button only raised a toast — so hours never persisted and the
  // shop's automatic open/close (the `within_hours` leg of the server's
  // visibility rule) had no schedule to work from.
  // Every day starts CLOSED. A shop is only visible to customers on days the
  // owner has deliberately switched on — the server's visibility rule reads the
  // same schedule, so the Home banner and the storefront agree automatically.
  // One entry per day, each holding its own list of opening windows:
  //   { Monday: [{ opens: '07:00', closes: '11:00' }, { opens: '16:00', closes: '21:00' }] }
  // An empty list means the shop is closed that day. This replaced a single
  // open/close pair shared by the whole week, which could not express a shop
  // that shuts for the afternoon.
  const [dayWindows, setDayWindows] = useState(() =>
    Object.fromEntries(DAY_NAMES.map((name) => [name, []])),
  );
  const [hoursSaveState, setHoursSaveState] = useState('idle'); // idle | saving | saved | error
  const hoursHydratedRef = useRef(false);
  const hoursSaveTimerRef = useRef(null);
  // The exact payload the server already holds. Autosave compares against this
  // and does nothing when they match, so seeding the form from the server — or
  // any unrelated re-render — cannot trigger a save the owner never asked for.
  const savedHoursRef = useRef(null);

  // One canonical serialisation, used both to seed the baseline and to decide
  // whether anything has actually changed since.
  const serialiseHours = useCallback(
    (windows) =>
      JSON.stringify(
        DAY_NAMES.flatMap((name, weekday) =>
          (windows[name] ?? []).map((w) => ({
            weekday,
            is_open: true,
            opens: w.opens,
            closes: w.closes,
          })),
        ),
      ),
    [],
  );

  // Seed the schedule from the server. Several rows may share a weekday — one
  // per opening window — so they are grouped rather than overwriting.
  useEffect(() => {
    const rows = shop?.hours;
    if (!Array.isArray(rows)) return;

    const next = Object.fromEntries(DAY_NAMES.map((name) => [name, []]));
    for (const row of rows) {
      const name = DAY_NAMES[Number(row.weekday)];
      if (!name || row.is_open === false) continue;
      next[name].push({
        opens: String(row.opens ?? '').slice(0, 5),
        closes: String(row.closes ?? '').slice(0, 5),
      });
    }
    for (const name of DAY_NAMES) {
      next[name].sort((a, b) => a.opens.localeCompare(b.opens));
    }
    setDayWindows(next);

    savedHoursRef.current = serialiseHours(next);
    hoursHydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.hours]);

  // Autosave, debounced, and only when the schedule actually differs from what
  // the server already holds.
  useEffect(() => {
    if (!hoursHydratedRef.current) return undefined;

    const payload = serialiseHours(dayWindows);
    if (payload === savedHoursRef.current) return undefined;

    if (hoursSaveTimerRef.current) clearTimeout(hoursSaveTimerRef.current);
    hoursSaveTimerRef.current = setTimeout(async () => {
      setHoursSaveState('saving');
      try {
        const rows = JSON.parse(payload);
        // A week with no windows at all would leave the server with no rows,
        // which it reads as "always open" — the opposite of what an owner who
        // switched every day off means. Send a closed marker instead.
        await api.shop.setShopHours(
          rows.length
            ? rows
            : DAY_NAMES.map((_, weekday) => ({
                weekday,
                is_open: false,
                opens: '00:00',
                closes: '00:00',
              })),
        );

        // Setting opening hours IS the owner saying they are open for business,
        // so bring the store online if it is not already — but only when some
        // day is actually open, and never against the server's own rule.
        if (rows.length && !shop?.is_online) {
          await api.shop.setOnline(true).catch((e) =>
            console.error('[Hours] could not bring the store online', e),
          );
        }

        savedHoursRef.current = payload;
        await refreshShop().catch(() => {});
        setHoursSaveState('saved');
      } catch (e) {
        console.error('[Hours] save failed', e);
        setHoursSaveState('error');
        Toast.show({
          type: 'error',
          text1: t('couldNotSaveHours'),
          text2: e.message || 'Please try again.',
        });
      }
    }, 800);

    return () => {
      if (hoursSaveTimerRef.current) clearTimeout(hoursSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayWindows]);

  // --- Editing one day's windows -------------------------------------------
  const addWindow = (day) =>
    setDayWindows((prev) => {
      const list = prev[day] ?? [];
      // A new window starts after the last one ends, so the common case —
      // "and we open again in the evening" — needs no editing at all.
      const last = list[list.length - 1];
      const start = last ? last.closes : '09:00';
      const startHour = Math.min(22, parseInt(start.slice(0, 2), 10) + (last ? 1 : 0));
      const opens = `${String(startHour).padStart(2, '0')}:00`;
      const closes = `${String(Math.min(23, startHour + 3)).padStart(2, '0')}:00`;
      return { ...prev, [day]: [...list, { opens, closes }] };
    });

  const removeWindow = (day, index) =>
    setDayWindows((prev) => ({ ...prev, [day]: (prev[day] ?? []).filter((_, i) => i !== index) }));

  const setWindowTime = (day, index, field, value) =>
    setDayWindows((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    }));

  // Which window the native time picker is editing.
  const [windowPickerTarget, setWindowPickerTarget] = useState(null);

  const openWindowPicker = (day, index, field) => {
    setWindowPickerTarget({ day, index, field });
    setShowNativePicker(true);
  };

  const toggleDay = (day) =>
    setDayWindows((prev) =>
      (prev[day] ?? []).length
        ? { ...prev, [day]: [] }
        : { ...prev, [day]: [{ opens: '09:00', closes: '21:00' }] },
    );

  // Prefill details from shop & owner context
  useEffect(() => {
    if (shop) {
      setEditShopName(shop.name || '');
      setEditShopCategories(
        Array.isArray(shop.categories) && shop.categories.length > 0
          ? shop.categories.map((c) => (typeof c === 'string' ? c : c.name || c.id))
          : Array.isArray(shop.category)
            ? shop.category
            : shop.category
              ? [shop.category]
              : ['Groceries']
      );
      setEditShopPhone(shop.contact_phone || shop.phone || owner?.phone || '');
      setEditShopAddress(shop.address_line || shop.address || '');
      setEditBannerUri(shop.banner_url || null);
      setEditLogoUri(shop.logo_url || null);
      // API field names — the mock's online_payment_enabled /
      // is_delivery_charge_enabled / free_delivery_above never existed, so each
      // of these fell back to a hardcoded default regardless of the real value.
      setOnlinePaymentEnabled(shop.online_payments_enabled === true);
      setIsDeliveryChargeEnabled(Number(shop.delivery_fee ?? 0) > 0);
      setDeliveryFee(shop.delivery_fee != null ? String(Math.round(Number(shop.delivery_fee))) : '');
      setFreeDeliveryAbove(
        shop.free_delivery_min != null ? String(Math.round(Number(shop.free_delivery_min))) : ''
      );
    }
    if (owner) {
      setEditOwnerName(owner.full_name || owner.name || '');
      setEditOwnerEmail(owner.email || '');
      setEditOwnerPhone(owner.phone || '');
    }
  }, [shop, owner]);

  // Reset delivery scroll view back to original top position when keyboard closes
  useEffect(() => {
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subscription = Keyboard.addListener(hideEvent, () => {
      if (viewMode === 'delivery') {
        deliveryScrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return () => {
      subscription.remove();
    };
  }, [viewMode]);

  // The picker used to offer CATEGORY_ITEMS — twenty names invented in the app
  // ("Groceries", "Fruits & Vegetables") that match none of the five the server
  // actually has ("Grocery", "Vegetables & Fruits"). Nothing the owner picked
  // could ever resolve to a real category, which is why saving did nothing.
  const [serverCategories, setServerCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.shop
      .listShopCategories()
      .then((res) => {
        if (cancelled) return;
        const list = res?.data ?? res ?? [];
        // Keep the local icon and colour where the name is recognised.
        setServerCategories(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            // How many of this shop's products sit in the section — what makes
            // removing one a warning rather than a silent hole.
            productCount: c.product_count ?? 0,
            icon: CATEGORY_ITEMS.find((i) => i.name === c.name)?.icon ?? Tag,
          })),
        );
      })
      .catch(() => {
        // An empty picker is honest; inventing names is what caused this.
        if (!cancelled) setServerCategories([]);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return serverCategories;
    const q = categorySearchQuery.toLowerCase();
    return serverCategories.filter(item => item.name.toLowerCase().includes(q));
  }, [categorySearchQuery, serverCategories]);

  // Dropping a section the shop still stocks hides those products from anyone
  // browsing that category — the shop keeps selling them and simply stops
  // being found. Say so before it happens.
  const removeShopCategory = useCallback(
    (name) => {
      const drop = () => setEditShopCategories((prev) => prev.filter((c) => c !== name));
      const count = serverCategories.find((c) => c.name === name)?.productCount ?? 0;
      if (count === 0) return drop();
      Alert.alert(
        t('removeSectionTitle', { section: name }),
        t('removeSectionBody', { section: name, count }),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          { text: t('removeSectionConfirm'), style: 'destructive', onPress: drop },
        ],
      );
    },
    [serverCategories, t],
  );

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

  const handleSaveOwner = async () => {
    setProfileErrors({});
    if (!editOwnerName.trim()) {
      failProfile(ownerScrollRef, 'ownerName', 'Enter the owner\u2019s full name.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (editOwnerEmail.trim() && !emailRegex.test(editOwnerEmail.trim())) {
      failProfile(ownerScrollRef, 'ownerEmail', 'Enter a valid email address, e.g. name@domain.com.');
      return;
    }

    setSavingShop(true);
    try {
      // PATCH /owner/me — phone is locked server-side and is not sent.
      const updated = await api.auth.updateOwnerProfile({
        full_name: editOwnerName.trim(),
        email: editOwnerEmail.trim() || undefined,
      });
      if (updateOwnerState) {
        await updateOwnerState(updated);
      }

      Toast.show({
        type: 'success',
        text1: t('personalSavedTitle'),
        text2: t('personalSavedSub'),
      });
      setViewMode('more');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingShop(false);
    }
  };

  const handleSaveShop = async () => {
    setProfileErrors({});
    if (!editShopName.trim()) {
      failProfile(editShopScrollRef, 'shopName', 'Enter the shop name.');
      return;
    }

    if (!editShopCategories || editShopCategories.length === 0) {
      failProfile(editShopScrollRef, 'shopCategory', 'Choose at least one category.');
      return;
    }

    if (!editShopAddress.trim()) {
      failProfile(editShopScrollRef, 'shopAddress', 'Enter the shop address.');
      return;
    }

    setSavingShop(true);
    try {
      // A newly picked image is a local file URI until it is uploaded. The logo
      // used to be picked and previewed but never uploaded or sent — the field
      // did not exist server-side at all, so it was lost on every save.
      const uploadIfLocal = async (uri) => {
        if (!uri) return null;
        if (/^https?:/i.test(uri)) return uri;
        const uploaded = await api.platform.uploadImage({ uri }).catch((err) => {
          console.error('[Profile] image upload failed', err);
          return null;
        });
        return uploaded?.url ?? null;
      };

      const [banner_url, logo_url] = await Promise.all([
        uploadIfLocal(editBannerUri),
        uploadIfLocal(editLogoUri),
      ]);

      if (editLogoUri && !logo_url) {
        Toast.show({
          type: 'error',
          text1: t('logoNotUploaded'),
          text2: t('logoNotUploadedSub'),
        });
      }

      // The selection is held by name for the chips; the API takes ids.
      const category_ids = editShopCategories
        .map((name) => serverCategories.find((c) => c.name === name)?.id)
        .filter(Boolean);

      await api.shop.updateShop({
        name: editShopName.trim(),
        contact_phone: editShopPhone.trim(),
        address_line: editShopAddress.trim(),
        banner_url,
        logo_url,
        // Previously omitted entirely: the picker validated a selection and
        // then dropped it, so categories could never be changed from here.
        ...(category_ids.length > 0 ? { category_ids } : {}),
      });

      // Online payments live behind their own endpoint, and the server refuses
      // to enable them without bank details on file (409 BANK_DETAILS_REQUIRED).
      let paymentSettingSaved = true;
      await api.shop.setPaymentSettings(onlinePaymentEnabled).catch((err) => {
        paymentSettingSaved = false;
        Toast.show({
          type: 'error',
          text1: t('onlinePaymentsNotEnabled'),
          text2: err.message || 'Add your bank details first.',
        });
      });

      // Re-read and re-seed the switch from the SERVER, so a rejected change
      // snaps back instead of sitting there looking enabled.
      const freshShop = await refreshShop();
      setOnlinePaymentEnabled(freshShop?.online_payments_enabled === true);

      if (!paymentSettingSaved) {
        setSavingShop(false);
        return;
      }

      Toast.show({
        type: 'success',
        text1: t('businessSavedTitle'),
        text2: onlinePaymentEnabled
          ? 'Business details updated. Online payments enabled.'
          : 'Business details updated. Online payments disabled (COD only).',
      });
      setViewMode('more');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingShop(false);
    }
  };

  const handleSaveDelivery = async () => {
    setProfileErrors({});
    if (isDeliveryChargeEnabled) {
      if (!deliveryFee.trim() || isNaN(parseFloat(deliveryFee))) {
        failProfile(deliveryScrollRef, 'deliveryFee', 'Enter the delivery charge as a number.');
        return;
      }
      if (!freeDeliveryAbove.trim() || isNaN(parseFloat(freeDeliveryAbove))) {
        failProfile(deliveryScrollRef, 'freeDeliveryAbove', 'Enter the free-delivery amount as a number.');
        return;
      }
    }

    setSavingDelivery(true);
    try {
      // PATCH /owner/shop. Turning the charge off is stored as a fee of 0 —
      // there is no separate on/off flag server-side, and 0 is what the cart
      // and checkout both read.
      await api.shop.updateShop({
        delivery_fee: isDeliveryChargeEnabled ? parseFloat(deliveryFee) || 0 : 0,
        free_delivery_min: isDeliveryChargeEnabled ? parseFloat(freeDeliveryAbove) || 0 : 0,
      });
      await refreshShop();

      Toast.show({
        type: 'success',
        text1: t('deliverySavedTitle'),
        text2: isDeliveryChargeEnabled
          ? t('deliveryChargeEnabledToast', { fee: deliveryFee, threshold: freeDeliveryAbove })
          : t('deliveryChargeDisabledToast'),
      });
      setViewMode('more');
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('saveErrorTitle'),
        text2: t('deliverySaveFailed'),
      });
    } finally {
      setSavingDelivery(false);
    }
  };

  // Opens the deletion REQUEST flow: review → OTP → account locked pending
  // admin review. Nothing is deleted from here.
  const handleDeleteAccount = () => {
    navigation.navigate('DeleteAccount');
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
            <Text style={styles.storeNameText}>{shop?.name || 'Your Shop'}</Text>
            <Text style={styles.storeAddressText}>Category: {shop?.category || 'Groceries'}</Text>
            {/* Reports the real subscription state. This used to read
                "Gold Partner Plan" unconditionally, so an expired shop —
                already hidden from customers — still looked subscribed. */}
            <View
              style={[
                styles.planBadge,
                subscription?.state === 'expired' && { backgroundColor: '#FEE2E2' },
                subscription?.state === 'trial' && { backgroundColor: '#DBEAFE' },
              ]}
            >
              <Award color={planBadgeTone.fg} size={14} style={{ marginRight: 4 }} />
              <Text style={[styles.planBadgeText, { color: planBadgeTone.fg }]}>{planBadgeTone.label}</Text>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <Text style={styles.menuSectionHeader}>{t('storeConfiguration', 'Store Configuration')}</Text>
            
            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('edit_personal')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#E0F2FE' }]}>
                <User color="#0284C7" size={20} />
              </View>
              <Text style={styles.menuLabel}>{t('personalDetails', 'Personal Details')}</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('edit_shop')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#DCFCE7' }]}>
                <Settings color={theme.colors.primary} size={20} />
              </View>
              <Text style={styles.menuLabel}>{t('businessProfile', 'Business Profile')}</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('hours')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#DBEAFE' }]}>
                <Clock color="#2563EB" size={20} />
              </View>
              <Text style={styles.menuLabel}>{t('storeWorkingHours', 'Store Working Hours')}</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setViewMode('delivery')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEE2E2' }]}>
                <Truck color="#EF4444" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{t('deliveryChargesSettings', 'Delivery Charges & Free Threshold')}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textLight, fontWeight: '600', marginTop: 1 }}>
                  {isDeliveryChargeEnabled
                    ? t('deliveryChargeSummary', { fee: deliveryFee, threshold: freeDeliveryAbove })
                    : t('freeDeliveryEnabledShort')}
                </Text>
              </View>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            {/* Subscriptions took Khata's place in the bottom bar, so Khata
                takes its place here. The count is the number of customers
                waiting on an approve/reject — it stays until each is decided,
                so opening this screen does not make it go away. */}
            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Customers')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                <BookOpen color="#B45309" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{t('tabKhata', 'Khata')}</Text>
                <Text style={styles.menuSubLabel}>
                  {pendingKhataCount > 0
                    ? t('khataMenuSubPending', 'Waiting for your approval')
                    : t('khataMenuSub', 'Udhari, repayments and order history')}
                </Text>
              </View>
              {pendingKhataCount > 0 ? (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>
                    {pendingKhataCount > 99 ? '99+' : pendingKhataCount}
                  </Text>
                </View>
              ) : null}
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('DeliveryArea')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#DBEAFE' }]}>
                <Sliders color="#2563EB" size={20} />
              </View>
              <Text style={styles.menuLabel}>{t('deliveryRouteSettings', 'Delivery Route Settings')}</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            {/* Its own screen rather than a viewMode: paying means holding a
                poll open while the webhook lands, and this screen resets
                viewMode on tab press, which would kill it mid-payment. */}
            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('SubscriptionPayment')}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Award color="#D97706" size={20} />
              </View>
              <Text style={styles.menuLabel}>{t('partnerSubscriptionPlan', 'Partner Subscription Plan')}</Text>
              <ChevronRight color={theme.colors.textLight} size={20} />
            </TouchableOpacity>

            <View style={styles.inlineLangCard}>
              <View style={styles.inlineLangHeaderRow}>
                <View style={[styles.menuIconBg, { backgroundColor: '#DCFCE7' }]}>
                  <Globe color={theme.colors.primary} size={20} />
                </View>
                <Text style={styles.menuLabel}>{t('appLanguage', 'App Language')}</Text>
              </View>
              
              <View style={styles.langPillsRow}>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = appLanguage === lang.id;
                  return (
                    <TouchableOpacity
                      key={lang.id}
                      style={[styles.langPillBtn, isSelected && styles.langPillBtnActive]}
                      onPress={() => setAppLanguage(lang.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.langPillFlag}>{lang.flag}</Text>
                      <Text 
                        style={[styles.langPillText, isSelected && styles.langPillTextActive]}
                        numberOfLines={1}
                      >
                        {lang.nativeName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { marginTop: 20 }]} />

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <LogOut color="#FFF" size={16} style={{ marginRight: 6 }} />
              <Text style={styles.logoutBtnText}>{t('logoutAccount', 'Logout Account')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
              <Trash2 color={theme.colors.error} size={16} style={{ marginRight: 6 }} />
              <Text style={styles.deleteAccountBtnText}>{t('deleteAccount', 'Delete Account')}</Text>
            </TouchableOpacity>

            <View style={styles.appVersionFooter}>
              <Text style={styles.appVersionText}>{t('ownerAppVersion', { version: '1.0.0', build: '102' })}</Text>
              <Text style={styles.appCopyrightText}>© 2026 Partner Suite. All rights reserved.</Text>
            </View>
          </View>
        </ScrollView>

        {/* App Language Selection Modal */}
        <Modal
          visible={languageModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setLanguageModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.langModalOverlay}
            activeOpacity={1}
            onPress={() => setLanguageModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.langModalCard, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
              onPress={(e) => e.stopPropagation?.()}
            >
              <View style={styles.langModalHeader}>
                <View style={styles.langTitleRow}>
                  <Globe color="#7E22CE" size={22} style={{ marginRight: 8 }} />
                  <Text style={styles.langModalTitle}>{t('selectAppLanguage', 'Select App Language')}</Text>
                </View>
                <TouchableOpacity onPress={() => setLanguageModalVisible(false)} style={styles.langCloseBtn}>
                  <X color={theme.colors.textLight} size={20} />
                </TouchableOpacity>
              </View>

              <Text style={styles.langModalSubtitle}>
                {t('chooseLanguageSub', 'Choose your preferred language for the merchant app interface.')}
              </Text>

              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = appLanguage === lang.id;
                return (
                  <TouchableOpacity
                    key={lang.id}
                    style={[styles.langOptionItem, isSelected && styles.langOptionItemActive]}
                    onPress={() => {
                      setAppLanguage(lang.id);
                      setLanguageModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.langSymbolCircle, isSelected && styles.langSymbolCircleActive]}>
                      <Text style={[styles.langSymbolText, isSelected && styles.langSymbolTextActive]}>
                        {lang.symbol}
                      </Text>
                    </View>
                    
                    <View style={styles.langTextDetails}>
                      <Text style={[styles.langNativeTitle, isSelected && styles.langNativeTitleActive]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={styles.langEnglishSub}>{lang.name}</Text>
                    </View>

                    <View style={[styles.langRadioOuter, isSelected && styles.langRadioOuterActive]}>
                      {isSelected && <View style={styles.langRadioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </View>
    );
  }

  // VIEW MODE: EDIT PERSONAL DETAILS
  if (viewMode === 'edit_personal') {
    return (
      <View style={styles.container}>
        {renderHeader(t('personalDetails'))}
        <ScrollView ref={ownerScrollRef} style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.formSectionTitle, { marginTop: 0 }]}>{t('ownerPersonalDetails')}</Text>
          
          <View style={styles.inputGroup} onLayout={captureProfileY('ownerName')}>
            <Text style={styles.fieldLabel}>{t('ownerFullName')}</Text>
            <TextInput
              style={[styles.fieldInput, profileErrors.ownerName && styles.fieldInputError]}
              value={editOwnerName}
              onChangeText={(v) => { setEditOwnerName(v); clearProfileError('ownerName'); }}
              placeholder={t('ownerFullNamePlaceholder')}
              placeholderTextColor={theme.colors.textLight}
            />
            {profileErrors.ownerName ? <Text style={styles.fieldErrorText}>{profileErrors.ownerName}</Text> : null}
          </View>

          <View style={styles.inputGroup} onLayout={captureProfileY('ownerEmail')}>
            <Text style={styles.fieldLabel}>{t('ownerEmail')}</Text>
            <TextInput
              style={[styles.fieldInput, profileErrors.ownerEmail && styles.fieldInputError]}
              value={editOwnerEmail}
              onChangeText={(v) => { setEditOwnerEmail(v); clearProfileError('ownerEmail'); }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={t('ownerEmailPlaceholder')}
              placeholderTextColor={theme.colors.textLight}
            />
            {profileErrors.ownerEmail ? <Text style={styles.fieldErrorText}>{profileErrors.ownerEmail}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>{t('registeredMobile')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editOwnerPhone}
              onChangeText={setEditOwnerPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 9876543210"
              placeholderTextColor={theme.colors.textLight}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveOwner} disabled={savingShop}>
            {savingShop ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t('savePersonalDetails')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // VIEW MODE: EDIT BUSINESS PROFILE
  if (viewMode === 'edit_shop') {
    return (
      <View style={styles.container}>
        {renderHeader(t('businessProfile'))}
        {/* KeyboardAvoidingView was inert on Android (behavior undefined), so
            the fields low in this form stayed under the keyboard. */}
        <KeyboardAwareForm
          ref={editShopScrollRef}
          style={styles.formScroll}
          // The tab bar sits below this screen, not over it, and already owns the
          // home-indicator inset; the keyboard's space is added by the form
          // itself. So a normal gap is enough — 180+inset left ~230pt of blank
          // below Save on iOS. The open category list still needs its room.
          contentContainerStyle={{ paddingBottom: isCategoryOpen ? 320 : 32 }}
        >
            <TouchableWithoutFeedback
              onPress={() => {
                // This wrapper claims every tap on empty space, so under
                // keyboardShouldPersistTaps="handled" the scroll view never
                // dismisses the keyboard itself — it has to happen here.
                Keyboard.dismiss();
                if (isCategoryOpen) {
                  setIsCategoryOpen(false);
                  setCategorySearchQuery('');
                }
              }}
              accessible={false}
            >
              <View>
                <Text style={[styles.formSectionTitle, { marginTop: 0 }]}>{t('shopBusinessDetails')}</Text>

                <Text style={[styles.formSectionTitle, { fontSize: 13, color: theme.colors.textLight, marginTop: 4 }]}>{t('coverBanner')}</Text>
                {editBannerUri ? (
                  <View style={styles.bannerContainer}>
                    <Image source={{ uri: editBannerUri }} style={styles.bannerImg} />
                    <TouchableOpacity style={styles.changeBannerBtn} onPress={() => handleSelectPhoto('banner')}>
                      <Text style={styles.changeBannerText}>{t('changeCover')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.bannerPlaceholder} onPress={() => handleSelectPhoto('banner')}>
                    <ImageIcon color={theme.colors.primary} size={28} />
                    <Text style={styles.bannerPlaceholderText}>{t('selectCoverImage')}</Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.formSectionTitle, { fontSize: 13, color: theme.colors.textLight, marginTop: 14 }]}>{t('storeLogoIcon')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                  <View style={styles.logoPreviewBox}>
                    {editLogoUri ? (
                      <Image source={{ uri: editLogoUri }} style={styles.logoPreviewImg} />
                    ) : (
                      <Text style={styles.logoPreviewTxt}>{editShopName.charAt(0) || 'S'}</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.uploadLogoBtn} onPress={() => handleSelectPhoto('logo')}>
                    <Text style={styles.uploadLogoText}>{t('uploadCustomLogo')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup} onLayout={captureProfileY('shopName')}>
                  <Text style={styles.fieldLabel}>{t('shopNameLabel')}</Text>
                  <TextInput
                    style={[styles.fieldInput, profileErrors.shopName && styles.fieldInputError]}
                    value={editShopName}
                    onChangeText={(v) => { setEditShopName(v); clearProfileError('shopName'); }}
                    placeholder={t('shopNamePlaceholder')}
                    placeholderTextColor={theme.colors.textLight}
                    onFocus={() => {
                      setTimeout(() => {
                        editShopScrollRef.current?.scrollTo({ y: 140, animated: true });
                      }, 100);
                    }}
                  />
                  {profileErrors.shopName ? <Text style={styles.fieldErrorText}>{profileErrors.shopName}</Text> : null}
                </View>

                <View style={styles.inputGroup} onLayout={captureProfileY('shopCategory')}>
                  <Text style={styles.fieldLabel}>{t('shopBusinessCategories')}</Text>

                  {editShopCategories.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {editShopCategories.map((catName) => (
                        <TouchableOpacity
                          key={catName}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#DCFCE7',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: theme.colors.primary,
                          }}
                          onPress={() => removeShopCategory(catName)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D' }}>{catName}</Text>
                          <X color={theme.colors.primary} size={14} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {profileErrors.shopCategory ? <Text style={styles.fieldErrorText}>{profileErrors.shopCategory}</Text> : null}
                </View>
                  )}

                  <TouchableOpacity
                    style={[styles.fieldInput, styles.categorySelectContainer, isCategoryOpen && styles.categorySelectContainerFocused]}
                    activeOpacity={0.8}
                    onPress={() => {
                      const nextState = !isCategoryOpen;
                      setIsCategoryOpen(nextState);
                      if (nextState) {
                        setTimeout(() => {
                          editShopScrollRef.current?.scrollTo({ y: 320, animated: true });
                        }, 100);
                      } else {
                        setCategorySearchQuery('');
                      }
                    }}
                  >
                    <Tag color={theme.colors.primary} size={18} style={{ marginRight: 8 }} />
                    <Text style={[styles.categorySelectText, editShopCategories.length === 0 && { color: theme.colors.textLight }]} numberOfLines={1}>
                      {editShopCategories.length > 0
                        ? `${editShopCategories.length} Categor${editShopCategories.length > 1 ? 'ies' : 'y'} Selected`
                        : 'Select Categories'}
                    </Text>
                    {isCategoryOpen ? (
                      <ChevronUp color={theme.colors.primary} size={20} />
                    ) : (
                      <ChevronDown color={theme.colors.textDark} size={20} />
                    )}
                  </TouchableOpacity>

                  {/* Inline Searchable Dropdown */}
                  {isCategoryOpen && (
                    <View style={styles.inlineCategoryDropdown}>
                      <View style={styles.categorySearchContainer}>
                        <Search color={theme.colors.primary} size={18} style={styles.categorySearchIcon} />
                        <TextInput
                          style={styles.categorySearchInput}
                          placeholder={t('searchCategoryPlaceholder')}
                          placeholderTextColor="#94A3B8"
                          value={categorySearchQuery}
                          onChangeText={setCategorySearchQuery}
                          autoFocus={true}
                        />
                        {categorySearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                            <X color="#94A3B8" size={18} style={{ marginRight: 8 }} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <ScrollView style={styles.inlineCategoryList} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                        {filteredCategories.map((item) => {
                          const isSelected = editShopCategories.includes(item.name);
                          const IconComp = item.icon || Tag;
                          const catColors = getCategoryColor(item.name);
                          return (
                            <TouchableOpacity
                              key={item.name}
                              style={[styles.inlineCategoryItem, isSelected && styles.inlineCategoryItemSelected]}
                              onPress={() => {
                                clearProfileError('shopCategory');
                                if (editShopCategories.includes(item.name)) {
                                  removeShopCategory(item.name);
                                } else {
                                  setEditShopCategories((prev) => [...prev, item.name]);
                                }
                              }}
                            >
                              <View style={styles.inlineCategoryItemLeft}>
                                <View style={[styles.categoryInlineIcon, { backgroundColor: isSelected ? '#DCFCE7' : catColors.bg }]}>
                                  <IconComp color={isSelected ? theme.colors.primary : catColors.text} size={16} />
                                </View>
                                <Text style={[styles.inlineCategoryItemText, isSelected && styles.inlineCategoryItemTextSelected]}>
                                  {item.name}
                                </Text>
                              </View>
                              {isSelected ? (
                                <Check color={theme.colors.primary} size={16} strokeWidth={3} />
                              ) : (
                                <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#CBD5E1' }} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <TouchableOpacity
                        style={{
                          backgroundColor: theme.colors.primary,
                          paddingVertical: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => {
                          setIsCategoryOpen(false);
                          setCategorySearchQuery('');
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                          Done ({editShopCategories.length} selected)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>{t('shopSupportPhone')}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editShopPhone}
                    onChangeText={setEditShopPhone}
                    keyboardType="phone-pad"
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={theme.colors.textLight}
                    onFocus={() => {
                      setTimeout(() => {
                        editShopScrollRef.current?.scrollTo({ y: 380, animated: true });
                      }, 100);
                    }}
                  />
                </View>

                <View style={styles.inputGroup} onLayout={captureProfileY('shopAddress')}>
                  <Text style={styles.fieldLabel}>{t('businessAddress')}</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }, profileErrors.shopAddress && styles.fieldInputError]}
                    multiline={true}
                    numberOfLines={3}
                    value={editShopAddress}
                    onChangeText={(v) => { setEditShopAddress(v); clearProfileError('shopAddress'); }}
                    placeholder={t('businessAddressPlaceholder')}
                    onFocus={() => {
                      setTimeout(() => {
                        editShopScrollRef.current?.scrollTo({ y: 480, animated: true });
                      }, 100);
                    }}
                  />
                  {profileErrors.shopAddress ? <Text style={styles.fieldErrorText}>{profileErrors.shopAddress}</Text> : null}
                </View>

                {/* Online Payment Option Toggle Card */}
                {/* <Text style={[styles.formSectionTitle, { marginTop: 16 }]}>{t('storePaymentOptions')}</Text>
                <View style={styles.paymentSettingCard}>
                  <View style={styles.paymentSettingHeaderRow}>
                    <View style={styles.paymentSettingIconBg}>
                      <CreditCard color={onlinePaymentEnabled ? '#16A34A' : '#64748B'} size={20} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.paymentSettingTitle}>{t('onlinePaymentAcceptance')}</Text>
                      <Text style={styles.paymentSettingSub}>
                        {t('onlinePaymentModes')}
                      </Text>
                    </View>
                    <Switch
                      trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                      thumbColor={onlinePaymentEnabled ? '#16A34A' : '#64748B'}
                      ios_backgroundColor="#CBD5E1"
                      onValueChange={setOnlinePaymentEnabled}
                      value={onlinePaymentEnabled}
                    />
                  </View>

                  <View style={[
                    styles.paymentSettingStatusBox,
                    {
                      backgroundColor: onlinePaymentEnabled ? '#F0FDF4' : '#F8FAFC',
                      borderColor: onlinePaymentEnabled ? '#86EFAC' : '#E2E8F0',
                    }
                  ]}>
                    <Text style={[styles.paymentSettingStatusText, { color: onlinePaymentEnabled ? '#15803D' : '#475569' }]}>
                      {onlinePaymentEnabled
                        ? '✅ Online Payments Enabled: Customers can pay online via UPI, Credit/Debit Cards, or NetBanking at checkout.'
                        : '🔒 Online Payments Disabled: Customers can only choose Cash on Delivery (COD) or Khata Udhar at checkout.'}
                    </Text>
                  </View>
                </View> */}

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveShop} disabled={savingShop}>
                  {savingShop ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('saveBusinessProfile')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
        </KeyboardAwareForm>
      </View>
    );
  }

  // VIEW MODE: HOURS CONFIGURATION
  if (viewMode === 'hours') {
    return (
      <View style={styles.container}>
        {renderHeader(t('storeHoursSettings'))}
        <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 30 : 45 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitleLabel}>
            {t('hoursIntro')}
          </Text>

          {DAY_NAMES.map((day, dayIndex) => {
            const windows = dayWindows[day] ?? [];
            const isOpen = windows.length > 0;
            return (
              <View key={day} style={styles.dayCard}>
                <View style={styles.dayCardHead}>
                  <Text style={styles.dayName}>{t(`dayName${dayIndex}`)}</Text>
                  <Text style={[styles.dayState, isOpen ? styles.dayStateOpen : styles.dayStateShut]}>
                    {isOpen ? t('openLabel') : t('closedLabel')}
                  </Text>
                  <Switch
                    value={isOpen}
                    onValueChange={() => toggleDay(day)}
                    trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }}
                    thumbColor={isOpen ? theme.colors.primary : '#F1F5F9'}
                  />
                </View>

                {windows.map((w, index) => (
                  <View key={index} style={styles.windowRow}>
                    <TouchableOpacity
                      style={styles.windowTimeBtn}
                      onPress={() => openWindowPicker(day, index, 'opens')}
                      activeOpacity={0.7}
                    >
                      <Clock size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.windowTimeText}>{to12h(w.opens)}</Text>
                    </TouchableOpacity>

                    <Text style={styles.windowDash}>to</Text>

                    <TouchableOpacity
                      style={styles.windowTimeBtn}
                      onPress={() => openWindowPicker(day, index, 'closes')}
                      activeOpacity={0.7}
                    >
                      <Clock size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.windowTimeText}>{to12h(w.closes)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.windowRemove}
                      onPress={() => removeWindow(day, index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {isOpen ? (
                  <TouchableOpacity style={styles.addWindowBtn} onPress={() => addWindow(day)}>
                    <Text style={styles.addWindowText}>+ Add another time</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          {/* No Save button: changes save themselves. This only reports where
              that stands, so the owner is never left guessing. */}
          <View style={styles.hoursAutosaveRow}>
            {hoursSaveState === 'saving' ? (
              <>
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.hoursAutosaveText}>{t('savingHours')}</Text>
              </>
            ) : hoursSaveState === 'error' ? (
              <Text style={[styles.hoursAutosaveText, { color: theme.colors.error }]}>
                {t('hoursNotSaved')}
              </Text>
            ) : hoursSaveState === 'saved' ? (
              <Text style={[styles.hoursAutosaveText, { color: '#15803D' }]}>
                {t('hoursSaved')}
              </Text>
            ) : (
              <Text style={styles.hoursAutosaveText}>
                {t('hoursAutoSave')}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Built-in Native Platform Time Picker */}
        {showNativePicker && (
          <DateTimePicker
            value={(() => {
              // Seed the picker with the time being edited so it opens on the
              // current value rather than jumping to a default.
              if (!windowPickerTarget) return openTimeDate;
              const w = (dayWindows[windowPickerTarget.day] ?? [])[windowPickerTarget.index];
              return from24h(w?.[windowPickerTarget.field], 9).date;
            })()}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'android' ? 'default' : 'spinner'}
            onChange={windowPickerTarget ? handleWindowTimeChange : handleNativeTimeChange}
          />
        )}
      </View>
    );
  }

  // VIEW MODE: DELIVERY CHARGES & THRESHOLD SETTINGS
  if (viewMode === 'delivery') {
    return (
      <View style={styles.container}>
        {renderHeader(t('deliveryChargesSettings', 'Delivery Charges & Free Threshold'))}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView
            ref={deliveryScrollRef}
            style={styles.formScroll}
            contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 220 : 250 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
          >
            <Text style={styles.subtitleLabel}>{t('deliveryChargesSubtitle', 'Configure home delivery charges & free delivery thresholds')}</Text>

            {/* Toggle Switch Card */}
            <View style={styles.deliveryCard}>
              <View style={styles.deliveryToggleHeader}>
                <View style={[styles.menuIconBg, { backgroundColor: isDeliveryChargeEnabled ? '#DCFCE7' : '#F1F5F9' }]}>
                  <Truck color={isDeliveryChargeEnabled ? '#16A34A' : '#64748B'} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.deliveryToggleTitle}>{t('chargeForHomeDelivery', 'Charge for Home Delivery')}</Text>
                  <Text style={styles.deliveryToggleSub}>
                    {isDeliveryChargeEnabled
                      ? t('chargeForHomeDeliveryOn', 'Customers pay a delivery fee on orders below free threshold')
                      : t('chargeForHomeDeliveryOff', 'All home deliveries are 100% FREE for customers')}
                  </Text>
                </View>
                <Switch
                  value={isDeliveryChargeEnabled}
                  onValueChange={setIsDeliveryChargeEnabled}
                  trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                  thumbColor={isDeliveryChargeEnabled ? '#16A34A' : '#F8FAFC'}
                />
              </View>

              <View style={styles.statusPillBox}>
                <View style={[styles.statusDot, { backgroundColor: isDeliveryChargeEnabled ? '#16A34A' : '#3B82F6' }]} />
                <Text style={styles.statusPillText}>
                  {isDeliveryChargeEnabled
                    ? t('deliveryChargeActive', 'Delivery Charge Active: ₹{fee} per order').replace('{fee}', deliveryFee)
                    : t('freeDeliveryModeActive', '100% Free Delivery Mode Active')}
                </Text>
              </View>
            </View>

            {/* Delivery Fee & Free Delivery Threshold Inputs (if enabled) */}
            {isDeliveryChargeEnabled ? (
              <View style={styles.deliveryInputsSection}>
                <View style={styles.inputGroup} onLayout={captureProfileY('deliveryFee')}>
                  <Text style={styles.fieldLabel}>{t('deliveryChargeAmount', 'Delivery Charge Amount (₹)')}</Text>
                  <Text style={styles.fieldHint}>{t('deliveryChargeAmountHint', 'Flat fee added to delivery orders that do not qualify for free shipping')}</Text>
                  <View style={styles.inputWithIcon}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={[styles.fieldInputWithPrefix, profileErrors.deliveryFee && styles.fieldInputError]}
                      keyboardType="numeric"
                      placeholder="e.g. 30"
                      placeholderTextColor={theme.colors.textLight}
                      value={deliveryFee}
                      onChangeText={(v) => { setDeliveryFee(v); clearProfileError('deliveryFee'); }}
                      onFocus={() => {
                        setTimeout(() => {
                          deliveryScrollRef.current?.scrollTo({ y: 110, animated: true });
                        }, 100);
                      }}
                      onBlur={() => {
                        deliveryScrollRef.current?.scrollTo({ y: 0, animated: true });
                      }}
                    />
                  </View>
                  {profileErrors.deliveryFee ? <Text style={styles.fieldErrorText}>{profileErrors.deliveryFee}</Text> : null}
                </View>

                <View style={styles.inputGroup} onLayout={captureProfileY('freeDeliveryAbove')}>
                  <Text style={styles.fieldLabel}>{t('minOrderForFreeDelivery', 'Minimum Order Amount for Free Delivery (₹)')}</Text>
                  <Text style={styles.fieldHint}>{t('minOrderForFreeDeliveryHint', 'Orders equal to or above this total get 100% FREE delivery automatically')}</Text>
                  <View style={styles.inputWithIcon}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={[styles.fieldInputWithPrefix, profileErrors.freeDeliveryAbove && styles.fieldInputError]}
                      keyboardType="numeric"
                      placeholder="e.g. 500"
                      placeholderTextColor={theme.colors.textLight}
                      value={freeDeliveryAbove}
                      onChangeText={(v) => { setFreeDeliveryAbove(v); clearProfileError('freeDeliveryAbove'); }}
                      onFocus={() => {
                        setTimeout(() => {
                          deliveryScrollRef.current?.scrollTo({ y: 220, animated: true });
                        }, 100);
                      }}
                      onBlur={() => {
                        deliveryScrollRef.current?.scrollTo({ y: 0, animated: true });
                      }}
                    />
                  </View>
                  {profileErrors.freeDeliveryAbove ? <Text style={styles.fieldErrorText}>{profileErrors.freeDeliveryAbove}</Text> : null}
                </View>
              </View>
            ) : (
              <View style={styles.freeDeliveryBanner}>
                <Sparkles color="#16A34A" size={24} style={{ marginBottom: 6 }} />
                <Text style={styles.freeDeliveryBannerTitle}>{t('freeDeliveryEnabledBanner', 'Free Delivery Enabled!')}</Text>
                <Text style={styles.freeDeliveryBannerText}>
                  {t('freeDeliveryNote')}
                </Text>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSaveDelivery}
              disabled={savingDelivery}
              activeOpacity={0.8}
            >
              {savingDelivery ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t('saveDeliverySettings', 'Save Delivery Settings')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // The plan mockup that used to live here (a hardcoded ₹200 card whose
  // Subscribe button only fired a success toast, without invoicing or charging
  // anything) is gone — SubscriptionPaymentScreen is the real thing.

  return null;
};

const styles = StyleSheet.create({
  menuSubLabel: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginTop: 1,
  },
  menuBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  fieldInputError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  fieldErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 6,
  },
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
    height: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoutBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
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
  categorySelectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categorySelectContainerFocused: {
    borderColor: theme.colors.primary,
  },
  categorySelectText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  inlineCategoryDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    marginTop: 8,
    maxHeight: 260,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  categorySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  categorySearchIcon: {
    marginRight: 10,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 4,
  },
  inlineCategoryList: {
    maxHeight: 200,
  },
  inlineCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inlineCategoryItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  inlineCategoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryInlineIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inlineCategoryItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  inlineCategoryItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '800',
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
  dayCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  dayCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayState: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
  },
  dayStateOpen: { color: theme.colors.primary },
  dayStateShut: { color: theme.colors.textLight },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  windowTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.primaryLight,
  },
  windowTimeText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  windowDash: {
    marginHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  windowRemove: {
    paddingLeft: 10,
  },
  addWindowBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWindowText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  hoursAutosaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  hoursAutosaveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
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
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    height: 42,
    borderRadius: 14,
    marginTop: 2,
  },
  deleteAccountBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.error,
  },
  appVersionFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  appVersionText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: 0.3,
  },
  appCopyrightText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  customDeleteModalCard: {
    width: '88%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.medium,
    elevation: 8,
    position: 'relative',
  },
  closeModalCross: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  deleteModalIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteModalBody: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteModalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    marginRight: 8,
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  deleteModalConfirmBtn: {
    flex: 1.3,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inlineLangCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  inlineLangHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  langPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langPillBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  langPillBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    elevation: 3,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  langPillFlag: {
    fontSize: 14,
    marginRight: 4,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  langPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  langModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  langModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  langTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  langCloseBtn: {
    padding: 4,
  },
  langModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 16,
  },
  langOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  langOptionItemActive: {
    backgroundColor: '#DCFCE7',
    borderColor: theme.colors.primary,
  },
  langSymbolCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  langSymbolCircleActive: {
    backgroundColor: theme.colors.primary,
  },
  langSymbolText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
  },
  langSymbolTextActive: {
    color: '#FFFFFF',
  },
  langTextDetails: {
    flex: 1,
  },
  langNativeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  langNativeTitleActive: {
    color: theme.colors.primaryDark,
  },
  langEnglishSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  langRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRadioOuterActive: {
    borderColor: theme.colors.primary,
  },
  langRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },

  // Payment Option Setting Styles
  paymentSettingCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    marginTop: 4,
    ...theme.shadows.soft,
  },
  paymentSettingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentSettingIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSettingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  paymentSettingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  paymentSettingStatusBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  paymentSettingStatusText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },

  // Delivery Settings Card & Field Styles
  deliveryCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    marginTop: 4,
    ...theme.shadows.soft,
  },
  deliveryToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryToggleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  deliveryToggleSub: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 2,
    paddingRight: 6,
  },
  statusPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  deliveryInputsSection: {
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginBottom: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginRight: 8,
  },
  fieldInputWithPrefix: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    height: '100%',
    paddingVertical: 0,
  },
  freeDeliveryBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  freeDeliveryBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
  },
  freeDeliveryBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 18,
  },
});
