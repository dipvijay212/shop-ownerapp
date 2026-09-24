// Normalized API error (Owner app).
//
// The backend always fails with { error: { code, message, details } }.
// Screens switch on `code`, never on HTTP status text.

export class ApiError extends Error {
  constructor({ code, message, details, status, isNetworkError = false }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.code = code || (isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN');
    this.details = details ?? null;
    this.status = status ?? null;
    this.isNetworkError = isNetworkError;
  }

  // Order actions race the customer: 409 means re-fetch that order and show
  // the one-line reason ("Customer cancelled this order").
  get isConflict() {
    return this.status === 409;
  }

  get isInvalidTransition() {
    return this.code === 'INVALID_TRANSITION';
  }

  // A notification outlives the row it is about: tapped days later the order
  // may be gone, or a different owner may be signed in on this phone, and
  // neither is a fault worth a red box.
  get isNotFound() {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }

  get isThrottled() {
    return this.status === 429;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isValidation() {
    return this.status === 400 || this.status === 422;
  }
}

export const toApiError = (error) => {
  if (error instanceof ApiError) return error;

  if (!error?.response) {
    const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
    const message = isTimeout
      ? 'Connection timed out. Please check your network or server status.'
      : (error?.message && error.message !== 'Network Error'
          ? error.message
          : 'Unable to connect to backend server. Please check your connection and try again.');

    return new ApiError({
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message,
      status: null,
      isNetworkError: true,
    });
  }

  const { status, data } = error.response;
  const payload = data?.error || {};

  return new ApiError({
    code: payload.code,
    message: payload.message,
    details: payload.details,
    status,
  });
};

export const getRetryAfterSeconds = (error) => {
  const d = error?.details;
  if (!d) return null;
  const raw = d.retry_after_sec ?? d.retry_after ?? d.resend_in_sec ?? d.wait_seconds;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
};

/**
 * The most useful sentence to put in front of a person.
 *
 * `details` carries per-field validation messages when the server sends them;
 * they say more than the generic message above them. Mirrors the customer
 * app's helper of the same name.
 */
export const getErrorText = (error) => {
  const d = error?.details;
  if (Array.isArray(d) && d.length > 0) return d.join('\n');
  if (typeof d === 'string' && d.trim()) return d;
  return error?.message || 'Something went wrong. Please try again.';
};
