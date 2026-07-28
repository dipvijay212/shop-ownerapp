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
  KeyboardAvoidingView,
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
  ChevronDown,
  Check,
  Tag,
  Eye,
  Edit,
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

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogram (kg)', symbol: 'kg' },
  { value: 'g', label: 'Gram (g)', symbol: 'g' },
  { value: 'L', label: 'Liter (L)', symbol: 'L' },
  { value: 'mL', label: 'Milliliter (mL)', symbol: 'mL' },
  { value: 'piece', label: 'Piece / Item', symbol: 'pc' },
  { value: 'pack', label: 'Pack / Bundle', symbol: 'pk' },
  { value: 'dozen', label: 'Dozen (12 pcs)', symbol: 'doz' },
  { value: '5kg bag', label: '5 Kilogram Bag', symbol: '5kg' },
  { value: '10kg bag', label: '10 Kilogram Bag', symbol: '10kg' },
];
const DEFAULT_FORM_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Dairy & Breakfast',
  'Staples & Grains',
  'Beverages & Drinks',
  'Snacks & Biscuits',
  'Bakery & Sweets',
  'Personal Care',
  'Cleaning & Household',
  'Baby Care',
  'Frozen Foods',
  'Other',
];

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
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filterCategories = useMemo(() => {
    const custom = products.map(p => p.category).filter(c => c && c !== 'All');
    const defaults = ['Vegetables', 'Fruits', 'Dairy', 'Staples', 'Other'];
    return ['All', ...new Set([...defaults, ...custom])];
  }, [products]);

  const formCategoryOptions = useMemo(() => {
    const custom = products.map(p => p.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_FORM_CATEGORIES, ...custom])).sort();
  }, [products]);

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
    setShowUnitDropdown(false);
    setShowCategoryDropdown(false);
    setCategorySearchQuery('');
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
    setShowUnitDropdown(false);
    setShowCategoryDropdown(false);
    setCategorySearchQuery('');
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
            {filterCategories.map(cat => (
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

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}>
          <ScrollView
            style={styles.formScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 340, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
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

          <View style={styles.inputGroup}>
            <Text style={styles.formLabel}>Measurement Unit *</Text>
            <TouchableOpacity 
              style={[styles.dropdownBtn, showUnitDropdown && styles.dropdownBtnOpen]} 
              onPress={() => {
                setShowUnitDropdown(!showUnitDropdown);
                setShowCategoryDropdown(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownBtnLeft}>
                <View style={styles.symbolBadge}>
                  <Text style={styles.symbolBadgeText}>
                    {UNIT_OPTIONS.find(u => u.value === formUnit)?.symbol || formUnit}
                  </Text>
                </View>
                <Text style={styles.dropdownBtnText}>
                  {UNIT_OPTIONS.find(u => u.value === formUnit)?.label || formUnit}
                </Text>
              </View>
              <ChevronDown size={20} color={theme.colors.textDark} style={{ transform: [{ rotate: showUnitDropdown ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {showUnitDropdown && (
              <View style={styles.dropdownList}>
                {UNIT_OPTIONS.map((unit, index) => {
                  const isSelected = formUnit === unit.value;
                  return (
                    <TouchableOpacity
                      key={unit.value}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                        index === UNIT_OPTIONS.length - 1 && { borderBottomWidth: 0 }
                      ]}
                      onPress={() => {
                        setFormUnit(unit.value);
                        setShowUnitDropdown(false);
                      }}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <View style={[styles.symbolBadge, isSelected && styles.symbolBadgeActive]}>
                          <Text style={[styles.symbolBadgeText, isSelected && styles.symbolBadgeTextActive]}>
                            {unit.symbol}
                          </Text>
                        </View>
                        <Text style={[styles.dropdownItemLabel, isSelected && styles.dropdownItemLabelActive]}>
                          {unit.label}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color={theme.colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.formLabel}>Category Group *</Text>
            <TouchableOpacity
              style={[styles.dropdownBtn, showCategoryDropdown && styles.dropdownBtnOpen]}
              onPress={() => {
                setShowCategoryDropdown(!showCategoryDropdown);
                setShowUnitDropdown(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownBtnLeft}>
                <View style={[styles.symbolBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Tag size={18} color="#2563EB" />
                </View>
                <Text style={styles.dropdownBtnText}>{formCategory || 'Select or add category...'}</Text>
              </View>
              <ChevronDown size={20} color={theme.colors.textDark} style={{ transform: [{ rotate: showCategoryDropdown ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>

            {showCategoryDropdown && (
              <View style={styles.dropdownList}>
                {/* Search / Custom Input Bar */}
                <View style={styles.catSearchContainer}>
                  <Search size={18} color={theme.colors.textLight} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.catSearchInput}
                    placeholder="Search or type custom category..."
                    placeholderTextColor={theme.colors.textLight}
                    value={categorySearchQuery}
                    onChangeText={setCategorySearchQuery}
                    numberOfLines={1}
                    multiline={false}
                  />
                  {categorySearchQuery.trim().length > 0 && (
                    <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                      <Text style={{ color: theme.colors.textLight, fontWeight: '700', fontSize: 14 }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled={true}>
                  {/* Custom Category Add Option if query doesn't exactly match an existing category */}
                  {categorySearchQuery.trim().length > 0 && !formCategoryOptions.some(c => c.toLowerCase() === categorySearchQuery.trim().toLowerCase()) && (
                    <TouchableOpacity
                      style={styles.customCatItem}
                      onPress={() => {
                        const newCat = categorySearchQuery.trim();
                        setFormCategory(newCat);
                        setCategorySearchQuery('');
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <View style={styles.addCustomBadge}>
                          <Plus size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.customCatLabel}>
                          Add custom: "{categorySearchQuery.trim()}"
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Filtered Preset & Existing Categories */}
                  {formCategoryOptions
                    .filter(cat => cat.toLowerCase().includes(categorySearchQuery.trim().toLowerCase()))
                    .map((cat, index, arr) => {
                      const isSelected = formCategory === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                            index === arr.length - 1 && { borderBottomWidth: 0 }
                          ]}
                          onPress={() => {
                            setFormCategory(cat);
                            setCategorySearchQuery('');
                            setShowCategoryDropdown(false);
                          }}
                        >
                          <View style={styles.dropdownItemLeft}>
                            <View style={[styles.symbolBadge, isSelected && styles.symbolBadgeActive]}>
                              <Text style={[styles.symbolBadgeText, isSelected && styles.symbolBadgeTextActive, { fontSize: 12 }]}>
                                {cat.slice(0, 3).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={[styles.dropdownItemLabel, isSelected && styles.dropdownItemLabelActive]}>
                              {cat}
                            </Text>
                          </View>
                          {isSelected && <Check size={18} color={theme.colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}

                  {/* No results message when search matches nothing and option above is shown */}
                  {formCategoryOptions.filter(cat => cat.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())).length === 0 && (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>
                        No preset category matching "{categorySearchQuery.trim()}". Tap option above to add it as custom!
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
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
        </KeyboardAvoidingView>
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
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 14,
  },
  dropdownBtnOpen: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  dropdownBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginRight: 10,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  symbolBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  symbolBadgeTextActive: {
    color: '#16A34A',
  },
  dropdownBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemSelected: {
    backgroundColor: '#F7FEE7',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemLabelActive: {
    fontWeight: '800',
    color: '#16A34A',
  },
  catSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  catSearchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textDark,
    height: '100%',
    fontWeight: '600',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  customCatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#DCFCE7',
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  addCustomBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customCatLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
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
