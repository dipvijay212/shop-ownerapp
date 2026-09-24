// Dashboard, insights, subscription and payouts
// (O-08, O-26, O-28, and the Insights screen).

import { http, idempotent } from '../httpClient';

// --- Dashboard (O-08) -------------------------------------------------------

// → { today_sales, yesterday_sales, pct_vs_yesterday,
//     counters: { new, processing, completed_today }, recent_orders: [...] }
export const getDashboard = () => http.get('/owner/dashboard');

// --- Subscription (O-26) ----------------------------------------------------

// → { state: 'trial'|'active'|'expired', trial: { ends_at, days_left },
//     current_period, coverage_ends_at, visibility_note }
export const getSubscription = () => http.get('/owner/subscription');

export const getSubscriptionPlan = () => http.get('/owner/subscription/plan');

export const getSubscriptionInvoices = ({ cursor, limit } = {}) =>
  http.get('/owner/subscription/invoices', { params: { cursor, limit } });

// Returns a Cashfree session (ALL payment modes, unlike customer checkout).
// → { invoice_id, amount, period_start, period_end, cf_order_id,
//     payment_session_id, cf_environment: 'SANDBOX'|'PRODUCTION' }
//
// The key must be STABLE for one Subscribe tap (a retry of that tap replays the
// same session) but NEW for a fresh attempt — the server replays a stored
// response for 24h, so a reused key hands back a dead session.
export const subscribe = (idempotencyKey) =>
  http.post('/owner/subscription/subscribe', {}, idempotent(idempotencyKey));

// → { invoice_id, status, gateway_status, paid_via, paid_at,
//     period_start, period_end, amount, coverage_ends_at }
export const getInvoicePaymentStatus = (invoiceId) =>
  http.get(`/owner/subscription/invoices/${invoiceId}/payment-status`);

// The Cashfree SDK's onVerify callback carries NO payment status — only the
// webhook marks an invoice paid. So after the SDK returns we watch the server's
// view until it settles, the same way the customer app resolves a UPI order.
export const pollInvoicePaymentStatus = async (
  invoiceId,
  { intervalMs = 3000, maxAttempts = 40, signal } = {},
) => {
  let last = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) break;
    last = await getInvoicePaymentStatus(invoiceId);
    if (isTerminalInvoice(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Ran out of budget: the caller must say "still confirming", never "paid".
  return last;
};

export const isTerminalInvoice = (status) =>
  status?.status === 'paid'
  || status?.status === 'failed'
  || status?.gateway_status === 'failed'
  || status?.gateway_status === 'expired';

// --- Online earnings & payouts (O-28, read-only) ----------------------------

// → { payable_balance, online_payments_enabled, ledger: [...], payouts: [...] }
export const getPayouts = ({ cursor, limit } = {}) =>
  http.get('/owner/payouts', { params: { cursor, limit } });

// --- Insights ---------------------------------------------------------------
// period: 'today' | '7d' | '30d' | 'custom' (+ from/to as YYYY-MM-DD).

const periodParams = ({ period = '30d', from, to } = {}) =>
  period === 'custom' ? { period, from, to } : { period };

export const getInsightsSummary = (opts) =>
  http.get('/owner/insights/summary', { params: periodParams(opts) });

export const getSalesTrend = (opts, granularity = 'day') =>
  http.get('/owner/insights/sales-trend', {
    params: { ...periodParams(opts), granularity },
  });

export const getTopProducts = (opts, { by = 'revenue', limit = 10 } = {}) =>
  http.get('/owner/insights/top-products', { params: { ...periodParams(opts), by, limit } });

export const getTopCustomers = (opts, { limit = 10 } = {}) =>
  http.get('/owner/insights/top-customers', { params: { ...periodParams(opts), limit } });

export const getPeakHours = (opts) =>
  http.get('/owner/insights/peak-hours', { params: periodParams(opts) });

// Always current outstanding — takes no period.
export const getKhataAging = () => http.get('/owner/insights/khata-aging');
