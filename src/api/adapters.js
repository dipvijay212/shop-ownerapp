// Translates API payloads into the shapes the screens render.
//
// Two things differ consistently between the wire format and what the UI wants:
//   * money arrives as a decimal STRING ("12.00") so it never loses precision in
//     transit — screens do arithmetic and .toFixed(), so it becomes a Number here
//     and exactly here;
//   * the customer is nested on orders ({ customer: { name, phone } }) but flat
//     on the dashboard payload ({ customer_name }). Both are normalised to the
//     flat customer_name / customer_phone the cards already use.
//
// Keeping this in one module means a field rename on the server is a one-file
// change rather than a hunt through every screen.

/** Decimal string → Number. Returns `fallback` for null/undefined/unparseable. */
export const money = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// --- Orders -----------------------------------------------------------------

// GET /owner/orders/{id} → items[]. `unit_price` is per tier unit; `line_total`
// is what the customer pays for the row, so prefer it over re-multiplying.
export const adaptOrderItem = (item) => ({
  product_id: item.product_id,
  name: item.name,
  image_url: item.image_url,
  kind: item.kind ?? item.product_kind ?? 'normal',
  unit: item.unit,
  tier_label: item.tier_label,
  quantity: money(item.quantity, 1),
  // "1 kg", "19 x 500 ml Bottle", "Set" — the server works this out from the
  // line's own sale mode, because the raw quantity does not say what it counts
  // (1000 is a kilo loose, a thousand packs packed).
  quantity_label: item.quantity_label ?? null,
  price: money(item.unit_price),
  line_total: money(item.line_total),
});

/**
 * Works for a list row (GET /owner/orders), a dashboard `recent_orders` entry,
 * and a full detail payload alike — detail-only fields simply come back
 * undefined for the leaner shapes.
 */
export const adaptOrder = (o) => ({
  id: o.id,
  orderNumber: o.order_no,
  status: o.status,
  paymentMethod: o.payment_method,
  paymentStatus: o.payment_status,
  // The customer asked for this order to go on their khata at checkout. It
  // travels as payment_method 'cod' plus this flag, so the flag is what tells
  // an Udhar order apart from a plain cash-on-delivery one.
  khataRequested: !!o.khata_requested,
  customer_id: o.customer?.id,
  customer_name: o.customer?.name ?? o.customer_name ?? 'Customer',
  customer_phone: o.customer?.phone ?? null,
  itemsCount: o.items_count ?? 0,
  total: money(o.grand_total),
  itemsTotal: money(o.items_total),
  deliveryFee: money(o.delivery_fee),
  createdAt: o.placed_at || o.created_at,
  deliveredAt: o.delivered_at ?? null,
  address: o.address ?? null,
  customerNote: o.customer_note ?? null,
  // A standing delivery, as opposed to a one-off basket.
  isSubscription: o.is_subscription === true || o.standing_order_id != null || o.type === 'subscription' || o.order_type === 'subscription',
  declineReason: o.decline_reason ?? null,
  cancelReason: o.cancel_reason ?? null,
  refund: o.refund ?? null,
  settlement: o.settlement
    ? {
        mode: o.settlement.mode,
        cash: money(o.settlement.cash_amount),
        khata: money(o.settlement.khata_amount),
      }
    : null,
  timeline: o.timeline ?? [],
  items: (o.items ?? []).map(adaptOrderItem),
});

// --- Products ---------------------------------------------------------------

