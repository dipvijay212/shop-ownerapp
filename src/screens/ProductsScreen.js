import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  ScrollView,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  BackHandler,
  StatusBar,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PillToggle } from '../components/PillToggle';
import ConfirmSheet from '../components/ConfirmSheet';
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
  X,
  Repeat,
} from 'lucide-react-native';
import { api } from '../api';
import { getErrorText } from '../api/errors';
import { adaptProduct } from '../api/adapters';
import { theme } from '../theme';
import { to12h } from '../utils/time';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../constants/translations';
import { useScreenPadding } from '../hooks/useScreenPadding';
import ProductFormScreen from './ProductFormScreen';

// GET /owner/units → { code, label, kind, base_label, tiers[] }. Mapped to the
// { value, label, symbol } the picker renders. The unit drives the server's
// tier engine (D1), so the code must come from this master, never free text.
const toUnitOption = (u) => {
  const codeStr = String(u.code || '').toLowerCase();
  let shortName = u.code;
  if (codeStr === 'ml') shortName = 'ml';
  else if (codeStr === 'l') shortName = 'l';
  else if (codeStr === 'kg') shortName = 'kg';
  else if (codeStr === 'g' || codeStr === 'gm') shortName = 'g';
  else if (codeStr === 'pack') shortName = 'pack';
  else if (codeStr === 'pc') shortName = 'pc';
  else if (codeStr === 'dozen') shortName = 'dozen';

  const fullLabel = shortName;

  return {
    value: u.code,
    label: fullLabel,
    shortName: shortName,
    symbol: u.code,
    code: u.code,
    baseLabel: u.base_label,
    kind: u.kind,
  };
};

export const findMatchingUnitCode = (target, options) => {
  if (!target || !options || !options.length) return null;
  const t = String(target).toLowerCase().trim();
  const found = options.find((u) => {
    const code = String(u.code || u.value || '').toLowerCase().trim();
    const shortName = String(u.shortName || '').toLowerCase().trim();
    const label = String(u.label || '').toLowerCase().trim();
    const baseLabel = u.baseLabel ? String(u.baseLabel).toLowerCase().trim() : '';
    return code === t || shortName === t || label === t || baseLabel === t;
  });
  return found ? (found.code || found.value) : null;
};

/**
 * "+0.25 kg" is not how anyone asks for potatoes. Below a whole unit, weight
 * and volume read in the smaller unit the shop actually says out loud.
 */
const SHORT_UNITS = {
  kilogram: 'kg',
  kg: 'kg',
  grams: 'g',
  gram: 'g',
  g: 'g',
  gm: 'g',
  litre: 'l',
  l: 'l',
  millilitre: 'ml',
  ml: 'ml',
  pack: 'pack',
  piece: 'pc',
  pc: 'pc',
  dozen: 'dozen',
};

export const normalizeQty = (amount, unitCode) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const codeStr = String(unitCode ?? '').toLowerCase().trim();
  const u = SHORT_UNITS[codeStr] || codeStr;
  if ((u === 'kg' || u === 'l') && n >= 10) {
    return n / 1000;
  }
  return n;
};

export const formatStep = (amount, unitCode) => {
  const n = Number(amount);
  const codeStr = String(unitCode ?? '').toLowerCase().trim();
  const u = SHORT_UNITS[codeStr] || codeStr;

  if (!Number.isFinite(n)) return `${amount} ${u}`;

  if (u === 'kg') {
    if (n < 1 && n > 0) {
      const gVal = Math.round(n * 1000);
      return `${gVal} g`;
    }
    const cleanNum = Number(n.toFixed(3));
    return `${cleanNum} kg`;
  }

  if (u === 'l') {
    if (n < 1 && n > 0) {
      const mlVal = Math.round(n * 1000);
      return `${mlVal} ml`;
    }
    const cleanNum = Number(n.toFixed(3));
    return `${cleanNum} l`;
  }

  if (u === 'g' || u === 'ml') {
    if (n >= 1000 && n % 1000 === 0) {
      const bigVal = n / 1000;
      return `${bigVal} ${u === 'g' ? 'kg' : 'l'}`;
    }
    const cleanNum = Number(n.toFixed(3));
    return `${cleanNum} ${u}`;
  }

  const cleanNum = Number(n.toFixed(3));
  return `${cleanNum} ${u}`;
};

