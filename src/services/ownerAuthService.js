// Owner auth service — a thin, screen-facing wrapper over the real API.
//
// Replaces the previous AsyncStorage mock. Verifying an OTP for an unknown
// phone CREATES the owner account and returns is_new_user: true; the shop is
// then built through the onboarding wizard (O-03 – O-06).

import { api } from '../api';
import { getRetryAfterSeconds } from '../api/errors';
import { ApiError } from '../api/errors';

export const ownerAuthService = {
  // → { resend_in_sec, expires_in_sec }
  sendOtp: async (phone) => api.auth.requestOtp(phone),

  // → { access_token, refresh_token, access_expires_in, is_new_user }
  verifyOtp: async (phone, otp) => api.auth.verifyOtp(phone, otp),

  getOwnerProfile: async () => api.auth.getOwnerProfile(),

  // Step 1 of the wizard.
  updateOwnerProfile: async (patch) => api.auth.updateOwnerProfile(patch),

  // The shop drives every routing decision after login (§2.3). A brand-new
  // owner has no shop at all, which the API reports as 404 — treat that as
  // "start the wizard" rather than as an error.
  getShop: async () => {
    try {
      return await api.shop.getShop();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  logout: async (refreshToken) => api.auth.logout(refreshToken),

  getRetryAfterSeconds,
};

export default ownerAuthService;
