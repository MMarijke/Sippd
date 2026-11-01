import { describe, expect, it } from 'vitest';
import { isNetworkAuthError, readStoredSession } from './session';
import { PRO_CACHE_DAYS, freshProCache, readProCache, writeProCache } from './proCache';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('offline session fallback', () => {
  it('treats a failed refresh while offline as a network problem, not a sign-out', () => {
    expect(isNetworkAuthError({ name: 'AuthApiError', message: 'whatever' }, false)).toBe(true);
    expect(isNetworkAuthError({ name: 'AuthRetryableFetchError', message: 'x' }, true)).toBe(true);
    expect(isNetworkAuthError({ name: 'TypeError', message: 'Failed to fetch' }, true)).toBe(true);
  });

  it('lets a real auth failure online stand (a revoked refresh token signs out)', () => {
    expect(isNetworkAuthError({ name: 'AuthApiError', message: 'Invalid Refresh Token' }, true)).toBe(false);
    expect(isNetworkAuthError(null, false)).toBe(false);
  });

  it('reads the stored session only when it is a real one with a user', () => {
    const storage = memoryStorage();
    storage.setItem('sb-key', JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u1' } }));
    expect(readStoredSession(storage, 'sb-key').user.id).toBe('u1');
    storage.setItem('sb-key', JSON.stringify({ access_token: 'a' }));
    expect(readStoredSession(storage, 'sb-key')).toBeNull();
    storage.setItem('sb-key', '{not json');
    expect(readStoredSession(storage, 'sb-key')).toBeNull();
    expect(readStoredSession(storage, 'missing')).toBeNull();
  });
});

describe('Pro status cache', () => {
  const day = 24 * 60 * 60 * 1000;

  it(`keeps the last confirmed status for ${PRO_CACHE_DAYS} days, then expires it`, () => {
    const storage = memoryStorage();
    const now = 1_000_000_000_000;
    writeProCache('u1', { subscription_status: 'pro' }, now, storage);
    const cached = readProCache('u1', storage);
    expect(freshProCache(cached, now + 6 * day)?.subscription_status).toBe('pro');
    expect(freshProCache(cached, now + (PRO_CACHE_DAYS + 1) * day)).toBeNull();
  });

  it('is per user', () => {
    const storage = memoryStorage();
    writeProCache('u1', { subscription_status: 'pro' }, 1, storage);
    expect(readProCache('u2', storage)).toBeNull();
  });
});
