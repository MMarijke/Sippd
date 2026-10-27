// Writes tint-ladder rarity gauges (--breakdown-common ... -legendary in
// src/index.css) for the Spring and Alloy families (product direction,
// 2026-10-27): each bar is a ladder of tints of the theme's main colour, from
// the palest tint (Common) up to the colour itself (Legendary), like the
// Spring palette cards, every step a little richer and all in that hue.
//
//   Spring: the palette colours (plum #665075, brick #C75554, coral
//   #EF8F6E, pistachio #B2BC76, olive #778C62), which are also each theme's
//   Scan colour. Butter #FFED9C is the one exception: its tints vanish on
//   its own cream card (the colour itself reads 1.13:1 there), so its
//   ladder starts AT the palette butter and climbs into richer butter-golds.
//   Alloy and Candy: each theme's Scan colour (--cta, resolved through the
//   cascade). Alloy:
//   pale cream to Gold Foil's gold, pale pink to Anodised Red, pale aqua to
//   Anodised Teal, pale silver to Brushed Aluminium's graphite. Candy: pale
//   tints up to Bubblegum's pink, Blue Pop's blue, Grape Candy's violet,
//   Orange Crush's orange, Sour Apple's green and Cherry Pop's cherry red.
//   Noir (dark cards): Carbon is a short tint ladder, from a mid silver (not
//   the near-white it started at) down to its graphite. Crimson, Amethyst,
//   Sapphire and Emerald climb the other way, from a deep, richer shade of
//   the jewel (garnet, royal purple, deep sapphire, deep teal) up to the
//   Scan colour, so every tier shows the theme's colour instead of starting
//   pale; Silver Screen keeps its tuned gradient.
//   Botanical: the dark pair climb from deep shades too (Forest from a deep,
//   dark green; Fern from a deep olive, a little darker than its old
//   gradient); the light pair (Sage, Meadow) are tint ladders, from a pale
//   tint of their green up to the Scan green.
//
// Tints are the colour mixed toward white in OKLab. These families trade the
// gauge rules other themes keep (3:1 for every tier, colour-blind-safe steps)
// for the ladder; every segment draws a hairline in the theme's own colour
// (--gauge-edge) so the palest tints keep their shape.
// scripts/tune-rarity-ramps.mjs leaves these families alone;
// breakdownRamps.test.js checks the ladders with their own rules.
//
//   node scripts/generate-tint-ladders.mjs --write
//   then: node scripts/generate-rarity-text.mjs --write
//   (and re-derive Alloy's holo stops from the new Legendary)
import { readFileSync, writeFileSync } from 'node:fs';
import { themeRenderings, cssRules, resolveTokens } from '../src/lib/themeTokens.js';
import { STEPS, parseHsl, hslToRgb, formatHsl, rgbToHsl, srgbToOklab, oklabToSrgb, inGamut } from '../src/lib/rampColour.js';

