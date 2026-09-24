// Orders management, settlement and refunds (O-10, O-12, O-13).
//
// Every action returns the UPDATED order — replace the card in place rather
// than refetching the list. On 409, re-fetch that one order and show the
// one-line reason (e.g. "Customer cancelled this order").

import { http, idempotent } from '../httpClient';

// GET /owner/orders → { items, meta }
// Tabs map to `status`; the Refund tab uses status='refund_pending'.
// `status: 'working'` is the default screen — everything unfinished plus
// whatever was settled today. `from`/`to` are IST days and filter in the
// DATABASE: filtering dates on the client only ever saw one capped page, so a
// month-long range silently showed just its most recent corner.
export const listOrders = ({ status, q, sort, cursor, limit, from, to } = {}) =>
  http.get('/owner/orders', {
    params: {
      status: status && status !== 'all' ? status : undefined,
      q: q || undefined,
      sort,
      cursor,
      limit,
      from: from || undefined,
      to: to || undefined,
    },
  });

export const getOrder = (orderId) => http.get(`/owner/orders/${orderId}`);

export const accept = (orderId) => http.post(`/owner/orders/${orderId}/accept`, {});

// Reason is mandatory and is shown to the customer.
export const decline = (orderId, reason) =>
  http.post(`/owner/orders/${orderId}/decline`, { reason });

// Calling off an order the shop already accepted. `decline` is the one for an
// order still sitting in `placed`; this covers preparing, ready and
// out-for-delivery, right up to the moment it is marked delivered.
export const cancel = (orderId, reason) =>
  http.post(`/owner/orders/${orderId}/cancel`, { reason });

export const markReady = (orderId) => http.post(`/owner/orders/${orderId}/ready`, {});

export const outForDelivery = (orderId) =>
  http.post(`/owner/orders/${orderId}/out-for-delivery`, {});

// Complete a COD delivery through the settlement modal.
//   mode: 'full_payment' | 'full_khata' | 'partial'
//   cash_amount: required for 'partial'; the remainder goes to Khata.
// Response carries settlement { mode, cash_amount, khata_amount }.
export const deliverCod = (orderId, { mode, cashAmount }, idempotencyKey) =>
  http.post(
    `/owner/orders/${orderId}/deliver`,
    mode === 'partial' ? { mode, cash_amount: Number(cashAmount) } : { mode },
    idempotent(idempotencyKey),
  );

// Prepaid orders skip the modal entirely — empty body.
export const deliverPrepaid = (orderId, idempotencyKey) =>
  http.post(`/owner/orders/${orderId}/deliver`, {}, idempotent(idempotencyKey));

// Declined/cancelled PAID order, after refunding the customer offline.
export const markRefunded = (orderId, { refundMode, proofNote }, idempotencyKey) =>
  http.post(
    `/owner/orders/${orderId}/mark-refunded`,
    { refund_mode: refundMode, proof_note: proofNote },
    idempotent(idempotencyKey),
  );

// "Mark Balance Payment Received" on a delivered COD order that left a khata
// balance (from the order detail sheet).
export const settleBalance = (orderId, { amount, paymentMode, proofNote }, idempotencyKey) =>
  http.post(
    `/owner/orders/${orderId}/settle-balance`,
    { amount: Number(amount), payment_mode: paymentMode, proof_note: proofNote },
    idempotent(idempotencyKey),
  );
