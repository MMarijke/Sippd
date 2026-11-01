// Pro status survives being offline: the last status the server confirmed
// is kept per user for 7 days, refreshed whenever online. After 7 days
// without a check it falls back to free (the server stays the authority:
// every Pro-gated write is enforced there, so a stale "pro" can't unlock
// anything server-side). Checkout is untouched.

export const PRO_CACHE_DAYS = 7;
const key = (userId) => `sippd-subscription-${userId}`;

export function readProCache(userId, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(key(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeProCache(userId, data, now = Date.now(), storage = globalThis.localStorage) {
  try {
    storage?.setItem(key(userId), JSON.stringify({ ...data, checkedAt: now }));
  } catch {
    // Private mode or a full disk: the live query still works.
  }
}

export function clearProCache(userId, storage = globalThis.localStorage) {
  try { storage?.removeItem(key(userId)); } catch { /* nothing to clear */ }
}

// The cached subscription row if it's still fresh, else null.
export function freshProCache(cached, now = Date.now()) {
  if (!cached?.checkedAt) return null;
  return now - cached.checkedAt < PRO_CACHE_DAYS * 24 * 60 * 60 * 1000 ? cached : null;
}
