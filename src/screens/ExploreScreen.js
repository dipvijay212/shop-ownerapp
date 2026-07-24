import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform, StatusBar, ScrollView, Image, Alert } from 'react-native';
import { Map, Camera, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { ensureLocationReady } from '../utils/locationHelper';
import { theme } from '../theme';
import { Search, LayoutGrid, Crosshair, Store, MapPin, Star, X, Navigation } from 'lucide-react-native';

export const ExploreScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef(null);

  const [region, setRegion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCategories, setShowCategories] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const distances = [2, 5, 10, 20];

  const [locationStatus, setLocationStatus] = useState('loading');

  const loadLocation = async () => {
    setLocationStatus('loading');
    try {
      const loc = await ensureLocationReady();
      setRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setLocationStatus('ready');
    } catch (err) {
      console.warn('Explore location failed:', err);
      setLocationStatus('failed');
      setRegion(null);
    }
  };

  // 1. Fetch Location
  useEffect(() => {
    loadLocation();
  }, []);

  // 2. Fetch Nearby Shops
  const { data: nearbyShops } = useQuery({
    queryKey: ['exploreShops_v3', region?.latitude, region?.longitude, selectedDistance],
    queryFn: async () => {
      if (!region) return [];
      const res = await axiosClient.get(`/shops/nearby?lat=${region.latitude}&lng=${region.longitude}&radius=${selectedDistance}`);
      return res.data.shops;
    },
    enabled: !!region
  });

  const filteredShops = useMemo(() => {
    if (!nearbyShops) return [];
    
    let result = nearbyShops;
    
    if (selectedCategory !== 'All') {
      result = result.filter(shop => shop.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(shop => {
        const matchName = shop.name && shop.name.toLowerCase().includes(lowerQuery);
        const matchCategory = shop.category && shop.category.toLowerCase().includes(lowerQuery);
        return matchName || matchCategory;
      });
    }
    
    return result;
  }, [nearbyShops, searchQuery, selectedCategory]);

  const availableCategories = useMemo(() => {
    if (!nearbyShops) return ['All'];
    return ['All', ...new Set(nearbyShops.map(s => s.category).filter(Boolean))];
  }, [nearbyShops]);

  const suggestions = useMemo(() => {
    if (!nearbyShops || !searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    
    const matches = new Set();
    nearbyShops.forEach(shop => {
      if (shop.name && shop.name.toLowerCase().includes(lowerQuery)) {
        matches.add(shop.name);
      }
      if (shop.category && shop.category.toLowerCase().includes(lowerQuery)) {
        matches.add(shop.category);
      }
    });
    return Array.from(matches).slice(0, 5);
  }, [nearbyShops, searchQuery]);

  const centerOnUser = async () => {
    try {
      const loc = await ensureLocationReady();
      setRegion(prev => ({...prev, latitude: loc.latitude, longitude: loc.longitude}));
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [loc.longitude, loc.latitude],
          zoom: 15,
          duration: 1000
        });
      }
    } catch (err) {
      // The helper already shows alerts, so no additional alert needed
    }
  };

  const handleMarkerPress = (shop) => {
    setSelectedShop(shop);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [parseFloat(shop.longitude), parseFloat(shop.latitude)],
        zoom: 16,
        duration: 500
      });
    }
  };

  if (locationStatus === 'failed') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackTitle}>Location Required</Text>
          <Text style={styles.fallbackText}>Please turn on location to explore shops around you.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadLocation}>
            <Text style={styles.retryBtnText}>Turn On Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#006B54" />
      </View>
    );
  }

  // Custom marker component to replicate the teardrop with icon
  const CustomMarker = ({ shop, isPrimary }) => {
    return (
      <View style={styles.markerContainer}>
        <View style={[styles.markerBubble, { backgroundColor: isPrimary ? '#006B54' : '#57E298' }]}>
          {isPrimary ? (
            <Store color="#FFF" size={16} />
          ) : (
            <MapPin color={isPrimary ? '#FFF' : '#006B54'} size={16} />
          )}
        </View>
        <View style={[styles.markerTail, { borderTopColor: isPrimary ? '#006B54' : '#57E298' }]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        logoEnabled={false}
        attributionEnabled={false}
        androidView="surface"
      >
        <Camera
          ref={mapRef}
          initialViewState={{
            center: [region.longitude, region.latitude],
            zoom: 15,
          }}
        />
        <UserLocation visible={true} />
        {filteredShops?.map((shop, index) => {
          const isPrimary = index % 2 === 0;
          return (
            <Marker
              key={shop.id.toString()}
              id={`shop-${shop.id}`}
              lngLat={[parseFloat(shop.longitude), parseFloat(shop.latitude)]}
              onPress={() => handleMarkerPress(shop)}
            >
              <View style={[
                styles.markerBubble, 
                { backgroundColor: isPrimary ? '#006B54' : '#57E298', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }
              ]}>
                {isPrimary ? (
                  <Store color="#FFF" size={16} />
                ) : (
                  <MapPin color={isPrimary ? '#FFF' : '#006B54'} size={16} />
                )}
              </View>
            </Marker>
          );
        })}

        {/* Custom User Location Marker on top of everything */}
        <Marker
          id="user-location"
          lngLat={[region.longitude, region.latitude]}
        >
          <View style={{
            width: 28, height: 28, borderRadius: 14, 
            backgroundColor: 'rgba(42, 132, 255, 0.3)', 
            alignItems: 'center', justifyContent: 'center'
          }}>
            <View style={{
              width: 14, height: 14, borderRadius: 7, 
              backgroundColor: '#2A84FF', borderWidth: 2, borderColor: '#FFF',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2
            }} />
          </View>
        </Marker>
      </Map>

      {/* Floating Header */}
      <SafeAreaView style={styles.floatingHeaderSafeArea}>
        <View style={styles.floatingHeaderRow}>
          <View style={{ flex: 1, zIndex: 20 }}>
            <View style={styles.searchBar}>
              <Search color="#666" size={20} style={{marginRight: 10}} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Search for shops or pro"
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setIsSearchFocused(true);
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
            </View>

            {/* Suggestions Dropdown */}
            {isSearchFocused && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.suggestionItem}
                    onPress={() => {
                      setSearchQuery(suggestion);
                      setIsSearchFocused(false);
                    }}
                  >
                    <Search color="#999" size={16} style={{marginRight: 12}} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterBtn, showCategories && { backgroundColor: '#006B54' }]} 
            onPress={() => setShowCategories(!showCategories)}
          >
            <LayoutGrid color={showCategories ? "#FFF" : "#006B54"} size={20} />
          </TouchableOpacity>
        </View>

        {/* Categories Selector Chips (Toggleable) */}
        {showCategories && (
          <View style={[styles.distanceSelectorContainer, { marginBottom: 8 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.distanceScroll}>
              {availableCategories.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.distanceChip, selectedCategory === cat && styles.distanceChipSelected]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.distanceChipText, selectedCategory === cat && styles.distanceChipTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Distance Selector Chips */}
        <View style={styles.distanceSelectorContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.distanceScroll}>
            {distances.map(dist => (
              <TouchableOpacity 
                key={dist} 
                style={[styles.distanceChip, selectedDistance === dist && styles.distanceChipSelected]}
                onPress={() => setSelectedDistance(dist)}
              >
                <Text style={[styles.distanceChipText, selectedDistance === dist && styles.distanceChipTextSelected]}>
                  {dist} km
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* GPS Button */}
      <TouchableOpacity style={[styles.gpsBtn, selectedShop ? { bottom: 180 } : {}]} onPress={centerOnUser}>
        <Crosshair color="#006B54" size={24} />
      </TouchableOpacity>

      {/* Shop Popup Card */}
      {selectedShop && (
        <View style={styles.shopPopupContainer}>
          <TouchableOpacity 
            style={styles.shopPopupCard}
            onPress={() => navigation.navigate('ShopStorefront', { id: selectedShop.id })}
          >
            <TouchableOpacity style={styles.shopPopupClose} onPress={() => setSelectedShop(null)}>
              <X color="#666" size={20} />
            </TouchableOpacity>
            
            <Image source={{ uri: selectedShop.banner_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e' }} style={styles.shopPopupImage} />
            <View style={styles.shopPopupContent}>
              <Text style={styles.shopPopupName} numberOfLines={1}>{selectedShop.name}</Text>
              <Text style={styles.shopPopupCategory}>{selectedShop.category}</Text>
              <View style={styles.shopPopupMeta}>
                <View style={styles.shopPopupRating}>
                  <Star color="#F59E0B" fill="#F59E0B" size={14} />
                  <Text style={styles.shopPopupRatingText}>{selectedShop.rating_avg}</Text>
                </View>
                <View style={styles.shopPopupDistance}>
                  <Navigation color="#666" size={14} />
                  <Text style={styles.shopPopupDistanceText}>
                    {selectedShop.distance ? selectedShop.distance.toFixed(1) + ' km' : 'Nearby'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  floatingHeaderSafeArea: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 20,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    ...theme.shadows.medium,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    height: '100%',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 8,
    ...theme.shadows.medium,
    zIndex: 100,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    ...theme.shadows.medium,
  },
  gpsBtn: {
    position: 'absolute',
    bottom: 20, // Tab bar is translucent or below this usually
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
    zIndex: 10,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.soft,
  },
  markerTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1, // overlap slightly to avoid gap
  },
  distanceSelectorContainer: {
    marginTop: 12,
  },
  distanceScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  distanceChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  distanceChipSelected: {
    backgroundColor: '#006B54',
    borderColor: '#006B54',
  },
  distanceChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  distanceChipTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  shopPopupContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'transparent',
  },
  shopPopupCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  shopPopupClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
  },
  shopPopupImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#EEE',
  },
  shopPopupContent: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  shopPopupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  shopPopupCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  shopPopupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopPopupRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  shopPopupRatingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginLeft: 4,
  },
  shopPopupDistance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopPopupDistanceText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  fallbackContainer: {
    backgroundColor: '#E8F5E9',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 30,
  },
  fallbackTitle: {
    ...theme.typography.title,
    fontSize: 20,
    color: '#006B54',
    marginBottom: 8,
  },
  fallbackText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#006B54',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default ExploreScreen;
