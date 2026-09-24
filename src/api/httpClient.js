// The one axios instance every endpoint module goes through (Owner app).
//
// Responsibilities:
//   * attach the bearer token (except on public paths)
//   * unwrap the { data } envelope so callers get the payload directly
//   * normalize every failure into an ApiError
//   * refresh once on 401, replaying the queued requests that raced it
//   * stamp Idempotency-Key on the mutations that require it (§0)

import axios from 'axios';
import { API_BASE_URL, API_ROOT_URL, API_TIMEOUT_MS, isPublicPath } from './config';
import { ApiError, toApiError } from './errors';
import {
  clearSession,
  emitSessionExpired,
  getAccessToken,
  getDeviceId,
  getRefreshToken,
  saveTokens,
} from './session';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-Tunnel-Skip-Anti-Phishing-Page': 'true',
  },
});

// --- Idempotency ------------------------------------------------------------

// Reuse the SAME key when retrying the same user action; a new tap = a new key.
export const newIdempotencyKey = () => {
  const hex = (n) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
};

// --- Refresh single-flight --------------------------------------------------

let refreshPromise = null;

const performRefresh = async () => {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new ApiError({ code: 'NO_REFRESH_TOKEN', status: 401 });

  const device_id = await getDeviceId();
  // Bypass `client` so this request can never recurse through the 401 handler.
  const res = await axios.post(
    `${API_BASE_URL}/auth/token/refresh`,
    { refresh_token, device_id },
    {
      timeout: API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-Tunnel-Skip-Anti-Phishing-Page': 'true',
      },
    },
  );
  const payload = res.data?.data || {};
  await saveTokens(payload);
  return payload.access_token;
};

const refreshOnce = () => {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// --- Interceptors -----------------------------------------------------------

client.interceptors.request.use((config) => {
  const url = config.url || '';
  if (!isPublicPath(url)) {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.idempotent && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = config.idempotencyKey || newIdempotencyKey();
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const status = error?.response?.status;

    const canRetry =
      status === 401 &&
      config &&
      !config.__isRetry &&
      !isPublicPath(config.url || '') &&
      getRefreshToken();

    if (canRetry) {
      try {
        const token = await refreshOnce();
        config.__isRetry = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return client(config);
      } catch (refreshError) {
        // Refresh failed too — drop the session and let the navigator send the
        // user to login while preserving any deep link (§0).
        await clearSession();
        emitSessionExpired();
        return Promise.reject(toApiError(error));
      }
    }

    if (status === 401 && !isPublicPath(config?.url || '')) {
      await clearSession();
      emitSessionExpired();
    }

    return Promise.reject(toApiError(error));
  },
);

// --- Request helpers --------------------------------------------------------

// Returns the unwrapped `data` payload. List endpoints resolve to
// { items, meta } — `meta.next_cursor` is nested inside data, not alongside it.
const request = async (config) => {
  try {
    const response = await client(config);
    return response.data?.data;
  } catch (error) {
    throw toApiError(error);
  }
};

export const http = {
  get: (url, config = {}) => request({ ...config, method: 'get', url }),
  post: (url, data, config = {}) => request({ ...config, method: 'post', url, data }),
  put: (url, data, config = {}) => request({ ...config, method: 'put', url, data }),
  patch: (url, data, config = {}) => request({ ...config, method: 'patch', url, data }),
  // DELETE with a body is used by /devices, so `data` is passed through.
  delete: (url, config = {}) => request({ ...config, method: 'delete', url }),
};

// Mutations that must be idempotent: checkout, deliver, mark-refunded,
// settle-balance, repayments, subscribe.
export const idempotent = (key) => ({ idempotent: true, idempotencyKey: key });

// `/health` lives at the server root rather than under /v1.
export const checkHealth = async () => {
  const res = await axios.get(`${API_ROOT_URL}/health`, {
    timeout: API_TIMEOUT_MS,
    headers: { 'X-Tunnel-Skip-Anti-Phishing-Page': 'true' },
  });
  return res.data;
};

export default client;
