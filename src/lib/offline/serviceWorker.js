import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// Registers the Serwist service worker (src/sw.js -> /sw.js) on the web
// build only. Not in development (it would cache stale modules under Vite's
// dev server) and not in the Capacitor Android app: there the shell already
// ships inside the APK, and a service worker could keep serving an old
// precache after the app itself updated. See OFFLINE.md.
export function shouldRegisterServiceWorker({ isProd, isNative, hasServiceWorker }) {
  return Boolean(isProd && !isNative && hasServiceWorker);
}

// A new version installs in the background and waits (sw.js has
// skipWaiting: false), so an open session never loads a mix of old and new
// route chunks. The user decides when to switch.
function offerUpdate(worker) {
  toast('A new version of Sippd is ready', {
    duration: Infinity,
    action: { label: 'Reload', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
  });
}

export function registerServiceWorker() {
  const ok = shouldRegisterServiceWorker({
    isProd: import.meta.env.PROD,
    isNative: Capacitor.isNativePlatform(),
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  });
  if (!ok) return;

  // Reload once the waiting worker takes over, but only after the user
  // asked for it (the first install claims the page without a reload).
  let reloading = false;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(installing);
        });
      });
    } catch (error) {
      // Offline support is an enhancement: the app works without it.
      console.warn('Service worker registration failed:', error);
    }
  });
}
