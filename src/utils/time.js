// Times travel as 24-hour "HH:mm" — that is what the API stores and what the
// pickers hand back. On screen they are read by people, and "06:00" beside
// "08:00" gives no way to tell a milk round from an evening one.

/**
 * "06:00" → "6:00 AM", "18:30" → "6:30 PM".
 *
 * Accepts "HH:mm" and "HH:mm:ss" (the API returns the seconds form), and hands
 * back anything it cannot parse untouched rather than showing a blank.
 */
export const to12h = (value) => {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value ?? '').trim());
  if (!m) return value ?? '';
  const hour = Number(m[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m[2]} ${suffix}`;
};

/** "06:00"–"08:00" → "6:00 AM – 8:00 AM". */
export const formatWindow = (from, to) => {
  if (!from || !to) return '';
  return `${to12h(from)} – ${to12h(to)}`;
};

export default to12h;