export const adaptProduct = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description ?? '',
  image_url: p.image_url,
  // 'packed' | 'loose' — recorded on the product, not guessed from its unit.
  saleMode: p.sale_mode ?? null,
  // What one container holds — null on loose products.
  packSizeValue: p.pack_size_value ?? null,
  packSizeUnit: p.pack_size_unit ?? null,
  // What it comes in — 'bottle', 'sachet'… Null on loose products.
  packContainer: p.pack_container ?? null,
  categoryId: p.category?.id ?? null,
  category: p.category?.name ?? 'Uncategorised',
  unitCode: p.unit_code,
  unitLabel: p.unit_label,
  baseLabel: p.base_label,
  price: money(p.selling_price),
  mrp: p.mrp === null || p.mrp === undefined ? null : money(p.mrp),
  // The owner app talks about stock; the API models it as availability. Both
  // spellings are emitted so the existing cards keep rendering unchanged.
  inStock: p.is_available !== false,
  stock_status: p.is_available === false ? 'out_of_stock' : 'in_stock',
  unit: p.unit_label || p.unit_code,
  // Tiers are DERIVED BY THE SERVER from the base-unit price (D1) — the app
  // must never compute or submit them, only display them.
  tiers: (p.tiers ?? []).map((t) => ({
    label: t.label,
    multiplier: money(t.multiplier, 1),
    price: money(t.price),
    mrp: t.mrp_price === null || t.mrp_price === undefined ? null : money(t.mrp_price),
    is_base: t.is_base === true,
  })),
  // The owner's OWN pack sizes, empty when the product follows the unit's
  // standard ladder. `tiers` below is what the SERVER derived from them and is
  // display-only — seeding the edit form from it is what showed pack sizes the
  // owner never entered.
  customPacks: (p.tier_multipliers ?? []).map((t) => ({
    label: t.label,
    multiplier: money(t.multiplier, 1),
    // Prices the owner set for this pack specifically; null when the pack is
    // priced proportionally from the base.
    price: t.price != null ? money(t.price) : null,
    mrpPrice: t.mrp_price != null ? money(t.mrp_price) : null,
    is_base: t.is_base === true || t.is_default === true,
  })),
  // normal | subscription | both, and whether a standing order pays delivery.
  // The edit form seeds from these, so they must survive the adapter.
  kind: p.kind ?? 'normal',
  subscriptionChargeDelivery: p.subscription_charge_delivery === true,
  // "HH:mm", or null on a normal product.
  deliveryStartsAt: p.delivery_starts_at ?? null,
  deliveryEndsAt: p.delivery_ends_at ?? null,
  // What the product is actually SOLD as, one row per buyable option. The edit
  // form seeds every configuration field from these, so — like `kind` above —
  // they have to survive the adapter rather than be flattened into `tiers`.
  options: (p.options ?? []).map((o) => ({
    id: o.id,
    label: o.display_label,
    // "Pack of 6" against the full "Pack of 6 · 250 ml Bottle". The catalogue
    // card names one option beside a price and has no room for the long form.
    shortLabel: o.short_label ?? o.display_label,
    qtyValue: o.qty_value,
    qtyUnit: o.qty_unit,
    containerCode: o.container_code ?? null,
    containerLabel: o.container_label ?? null,
    itemsInPack: o.items_in_pack ?? 1,
    price: money(o.price),
    mrp: o.mrp === null || o.mrp === undefined ? null : money(o.mrp),
    isAvailable: o.is_available !== false,
    isDefault: o.is_default === true,
    // Grams, millilitres or pieces — the same units the loose stepper counts in.
    baseQuantity: o.base_quantity,
    minQty: o.min_qty ?? null,
    stepQty: o.step_qty ?? null,
    // Set where the Phase 1 backfill had to guess what was in a "pack".
    needsReview: o.needs_review === true,
  })),
  has_pack_options: (p.tier_multipliers ?? []).length > 0,
  pack_options: (p.tiers ?? []).map((t) => ({
    id: t.label,
    pack_name: t.label,
    multiplier: money(t.multiplier, 1),
    price: money(t.price),
    mrp: t.mrp_price === null || t.mrp_price === undefined ? null : money(t.mrp_price),
    is_base: t.is_base === true,
  })),
  createdAt: p.created_at,
});

// --- Khata ------------------------------------------------------------------

