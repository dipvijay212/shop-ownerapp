import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Plus, Minus, Heart } from 'lucide-react-native';

const ProductCard = ({ product, cartItem, onQtyChange, isWishlisted, onWishlistToggle, style, variant = 'vertical' }) => {
  const quantity = cartItem?.quantity || 0;

  if (variant === 'horizontal') {
    return (
      <View style={[styles.horizontalCard, style]}>
        <View style={styles.horizontalInfoContainer}>
          <View>
            <View style={{ width: 14, height: 14, borderWidth: 1, borderColor: '#006B54', justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderRadius: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#006B54' }} />
            </View>
            <Text style={styles.horizontalName} numberOfLines={2}>{product.name}</Text>
          </View>
          <Text style={styles.horizontalPrice}>₹{parseFloat(product.price).toFixed(2)}</Text>
        </View>
        <View style={styles.horizontalImageContainer}>
          <Image
            source={{ uri: product.image_url || 'https://via.placeholder.com/150' }}
            style={styles.horizontalImage}
          />
          <View style={styles.horizontalActionWrapper}>
            {quantity > 0 ? (
              <View style={styles.horizontalStepper}>
                <TouchableOpacity onPress={() => onQtyChange(product.id, quantity - 1)} style={styles.horizontalStepperBtn}>
                  <Minus color="#006B54" size={14} />
                </TouchableOpacity>
                <Text style={styles.horizontalStepperText}>{quantity}</Text>
                <TouchableOpacity onPress={() => onQtyChange(product.id, quantity + 1)} style={styles.horizontalStepperBtn}>
                  <Plus color="#006B54" size={14} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.horizontalAddButton} onPress={() => onQtyChange(product.id, 1)}>
                <Text style={styles.horizontalAddText}>ADD</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.image_url || 'https://via.placeholder.com/150' }}
          style={[styles.image, product.stock_status === 'out_of_stock' && { opacity: 0.5 }]}
        />
        {onWishlistToggle && (
          <TouchableOpacity 
            style={styles.wishlistButton} 
            onPress={() => onWishlistToggle(product.id, isWishlisted)}
          >
            <Heart 
              color={isWishlisted ? theme.colors.error : '#333'} 
              fill={isWishlisted ? theme.colors.error : 'transparent'} 
              size={18} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.priceRow}>
          <Text style={styles.price}>₹{parseFloat(product.price).toFixed(2)}</Text>
          <Text style={styles.unit}> / {product.unit}</Text>
        </Text>

        {quantity > 0 ? (
          <View style={styles.stepperContainer}>
            <TouchableOpacity 
              style={styles.stepperButtonOutline} 
              onPress={() => onQtyChange(product.id, quantity - 1)}
            >
              <Minus color="#333" size={16} />
            </TouchableOpacity>
            <Text style={styles.stepperText}>{quantity}</Text>
            <TouchableOpacity 
              style={styles.stepperButtonSolid} 
              onPress={() => onQtyChange(product.id, quantity + 1)}
            >
              <Plus color="#FFF" size={16} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.addButton, product.stock_status === 'out_of_stock' && styles.disabledButton]}
            onPress={() => onQtyChange(product.id, 1)}
            disabled={product.stock_status === 'out_of_stock'}
          >
            {product.stock_status !== 'out_of_stock' && <Plus color="#FFF" size={14} style={{marginRight: 4}} />}
            <Text style={[styles.addText, product.stock_status === 'out_of_stock' && styles.disabledAddText]}>
              {product.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12, // Slightly less rounded in mockup
    margin: 8,
    maxWidth: '46%', // Ensures 2 column layout fits nicely
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    // Removed drop shadow to match flat mockup style
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F9F9F9',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    fontWeight: 'bold',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    ...theme.typography.body,
    color: '#333',
    marginBottom: 6,
    height: 40,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  price: {
    ...theme.typography.subtitle,
    color: '#006B54',
    fontSize: 15,
    fontWeight: 'bold',
  },
  unit: {
    ...theme.typography.caption,
    fontSize: 11,
    color: '#666',
    marginLeft: 2,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#006B54',
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
  },
  addText: {
    color: '#FFF',
    fontWeight: '500',
    fontSize: 13,
  },
  disabledAddText: {
    color: '#9CA3AF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA', // Slight grey fill from mockup
    borderRadius: 20,
    padding: 2,
  },
  stepperButtonOutline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepperButtonSolid: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006B54',
  },
  stepperText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: '#333',
    fontSize: 14,
  },
  
  // Horizontal Variant Styles
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 12,
    marginVertical: 6,
    width: 280, // Default width, can be overridden by style
    height: 130,
  },
  horizontalInfoContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  horizontalName: {
    ...theme.typography.body,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  horizontalPrice: {
    ...theme.typography.subtitle,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  horizontalImageContainer: {
    width: 100,
    height: 100,
    position: 'relative',
    alignItems: 'center',
  },
  horizontalImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  horizontalActionWrapper: {
    position: 'absolute',
    bottom: -12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    ...theme.shadows.soft,
    elevation: 4,
    minWidth: 70,
  },
  horizontalAddButton: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  horizontalAddText: {
    color: '#006B54',
    fontWeight: 'bold',
    fontSize: 13,
  },
  horizontalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  horizontalStepperBtn: {
    padding: 2,
  },
  horizontalStepperText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#333',
    marginHorizontal: 8,
  }
});

export default ProductCard;
