import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';
import { themeColours, themeDistance, themeDistanceBreakdown } from './themeDistance';

// No two themes may look alike: every pair of renderings (a theme's own
// dark/light pair excepted) must sit at least MIN_THEME_DISTANCE apart,
// measured by themeDistance (weighted mean deltaE-OK over background,
// button fill, card, accent and the rarity gauge).
//
// Agreed 2026-10-26 after re-tuning the lookalikes the theme critique found
// (closest pair was 3.2: Forest/Emerald and Meadow/Sour Apple; now 5.9).
// The measure weights the page background heavily and every theme's page is
// a near-black or near-white, so even clearly different themes score in the
// single digits; 5.5 locks today's floor in so lookalikes can't creep back.
// To find what's close: node scripts/theme-distances.mjs
export const MIN_THEME_DISTANCE = 5.5;

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const rules = cssRules(read('../index.css'));
const renderings = themeRenderings(read('../hooks/useTheme.js')).map((r) => ({
  name: `${r.id} (${r.polarity})`,
  id: r.id,
  colours: themeColours(resolveTokens(rules, r)),
}));

const pairs = [];
for (let i = 0; i < renderings.length; i++) {
  for (let j = i + 1; j < renderings.length; j++) {
    const [a, b] = [renderings[i], renderings[j]];
    if (a.id !== b.id) pairs.push([a, b]);
  }
}

describe('theme catalogue: no lookalikes', () => {
  it('measures every pair of the 38 renderings', () => {
    expect(renderings).toHaveLength(38);
    expect(pairs.length).toBeGreaterThan(600);
  });

  it.each(pairs.map(([a, b]) => [`${a.name} vs ${b.name}`, a, b]))('%s', (_, a, b) => {
    const d = themeDistance(a.colours, b.colours);
    const why = Object.entries(themeDistanceBreakdown(a.colours, b.colours))
      .map(([token, dE]) => `${token} ${dE.toFixed(1)}`).join(', ');
    expect(d, `too alike (per-token deltaE-OK: ${why})`).toBeGreaterThanOrEqual(MIN_THEME_DISTANCE);
  });
});
