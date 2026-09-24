// Catalog, product profile and the add/edit form (O-15 – O-17).
//
// A product is an identity — photo, category, name — with a list of buyable
// OPTIONS under it: a 500 ml pouch and a 1 L pouch are two. Send `options`;
// the server derives everything the customer sees from them, including the
// display labels, so never build a pack name or a tier price in the app.

import { http } from '../httpClient';

// status: 'available' | 'unavailable' | 'all'
export const listProducts = ({ q, category, status, cursor, limit } = {}) =>
  http.get('/owner/products', {
    params: {
      q: q || undefined,
      category: category && category !== 'All' ? category : undefined,
      status: status && status !== 'all' ? status : undefined,
      cursor,
      limit,
    },
  });

// Includes the derived tiers, for the product profile screen.
export const getProduct = (id) => http.get(`/owner/products/${id}`);

export const createProduct = (payload) => {
  const body = { ...payload };
  if (body.selling_price !== undefined) {
    body.selling_price = Number(body.selling_price);
  }
  if (body.mrp === '' || body.mrp === undefined || body.mrp === null) {
    delete body.mrp;
  } else {
    body.mrp = Number(body.mrp);
  }
  if (body.tier_multipliers && !body.tier_multipliers.length) {
    delete body.tier_multipliers;
  }
  if (body.options) body.options = normaliseOptions(body.options);
  return http.post('/owner/products', body);
};

// Send `mrp: null` to clear a previously set MRP.
export const updateProduct = (id, patch) => {
  const body = { ...patch };
  if (body.selling_price !== undefined) {
    body.selling_price = Number(body.selling_price);
  }
  if (body.mrp === '' || body.mrp === undefined) {
    delete body.mrp;
  } else if (body.mrp !== null) {
    body.mrp = Number(body.mrp);
  }
  if (body.options) body.options = normaliseOptions(body.options);
  return http.patch(`/owner/products/${id}`, body);
};

// What deleting this product would do, asked before the owner commits.
//
// → { can_delete, blocking_orders, active_subscribers }. `can_delete` is false
// while an order for it is still to be delivered — today's subscription round
// included — and `active_subscribers` is how many standing orders the delete
// would cancel, which is what the confirmation needs to say out loud.
export const getDeletionCheck = (id) => http.get(`/owner/products/${id}/deletion-check`);

// Soft delete — order history is unaffected.
//
// Refuses with 409 ACTIVE_ORDERS_EXIST while an undelivered order references
// the product. On success the server also cancels every active or paused
// subscription for it and notifies those customers.
export const deleteProduct = (id) => http.delete(`/owner/products/${id}`);

// Optimistic toggle; revert on failure. No quantities anywhere (D5).
export const setAvailability = (id, isAvailable) =>
  http.put(`/owner/products/${id}/availability`, { is_available: isAvailable });

// Numbers arrive from TextInputs as strings, and an empty MRP field means "no
// MRP" rather than zero. Cleaned here so every caller does not have to.
const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

const normaliseOptions = (options) =>
  options.map((o) => ({
    ...(o.id ? { id: o.id } : {}),
    qty_value: num(o.qty_value),
    qty_unit: o.qty_unit,
    container_code: o.container_code || undefined,
    items_in_pack: num(o.items_in_pack) ?? 1,
    price: num(o.price),
    // null clears a previously set MRP; undefined leaves it alone.
    mrp: o.mrp === '' || o.mrp === null || o.mrp === undefined ? null : Number(o.mrp),
    is_available: o.is_available !== false,
    is_default: o.is_default === true,
    min_qty: num(o.min_qty) ?? null,
    step_qty: num(o.step_qty) ?? null,
    // Saving the form is the owner confirming what the backfill guessed.
    needs_review: false,
  }));

// --- Form pickers (fetch once, cache) --------------------------------------

// Each unit carries base_label + tiers, so the form can preview
// "customers will see: 100g ₹X · 250g ₹Y…".
export const listUnits = () => http.get('/owner/units');

// Scoped by default to the sections this shop signed up for. `all` returns the
// full list, for "Selling something else?" — each row says which section it
// belongs to and whether picking it would list the shop somewhere new.
export const listProductCategories = (all = false) =>
  http.get('/owner/product-categories', { params: all ? { all: 'true' } : undefined });

// What a packed option comes IN — Packet, Bottle, Tray. Admin-managed, so the
// list can grow without an app release; never hard-code it here.
export const listPackContainers = () => http.get('/owner/pack-containers');

// The quantities a loose product may start at and step by, grouped by unit
// kind. Filter to the selected unit's kind before showing either dropdown.
export const listQuantityPresets = () => http.get('/owner/quantity-presets');

// Inline "type custom" category creation.
export const createProductCategory = (name, shopCategoryId) =>
  http.post('/owner/product-categories', { name, shop_category_id: shopCategoryId });