const CSS_PATH = 'src/index.css';
// Theme id -> its ladder's colour: a palette hex, or 'scan' for the
// theme's resolved Scan colour.
export const LADDERS = {
  'spring-plum': '#665075',
  'spring-brick': '#C75554',
  'spring-coral': '#EF8F6E',
  'spring-butter': '#FFED9C',
  'spring-pistachio': '#B2BC76',
  'spring-olive': '#778C62',
  'alloy-aluminium': 'scan',
  'alloy-teal': 'scan',
  'alloy-red': 'scan',
  'alloy-gold': 'scan',
  bubblegum: 'scan',
  'blue-pop': 'scan',
  'grape-candy': 'scan',
  'orange-crush': 'scan',
  'sour-apple': 'scan',
  'cherry-pop': 'scan',
  carbon: 'scan',
  crimson: 'scan',
  amethyst: 'scan',
  sapphire: 'scan',
  emerald: 'scan',
  sage: 'scan',
  meadow: 'scan',
  fern: 'scan',
  forest: 'scan',
};
// Shade ladders (dark cards): how far below the Scan colour Common starts,
// in OKLab lightness.
const SHADE_DEPTH = { crimson: 0.17, amethyst: 0.17, sapphire: 0.17, emerald: 0.17, forest: 0.18, fern: 0.36 };
// ...and how much colour they gain going down (Fern's olive turns brown if
// pushed, so it keeps the Scan colour's chroma).
const SHADE_BOOST = { fern: 0 };
export const isLadderTheme = (id) => Object.hasOwn(LADDERS, id);
const TINT_SHARES = [0.26, 0.46, 0.64, 0.82, 1];
// Alloy's Scan colours are lighter than Spring's palette (Gold Foil's gold
// especially), so their ladders start from a paler tint to keep every step
// distinct.
const ALLOY_SHARES = [0.16, 0.38, 0.58, 0.79, 1];
// Carbon's graphite on its dark card: a short ladder from a mid silver.
const CARBON_SHARES = [0.42, 0.56, 0.71, 0.85, 1];
// Sage starts from a fuller tint, which also keeps it apart from Spring
// Olive's pale greens.
const SAGE_SHARES = [0.36, 0.52, 0.68, 0.84, 1];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clampRgb = (c) => c.map((v) => Math.min(1, Math.max(0, v)));
function fit(L, C, h) {
  let c = C, x;
  do { x = oklabToSrgb([L, c * Math.cos(h), c * Math.sin(h)]); c -= 0.002; } while (!inGamut(x) && c > 0);
  return clampRgb(x);
}

export function tintLadder(id, colourRgb) {
  const [L, a, b] = srgbToOklab(colourRgb);
  if (id === 'spring-butter') {
    // From the palette butter into richer butter-golds: darker, more colour,
    // hue easing a little toward gold.
    const C0 = Math.hypot(a, b), h0 = Math.atan2(b, a);
    return [0, 0.25, 0.5, 0.75, 1].map((t) => fit(L - 0.16 * t, C0 + 0.08 * t, h0 - (12 * Math.PI / 180) * t));
  }
  if (Object.hasOwn(SHADE_DEPTH, id)) {
    // Shades: deeper and a little more saturated below the Scan colour,
    // which stays Legendary exactly.
    const C0 = Math.hypot(a, b), h0 = Math.atan2(b, a);
    return [1, 0.75, 0.5, 0.25, 0].map((t) => (t ? fit(L - SHADE_DEPTH[id] * t, C0 + (SHADE_BOOST[id] ?? 0.04) * t, h0) : colourRgb));
  }
  const shares = id.startsWith('alloy-') ? ALLOY_SHARES : id === 'carbon' ? CARBON_SHARES : id === 'sage' ? SAGE_SHARES : TINT_SHARES;
  return shares.map((t) => clampRgb(oklabToSrgb([1 - (1 - L) * t, a * t, b * t])));
}

if (process.argv[1]?.endsWith('generate-tint-ladders.mjs')) {
  let css = readFileSync(CSS_PATH, 'utf8');
  const rules = cssRules(css);
  const renderings = themeRenderings(readFileSync('src/hooks/useTheme.js', 'utf8'));
  for (const [id, source] of Object.entries(LADDERS)) {
    const r = renderings.find((x) => x.id === id);
    const colour = source === 'scan' ? hslToRgb(parseHsl(resolveTokens(rules, r)('--cta'))) : hex(source);
    const head = `[data-theme="${id}"] {`;
    let at = css.indexOf(head);
    while (at >= 0 && !css.slice(at, css.indexOf('}', at)).includes('--breakdown-common:')) at = css.indexOf(head, at + 1);
    const end = css.indexOf('}', at);
    let body = css.slice(at, end);
    const ladder = tintLadder(id, colour).map((c) => formatHsl(rgbToHsl(c)));
    STEPS.forEach((s, i) => { body = body.replace(new RegExp(`(--breakdown-${s}:\\s*)[^;]+;`), `$1${ladder[i]};`); });
    css = css.slice(0, at) + body + css.slice(end);
    console.log(id.padEnd(17), ladder.join(' | '));
  }
  if (process.argv.includes('--write')) { writeFileSync(CSS_PATH, css); console.log(`wrote ${CSS_PATH}`); }
}
