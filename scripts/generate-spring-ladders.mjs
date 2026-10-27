// Writes the Spring family's rarity gauges (--breakdown-common ... -legendary
// in src/index.css) as tint ladders of each palette colour, like the Spring
// palette cards they come from (product direction, 2026-10-27):
//
//   Plum #665075, Brick #C75554, Coral #EF8F6E, Pistachio #B2BC76,
//   Olive #778C62: a ladder of tints (the colour mixed toward white in
//   OKLab) up to the palette colour itself, which is also the theme's Scan
//   colour. Legendary IS the palette colour.
//   Butter #FFED9C: its tints vanish on its own cream card (the colour
//   itself reads 1.13:1 there), so its ladder starts AT the palette butter
//   and climbs into richer butter-golds; Legendary is the richest.
//
// Spring trades the gauge rules other themes keep (3:1 for every tier,
// colour-blind-safe steps) for the palette's pastel tints, by product
// direction: colour-blind users have the "colour-blind-friendly rarity
// colours" setting, and every Spring segment draws a hairline in its own
// colour (--gauge-edge) so the palest tints keep their shape.
// scripts/tune-rarity-ramps.mjs leaves Spring alone; breakdownRamps.test.js
// checks these ladders with Spring's own rules.
//
//   node scripts/generate-spring-ladders.mjs --write
//   then: node scripts/generate-rarity-text.mjs --write
import { readFileSync, writeFileSync } from 'node:fs';
import { STEPS, formatHsl, rgbToHsl, srgbToOklab, oklabToSrgb, inGamut } from '../src/lib/rampColour.js';

const CSS_PATH = 'src/index.css';
export const SPRING_PALETTE = {
  'spring-plum': '#665075',
  'spring-brick': '#C75554',
  'spring-coral': '#EF8F6E',
  'spring-butter': '#FFED9C',
  'spring-pistachio': '#B2BC76',
  'spring-olive': '#778C62',
};
const TINT_SHARES = [0.26, 0.46, 0.64, 0.82, 1];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clampRgb = (c) => c.map((v) => Math.min(1, Math.max(0, v)));
function fit(L, C, h) {
  let c = C, x;
  do { x = oklabToSrgb([L, c * Math.cos(h), c * Math.sin(h)]); c -= 0.002; } while (!inGamut(x) && c > 0);
  return clampRgb(x);
}

export function springLadder(id) {
  const [L, a, b] = srgbToOklab(hex(SPRING_PALETTE[id]));
  if (id === 'spring-butter') {
    // From the palette butter into richer butter-golds: darker, more colour,
    // hue easing a little toward gold.
    const C0 = Math.hypot(a, b), h0 = Math.atan2(b, a);
    return [0, 0.25, 0.5, 0.75, 1].map((t) => fit(L - 0.16 * t, C0 + 0.08 * t, h0 - (12 * Math.PI / 180) * t));
  }
  return TINT_SHARES.map((t) => clampRgb(oklabToSrgb([1 - (1 - L) * t, a * t, b * t])));
}

if (process.argv[1]?.endsWith('generate-spring-ladders.mjs')) {
  let css = readFileSync(CSS_PATH, 'utf8');
  for (const id of Object.keys(SPRING_PALETTE)) {
    const head = `[data-theme="${id}"] {`;
    let at = css.indexOf(head);
    while (at >= 0 && !css.slice(at, css.indexOf('}', at)).includes('--breakdown-common:')) at = css.indexOf(head, at + 1);
    const end = css.indexOf('}', at);
    let body = css.slice(at, end);
    const ladder = springLadder(id).map((c) => formatHsl(rgbToHsl(c)));
    STEPS.forEach((s, i) => { body = body.replace(new RegExp(`(--breakdown-${s}:\\s*)[^;]+;`), `$1${ladder[i]};`); });
    css = css.slice(0, at) + body + css.slice(end);
    console.log(id.padEnd(17), ladder.join(' | '));
  }
  if (process.argv.includes('--write')) { writeFileSync(CSS_PATH, css); console.log(`wrote ${CSS_PATH}`); }
}
