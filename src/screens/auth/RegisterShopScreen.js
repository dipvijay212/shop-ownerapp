import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, Platform, Dimensions, ScrollView, Modal, BackHandler, StatusBar, Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { AuthContext } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import {
  Store, User, MapPin, Mail, ArrowLeft, Image as ImageIcon, Map, Trash2, Undo, Save, CheckCircle,
  Phone, ChevronDown, ChevronUp, Tag, Check, X, Maximize2, Minimize2, Search, Compass, Upload
} from 'lucide-react-native';
import MapView, { Marker, Polygon, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { launchImageLibrary } from 'react-native-image-picker';
import { getCurrentLocation } from '../../utils/location';
import { getCategoryColor, getCategoryIcon } from '../../constants/shopCategories';
import { api } from '../../api';
import { useTranslation } from '../../constants/translations';
import { useFormErrors } from '../../hooks/useFormErrors';

const { width, height } = Dimensions.get('window');

const DEFAULT_CENTER = {
  latitude: 21.2401,
  longitude: 72.8735,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

const makeCircleGeoJson = (latitude, longitude, radiusKm) => {
  if (!latitude || !longitude || !radiusKm) return null;
  const points = 64;
  const coords = [];
  const distance = radiusKm / 6371; // Earth's radius in km
  
  const latRad = (latitude * Math.PI) / 180;
  const lngRad = (longitude * Math.PI) / 180;
  
  for (let i = 0; i < points; i++) {
    const theta = (i * 2 * Math.PI) / points;
    const lat = Math.asin(Math.sin(latRad) * Math.cos(distance) + Math.cos(latRad) * Math.sin(distance) * Math.cos(theta));
    const lng = lngRad + Math.atan2(Math.sin(theta) * Math.sin(distance) * Math.cos(latRad), Math.cos(distance) - Math.sin(latRad) * Math.sin(lat));
    
    coords.push([
      (lng * 180) / Math.PI,
      (lat * 180) / Math.PI
    ]);
  }
  coords.push(coords[0]);
  
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
};

const getCirclePoints = (latitude, longitude, radiusKm) => {
  if (!latitude || !longitude || !radiusKm) return [];
  const points = 32;
  const coords = [];
  const distance = radiusKm / 6371; 
  
  const latRad = (latitude * Math.PI) / 180;
  const lngRad = (longitude * Math.PI) / 180;
  
  for (let i = 0; i < points; i++) {
    const theta = (i * 2 * Math.PI) / points;
    const lat = Math.asin(Math.sin(latRad) * Math.cos(distance) + Math.cos(latRad) * Math.sin(distance) * Math.cos(theta));
    const lng = lngRad + Math.atan2(Math.sin(theta) * Math.sin(distance) * Math.cos(latRad), Math.cos(distance) - Math.sin(latRad) * Math.sin(lat));
    
    coords.push({
      latitude: (lat * 180) / Math.PI,
      longitude: (lng * 180) / Math.PI,
    });
  }
  return coords;
};

export const RegisterShopScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const { registerShop, logout, owner } = useContext(AuthContext);

  // Route params only exist on the AuthStack path (straight after OTP). When
  // RootNavigator mounts this screen for a signed-in owner there are none, and
  // the old fallback showed a hardcoded '9876543210' next to the label
  // "Mobile Number (Verified)" — a number the owner never entered. The verified
  // profile is the real source.
  const phone = route.params?.phone || owner?.phone || '';
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState(1);

  // --- STEP 1: Personal Details ---
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // --- STEP 2: Shop Details ---
  const [shopName, setShopName] = useState('');
  // Ids, not names: createShop() takes category_ids from the master, and the
  // names are only ever used for display.
  const [shopCategoryIds, setShopCategoryIds] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const list = await api.shop.listShopCategories();
      setCategoryOptions(list || []);
    } catch (e) {
      // Step 2 cannot be completed without this, so surface it inline with a
      // retry rather than failing silently and blocking Continue with no reason.
      setCategoriesError(e.message || 'Could not load shop categories.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories().catch((e) => console.error('[RegisterShop] category load rejected', e));
  }, [loadCategories]);

  const toggleShopCategory = (catId) => {
    setShopCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId],
    );
    clearError('shopCategory');
  };

  const selectedCategories = useMemo(
    () => shopCategoryIds.map((id) => categoryOptions.find((c) => c.id === id)).filter(Boolean),
    [shopCategoryIds, categoryOptions],
  );

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoryOptions;
    const q = categorySearchQuery.toLowerCase();
    return categoryOptions.filter((item) => item.name.toLowerCase().includes(q));
  }, [categorySearchQuery, categoryOptions]);
  const [shopPhone, setShopPhone] = useState(phone || '');
  const [shopAddress, setShopAddress] = useState('');
  const [bannerUri, setBannerUri] = useState(null);

  // --- STEP 3: Delivery Boundary ---
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [mapRegion, setMapRegion] = useState(DEFAULT_CENTER);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [boundaryMode, setBoundaryMode] = useState('polygon'); // 'polygon' or 'radius'
  const [radiusKm, setRadiusKm] = useState(5); // default 5km radius
  const [shopLocation, setShopLocation] = useState({ latitude: DEFAULT_CENTER.latitude, longitude: DEFAULT_CENTER.longitude });
  const [mapTapAction, setMapTapAction] = useState('boundary'); // 'storefront' or 'boundary'
  const [isFullScreen, setIsFullScreen] = useState(false);
  const mapRef = useRef(null);

  // Reaching this screen means the OTP was already verified and a token pair is
  // stored, so "log in as someone else" is really "drop this session". Without
  // it Step 1 is a dead end: there is no back control, and on Android the
  // hardware back key would simply close the app.
  const handleExitToLogin = useCallback(() => {
    Alert.alert(
      t('exitOnboardingTitle', 'Sign in with a different number?'),
      t(
        'exitOnboardingBody',
        "You'll be signed out and returned to the login screen. Details you've entered here are not saved.",
      ),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('logout', 'Log Out'),
          style: 'destructive',
          onPress: () => {
            logout().catch((e) => console.error('[RegisterShop] logout rejected', e));
          },
        },
        // Verifying the OTP already created an account; the owner must be able
        // to ask for it to be deleted without finishing onboarding first.
        { text: t('deleteAccount', 'Delete Account'), onPress: () => navigation.navigate('DeleteAccount') },
      ],
    );
  }, [logout, navigation, t]);

  useEffect(() => {
    const handleBackPress = () => {
      if (isFullScreen && currentStep === 3) {
        setIsFullScreen(false);
        return true;
      }
      if (currentStep > 1) {
        handlePrevStep();
        return true;
      }
      // Step 1 — offer the way out instead of letting the OS close the app.
      handleExitToLogin();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen, currentStep, handleExitToLogin]);

  // --- Global States ---
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  // The screen already highlighted the bad fields; it just never moved the
  // view to them, so on step 2 the address error sat below the fold.
  const form = useFormErrors();

  // A new step must start at ITS top with the keyboard down. Advancing while a
  // field was focused left the keyboard up, and KeyboardAwareScrollView then
  // scrolled the new step to whichever input it considered focused — landing
  // on Shop Contact Number, with Shop Name and Categories hidden above the
  // fold. Owners filled in what they could see and missed the rest.
  useEffect(() => {
    Keyboard.dismiss();
    // The new step's scroll view mounts on this render, so scroll once it exists.
    const id = setTimeout(() => {
      const scroller = form.scrollRef.current;
      if (!scroller) return;
      if (typeof scroller.scrollToPosition === 'function') {
        scroller.scrollToPosition(0, 0, false);
      } else if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ y: 0, animated: false });
      }
    }, 50);
    return () => clearTimeout(id);
  }, [currentStep, form.scrollRef]);
  const scrollToFirstError = (newErrors, order) => {
    const first = order.find((f) => newErrors[f]);
    if (first) form.setError(first, newErrors[first]);
  };

  const clearError = (field) => {
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // GeoJSON computations for MapLibre shapes
  const lineGeoJson = useMemo(() => {
    if (polygonPoints.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: polygonPoints.map(p => [p.longitude, p.latitude]),
      },
    };
  }, [polygonPoints]);

  const polygonGeoJson = useMemo(() => {
    if (polygonPoints.length < 3) return null;
    const coords = polygonPoints.map(p => [p.longitude, p.latitude]);
    coords.push([polygonPoints[0].longitude, polygonPoints[0].latitude]);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };
  }, [polygonPoints]);

  const makeCircleGeoJson = (lat, lng, radiusKm, points = 64) => {
    const coords = [];
    const kmInDeg = 1 / 111.32;
    for (let i = 0; i < points; i++) {
      const angle = (i * 360) / points;
      const rad = (angle * Math.PI) / 180;
      const dx = radiusKm * Math.cos(rad);
      const dy = radiusKm * Math.sin(rad);
      const pointLat = lat + dy * kmInDeg;
      const pointLng = lng + (dx * kmInDeg) / Math.cos((lat * Math.PI) / 180);
      coords.push([pointLng, pointLat]);
    }
    coords.push(coords[0]);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };
  };

  const radiusCircleGeoJson = useMemo(() => {
    if (boundaryMode !== 'radius' || !shopLocation.latitude || !shopLocation.longitude) return null;
    return makeCircleGeoJson(shopLocation.latitude, shopLocation.longitude, radiusKm);
  }, [boundaryMode, shopLocation, radiusKm]);

  // Fetch current location on entering step 3
  useEffect(() => {
    if (currentStep === 3) {
      const fetchLocation = async () => {
        setLoadingLocation(true);
        try {
          const coords = await getCurrentLocation(t);
          setShopLocation({ latitude: coords.latitude, longitude: coords.longitude });
          
          if (boundaryMode === 'radius') {
            fitCircleInView(coords.latitude, coords.longitude, radiusKm);
          } else {
            const region = {
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            };
            setMapRegion(region);
            if (mapRef.current) {
              mapRef.current.animateToRegion(region, 1000);
            }
          }
        } catch (e) {
          console.warn('[RegisterShop] Geolocation error, using fallback:', e);
        } finally {
          setLoadingLocation(false);
        }
      };
      fetchLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, shopAddress]);

  const handleRecenterGPS = async () => {
    setLoadingLocation(true);
    try {
      const coords = await getCurrentLocation(t);
      setShopLocation({ latitude: coords.latitude, longitude: coords.longitude });
      if (boundaryMode === 'radius') {
        fitCircleInView(coords.latitude, coords.longitude, radiusKm);
      } else {
        const region = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        };
        setMapRegion(region);
        if (mapRef.current) {
          mapRef.current.animateToRegion(region, 800);
        }
      }
    } catch (e) {
      console.warn('[RegisterShop] Recenter location error:', e);
      Toast.show({
        type: 'error',
        text1: t('locationErrorTitle'),
        text2: t('couldNotFetchGps')
      });
    } finally {
      setLoadingLocation(false);
    }
  };

  const selectBannerImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Toast.show({
          type: 'error',
          text1: t('imageSelectorError'),
          text2: response.errorMessage || 'Failed to select image.'
        });
      } else if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        setBannerUri(uri);
      }
    });
  };

  const isValidEmail = (email) => {
    if (!email || !email.trim()) return true;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };

  const handleNextStep = () => {
    const newErrors = {};
    if (currentStep === 1) {
      if (!ownerName.trim()) {
        newErrors.ownerName = 'Please enter your full name';
      }
      if (ownerEmail.trim() && !isValidEmail(ownerEmail)) {
        newErrors.ownerEmail = 'Please enter a valid email address (e.g. name@domain.com)';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        scrollToFirstError(newErrors, ['ownerName', 'ownerEmail']);
        return;
      }
      setErrors({});
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!shopName.trim()) {
        newErrors.shopName = 'Please enter shop name';
      }
      if (shopCategoryIds.length === 0) {
        newErrors.shopCategory = categoriesError
          ? 'Shop categories could not be loaded. Tap retry above.'
          : 'Please select at least one category';
      }
      if (!shopPhone.trim()) {
        newErrors.shopPhone = 'Please enter contact number';
      }
      if (!shopAddress.trim()) {
        newErrors.shopAddress = 'Please enter shop address';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        scrollToFirstError(newErrors, ['shopName', 'shopCategory', 'shopPhone', 'shopAddress']);
        return;
      }
      setErrors({});
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (boundaryMode === 'polygon' && polygonPoints.length < 3) {
        Toast.show({ type: 'error', text1: t('boundaryRequired'), text2: t('boundaryRequiredSub') });
        return;
      }
      setErrors({});
      setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    if (isFullScreen) {
      setIsFullScreen(false);
    }
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleMapPress = (e) => {
    if (!e || !e.nativeEvent || !e.nativeEvent.coordinate) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (boundaryMode === 'radius') {
      setShopLocation({ latitude, longitude });
      fitCircleInView(latitude, longitude, radiusKm);
      setTimeout(() => {
        Toast.show({ type: 'success', text1: t('storefrontPinSet'), text2: t('storefrontPinSetSub') });
      }, 0);
    } else {
      const nextPoints = [...polygonPoints, { latitude, longitude }];
      setPolygonPoints(nextPoints);
      setTimeout(() => {
        Toast.show({ type: 'success', text1: t('pointAdded'), text2: `Added vertex #${nextPoints.length} on the map.` });
      }, 0);
    }
  };

  const undoLastPoint = () => {
    if (polygonPoints.length > 0) {
      setPolygonPoints(polygonPoints.slice(0, -1));
    }
  };

  const clearPolygon = () => {
    setPolygonPoints([]);
  };

  const getAdjustedRadiusCenter = (lat, lng, km) => {
    if (!lat || !lng) return { latitude: lat, longitude: lng };
    const latOffset = (km * 0.35) / 111;
    return { latitude: lat - latOffset, longitude: lng };
  };

  const fitCircleInView = (lat, lng, km) => {
    if (!lat || !lng) return;
    const delta = Math.max((km * 2.2) / 111, 0.025);
    const targetRegion = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    setMapRegion(targetRegion);
    if (mapRef.current) {
      mapRef.current.animateToRegion(targetRegion, 500);
    }
  };

  const handleRadiusChange = (km) => {
    setRadiusKm(km);
    if (shopLocation.latitude && shopLocation.longitude) {
      fitCircleInView(shopLocation.latitude, shopLocation.longitude, km);
    }
  };

  const handleSaveBoundary = async () => {
    const finalPoints = polygonPoints;

    if (boundaryMode === 'polygon' && finalPoints.length < 3) {
      Toast.show({
        type: 'error',
        text1: t('saveBoundaryTitle'),
        text2: t('saveBoundaryTapPoints')
      });
      return;
    }
    try {
      // Nothing to persist yet: the shop does not exist until step 4, and
      // handleFinishSetup() sends this boundary to /owner/shop/delivery-zone
      // once it does. This used to write to a mock store nothing ever read.
      setIsFullScreen(false);
      setCurrentStep(4);
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('saveBoundaryFailed'),
        text2: t('couldNotSaveBoundary')
      });
    }
  };

  // --- RENDERS ---

  const renderStepIndicator = () => {
    if (isFullScreen && currentStep === 3) return null;
    return (
      <View style={[styles.indicatorContainer, { paddingTop: Platform.OS === 'ios' ? insets.top + 16 : Math.max(insets.top, StatusBar.currentHeight || 24) + 12 }]}>
        <View style={styles.indicatorHeader}>
          <TouchableOpacity
            onPress={currentStep > 1 ? handlePrevStep : handleExitToLogin}
            style={styles.backBtn}
          >
            <ArrowLeft color={theme.colors.primary} size={24} />
          </TouchableOpacity>
          <Text style={styles.indicatorText}>{t('stepCount', 'Step {step} of 4').replace('{step}', currentStep)}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${(currentStep / 4) * 100}%` }]} />
        </View>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <KeyboardAwareScrollView 
            ref={form.scrollRef}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'android' ? 90 : Math.max(insets.bottom + 32, 48) }]}
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            keyboardShouldPersistTaps="handled"
            extraScrollHeight={100}
            extraHeight={120}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionHeading}>{t('tellUsAboutYourself', 'Tell us about yourself')}</Text>
            <Text style={styles.sectionSubtitle}>{t('personalDetailsSub', 'These details are used to set up your partner account.')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('fullName', 'Full Name *')}</Text>
              <View style={[styles.textInputContainer, errors.ownerName && styles.textInputContainerError]} onLayout={form.onFieldLayout('ownerName')}>
                <User color={errors.ownerName ? '#DC2626' : theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('fullNamePlaceholder', 'e.g. Aman Sharma')}
                  placeholderTextColor={theme.colors.textLight}
                  value={ownerName}
                  onChangeText={(val) => {
                    setOwnerName(val);
                    clearError('ownerName');
                  }}
                />
              </View>
              {errors.ownerName && <Text style={styles.errorText}>{errors.ownerName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('mobileVerified', 'Mobile Number (Verified)')}</Text>
              <View style={[styles.textInputContainer, styles.disabledInput]}>
                <Phone color={theme.colors.textLight} size={22} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.textLight }]}
                  value={`+91 ${phone}`}
                  editable={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('emailOptional', 'Email Address (Optional)')}</Text>
              <View style={[styles.textInputContainer, errors.ownerEmail && styles.textInputContainerError]} onLayout={form.onFieldLayout('ownerEmail')}>
                <Mail color={errors.ownerEmail ? '#DC2626' : theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('emailPlaceholder', 'e.g. shop@example.com')}
                  placeholderTextColor={theme.colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={ownerEmail}
                  onChangeText={(val) => {
                    setOwnerEmail(val);
                    if (errors.ownerEmail) {
                      if (!val.trim() || isValidEmail(val)) {
                        clearError('ownerEmail');
                      }
                    }
                  }}
                  onBlur={() => {
                    if (ownerEmail.trim() && !isValidEmail(ownerEmail)) {
                      setErrors(prev => ({ ...prev, ownerEmail: 'Please enter a valid email address (e.g. name@domain.com)' }));
                    }
                  }}
                />
              </View>
              {errors.ownerEmail && (
                <Text style={styles.errorText}>{errors.ownerEmail}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep}>
              <Text style={styles.primaryBtnText}>{t('continueToShopDetails', 'Continue to Shop Details')}</Text>
            </TouchableOpacity>

            {/* The arrow in the header does the same thing, but it reads as
                "previous step" on every other screen — this spells the exit out. */}
            <TouchableOpacity
              style={[styles.switchAccountRow, { marginBottom: Platform.OS === 'android' ? 64 : Math.max(insets.bottom + 16, 28) }]}
              onPress={handleExitToLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.switchAccountText}>
                {t('wrongNumberPrompt', 'Wrong number?')}{' '}
                <Text style={styles.switchAccountLink}>{t('signInDifferent', 'Sign in with a different one')}</Text>
              </Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        );

      case 2:
        return (
          <KeyboardAwareScrollView 
            ref={form.scrollRef}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'android' ? 90 : Math.max(insets.bottom + 32, 48) }]}
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            keyboardShouldPersistTaps="handled"
            extraScrollHeight={100}
            extraHeight={120}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionHeading}>{t('yourShopDetails', 'Your Shop Details')}</Text>
            <Text style={styles.sectionSubtitle}>{t('shopDetailsSub', 'Enter details of your local store storefront.')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('shopNameLabel', 'Shop Name *')}</Text>
              <View style={[styles.textInputContainer, errors.shopName && styles.textInputContainerError]} onLayout={form.onFieldLayout('shopName')}>
                <Store color={errors.shopName ? '#DC2626' : theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('shopNamePlaceholder', 'e.g. Fresh Mart Grocery')}
                  placeholderTextColor={theme.colors.textLight}
                  value={shopName}
                  onChangeText={(val) => {
                    setShopName(val);
                    clearError('shopName');
                  }}
                />
              </View>
              {errors.shopName && <Text style={styles.errorText}>{errors.shopName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('shopCategoriesLabel', 'Shop Categories (Select one or more) *')}</Text>

              {selectedCategories.length > 0 && (
                <View style={styles.selectedCategoryChipsRow}>
                  {selectedCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.selectedCategoryChip}
                      onPress={() => toggleShopCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.selectedCategoryChipText}>{cat.name}</Text>
                      <X color={theme.colors.primary} size={14} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {categoriesError && (
                <TouchableOpacity style={styles.categoryRetryRow} onPress={loadCategories} activeOpacity={0.7}>
                  <Text style={styles.categoryRetryText}>{categoriesError} Tap to retry.</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.textInputContainer, 
                  isCategoryOpen && styles.textInputContainerFocused,
                  errors.shopCategory && styles.textInputContainerError
                ]}
                onLayout={form.onFieldLayout('shopCategory')}
                activeOpacity={0.8}
                onPress={() => {
                  setIsCategoryOpen(!isCategoryOpen);
                  if (isCategoryOpen) setCategorySearchQuery('');
                  clearError('shopCategory');
                }}
              >
                <Tag color={errors.shopCategory ? '#DC2626' : theme.colors.primary} size={22} style={styles.inputIcon} />
                <Text style={[styles.textInput, shopCategoryIds.length === 0 && { color: theme.colors.textLight }]}>
                  {shopCategoryIds.length === 0
                    ? t('selectCategoriesPlaceholder', 'Select Categories')
                    : shopCategoryIds.length === 1
                      ? t('categorySelectedSingle', '1 Selected Category')
                      : t('categoriesSelectedPlural', '{count} Selected Categories').replace('{count}', shopCategoryIds.length)}
                </Text>
                {isCategoryOpen ? (
                  <ChevronUp color={theme.colors.primary} size={22} style={{ marginRight: 16 }} />
                ) : (
                  <ChevronDown color={theme.colors.textDark} size={22} style={{ marginRight: 16 }} />
                )}
              </TouchableOpacity>
              {errors.shopCategory && <Text style={styles.errorText}>{errors.shopCategory}</Text>}

              {isCategoryOpen && (
                <View style={styles.inlineCategoryDropdown}>
                  <View style={styles.categorySearchContainer}>
                    <Search color={theme.colors.primary} size={18} style={styles.categorySearchIcon} />
                    <TextInput
                      style={styles.categorySearchInput}
                      placeholder={t('searchCategoriesPlaceholder', 'Search categories...')}
                      placeholderTextColor={theme.colors.textLight}
                      value={categorySearchQuery}
                      onChangeText={setCategorySearchQuery}
                      autoFocus={true}
                    />
                    {categorySearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                        <X color={theme.colors.textLight} size={18} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView 
                    nestedScrollEnabled={true} 
                    style={styles.categoryDropdownScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {categoriesLoading ? (
                      <View style={styles.noCategoryContainer}>
                        <ActivityIndicator color={theme.colors.primary} size="small" />
                      </View>
                    ) : filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => {
                        const CatIcon = getCategoryIcon(cat.name);
                        const isSelected = shopCategoryIds.includes(cat.id);
                        const catColors = getCategoryColor(cat.name);
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.categoryDropdownItem,
                              isSelected && { backgroundColor: '#DCFCE7' }
                            ]}
                            onPress={() => toggleShopCategory(cat.id)}
                          >
                            <View style={[styles.categoryDropdownItemLeft]}>
                              <View style={[styles.categoryIconBadge, { backgroundColor: catColors.bg }]}>
                                <CatIcon color={catColors.text} size={18} />
                              </View>
                              <Text style={[styles.categoryDropdownItemText, isSelected && styles.categoryDropdownItemTextSelected]}>
                                {cat.name}
                              </Text>
                            </View>
                            {isSelected ? (
                              <Check color={theme.colors.primary} size={18} strokeWidth={3} />
                            ) : (
                              <View style={styles.unselectedCheckbox} />
                            )}
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={styles.noCategoryContainer}>
                        <Text style={styles.noCategoryText}>
                          {categorySearchQuery
                            ? `No category found matching "${categorySearchQuery}"`
                            : categoriesError || 'No categories available yet.'}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.categoryDropdownDoneBtn}
                    onPress={() => {
                      setIsCategoryOpen(false);
                      setCategorySearchQuery('');
                    }}
                  >
                    <Text style={styles.categoryDropdownDoneText}>Done ({shopCategoryIds.length} selected)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('shopContactLabel', 'Shop Contact Number *')}</Text>
              <View style={[styles.textInputContainer, errors.shopPhone && styles.textInputContainerError]} onLayout={form.onFieldLayout('shopPhone')}>
                <Phone color={errors.shopPhone ? '#DC2626' : theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('shopContactPlaceholder', '10-digit customer helpline number')}
                  placeholderTextColor={theme.colors.textLight}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={shopPhone}
                  onChangeText={(val) => {
                    setShopPhone(val);
                    clearError('shopPhone');
                  }}
                />
              </View>
              {errors.shopPhone && <Text style={styles.errorText}>{errors.shopPhone}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('shopAddressLabel', 'Shop Address *')}</Text>
              <View style={[styles.textInputContainer, styles.textAreaContainer, errors.shopAddress && styles.textInputContainerError]} onLayout={form.onFieldLayout('shopAddress')}>
                <MapPin color={errors.shopAddress ? '#DC2626' : theme.colors.primary} size={22} style={[styles.inputIcon, { marginTop: 14 }]} />
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder={t('shopAddressPlaceholder', 'Street details, neighborhood pincode')}
                  placeholderTextColor={theme.colors.textLight}
                  value={shopAddress}
                  onChangeText={(val) => {
                    setShopAddress(val);
                    clearError('shopAddress');
                  }}
                  multiline={true}
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              {errors.shopAddress && <Text style={styles.errorText}>{errors.shopAddress}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('storefrontBannerPhoto', 'Storefront Banner Photo')}</Text>
              {bannerUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: bannerUri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.replaceImageBtn} onPress={selectBannerImage}>
                    <Text style={styles.replaceImageText}>{t('changeImage', 'Change Image')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePlaceholder} onPress={selectBannerImage}>
                  <ImageIcon color={theme.colors.primary} size={36} />
                  <Text style={styles.imagePlaceholderText}>{t('selectBannerFromGallery', 'Select Banner Photo from Gallery')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { marginBottom: Platform.OS === 'android' ? 64 : Math.max(insets.bottom + 16, 28) }]} onPress={handleNextStep}>
              <Text style={styles.primaryBtnText}>{t('continueToGeofencing', 'Continue to Geofencing')}</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        );

      case 3:
        const hasPoints = polygonPoints.length > 0;
        const validShape = polygonPoints.length >= 3;
        const canSave = boundaryMode === 'radius' ? true : validShape;
        return (
          <View style={styles.mapContainer}>
            {/* Top Mode Selection Panel */}
            {!isFullScreen && (
              <View style={styles.mapTopPanel}>
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[styles.modeToggleBtn, boundaryMode === 'polygon' && styles.modeToggleBtnActive]}
                    onPress={() => {
                      setBoundaryMode('polygon');
                      setMapTapAction('boundary');
                      if (mapRef.current && shopLocation.latitude && shopLocation.longitude) {
                        mapRef.current.animateToRegion({
                          latitude: shopLocation.latitude,
                          longitude: shopLocation.longitude,
                          latitudeDelta: 0.015,
                          longitudeDelta: 0.015,
                        }, 600);
                      }
                    }}
                  >
                    <Text style={[styles.modeToggleBtnText, boundaryMode === 'polygon' && styles.modeToggleBtnTextActive]}>
                      {t('customShape', 'Custom Shape')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeToggleBtn, boundaryMode === 'radius' && styles.modeToggleBtnActive]}
                    onPress={() => {
                      setBoundaryMode('radius');
                      setMapTapAction('storefront');
                      if (shopLocation.latitude && shopLocation.longitude) {
                        fitCircleInView(shopLocation.latitude, shopLocation.longitude, radiusKm);
                      }
                    }}
                  >
                    <Text style={[styles.modeToggleBtnText, boundaryMode === 'radius' && styles.modeToggleBtnTextActive]}>
                      {t('radiusCircle', 'Radius Circle')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Banner Instructions */}
            {!isFullScreen && (
              <View style={styles.mapInstructionBanner}>
                <Map color="#FFF" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.mapInstructionText}>
                  {boundaryMode === 'radius'
                    ? t('mapRadiusInstruction', '📍 Tap map to set shop pin & radius circle.')
                    : t('mapDrawInstruction', '✏️ Tap map to draw delivery boundary (at least 3 points).')}
                </Text>
              </View>
            )}

            {loadingLocation ? (
              <View style={styles.mapLoader}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.mapLoaderText}>{t('locatingStorefront')}</Text>
              </View>
            ) : (
              <View style={{ flex: 1, position: 'relative' }}>
                <MapView
                  ref={mapRef}
                  style={styles.mapView}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  region={mapRegion}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                >
                  {/* Storefront Marker (Shown only in Radius Circle mode) */}
                  {boundaryMode === 'radius' && shopLocation.latitude && shopLocation.longitude && (
                    <Marker
                      coordinate={{ latitude: shopLocation.latitude, longitude: shopLocation.longitude }}
                      draggable
                      onDragEnd={(e) => {
                        if (e && e.nativeEvent && e.nativeEvent.coordinate) {
                          const { latitude, longitude } = e.nativeEvent.coordinate;
                          setShopLocation({ latitude, longitude });
                          fitCircleInView(latitude, longitude, radiusKm);
                        }
                      }}
                      anchor={{ x: 0.5, y: 1.0 }}
                    >
                      <View style={styles.storefrontMarkerContainer}>
                        <View style={styles.storefrontMarkerBubble}>
                          <Store color="#FFF" size={14} />
                        </View>
                        <View style={styles.storefrontMarkerTail} />
                      </View>
                    </Marker>
                  )}

                  {/* Custom Shape Polygon Vertices */}
                  {(boundaryMode === 'polygon' || boundaryMode === 'custom') && polygonPoints.map((point, index) => (
                    <Marker
                      key={`vertex-${index}-${point.latitude}-${point.longitude}`}
                      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                      draggable
                      onDragEnd={(e) => {
                        if (e && e.nativeEvent && e.nativeEvent.coordinate) {
                          const { latitude, longitude } = e.nativeEvent.coordinate;
                          setPolygonPoints(prev => {
                            const updated = [...prev];
                            updated[index] = { latitude, longitude };
                            return updated;
                          });
                        }
                      }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.markerContainer}>
                        <View style={styles.markerDot}>
                          <Text style={styles.markerText}>{index + 1}</Text>
                        </View>
                      </View>
                    </Marker>
                  ))}

                  {/* Custom Polygon */}
                  {(boundaryMode === 'polygon' || boundaryMode === 'custom') && polygonPoints.length > 0 && (
                    <Polygon
                      coordinates={polygonPoints}
                      strokeColor={theme.colors.primary}
                      strokeWidth={3}
                      fillColor="rgba(46, 125, 50, 0.25)"
                      tappable={true}
                      onPress={handleMapPress}
                    />
                  )}

                  {/* Radius Circle */}
                  {boundaryMode === 'radius' && shopLocation.latitude && shopLocation.longitude && (
                    <Circle
                      center={{ latitude: shopLocation.latitude, longitude: shopLocation.longitude }}
                      radius={radiusKm * 1000}
                      strokeColor="#2196F3"
                      strokeWidth={3}
                      fillColor="rgba(33, 150, 243, 0.25)"
                      tappable={true}
                      onPress={handleMapPress}
                    />
                  )}
                </MapView>

              {/* Floating Buttons: Fit Circle & Full Screen */}
              <View style={[
                styles.mapTopFloatingContainer,
                { top: isFullScreen ? (Platform.OS === 'ios' ? insets.top + 12 : 24) : 14 }
              ]}>
                <TouchableOpacity
                  style={styles.fitCircleToggleBtn}
                  activeOpacity={0.85}
                  onPress={handleRecenterGPS}
                >
                  <Compass color="#16A34A" size={15} style={{ marginRight: 6 }} />
                  <Text style={styles.fitCircleToggleText}>{t('myLocation')}</Text>
                </TouchableOpacity>

                {boundaryMode === 'radius' && (
                  <TouchableOpacity
                    style={styles.fitCircleToggleBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (shopLocation.latitude && shopLocation.longitude) {
                        fitCircleInView(shopLocation.latitude, shopLocation.longitude, radiusKm);
                      }
                    }}
                  >
                    <Maximize2 color="#16A34A" size={15} style={{ marginRight: 6 }} />
                    <Text style={styles.fitCircleToggleText}>{t('fitCircle')}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.fullScreenToggleBtn}
                  activeOpacity={0.85}
                  onPress={() => setIsFullScreen(!isFullScreen)}
                >
                  {isFullScreen ? (
                    <>
                      <Minimize2 color="#FFF" size={15} style={{ marginRight: 6 }} />
                      <Text style={styles.fullScreenToggleText}>{t('exitFullScreen', 'Exit Full Screen')}</Text>
                    </>
                  ) : (
                    <>
                      <Maximize2 color="#FFF" size={15} style={{ marginRight: 6 }} />
                      <Text style={styles.fullScreenToggleText}>{t('fullScreen', 'Full Screen')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            )}

            {/* Map Action Buttons Overlay */}
            <View style={[styles.mapButtonOverlay, { bottom: Platform.OS === 'android' ? 64 : Math.max(insets.bottom + 16, 28) }]}>

              {/* Radius size control */}
              {boundaryMode === 'radius' && (
                <View style={styles.radiusControlCard}>
                  <Text style={styles.radiusControlLabel}>
                    {t('deliveryRadiusLabel')} <Text style={styles.radiusHighlight}>{radiusKm} km</Text>
                  </Text>
                  <ScrollView 
                    horizontal={true} 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.radiusChipsRowHorizontal}
                  >
                    {[1, 2, 3, 5, 8, 10, 15, 20].map((km) => (
                      <TouchableOpacity
                        key={km}
                        style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}
                        onPress={() => handleRadiusChange(km)}
                      >
                        <Text style={[styles.radiusChipText, radiusKm === km && styles.radiusChipTextActive]}>
                          {km}km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {boundaryMode === 'polygon' && (
                <View style={styles.row}>
                  <TouchableOpacity 
                    style={[styles.mapOverlayBtn, !hasPoints && styles.disabledBtn]} 
                    onPress={undoLastPoint}
                    disabled={!hasPoints}
                  >
                    <Undo color={hasPoints ? theme.colors.primary : '#AAA'} size={16} />
                    <Text style={[styles.mapOverlayBtnText, { color: hasPoints ? theme.colors.textDark : '#AAA' }]}>{t('undoBtn', 'Undo')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.mapOverlayBtn, !hasPoints && styles.disabledBtn]} 
                    onPress={clearPolygon}
                    disabled={!hasPoints}
                  >
                    <Trash2 color={hasPoints ? theme.colors.error : '#AAA'} size={16} />
                    <Text style={[styles.mapOverlayBtnText, { color: hasPoints ? theme.colors.error : '#AAA' }]}>{t('resetBtn', 'Reset')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.mapSaveBtn, !canSave && styles.disabledBtn]} 
                onPress={handleSaveBoundary}
                disabled={!canSave}
              >
                <Save color="#FFF" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.mapSaveBtnText}>
                  {boundaryMode === 'radius'
                    ? t('saveBoundaryRadius', 'Save boundary ({count}km radius)').replace('{count}', radiusKm)
                    : t('saveBoundaryPoints', 'Save boundary ({count} points)').replace('{count}', polygonPoints.length)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 4:
        return (
          <KeyboardAwareScrollView
            ref={form.scrollRef}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'android' ? 90 : Math.max(insets.bottom + 36, 52) }]}
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionHeading}>{t('confirmSetupHeading', 'Step 4 of 4: Confirm Storefront Setup')}</Text>
            <Text style={styles.sectionSubtitle}>{t('personalDetailsSub', 'Review your storefront details and delivery boundary before proceeding to document upload.')}</Text>

            {/* Overview Card */}
            <View style={styles.confirmCard}>
              <Text style={styles.confirmSectionTitle}>{t('ownerInformationHeader', 'OWNER INFORMATION')}</Text>
              <View style={styles.confirmRow}>
                <User color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{ownerName}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Phone color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>+91 {phone}</Text>
              </View>
              {ownerEmail.trim() !== '' && (
                <View style={styles.confirmRow}>
                  <Mail color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                  <Text style={styles.confirmValue}>{ownerEmail}</Text>
                </View>
              )}

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmSectionTitle}>{t('storefrontInfoHeader', 'STOREFRONT INFORMATION')}</Text>
              {bannerUri && (
                <Image source={{ uri: bannerUri }} style={styles.confirmBannerThumbnail} />
              )}
              <View style={styles.confirmRow}>
                <Store color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{shopName} ({selectedCategories.map((c) => c.name).join(', ')})</Text>
              </View>
              <View style={styles.confirmRow}>
                <Phone color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{shopPhone}</Text>
              </View>
              <View style={styles.confirmRow}>
                <MapPin color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{shopAddress}</Text>
              </View>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmSectionTitle}>{t('deliverySettingsHeader', 'DELIVERY SETTINGS')}</Text>

              {/* Live Map Boundary Preview with pointerEvents="none" so map touch listeners don't block vertical scrolling */}
              <View style={styles.reviewMapPreviewContainer} pointerEvents="none">
                <View style={styles.reviewMapBadge}>
                  <MapPin color={theme.colors.primary} size={14} style={{ marginRight: 4 }} />
                  <Text style={styles.reviewMapBadgeText}>
                    {boundaryMode === 'radius' ? t('radiusCircle', 'Radius Circle') : t('customShape', 'Custom Shape')}
                  </Text>
                </View>
                <MapView
                  style={styles.reviewMapView}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  region={{
                    latitude: shopLocation.latitude || 21.1702,
                    longitude: shopLocation.longitude || 72.8311,
                    latitudeDelta: boundaryMode === 'radius' ? (radiusKm * 2.6) / 111 : 0.015,
                    longitudeDelta: boundaryMode === 'radius' ? (radiusKm * 2.6) / (111 * Math.cos((shopLocation.latitude || 21) * Math.PI / 180)) : 0.015,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  {shopLocation.latitude && shopLocation.longitude && (
                    <Marker
                      coordinate={{ latitude: shopLocation.latitude, longitude: shopLocation.longitude }}
                      anchor={{ x: 0.5, y: 1.0 }}
                    >
                      <View style={styles.storefrontMarkerContainer}>
                        <View style={styles.storefrontMarkerBubble}>
                          <Store color="#FFF" size={14} />
                        </View>
                        <View style={styles.storefrontMarkerTail} />
                      </View>
                    </Marker>
                  )}

                  {(boundaryMode === 'polygon' || boundaryMode === 'custom') && polygonPoints.map((point, index) => (
                    <Marker
                      key={`review-vertex-${index}-${point.latitude}-${point.longitude}`}
                      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.markerContainer}>
                        <View style={styles.markerDot}>
                          <Text style={styles.markerText}>{index + 1}</Text>
                        </View>
                      </View>
                    </Marker>
                  ))}

                  {(boundaryMode === 'polygon' || boundaryMode === 'custom') && polygonPoints.length > 0 && (
                    <Polygon
                      coordinates={polygonPoints}
                      strokeColor={theme.colors.primary}
                      strokeWidth={3}
                      fillColor="rgba(46, 125, 50, 0.25)"
                    />
                  )}

                  {boundaryMode === 'radius' && shopLocation.latitude && shopLocation.longitude && (
                    <Circle
                      center={{ latitude: shopLocation.latitude, longitude: shopLocation.longitude }}
                      radius={radiusKm * 1000}
                      strokeColor="#2196F3"
                      strokeWidth={3}
                      fillColor="rgba(33, 150, 243, 0.25)"
                    />
                  )}
                </MapView>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryBtn, { marginTop: 24, marginBottom: Platform.OS === 'android' ? 64 : Math.max(insets.bottom + 16, 28) }]} 
              onPress={() => {
                const registerFormData = {
                  name: ownerName.trim(),
                  phone,
                  email: ownerEmail.trim(),
                  shopName: shopName.trim(),
                  shopPhone: shopPhone.trim(),
                  shopAddress: shopAddress.trim(),
                  shopCategory: shopCategoryIds,
                  shopLatitude: shopLocation.latitude,
                  shopLongitude: shopLocation.longitude,
                  shopBannerUrl: bannerUri,
                  deliveryPolygon: polygonPoints,
                  deliveryBoundaryType: boundaryMode === 'radius' ? 'radius' : 'custom',
                  deliveryRadiusKm: radiusKm,
                };
                navigation.navigate('DocumentUpload', { registerFormData });
              }}
            >
              <Text style={styles.primaryBtnText}>{t('continueToDocUpload')}</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderStepIndicator()}
      <View style={styles.body}>{renderStepContent()}</View>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  body: {
    flex: 1,
  },
  indicatorContainer: {
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    marginBottom: 10,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
  },
  indicatorText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#ECEFF1',
    marginHorizontal: theme.spacing.xl,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    padding: theme.spacing.m,
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: theme.spacing.s,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: theme.colors.textLight,
    lineHeight: 22,
    marginBottom: theme.spacing.l,
  },
  inputGroup: {
    marginBottom: theme.spacing.l,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    height: theme.controls.touchTargetHeight,
  },
  disabledInput: {
    backgroundColor: '#ECEFF1',
    borderColor: '#CFD8DC',
  },
  inputIcon: {
    marginLeft: 16,
  },
  textInput: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  textAreaContainer: {
    height: 100,
    alignItems: 'flex-start',
  },
  textArea: {
    height: 90,
    paddingTop: 10,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  closeBtn: {
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  modalItemSelected: {
    backgroundColor: '#E8F5E9',
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryModalIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  categoryModalIconSelected: {
    backgroundColor: '#C8E6C9',
  },
  modalItemText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  modalItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  imagePlaceholder: {
    height: 120,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 8,
    textAlign: 'center',
  },
  imagePreviewContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  replaceImageBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  replaceImageText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    height: theme.controls.touchTargetHeight,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.l,
    marginBottom: 24,
    ...theme.shadows.soft,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  switchAccountRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchAccountText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  switchAccountLink: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.white,
  },
  // Map drawing coordinates
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapInstructionBanner: {
    backgroundColor: 'rgba(46, 125, 50, 0.9)', // transparent primary green
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapInstructionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  mapLoaderText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  mapView: {
    flex: 1,
  },
  mapTopFloatingContainer: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  fitCircleToggleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  fitCircleToggleText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  fullScreenToggleBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fullScreenToggleText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  markerContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  mapButtonOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  mapOverlayBtn: {
    flex: 1,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
  },
  mapOverlayBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    marginLeft: 5,
  },
  mapSaveBtn: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    ...theme.shadows.medium,
  },
  mapSaveBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
  },
  // Confirm Card
  confirmCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    ...theme.shadows.soft,
  },
  confirmSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: theme.spacing.s,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  confirmIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  confirmValue: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    lineHeight: 22,
  },
  confirmBannerThumbnail: {
    height: 100,
    borderRadius: 10,
    marginBottom: theme.spacing.m,
    backgroundColor: '#ECEFF1',
  },
  confirmDivider: {
    height: 1.5,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.m,
  },
  // New Map setup styles
  mapTopPanel: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    padding: 12,
  },
  addressCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addressText: {
    color: theme.colors.textDark,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  modeToggleBtnText: {
    color: theme.colors.textLight,
    fontSize: 14,
    fontWeight: '800',
  },
  modeToggleBtnTextActive: {
    color: 'white',
  },
  storefrontMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  storefrontMarkerBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  storefrontMarkerTail: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E53935',
  },
  tapActionToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  tapActionBtn: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tapActionBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tapActionBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  tapActionBtnTextActive: {
    color: 'white',
  },
  radiusControlCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  radiusControlLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 6,
  },
  radiusHighlight: {
    color: theme.colors.primary,
  },
  radiusChipsRowHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  radiusChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  radiusChipTextActive: {
    color: 'white',
  },
  textInputContainerFocused: {
    borderColor: theme.colors.primary,
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
  categoryDropdownScroll: {
    maxHeight: 220,
  },
  noCategoryContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  categoryRetryRow: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  categoryRetryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  categoryDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  categoryIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryDropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  categoryDropdownItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  textInputContainerError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 4,
    marginLeft: 4,
  },
  reviewMapPreviewContainer: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  reviewMapView: {
    flex: 1,
  },
  reviewMapBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  reviewMapBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  selectedCategoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  selectedCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  selectedCategoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  unselectedCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  categoryDropdownDoneBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryDropdownDoneText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

