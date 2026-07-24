import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  ScrollView,
  FlatList,
  Modal,
} from 'react-native';
import {
  Plus,
  Search,
  Image as ImageIcon,
  Scale,
  Droplet,
  Box,
  Package,
  Trash2,
  ChevronLeft,
  Tag,
  Eye,
  Copy,
  Edit,
  X,
  Sparkles,
} from 'lucide-react-native';
import {
  getMockOwnerProducts,
  updateMockProductStock,
  addMockProduct,
  updateMockProduct,
  deleteMockProduct,
} from '../mockOwnerData';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UNITS = ['kg', 'g', 'L', 'mL', 'piece', 'pack'];
const CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Dairy', 'Staples', 'Other'];

export const ProductsScreen = () => {
  const insets = useSafeAreaInsets();
  // viewMode: 'list' | 'add' | 'edit' | 'details'
  const [viewMode, setViewMode] = useState('list');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formMrp, setFormMrp] = useState('');
  const [formUnit, setFormUnit] = useState('kg');
  const [formCategory, setFormCategory] = useState('Vegetables');
  const [formImage, setFormImage] = useState(null);
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMockOwnerProducts();
      setProducts(data);
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not load products.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleToggleStock = async (productId, currentStatus) => {
    const nextStatus = currentStatus === 'in_stock' ? 'out_of_stock' : 'in_stock';
    
    // Optimistic UI update
    setProducts(prev => 
      prev.map(p => p.id === productId ? { ...p, stock_status: nextStatus } : p)
    );

    try {
      await updateMockProductStock(productId, nextStatus);
      Toast.show({
        type: 'success',
        text1: 'Stock Updated',
        text2: `Stock status updated successfully.`,
      });
    } catch (e) {
      console.error(e);
      // Revert
      setProducts(prev => 
        prev.map(p => p.id === productId ? { ...p, stock_status: currentStatus } : p)
      );
    }
  };

  const selectProductImage = () => {
    const options = { mediaType: 'photo', quality: 0.8 };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.assets && response.assets.length > 0) {
        setFormImage(response.assets[0].uri);
      }
    });
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormPrice('');
    setFormMrp('');
    setFormUnit('kg');
    setFormCategory('Vegetables');
    setFormImage(null);
    setFormDesc('');
    setViewMode('add');
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormMrp((parseFloat(product.price) * 1.2).toFixed(2)); // mock MRP
    setFormUnit(product.unit || 'kg');
    setFormCategory(product.category || 'Vegetables');
    setFormImage(product.image_url);
    setFormDesc(product.description || 'Premium quality fresh stock sourced directly.');
    setViewMode('edit');
  };

  const handleOpenDetails = (product) => {
    setSelectedProduct(product);
    setViewMode('details');
  };

  const handleSaveProduct = async () => {
    if (!formName.trim() || !formPrice.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill name and price.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (viewMode === 'add') {
        const newProd = await addMockProduct({
          name: formName.trim(),
          price: formPrice,
          unit: formUnit,
          category: formCategory,
          image_url: formImage,
          description: formDesc,
        });
        setProducts(prev => [...prev, newProd]);
        Toast.show({
          type: 'success',
          text1: 'Product Added',
          text2: 'Successfully added new product to list.',
        });
      } else {
        const updated = await updateMockProduct(selectedProduct.id, {
          name: formName.trim(),
          price: formPrice,
          unit: formUnit,
          category: formCategory,
          image_url: formImage,
        });
        setProducts(prev => prev.map(p => p.id === selectedProduct.id ? updated : p));
        Toast.show({
          type: 'success',
          text1: 'Product Updated',
          text2: 'Product changes saved successfully.',
        });
      }
      setViewMode('list');
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to write product.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId) => {
    try {
      await deleteMockProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      Toast.show({
        type: 'success',
        text1: 'Product Deleted',
        text2: 'Product removed from inventory catalog.',
      });
      if (viewMode === 'details') setViewMode('list');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = (product) => {
    const dup = {
      ...product,
      id: Date.now(),
      name: `${product.name} (Copy)`,
    };
    setProducts(prev => [...prev, dup]);
    Toast.show({
      type: 'success',
      text1: 'Product Duplicated',
      text2: `Successfully duplicated "${product.name}".`,
    });
  };

  // Filtered Products
  const processedProducts = useMemo(() => {
    let result = [...products];

    // Filter by Category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }

    return result;
  }, [products, selectedCategory, searchQuery]);

  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Products Inventory</Text>
          <View style={styles.searchBar}>
            <Search color={theme.colors.textLight} size={20} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products in catalog..."
              placeholderTextColor={theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Horizontal Category Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{ paddingRight: 16 }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loaderText}>Syncing inventory catalog...</Text>
          </View>
        ) : (
          <FlatList
            data={processedProducts}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ImageIcon size={48} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptySub}>Add some items or change your category filters.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.productCard}>
                <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e' }} style={styles.productImg} />
                <View style={styles.productInfo}>
                  <View style={styles.badgeRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.category || 'Groceries'}</Text>
                    </View>
                    <View style={[
                      styles.stockBadge,
                      item.stock_status === 'in_stock' ? styles.stockIn : styles.stockOut
                    ]}>
                      <Text style={[
                        styles.stockBadgeText,
                        item.stock_status === 'in_stock' ? styles.stockInText : styles.stockOutText
                      ]}>
                        {item.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>
                    ₹{parseFloat(item.price).toFixed(2)} <Text style={styles.productUnit}>/ {item.unit || 'kg'}</Text>
                  </Text>
                  
                  {/* Stock Availability Switch Toggle */}
                  <View style={styles.availabilityRow}>
                    <Text style={styles.availabilityText}>Available for Order</Text>
                    <Switch
                      value={item.stock_status === 'in_stock'}
                      onValueChange={() => handleToggleStock(item.id, item.stock_status)}
                      trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }}
                      thumbColor={item.stock_status === 'in_stock' ? theme.colors.primary : '#F1F5F9'}
                    />
                  </View>

                  {/* Actions line */}
                  <View style={styles.productActions}>
                    <TouchableOpacity style={styles.actBtn} onPress={() => handleOpenDetails(item)}>
                      <Eye size={16} color={theme.colors.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actBtn, { marginLeft: 8 }]} onPress={() => handleDuplicate(item)}>
                      <Copy size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actBtn, { marginLeft: 8 }]} onPress={() => handleOpenEdit(item)}>
                      <Edit size={16} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actBtn, { marginLeft: 8 }]} onPress={() => handleDelete(item.id)}>
                      <Trash2 size={16} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        )}

        {/* Floating Add Product FAB */}
        <TouchableOpacity style={styles.fabBtn} onPress={handleOpenAdd}>
          <Plus color="#FFF" size={28} />
        </TouchableOpacity>
      </View>
    );
  }

  // Add & Edit Form Layout
  if (viewMode === 'add' || viewMode === 'edit') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.formHeader, { paddingTop: insets.top + 6, height: 56 + insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
            <ChevronLeft color={theme.colors.textDark} size={24} />
          </TouchableOpacity>
          <Text style={styles.formHeaderTitle}>{viewMode === 'add' ? 'Add Inventory Product' : 'Edit Product Profile'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.inputLabel}>Product Photo</Text>
          {formImage ? (
            <View style={styles.formImgContainer}>
              <Image source={{ uri: formImage }} style={styles.formImg} />
              <TouchableOpacity style={styles.replaceImgBtn} onPress={selectProductImage}>
                <Text style={styles.replaceImgText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.formImgPlaceholder} onPress={selectProductImage}>
              <ImageIcon color={theme.colors.primary} size={32} />
              <Text style={styles.formImgPlaceholderText}>Upload Product Image</Text>
            </TouchableOpacity>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.formLabel}>Product Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Fresh Organic Bananas"
              placeholderTextColor={theme.colors.textLight}
              value={formName}
              onChangeText={setFormName}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Selling Price (₹) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textLight}
                value={formPrice}
                onChangeText={setFormPrice}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>Market MRP (₹)</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textLight}
                value={formMrp}
                onChangeText={setFormMrp}
              />
            </View>
          </View>

          <Text style={styles.formLabel}>Measurement Unit *</Text>
          <View style={styles.unitsGrid}>
            {UNITS.map(unit => (
              <TouchableOpacity
                key={unit}
                style={[styles.unitChip, formUnit === unit && styles.unitChipActive]}
                onPress={() => setFormUnit(unit)}
              >
                <Text style={[styles.unitChipText, formUnit === unit && styles.unitChipTextActive]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.formLabel}>Category Group *</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryGridItem, formCategory === cat && styles.categoryGridItemSelected]}
                  onPress={() => setFormCategory(cat)}
                >
                  <Text style={[styles.categoryGridText, formCategory === cat && styles.categoryGridTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.formLabel}>Item Description (Optional)</Text>
            <TextInput
              style={[styles.formInput, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
              multiline={true}
              numberOfLines={3}
              placeholder="Source description, highlights, health benefits etc."
              placeholderTextColor={theme.colors.textLight}
              value={formDesc}
              onChangeText={setFormDesc}
            />
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSaveProduct} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Save Product Catalog</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Product Details Screen
  if (viewMode === 'details') {
    const product = selectedProduct;
    if (!product) return null;
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.formHeader, { paddingTop: insets.top + 6, height: 56 + insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
            <ChevronLeft color={theme.colors.textDark} size={24} />
          </TouchableOpacity>
          <Text style={styles.formHeaderTitle}>Product Profile</Text>
          <TouchableOpacity style={styles.trashHeaderBtn} onPress={() => handleDelete(product.id)}>
            <Trash2 color={theme.colors.error} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Image
            source={{ uri: product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e' }}
            style={styles.detailCoverImg}
          />

          <View style={styles.detailBody}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{product.category || 'Vegetables'}</Text>
              </View>
              <View style={[
                styles.stockBadge,
                product.stock_status === 'in_stock' ? styles.stockIn : styles.stockOut
              ]}>
                <Text style={[
                  styles.stockBadgeText,
                  product.stock_status === 'in_stock' ? styles.stockInText : styles.stockOutText
                ]}>
                  {product.stock_status === 'in_stock' ? 'Available' : 'Out of Stock'}
                </Text>
              </View>
            </View>

            <Text style={styles.detailName}>{product.name}</Text>
            
            <View style={styles.detailPriceCard}>
              <View>
                <Text style={styles.detailPriceLabel}>Store Selling Price</Text>
                <Text style={styles.detailPriceVal}>₹{parseFloat(product.price).toFixed(2)} <Text style={{ fontSize: 14, color: theme.colors.textLight }}>/ {product.unit || 'kg'}</Text></Text>
              </View>
              <View style={styles.detailMrpColumn}>
                <Text style={styles.detailPriceLabel}>Market MRP</Text>
                <Text style={styles.detailMrpVal}>₹{(parseFloat(product.price) * 1.25).toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.detailLabelHeader}>Description</Text>
            <Text style={styles.detailDescText}>
              {product.description || 'Premium quality fresh stock sourced directly. Highly recommended for daily consumption. Stored in clean and cold-storage settings.'}
            </Text>

            <View style={styles.detailHighlightBox}>
              <Sparkles size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.detailHighlightText}>This item qualifies for immediate express delivery area routes.</Text>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={() => handleOpenEdit(product)}>
              <Text style={styles.submitBtnText}>Edit Product details</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.m,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    height: '100%',
  },
  chipsScroll: {
    marginHorizontal: -4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  listContent: {
    padding: theme.spacing.m,
    paddingBottom: 80,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    ...theme.shadows.soft,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  productImg: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '850',
    color: theme.colors.textLight,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stockIn: {
    backgroundColor: '#DCFCE7',
  },
  stockInText: {
    color: '#15803D',
  },
  stockOut: {
    backgroundColor: '#FEE2E2',
  },
  stockOutText: {
    color: theme.colors.error,
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '850',
    color: theme.colors.primary,
    marginTop: 2,
  },
  productUnit: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '700',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  productActions: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  actBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4.65,
  },
  // Form header
  formHeader: {
    height: 56,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  formScroll: {
    padding: theme.spacing.m,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '850',
    color: theme.colors.textLight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  formImgContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border,
    position: 'relative',
    marginBottom: 16,
  },
  formImg: {
    width: '100%',
    height: '100%',
  },
  replaceImgBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  replaceImgText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '850',
  },
  formImgPlaceholder: {
    height: 120,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  formImgPlaceholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  row: {
    flexDirection: 'row',
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: 6,
    marginBottom: 6,
  },
  unitChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  unitChipTextActive: {
    color: theme.colors.primary,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryGridItem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    width: '31%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryGridItemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  categoryGridText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  categoryGridTextSelected: {
    color: theme.colors.primary,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...theme.shadows.medium,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '850',
  },
  // Detail elements
  detailCoverImg: {
    width: '100%',
    height: 240,
    backgroundColor: '#ECEFF1',
  },
  detailBody: {
    padding: theme.spacing.m,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '850',
    color: theme.colors.textDark,
    marginTop: 10,
  },
  detailPriceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginVertical: 14,
  },
  detailPriceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  detailPriceVal: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 2,
  },
  detailMrpColumn: {
    alignItems: 'flex-end',
  },
  detailMrpVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textLight,
    textDecorationLine: 'line-through',
    marginTop: 4,
  },
  detailLabelHeader: {
    fontSize: 14,
    fontWeight: '850',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  detailDescText: {
    fontSize: 14,
    color: theme.colors.textDark,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  detailHighlightText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    flex: 1,
  },
});
