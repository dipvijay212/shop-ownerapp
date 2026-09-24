// Add / edit a product.
//
// A product is an identity — photo, category, name — with a list of buyable
// OPTIONS under it. A shop selling Amul milk in a 500 ml pouch and a 1 L pouch
// has one product and two options; a shop selling loose atta has one product
// and one option carrying its price, its minimum and its step.
//
// Nothing here computes a pack name or a customer-facing price. Both come back
// from the server on `display_label`, because the same rule has to hold in the
// customer app, the basket, the invoice and the subscription screen, and four
// copies of it in three repos is how they drift apart.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Image as ImageIcon,
  Package,
  Plus,
  Repeat,
  Scale,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillToggle } from '../components/PillToggle';
import KeyboardAwareForm from '../components/KeyboardAwareForm';
import { api } from '../api';
import { getErrorText } from '../api/errors';
import { theme } from '../theme';
import { to12h } from '../utils/time';
import { useTranslation } from '../constants/translations';
import { useFormErrors } from '../hooks/useFormErrors';

// Which units the form offers, in the order an owner thinks of them. The server
// is still the authority — these are filtered against GET /owner/units — but
// the retired container-units (`pack`, `bag5kg`) are deliberately not here:
// a "5 kg bag" is 5 kg in a bag, and the container field says so now.
// Server unit CODES, in the order an owner thinks of them. `gm` is how grams
// are written on screen but it is not a code the server knows — listing it here
// silently dropped it from the picker, and using it as a default made a new
// packed product fail to save with "no such unit gm".
const PACKED_UNITS = ['g', 'kg', 'ml', 'l', 'dozen', 'pc'];
const LOOSE_UNITS = ['kg', 'g', 'l', 'ml', 'pc'];

// Weight, volume or count — what the presets and the "same measure" rule key
// off. Mirrors the server's own table.
const UNIT_KIND = { g: 'weight', gm: 'weight', kg: 'weight', ml: 'volume', l: 'volume', pc: 'count', dozen: 'count' };
const kindOf = (code) => UNIT_KIND[String(code).toLowerCase()] || 'count';

// How a loose price reads on the customer's shelf: ₹ /kg, ₹ /100 g.
// What each unit is CALLED in the picker. Spelled out so "Kilogram" and
// "Grams" can never be mistaken for each other at a glance.
const UNIT_NAME = { kg: 'Kilogram (kg)', g: 'Grams (gm)', gm: 'Grams (gm)', l: 'Litre (L)', ml: 'Millilitre (ml)', pc: 'Piece', dozen: 'Dozen' };

const PRICE_UNIT_LABEL = { kg: '₹ /kg', g: '₹ /gm', gm: '₹ /gm', l: '₹ /L', ml: '₹ /ml', pc: '₹ /piece' };

// Most products come in the obvious thing. Owners can change it — the point is
// that 77 of the first 81 products carried no container at all, and a field
// nobody fills in is a field that may as well not exist.
const DEFAULT_CONTAINER = { g: 'packet', gm: 'packet', kg: 'packet', ml: 'bottle', l: 'bottle', dozen: 'tray', pc: 'packet' };

const blankOption = (unit = 'g') => ({
  key: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  id: null,
  qty_value: '',
  qty_unit: unit,
  container_code: DEFAULT_CONTAINER[unit] || 'packet',
  hasMultiple: false,
  items_in_pack: '1',
  price: '',
  mrp: '',
  is_available: true,
  is_default: false,
  needs_review: false,
});

const blankLoose = () => ({
  qty_value: '1',
  qty_unit: 'kg',
  price: '',
  mrp: '',
  min_qty: null,
  step_qty: null,
});

// Defined at module scope on purpose. Inside the component these would be a
// new component type on every render, so React would unmount and remount the
// subtree each keystroke — the keyboard closing after every character typed.
const Field = ({ label, hint, error, children, onLayout }) => (
  <View style={s.field} onLayout={onLayout}>
    <Text style={s.label}>
      {label}
      {hint ? <Text style={s.labelHint}>{`  ${hint}`}</Text> : null}
    </Text>
    {children}
    {error ? <Text style={s.error}>{error}</Text> : null}
  </View>
);

