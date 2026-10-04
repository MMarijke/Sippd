import { describe, expect, it } from 'vitest';
import { acquiredAt, byAcquiredDesc } from './canDate';

describe('acquiredAt', () => {
  it('prefers the date the collector gave', () => {
    expect(acquiredAt({ acquired_on: '2024-03-05', created_at: '2026-10-01T09:00:00Z' }).getFullYear()).toBe(2024);
  });

  it('falls back to when it was logged', () => {
    expect(acquiredAt({ created_at: '2026-10-01T09:00:00Z' }).toISOString()).toBe('2026-10-01T09:00:00.000Z');
  });

  it('reads a date-only value as that calendar day in any timezone', () => {
    // Midday, so a UTC offset can't push it into the neighbouring day.
    expect(acquiredAt({ acquired_on: '2024-03-05' }).getDate()).toBe(5);
  });

  it('is null with no dates', () => {
    expect(acquiredAt({})).toBeNull();
    expect(acquiredAt(null)).toBeNull();
  });
});

describe('byAcquiredDesc', () => {
  it('orders newest first, using the given date over the log date, undated last', () => {
    const items = [
      { id: 'logged-today-bought-2020', acquired_on: '2020-01-01', created_at: '2026-10-04T10:00:00Z' },
      { id: 'logged-yesterday', created_at: '2026-10-03T10:00:00Z' },
      { id: 'undated' },
      { id: 'bought-2025', acquired_on: '2025-06-01', created_at: '2026-10-04T11:00:00Z' },
    ];
    expect([...items].sort(byAcquiredDesc).map(i => i.id)).toEqual([
      'logged-yesterday', 'bought-2025', 'logged-today-bought-2020', 'undated',
    ]);
  });
});
