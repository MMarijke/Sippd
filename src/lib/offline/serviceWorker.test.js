import { describe, expect, it } from 'vitest';
import { shouldRegisterServiceWorker } from './serviceWorker';

describe('shouldRegisterServiceWorker', () => {
  it('registers on the production web build', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, isNative: false, hasServiceWorker: true })).toBe(true);
  });

  it('never registers in development (stale modules under Vite)', () => {
    expect(shouldRegisterServiceWorker({ isProd: false, isNative: false, hasServiceWorker: true })).toBe(false);
  });

  it('never registers in the Capacitor app (the shell ships in the APK)', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, isNative: true, hasServiceWorker: true })).toBe(false);
  });

  it('does nothing where service workers are unsupported', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, isNative: false, hasServiceWorker: false })).toBe(false);
  });
});
