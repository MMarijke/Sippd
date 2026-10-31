import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';
import { deltaEOk, hslToRgb, parseHsl } from './rampColour';

// THEME_FAMILIES (useTheme.js) carries each theme's --background as a
// hand-copied hex for the theme cache, which paints it before the
// stylesheet loads: it must be the background the theme actually renders.
// (2026-10-26: a scripted re-tune wrote Synthwave light's colours onto
// Sage's entry.) The picker's swatch colours are read live from the
// theme's tokens instead (Settings.jsx), so none may be hand-copied here.

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const source = read('../hooks/useTheme.js');
const rules = cssRules(read('../index.css'));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// The swatch entry for one theme + polarity, read only within that theme's
// own `{ id: '...' ... }` entry.
function swatchFor(id, polarity) {
  const start = source.indexOf(`{ id: '${id}'`);
  const next = source.indexOf('{ id: ', start + 1);
  const entry = source.slice(start, next < 0 ? undefined : next);
  return entry.match(new RegExp(`${polarity}: \\{[^}]*background: '(#[0-9A-Fa-f]{6})'`))?.[1];
}

const cases = themeRenderings(source).map((r) => ({
  name: `${r.id} (${r.polarity})`,
  swatchBackground: swatchFor(r.id, r.polarity),
  cssBackground: hslToRgb(parseHsl(resolveTokens(rules, r)('--background'))),
}));

describe('theme picker swatches match the CSS', () => {
  it.each(cases.map((c) => [c.name, c]))('%s: swatch background is the rendered background', (_, c) => {
    expect(c.swatchBackground, 'swatch entry has a background').toBeTruthy();
    // Hex <-> HSL-triple rounding stays well under 1; a wrong theme is 10+.
    expect(deltaEOk(hex(c.swatchBackground), c.cssBackground)).toBeLessThan(2);
  });
});

describe('theme picker reads live colours', () => {
  it('stores no hand-copied swatch colours', () => {
    // Hand-copied swatch/sup hexes drifted on ~12 themes before 2026-10-28.
    expect(source).not.toMatch(/\b(swatch|sup):\s*'#/);
  });

  it("each family's preview tile names one of its own themes", () => {
    const families = source.slice(source.indexOf('export const THEME_FAMILIES'), source.indexOf('export const THEMES'))
      .split(/\r?\n  \{\r?\n/).slice(1);
    expect(families.length).toBeGreaterThanOrEqual(8);
    for (const family of families) {
      const preview = family.match(/preview: '([a-z0-9-]+)'/)?.[1];
      if (preview) expect(family, preview).toContain(`{ id: '${preview}'`);
    }
  });
});
