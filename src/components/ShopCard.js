import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { ChevronRight } from 'lucide-react-native';

const ShopCard = ({ shop, onPress, distance, variant = 'large' }) => {
  const isOpen = shop.status === 'active'; 

  if (variant === 'list') {
    return (
      <TouchableOpacity style={styles.listCard} onPress={onPress} activeOpacity={0.8}>
        <Image
          source={{ uri: shop.banner_url || 'https://via.placeholder.com/300x150' }}
          style={styles.listImage}
        />
        <View style={styles.listContent}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listName} numberOfLines={1}>{shop.name}</Text>
            <View style={[styles.badge, { backgroundColor: isOpen ? theme.colors.primaryLight : theme.colors.border }]}>
              <Text style={[styles.badgeText, { color: isOpen ? '#006B54' : theme.colors.textLight }]}>{isOpen ? 'Open' : 'Closed'}</Text>
            </View>
          </View>
          
          <View style={styles.listMetaRow}>
            <Text style={styles.listCategory}>{shop.category}</Text>
            {distance !== undefined && (
              <View style={styles.listDistanceContainer}>
                <Text style={styles.listDistance}>{distance.toFixed(1)} km away</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.listAction}>
          <ChevronRight color={theme.colors.text} size={20} />
        </View>
      </TouchableOpacity>
    );
  }

  // default 'large' variant
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: shop.banner_url || 'https://via.placeholder.com/300x150' }}
          style={styles.banner}
        />
        <View style={[styles.badgeOverlay, { backgroundColor: isOpen ? theme.colors.primaryLight : theme.colors.border }]}>
          <Text style={[styles.badgeText, { color: isOpen ? '#006B54' : theme.colors.textLight }]}>{isOpen ? 'Open' : 'Closed'}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
        <Text style={styles.category}>{shop.category}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Large Card (My Shops)
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundnessLg,
    marginVertical: theme.spacing.s,
    marginRight: theme.spacing.m,
    width: 240,
    ...theme.shadows.soft,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
  },
  banner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    ...theme.shadows.soft,
  },
  content: {
    padding: theme.spacing.m,
  },
  name: {
    ...theme.typography.subtitle,
    fontSize: 16,
    marginBottom: 4,
  },
  category: {
    ...theme.typography.body,
    color: theme.colors.textLight,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  // List Card (Nearby Shops)
  listCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    marginVertical: theme.spacing.s,
    marginHorizontal: theme.spacing.m,
    padding: theme.spacing.m,
    alignItems: 'center',
    ...theme.shadows.soft,
  },
  listImage: {
    width: 70,
    height: 70,
    borderRadius: theme.roundness,
    resizeMode: 'cover',
  },
  listContent: {
    flex: 1,
    marginLeft: theme.spacing.m,
    justifyContent: 'center',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listName: {
    ...theme.typography.subtitle,
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listCategory: {
    ...theme.typography.caption,
    fontSize: 13,
  },
  listDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listDistance: {
    ...theme.typography.caption,
    fontSize: 12,
  },
  listAction: {
    paddingLeft: theme.spacing.s,
  }
});

export default ShopCard;