// Accepts a list row (flat: customer_id/name/phone) or a detail payload
// (nested under `customer`). Emits both the new names and the ones the ledger
// screen already renders.
export const adaptKhataCustomer = (c) => {
  const name = c.name ?? c.customer?.name;
  return {
  id: c.customer_id ?? c.customer?.id,
  name,
  // The ledger card draws a circle with the customer's initial. Nothing ever
  // produced this field, so every circle rendered blank.
  avatar: (String(name ?? '').trim().charAt(0) || '?').toUpperCase(),
  phone: c.phone ?? c.customer?.phone,
  totalOrders: c.total_orders ?? 0,
  ordersCount: c.total_orders ?? 0,
  lifetimeSpend: money(c.life_spending),
  lifetimeSpending: money(c.life_spending),
  // Positive means the customer owes the shop.
  outstanding: money(c.outstanding),
  outstandingCredit: money(c.outstanding),
  // Credit the shop holds for this customer. Separate from `outstanding` — the
  // next udhari charge spends it automatically, server-side.
  advanceBalance: money(c.advance_balance),
  // The udhari ceiling and what is left of it. null on accounts that predate
  // limits — those keep the old unlimited behaviour until one is set.
  creditLimit: c.credit_limit != null ? money(c.credit_limit) : null,
  creditAvailable: c.credit_available != null ? money(c.credit_available) : null,
  khataGiven: money(c.khata_given),
  khataRecovered: money(c.khata_recovered),
  lastOrderAt: c.last_order_at ?? null,
  history: [],
  };
};

// GET /khata/customers/{id}/activity — an append-only ledger. `balance_after`
// is the running due AFTER the row, which is what the audit column shows; it is
// recorded by the server and must never be recomputed client-side.
export const adaptKhataEntry = (e) => {
  const amount = money(e.amount);

  // Every entry_type the ledger can hold. Anything not explicitly matched used
  // to fall through to "Udhari Charge", which is how an advance deposit showed
  // up in the history as a charge — the exact opposite of what it is.
  const kind = e.entry_type;
  // `advance_applied` is the customer's own advance being spent against a
  // charge — it REDUCES what they owe (the balance in the screenshot goes
  // 40 -> 0). Leaving it out of this test rendered it red with a leading "+",
  // reading as another debt on a row that cleared one.
  const isMoneyIn = kind === 'repayment' || kind === 'advance_deposit' || kind === 'advance_applied';

  const detail =
    kind === 'repayment'
      ? `Udhari Repayment${e.payment_mode ? ` (${e.payment_mode})` : ''}`
      : kind === 'advance_deposit'
        ? `Advance Deposit${e.payment_mode ? ` (${e.payment_mode})` : ''}`
        : kind === 'advance_applied'
          ? `Advance Applied${e.order?.order_no ? ` · ${e.order.order_no}` : ''}`
          : kind === 'adjustment'
            ? 'Ledger Adjustment'
            // A standing delivery is charged to the khata exactly like any
            // other order, so the ledger calls it what it is. Whether it came
            // from a subscription is a fact about the ORDER, and the order is
            // one tap away — splitting the vocabulary here only made the same
            // kind of row look like two different things.
            : `Udhari Charge${e.order?.order_no ? ` · ${e.order.order_no}` : ''}`;

  return {
    id: e.id,
    // 'payment' renders green (money in), 'credit' red (money owed).
    type: isMoneyIn ? 'payment' : 'credit',
    entryType: kind,
    detail,
    amount: `${isMoneyIn ? '-' : '+'}₹${amount.toFixed(2)}`,
    balanceAfter: money(e.balance_after),
    // null, not '—': the card falls back to naming the entry type, and a
    // literal dash is truthy so that fallback never ran.
    mode: e.payment_mode || null,
    note: e.proof_note || '',
    orderId: e.order?.id ?? null,
    orderNo: e.order?.order_no ?? null,
    orderTotal: e.order ? money(e.order.total) : null,
    // How the order was settled at the door. For a split, the ledger line only
    // ever shows the khata half, so the card needs the rest to explain itself.
    settlement: e.order?.settlement
      ? {
          mode: e.order.settlement.mode,
          cash: money(e.order.settlement.cash_amount),
          khata: money(e.order.settlement.khata_amount),
        }
      : null,
    // A daily standing delivery, as opposed to a one-off basket.
    isSubscription: e.order?.is_subscription === true,
    date: new Date(e.created_at).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    // Every entry is server-written and immutable.
    verified: true,
  };
};

