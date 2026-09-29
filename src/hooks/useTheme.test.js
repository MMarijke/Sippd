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

import { getThemeChangeErrorMessage, getRenderedTone, getThemeFamily, THEMES, FAMILY_FONT_URLS, THEME_FAMILIES } from './useTheme';

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

// [data-tone] drives the medal/overlap tokens' light-vs-dark values, so
// it has to report what actually renders, not the stored preference.
describe('getRenderedTone', () => {
  const byId = id => THEMES.find(t => t.id === id);

  it('follows the stored polarity for a theme with both renderings', () => {
    expect(getRenderedTone(byId('power-up'), 'dark')).toBe('dark');
    expect(getRenderedTone(byId('power-up'), 'light')).toBe('light');
  });

  it('ignores the stored polarity for a fixed-light Phase 2 theme', () => {
    expect(getRenderedTone(byId('sage'), 'dark')).toBe('light');
  });

  it('ignores the stored polarity for a fixed-dark Phase 2 theme', () => {
    expect(getRenderedTone(byId('forest'), 'light')).toBe('dark');
  });

  it('falls back to dark for an unknown theme, matching :root', () => {
    expect(getRenderedTone(undefined, 'light')).toBe('dark');
  });
});

describe('getThemeFamily / FAMILY_FONT_URLS', () => {
  it('finds the family a theme belongs to', () => {
    expect(getThemeFamily('sage')?.id).toBe('botanical');
    expect(getThemeFamily('nope')).toBeNull();
  });

  it('has an on-demand font URL for every family except the :root default', () => {
    for (const family of THEME_FAMILIES) {
      if (family.id === 'neon-arcade') expect(FAMILY_FONT_URLS[family.id]).toBeUndefined();
      else expect(FAMILY_FONT_URLS[family.id]).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
    }
  });
});

// The picker sets each family's tile label in `displayFont`; it must stay
// the same face index.css applies as that family's --font-display, or the
// preview lies about the theme.
describe('THEME_FAMILIES displayFont', () => {
  it('matches each family\'s --font-display in index.css', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    for (const family of THEME_FAMILIES) {
      const sample = family.themes[0].id;
      // Neon Arcade inherits its trio from :root; every other family sets it
      // on a selector group that names its themes.
      const block = family.id === 'neon-arcade'
        ? css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
        : (() => {
          const at = css.indexOf(`[data-theme="${sample}"],`);
          return css.slice(at, css.indexOf('}', at));
        })();
      const face = block.match(/--font-display:\s*([^;]+);/)?.[1].trim();
      expect(face, family.id).toBe(family.displayFont);
    }
  });
});
