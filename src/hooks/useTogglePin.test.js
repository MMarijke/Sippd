import { describe, it, expect, vi } from 'vitest';

// useTogglePin.js imports the real supabase client at module scope for
// useTogglePin() itself (untested here, needs a real mutation call) — that
// import executes on ANY import from this file, including just this one
// pure function, and supabaseClient.js throws if VITE_SUPABASE_URL/ANON_KEY
// aren't set. This project's CI never sets them for the plain `vitest run`
// step — mocking the module here makes this test depend on nothing but the
// function it actually exercises.
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { getMaxPins, MAX_PINS_FREE, MAX_PINS_PRO } from './useTogglePin';

// The client-side half of Trophy Case's pin cap — CollectionCard.jsx uses
// this same function to disable the pin button at the cap; the real
// enforcement is useTogglePin's mutationFn re-checking pinnedCount server-
// side (a client-only check here would just be a UI nicety, not security),
// but a wrong number here would still visibly mis-render the cap for every
// free or Pro user, so it's worth pinning down on its own.
describe('getMaxPins', () => {
  it('returns the Pro cap for a Pro collector', () => {
    expect(getMaxPins(true)).toBe(MAX_PINS_PRO);
  });

  it('returns the free cap for a non-Pro collector', () => {
    expect(getMaxPins(false)).toBe(MAX_PINS_FREE);
  });

  it('treats a missing/undefined isPro as non-Pro', () => {
    expect(getMaxPins(undefined)).toBe(MAX_PINS_FREE);
  });

  it('the Pro cap is strictly larger than the free cap', () => {
    // Guards against a future edit accidentally making Pro a downgrade.
    expect(MAX_PINS_PRO).toBeGreaterThan(MAX_PINS_FREE);
  });
});