// --- Notifications ----------------------------------------------------------

// Mirrors NOTIFICATION_GROUPS in the backend's notifications.service.ts — the
// API sends `type`, never `category`, so the filter tabs and the tap-through
// routing had nothing to match on and silently did nothing.
const NOTIFICATION_CATEGORY = {
  order_new: 'orders',
  order_status_changed: 'orders',
  order_cancelled: 'orders',
  order_refund_marked: 'orders',
  order_pending_reminder: 'orders',
  standing_order_closed: 'orders',
  standing_order_paused: 'orders',
  standing_order_resumed: 'orders',
  standing_order_started: 'orders',
  standing_order_delivered: 'orders',
  standing_order_not_delivered: 'orders',
  offer: 'offers',
  shop_new: 'offers',
  khata_charge: 'khata',
  khata_repayment: 'khata',
  khata_advance: 'khata',
  khata_request: 'khata',
  khata_approved: 'khata',
  khata_rejected: 'khata',
  khata_limit_alert: 'khata',
  // The standing-order round — the arrangements this shop delivers on.
  subscription_new: 'subscription',
  standing_order_cancelled: 'subscription',
  // The monthly partner plan (O-26) is the owner's own account, not the round.
  // It used to share the 'subscription' tab, which put renewal receipts in
  // front of an owner looking for their deliveries.
  trial_ending: 'account',
  plan_expiring: 'account',
  plan_expired: 'account',
  plan_renewed: 'account',
  payout_processed: 'account',
  shop_approved: 'account',
  shop_rejected: 'account',
};

export const adaptNotification = (n) => ({
  id: n.id,
  type: n.type,
  category: NOTIFICATION_CATEGORY[n.type] ?? 'other',
  title: n.title,
  body: n.body,
  orderId: n.data?.order_id ?? null,
  orderNo: n.data?.order_no ?? null,
  isRead: !!n.is_read,
  createdAt: n.created_at,
  // The same payload a push carries, so a card and a tapped push act alike.
  data: { ...(n.data ?? {}), type: n.type },
});

