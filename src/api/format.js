// Display helpers for values the API returns in its own conventions.
//
// Money arrives as a STRING with 2 decimals ("245.00"). Format it as-is —
// parseFloat is for arithmetic the server has already done, not for display.

export const formatMoney = (value, { withSymbol = true } = {}) => {
  if (value === null || value === undefined || value === '') return withSymbol ? '₹0.00' : '0.00';
  const str = typeof value === 'string' ? value : Number(value).toFixed(2);
  return withSymbol ? `₹${str}` : str;
};

// Only for genuinely client-side comparisons (e.g. "is this zero?").
export const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export const isZeroMoney = (value) => toNumber(value) === 0;

// distance_m → "470 m" / "1.2 km"
export const formatDistance = (metres) => {
  const m = Number(metres);
  if (!Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
};

export const formatEta = (mins) => (Number.isFinite(Number(mins)) ? `${Math.round(mins)} mins` : '');

// --- Order status -----------------------------------------------------------

export const ORDER_STATUS_LABELS = {
  payment_pending: 'Payment Pending',
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  declined: 'Declined',
  cancelled: 'Cancelled',
  voided: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS = {
  pending: 'Payment Pending',
  paid: 'Paid',
  failed: 'Payment Failed',
  expired: 'Payment Expired',
  refund_pending: 'Refund Pending',
  refunded: 'Refunded',
  not_applicable: 'Cash on Delivery',
};

export const orderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status || '';

export const paymentStatusLabel = (status) => PAYMENT_STATUS_LABELS[status] || status || '';

// The customer may cancel only while the shop has not accepted yet.
export const canCancelOrder = (order) => order?.status === 'placed';

export const isRefundPending = (order) => order?.payment_status === 'refund_pending';

// Tier label for a cart/order line: "500g", "1 Pack"…
export const tierLabel = (item) => item?.tier_label || item?.unit || '';

// --- Dates ------------------------------------------------------------------

export const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// --- Owner-specific labels --------------------------------------------------

// Drives post-submit routing (§2.3): every app open reads GET /owner/shop.
export const SHOP_STATUS = {
  draft: 'draft',
  pending_verification: 'pending_verification',
  rejected: 'rejected',
  approved: 'approved',
  suspended: 'suspended',
};

export const SETTLEMENT_MODE_LABELS = {
  full_payment: '100% Full Payment',
  full_khata: '100% Khata',
  partial: 'Partial',
};

export const settlementModeLabel = (mode) => SETTLEMENT_MODE_LABELS[mode] || mode || '';

// A COD order opens the settlement modal; a prepaid one completes directly.
export const needsSettlementModal = (order) =>
  order?.payment_method === 'cod' && order?.payment_status !== 'paid';

// Refund tab: declined/cancelled orders that were paid online.
export const needsRefundAction = (order) => order?.payment_status === 'refund_pending';

// "Cash/UPI Paid ₹x · Khata Udhar ₹y" chips on a delivered COD card.
export const settlementChips = (settlement) => {
  if (!settlement) return [];
  const chips = [];
  if (toNumber(settlement.cash_amount) > 0) {
    chips.push(`Cash Paid ${formatMoney(settlement.cash_amount)}`);
  }
  if (toNumber(settlement.khata_amount) > 0) {
    chips.push(`Khata Udhar ${formatMoney(settlement.khata_amount)}`);
  }
  return chips;
};

// Khata ledger entry types from GET /owner/khata/customers/:id/activity.
export const isKhataCharge = (entry) => entry?.entry_type === 'udhari_charge';
export const isKhataRepayment = (entry) => entry?.entry_type === 'repayment';
