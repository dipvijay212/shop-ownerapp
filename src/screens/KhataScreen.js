import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Image, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import { ChevronLeft, Book, ChevronRight, ChevronDown, Store } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export const KhataScreen = () => {
  const navigation = useNavigation();
  const [expandedShopId, setExpandedShopId] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['khata'],
    queryFn: async () => {
      const res = await axiosClient.get('/khata');
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const { khata, total_overall } = data || { khata: [], total_overall: 0 };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Book color={theme.colors.textLight} size={64} />
      <Text style={styles.emptyTitle}>No Khata Records</Text>
      <Text style={styles.emptySub}>You have no pending Udhar at any local shops.</Text>
      <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('MainTabs')}>
        <Text style={styles.shopBtnText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => {
    const isExpanded = expandedShopId === item.shop.id;
    const allItems = item.transactions.flatMap(t => t.items || []);

    return (
      <View style={styles.shopCardWrapper}>
        <TouchableOpacity 
          style={[styles.shopCard, isExpanded && styles.shopCardNoBottomBorder]} 
          onPress={() => setExpandedShopId(isExpanded ? null : item.shop.id)}
          activeOpacity={0.7}
        >
          <View style={styles.shopInfo}>
            <View style={styles.shopIconBox}>
              <Store color={theme.colors.primary} size={24} />
            </View>
            <View style={styles.shopDetails}>
              <Text style={styles.shopName} numberOfLines={1}>{item.shop.name}</Text>
              <Text style={styles.shopSub}>{item.transactions.length} orders pending</Text>
            </View>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountText}>₹{item.total_pending.toFixed(2)}</Text>
            {isExpanded ? (
              <ChevronDown color={theme.colors.textLight} size={20} style={{ marginLeft: 4 }} />
            ) : (
              <ChevronRight color={theme.colors.textLight} size={20} style={{ marginLeft: 4 }} />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <Text style={styles.expandedTitle}>Purchased Items</Text>
            {allItems.length > 0 ? allItems.map((product, idx) => (
              <View key={idx} style={styles.productRow}>
                <Text style={styles.productName} numberOfLines={1}>
                  <Text style={styles.productQty}>{product.quantity}x</Text> {product.name}
                </Text>
                <Text style={styles.productPrice}>₹{(product.price * product.quantity).toFixed(2)}</Text>
              </View>
            )) : (
              <Text style={styles.noItemsText}>No items data available.</Text>
            )}
            
            <TouchableOpacity 
              style={styles.visitShopBtnOutline}
              onPress={() => navigation.navigate('ShopStorefront', { id: item.shop.id })}
            >
              <Text style={styles.visitShopTextOutline}>Visit Shop Storefront</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Khata</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Total Overview */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewLabel}>Total Outstanding Udhar</Text>
        <Text style={styles.overviewAmount}>₹{total_overall.toFixed(2)}</Text>
        <Text style={styles.overviewSub}>Please clear your dues with shopkeepers directly.</Text>
      </View>

      {/* List */}
      <FlatList
        data={khata}
        keyExtractor={item => item.shop.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.small,
  },
  backBtn: {
    padding: theme.spacing.xs,
    marginLeft: -theme.spacing.xs,
  },
  headerTitle: {
    ...theme.typography.title,
    fontSize: 20,
  },
  overviewCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.m,
    padding: theme.spacing.l,
    borderRadius: 16,
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  overviewLabel: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  overviewAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.error, // Red for outstanding
    marginBottom: theme.spacing.s,
  },
  overviewSub: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  shopCardWrapper: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.m,
  },
  shopCardNoBottomBorder: {
    paddingBottom: theme.spacing.s,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  shopDetails: {
    flex: 1,
  },
  shopName: {
    ...theme.typography.body,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  shopSub: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    ...theme.typography.body,
    fontWeight: 'bold',
    color: theme.colors.error,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.title,
    marginTop: theme.spacing.l,
    marginBottom: theme.spacing.s,
  },
  emptySub: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  shopBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.m,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 8,
  },
  shopBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  expandedContent: {
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.m,
  },
  expandedTitle: {
    ...theme.typography.subtitle,
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.s,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  productQty: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  productName: {
    ...theme.typography.body,
    flex: 1,
    marginRight: theme.spacing.m,
  },
  productPrice: {
    ...theme.typography.body,
    fontWeight: '600',
  },
  noItemsText: {
    ...theme.typography.caption,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  visitShopBtnOutline: {
    marginTop: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  visitShopTextOutline: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  }
});
export default KhataScreen;