const getStepOptions = (unitCode) => {
  const code = String(unitCode || '').toLowerCase().trim();
  if (code === 'g' || code === 'gm' || code === 'grams' || code === 'gram') {
    return [
      { val: '50', label: '+50g' },
      { val: '100', label: '+100g' },
      { val: '250', label: '+250g' },
      { val: '500', label: '+500g' },
      { val: '1000', label: '+1kg' },
    ];
  }
  if (code === 'ml' || code === 'millilitre') {
    return [
      { val: '50', label: '+50ml' },
      { val: '100', label: '+100ml' },
      { val: '250', label: '+250ml' },
      { val: '500', label: '+500ml' },
      { val: '1000', label: '+1L' },
    ];
  }
  if (code === 'kg' || code === 'kilogram') {
    return [
      { val: '0.25', label: '+250g' },
      { val: '0.5', label: '+500g' },
      { val: '1', label: '+1kg' },
      { val: '2', label: '+2kg' },
      { val: '5', label: '+5kg' },
    ];
  }
  if (code === 'l' || code === 'litre') {
    return [
      { val: '0.25', label: '+250ml' },
      { val: '0.5', label: '+500ml' },
      { val: '1', label: '+1L' },
      { val: '2', label: '+2L' },
      { val: '5', label: '+5L' },
    ];
  }
  return [
    { val: '1', label: '+1' },
    { val: '2', label: '+2' },
    { val: '5', label: '+5' },
    { val: '10', label: '+10' },
  ];
};

const isProductLoose = (p) => {
  if (!p) return false;
  if (p.saleMode) return p.saleMode === 'loose';
  if (p.sale_mode) return p.sale_mode === 'loose';
  if (p.productType) return p.productType === 'loose';
  return false;
};

const getPrimaryDisplayPack = (item) => {
  if (!item) return null;
  const packs = item.pack_options || item.tiers || [];
  if (isProductLoose(item)) {
    const match = packs.find(p => p.is_base === true || p.is_default === true)
      || packs.find(p => Number(p.multiplier) === 500)
      || packs.find(p => Number(p.multiplier) === 1000)
      || packs.find(p => Number(p.price) === Number(item.price))
      || packs.find(p => Number(p.multiplier) === 1)
      || packs[0];
    return match;
  }
  return packs.find(p => p.is_default || p.is_base) || packs[0];
};

// How a unit reads on a price line: kg, g, L, ml, pc, dozen.
const UNIT_SYMBOL = { kg: 'kg', g: 'gm', gm: 'gm', l: 'L', ml: 'ml', pc: 'pc', dozen: 'dozen' };

/**
 * What the catalogue card quotes.
 *
 * The owner's DEFAULT OPTION, because that is the thing they configured. This
 * used to read the derived tier ladder and show its first rung, so a shop that
 * entered "₹30 per kg, from 250 g" saw "₹7.50 / 250 g" on the card — the right
 * arithmetic against the wrong quantity, and not a price they ever typed.
 *
 * Falls back to the old ladder for a product that has no options yet.
 */
const getCardPrice = (item) => {
  const options = item?.options || [];
  const option = options.find((o) => o.isDefault) || options[0];

  if (option) {
    const symbol = UNIT_SYMBOL[String(option.qtyUnit).toLowerCase()] || option.qtyUnit;
    if (isProductLoose(item)) {
      // "₹30.00 / kg", or "₹4.50 / 100 g" where the shop prices per 100 g.
      const qty = Number(option.qtyValue);
      return { price: Number(option.price).toFixed(2), unit: qty === 1 ? symbol : `${qty} ${symbol}` };
    }
    // Packed: the server's own label — "500 ml Bottle", "Pack of 4".
    // The card names ONE option beside a price, so it wants the short form —
    // "Pack of 6", not "Pack of 6 · 250 ml Bottle".
    return { price: Number(option.price).toFixed(2), unit: option.shortLabel || option.label || symbol };
  }

  const primaryPack = getPrimaryDisplayPack(item);
  return {
    price: primaryPack?.price != null ? parseFloat(primaryPack.price).toFixed(2) : parseFloat(item.price).toFixed(2),
    unit: primaryPack ? formatPackName(primaryPack.pack_name, item.unit) : item.unit || 'kg',
  };
};

/**
 * The strip under the name. A packed product lists what it is sold as; a loose
 * one has a single price, so what is worth saying is where the customer's
 * stepper starts and how far a tap moves it.
 */
const getCardOptionsSummary = (item) => {
  const options = item?.options || [];
  if (options.length === 0) return null;

  if (isProductLoose(item)) {
    const o = options.find((x) => x.isDefault) || options[0];
    if (o?.minQty == null || o?.stepQty == null) return null;
    return `From ${formatBaseAmount(o.minQty, o.qtyUnit)} · steps of ${formatBaseAmount(o.stepQty, o.qtyUnit)}`;
  }
  return options.map((o) => `${o.shortLabel || o.label} (₹${Number(o.price).toFixed(2)})`).join(' • ');
};

/** An amount in grams / millilitres / pieces, written the way a shelf writes it. */
const formatBaseAmount = (amount, unitCode) => {
  const n = Number(amount) || 0;
  const code = String(unitCode || '').toLowerCase();
  const trim = (v) => String(Number(v.toFixed(3)));
  if (code === 'ml' || code === 'l') return n >= 1000 ? `${trim(n / 1000)} L` : `${trim(n)} ml`;
  if (code === 'g' || code === 'gm' || code === 'kg') return n >= 1000 ? `${trim(n / 1000)} kg` : `${trim(n)} gm`;
  return `${trim(n)} pc`;
};

