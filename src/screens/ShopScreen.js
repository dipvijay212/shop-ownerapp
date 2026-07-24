import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Switch, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { Store, MapPin, Navigation, Star, ShieldAlert, BadgeCheck } from 'lucide-react-native';
import { getMockShop, updateMockShopStatus, updateMockShopGeofence } from '../mockOwnerData';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';

export const ShopScreen = () => {
  const { shop, updateShopState } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // Fallback states if context is empty
  const [localShop, setLocalShop] = useState(null);

  const fetchShopDetails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMockShop();
      setLocalShop(data);
      if (updateShopState) {
        updateShopState(data);
      }
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not load shop details.'
      });
    } finally {
      setLoading(false);
    }
  }, [updateShopState]);

  useEffect(() => {
    if (!shop) {
      fetchShopDetails();
    } else {
      setLocalShop(shop);
    }
  }, [shop, fetchShopDetails]);

  const handleToggleActive = async () => {
    if (!localShop) return;
    
    const newStatus = localShop.status === 'active' ? 'inactive' : 'active';
    
    // Optimistic local update
    const updated = { ...localShop, status: newStatus };
    setLocalShop(updated);
    
    try {
      const res = await updateMockShopStatus(newStatus);
      if (updateShopState) {
        updateShopState(res);
      }
      Toast.show({
        type: 'success',
        text1: 'Shop Status Updated',
        text2: `Your shop is now ${newStatus === 'active' ? 'Online' : 'Offline'}.`
      });
    } catch (e) {
      console.error(e);
      // Revert local state
      setLocalShop({ ...localShop, status: localShop.status });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update shop status.'
      });
    }
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
      const res = await updateMockShopGeofence(mockPolygon);
      setLocalShop(res);
      if (updateShopState) {
        updateShopState(res);
      }
      Toast.show({
        type: 'success',
        text1: 'Delivery Zone Generated',
        text2: 'Defined a 1.2km boundary around your storefront.'
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not generate geofence.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearGeofence = async () => {
    if (!localShop) return;

    setLoading(true);
    try {
      const res = await updateMockShopGeofence([]);
      setLocalShop(res);
      if (updateShopState) {
        updateShopState(res);
      }
      Toast.show({
        type: 'success',
        text1: 'Delivery Zone Cleared',
        text2: 'Your delivery zone geofence has been reset.'
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not clear geofence.'
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
        <Text style={styles.errorText}>No shop registered yet.</Text>
      </SafeAreaView>
    );
  }

  const isOnline = localShop.status === 'active';
  const hasGeofence = Array.isArray(localShop.delivery_polygon) && localShop.delivery_polygon.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Shop Settings</Text>
        <Text style={styles.subtitle}>Configure your customer storefront and geofencing</Text>
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
                  <Text style={styles.categoryText}>{localShop.category.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Status Toggle Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Storefront Status</Text>
              <Text style={styles.cardDescription}>
                {isOnline 
                  ? 'Your store is ONLINE and visible to neighbors.' 
                  : 'Your store is OFFLINE. Customers cannot place orders.'}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.statusToggleLabel, { color: isOnline ? '#2E7D32' : '#C62828' }]}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={handleToggleActive}
                trackColor={{ false: '#CFD8DC', true: '#A8D5BA' }}
                thumbColor={isOnline ? '#2E7D32' : '#78909C'}
                style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }], marginTop: 6 }}
              />
            </View>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Business Details</Text>
          
          <View style={styles.detailRow}>
            <MapPin color={theme.colors.primary} size={22} style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Store Address</Text>
              <Text style={styles.detailValue}>{localShop.address}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Navigation color={theme.colors.primary} size={22} style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Center Location coordinates</Text>
              <Text style={styles.detailValue}>
                Lat: {localShop.latitude.toFixed(5)}, Lng: {localShop.longitude.toFixed(5)}
              </Text>
            </View>
          </View>
        </View>

        {/* Geofencing Card */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Delivery Geofencing</Text>
          <Text style={styles.cardDescription}>
            Define the geographical polygon boundary in which you offer home delivery.
          </Text>

          {hasGeofence ? (
            <View style={styles.geofenceContainer}>
              <View style={styles.activeGeofenceHeader}>
                <BadgeCheck color="#2E7D32" size={20} style={{ marginRight: 6 }} />
                <Text style={styles.activeGeofenceTitle}>Geofence Active (4-point polygon)</Text>
              </View>
              <View style={styles.coordsList}>
                {localShop.delivery_polygon.map((point, idx) => (
                  <Text key={idx} style={styles.coordPoint}>
                    Point {idx + 1}: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </Text>
                ))}
              </View>

              <TouchableOpacity style={styles.clearGeofenceBtn} onPress={handleClearGeofence}>
                <Text style={styles.clearGeofenceText}>Clear Delivery Zone</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noGeofenceContainer}>
              <ShieldAlert color="#FB8C00" size={24} style={{ marginBottom: 6 }} />
              <Text style={styles.noGeofenceText}>No Active Geofence Zone Defined</Text>
              <Text style={styles.noGeofenceSubtext}>
                Deliveries are allowed everywhere by default. Set up a delivery boundary to restrict orders to nearby customers.
              </Text>

              <TouchableOpacity style={styles.generateGeofenceBtn} onPress={handleGenerateGeofence}>
                <Text style={styles.generateGeofenceText}>Generate 1.2km Boundary</Text>
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
