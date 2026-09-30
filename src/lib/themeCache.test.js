import { describe, expect, it } from 'vitest';
import { readThemeCache, writeThemeCache, cachedThemeFor, THEME_CACHE_KEY } from './themeCache';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

const entry = { userId: 'u1', theme: 'synthwave', polarity: 'dark', tone: 'dark', background: '#120B1F' };

describe('theme cache', () => {
  it('round-trips an entry', () => {
    const s = memoryStorage();
    writeThemeCache(entry, s);
    expect(readThemeCache(s)).toEqual(entry);
  });

  it('returns null for missing, garbage or incomplete values', () => {
    expect(readThemeCache(memoryStorage())).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: '{not json' }))).toBeNull();
    expect(readThemeCache(memoryStorage({ [THEME_CACHE_KEY]: '{"theme":"synthwave"}' }))).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readThemeCache(broken)).toBeNull();
    expect(() => writeThemeCache(entry, broken)).not.toThrow();
  });

  it("never applies another account's theme", () => {
    expect(cachedThemeFor(entry, 'u1')).toBe(entry);
    expect(cachedThemeFor(entry, undefined)).toBe(entry);
    expect(cachedThemeFor(entry, 'u2')).toBeNull();
    expect(cachedThemeFor(null, 'u1')).toBeNull();
  });
});
