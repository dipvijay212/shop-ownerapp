// Whether the shop is open RIGHT NOW according to its weekly schedule.
//
// This mirrors the server's visibility rule exactly (the `within_hours` leg of
// VISIBLE in the backend's shops/visibility.ts):
//
//   * no shop_hours rows at all  -> always open (hours are optional config)
//   * a row for today with is_open, and now inside [opens, closes)
//   * a window where closes <= opens spans midnight, so it matches
//     now >= opens OR now < closes
//
// It matters because `is_online` and the schedule are DIFFERENT things. The
// owner's toggle is a manual override; the schedule closes the shop on its own.
// The dashboard used to report `is_online` alone, so switching Friday off in
// Store Hours left the banner claiming "Store is LIVE & accepting orders" on a
// day customers could not see the shop at all.

/**
 * Minutes since midnight; null if unparseable.
 *
 * Accepts "HH:mm" AND "HH:mm:ss" — the API returns the seconds form
 * ("09:00:00"), which this used to reject. Every window then parsed as null,
 * took the fail-open branch below, and the dashboard reported a shop as LIVE
 * hours after it had closed.
 */
const toMinutes = (value) => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

/**
 * @returns {{ withinHours: boolean, reason: 'no_schedule'|'open'|'day_off'|'outside_window' }}
 */
export const scheduleStateNow = (hours, now = new Date()) => {
  if (!Array.isArray(hours) || hours.length === 0) {
    return { withinHours: true, reason: 'no_schedule' };
  }

  // A day can have SEVERAL windows — a 7–11am milk round and a 4–9pm evening,
  // say — so every row for today counts, not just the first one found.
  const todaysWindows = hours.filter((h) => Number(h?.weekday) === now.getDay());
  const openWindows = todaysWindows.filter((h) => h?.is_open !== false);
  if (openWindows.length === 0) {
    return { withinHours: false, reason: 'day_off' };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  let readableWindows = 0;

  for (const w of openWindows) {
    const opens = toMinutes(w.opens ?? w.opens_at);
    const closes = toMinutes(w.closes ?? w.closes_at);
    if (opens === null || closes === null) continue;
    readableWindows += 1;
    // A window whose close is at or before its open spans midnight.
    const within = opens < closes
      ? minutes >= opens && minutes < closes
      : minutes >= opens || minutes < closes;
    if (within) return { withinHours: true, reason: 'open' };
  }

  if (readableWindows === 0) {
    // Nothing we could read at all — the server is the authority, and it would
    // treat an unreadable schedule as configured-and-open.
    return { withinHours: true, reason: 'open' };
  }

  return { withinHours: false, reason: 'outside_window' };
};

/** What customers actually see: the manual toggle AND the schedule. */
export const isShopLive = (shop, now = new Date()) =>
  !!shop?.is_online && scheduleStateNow(shop?.hours, now).withinHours;
