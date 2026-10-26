// Lists the closest theme-rendering pairs (src/lib/themeDistance.js) with
// the per-token causes, so lookalikes can be found and re-tuned.
//   node scripts/theme-distances.mjs [maxDistance=12]
import { readFileSync } from 'node:fs';
import { themeRenderings, cssRules, resolveTokens } from '../src/lib/themeTokens.js';
import { themeColours, themeDistance, themeDistanceBreakdown } from '../src/lib/themeDistance.js';

const max = Number(process.argv[2] ?? 12);
const rules = cssRules(readFileSync('src/index.css', 'utf8'));
const renderings = themeRenderings(readFileSync('src/hooks/useTheme.js', 'utf8'))
  .map((r) => ({ ...r, name: `${r.id}/${r.polarity}`, colours: themeColours(resolveTokens(rules, r)) }));

const pairs = [];
for (let i = 0; i < renderings.length; i++) {
  for (let j = i + 1; j < renderings.length; j++) {
    const [a, b] = [renderings[i], renderings[j]];
    if (a.id === b.id) continue; // a theme's own two polarities
    pairs.push({ a: a.name, b: b.name, d: themeDistance(a.colours, b.colours), why: themeDistanceBreakdown(a.colours, b.colours) });
  }
}
pairs.sort((x, y) => x.d - y.d);
console.log(`${renderings.length} renderings, ${pairs.length} pairs; closest ${pairs[0].d.toFixed(1)}`);
for (const p of pairs.filter((x) => x.d < max)) {
  const w = p.why;
  const ramp = (w['breakdown-common'] + w['breakdown-uncommon'] + w['breakdown-rare'] + w['breakdown-ultra'] + w['breakdown-legendary']) / 5;
  console.log(`${p.d.toFixed(1).padStart(5)}  ${(p.a + ' ~ ' + p.b).padEnd(44)} bg ${w.background.toFixed(1)}  fill ${w.fill.toFixed(1)}  card ${w.card.toFixed(1)}  accent ${w.accent.toFixed(1)}  ramp ${ramp.toFixed(1)}`);
}
