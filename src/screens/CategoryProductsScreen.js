import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import ProductCard from '../components/ProductCard';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export const CategoryProductsScreen = ({ route }) => {
  const { id: shopId, categoryName, subCategories = [] } = route.params;
  const [activeSubCategory, setActiveSubCategory] = useState(`All ${categoryName}`);
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  // Create some dummy subcategories if none passed (for UI replication)
  const tabs = [`All ${categoryName}`, ...subCategories];

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', shopId, categoryName, activeSubCategory],
    queryFn: async () => {
      // In a real app we might pass subcategory, but here we just pass the main category
      // to ensure we get results for the demo
      const res = await axiosClient.get(`/shops/${shopId}/products?category=${categoryName}`);
      return res.data.products;
    }
  });

  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await axiosClient.get('/cart');
      return res.data;
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

  const currentShopCart = cartData?.carts?.find(c => c.shop?.id === parseInt(shopId));
  const cartItemsCount = currentShopCart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const cartTotal = currentShopCart?.items?.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0) || 0;

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}}>
          <ArrowLeft color="#000" size={24} />
        </TouchableOpacity>
        
        <Text style={styles.navTitle}>{categoryName}</Text>
        
        <View style={styles.rightIcons}>
          <TouchableOpacity style={{marginRight: 16}}>
            <Search color={theme.colors.primary} size={20} />
          </TouchableOpacity>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }} style={styles.avatar} />
          </View>
        </View>
      </View>

      <FlatList
        horizontal
        data={tabs}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
        renderItem={({ item }) => {
          const isActive = activeSubCategory === item;
          return (
            <TouchableOpacity
              style={[styles.tab, isActive ? styles.activeTab : styles.inactiveTab]}
              onPress={() => setActiveSubCategory(item)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={productsData}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => {
          const cartItem = currentShopCart?.items?.find(i => i.product_id === item.id);
          return (
            <ProductCard
              product={item}
              cartItem={cartItem}
              onQtyChange={(productId, quantity) => addToCartMutation.mutate({ productId, quantity })}
            />
          );
        }}
        ListEmptyComponent={
          isProductsLoading ? (
            <ActivityIndicator style={{marginTop: 40}} color={theme.colors.primary} />
          ) : (
            <Text style={styles.emptyText}>No products found.</Text>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerWrapper: {
    backgroundColor: theme.colors.background,
    paddingBottom: 8,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
  },
  navTitle: {
    ...theme.typography.title,
    fontSize: 22,
    flex: 1,
    marginLeft: 16,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
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
  categoryTabs: {
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: theme.spacing.s,
  },
  activeTab: {
    backgroundColor: '#006B54',
  },
  inactiveTab: {
    backgroundColor: theme.colors.border,
  },
  tabText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  activeTabText: {
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 8,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});

export default CategoryProductsScreen;
