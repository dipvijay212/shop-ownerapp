import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, TextInput, Image, Platform, StatusBar, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { getCurrentLocation } from '../utils/location';
import ShopCard from '../components/ShopCard';
import ProductCard from '../components/ProductCard';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { Menu, Heart, MapPin, Search, ChevronDown, ChevronRight } from 'lucide-react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { ensureLocationReady } from '../utils/locationHelper';
export const HomeScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { data: location, isLoading: loadingLocation, isError: locationError, refetch: refetchLocation } = useQuery({
    queryKey: ['userLocation'],
    queryFn: async () => {
      return await ensureLocationReady();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const locationStatus = loadingLocation ? 'loading' : locationError ? 'failed' : 'ready';
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCartBanner, setShowCartBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { data: myShops, isLoading: loadingMyShops, refetch: refetchMyShops } = useQuery({
    queryKey: ['myShops'],
    queryFn: async () => {
      const res = await axiosClient.get('/my-shops');
      return res.data.savedShops;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: nearbyShops, isLoading: loadingNearby, refetch: refetchNearby } = useQuery({
    queryKey: ['nearbyShops', location?.latitude, location?.longitude],
    queryFn: async () => {
      if (!location) return [];
      const res = await axiosClient.get(`/shops/nearby?lat=${location.latitude}&lng=${location.longitude}`);
      return res.data.shops;
    },
    enabled: !!location,
    staleTime: 1000 * 60 * 5,
  });

  const { data: nearbyProducts, isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['nearbyProducts', location?.latitude, location?.longitude, selectedCategory],
    queryFn: async () => {
      if (!location) return [];
      const res = await axiosClient.get(`/shops/nearby-products?lat=${location.latitude}&lng=${location.longitude}&category=${selectedCategory}`);
      return res.data.products;
    },
    enabled: !!location,
    staleTime: 1000 * 60 * 5,
  });

  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await axiosClient.get('/cart');
      return res.data.carts;
    }
  });

  const { data: wishlistData } = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const res = await axiosClient.get('/wishlist');
      return res.data.wishlist;
    }
  });

  const toggleWishlistMutation = useMutation({
    mutationFn: async ({ productId, isWishlisted }) => {
      if (isWishlisted) {
        await axiosClient.delete(`/wishlist/${productId}`);
      } else {
        await axiosClient.post('/wishlist', { productId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist']);
    }
  });

  const updateCartMutation = useMutation({
    mutationFn: async ({ shopId, productId, quantity }) => {
      await axiosClient.post(`/cart/${shopId}/items`, { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cart']);
    }
  });

  const globalCartCount = Array.isArray(cartData) ? cartData.reduce((acc, cart) => acc + (cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0), 0) : 0;
  const globalCartTotal = Array.isArray(cartData) ? cartData.reduce((acc, cart) => acc + (cart.items?.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0) || 0), 0) : 0;

  const previousCountRef = useRef(globalCartCount);
  useEffect(() => {
    if (globalCartCount > 0 && globalCartCount !== previousCountRef.current) {
      setShowCartBanner(true);
      const timer = setTimeout(() => setShowCartBanner(false), 3000);
      previousCountRef.current = globalCartCount;
      return () => clearTimeout(timer);
    }
    previousCountRef.current = globalCartCount;
  }, [globalCartCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchLocation(), refetchMyShops(), refetchNearby(), refetchProducts()]);
    setRefreshing(false);
  };

  const handleShopPress = (id) => {
    navigation.navigate('ShopStorefront', { id });
  };

  const nearbyCategories = ['All', ...new Set(nearbyShops?.map(s => s.category).filter(Boolean))].slice(0, 4);
  const filteredNearbyShops = selectedCategory === 'All' 
    ? nearbyShops?.slice(0, 5)
    : nearbyShops?.filter(s => s.category === selectedCategory).slice(0, 5);

  const isSearching = searchQuery.trim().length > 0;
  
  let listData = [{ key: 'myShops' }, { key: 'nearbyShops' }, { key: 'nearbyProducts' }];
  
  if (isSearching) {
    const query = searchQuery.toLowerCase();
    
    // 1. Find matching shops by name or category
    const matchingShops = nearbyShops?.filter(s => 
      s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query)
    ) || [];
    
    // 2. Find categories of those matching shops
    const matchingCategories = matchingShops.map(s => s.category);
    
    // 3. Find OTHER shops in the same categories
    const otherShopIds = nearbyShops
      ?.filter(s => matchingCategories.includes(s.category) && !matchingShops.some(ms => ms.id === s.id))
      .map(s => s.id) || [];
      
    // 4. Products to show in "More Product Matches":
    //    - Products from those "other" shops
    //    - OR Products that directly match the search query by name
    let matchingProducts = nearbyProducts?.filter(p => 
      otherShopIds.includes(p.shop_id) || p.name.toLowerCase().includes(query)
    ) || [];
    
    // 5. Exclude products from the matchingShops (because they are already shown in the horizontal list)
    matchingProducts = matchingProducts.filter(p => !matchingShops.some(ms => ms.id === p.shop_id));
    
    listData = matchingShops.map(shop => ({ 
      key: `search_shop_${shop.id}`, 
      type: 'searchResult', 
      shop, 
      isProductMatch: false 
    }));
    
    if (matchingProducts.length > 0) {
      // Group matching products by shop_id
      const shopGroups = {};
      matchingProducts.forEach(p => {
        if (!shopGroups[p.shop_id]) shopGroups[p.shop_id] = [];
        shopGroups[p.shop_id].push(p);
      });
      
      // Add each shop group as a searchResult
      Object.keys(shopGroups).forEach(shopId => {
        // Skip if this shop is already in matchingShops
        if (!matchingShops.some(s => s.id == shopId)) {
          const shop = nearbyShops?.find(s => s.id == shopId);
          if (shop) {
            listData.push({
              key: `search_shop_${shop.id}`,
              type: 'searchResult',
              shop,
              isProductMatch: true,
              products: shopGroups[shopId]
            });
          }
        } else {
          // If the shop is already matched by name, but we ALSO have product matches, 
          // let's update that specific result to show the product matches instead of default recommendations
          const existingResult = listData.find(r => r.key === `search_shop_${shopId}`);
          if (existingResult) {
            existingResult.isProductMatch = true;
            existingResult.products = shopGroups[shopId];
          }
        }
      });
    }

    if (listData.length === 0) {
      listData = [{ key: 'no_results' }];
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.locationDropdown} onPress={() => navigation.navigate('AddressMapPicker')}>
          <MapPin color={theme.colors.textLight} size={16} style={{marginRight: 4}} />
          <Text style={styles.locationText}>Downtown</Text>
          <ChevronDown color={theme.colors.textLight} size={16} />
        </TouchableOpacity>

        <View style={styles.headerRightIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Wishlist')} style={styles.iconMargin}>
            <Heart color={theme.colors.text} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarContainer} onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }} 
              style={styles.avatar} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.mainTitle}>
        <Text style={{color: theme.colors.primary}}>Local</Text> Shops
      </Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search color={theme.colors.primary} size={20} style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search for products or shops..."
          placeholderTextColor={theme.colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={listData}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
        renderItem={({ item }) => {
          if (item.key === 'no_results') {
            return <Text style={[styles.emptyText, {marginTop: 40}]}>No shops found for "{searchQuery}"</Text>;
          }
          
          if (item.type === 'searchResult') {
            const shop = item.shop;
            // If it's a product match, use the matched products. Otherwise, use recommendations.
            const productsToShow = item.isProductMatch ? item.products : (nearbyProducts?.filter(p => p.shop_id === shop.id) || []);
            
            return (
              <View style={styles.searchResultCard}>
                <TouchableOpacity style={styles.searchShopHeader} onPress={() => handleShopPress(shop.id)} activeOpacity={0.8}>
                  <View style={styles.searchShopDetails}>
                    <View style={styles.searchShopCategoryRow}>
                      <Text style={styles.searchShopCategoryText}>🏅 Best in {shop.category}</Text>
                    </View>
                    <Text style={styles.searchShopName} numberOfLines={1}>{shop.name}</Text>
                    <Text style={styles.searchShopMeta}>⭐ {shop.rating_avg || '4.2'} (100+) • 30-35 mins</Text>
                    <Text style={styles.searchShopLocation}>Downtown • {shop.distance?.toFixed(1) || '1.2'} km</Text>
                  </View>
                  <ChevronRight color={theme.colors.textLight} size={20} />
                </TouchableOpacity>
                
                {item.isProductMatch && item.products?.length > 0 && (
                  <View style={{ paddingHorizontal: theme.spacing.m, paddingBottom: 12 }}>
                    {item.products.map((prod) => {
                      const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id == prod.shop_id) : null;
                      const cartItem = currentShopCart?.items?.find(i => i.product_id == prod.id);
                      const isWishlisted = Array.isArray(wishlistData) ? wishlistData.some(w => w.id === prod.id) : false;

                      return (
                        <ProductCard 
                          key={`match_${prod.id}`}
                          product={prod} 
                          cartItem={cartItem} 
                          onQtyChange={(productId, qty) => updateCartMutation.mutate({ shopId: prod.shop_id, productId, quantity: qty })}
                          isWishlisted={isWishlisted}
                          onWishlistToggle={(productId, currentStatus) => toggleWishlistMutation.mutate({ productId, isWishlisted: currentStatus })}
                          variant="horizontal"
                          style={{ width: '100%', marginBottom: 12 }}
                        />
                      );
                    })}
                  </View>
                )}

                {(() => {
                  const recommendedProducts = (nearbyProducts?.filter(p => p.shop_id === shop.id) || [])
                    .filter(p => !item.isProductMatch || !item.products.some(mp => mp.id === p.id));
                  
                  if (recommendedProducts.length === 0) return null;

                  return (
                    <View>
                      <Text style={styles.recommendedTitle}>RECOMMENDED IN THIS MENU</Text>
                      <FlatList
                        horizontal
                        data={recommendedProducts}
                        keyExtractor={(prod) => prod.id.toString()}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item: prod }) => {
                          const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id == prod.shop_id) : null;
                          const cartItem = currentShopCart?.items?.find(i => i.product_id == prod.id);
                          const isWishlisted = Array.isArray(wishlistData) ? wishlistData.some(w => w.id === prod.id) : false;

                          return (
                            <ProductCard 
                              product={prod} 
                              cartItem={cartItem} 
                              onQtyChange={(productId, qty) => updateCartMutation.mutate({ shopId: prod.shop_id, productId, quantity: qty })}
                              isWishlisted={isWishlisted}
                              onWishlistToggle={(productId, currentStatus) => toggleWishlistMutation.mutate({ productId, isWishlisted: currentStatus })}
                              variant="vertical"
                              style={{ width: 140, maxWidth: undefined, margin: 8, marginLeft: 0, marginRight: 12 }}
                            />
                          );
                        }}
                        contentContainerStyle={{ paddingLeft: theme.spacing.m, paddingBottom: 16, paddingRight: theme.spacing.m }}
                      />
                    </View>
                  );
                })()}
                <View style={styles.searchResultDivider} />
              </View>
            );
          }

          if (item.type === 'searchProductsGrid') {
            return (
              <View style={[styles.section, { marginTop: 8 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>More Product Matches</Text>
                </View>
                <FlatList
                  data={item.products}
                  keyExtractor={(prod) => prod.id.toString() + '_' + prod.shop_id}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={{ paddingHorizontal: 8, justifyContent: 'space-between' }}
                  renderItem={({ item: prod }) => {
                    const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id == prod.shop_id) : null;
                    const cartItem = currentShopCart?.items?.find(i => i.product_id == prod.id);
                    const isWishlisted = Array.isArray(wishlistData) ? wishlistData.some(w => w.id === prod.id) : false;

                    return (
                      <ProductCard 
                        key={prod.id.toString() + '_' + prod.shop_id}
                        product={prod} 
                        cartItem={cartItem} 
                        onQtyChange={(productId, qty) => updateCartMutation.mutate({ shopId: prod.shop_id, productId, quantity: qty })}
                        isWishlisted={isWishlisted}
                        onWishlistToggle={(productId, currentStatus) => toggleWishlistMutation.mutate({ productId, isWishlisted: currentStatus })}
                      />
                    );
                  }}
                />
              </View>
            );
          }

          if (item.key === 'myShops') {
            return (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>My Shops</Text>
                  <TouchableOpacity><Text style={styles.seeAllText}>See All</Text></TouchableOpacity>
                </View>
                {loadingMyShops ? (
                  <ActivityIndicator style={{margin: 20}} />
                ) : myShops?.length > 0 ? (
                  <FlatList
                    horizontal
                    data={myShops}
                    keyExtractor={(shop) => shop.id.toString()}
                    renderItem={({ item: shop }) => (
                      <ShopCard shop={shop} variant="large" onPress={() => handleShopPress(shop.id)} />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingLeft: theme.spacing.m }}
                  />
                ) : (
                  <Text style={styles.emptyText}>You haven't saved any shops yet.</Text>
                )}
              </View>
            );
          }
          if (item.key === 'nearbyShops') {
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shops Nearby</Text>
                
                {nearbyCategories.length > 1 && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.categoryChipsContainer}
                  >
                    {nearbyCategories.map(cat => (
                      <TouchableOpacity 
                        key={cat} 
                        style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {locationStatus === 'failed' ? (
                  <View style={styles.locationFallbackCard}>
                    <Text style={styles.locationFallbackText}>Turn on location to see shops near you</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={refetchLocation}>
                      <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : locationStatus === 'loading' || loadingNearby ? (
                  <ActivityIndicator style={{margin: 20}} color="#006B54" />
                ) : filteredNearbyShops?.length > 0 ? (
                  <FlatList
                    data={filteredNearbyShops}
                    keyExtractor={(shop) => shop.id.toString()}
                    renderItem={({ item: shop }) => (
                      <ShopCard shop={shop} variant="list" distance={shop.distance} onPress={() => handleShopPress(shop.id)} />
                    )}
                    scrollEnabled={false}
                  />
                ) : (
                  <Text style={styles.emptyText}>
                    No shops delivering to your location for this category.
                  </Text>
                )}
              </View>
            );
          }
          if (item.key === 'nearbyProducts') {
            if (!nearbyProducts || nearbyProducts.length === 0) return null;
            return (
              <View style={[styles.section, { marginTop: 8 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Discover Products</Text>
                </View>
                {loadingProducts ? (
                  <ActivityIndicator style={{margin: 20}} />
                ) : (
                  <FlatList
                    data={nearbyProducts}
                    keyExtractor={(prod) => prod.id.toString() + '_' + prod.shop_id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{ paddingHorizontal: 8, justifyContent: 'space-between' }}
                    renderItem={({ item: prod }) => {
                      const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id == prod.shop_id) : null;
                      const cartItem = currentShopCart?.items?.find(i => i.product_id == prod.id);
                      const isWishlisted = Array.isArray(wishlistData) ? wishlistData.some(w => w.id === prod.id) : false;

                      return (
                        <ProductCard 
                          key={prod.id.toString() + '_' + prod.shop_id}
                          product={prod} 
                          cartItem={cartItem} 
                          onQtyChange={(productId, qty) => updateCartMutation.mutate({ shopId: prod.shop_id, productId, quantity: qty })}
                          isWishlisted={isWishlisted}
                          onWishlistToggle={(productId, currentStatus) => toggleWishlistMutation.mutate({ productId, isWishlisted: currentStatus })}
                        />
                      );
                    }}
                  />
                )}
              </View>
            );
          }
          return null;
        }}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      />

      {showCartBanner && (
        <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={styles.stickyCartBannerWrapper}>
          <TouchableOpacity style={styles.stickyCartBannerInner} onPress={() => navigation.navigate('MainTabs', { screen: 'Basket' })}>
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{globalCartCount}</Text>
            </View>
            <Text style={styles.viewCartText}>View Cart</Text>
            <Text style={styles.cartTotalText}>₹{globalCartTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 15 : theme.spacing.m,
    paddingBottom: theme.spacing.s,
  },
  locationDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0', // Soft gray like the design
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  locationText: {
    ...theme.typography.body,
    fontWeight: 'bold',
    marginRight: 4,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconMargin: {
    marginRight: 16,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  mainTitle: {
    ...theme.typography.title,
    paddingHorizontal: theme.spacing.m,
    marginTop: theme.spacing.s,
    marginBottom: theme.spacing.m,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.l,
    borderRadius: theme.roundness,
    paddingHorizontal: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 50,
  },
  searchIcon: {
    marginRight: theme.spacing.s,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...theme.typography.body,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.s,
  },
  sectionTitle: {
    ...theme.typography.title,
    fontSize: 20,
    paddingHorizontal: theme.spacing.m,
  },
  seeAllText: {
    color: '#006B54',
    fontWeight: '600',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginVertical: theme.spacing.m,
  },
  locationFallbackCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  locationFallbackText: {
    ...theme.typography.body,
    color: '#006B54',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#006B54',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  stickyCartBannerWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
  },
  stickyCartBannerInner: {
    backgroundColor: '#006B54',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...theme.shadows.soft,
  },
  cartCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  viewCartText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cartTotalText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  categoryChipsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 12,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryChipText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.textLight,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  searchResultCard: {
    marginBottom: theme.spacing.l,
    backgroundColor: theme.colors.background,
  },
  searchShopHeader: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
    alignItems: 'center',
  },
  searchShopImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginRight: theme.spacing.m,
  },
  searchShopDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  searchTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  searchTabsActive: {
    ...theme.typography.subtitle,
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },
  searchShopCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  searchShopCategoryText: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706', // Orange tint for "Best in"
  },
  searchShopName: {
    ...theme.typography.subtitle,
    fontSize: 18,
    marginBottom: 4,
  },
  searchShopMeta: {
    ...theme.typography.body,
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 2,
  },
  searchShopLocation: {
    ...theme.typography.caption,
    fontSize: 13,
    color: theme.colors.textLight,
  },
  recommendedTitle: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: theme.colors.textLight,
    marginLeft: theme.spacing.m,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.s,
    textTransform: 'uppercase',
  },
  searchResultDivider: {
    height: 8,
    backgroundColor: '#F3F4F6',
    marginTop: theme.spacing.xs,
  }
});

export default HomeScreen;
