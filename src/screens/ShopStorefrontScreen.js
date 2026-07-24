import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ActivityIndicator, TextInput, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import ProductCard from '../components/ProductCard';
import { ArrowLeft, Search, Star } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ShopStorefrontScreen = ({ route }) => {
  const { id: shopId, source } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCartBanner, setShowCartBanner] = useState(false);
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { data: shopData, isLoading: isShopLoading } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => {
      const url = source ? `/shops/${shopId}?source=${source}` : `/shops/${shopId}`;
      const res = await axiosClient.get(url);
      return res.data;
    }
  });

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', shopId, searchQuery, activeCategory],
    queryFn: async () => {
      let url = `/shops/${shopId}/products?`;
      if (searchQuery) url += `search=${searchQuery}&`;
      if (activeCategory) url += `category=${activeCategory}&`;
      const res = await axiosClient.get(url);
      return res.data.products;
    }
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

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }) => {
      await axiosClient.post(`/cart/${shopId}/items`, { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cart']);
    }
  });

  const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id === parseInt(shopId)) : null;
  const cartItemsCount = currentShopCart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const cartTotal = currentShopCart?.items?.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0) || 0;

  const previousCountRef = useRef(cartItemsCount);
  useEffect(() => {
    if (cartItemsCount > 0 && cartItemsCount !== previousCountRef.current) {
      setShowCartBanner(true);
      const timer = setTimeout(() => setShowCartBanner(false), 3000);
      previousCountRef.current = cartItemsCount;
      return () => clearTimeout(timer);
    }
    previousCountRef.current = cartItemsCount;
  }, [cartItemsCount]);

  if (isShopLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#006B54" />
      </SafeAreaView>
    );
  }

  const { shop } = shopData;
  const categories = shop.categories || [];
  const isOpen = shop.status === 'active';

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.navBar}>
        <View style={styles.navLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#006B54" size={26} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Local Shops</Text>
        </View>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }} style={styles.avatar} />
        </View>
      </View>

      <View style={styles.bannerContainer}>
        <Image source={{ uri: shop.banner_url || 'https://via.placeholder.com/600x300' }} style={styles.banner} />
        <View style={styles.bannerOverlay}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: isOpen ? '#006B54' : theme.colors.error }]}>
              <Text style={styles.statusText}>{isOpen ? 'Open' : 'Closed'}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Star color="#FFF" size={14} fill="#FFF" style={{marginRight: 4}} />
              <Text style={styles.ratingText}>{shop.rating_avg}</Text>
            </View>
          </View>
          <Text style={styles.shopNameOverlay}>{shop.name}</Text>
          <Text style={styles.shopAddressOverlay}>{shop.address} • 0.4 miles away</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#999" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <FlatList
        horizontal
        data={[{ id: null, name: 'All' }, ...(categories || [])]}
        keyExtractor={(item) => (item.id || 'all').toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
        renderItem={({ item }) => {
          const isActive = activeCategory === item.id;
          return (
            <TouchableOpacity
              style={[styles.tab, isActive ? styles.activeTab : styles.inactiveTab]}
              onPress={() => setActiveCategory(item.id)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={productsData}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const cartItem = currentShopCart?.items?.find(i => i.product_id === item.id);
          const isWishlisted = Array.isArray(wishlistData) ? wishlistData.some(w => w.id === item.id) : false;
          
          return (
            <ProductCard 
              product={item} 
              cartItem={cartItem} 
              onQtyChange={(productId, quantity) => addToCartMutation.mutate({ productId, quantity })}
              isWishlisted={isWishlisted}
              onWishlistToggle={(productId, currentStatus) => toggleWishlistMutation.mutate({ productId, isWishlisted: currentStatus })}
            />
          );
        }}
        ListEmptyComponent={
          isProductsLoading ? (
            <ActivityIndicator style={{marginTop: 40}} color="#006B54" />
          ) : (
            <Text style={styles.emptyText}>No products found.</Text>
          )
        }
      />

      {showCartBanner && (
        <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.stickyCartBannerWrapper, { bottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 24 : 16) }]}>
          <TouchableOpacity style={styles.stickyCartBannerInner} onPress={() => navigation.navigate('MainTabs', { screen: 'Basket' })}>
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{cartItemsCount}</Text>
            </View>
            <Text style={styles.viewCartText}>View Cart</Text>
            <Text style={styles.cartTotalText}>₹{cartTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF', // Entire background is white in mockup
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  headerWrapper: {
    backgroundColor: '#FFF',
    paddingBottom: 8,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFF',
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  navTitle: {
    ...theme.typography.title,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#006B54',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  bannerContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    overflow: 'hidden', // Ensure overlay doesn't leak out
  },
  banner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', // Dark gradient over the image
    justifyContent: 'flex-end',
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#006B54',
  },
  statusText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  shopNameOverlay: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  shopAddressOverlay: {
    color: '#EEE',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  searchContainer: {
    backgroundColor: '#FFF', // Explicit white background
    paddingHorizontal: 16,
    paddingTop: 16, 
    paddingBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8, // Less rounded than pill
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    ...theme.typography.body,
    fontSize: 15,
    color: '#333',
  },
  categoryTabs: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  activeTab: {
    backgroundColor: '#006B54',
  },
  inactiveTab: {
    backgroundColor: '#E0F8EC', // Very light mint
  },
  tabText: {
    ...theme.typography.body,
    fontWeight: '500',
    color: '#006B54',
    fontSize: 14,
  },
  activeTabText: {
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 100, // Make room for sticky banner
  },
  columnWrapper: {
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
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
    backgroundColor: 'rgba(255,255,255,0.2)', // Slightly lighter overlay
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
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
  }
});

export default ShopStorefrontScreen;
