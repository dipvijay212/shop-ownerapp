import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, SafeAreaView, Platform, StatusBar, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import { Menu, Heart, ShoppingBag, Plus, Minus } from 'lucide-react-native';
import ProductCard from '../components/ProductCard';
import { getCurrentLocation } from '../utils/location';

export const WishlistScreen = () => {
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const res = await axiosClient.get('/wishlist');
      return res.data.wishlist;
    }
  });

  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await axiosClient.get('/cart');
      return res.data.carts;
    }
  });

  const [location, setLocation] = useState(null);

  React.useEffect(() => {
    getCurrentLocation()
      .then(loc => setLocation(loc))
      .catch(() => setLocation({ latitude: 28.7041, longitude: 77.1025 }));
  }, []);

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', location?.latitude],
    queryFn: async () => {
      if (!location) return [];
      const res = await axiosClient.get(`/shops/nearby-products?lat=${location.latitude}&lng=${location.longitude}`);
      return res.data.products?.slice(0, 5) || [];
    },
    enabled: !!location,
  });

  const addToCartMutation = useMutation({
    mutationFn: async ({ shopId, productId, quantity }) => {
      await axiosClient.post(`/cart/${shopId}/items`, { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cart']);
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#006B54" />
      </SafeAreaView>
    );
  }

  const renderWishlistCard = ({ item }) => {
    const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id == item.shop_id) : null;
    const cartItem = currentShopCart?.items?.find(i => i.product_id == item.id);
    const quantity = cartItem?.quantity || 0;

    return (
      <View style={styles.wishlistCard}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.image_url || 'https://via.placeholder.com/300' }} 
            style={styles.cardImage} 
          />
          <TouchableOpacity 
            style={styles.heartIconBtn} 
            onPress={() => toggleWishlistMutation.mutate({ productId: item.id, isWishlisted: true })}
          >
            <Heart color="#006B54" size={20} fill="#006B54" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.shopName}>{item.shop_name || 'LOCAL SHOP'}</Text>
          <Text style={styles.productName}>{item.name}</Text>
          
          <View style={styles.cardBottomRow}>
            <Text style={styles.productPrice}>₹{parseFloat(item.price).toFixed(2)}</Text>
            {quantity > 0 ? (
              <View style={styles.stepperContainer}>
                <TouchableOpacity 
                  style={styles.stepperButtonOutline} 
                  onPress={() => addToCartMutation.mutate({ shopId: item.shop_id, productId: item.id, quantity: quantity - 1 })}
                >
                  <Minus color="#333" size={16} />
                </TouchableOpacity>
                <Text style={styles.stepperText}>{quantity}</Text>
                <TouchableOpacity 
                  style={styles.stepperButtonSolid} 
                  onPress={() => addToCartMutation.mutate({ shopId: item.shop_id, productId: item.id, quantity: quantity + 1 })}
                >
                  <Plus color="#FFF" size={16} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addToCartBtn}
                onPress={() => addToCartMutation.mutate({ shopId: item.shop_id, productId: item.id, quantity: 1 })}
              >
                <ShoppingBag color="#FFF" size={14} style={{marginRight: 6}} />
                <Text style={styles.addToCartText}>Add to Cart</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderRecommendation = ({ item }) => {
    const currentShopCart = Array.isArray(cartData) ? cartData.find(c => c.shop?.id == item.shop_id) : null;
    const cartItem = currentShopCart?.items?.find(i => i.product_id == item.id);
    const isWishlisted = Array.isArray(wishlistItems) ? wishlistItems.some(w => w.id === item.id) : false;

    return (
      <ProductCard 
        style={{ maxWidth: '100%', width: 170, marginRight: 8 }}
        product={item} 
        cartItem={cartItem} 
        onQtyChange={(productId, qty) => addToCartMutation.mutate({ shopId: item.shop_id, productId, quantity: qty })}
        isWishlisted={isWishlisted}
        onWishlistToggle={(productId, currentStatus) => toggleWishlistMutation.mutate({ productId, isWishlisted: currentStatus })}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={{padding: 4}}>
          <Menu color="#006B54" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Local Shops</Text>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }} style={styles.avatar} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Hero Text */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>My Wishlist</Text>
          <Text style={styles.heroSubtitle}>Items you've saved from your neighborhood favorites.</Text>
        </View>

        {/* Wishlist Items */}
        <View style={styles.wishlistContainer}>
          {wishlistItems && wishlistItems.length > 0 ? (
            wishlistItems.map(item => <React.Fragment key={item.id}>{renderWishlistCard({item})}</React.Fragment>)
          ) : (
            <Text style={styles.emptyText}>Your wishlist is empty.</Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* Recommendations */}
        <View style={styles.recommendationsSection}>
          <Text style={styles.recommendationsTitle}>Recommended for You</Text>
          <FlatList
            data={recommendations}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id.toString()}
            renderItem={renderRecommendation}
            contentContainerStyle={styles.recommendationsList}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFB', // slight off white to match screenshot
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 15 : 20,
    paddingBottom: 16,
    backgroundColor: '#FBFBFB',
  },
  headerTitle: {
    ...theme.typography.title,
    fontSize: 22,
    color: '#006B54',
    flex: 1,
    marginLeft: 16,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroTitle: {
    ...theme.typography.title,
    fontSize: 24,
    color: '#006B54',
    marginBottom: 8,
  },
  heroSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    fontSize: 14,
    lineHeight: 20,
  },
  wishlistContainer: {
    paddingHorizontal: 20,
  },
  wishlistCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 24,
    ...theme.shadows.soft,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    width: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  heartIconBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  cardBody: {
    padding: 16,
  },
  shopName: {
    ...theme.typography.caption,
    color: '#006B54',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productName: {
    ...theme.typography.subtitle,
    color: '#333',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 16,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    ...theme.typography.title,
    color: '#006B54',
    fontSize: 18,
  },
  addToCartBtn: {
    backgroundColor: '#006B54',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 2,
    width: 100, // Fixed width to prevent jumping
  },
  stepperButtonOutline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepperButtonSolid: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006B54',
  },
  stepperText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
    marginVertical: 16,
  },
  recommendationsSection: {
    paddingTop: 16,
  },
  recommendationsTitle: {
    ...theme.typography.subtitle,
    fontSize: 18,
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  recommendationsList: {
    paddingHorizontal: 20,
  },
  recommendationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginRight: 16,
    width: 140,
    padding: 12,
    ...theme.shadows.soft,
  },
  recommendationImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F0F0F0',
  },
  recommendationName: {
    ...theme.typography.caption,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recommendationPrice: {
    ...theme.typography.caption,
    color: '#006B54',
    fontWeight: 'bold',
  }
});

export default WishlistScreen;
