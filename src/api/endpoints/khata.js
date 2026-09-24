// Digital ledger (O-18 – O-21).
//
// The activity feed is tamper-proof: entries are immutable once written and
// every row carries the running balance ("Due After Txn").

import { http, idempotent } from '../httpClient';

// GET /owner/khata/customers → { items, meta }
// items: { customer_id, name, phone, total_orders, life_spending,
//          outstanding, last_order_at }
// The shop's whole khata: total outstanding and recent movements across every
// customer — what the dashboard's Khata panel shows.
export const getShopLedger = (limit) =>
  http.get('/owner/khata/ledger', { params: limit ? { limit } : undefined });

export const listCustomers = ({ q, cursor, limit } = {}) =>
  http.get('/owner/khata/customers', { params: { q: q || undefined, cursor, limit } });

export const getCustomer = (customerId) => http.get(`/owner/khata/customers/${customerId}`);

// Charges (+), repayments (−), running balance, order refs.
export const getActivity = (customerId, { cursor, limit } = {}) =>
  http.get(`/owner/khata/customers/${customerId}/activity`, { params: { cursor, limit } });

// Immutable once saved. Block amount > outstanding client-side too.
// On 409 the balance moved since load: re-fetch the profile, tell the owner
// what changed, and re-validate the amount before retrying.
// GET /owner/khata/requests — customers waiting for khata approval.
export const listKhataRequests = () => http.get('/owner/khata/requests');

// How many of those are still undecided — the red badge on More.
// There is no "clear" call to pair with this, unlike the subscription dot: a
// khata request is an action item, so the badge drains only as each one is
// approved or rejected, not when the owner glances at the screen.
export const getPendingRequestCount = () => http.get('/owner/khata/requests/unseen');

// POST /owner/khata/customers/{id}/approval — grant or refuse khata.
// Approval is what lets that customer pay by Udhar at checkout.
// Approving requires an udhari limit — the server refuses without one, because
// a khata with no ceiling is an open tab.
export const decideKhata = (customerId, approve, creditLimit) =>
  http.post(`/owner/khata/customers/${customerId}/approval`, {
    approve,
    credit_limit: approve ? Number(creditLimit) : undefined,
  });

// POST /owner/khata/customers/{id}/limit — raise or lower it later.
export const setKhataLimit = (customerId, creditLimit) =>
  http.post(`/owner/khata/customers/${customerId}/limit`, { credit_limit: Number(creditLimit) });

// POST /owner/khata/customers/{id}/advances — money taken BEFORE it is owed.
// It does not reduce the current due: it builds a credit that the customer's
// NEXT udhari charge spends automatically, server-side.
export const recordAdvance = (
  customerId,
  { amount, paymentMode, proofNote },
  idempotencyKey,
) =>
  http.post(
    `/owner/khata/customers/${customerId}/advances`,
    { amount: Number(amount), payment_mode: paymentMode, proof_note: proofNote || undefined },
    idempotent(idempotencyKey),
  );

export const recordRepayment = (
  customerId,
  { amount, paymentMode, proofNote },
  idempotencyKey,
) =>
  http.post(
    `/owner/khata/customers/${customerId}/repayments`,
    { amount: Number(amount), payment_mode: paymentMode, proof_note: proofNote },
    idempotent(idempotencyKey),
  );
