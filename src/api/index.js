// Single import surface for the Owner app's API layer.
//
//   import { api } from '../api';
//   const dash = await api.business.getDashboard();

import * as auth from './endpoints/auth';
import * as shop from './endpoints/shop';
import * as orders from './endpoints/orders';
import * as products from './endpoints/products';
import * as khata from './endpoints/khata';
import * as business from './endpoints/business';
import * as notifications from './endpoints/notifications';
import * as platform from './endpoints/platform';
import * as subscriptions from './endpoints/subscriptions';

export const api = { auth, shop, orders, products, khata, business, notifications, platform, subscriptions };

export { ApiError, getRetryAfterSeconds } from './errors';
export { http, newIdempotencyKey, checkHealth } from './httpClient';
export {
  clearSession,
  getDeviceId,
  loadSession,
  onSessionExpired,
  saveOwner,
  saveShop,
  saveTokens,
} from './session';
export * from './format';

export default api;
