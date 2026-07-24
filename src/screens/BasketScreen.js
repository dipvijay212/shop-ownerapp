import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import { Menu, MapPin, Store, Trash2, Plus, Minus, ArrowRight } from 'lucide-react-native';

export const BasketScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const { data: cartsData, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await axiosClient.get('/cart');
      return res.data.carts;
    }
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const res = await axiosClient.get('/addresses');
      return res.data.addresses;
    }
  });

  const updateCartMutation = useMutation({
    mutationFn: async ({ shopId, productId, quantity }) => {
      if (quantity === 0) {
        // Assume sending 0 or delete endpoint, wait, our backend might just handle quantity=0 as delete,
        // or we just use updateCart api which removes item if qty 0.
        await axiosClient.post(`/cart/${shopId}/items`, { productId, quantity });
      } else {
        await axiosClient.post(`/cart/${shopId}/items`, { productId, quantity });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cart']);
    }
  });

  const handleCheckout = (cart) => {
    navigation.navigate('Checkout', { cartId: cart.cart_id, shopId: cart.shop.id });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#006B54" />
      </SafeAreaView>
    );
  }

  const activeCarts = Array.isArray(cartsData) ? cartsData.filter(cart => cart.items && cart.items.length > 0) : [];

  // Calculate totals assuming only one shop's cart is being checked out at a time,
  // or we can just display the first cart in the design.
  // The design shows one long list of items, possibly from multiple shops or one shop.
  // We'll map through carts and show the checkout block inside or below each shop's items.
  // To match the design, we'll render a single ScrollView/FlatList.

  const renderCartItem = (product, shopId) => (
    <View key={product.product_id} style={styles.itemRow}>
      <Image source={{ uri: product.image_url || 'https://via.placeholder.com/60' }} style={styles.itemImage} />
      
      <View style={styles.itemDetails}>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName} numberOfLines={1}>{product.name}</Text>
          <TouchableOpacity onPress={() => updateCartMutation.mutate({ shopId, productId: product.product_id, quantity: 0 })}>
            <Trash2 color={theme.colors.textLight} size={20} />
          </TouchableOpacity>
        </View>
        <Text style={styles.itemUnit}>{product.unit} • ₹{product.price}/{product.unit}</Text>
        
        <View style={styles.itemBottomRow}>
          <View style={styles.stepperRow}>
            <TouchableOpacity 
              style={styles.stepperBtn}
              onPress={() => updateCartMutation.mutate({ shopId, productId: product.product_id, quantity: product.quantity - 1 })}
            >
              <Minus color="#006B54" size={14} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{product.quantity}</Text>
            <TouchableOpacity 
              style={styles.stepperBtn}
              onPress={() => updateCartMutation.mutate({ shopId, productId: product.product_id, quantity: product.quantity + 1 })}
            >
              <Plus color="#006B54" size={14} />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemTotal}>₹{(product.price * product.quantity).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );

  const renderCartSection = ({ item: cart }) => {
    const { shop, items } = cart;
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const deliveryFee = 0;
    const total = subtotal + deliveryFee;

    return (
      <View style={styles.cartCard}>
        {/* Shop Header */}
        <View style={styles.shopHeader}>
          <Store color="#006B54" size={20} style={{marginRight: 8}} />
          <Text style={styles.shopName}>{shop.name}</Text>
        </View>

        {/* Items */}
        <View style={styles.itemsContainer}>
          {items.map(product => renderCartItem(product, shop.id))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery Fee</Text>
            <Text style={[styles.totalValue, {color: '#006B54', fontWeight: 'bold'}]}>FREE</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Proceed Button */}
        <TouchableOpacity style={styles.proceedBtn} onPress={() => handleCheckout(cart)}>
          <Text style={styles.proceedText}>Proceed to Pay</Text>
          <ArrowRight color="#FFF" size={20} style={{marginLeft: 8}} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={{padding: 4}}>
          <Menu color="#006B54" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Basket</Text>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }} style={styles.avatar} />
        </View>
      </View>

      {/* Delivery Location Card */}
      <View style={styles.deliveryCard}>
        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
          <MapPin color="#006B54" size={20} style={{marginRight: 12}} />
          <View>
            <Text style={styles.deliveryLabel}>Delivering to</Text>
            <Text style={styles.deliveryAddress}>
              {addresses && addresses.length > 0 
                ? `${addresses[0].label} - ${addresses[0].line1}` 
                : 'No address selected'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.changeBtn} onPress={() => navigation.navigate('AddressList')}>
          <Text style={styles.changeBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {(activeCarts.length === 0) ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your basket is empty!</Text>
        </View>
      ) : (
        <FlatList
          data={activeCarts}
          keyExtractor={(cart) => cart.cart_id.toString()}
          renderItem={renderCartSection}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F8',
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
    backgroundColor: '#F7F9F8',
  },
  headerTitle: {
    ...theme.typography.title,
    fontSize: 24,
    color: '#1D6B35',
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
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    marginBottom: 20,
    ...theme.shadows.soft,
  },
  deliveryLabel: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  deliveryAddress: {
    ...theme.typography.body,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  changeBtn: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeBtnText: {
    color: '#006B54',
    fontWeight: '600',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  cartCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    marginBottom: 24,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9F8',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  shopName: {
    ...theme.typography.body,
    fontWeight: '600',
    color: '#333',
  },
  itemsContainer: {
    padding: 20,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
  },
  itemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    ...theme.typography.body,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  itemUnit: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
    marginTop: 4,
    marginBottom: 12,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
    borderRadius: 20,
    padding: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontWeight: 'bold',
    fontSize: 14,
    marginHorizontal: 12,
    color: '#333',
  },
  itemTotal: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#333',
  },
  totalsContainer: {
    backgroundColor: '#F7F9F8',
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    ...theme.typography.body,
    color: theme.colors.textLight,
  },
  totalValue: {
    ...theme.typography.body,
    color: '#333',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    marginBottom: 0,
  },
  grandTotalLabel: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
    color: '#333',
  },
  proceedBtn: {
    flexDirection: 'row',
    backgroundColor: '#006B54',
    marginHorizontal: 20,
    marginBottom: 20,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  proceedText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default BasketScreen;
