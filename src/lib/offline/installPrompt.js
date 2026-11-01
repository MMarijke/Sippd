// Which "install Sippd" affordance a device gets. Pure, so it's testable:
// the component (components/pwa/InstallPrompt.jsx) feeds it the browser's
// real values.
//
// - 'native': Chrome/Edge/Samsung Internet fired beforeinstallprompt, so an
//   Install button can open the browser's own install dialog.
// - 'ios': iOS Safari has no install API; the only path is Share -> Add to
//   Home Screen, so we explain that instead.
// - null: already installed (standalone), inside the Capacitor app,
//   dismissed recently, or a browser that can't install at all.

export const DISMISS_KEY = 'sippd-install-dismissed-at';
export const DISMISS_DAYS = 30;

export function isIosSafari(userAgent, maxTouchPoints = 0) {
  const ua = userAgent || '';
  // iPadOS 13+ reports a Mac user agent; touch points give it away.
  const iDevice = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  // Chrome/Firefox/Edge on iOS (CriOS/FxiOS/EdgiOS) can't add to home screen
  // the same way, so only real Safari gets the hint.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iDevice && safari;
}

export function dismissedRecently(dismissedAt, now = Date.now()) {
  const at = Number(dismissedAt);
  return Number.isFinite(at) && at > 0 && now - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function installPromptKind({ isStandalone, isNative, hasDeferredPrompt, userAgent, maxTouchPoints, dismissedAt, now }) {
  if (isStandalone || isNative || dismissedRecently(dismissedAt, now)) return null;
  if (hasDeferredPrompt) return 'native';
  if (isIosSafari(userAgent, maxTouchPoints)) return 'ios';
  return null;
}
