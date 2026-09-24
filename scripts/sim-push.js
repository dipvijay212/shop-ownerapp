#!/usr/bin/env node
/**
 * Sends a test notification to the booted iOS simulator.
 *
 * Why this exists: @react-native-firebase/messaging deliberately refuses to
 * call registerForRemoteNotifications on an ARM64 simulator — "Use a physical
 * device for real APNs tokens" (RNFBMessagingModule.mm). So a simulator never
 * gets an APNs token, never gets an FCM token, and never reaches the server's
 * device_tokens table. Nothing the backend sends can arrive here. `xcrun simctl
 * push` injects the APNs payload straight into the simulator, skipping FCM
 * entirely, which is the only way to exercise notifications without a phone.
 *
 * The payload carries `gcm.message_id` because that one key is how RNFirebase
 * decides a notification is an FCM message
 * (RNFBMessaging+UNUserNotificationCenter.m). With it, a tap fires
 * onNotificationOpenedApp and a foreground delivery fires onMessage, so the
 * whole PushGate path runs exactly as it does in production. Without it iOS
 * still draws the banner but no JS ever sees the message, and the tap goes
 * nowhere.
 *
 * Usage:
 *   npm run push:sim                     # order_new
 *   npm run push:sim -- khata_request
 *   npm run push:sim -- --list
 *
 * Background the app to see the system banner. With the app in the foreground
 * iOS suppresses it by design and notifee redraws it from onMessage — which is
 * the path worth testing, since it is what an owner with the app open on the
 * counter actually sees.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BUNDLE_ID = 'com.paasora.partner';

// The backend ships PUBLIC ids in `data` — `order_id` is orders.public_id, not
// the LS- number a human reads on the order. These placeholders have the right
// shape but match no row, so a tap lands on the list and the app says the order
// is gone, which is the correct behaviour for a notification that outlived its
// row. To open the real sheet, pass an id from your database:
//
//   npm run push:sim -- order_new order_id=ord_01M391MX2XPZMFC1HZRKHBJKBN
//
// Any trailing key=value argument overrides that key in the preset's data.
const ORDER_ID = 'ord_00000000000000000000000000';
const SUB_ID = 'so_00000000000000000000000000';


// Wording as the backend sends it, and the `data` map that goes with it —
// every value a string, which is all FCM can carry. The types are the wire
// contract in localmart-backend notification-types.ts; pushService's
// actionForNotification routes on them.
const PRESETS = {
  order_new: {
    title: 'New order 🔔',
    body: 'LS-10049 — ₹50.00 (COD)',
    data: { type: 'order_new', order_id: ORDER_ID, order_no: 'LS-10049' },
  },
  // An order_new with no order behind it is the standing-round reminder, and
  // the app sends those to the subscriptions tab instead of an order.
  round: {
    title: 'Standing deliveries today',
    body: '4 standing orders to pack this morning.',
    data: { type: 'order_new' },
  },
  order_cancelled: {
    title: 'Order cancelled',
    body: 'LS-10049 was cancelled by the customer.',
    data: { type: 'order_cancelled', order_id: ORDER_ID, order_no: 'LS-10049' },
  },
  khata_request: {
    title: 'Khata request',
    body: 'Ramesh Patel is asking for udhari.',
    data: { type: 'khata_request' },
  },
  khata_charge: {
    title: 'Standing order over khata limit',
    body: 'LS-10045 takes this customer to ₹620.00, past their ₹300.00 limit.',
    data: { type: 'khata_charge', order_id: ORDER_ID, order_no: 'LS-10045' },
  },
  subscription_new: {
    title: 'New subscription',
    body: 'Taza milk — 1 L daily, starting tomorrow.',
    data: { type: 'subscription_new', standing_order_id: SUB_ID },
  },
  shop_approved: {
    title: 'Shop approved 🎉',
    body: 'Fresh Mart is live. Start taking orders.',
    data: { type: 'shop_approved' },
  },
  plan_expiring: {
    title: 'Plan expiring',
    body: 'Your plan ends in 3 days. Renew to keep taking orders.',
    data: { type: 'plan_expiring' },
  },
};

const names = Object.keys(PRESETS);
const arg = process.argv[2];

if (arg === '--list' || arg === '-l') {
  console.log(names.join('\n'));
  process.exit(0);
}

const name = arg || 'order_new';
const preset = PRESETS[name];
if (!preset) {
  console.error(`unknown preset "${name}". One of:\n  ${names.join('\n  ')}`);
  process.exit(1);
}


// Trailing key=value arguments override the preset's data — see the note by
// the id placeholders above.
const overrides = {};
for (const a of process.argv.slice(3)) {
  const i = a.indexOf('=');
  if (i > 0) overrides[a.slice(0, i)] = a.slice(i + 1);
}

const payload = {
  aps: { alert: { title: preset.title, body: preset.body }, sound: 'default' },
  // Fresh every run: PushGate remembers the messageIds it has already acted on
  // for the life of the process, so a repeated id would be deduped and the
  // second tap silently ignored.
  'gcm.message_id': `sim-${Date.now()}`,
  ...preset.data,
  ...overrides,
};

const file = path.join(os.tmpdir(), `sim-push-${process.pid}.json`);
fs.writeFileSync(file, JSON.stringify(payload));
try {
  execFileSync('xcrun', ['simctl', 'push', 'booted', BUNDLE_ID, file], { stdio: 'inherit' });
  console.log(`sent "${name}" → ${BUNDLE_ID}`);
} catch (e) {
  console.error('push failed — is a simulator booted and the app installed?');
  process.exit(1);
} finally {
  fs.unlinkSync(file);
}
