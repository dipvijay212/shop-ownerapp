import { Linking } from 'react-native';

// WhatsApp resolves a number in full international form. Handed a bare
// "8320905130" it reports that the number does not exist — the number is fine,
// the country is missing.
const DEFAULT_COUNTRY_CODE = '91';

/**
 * A phone number as WhatsApp expects it: digits only, country code included,
 * no leading '+'.
 *
 *   8320905130      → 918320905130
 *   +91 83209 05130 → 918320905130
 *   0832 090 5130   → 918320905130
 */
export const toWhatsAppNumber = (raw, countryCode = DEFAULT_COUNTRY_CODE) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  // A local number written with a trunk '0' — drop it before adding the country.
  const local = digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length === 10) return `${countryCode}${local}`;
  return local;
};

/**
 * Open a WhatsApp chat with a number, or say why it cannot be opened.
 *
 * Six screens each built this URL themselves. One of them formatting the
 * number differently is invisible until WhatsApp reports "missing a country
 * code" against a number the shop can see is correct — so the formatting now
 * happens once, here.
 *
 * `https://wa.me/<intl>` is WhatsApp's documented link and is what resolves
 * the country code; the `whatsapp://` scheme is the fallback for setups where
 * the https handler is not registered.
 */
export const openWhatsApp = async (rawPhone, message, onUnusable) => {
  const target = toWhatsAppNumber(rawPhone);
  // A country code plus an Indian local number is 12 digits; anything shorter
  // is not something WhatsApp can look up, and sending it produces a confusing
  // error inside WhatsApp rather than in the app that caused it.
  if (target.length < 11) {
    onUnusable?.(rawPhone);
    return false;
  }
  const text = encodeURIComponent(message ?? '');
  try {
    await Linking.openURL(`https://wa.me/${target}?text=${text}`);
    return true;
  } catch {
    try {
      await Linking.openURL(`whatsapp://send?phone=${target}&text=${text}`);
      return true;
    } catch {
      onUnusable?.(rawPhone);
      return false;
    }
  }
};

export default toWhatsAppNumber;