// The activity endpoint returns TWO lists: `items` (ledger entries) and
// `orders` (that customer's orders with this shop). The Khata tab reads the
// former, the History tab the latter — they are not interchangeable, and a
// customer who always pays in full has orders but no ledger entries at all.
export const adaptKhataOrder = (o) => ({
  id: o.id,
  orderNumber: o.order_no,
  status: o.status,
  total: money(o.grand_total),
  createdAt: o.created_at,
  date: new Date(o.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
});

// GET /owner/khata/ledger → the shop's whole book.
//
// Every amount arrives as a STRING ("521.00"); rendering one straight from the
// response and calling .toFixed() on it is what broke the dashboard panel.
// Amounts become numbers here, like every other adapter in this file.
export const adaptShopLedger = (d) => ({
  totalOutstanding: money(d?.total_outstanding),
  totalAdvance: money(d?.total_advance),
  customersWithDues: Number(d?.customers_with_dues ?? 0),
  customersTotal: Number(d?.customers_total ?? 0),
  items: (d?.items ?? []).map((e) => ({
    id: e.id,
    entryType: e.entry_type,
    amount: money(e.amount),
    balanceAfter: money(e.balance_after),
    paymentMode: e.payment_mode ?? null,
    customerName: e.customer?.name || e.customer?.phone || '',
    orderNo: e.order_no ?? null,
    isSubscription: e.is_subscription === true,
    createdAt: e.created_at,
  })),
});

// GET /owner/subscriptions/round and /history → a standing delivery, shaped for
// the SAME card the Orders screen uses. Names match `adaptOrder` deliberately:
// a standing delivery is an ordinary order and the card should not have to care.
export const adaptRoundOrder = (o) => ({
  id: o?.id,
  orderNumber: o?.order_no ?? null,
  status: o?.status,
  scheduledDate: o?.scheduled_date ?? null,
  deliveryWindow: o?.delivery_window
    ? { startsAt: o.delivery_window.starts_at, endsAt: o.delivery_window.ends_at }
    : null,
  customer_name: o?.customer?.name || o?.customer?.phone || '',
  customer_phone: o?.customer?.phone ?? '',
  customerNote: null,
  address: o?.address ?? null,
  items: (o?.items ?? []).map((i) => ({
    name: i.name,
    // CollapsibleOrderItems reads `quantity_label` and `line_total`.
    quantity: Number(i.quantity ?? 1),
    quantity_label: i.quantity_label ?? null,
    line_total: money(i.line_total),
    price: money(i.line_total) / Math.max(1, Number(i.quantity ?? 1)),
    tier_label: i.tier_label ?? null,
  })),
  total: money(o?.grand_total),
  khataRequested: o?.khata_requested === true,
  notDeliveredReason: o?.not_delivered_reason ?? null,
  createdAt: o?.created_at ?? null,
});

export const adaptRound = (d) => ({
  date: d?.date ?? null,
  today: d?.today ?? null,
  customersAway: Number(d?.customers_away ?? 0),
  pendingCount: Number(d?.pending_count ?? 0),
  items: (d?.items ?? []).map(adaptRoundOrder),
});

export const adaptRoundHistory = (d) => ({
  from: d?.from ?? null,
  to: d?.to ?? null,
  totals: {
    deliveries: Number(d?.totals?.deliveries ?? 0),
    delivered: Number(d?.totals?.delivered ?? 0),
    notDelivered: Number(d?.totals?.not_delivered ?? 0),
    value: money(d?.totals?.value),
  },
  items: (d?.items ?? []).map(adaptRoundOrder),
  nextCursor: d?.meta?.next_cursor ?? null,
});

// --- Partner plan subscription (O-26) ---------------------------------------
// The monthly plan the SHOP buys — not the standing orders that customers
// subscribe to, which live under adaptRound* above.

/** GET /owner/subscription → the trial / active / expired status card. */
export const adaptPlanSubscription = (d) => ({
  state: d?.state ?? 'expired', // 'trial' | 'active' | 'expired'
  trialEndsAt: d?.trial?.ends_at ?? null,
  trialDaysLeft: Number(d?.trial?.days_left ?? 0),
  currentPeriod: d?.current_period
    ? {
        plan: d.current_period.plan,
        startsAt: d.current_period.starts_at,
        endsAt: d.current_period.ends_at,
        source: d.current_period.source, // 'cashfree' | 'admin_grant'
      }
    : null,
  // A month that is paid for but has not begun — what you get when you
  // subscribe while the trial is still running, since the paid period stacks
  // after it. Without this the screen had no way to tell "still on trial" from
  // "still on trial, and already paid for the month after it".
  upcomingPeriod: d?.upcoming_period
    ? {
        plan: d.upcoming_period.plan,
        startsAt: d.upcoming_period.starts_at,
        endsAt: d.upcoming_period.ends_at,
        source: d.upcoming_period.source,
      }
    : null,
  // Trial end or paid period end, whichever is later — the date the shop
  // actually stops being visible to customers (D7).
  coverageEndsAt: d?.coverage_ends_at ?? null,
  visibilityNote: d?.visibility_note ?? null,
});

/** GET /owner/subscription/plan → price is admin-editable, never hardcoded. */
export const adaptPlan = (d) => ({
  id: d?.id ?? null,
  code: d?.code ?? null,
  name: d?.name ?? '',
  priceMonth: money(d?.price_month),
  features: Array.isArray(d?.features) ? d.features : [],
});

/** One row of GET /owner/subscription/invoices. */
export const adaptPlanInvoice = (i) => ({
  id: i?.id ?? null,
  plan: i?.plan ?? '',
  amount: money(i?.amount),
  periodStart: i?.period_start ?? null,
  periodEnd: i?.period_end ?? null,
  status: i?.status ?? 'pending', // 'pending' | 'paid' | 'failed'
  paidVia: i?.paid_via ?? null,
  paidAt: i?.paid_at ?? null,
});
