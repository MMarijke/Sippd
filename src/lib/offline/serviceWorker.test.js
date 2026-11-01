import { describe, expect, it } from 'vitest';
import { serviceWorkerUrl, shouldRegisterServiceWorker } from './serviceWorker';

describe('shouldRegisterServiceWorker', () => {
  it('registers on production builds', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, hasServiceWorker: true })).toBe(true);
  });

  it('never registers in development (stale modules under Vite)', () => {
    expect(shouldRegisterServiceWorker({ isProd: false, hasServiceWorker: true })).toBe(false);
  });

  it('does nothing where service workers are unsupported', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, hasServiceWorker: false })).toBe(false);
  });

  it('runs images-only in the Capacitor app (the shell ships in the APK)', () => {
    expect(serviceWorkerUrl({ isNative: true })).toBe('/sw.js?mode=images');
    expect(serviceWorkerUrl({ isNative: false })).toBe('/sw.js');
  });
});
