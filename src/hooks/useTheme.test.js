import { describe, it, expect } from 'vitest';
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