const formatPackName = (packName, unit) => {
  if (!packName) return unit || 'pack';
  const str = String(packName).trim();
  if (/^Pack of \d+/i.test(str)) {
    return str;
  }
  const cleanUnitStr = String(unit || '').toLowerCase().trim();
  const isPackOrCountUnit = cleanUnitStr.includes('pack') || cleanUnitStr === 'pc' || cleanUnitStr.includes('piece') || cleanUnitStr === 'count';

  if (/^\d+(\.\d+)?$/.test(str)) {
    if (isPackOrCountUnit) {
      return `Pack of ${str}`;
    }
    const cleanUnit = String(unit).replace(/^\d+\s*/, '');
    return `${str} ${cleanUnit}`;
  }
  return str;
};
// Categories and units are no longer hardcoded here — they come from
// GET /owner/product-categories and GET /owner/units, because the create/update
// payloads reference them by id/code rather than by display name.

// What a packed product physically comes in. Deliberately NOT measurement
// units: the unit is how it is measured and priced, this is what it looks
// like on the shelf. A 1 L bottle and a 1 L pouch ladder identically.
const PACK_CONTAINERS = [
  'packet', 'pack', 'pouch', 'box', 'bottle', 'jar', 'cup', 'container',
  'can', 'tin', 'bag', 'sachet', 'tray', 'roll', 'bundle', 'set',
];
const containerLabel = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : '');

