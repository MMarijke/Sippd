// Last theme this device rendered, so a refresh paints it straight away
// instead of flashing (or getting stuck on) the Power-Up default while the
// profile query is in flight or has failed. The profile row stays the
// source of truth; this is only what to show until it answers.
//
// index.html reads the same key in a tiny inline script before the app
// loads, so keep the key and shape in sync with it.
export const THEME_CACHE_KEY = 'sippd-theme';

// { userId, theme, polarity, tone, background } or null. Storage can throw
// (private mode, blocked site data), and the value can be stale or garbage.
export function readThemeCache(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(THEME_CACHE_KEY) ?? 'null');
    if (!parsed || typeof parsed.theme !== 'string' || typeof parsed.polarity !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeThemeCache(entry, storage = globalThis.localStorage) {
  try {
    storage?.setItem(THEME_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Not being able to cache only costs the flash on next load.
  }
}

// The cached theme applies to this user, or to a not-yet-known user (auth
// still resolving). Another account's theme never applies.
export function cachedThemeFor(cache, userId) {
  if (!cache) return null;
  if (userId && cache.userId && cache.userId !== userId) return null;
  return cache;
}
