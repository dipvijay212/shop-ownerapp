import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ChevronDown, ChevronUp, Repeat } from 'lucide-react-native';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';
// Shown when a product has no image; the API returns image_url: null for those.
const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400';

export const CollapsibleOrderItems = ({ items = [] }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const renderItem = (item, index) => {
    // Order items carry their own name, image and price — they are a snapshot
    // of what was actually sold, so they must not be re-derived from the
    // current catalogue (the product may since have been renamed or repriced).
    const imageUrl = item.image_url || PLACEHOLDER_IMAGE;
    const qty = item.quantity || 1;
    // The server sends the quantity already written the way a shopkeeper says
    // it — "1 kg", not a bare 1000. Only fall back to the raw number for a
    // payload old enough not to carry the label.
    const qtyLabel = item.quantity_label || `Qty: ${qty}`;
    // line_total is what the customer was charged for the row; only fall back
    // to multiplying when it is absent.
    const itemTotal = (item.line_total ?? parseFloat(item.price || 0) * qty).toFixed(2);

    return (
      <View key={index} style={[styles.productItemRow, index > 0 && styles.itemBorder]}>
        <Image source={{ uri: imageUrl }} style={styles.productItemImage} />
        
        <View style={styles.productItemDetails}>
          <View style={styles.itemNameAndPriceRow}>
            <Text style={styles.productItemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.productItemPrice}>₹{itemTotal}</Text>
          </View>
          
          <View style={styles.qtyRow}>
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>{qtyLabel}</Text>
            </View>
            {item.kind === 'both' && (
              <View style={styles.kindBadgeBoth}>
                <Repeat size={10} color="#047857" style={{ marginRight: 2 }} />
                <Text style={styles.kindBadgeTextBoth}>{t('mixSubscriptionNormal')}</Text>
              </View>
            )}
            {item.kind === 'subscription' && (
              <View style={styles.kindBadgeSub}>
                <Repeat size={10} color="#7C3AED" style={{ marginRight: 2 }} />
                <Text style={styles.kindBadgeTextSub}>{t('mixSubscriptionOnly')}</Text>
              </View>
            )}
          </View>
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
            {t('hideAdditionalProducts')}
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
  itemNameAndPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 2,
  },
  cleanNoteCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 8,
    marginTop: 6,
    width: '100%',
  },
  cleanNoteCardApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  cleanNoteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cleanNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  cleanNoteTitleApproved: {
    color: '#15803D',
  },
  cleanNoteBody: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 16,
  },
  cleanNoteBodyApproved: {
    color: '#166534',
  },
  cleanApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cleanApproveBtnPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  cleanApproveBtnApproved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  cleanApproveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  cleanApproveBtnTextApproved: {
    color: '#15803D',
  },
  cleanReadMoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  cleanReadMoreTextApproved: {
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
  itemNoteTag: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  itemNoteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  kindBadgeBoth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginLeft: 6,
  },
  kindBadgeTextBoth: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#047857',
  },
  kindBadgeSub: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginLeft: 6,
  },
  kindBadgeTextSub: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