export const ProductsScreen = () => {
  // Lists must clear the device's navigation bar, whatever height it is.
  const screenPad = useScreenPadding(72);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const formScrollRef = useRef(null);
  // Validation used to fire a toast that named the problem and then left the
  // owner to find the field, which on this long form is often off-screen.
  const [formErrors, setFormErrors] = useState({});
  const formFieldY = useRef({});
  const captureFormY = (field) => (e) => { formFieldY.current[field] = e.nativeEvent.layout.y; };
  const clearFormError = (field) =>
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  const failValidation = (field, message) => {
    setFormErrors({ [field]: message });
    const y = formFieldY.current[field];
    if (y !== undefined) formScrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  };
  const { t } = useTranslation();
  // viewMode: 'list' | 'add' | 'edit' | 'details'
  const [viewMode, setViewMode] = useState('list');

  // Handle hardware back button navigation for ProductsScreen subviews
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (viewMode !== 'list') {
          setViewMode('list');
          return true; // Intercept hardware back and return to product list
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [viewMode])
  );

  // Which sections the shop belongs to is edited on ANOTHER screen (Business
  // Profile), so the category list goes stale the moment it changes. It was
  // read once on mount, which is why dropping a section left its categories
  // still on offer here. Re-read whenever this screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api.products
        .listProductCategories()
        .then((res) => {
          if (cancelled) return;
          setApiCategories(res?.data ?? res ?? []);
          // The full list carries "would this add a section?" flags, which are
          // relative to the shop's sections — so it has to be re-read too.
          setAllCategories([]);
          setShowAllCategories(false);
        })
        .catch(() => {
          // Keep whatever is already loaded; the form still validates server-side.
        });
      return () => { cancelled = true; };
    }, []),
  );

  // Categories arrive after the form can be opened, and the shop's sections can
  // change on another screen. In the ADD form the selection has to follow;
  // in EDIT it must not, or opening a product would refile it.
  useEffect(() => {
    if (viewMode !== 'add') return;
    const options = [...apiCategories, ...allCategories];
    if (options.length === 0) return;
    if (!options.some((c) => c.name === formCategory)) {
      setFormCategory(apiCategories[0]?.name ?? '');
    }
  }, [viewMode, apiCategories, allCategories, formCategory]);

  // Reset viewMode when user re-taps the 'Products' tab item
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setViewMode('list');
    });
    return unsubscribe;
  }, [navigation]);
  const [products, setProducts] = useState([]);
  // Server-owned masters backing the form pickers.
  const [apiCategories, setApiCategories] = useState([]);
  // The full master list, loaded on demand behind "Selling something else?".
  // The picker shows only the shop's own sections until then, so a grocery is
  // not casually offered Vegetables — filing a product under a section the
  // shop is not listed in is what hid shops from the Home filter.
  const [allCategories, setAllCategories] = useState([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [apiUnits, setApiUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  // The product the owner is being asked about before it is deleted, together
  // with what the server said it would cost: { id, name, check, loading,
  // blocked }. Null when no question is on screen.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form states for Add/Edit
  const [productType, setProductType] = useState('packed'); // 'packed' | 'loose'
  const [packQty, setPackQty] = useState('1');
  // What one container HOLDS — 1 (L) in a bottle, 250 (g) in a packet. The
  // unit says what it is called; this says how much is inside, which is the
  // only thing separating a 500 g bag of sugar from a 1 kg one.
  const [packSizeValue, setPackSizeValue] = useState('');
  const [packSizeUnit, setPackSizeUnit] = useState('g');
  const [packContainer, setPackContainer] = useState('');
  const [looseSellingQty, setLooseSellingQty] = useState('1');
  const [looseMinQty, setLooseMinQty] = useState('1');
  const [looseStep, setLooseStep] = useState('1');
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formMrp, setFormMrp] = useState('');
  const [formUnit, setFormUnit] = useState('kg');
  const [formCategory, setFormCategory] = useState('Vegetables');
  const [formImage, setFormImage] = useState(null);
  const [formDesc, setFormDesc] = useState('');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [unitY, setUnitY] = useState(180);
  const [categoryY, setCategoryY] = useState(360);
  const [submitting, setSubmitting] = useState(false);

  // Custom Pack Variants State
  const [hasPackOptions, setHasPackOptions] = useState(false);
  // What this product may be sold as, and whether a standing order pays the
  // shop's delivery fee. Off by default: a ₹30 fee on a ₹25 daily item is not
  // a real arrangement.
  const [productKind, setProductKind] = useState('normal');
  const [chargeSubDelivery, setChargeSubDelivery] = useState(false);
  // When this product goes out. It belongs to the product, not the shop —
  // customers subscribing inherit it and never pick a time themselves.
  const [windowStart, setWindowStart] = useState('06:00');
  const [windowEnd, setWindowEnd] = useState('08:00');
  const [pickingWindow, setPickingWindow] = useState(null); // 'start' | 'end'
  const [packOptions, setPackOptions] = useState([
    { id: '1', pack_name: 'Small Pack', price: '', mrp: '', is_default: true },
    { id: '2', pack_name: 'Family Pack', price: '', mrp: '', is_default: false }
  ]);

  // Filter chips: the real category master, plus anything already on a product
  // (a category can be deactivated while products still reference it).
  // Chips filter THIS catalogue, so they come from the categories the shop
  // actually stocks. Including the master list meant chips for categories with
  // no products behind them, every one of which filtered to an empty screen.
  // (The add/edit form still offers the full server list — see
  // `formCategoryOptions` — because that is where a new category is chosen.)
  const filterCategories = useMemo(() => {
    const inUse = products.map((p) => p.category).filter((c) => c && c !== 'All');
    return ['All', ...new Set(inUse)];
  }, [products]);

  // Only categories the server actually knows — picking anything else would
  // fail validation, since the payload sends category_id.
  const visibleCategories = showAllCategories && allCategories.length ? allCategories : apiCategories;

  const formCategoryOptions = useMemo(
    () => [...visibleCategories].sort((a, b) => a.name.localeCompare(b.name)),
    [visibleCategories],
  );

  // Loaded lazily: most owners never need the full list.
  const revealAllCategories = useCallback(async () => {
    setShowAllCategories(true);
    if (allCategories.length > 0) return;
    try {
      const res = await api.products.listProductCategories(true);
      setAllCategories(res?.data ?? res ?? []);
    } catch (e) {
      // Falling back to the scoped list is better than an empty picker.
      setShowAllCategories(false);
    }
  }, [allCategories.length]);

  // "Add custom: …" only ever set a name locally, so saving then failed with
  // "Pick a category from the list" — the category was never created. It is
  // created on the server now, which is also what gives it a parent section.
  const createCustomCategory = useCallback(
    async (name) => {
      const clean = (name || '').trim();
      if (!clean) return;
      try {
        const res = await api.products.createProductCategory(clean);
        const created = res?.data ?? res;
        setApiCategories((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [...prev, created],
        );
        setFormCategory(created.name);
        setCategorySearchQuery('');
        setShowCategoryDropdown(false);
      } catch (e) {
        Toast.show({ type: 'error', text1: getErrorText(e) });
      }
    },
    [],
  );

  // Picking a category outside the shop's sections changes where the shop is
  // listed, so it is said out loud rather than done quietly.
  const chooseCategory = useCallback(
    (cat) => {
      const commit = () => {
        setFormCategory(cat.name);
        setCategorySearchQuery('');
        setShowCategoryDropdown(false);
      };
      if (!cat.adds_shop_category || !cat.shop_category?.name) return commit();
      Alert.alert(
        t('addsSectionTitle'),
        t('addsSectionBody', { category: cat.name, section: cat.shop_category.name }),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          { text: t('addsSectionConfirm'), onPress: commit },
        ],
      );
    },
    [t],
  );

  const allUnitOptions = useMemo(
    () => apiUnits.filter((u) => !/^bag/i.test(u.code || '') && !/^bag/i.test(u.label || '') && String(u.code || '').toLowerCase() !== 'pack').map(toUnitOption),
    [apiUnits],
  );

  // A packed product can be measured any way the packet is: a 1 L pouch, a
  // 500 g biscuit pack, a dozen eggs. Loose is weight or volume only — you
  // cannot scoop out "a pack" of sugar.
  //
  // Because the two now share units, the unit no longer says which is which.
  // `sale_mode` on the product does, and it is what the form sends.
  const unitOptions = useMemo(
    () =>
      productType === 'loose'
        ? allUnitOptions.filter((u) => u.kind === 'weight' || u.kind === 'volume')
        : allUnitOptions,
    [allUnitOptions, productType],
  );

  // Pack variants only make sense for the 'pack' unit — a weight or volume
  // product is already sold by its tier ladder (100g, 250g, 1kg …), which the
  // server derives from the base price.
  const selectedUnit = useMemo(
    () => apiUnits.find((u) => u.label === formUnit || u.code === formUnit),
    [apiUnits, formUnit],
  );

  // Switching how the product is sold must carry the unit with it, or the form
  // keeps a unit the picker no longer offers and saves the contradiction.
  useEffect(() => {
    if (!unitOptions.length) return;
    const matchedCode = findMatchingUnitCode(formUnit, unitOptions);
    if (matchedCode) {
      if (formUnit !== matchedCode) {
        setFormUnit(matchedCode);
      }
    } else {
      setFormUnit(unitOptions[0].value || unitOptions[0].code);
    }
  }, [unitOptions, formUnit]);
  const supportsPackVariants = productType === 'packed';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Categories and units are server-owned masters: the form submits
      // category_id and unit_code, never the display names it used to invent.
      const [productsRes, categoriesRes, unitsRes] = await Promise.allSettled([
        api.products.listProducts({ status: 'all', limit: 100 }),
        api.products.listProductCategories(),
        api.products.listUnits(),
      ]);

      if (productsRes.status === 'fulfilled') {
        setProducts((productsRes.value?.items || []).map(adaptProduct));
      } else {
        throw productsRes.reason;
      }
      if (categoriesRes.status === 'fulfilled') {
        setApiCategories(categoriesRes.value || []);
      }
      if (unitsRes.status === 'fulfilled') {
        setApiUnits(unitsRes.value || []);
      }
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        text2: t('couldNotLoadProducts'),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleToggleStock = async (productId, currentStatus) => {
    const newStatus = currentStatus === 'in_stock' ? 'out_of_stock' : 'in_stock';
    const nextAvailable = newStatus === 'in_stock';
    // Optimistic: the switch should feel instant, and a failure re-syncs below.
    setProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, stock_status: newStatus, inStock: nextAvailable } : p)
    );

    try {
      await api.products.setAvailability(productId, nextAvailable);
    } catch (e) {
      console.error('[Products] availability toggle failed', e);
      Toast.show({
        type: 'error',
        text1: t('couldNotUpdateAvailability'),
        text2: e.message || 'Please try again.',
      });
      fetchProducts();
    }
  };

  const selectProductImage = () => {
    const options = { mediaType: 'photo', quality: 0.8 };
    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorCode) return;
      if (response.assets && response.assets.length > 0) {
        setFormImage(response.assets[0].uri);
      }
    });
  };

  const handleAddPackVariant = () => {
    setPackOptions(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        pack_name: '',
        price: '',
        mrp: '',
        is_default: prev.length === 0
      }
    ]);
  };

  const handleRemovePackVariant = (index) => {
    setPackOptions(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some(p => p.is_default)) {
        next[0].is_default = true;
      }
      return next;
    });
  };

  const handleUpdatePackVariant = (index, key, value) => {
    setPackOptions(prev => prev.map((p, i) => {
      if (i === index) {
        if (key === 'is_default') {
          return { ...p, is_default: true };
        }
        let sanitizedVal = value;
        if (key === 'pack_name') {
          sanitizedVal = value.replace(/[^0-9]/g, '');
        }
        return { ...p, [key]: sanitizedVal };
      }
      if (key === 'is_default' && value === true) {
        return { ...p, is_default: false };
      }
      return p;
    }));
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormPrice('');
    setFormMrp('');
    setProductType('packed');
    setPackSizeValue('');
    setPackSizeUnit('g');
    setPackContainer('');
    setPackQty('1');
    setLooseSellingQty('1');
    setLooseMinQty('1');
    setLooseStep('1');
    setFormUnit('g');
    setFormCategory(apiCategories[0]?.name ?? '');
    setFormImage(null);
    setFormDesc('');
    setProductKind('normal');
    setChargeSubDelivery(false);
    setWindowStart('06:00');
    setWindowEnd('08:00');
    setHasPackOptions(false);
    setPackOptions([
      { id: '1', pack_name: '4', price: '', mrp: '', is_default: false },
      { id: '2', pack_name: '6', price: '', mrp: '', is_default: true }
    ]);
    setShowUnitDropdown(false);
    setShowUnitModal(false);
    setShowCategoryDropdown(false);
    setCategorySearchQuery('');
    setViewMode('add');
  };

  // Turning custom packs ON hides the single price/MRP inputs, so clear them:
  // a value the owner can no longer see should not be sitting in the form.
  // Turning it OFF leaves the pack rows alone — flipping back and forth must
  // not destroy what was typed.
  const handleTogglePackOptions = (enabled) => {
    setHasPackOptions(enabled);
    if (enabled) {
      setFormPrice('');
      setFormMrp('');
    }
  };

  // The form seeds itself from the product now — it holds the option rows, and
  // this used to unpack a ladder into a dozen pieces of local state just to
  // reassemble them on save.
  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setViewMode('edit');
  };

  const handleOpenDetails = (product) => {
    setSelectedProduct(product);
    setViewMode('details');
  };


  /**
   * Deleting used to happen on the tap itself, with no question asked and no
   * idea what it would take with it. Ask the server first: it knows whether an
   * order is still owed, and how many customers subscribe to this.
   */
  const handleDelete = async (productId) => {
    const product = products.find(p => p.id === productId) || null;
    setDeleteTarget({ id: productId, name: product?.name || 'this product', check: null, loading: true });
    try {
      const check = await api.products.getDeletionCheck(productId);
      setDeleteTarget(prev => (prev?.id === productId ? { ...prev, check, loading: false } : prev));
    } catch (e) {
      console.error('[Products] deletion check failed', e);
      // Losing the preview is not a reason to block the owner — the delete
      // itself is still guarded server-side, so ask the plain question.
      setDeleteTarget(prev => (prev?.id === productId ? { ...prev, check: null, loading: false } : prev));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const productId = deleteTarget.id;
    setDeleting(true);
    try {
      await api.products.deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      const cancelled = deleteTarget.check?.active_subscribers || 0;
      Toast.show({
        type: 'success',
        text1: t('productDeleted'),
        text2: cancelled > 0
          ? `${cancelled} subscription(s) cancelled and those customers told.`
          : 'Product removed from inventory catalog.',
      });
      setDeleteTarget(null);
      if (viewMode === 'details') setViewMode('list');
    } catch (e) {
      console.error('[Products] delete failed', e);
      // getErrorText, not e.message: the server explains what is blocking.
      Toast.show({
        type: 'error',
        text1: t('couldNotDeleteProduct'),
        text2: getErrorText(e),
      });
      // A 409 means an order is still owed. The owner almost always wants to
      // stop selling it right now anyway, so keep the sheet open on the
      // out-of-stock offer rather than making them hunt for the toggle.
      if (e?.status === 409) {
        setDeleteTarget(prev => (prev ? { ...prev, blocked: getErrorText(e) } : prev));
      } else {
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const markOutOfStockInstead = async () => {
    if (!deleteTarget) return;
    const productId = deleteTarget.id;
    setDeleting(true);
    try {
      await api.products.setAvailability(productId, false);
      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, stock_status: 'out_of_stock', inStock: false } : p)
      );
      Toast.show({
        type: 'success',
        text1: t('markedOutOfStock'),
        text2: t('markedOutOfStockSub'),
      });
      setDeleteTarget(null);
    } catch (e) {
      console.error('[Products] out-of-stock fallback failed', e);
      Toast.show({ type: 'error', text1: t('couldNotUpdateAvailability'), text2: getErrorText(e) });
    } finally {
      setDeleting(false);
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

  // Asked before anything is deleted, and rendered from both the list and the
  // product profile — the trash icon exists on both.
  //
  // Two shapes, because a blocked delete has a different question to ask. When
  // an order is still owed there is nothing to confirm, so the sheet stops
  // offering the delete and offers the thing the owner actually wants next:
  // take it off the shelf now, delete it once the orders are done.
  const blockedReason = deleteTarget?.blocked
    || (deleteTarget?.check && !deleteTarget.check.can_delete
      ? t('deleteBlockedOrders', { count: deleteTarget.check.blocking_orders })
      : null);
  const subscriberCount = deleteTarget?.check?.active_subscribers || 0;

  const deleteSheet = (
    <ConfirmSheet
      visible={Boolean(deleteTarget)}
      title={blockedReason ? t('deleteCannotYet') : t('deleteProductTitle', { name: deleteTarget?.name })}
      body={
        deleteTarget?.loading
          ? t('deleteChecking')
          : blockedReason
            ? t('deleteBlockedBody', { reason: blockedReason })
            : subscriberCount > 0
              ? t('deleteSubscribersBody', { count: subscriberCount })
              : t('deleteDefaultBody')
      }
      confirmLabel={blockedReason ? t('markOutOfStockBtn') : t('deleteBtn')}
      cancelLabel={blockedReason ? t('closeBtn') : t('keepBtn')}
      destructive={!blockedReason}
      busy={deleting || Boolean(deleteTarget?.loading)}
      onConfirm={blockedReason ? markOutOfStockInstead : confirmDelete}
      onCancel={() => { if (!deleting) setDeleteTarget(null); }}
    />
  );

  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>{t('productsHeader', 'Products Inventory')}</Text>
          <View style={styles.searchBar}>
            <Search color={theme.colors.textLight} size={20} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchProduct', 'Search products in catalog...')}
              placeholderTextColor={theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Horizontal Category Chips — hidden until there is something to
              filter. With no products the row is a lone "All" that does
              nothing but take up space above an empty screen. */}
          {filterCategories.length > 1 && (
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
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loaderText}>{t('syncingCatalog')}</Text>
          </View>
        ) : (
          <FlatList
            data={processedProducts}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: screenPad.bottom },
              processedProducts.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ImageIcon size={48} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>{t('noProductsFound')}</Text>
                <Text style={styles.emptySub}>
                  {/* An empty catalogue needs a next step, not a note about
                      filters that are not even on screen. */}
                  {products.length === 0 ? t('noProductsYetSub') : t('noProductsFoundSub')}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const { price: displayPrice, unit: displayUnit } = getCardPrice(item);
              const optionsSummary = getCardOptionsSummary(item);

              return (
                <View style={styles.productCard}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e' }} style={styles.productImg} />
                  <View style={styles.productInfo}>
                    <View style={styles.cardHeaderRow}>
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

                      <View style={styles.productActions}>
                        <TouchableOpacity style={styles.actBtn} onPress={() => handleOpenDetails(item)}>
                          <Eye size={14} color={theme.colors.textLight} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actBtn, { marginLeft: 6 }]} onPress={() => handleOpenEdit(item)}>
                          <Edit size={14} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actBtn, { marginLeft: 6 }]} onPress={() => handleDelete(item.id)}>
                          <Trash2 size={14} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    
                    {optionsSummary && (
                      <View style={styles.packListBadgeStrip}>
                        {isProductLoose(item) ? (
                          <Scale size={12} color="#15803D" style={{ marginRight: 4 }} />
                        ) : (
                          <Package size={12} color="#15803D" style={{ marginRight: 4 }} />
                        )}
                        <Text style={styles.packListBadgeText} numberOfLines={1}>
                          {isProductLoose(item) ? '' : 'Packs: '}
                          {optionsSummary}
                        </Text>
                      </View>
                    )}

                    <View style={styles.priceAndSwitchRow}>
                      <Text style={styles.productPrice} numberOfLines={1}>
                        ₹{displayPrice}{' '}
                        <Text style={styles.productUnit}>
                          / {displayUnit}
                        </Text>
                      </Text>

                      <View style={styles.availabilityInline}>
                        <Text style={styles.availabilityText}>{t('availableLabel')}</Text>
                        <PillToggle
                          value={item.stock_status === 'in_stock'}
                          onValueChange={() => handleToggleStock(item.id, item.stock_status)}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Floating Add Product FAB */}
        <TouchableOpacity style={styles.fabBtn} onPress={handleOpenAdd}>
          <Plus color="#FFF" size={28} />
        </TouchableOpacity>

        {deleteSheet}
      </View>
    );
  }

  // Add & Edit Form Layout





  if (viewMode === 'add' || viewMode === 'edit') {
    // The form is its own screen now. It was ~700 lines inside this file, and
    // the option repeater it needed would only have grown that further.
    return (
      <ProductFormScreen
        product={viewMode === 'edit' ? selectedProduct : null}
        onClose={() => setViewMode('list')}
        onSaved={() => {
          setViewMode('list');
          fetchProducts();
        }}
      />
    );
  }

  // Product Details Screen

  if (viewMode === 'details') {
    const product = selectedProduct;
    if (!product) return null;
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={[styles.formHeader, { paddingTop: insets.top, height: 56 + insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
            <ChevronLeft color={theme.colors.textDark} size={24} />
          </TouchableOpacity>
          <Text style={styles.formHeaderTitle}>{t('productProfile', 'Product Profile')}</Text>
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
            
            {/* Hidden only for a MULTI-option packed product, where no single
                figure is the price: the options card below states them all.
                Otherwise this quotes the default option, the same as the
                catalogue card — never `selling_price`, which is the internal
                per-unit rate the mirror is derived from and not a price
                anything is sold at. */}
            {(product.options?.length ?? 0) > 1 && !isProductLoose(product) ? null : (
            <View style={styles.detailPriceCard}>
              <View>
                <Text style={styles.detailPriceLabel}>{t('storeSellingPrice')}</Text>
                <Text style={styles.detailPriceVal}>₹{getCardPrice(product).price} <Text style={{ fontSize: 14, color: theme.colors.textLight }}>/ {getCardPrice(product).unit}</Text></Text>
              </View>
              {/* Always shown, but never invented: this used to render
                  `price * 1.25`, a figure that contradicted whatever the owner
                  actually typed. MRP is optional on the API, so when none is
                  stored the field says so rather than guessing. */}
              <View style={styles.detailMrpColumn}>
                <Text style={styles.detailPriceLabel}>{t('marketMrpLabel')}</Text>
                <Text style={styles.detailMrpVal}>
                  {product.mrp != null ? `₹${product.mrp.toFixed(2)}` : 'Not set'}
                </Text>
              </View>
            </View>
            )}

            {product.has_pack_options && product.pack_options?.length > 0 && (
              <View style={styles.detailsPackSectionCard}>
                <Text style={styles.detailsPackSectionTitle}>
                  {isProductLoose(product) ? `Loose Quantity Tiers (${product.pack_options.length})` : `Configured Pack Sizes (${product.pack_options.length})`}
                </Text>
                {product.pack_options.map((pack, idx) => (
                  <View key={idx} style={styles.detailsPackRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {isProductLoose(product) ? (
                        <Scale size={16} color="#16A34A" style={{ marginRight: 8 }} />
                      ) : (
                        <Package size={16} color="#16A34A" style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.detailsPackName}>{formatPackName(pack.pack_name, product.unit)}</Text>
                      {pack.is_default && (
                        <View style={styles.defaultPillTag}>
                          <Text style={styles.defaultPillTagText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.detailsPackPrice}>₹{parseFloat(pack.price || 0).toFixed(2)}</Text>
                      {pack.mrp ? (
                        <Text style={styles.detailsPackMrp}>MRP ₹{parseFloat(pack.mrp).toFixed(2)}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.detailLabelHeader}>{t('itemDescription')}</Text>
            <Text style={styles.detailDescText}>
              {product.description || t('noDescription', 'No description added.')}
            </Text>

            <View style={styles.detailHighlightBox}>
              <Sparkles size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.detailHighlightText}>{t('expressDeliveryNote')}</Text>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={() => handleOpenEdit(product)}>
              <Text style={styles.submitBtnText}>{t('editProductDetails')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {deleteSheet}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  windowBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  windowRow: { flexDirection: 'row', marginTop: 10 },
  windowBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 10,
  },
  windowLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
  },
  windowValue: { fontSize: 15, fontWeight: '800', color: theme.colors.textDark, marginTop: 2 },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dropdownBtnPlaceholder: {
    color: theme.colors.textLight,
    fontWeight: '600',
  },
  catSection: {
    fontSize: 10.5,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  catSectionNew: {
    color: '#B45309',
  },
  revealAllRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  revealAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  revealAllHint: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  kindRow: { flexDirection: 'row', marginTop: 12 },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  kindChipOn: { backgroundColor: '#DCFCE7' },
  kindChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  kindChipTextOn: { color: '#15803D' },
  subDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  formInputError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  packVariantRowCardError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  formFieldError: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 6,
  },
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
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    ...theme.shadows.soft,
  },
  productImg: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '850',
    color: theme.colors.textLight,
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
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
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 2,
  },
  priceSpacer: { flex: 1 },
  priceAndSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  productPrice: {
    // Takes the room that is left and truncates. Without flex+numberOfLines a
    // long pack name ("Pack of 6 · 250 ml Bottle") sized the row to its own
    // content and shoved "Available" and the stock toggle off the card — the
    // same guard packListBadgeText already uses on the line above.
    flex: 1,
    fontSize: 15,
    fontWeight: '850',
    color: theme.colors.primary,
  },
  productUnit: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '700',
  },
  availabilityInline: {
    flexDirection: 'row',
    alignItems: 'center',
    // The toggle is a fixed 44pt and must never be the thing that gets squeezed.
    flexShrink: 0,
    marginLeft: 8,
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginRight: 2,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
  formLabelHint: { fontWeight: '500', color: theme.colors.textLight, fontSize: 12 },
  containerWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  containerChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9,
    backgroundColor: '#F1F5F9', marginRight: 7, marginBottom: 7,
  },
  containerChipOn: { backgroundColor: theme.colors.primary },
  containerChipText: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  containerChipTextOn: { color: '#FFFFFF' },
  packSizeRow: { flexDirection: 'row', alignItems: 'center' },
  packSizeInput: { flex: 1, marginRight: 10 },
  packSizeUnits: { flexDirection: 'row' },
  packSizeUnitChip: {
    paddingHorizontal: 11, paddingVertical: 10, borderRadius: 9,
    backgroundColor: '#F1F5F9', marginLeft: 5,
  },
  packSizeUnitChipOn: { backgroundColor: theme.colors.primary },
  packSizeUnitText: { fontSize: 12.5, fontWeight: '800', color: '#64748B' },
  packSizeUnitTextOn: { color: '#FFFFFF' },
  packSizeEcho: { fontSize: 12.5, fontWeight: '700', color: '#15803D', marginTop: 7 },
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
  rowTwoCols: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
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

  // Pack Options Styles
  packListBadgeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  packListBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  packToggleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  packToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packToggleIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packToggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  packToggleSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  packOptionsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  packOptionsHeaderLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
  },
  packVariantRowCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  packRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  packControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  packPricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packMiniLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
  },
  packMiniInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  defaultPackBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  defaultPackBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  defaultPackBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  defaultPackBadgeTextActive: {
    color: '#15803D',
  },
  removePackBtn: {
    padding: 6,
  },
  addPackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  addPackBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },
  detailsPackSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  detailsPackSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
  },
  detailsPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailsPackName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailsPackPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A',
  },
  detailsPackMrp: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textLight,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  defaultPillTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  defaultPillTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
  },
  productTypeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  productTypeCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  productTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  productTypeChipOn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  productTypeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  productTypeChipTextOn: {
    color: '#15803D',
    fontWeight: '800',
  },
  productTypeHint: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  stepChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stepChipOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  stepChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  stepChipTextOn: {
    color: '#15803D',
  },
  priceHelperCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  priceHelperText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },
  unitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  unitModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  unitModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unitModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitModalCloseBtn: {
    padding: 4,
  },
  unitModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitModalItemSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  unitModalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  unitModalItemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  unitModalItemLabelActive: {
    color: '#15803D',
    fontWeight: '800',
  },
});
