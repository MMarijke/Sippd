import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// Registers the Serwist service worker (src/sw.js) on production builds.
// Not in development (it would cache stale modules under Vite's dev server).
// In the Capacitor Android app it registers in images-only mode
// (/sw.js?mode=images): the shell already ships inside the APK, and a full
// precache could keep serving an old shell after the app itself updated, so
// there it only keeps can photos available offline. See OFFLINE.md.
export function shouldRegisterServiceWorker({ isProd, hasServiceWorker }) {
  return Boolean(isProd && hasServiceWorker);
}

export function serviceWorkerUrl({ isNative }) {
  return isNative ? '/sw.js?mode=images' : '/sw.js';
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
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  });
  if (!ok) return;
  const isNative = Capacitor.isNativePlatform();

  // Web only: reload once the waiting worker takes over, but only after the
  // user asked for it (the first install claims the page without a reload).
  // The images-only worker in the app takes over by itself, and must never
  // reload the app out from under the user.
  if (!isNative) {
    let reloading = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl({ isNative }), { scope: '/' });
      // The app updates through its store; only the web shell offers Reload.
      if (isNative) return;
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
