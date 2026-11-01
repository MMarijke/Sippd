import { describe, expect, it } from 'vitest';
import { MAX_EDGE, fitWithin } from './images';
import { isQuotaError, requestPersistentStorage } from './storage';

describe('fitWithin', () => {
  it('scales a phone photo down to the max edge, keeping its shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: MAX_EDGE, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: MAX_EDGE });
  });

  it('never scales a small image up', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('storage', () => {
  it('recognises quota errors, including Dexie-wrapped ones', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true);
    expect(isQuotaError({ message: 'Quota exceeded' })).toBe(true);
    expect(isQuotaError({ name: 'ConstraintError' })).toBe(false);
  });

  it('asks for persistent storage once and copes without the API', async () => {
    let asked = 0;
    expect(await requestPersistentStorage({ persisted: async () => false, persist: async () => { asked += 1; return true; } })).toBe(true);
    expect(asked).toBe(1);
    expect(await requestPersistentStorage({ persisted: async () => true, persist: async () => { asked += 1; return true; } })).toBe(true);
    expect(asked).toBe(1);
    expect(await requestPersistentStorage(undefined)).toBe(false);
  });
});
