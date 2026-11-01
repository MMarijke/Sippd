/// <reference lib="webworker" />
// Sippd's service worker (Serwist), built by @serwist/vite into dist/sw.js.
// See OFFLINE.md for the whole offline design; this file is only the app
// shell and runtime caches. Data never goes through here: Supabase REST,
// auth and RPC calls are left to the network (the local-first data layer
// in src/lib/offline handles offline reads and writes).
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

// In the Capacitor app the worker runs as /sw.js?mode=images: the shell
// already ships inside the APK, so it precaches nothing and takes over no
// navigation (an old precache could otherwise outlive an app update), and
// only keeps can photos available offline.
const imagesOnly = new URL(self.location.href).searchParams.get('mode') === 'images';

const isSupabaseImage = ({ url, request }) =>
  request.destination === 'image' &&
  url.hostname.endsWith('.supabase.co') &&
  url.pathname.startsWith('/storage/v1/object/public/');

const serwist = new Serwist({
  // The whole build (every lazy route chunk included), injected at build time.
  precacheEntries: imagesOnly ? [] : self.__SW_MANIFEST,
  precacheOptions: imagesOnly ? undefined : {
    cleanupOutdatedCaches: true,
    // A single-page app: every navigation is served the precached shell, and
    // React Router takes it from there, online or off.
    navigateFallback: '/index.html',
    // Vercel functions (OG images) and real files must not get the shell.
    navigateFallbackDenylist: [/^\/api\//, /\/[^/?]+\.[^/?]+$/],
  },
  // A new version waits until the user taps "Reload" (serviceWorker.js), so
  // an open session never mixes old and new route chunks. Images-only has
  // no chunks to mix, so it takes over straight away.
  skipWaiting: imagesOnly,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Can photos, so a collection is browsable offline. Fetched in CORS
      // mode (Supabase public storage allows it): an <img> would otherwise
      // cache an opaque response, which Chrome pads to ~7 MB of quota each.
      matcher: isSupabaseImage,
      handler: new CacheFirst({
        cacheName: 'can-images',
        fetchOptions: { mode: 'cors', credentials: 'omit' },
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          // Least-recently-used eviction past 200 photos; dropped first if
          // the device runs short of storage.
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 24 * 60 * 60, purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      // Theme font stylesheets (each family loads its own faces).
      matcher: ({ url }) => url.hostname === 'fonts.googleapis.com',
      handler: new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
    },
    {
      // The font files themselves never change at a given URL.
      matcher: ({ url }) => url.hostname === 'fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'google-fonts',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 365 * 24 * 60 * 60, purgeOnQuotaError: true }),
        ],
      }),
    },
  ],
  // If even the shell can't be served (a navigation before the first full
  // install finished), show a plain offline page instead of the browser's.
  fallbacks: imagesOnly ? undefined : {
    entries: [{ url: '/offline.html', matcher: ({ request }) => request.destination === 'document' }],
  },
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

serwist.addEventListeners();
