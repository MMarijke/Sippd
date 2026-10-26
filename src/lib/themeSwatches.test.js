import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';
import { deltaEOk, hslToRgb, parseHsl } from './rampColour';

// The theme picker previews each theme with hand-copied hex values in
// useTheme.js (THEME_FAMILIES: <polarity>: { swatch, sup, background }).
// Their background must be the background the theme actually renders, or
// the picker shows a different theme than you get. (2026-10-26: a scripted
// re-tune wrote Synthwave light's colours onto Sage's swatch.)

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
