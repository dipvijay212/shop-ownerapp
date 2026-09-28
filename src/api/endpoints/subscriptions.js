// Standing orders — the milk round. The shop's side: the windows it delivers
// in, the dates it is shut, and confirming the round itself.
//
// The rule the whole feature rests on: money is written when the shop taps
// Delivered, never when the order is generated. "Not delivered" therefore
// costs the customer nothing and needs no correction afterwards.

import { http } from '../httpClient';

// ── closed dates ────────────────────────────────────────────────────────────

export const listClosures = () => http.get('/owner/subscriptions/closures');

// Closing a date tells every subscriber the evening before.
export const addClosure = (date, reason) =>
  http.post('/owner/subscriptions/closures', { date, reason });

export const removeClosure = (date) => http.delete(`/owner/subscriptions/closures/${date}`);

// ── who has a standing order with this shop ─────────────────────────────────

// Distinct from the round: this is the arrangement itself, whether or not any
// order has been generated from it yet.
export const listSubscribers = (status) =>
  http.get('/owner/subscriptions/list', { params: { status } });

// ── the "something new" badge ───────────────────────────────────────────────

// How many new subscriptions the owner has not looked at yet.
export const getUnseenCount = () => http.get('/owner/subscriptions/unseen');

// Called when the round screen opens — that IS the owner having seen them.
export const clearUnseen = () => http.post('/owner/subscriptions/unseen/clear', {});

// ── quantity change requests ───────────────────────────────────────────────

// Customers asking for a different quantity on one delivery. Pending only by
// default; each carries `answer_by`, after which it expires on its own.
export const listChangeRequests = (status) =>
  http.get('/owner/subscriptions/change-requests', { params: status ? { status } : undefined });

export const approveChangeRequest = (id) =>
  http.post(`/owner/subscriptions/change-requests/${id}/approve`, {});

export const rejectChangeRequest = (id, reason) =>
  http.post(`/owner/subscriptions/change-requests/${id}/reject`, { reason });

// ── the round ───────────────────────────────────────────────────────────────

// GET /owner/subscriptions/round → { date, customers_away, pending_count, items }
// Today only. A fresh day is a fresh list; anything confirmed moves to history.
export const getRound = (date) =>
  http.get('/owner/subscriptions/round', { params: date ? { date } : undefined });

// Past deliveries. No range = the last 30 days; `from` alone = that single day.
export const getHistory = ({ from, to, cursor, limit } = {}) =>
  http.get('/owner/subscriptions/history', { params: { from, to, cursor, limit } });

// One action for the whole morning — twenty identical taps is not a workflow.
export const deliverAll = (date) =>
  http.post('/owner/subscriptions/round/deliver-all', {}, { params: date ? { date } : undefined });

export const markDelivered = (orderId) =>
  http.post(`/owner/subscriptions/round/${orderId}/delivered`, {});

export const markNotDelivered = (orderId, reason) =>
  http.post(`/owner/subscriptions/round/${orderId}/not-delivered`, { reason });
