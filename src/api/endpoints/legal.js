// Privacy Policy and Terms & Conditions.
//
// The text is not in the app. The website (prestiousit-official) builds its
// /paasora/partner/privacy-policy and /paasora/partner/terms-and-conditions pages and this JSON
// from the same data, so editing the site changes what the app shows — no app
// release. The last good copy is kept on the device for offline use.
//
// This is the website, not the backend: plain fetch, no auth header, and the
// body is the document itself rather than an { data } envelope.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_TIMEOUT_MS, LEGAL_API_URL } from '../config';

// Must match SCHEMA_VERSION in the site's buildLegalDoc.js. A newer version is
// a breaking change this build cannot render, so it is treated like a failed
// fetch and the saved copy is shown instead.
const SCHEMA_VERSION = 1;

const storageKey = (kind) => `legal:partner:${kind}`;

const isRenderable = (doc) =>
  Boolean(doc) &&
  doc.schemaVersion === SCHEMA_VERSION &&
  Array.isArray(doc.intro) &&
  Array.isArray(doc.sections);

export const readSavedLegalDoc = async (kind) => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(kind));
    const doc = raw ? JSON.parse(raw) : null;
    return isRenderable(doc) ? doc : null;
  } catch {
    return null;
  }
};

const fetchLegalDoc = async (kind) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    // cache: 'no-cache' makes RN's fetch add a cache-busting param, so the
    // iOS URL cache can never hand back a copy older than the site's.
    const res = await fetch(`${LEGAL_API_URL}?app=partner&doc=${kind}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Legal document request failed (${res.status})`);
    const doc = await res.json();
    if (!isRenderable(doc)) throw new Error('Legal document has an unsupported shape');
    return doc;
  } finally {
    clearTimeout(timer);
  }
};

// kind: 'privacy' | 'terms'
// → { doc, offline } — offline is true when the network failed and the saved
//   copy is being returned. Throws only when there is neither.
export const getLegalDoc = async (kind) => {
  try {
    const doc = await fetchLegalDoc(kind);
    AsyncStorage.setItem(storageKey(kind), JSON.stringify(doc)).catch(() => {});
    return { doc, offline: false };
  } catch (err) {
    const saved = await readSavedLegalDoc(kind);
    if (saved) return { doc: saved, offline: true };
    throw err;
  }
};
