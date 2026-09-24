// Shop lifecycle: onboarding wizard, verification routing, settings
// (O-03 – O-09, O-22 – O-24, O-27).

import { http } from '../httpClient';

// GET /owner/shop — call on every app open after auth and route by
// data.status: draft | pending_verification | rejected | approved | suspended.
// Also the source of truth for the current delivery zone and store hours.
export const getShop = () => http.get('/owner/shop');

// Shop-category master for the Step 2 multi-select → [{ id, name, icon_url }].
// `id` is what createShop() wants in category_ids; names are never accepted.
// Only active categories come back, so the picker can render the list as-is.
export const listShopCategories = () => http.get('/owner/shop-categories');

// Step 2 — create. Details are geocoded to the pin; the trial clock is
// anchored to creation.
export const createShop = ({
  name,
  category_ids,
  contact_phone,
  address_line,
  lat,
  lng,
  banner_url,
  avg_prep_eta_mins,
}) =>
  http.post('/owner/shop', {
    name,
    category_ids,
    contact_phone,
    address_line,
    lat,
    lng,
    banner_url,
    avg_prep_eta_mins,
  });

// Later edits (Business Profile) use PATCH with the same field names.
export const updateShop = (patch) => http.patch('/owner/shop', patch);

// Step 3 — delivery boundary. Radius chips are 1/2/3/5/8 km, sent in METRES.
// A polygon ring is [[lng, lat], …] with ≥3 points and auto-closes.
// 400/422 on self-intersection: keep the drawing and ask for a redraw.
export const setDeliveryZone = ({ method, radius_m, ring }) =>
  http.put('/owner/shop/delivery-zone', method === 'radius' ? { method, radius_m } : { method, ring });

// Step 4 — read-only review summary, then submit for verification.
export const getShopReview = () => http.get('/owner/shop/review');

export const submitShop = () => http.post('/owner/shop/submit', {});

export const submitDocuments = ({
  aadhaar_url,
  aadhaar_number,
  pan_url,
  pan_number,
  trade_license_url,
  trade_license_number,
}) =>
  http.post('/owner/shop/documents', {
    aadhaar_url,
    aadhaar_number,
    pan_url,
    pan_number,
    trade_license_url,
    trade_license_number,
  });

export const getDocuments = () => http.get('/owner/shop/documents');

// Store hours — send all 7 rows. weekday 0=Sun … 6=Sat, "HH:MM".
export const setShopHours = (hours) => http.put('/owner/shop/hours', { hours });

// Online/Offline pill. Revert the switch on failure; the server refuses when
// the shop is not approved or the plan lapsed.
export const setOnline = (isOnline) => http.put('/owner/shop/online', { is_online: isOnline });

// Store QR (O-09) → { code, payload_url, image_url }
export const getShopQr = () => http.get('/owner/shop/qr');

// --- Payments settings (O-27) ----------------------------------------------

// → { online_payments_enabled, fee_note, bank_details: { …, verified_by_admin } }
export const getPaymentSettings = () => http.get('/owner/shop/payment-settings');

// Enabling without bank details on file is rejected — route into the bank
// form rather than surfacing the raw error.
export const setPaymentSettings = (enabled) =>
  http.put('/owner/shop/payment-settings', { online_payments_enabled: enabled });

// Editing after verification resets the verified flag — warn first.
export const setBankDetails = ({ account_holder, account_number, ifsc, upi_id }) =>
  http.put('/owner/shop/bank-details', { account_holder, account_number, ifsc, upi_id });