const Dropdown = ({ value, placeholder, onPress, icon }) => (
  <TouchableOpacity
    style={s.dropdown}
    activeOpacity={0.8}
    onPress={() => {
      Keyboard.dismiss();
      onPress();
    }}
  >
    <View style={s.dropdownLeft}>
      {icon}
      <Text style={[s.dropdownText, !value && s.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
    </View>
    <ChevronDown size={18} color={theme.colors.textDark} />
  </TouchableOpacity>
);

export default function ProductFormScreen({ product, onClose, onSaved }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const form = useFormErrors();
  const isEdit = Boolean(product);

  const [productType, setProductType] = useState('packed');
  const [image, setImage] = useState(null);
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState([{ ...blankOption(), is_default: true }]);
  const [loose, setLoose] = useState(blankLoose());

  const [kind, setKind] = useState('normal');
  const [chargeSubDelivery, setChargeSubDelivery] = useState(false);
  const [windowStart, setWindowStart] = useState('06:00');
  const [windowEnd, setWindowEnd] = useState('08:00');
  const [pickingWindow, setPickingWindow] = useState(null);

  const [units, setUnits] = useState([]);
  const [containers, setContainers] = useState([]);
  const [presets, setPresets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState(null); // { type, index }

  // ── masters ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [u, c, q, cats] = await Promise.allSettled([
        api.products.listUnits(),
        api.products.listPackContainers(),
        api.products.listQuantityPresets(),
        api.products.listProductCategories(),
      ]);
      if (!alive) return;
      if (u.status === 'fulfilled') setUnits(u.value || []);
      if (c.status === 'fulfilled') setContainers(c.value || []);
      if (q.status === 'fulfilled') setPresets(q.value || []);
      if (cats.status === 'fulfilled') {
        const list = cats.value || [];
        setCategories(list);
        if (!product && list.length) setCategory((prev) => prev || list[0].name);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [product]);

  // ── seed from an existing product ─────────────────────────────────────────
  // Reads the ADAPTED shape (`adaptProduct`), which is what the catalogue list
  // holds — camelCase, and `category` is already the name. Seeding from the raw
  // API names instead left every field on this form blank.
  useEffect(() => {
    if (!product) return;
    const saleMode = product.saleMode === 'loose' ? 'loose' : 'packed';
    setProductType(saleMode);
    setImage(product.image_url || null);
    setCategory(product.category || '');
    setName(product.name || '');
    setDescription(product.description || '');
    setKind(product.kind || 'normal');
    setChargeSubDelivery(product.subscriptionChargeDelivery === true);
    if (product.deliveryStartsAt) setWindowStart(product.deliveryStartsAt);
    if (product.deliveryEndsAt) setWindowEnd(product.deliveryEndsAt);

    const rows = product.options || [];
    if (saleMode === 'loose') {
      const o = rows[0];
      if (o) {
        setLoose({
          qty_value: String(o.qtyValue ?? 1),
          qty_unit: o.qtyUnit,
          price: String(o.price ?? ''),
          mrp: o.mrp != null ? String(o.mrp) : '',
          min_qty: o.minQty != null ? Number(o.minQty) : null,
          step_qty: o.stepQty != null ? Number(o.stepQty) : null,
        });
      }
    } else if (rows.length) {
      setOptions(
        rows.map((o, i) => ({
          key: `opt_${o.id || i}`,
          id: o.id,
          qty_value: String(o.qtyValue ?? ''),
          qty_unit: o.qtyUnit,
          container_code: o.containerCode || DEFAULT_CONTAINER[o.qtyUnit] || 'packet',
          hasMultiple: (o.itemsInPack ?? 1) > 1,
          items_in_pack: String(o.itemsInPack ?? 1),
          price: String(o.price ?? ''),
          mrp: o.mrp != null ? String(o.mrp) : '',
          is_available: o.isAvailable !== false,
          is_default: o.isDefault === true,
          needs_review: o.needsReview === true,
        })),
      );
    }
  }, [product]);

  // ── derived pickers ───────────────────────────────────────────────────────
  const unitCodes = useMemo(() => new Set(units.map((u) => String(u.code))), [units]);
  const packedUnitOptions = useMemo(
    () => PACKED_UNITS.filter((c) => unitCodes.has(c)),
    [unitCodes],
  );
  const looseUnitOptions = useMemo(() => LOOSE_UNITS.filter((c) => unitCodes.has(c)), [unitCodes]);
  const activeContainers = useMemo(() => containers.filter((c) => c.code), [containers]);

  const looseKind = kindOf(loose.qty_unit);
  const minOptions = useMemo(
    () => presets.filter((p) => p.unit_kind === looseKind && p.usable_as_min),
    [presets, looseKind],
  );
  const stepOptions = useMemo(
    () => presets.filter((p) => p.unit_kind === looseKind && p.usable_as_step),
    [presets, looseKind],
  );

  // Changing the selling unit changes which ladder applies, so a minimum in
  // grams cannot survive a switch to litres.
  useEffect(() => {
    if (productType !== 'loose' || !presets.length) return;
    setLoose((prev) => {
      const mins = presets.filter((p) => p.unit_kind === kindOf(prev.qty_unit) && p.usable_as_min);
      const steps = presets.filter((p) => p.unit_kind === kindOf(prev.qty_unit) && p.usable_as_step);
      const minOk = mins.some((m) => Number(m.base_value) === Number(prev.min_qty));
      const stepOk = steps.some((m) => Number(m.base_value) === Number(prev.step_qty));
      if (minOk && stepOk) return prev;
      return {
        ...prev,
        min_qty: minOk ? prev.min_qty : mins.length ? Number(mins[0].base_value) : null,
        step_qty: stepOk ? prev.step_qty : steps.length ? Number(steps[0].base_value) : null,
      };
    });
  }, [productType, loose.qty_unit, presets]);

  const categoryOptions = showAllCategories && allCategories.length ? allCategories : categories;

  const revealAllCategories = useCallback(async () => {
    try {
      const all = await api.products.listProductCategories(true);
      setAllCategories(all || []);
      setShowAllCategories(true);
    } catch (err) {
      Toast.show({ type: 'error', text1: getErrorText(err) });
    }
  }, []);

  // ── option editing ────────────────────────────────────────────────────────
  const patchOption = (index, patch) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  /* MULTI-OPTION HANDLERS — HIDDEN WITH THE UI ABOVE. Restore alongside the
     option actions and the Add option button.
  const addOption = () => {
    const last = options[options.length - 1];
    setOptions((prev) => [...prev, { ...blankOption(last?.qty_unit || 'g') }]);
  };

  // Most second options differ from the first only in size and price, so
  // copying beats re-entering the unit, the container and the pack count.
  const duplicateOption = (index) =>
    setOptions((prev) => {
      const src = prev[index];
      const copy = { ...src, key: blankOption().key, id: null, is_default: false, qty_value: '', price: '', mrp: '' };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });

  const removeOption = (index) =>
    setOptions((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      // The default must survive its own deletion.
      if (!next.some((o) => o.is_default)) next[0] = { ...next[0], is_default: true };
      return next;
    });

  const setDefaultOption = (index) =>
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_default: i === index })));
  */

  const selectProductImage = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 }, (res) => {
      if (res?.didCancel || res?.errorCode) return;
      const uri = res?.assets?.[0]?.uri;
      if (uri) {
        setImage(uri);
        form.clearError('image');
      }
    });
  };

  // ── labels ────────────────────────────────────────────────────────────────
  // The live preview only — everything saved gets its label from the server.
  const containerLabel = (code) => activeContainers.find((c) => c.code === code)?.label || '';

  const previewOption = (o) => {
    const qty = Number(o.qty_value);
    if (!qty) return '';
    const unit = o.qty_unit === 'g' ? 'gm' : o.qty_unit === 'l' ? 'L' : o.qty_unit;
    const items = o.hasMultiple ? Number(o.items_in_pack) || 1 : 1;
    const box = containerLabel(o.container_code);
    const one = kindOf(o.qty_unit) === 'count' ? `${qty} ${unit}` : `${qty} ${unit}`;
    const single = box ? `${one} ${box}` : one;
    return items > 1 ? `${items} × ${single}` : single;
  };

  const presetLabel = (list, value) =>
    list.find((p) => Number(p.base_value) === Number(value))?.label || '';

  // ── save ──────────────────────────────────────────────────────────────────
  const buildOptions = () => {
    if (productType === 'loose') {
      return [
        {
          id: product?.options?.[0]?.id || undefined,
          qty_value: loose.qty_value,
          qty_unit: loose.qty_unit,
          container_code: null,
          items_in_pack: 1,
          price: loose.price,
          mrp: loose.mrp,
          is_available: true,
          is_default: true,
          min_qty: loose.min_qty,
          step_qty: loose.step_qty,
        },
      ];
    }
    return options.map((o, i) => ({
      id: o.id || undefined,
      qty_value: o.qty_value,
      qty_unit: o.qty_unit,
      container_code: o.container_code,
      items_in_pack: o.hasMultiple ? o.items_in_pack : 1,
      price: o.price,
      mrp: o.mrp,
      is_available: o.is_available,
      // With "Set default" hidden there is nothing to click, so the first (and
      // only) option is the default — otherwise a legacy row saved with
      // is_default false would reach the server with no default at all.
      is_default: options.length === 1 ? true : o.is_default,
      min_qty: null,
      step_qty: null,
    }));
  };

  const handleSave = async () => {
    const rules = [
      // Required on a NEW product — a customer scrolling a shelf needs to see
      // it — but never a blocker on an existing one. Most of the products
      // carrying a "needs review" flag have no photo, and demanding one before
      // the owner can fix the pack size would leave them stuck on both.
      [!image && !isEdit, 'image', t('photoRequired', 'Add a photo so customers can see it.')],
      [!category, 'category', t('categoryRequired', 'Pick a category.')],
      [!name.trim(), 'name', t('nameRequired', 'Give the product a name.')],
    ];
    if (productType === 'loose') {
      rules.push(
        [!(Number(loose.qty_value) > 0), 'loose', t('qtyRequired', 'Enter the quantity the price is for.')],
        [!(Number(loose.price) > 0), 'loose', t('priceRequired', 'Enter a price.')],
        [loose.min_qty == null, 'loose', t('minRequired', 'Choose a minimum quantity.')],
        [loose.step_qty == null, 'loose', t('stepRequired', 'Choose a quantity step.')],
      );
    } else {
      options.forEach((o, i) => {
        rules.push(
          [!(Number(o.qty_value) > 0), `opt:${i}`, t('optQtyRequired', 'Enter how much is in one item.')],
          [!o.container_code, `opt:${i}`, t('optContainerRequired', 'Choose what it comes in.')],
          [!(Number(o.price) > 0), `opt:${i}`, t('optPriceRequired', 'Enter a price.')],
          [
            o.hasMultiple && !(Number(o.items_in_pack) > 1),
            `opt:${i}`,
            t('optItemsRequired', 'Enter how many items are in the pack.'),
          ],
          [
            o.mrp !== '' && Number(o.mrp) < Number(o.price),
            `opt:${i}`,
            t('optMrpLow', 'The market price cannot be below the selling price.'),
          ],
        );
      });
      // Mixing weight with volume leaves the options unorderable, and the
      // server rejects it — say so here, next to the field that caused it.
      const kinds = new Set(options.map((o) => kindOf(o.qty_unit)));
      rules.push([
        kinds.size > 1,
        'opt:0',
        t('optMixedUnits', 'Every option has to measure the same thing — all weights, or all volumes.'),
      ]);
    }
    if (kind !== 'normal') {
      rules.push([windowStart >= windowEnd, 'window', t('windowInvalid', 'The window has to end after it starts.')]);
    }
    if (!form.validate(rules)) return;

    setSubmitting(true);
    try {
      let imageUrl = image;
      if (imageUrl && !/^https?:/i.test(imageUrl)) {
        const uploaded = await api.platform.uploadImage({ uri: imageUrl });
        imageUrl = uploaded?.url || null;
      }
      const categoryId = [...categories, ...allCategories].find((c) => c.name === category)?.id;
      if (!categoryId) throw new Error(t('categoryRequired', 'Pick a category from the list.'));

      const builtOptions = buildOptions();
      const payload = {
        name: name.trim(),
        category_id: categoryId,
        description: description.trim() || undefined,
        image_url: imageUrl || undefined,
        sale_mode: productType,
        // The unit the server mirrors prices against. The options carry the
        // real measurements; this keeps the legacy column coherent.
        unit_code: productType === 'loose' ? loose.qty_unit : builtOptions[0].qty_unit,
        selling_price: Number(builtOptions.find((o) => o.is_default)?.price || builtOptions[0].price),
        kind,
        subscription_charge_delivery: kind === 'normal' ? false : chargeSubDelivery,
        ...(kind === 'normal' ? {} : { delivery_starts_at: windowStart, delivery_ends_at: windowEnd }),
        options: builtOptions,
      };

      const saved = isEdit
        ? await api.products.updateProduct(product.id, payload)
        : await api.products.createProduct(payload);
      Toast.show({ type: 'success', text1: isEdit ? t('productUpdated', 'Product updated') : t('productAdded', 'Product added') });
      onSaved?.(saved);
    } catch (err) {
      Toast.show({ type: 'error', text1: t('saveFailed', 'Could not save'), text2: getErrorText(err) });
    } finally {
      setSubmitting(false);
    }
  };

  // ── pickers ───────────────────────────────────────────────────────────────
  const closePicker = () => setPicker(null);

  const pickerRows = () => {
    if (!picker) return [];
    if (picker.type === 'unit') {
      const codes = productType === 'loose' ? looseUnitOptions : packedUnitOptions;
      return codes.map((code) => ({
        key: code,
        label:
          productType === 'loose'
            ? `${UNIT_NAME[code] || code}  —  ${PRICE_UNIT_LABEL[code] || ''}`
            : UNIT_NAME[code] || code,
      }));
    }
    if (picker.type === 'container') return activeContainers.map((c) => ({ key: c.code, label: c.label }));
    if (picker.type === 'min') return minOptions.map((p) => ({ key: String(p.base_value), label: p.label }));
    if (picker.type === 'step') return stepOptions.map((p) => ({ key: String(p.base_value), label: p.label }));
    return [];
  };

  const onPick = (key) => {
    if (!picker) return;
    if (picker.type === 'unit') {
      if (productType === 'loose') setLoose((p) => ({ ...p, qty_unit: key }));
      else patchOption(picker.index, { qty_unit: key, container_code: DEFAULT_CONTAINER[key] || 'packet' });
    } else if (picker.type === 'container') {
      patchOption(picker.index, { container_code: key });
    } else if (picker.type === 'min') {
      setLoose((p) => ({ ...p, min_qty: Number(key) }));
    } else if (picker.type === 'step') {
      setLoose((p) => ({ ...p, step_qty: Number(key) }));
    }
    closePicker();
  };

  const pickerTitle = {
    unit: t('selectUnit', 'Select unit'),
    container: t('selectContainer', 'What does it come in?'),
    min: t('selectMinQty', 'Minimum quantity'),
    step: t('selectStep', 'Increase by'),
  };

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[s.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={onClose}>
          <ChevronLeft color={theme.colors.textDark} size={24} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isEdit ? t('editProduct', 'Edit product') : t('addProduct', 'Add product')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* KeyboardAvoidingView did nothing here: its behavior is undefined on
          Android, so it rendered a plain View and Price, MRP and Description —
          the fields lowest in the form — stayed under the keyboard. */}
      <KeyboardAwareForm ref={form.scrollRef} style={s.scroll} contentContainerStyle={{ padding: 16 }}>
          {/* 1 · TYPE */}
          <View style={s.typeCard}>
            <Text style={s.sectionTitle}>{t('productType', 'Product type')} *</Text>
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeChip, productType === 'packed' && s.typeChipOn]}
                onPress={() => setProductType('packed')}
              >
                <Package size={18} color={productType === 'packed' ? '#15803D' : '#64748B'} />
                <Text style={[s.typeChipText, productType === 'packed' && s.typeChipTextOn]}>
                  {t('productTypePacked', 'Packed product')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeChip, productType === 'loose' && s.typeChipOn]}
                onPress={() => setProductType('loose')}
              >
                <Scale size={18} color={productType === 'loose' ? '#15803D' : '#64748B'} />
                <Text style={[s.typeChipText, productType === 'loose' && s.typeChipTextOn]}>
                  {t('productTypeLoose', 'Loose product')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={s.typeHint}>
              {productType === 'packed'
                ? t('productTypePackedHint', 'Sold as sealed packets, bottles or trays.')
                : t('productTypeLooseHint', 'Weighed out to order — vegetables, rice, loose oil.')}
            </Text>
          </View>

          {/* 2 · PHOTO */}
          <Field label={t('productPhoto', 'Product photo')} error={form.errors.image} onLayout={form.onFieldLayout('image')}>
            {image ? (
              <View style={s.imageWrap}>
                <Image source={{ uri: image }} style={s.image} />
                <TouchableOpacity style={s.changePhoto} onPress={selectProductImage}>
                  <Text style={s.changePhotoText}>{t('changePhoto', 'Change photo')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.imagePlaceholder} onPress={selectProductImage}>
                <ImageIcon color={theme.colors.primary} size={30} />
                <Text style={s.imagePlaceholderText}>{t('uploadPhoto', 'Upload product photo')}</Text>
              </TouchableOpacity>
            )}
          </Field>

          {/* 3 · CATEGORY */}
          <Field label={`${t('category', 'Category')} *`} error={form.errors.category} onLayout={form.onFieldLayout('category')}>
            <Dropdown
              value={category}
              placeholder={t('selectCategory', 'Select a category')}
              icon={<Tag size={18} color="#2563EB" style={{ marginRight: 8 }} />}
              onPress={() => setPicker({ type: 'category' })}
            />
          </Field>

          {/* 4 · NAME */}
          <Field label={`${t('productName', 'Product name')} *`} error={form.errors.name} onLayout={form.onFieldLayout('name')}>
            <TextInput
              style={[s.input, form.errors.name && s.inputError]}
              placeholder={productType === 'packed' ? 'Amul Taaza Milk' : 'Fresh tomatoes'}
              placeholderTextColor={theme.colors.textLight}
              value={name}
              onChangeText={(v) => {
                setName(v);
                form.clearError('name');
              }}
            />
          </Field>

          {/* 5 · CONFIGURATION */}
          <Text style={s.sectionHeading}>{t('productConfig', 'Product configuration')}</Text>

          {productType === 'packed' ? (
            <>
              {options.map((o, i) => (
                <View
                  key={o.key}
                  style={[s.optionCard, form.errors[`opt:${i}`] && s.optionCardError]}
                  onLayout={form.onFieldLayout(`opt:${i}`)}
                >
                  <View style={s.optionHeader}>
                    <Text style={s.optionTitle} numberOfLines={1}>
                      {/* No "Option 1" while only one is allowed. */}
                      {options.length > 1 ? `${t('option', 'Option')} ${i + 1}` : t('optionSingle', 'Size & price')}
                      {previewOption(o) ? ` · ${previewOption(o).toUpperCase()}` : ''}
                    </Text>
                    {/* MULTI-OPTION UI — HIDDEN FOR NOW (a shop sells one size
                        per product until we turn this back on). Set default,
                        duplicate and remove only mean anything with more than
                        one option, and "Add option" below is hidden with them.
                        Restore this block and the one under "Add option" to
                        bring the feature back; nothing else has to change.
                    <View style={s.optionActions}>
                      <TouchableOpacity
                        style={[s.defaultBadge, o.is_default && s.defaultBadgeOn]}
                        onPress={() => setDefaultOption(i)}
                      >
                        <Text style={[s.defaultBadgeText, o.is_default && s.defaultBadgeTextOn]}>
                          {o.is_default ? t('default', 'Default') : t('setDefault', 'Set default')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.iconBtn} onPress={() => duplicateOption(i)}>
                        <Copy size={16} color={theme.colors.textLight} />
                      </TouchableOpacity>
                      {options.length > 1 && (
                        <TouchableOpacity style={s.iconBtn} onPress={() => removeOption(i)}>
                          <Trash2 size={16} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                    */}
                  </View>

                  {o.needs_review && (
                    <View style={s.reviewNote}>
                      <Text style={s.reviewNoteText}>
                        {t(
                          'optionNeedsReview',
                          'This was carried over from an older listing that never said what was in the pack. Check the size and unit below.',
                        )}
                      </Text>
                    </View>
                  )}

                  <View style={s.row}>
                    <View style={s.col}>
                      <Text style={s.miniLabel}>{t('qtyPerItem', 'Quantity per item')} *</Text>
                      <TextInput
                        style={s.miniInput}
                        keyboardType="decimal-pad"
                        placeholder="500"
                        placeholderTextColor="#94A3B8"
                        value={o.qty_value}
                        onChangeText={(v) => {
                          patchOption(i, { qty_value: v });
                          form.clearError(`opt:${i}`);
                        }}
                      />
                    </View>
                    <View style={s.col}>
                      <Text style={s.miniLabel}>{t('unit', 'Unit')} *</Text>
                      <Dropdown
                        value={UNIT_NAME[o.qty_unit] || o.qty_unit}
                        placeholder={t('selectUnit', 'Select unit')}
                        onPress={() => setPicker({ type: 'unit', index: i })}
                      />
                    </View>
                  </View>

                  <View style={s.field}>
                    <Text style={s.miniLabel}>{t('containerType', 'Item / container type')} *</Text>
                    <Dropdown
                      value={containerLabel(o.container_code)}
                      placeholder={t('selectContainer', 'Packet, bottle, tray…')}
                      onPress={() => setPicker({ type: 'container', index: i })}
                    />
                  </View>

                  <View style={s.switchRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={s.switchTitle}>{t('multiItemPack', 'More than one item in this pack')}</Text>
                      <Text style={s.switchHint}>
                        {t('multiItemPackHint', 'A crate of 8 bottles, a tray of 6 eggs. Customers then buy packs.')}
                      </Text>
                    </View>
                    <PillToggle
                      value={o.hasMultiple}
                      onValueChange={(v) => patchOption(i, { hasMultiple: v, items_in_pack: v ? o.items_in_pack : '1' })}
                    />
                  </View>

                  {o.hasMultiple && (
                    <View style={s.field}>
                      <Text style={s.miniLabel}>{t('itemsInPack', 'Items in pack')} *</Text>
                      <TextInput
                        style={s.miniInput}
                        keyboardType="number-pad"
                        placeholder="8"
                        placeholderTextColor="#94A3B8"
                        value={o.items_in_pack}
                        onChangeText={(v) => {
                          patchOption(i, { items_in_pack: v });
                          form.clearError(`opt:${i}`);
                        }}
                      />
                    </View>
                  )}

                  <View style={s.row}>
                    <View style={s.col}>
                      <Text style={s.miniLabel}>
                        {o.hasMultiple ? t('packPrice', 'Pack price (₹)') : t('itemPrice', 'Price (₹)')} *
                      </Text>
                      <TextInput
                        style={s.miniInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#94A3B8"
                        value={o.price}
                        onChangeText={(v) => {
                          patchOption(i, { price: v });
                          form.clearError(`opt:${i}`);
                        }}
                      />
                    </View>
                    <View style={s.col}>
                      <Text style={s.miniLabel}>{t('marketMrp', 'Market MRP (₹)')}</Text>
                      <TextInput
                        style={s.miniInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#94A3B8"
                        value={o.mrp}
                        onChangeText={(v) => {
                          patchOption(i, { mrp: v });
                          form.clearError(`opt:${i}`);
                        }}
                      />
                    </View>
                  </View>

                  <View style={s.switchRow}>
                    <Text style={s.switchTitle}>{t('optionInStock', 'In stock')}</Text>
                    <PillToggle value={o.is_available} onValueChange={(v) => patchOption(i, { is_available: v })} />
                  </View>

                  {form.errors[`opt:${i}`] ? <Text style={s.error}>{form.errors[`opt:${i}`]}</Text> : null}

                  {!!Number(o.price) && !!Number(o.qty_value) && (
                    <Text style={s.preview}>
                      {t('preview', 'Preview')}: {previewOption(o)} · ₹{Number(o.price).toFixed(2)}
                    </Text>
                  )}
                </View>
              ))}

              {/* ADD OPTION — HIDDEN FOR NOW. A shop lists one size per product
                  until multi-size selling is turned on; restore this together
                  with the option actions above.
              <TouchableOpacity style={s.addOptionBtn} onPress={addOption}>
                <Plus size={16} color="#16A34A" />
                <Text style={s.addOptionText}>{t('addOption', 'Add option')}</Text>
              </TouchableOpacity>
              <Text style={s.addOptionHint}>
                {t('addOptionHint', 'One per size you sell — a 500 ml pouch and a 1 L pouch are two options.')}
              </Text>
              */}
            </>
          ) : (
            <View style={s.optionCard} onLayout={form.onFieldLayout('loose')}>
              <View style={s.row}>
                <View style={s.col}>
                  <Text style={s.miniLabel}>{t('qtyPerItem', 'Quantity')} *</Text>
                  <TextInput
                    style={s.miniInput}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                    value={loose.qty_value}
                    onChangeText={(v) => {
                      setLoose((p) => ({ ...p, qty_value: v }));
                      form.clearError('loose');
                    }}
                  />
                </View>
                <View style={s.col}>
                  <Text style={s.miniLabel}>{t('priceUnit', 'Selling / price unit')} *</Text>
                  <Dropdown
                    value={PRICE_UNIT_LABEL[loose.qty_unit] || loose.qty_unit}
                    placeholder={t('selectUnit', 'Select unit')}
                    onPress={() => setPicker({ type: 'unit' })}
                  />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.miniLabel}>
                  {t('loosePrice', 'Price')} ({PRICE_UNIT_LABEL[loose.qty_unit] || '₹'}) *
                </Text>
                <TextInput
                  style={s.miniInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  value={loose.price}
                  onChangeText={(v) => {
                    setLoose((p) => ({ ...p, price: v }));
                    form.clearError('loose');
                  }}
                />
              </View>

              <View style={s.row}>
                <View style={s.col}>
                  <Text style={s.miniLabel}>{t('minQty', 'Minimum quantity')} *</Text>
                  <Dropdown
                    value={presetLabel(minOptions, loose.min_qty)}
                    placeholder={t('selectMinQty', 'Choose')}
                    onPress={() => setPicker({ type: 'min' })}
                  />
                </View>
                <View style={s.col}>
                  <Text style={s.miniLabel}>{t('stepQty', 'Increase by')} *</Text>
                  <Dropdown
                    value={presetLabel(stepOptions, loose.step_qty)}
                    placeholder={t('selectStep', 'Choose')}
                    onPress={() => setPicker({ type: 'step' })}
                  />
                </View>
              </View>

              {form.errors.loose ? <Text style={s.error}>{form.errors.loose}</Text> : null}

              {!!Number(loose.price) && loose.min_qty != null && (
                <Text style={s.preview}>
                  {t('preview', 'Preview')}: {t('from', 'from')} {presetLabel(minOptions, loose.min_qty)} ·{' '}
                  {PRICE_UNIT_LABEL[loose.qty_unit]} {Number(loose.price).toFixed(2)} ·{' '}
                  {t('stepsOf', 'steps of')} {presetLabel(stepOptions, loose.step_qty)}
                </Text>
              )}
            </View>
          )}

          {/* 6 · SUBSCRIPTION */}
          <View style={s.subCard}>
            <View style={s.subHeader}>
              <View style={s.subIcon}>
                <Repeat color={kind !== 'normal' ? '#16A34A' : '#64748B'} size={20} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.switchTitle}>{t('subscriptionProduct', 'Sell on subscription')}</Text>
                <Text style={s.switchHint}>
                  {t('subscriptionProductHint', 'Let customers set up a regular delivery of this product.')}
                </Text>
              </View>
            </View>

            <View style={s.kindRow}>
              {[
                ['normal', t('subscriptionKindNormal', 'One-off only')],
                ['both', t('subscriptionKindBoth', 'Both')],
                ['subscription', t('subscriptionKindSub', 'Subscription only')],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[s.kindChip, kind === value && s.kindChipOn]}
                  onPress={() => setKind(value)}
                >
                  <Text style={[s.kindChipText, kind === value && s.kindChipTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {kind !== 'normal' && (
              <>
                <View style={s.switchRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={s.switchTitle}>{t('subscriptionChargeDelivery', 'Charge delivery on subscriptions')}</Text>
                    <Text style={s.switchHint}>
                      {t('subscriptionChargeDeliveryHint', 'Off by default — a delivery fee on a small daily item rarely makes sense.')}
                    </Text>
                  </View>
                  <PillToggle value={chargeSubDelivery} onValueChange={setChargeSubDelivery} />
                </View>

                <View onLayout={form.onFieldLayout('window')}>
                  <Text style={s.switchTitle}>{t('deliveryWindow', 'Delivery window')}</Text>
                  <Text style={s.switchHint}>{t('deliveryWindowHint', 'When this product goes out each day.')}</Text>
                  <View style={s.windowRow}>
                    <TouchableOpacity style={s.windowBtn} onPress={() => setPickingWindow('start')}>
                      <Text style={s.windowLabel}>{t('windowFrom', 'From')}</Text>
                      <Text style={s.windowValue}>{to12h(windowStart)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.windowBtn} onPress={() => setPickingWindow('end')}>
                      <Text style={s.windowLabel}>{t('windowTo', 'To')}</Text>
                      <Text style={s.windowValue}>{to12h(windowEnd)}</Text>
                    </TouchableOpacity>
                  </View>
                  {form.errors.window ? <Text style={s.error}>{form.errors.window}</Text> : null}
                </View>
              </>
            )}
          </View>

          {/* 7 · DESCRIPTION */}
          <Field label={t('itemDescription', 'Description')} hint={t('optional', '(optional)')}>
            <TextInput
              style={[s.input, { height: 88, textAlignVertical: 'top', paddingTop: 10 }]}
              multiline
              placeholder={t('descriptionHint', 'Source, highlights, anything worth saying.')}
              placeholderTextColor={theme.colors.textLight}
              value={description}
              onChangeText={setDescription}
            />
          </Field>

          <TouchableOpacity style={s.submit} onPress={handleSave} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={s.submitText}>{isEdit ? t('saveChanges', 'Save changes') : t('saveProduct', 'Save product')}</Text>
            )}
          </TouchableOpacity>
      </KeyboardAwareForm>

      {/* pickers */}
      <Modal visible={!!picker && picker.type !== 'category'} transparent animationType="fade" onRequestClose={closePicker}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closePicker}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{picker ? pickerTitle[picker.type] : ''}</Text>
              <TouchableOpacity onPress={closePicker}>
                <X size={20} color={theme.colors.textDark} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {pickerRows().map((row) => (
                <TouchableOpacity key={row.key} style={s.modalRow} onPress={() => onPick(row.key)}>
                  <Text style={s.modalRowText}>{row.label}</Text>
                </TouchableOpacity>
              ))}
              {pickerRows().length === 0 && (
                <Text style={s.modalEmpty}>{t('noOptionsHere', 'Nothing to choose from yet.')}</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={picker?.type === 'category'} transparent animationType="fade" onRequestClose={closePicker}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closePicker}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('selectCategory', 'Select a category')}</Text>
              <TouchableOpacity onPress={closePicker}>
                <X size={20} color={theme.colors.textDark} />
              </TouchableOpacity>
            </View>
            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                placeholder={t('searchCategory', 'Search or add a category…')}
                placeholderTextColor={theme.colors.textLight}
                value={categoryQuery}
                onChangeText={setCategoryQuery}
              />
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {categoryOptions
                .filter((c) => c.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()))
                .map((c) => (
                  <TouchableOpacity
                    key={c.id || c.name}
                    style={s.modalRow}
                    onPress={() => {
                      setCategory(c.name);
                      form.clearError('category');
                      setCategoryQuery('');
                      closePicker();
                    }}
                  >
                    <Text style={s.modalRowText}>{c.name}</Text>
                    {category === c.name && <Check size={18} color={theme.colors.primary} />}
                  </TouchableOpacity>
                ))}
              {!showAllCategories && (
                <TouchableOpacity style={s.modalRow} onPress={revealAllCategories}>
                  <Text style={[s.modalRowText, { color: theme.colors.primary }]}>
                    {t('sellingSomethingElse', 'Selling something else?')}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {pickingWindow && (
        <DateTimePicker
          value={(() => {
            const [h, m] = (pickingWindow === 'start' ? windowStart : windowEnd).split(':').map(Number);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            return d;
          })()}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setPickingWindow(null);
            if (event.type === 'dismissed' || !date) return;
            const value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            if (pickingWindow === 'start') setWindowStart(value);
            else setWindowEnd(value);
            form.clearError('window');
            if (Platform.OS === 'ios') setPickingWindow(null);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.colors.textDark },
  scroll: { flex: 1 },

  sectionHeading: { fontSize: 15, fontWeight: '800', color: theme.colors.textDark, marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textDark, marginBottom: 10 },

  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textDark, marginBottom: 7 },
  labelHint: { fontWeight: '400', color: theme.colors.textLight },
  miniLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: theme.colors.textDark,
  },
  miniInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: theme.colors.textDark,
  },
  inputError: { borderColor: theme.colors.error },
  error: { color: theme.colors.error, fontSize: 12, marginTop: 6 },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dropdownLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dropdownText: { fontSize: 14, color: theme.colors.textDark, flex: 1 },
  placeholder: { color: theme.colors.textLight },

  typeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 18 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  typeChipOn: { borderColor: '#15803D', backgroundColor: '#F0FDF4' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  typeChipTextOn: { color: '#15803D' },
  typeHint: { fontSize: 12, color: theme.colors.textLight, marginTop: 10 },

  imageWrap: { alignItems: 'center' },
  image: { width: '100%', height: 170, borderRadius: 12, backgroundColor: '#E2E8F0' },
  changePhoto: { marginTop: 8 },
  changePhotoText: { color: theme.colors.primary, fontWeight: '600', fontSize: 13 },
  imagePlaceholder: {
    height: 130,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: { color: theme.colors.textLight, fontSize: 13 },

  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionCardError: { borderColor: theme.colors.error },
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  optionTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: '#B45309', letterSpacing: 0.3 },
  optionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 6 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' },
  defaultBadgeOn: { backgroundColor: '#DCFCE7' },
  defaultBadgeText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  defaultBadgeTextOn: { color: '#15803D' },

  reviewNote: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 12 },
  reviewNoteText: { fontSize: 12, color: '#92400E', lineHeight: 17 },

  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  col: { flex: 1 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  switchTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textDark },
  switchHint: { fontSize: 11.5, color: theme.colors.textLight, marginTop: 2, lineHeight: 16 },

  preview: { marginTop: 8, fontSize: 12, color: '#15803D', fontWeight: '600' },

  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  addOptionText: { color: '#16A34A', fontWeight: '700', fontSize: 13 },
  addOptionHint: { fontSize: 11.5, color: theme.colors.textLight, marginTop: 8, textAlign: 'center' },

  subCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 20 },
  subHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  subIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  kindChip: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  kindChipOn: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  kindChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  kindChipTextOn: { color: '#15803D' },
  windowRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  windowBtn: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10 },
  windowLabel: { fontSize: 11, color: theme.colors.textLight },
  windowValue: { fontSize: 14, fontWeight: '700', color: theme.colors.textDark, marginTop: 2 },

  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 28 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textDark },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalRowText: { fontSize: 14, color: theme.colors.textDark },
  modalEmpty: { padding: 20, textAlign: 'center', color: theme.colors.textLight },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: theme.colors.textDark,
  },
});
