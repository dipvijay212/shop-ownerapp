import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { theme } from '../theme';
import { initialProducts } from '../mockOwnerData';

export const CollapsibleOrderItems = ({ items = [] }) => {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const renderItem = (item, index) => {
    // Find matching catalog product for photo and unit if missing on item
    const catalogMatch = initialProducts.find(p => 
      p.id === item.product_id || p.name.toLowerCase() === item.name?.toLowerCase()
    );
    const imageUrl = item.image_url || catalogMatch?.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400';
    const unit = item.unit || catalogMatch?.unit || 'pc';
    const qty = item.quantity || 1;
    const itemTotal = (parseFloat(item.price || 0) * qty).toFixed(2);

    return (
      <View key={index} style={[styles.productItemRow, index > 0 && styles.itemBorder]}>
        <Image source={{ uri: imageUrl }} style={styles.productItemImage} />
        
        <View style={styles.productItemDetails}>
          <Text style={styles.productItemName} numberOfLines={2}>{item.name}</Text>
          
          <View style={styles.unitBadgeRow}>
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>Qty: {qty}</Text>
            </View>
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>Unit: {unit}</Text>
            </View>
          </View>
        </View>

        <View style={styles.productItemPriceContainer}>
          <Text style={styles.productItemPrice}>₹{itemTotal}</Text>
          {qty > 1 && <Text style={styles.productItemUnitPrice}>₹{parseFloat(item.price || 0).toFixed(2)}/ea</Text>}
        </View>
      </View>
    );
  };

  const hasMultiple = items.length > 1;
  const itemsToRender = (hasMultiple && !expanded) ? [items[0]] : items;

  return (
    <View style={styles.collapsibleProductsContainer}>
      {itemsToRender.map((item, index) => renderItem(item, index))}

      {hasMultiple && !expanded && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.expandProductsBtn}
          onPress={() => setExpanded(true)}
        >
          <Text style={styles.expandProductsText}>
            + {items.length - 1} more {items.length - 1 === 1 ? 'product' : 'products'} in order
          </Text>
          <ChevronDown size={16} color={theme.colors.primary} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}

      {hasMultiple && expanded && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.expandProductsBtn, styles.collapseProductsBtn]}
          onPress={() => setExpanded(false)}
        >
          <Text style={[styles.expandProductsText, { color: '#475569' }]}>
            Hide additional products
          </Text>
          <ChevronUp size={16} color="#475569" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  collapsibleProductsContainer: {
    marginVertical: 2,
    marginBottom: 10,
  },
  productItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  productItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  productItemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 5,
  },
  unitBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  qtyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  qtyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  unitBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  productItemPriceContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
    justifyContent: 'center',
  },
  productItemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  productItemUnitPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  expandProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 6,
  },
  collapseProductsBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  expandProductsText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
