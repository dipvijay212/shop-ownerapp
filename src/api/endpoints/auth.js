// Owner auth — OTP request/verify, refresh, logout (O-01, O-02).

import { http } from '../httpClient';
import { AUDIENCE } from '../config';
import { getDeviceId, saveTokens, clearSession } from '../session';

// POST /auth/owner/otp/request → { resend_in_sec, expires_in_sec }
export const requestOtp = (phone) => http.post(`/auth/${AUDIENCE}/otp/request`, { phone });

// POST /auth/owner/otp/verify
// → { access_token, refresh_token, access_expires_in, is_new_user }
// is_new_user: true → onboarding Step 1; else route by shop status (§2.3).
export const verifyOtp = async (phone, otp) => {
  const device_id = await getDeviceId();
  const payload = await http.post(`/auth/${AUDIENCE}/otp/verify`, { phone, otp, device_id });
  await saveTokens(payload);
  return payload;
};

export const refreshSession = async (refresh_token) => {
  const device_id = await getDeviceId();
  const payload = await http.post('/auth/token/refresh', { refresh_token, device_id });
  await saveTokens(payload);
  return payload;
};

export const logout = async (refresh_token) => {
  try {
    if (refresh_token) await http.post('/auth/logout', { refresh_token });
  } finally {
    await clearSession();
  }
};

// --- Owner profile (Step 1 / Personal Details) ------------------------------

export const getOwnerProfile = () => http.get('/owner/me');

export const updateOwnerProfile = ({ full_name, email, language }) => {
  const body = {};
  if (full_name !== undefined) body.full_name = full_name;
  if (email !== undefined) body.email = email;
  if (language !== undefined) body.language = language;
  return http.patch('/owner/me', body);
};

// Type-to-confirm; explains orders/ledgers are retained and the shop is
// suspended so it disappears from customer search.
export const deleteOwnerAccount = () => http.delete('/owner/me');
