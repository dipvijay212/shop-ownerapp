// Cashfree PG checkout for the monthly partner plan (O-26).
//
// The SDK is callback-based and GLOBAL: `setCallback` registers one listener
// pair for the whole app, so a payment that forgets to remove its callback
// leaves a stale closure that the next payment's result fires into. Everything
// here exists to keep that single registration matched to a single promise.
//
// Note what `onVerify` does and does not mean. It fires when the checkout sheet
// closes on what the SDK believes was a completed payment — it carries only the
// order id, no status. It is NOT proof of payment. The webhook is the only
// thing that marks an invoice paid, so callers must still poll the server
// (see api.business.pollInvoicePaymentStatus).

import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import { CFEnvironment, CFSession } from 'cashfree-pg-api-contract';

export class CashfreePaymentError extends Error {
  constructor(message, { code, cancelled = false } = {}) {
    super(message);
    this.name = 'CashfreePaymentError';
    this.code = code ?? null;
    // A user backing out of the sheet is not a failure worth shouting about.
    this.cancelled = cancelled;
  }
}

// Cashfree reports a user-dismissed sheet as an error like any other. These are
// the shapes it uses for "nothing went wrong, they just left".
const CANCELLED = /cancel|abort|user.?dropped|dismiss|closed by user/i;

// CFErrorResponse keeps its fields private behind getters, but a plain object
// turns up here too (older builds, and the throw path below), so read both.
const readError = (error) => {
  const pick = (getter, field) => {
    try {
      return error?.[getter]?.() ?? error?.[field] ?? '';
    } catch {
      return error?.[field] ?? '';
    }
  };
  const status = pick('getStatus', 'status');
  const message = pick('getMessage', 'message');
  const code = pick('getCode', 'code');
  const type = pick('getType', 'type');
  return {
    code: code || null,
    message: String(message || 'Payment could not be completed'),
    cancelled: CANCELLED.test(`${status} ${message} ${code} ${type}`),
  };
};

/**
 * Opens Cashfree's hosted checkout and settles when the sheet closes.
 *
 * @returns {Promise<{ orderId: string }>} resolves on onVerify — meaning the
 *   flow finished, NOT that money moved. Confirm with the server.
 * @throws {CashfreePaymentError} on failure or user cancellation.
 */
export const startPayment = ({ paymentSessionId, orderId, environment = 'SANDBOX' }) =>
  new Promise((resolve, reject) => {
    if (!paymentSessionId || !orderId) {
      reject(new CashfreePaymentError('Missing Cashfree session details'));
      return;
    }

    let settled = false;
    // Both SDK callbacks and the throw path funnel through here, so the global
    // listener is torn down exactly once no matter how the sheet ends.
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      try {
        CFPaymentGatewayService.removeCallback();
      } catch {
        // Older SDK builds don't expose removeCallback; the settled guard
        // already stops a stale fire from resolving this promise twice.
      }
      fn(value);
    };

    try {
      CFPaymentGatewayService.setCallback({
        onVerify: (verifiedOrderId) => finish(resolve, { orderId: verifiedOrderId ?? orderId }),
        onError: (error) => {
          const { code, message, cancelled } = readError(error);
          finish(reject, new CashfreePaymentError(message, { code, cancelled }));
        },
      });

      const cfEnv = environment === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
      CFPaymentGatewayService.doWebPayment(new CFSession(paymentSessionId, orderId, cfEnv));
    } catch (e) {
      finish(reject, new CashfreePaymentError(e?.message || 'Could not open Cashfree checkout'));
    }
  });
