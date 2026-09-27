import { describe, it, expect, vi } from 'vitest';

// useTheme.js imports the real supabase client at module scope for
// useTheme() itself (untested here) — that import executes on ANY import
// from this file, including just this one pure function, and
// supabaseClient.js throws if VITE_SUPABASE_URL/ANON_KEY aren't set. This
// project's CI never sets them for the plain `vitest run` step (only the
// e2e job's build does, and only because a real value has to exist, not
// because vitest needs one) — mocking the module here makes this test
// depend on nothing but the function it actually exercises. Vitest hoists
// vi.mock() above the imports below at transform time, so ordering in
// source doesn't matter, but it's written first to match how it executes.
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { getThemeChangeErrorMessage } from './useTheme';

// Only the pure branch of setTheme's onError handler — the optimistic
// cache update/rollback around it lives inside react-query's own hook
// lifecycle and needs @testing-library/react + jsdom to exercise properly,
// which this project's vite.config.js deliberately doesn't depend on.
describe('getThemeChangeErrorMessage', () => {
  it('shows the upgrade-to-unlock message for the server\'s Pro-lock rejection', () => {
    // Must keep matching profiles_lock_columns()'s exact RAISE EXCEPTION
    // text (20260909000000_add_profile_theme.sql) — this is a substring
    // match against the real error the server actually throws.
    const error = new Error('theme is Pro-only — upgrade to unlock');
    expect(getThemeChangeErrorMessage(error)).toBe('That theme is a Pro perk — upgrade to unlock it.');
  });

  it('shows a generic failure message for any other error', () => {
    const error = new Error('network request failed');
    expect(getThemeChangeErrorMessage(error)).toBe('Failed to change theme');
  });

  it('does not crash on an error with no message', () => {
    expect(getThemeChangeErrorMessage(new Error())).toBe('Failed to change theme');
  });

  it('does not crash on a null/undefined error', () => {
    expect(getThemeChangeErrorMessage(null)).toBe('Failed to change theme');
    expect(getThemeChangeErrorMessage(undefined)).toBe('Failed to change theme');
  });
});
