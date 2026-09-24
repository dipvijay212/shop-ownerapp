// Backend configuration (Owner app).
//
// Live spec & playground: https://localmart-backend.prestious.com/docs

// ── Pick a backend ──────────────────────────────────────────────────────────
// Change this one line. Everything else is derived.
//
//   'production' → the deployed API
//   'tunnel'     → local server exposed through a VS Code dev tunnel
//   'emulator'   → local server, Android emulator
//   'lan'        → local server, physical device / iOS simulator on same Wi-Fi
//   'usb'        → local server, Android device over `adb reverse`
//
// Used by DEBUG builds — change freely while developing.
const DEV_BACKEND = 'tunnel';

// Used by RELEASE builds.
const RELEASE_BACKEND = 'tunnel';

const BACKEND = __DEV__ ? DEV_BACKEND : RELEASE_BACKEND;

// The port the Nest server listens on (`npm run start:dev`).
const LOCAL_PORT = 4001;

// This machine's Wi-Fi address. `ipconfig getifaddr en0` prints it; it changes 
// when you switch networks or the DHCP lease rotates.
const LAN_IP = '192.168.1.9';

// Dev tunnels get a fresh hostname every time the tunnel is recreated.
const TUNNEL_ORIGIN = 'https://mjcp6mtf-4001.inc1.devtunnels.ms';

// An Android emulator is its own machine: `localhost` there is the emulator,
// and 10.0.2.2 is the alias for the host loopback. The iOS simulator shares the
// host's network stack, so localhost is genuinely correct there. A physical
// device can reach neither and needs the LAN address — or `adb reverse
// tcp:4001 tcp:4001`, which forwards the device's localhost over USB.
const ORIGINS = {
  production: 'https://localmart-backend.prestious.com',
  tunnel: TUNNEL_ORIGIN,
  emulator: `http://10.0.2.2:${LOCAL_PORT}`,
  lan: `http://${LAN_IP}:${LOCAL_PORT}`,
  usb: `http://localhost:${LOCAL_PORT}`,
};

// No trailing slash — `checkHealth()` appends `/health`, and a trailing slash
// here produces `//health`, which the server 404s.
export const API_ROOT_URL = ORIGINS[BACKEND];

export const API_BASE_URL = `${API_ROOT_URL}/v1`;

export const API_TIMEOUT_MS = 20000;

export const AUDIENCE = 'owner';

export const PUBLIC_PATHS = [
  '/auth/owner/otp/request',
  '/auth/owner/otp/verify',
  '/auth/token/refresh',
  '/faqs',
  '/support/contact',
  '/app-config',
];

export const isPublicPath = (url = '') => {
  const path = url.split('?')[0];
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
};

export const DEFAULT_PAGE_LIMIT = 20;
