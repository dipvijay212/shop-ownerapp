import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Switch, ActivityIndicator, SafeAreaView, Platform, Animated, Dimensions } from 'react-native';
import { Store, MapPin, Navigation, Star, ShieldAlert, BadgeCheck } from 'lucide-react-native';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { formatShopCategories } from '../constants/shopCategories';
import { useTranslation } from '../constants/translations';

export const ShopScreen = () => {
  const { shop, refreshShop } = useContext(AuthContext);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Fallback states if context is empty
  const [localShop, setLocalShop] = useState(null);

  const isTogglingRef = useRef(false);

  const fetchShopDetails = useCallback(async () => {
    setLoading(true);
    try {
      // GET /owner/shop is the authoritative record; refreshShop() also keeps
      // AuthContext (and therefore navigation) in sync.
      const data = await refreshShop();
      if (!isTogglingRef.current) {
        setLocalShop(data);
      }
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        text2: t('couldNotLoadShop')
      });
    } finally {
      setLoading(false);
    }
  }, [refreshShop, t]);

  useEffect(() => {
    if (!shop) {
      fetchShopDetails();
    } else if (!isTogglingRef.current) {
      setLocalShop(shop);
    }
  }, [shop, fetchShopDetails]);

  const handleToggleActive = (targetOnline) => {
    if (!localShop || isTogglingRef.current) return;
    const currentOnline = localShop.status === 'active';
    const nextOnline = targetOnline !== undefined ? targetOnline : !currentOnline;
    if (nextOnline === currentOnline) return;
    
    isTogglingRef.current = true;
    const newStatus = nextOnline ? 'active' : 'inactive';
    
    // Instantly apply state change so GPU animation starts without delay
    const updated = { ...localShop, status: newStatus };
    setLocalShop(updated);
    
    // Defer heavy storage operations so UI thread doesn't hang or stutter during transition
    setTimeout(async () => {
      try {
        await api.shop.setOnline(newStatus === 'active');
        setLocalShop(await refreshShop());
      } catch (e) {
        console.error(e);
        // Revert local state
        setLocalShop({ ...localShop, status: currentOnline ? 'active' : 'inactive' });
        Toast.show({
          type: 'error',
          text1: t('errorTitle'),
          text2: t('failedUpdateShopStatus')
        });
      } finally {
        setTimeout(() => {
          isTogglingRef.current = false;
        }, 200);
      }
    }, 80);
  };

  const handleGenerateGeofence = async () => {
    if (!localShop) return;

    // Define 4 coordinates making a square around shop center (offset ~0.006 degrees / ~650m radius)
    const lat = localShop.latitude;
    const lng = localShop.longitude;
    const offset = 0.006;

    const mockPolygon = [
      { latitude: lat + offset, longitude: lng - offset }, // North West
      { latitude: lat + offset, longitude: lng + offset }, // North East
      { latitude: lat - offset, longitude: lng + offset }, // South East
      { latitude: lat - offset, longitude: lng - offset }, // South West
    ];

    setLoading(true);
    try {
      // Radius is sent in METRES; 1.2 km around the storefront pin.
      await api.shop.setDeliveryZone({ method: 'radius', radius_m: 1200 });
      setLocalShop(await refreshShop());
      Toast.show({
        type: 'success',
        text1: t('deliveryZoneGenerated'),
        text2: t('deliveryZoneGeneratedSub')
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        text2: t('couldNotGenerateGeofence')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearGeofence = async () => {
    if (!localShop) return;

    setLoading(true);
    try {
      await api.shop.setDeliveryZone({ method: 'radius', radius_m: 1000 });
      setLocalShop(await refreshShop());
      Toast.show({
        type: 'success',
        text1: t('deliveryZoneCleared'),
        text2: t('deliveryZoneClearedSub')
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        text2: t('couldNotClearGeofence')
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !localShop) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!localShop) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('noShopRegistered')}</Text>
      </SafeAreaView>
    );
  }

  const isOnline = localShop.status === 'active';
  const hasGeofence = Array.isArray(localShop.delivery_polygon) && localShop.delivery_polygon.length > 0;

  const slideAnim = useRef(new Animated.Value(localShop.status === 'active' ? 0 : 1)).current;
  const [toggleBoxWidth, setToggleBoxWidth] = useState(Dimensions.get('window').width - 64);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOnline, slideAnim]);

  const capsuleWidth = Math.max(20, (toggleBoxWidth - 12) / 2);
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, capsuleWidth],
  });
  const greenOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('shopSettings')}</Text>
        <Text style={styles.subtitle}>{t('shopSettingsSub')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Banner Card */}
        <View style={styles.bannerCard}>
          <Image source={{ uri: localShop.banner_url }} style={styles.bannerImage} />
          <View style={styles.shopOverlay}>
            <View style={styles.overlayTextContainer}>
              <Text style={styles.shopNameText}>{localShop.name}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.ratingBadge}>
                  <Star color="#FFD700" size={14} fill="#FFD700" style={{ marginRight: 4 }} />
                  <Text style={styles.ratingText}>{localShop.rating_avg}</Text>
                </View>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{formatShopCategories(localShop.category).toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Status Toggle Card */}
        <View style={styles.card}>
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.cardTitle}>{t('storefrontStatus', 'Storefront Status')}</Text>
            <Text style={styles.cardDescription}>
              {isOnline 
                ? t('storeOnline', 'Your store is ONLINE and visible to neighbors.') 
                : t('storeOffline', 'Your store is OFFLINE. Customers cannot place orders.')}
            </Text>
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
                handleToggleActive(true);
              }}
            >
              <Text style={[
                styles.animatedToggleText,
                { color: isOnline ? '#15803D' : '#FFFFFF' }
              ]}>
                Online
              </Text>
            </TouchableOpacity>

            {/* Offline Option */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.animatedToggleTab}
              onPress={() => {
                handleToggleActive(false);
              }}
            >
              <Text style={[
                styles.animatedToggleText,
                { color: !isOnline ? '#334155' : '#FFFFFF' }
              ]}>
                Offline
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>{t('businessDetailsLabel')}</Text>
          
          <View style={styles.detailRow}>
            <MapPin color={theme.colors.primary} size={22} style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('storeAddressLabel')}</Text>
              <Text style={styles.detailValue}>{localShop?.address_line || localShop?.address || 'Not specified'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Navigation color={theme.colors.primary} size={22} style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('centerCoordinates')}</Text>
              <Text style={styles.detailValue}>
                Lat: {localShop.latitude.toFixed(5)}, Lng: {localShop.longitude.toFixed(5)}
              </Text>
            </View>
          </View>
        </View>

        {/* Geofencing Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>{t('deliveryGeofencing')}</Text>
          <Text style={styles.cardDescription}>
            Define the geographical polygon boundary in which you offer home delivery.
          </Text>

          {hasGeofence ? (
            <View style={styles.geofenceContainer}>
              <View style={styles.activeGeofenceHeader}>
                <BadgeCheck color="#2E7D32" size={20} style={{ marginRight: 6 }} />
                <Text style={styles.activeGeofenceTitle}>{t('geofenceActive')}</Text>
              </View>
              <View style={styles.coordsList}>
                {localShop.delivery_polygon.map((point, idx) => (
                  <Text key={idx} style={styles.coordPoint}>
                    Point {idx + 1}: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </Text>
                ))}
              </View>

              <TouchableOpacity style={styles.clearGeofenceBtn} onPress={handleClearGeofence}>
                <Text style={styles.clearGeofenceText}>{t('clearDeliveryZone')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noGeofenceContainer}>
              <ShieldAlert color="#FB8C00" size={24} style={{ marginBottom: 6 }} />
              <Text style={styles.noGeofenceText}>{t('noActiveGeofence')}</Text>
              <Text style={styles.noGeofenceSubtext}>
                Deliveries are allowed everywhere by default. Set up a delivery boundary to restrict orders to nearby customers.
              </Text>

              <TouchableOpacity style={styles.generateGeofenceBtn} onPress={handleGenerateGeofence}>
                <Text style={styles.generateGeofenceText}>{t('generateBoundary')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  title: {
    ...theme.typography.title,
  },
  subtitle: {
    ...theme.typography.caption,
    fontSize: 16,
    color: theme.colors.textLight,
  },
  scrollContainer: {
    padding: theme.spacing.m,
    paddingBottom: theme.spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.error,
    fontSize: 18,
    fontWeight: '700',
  },
  bannerCard: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: theme.spacing.m,
    ...theme.shadows.medium,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  shopOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    padding: theme.spacing.m,
  },
  overlayTextContainer: {},
  shopNameText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    ...theme.shadows.soft,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    ...theme.typography.subtitle,
    fontSize: 20,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  cardDescription: {
    ...theme.typography.body,
    fontSize: 15,
    color: theme.colors.textLight,
  },
  statusToggleLabel: {
    fontSize: 12,
    fontWeight: '800',
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
  sectionHeader: {
    ...theme.typography.subtitle,
    fontSize: 20,
    color: theme.colors.primary,
    marginBottom: theme.spacing.m,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.m,
  },
  detailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  detailLabel: {
    ...theme.typography.body,
    fontWeight: '800',
    color: theme.colors.textLight,
    fontSize: 14,
  },
  detailValue: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textDark,
    marginTop: 2,
  },
  geofenceContainer: {
    marginTop: theme.spacing.s,
    backgroundColor: '#E8F5E9',
    padding: theme.spacing.m,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
  },
  activeGeofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  activeGeofenceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2E7D32',
  },
  coordsList: {
    marginBottom: theme.spacing.m,
  },
  coordPoint: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    color: '#1B5E20',
    marginVertical: 2,
    fontWeight: '600',
  },
  clearGeofenceBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.error,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearGeofenceText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.error,
  },
  noGeofenceContainer: {
    marginTop: theme.spacing.s,
    backgroundColor: '#FFF8E1',
    padding: theme.spacing.m,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFE082',
    alignItems: 'center',
  },
  noGeofenceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 4,
  },
  noGeofenceSubtext: {
    fontSize: 14,
    color: '#5D4037',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.m,
  },
  generateGeofenceBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...theme.shadows.soft,
  },
  generateGeofenceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
