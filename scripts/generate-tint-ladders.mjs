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
//   Cosmic (dark): Deep Space, Stellar Gold and Solar Flare climb from a deep
//   shade of the Scan colour (deep blue, amber-gold, ember) up to it; Nebula
//   from a deep blue (its accent's hue) up to its Scan violet. Aurora is a
//   blend instead: from the blue of its glow bubble (--accent) round through
//   azure and teal to its Scan green. Moonlight keeps its tuned gradient.
//   Neon (one block per polarity, keyed 'id:polarity'): the dark renderings
//   blend from a rich colour in the accent's hue (the glow bubble's) to the
//   Scan colour, the short way round, so none starts grey; Boss Fight dark
//   from a bright amber into its red. The light renderings are tint ladders
//   of the Scan colour, like Candy (no brown, near-black or rainbow starts).
//   Boss Fight dark is a shade ladder instead: a deep ember (its red leaning
//   toward orange) up to the Scan red.
//   Soda Fountain: Cola blends from a deep cola-red (its accent's hue) up to
//   its caramel Scan colour; Root Beer from a rich amber up to its cream.
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
  'deep-space': 'scan',
  'stellar-gold': 'scan',
  'solar-flare': 'scan',
  nebula: 'scan',
  aurora: 'scan',
  'power-up:dark': 'scan',
  'cyberpunk:dark': 'scan',
  'plasma:dark': 'scan',
  'boss-fight:dark': 'scan',
  'synthwave:dark': 'scan',
  'power-up:light': 'scan',
  'cyberpunk:light': 'scan',
  'plasma:light': 'scan',
  'boss-fight:light': 'scan',
  'synthwave:light': 'scan',
  cola: 'scan',
  'root-beer': 'scan',
};
// Shade ladders (dark cards): how far below the Scan colour Common starts,
// in OKLab lightness.
const SHADE_DEPTH = { crimson: 0.165, amethyst: 0.17, sapphire: 0.17, emerald: 0.17, forest: 0.18, fern: 0.36, 'deep-space': 0.2, 'stellar-gold': 0.22, 'solar-flare': 0.2, nebula: 0.145, 'boss-fight:dark': 0.2 };
// ...how much colour they gain going down, and how far their hue leans
// toward green (degrees). Fern gives colour up instead: its lime, darkened at
// full strength, turns mustard, so its deep tiers are soft olive-greens that
// lean green, as its gradient was before the ladder.
// Stellar Gold leans toward amber going down (deep yellows turn olive), Deep
// Space toward a truer blue, Nebula all the way round to its accent blue.
// Forest and Crimson's Scan colours were lightened (2026-10-31) so their
// first tier shows (Forest 2.2:1, Crimson 1.9:1 on the card); both lose a
// little colour going down, so Legendary is their most colourful tier.
const SHADE_BOOST = { fern: -0.07, 'solar-flare': 0.01, forest: -0.03, crimson: -0.03, 'boss-fight:dark': 0 };
const SHADE_HUE = { fern: 10, 'stellar-gold': -14, 'deep-space': 8, nebula: -17, 'boss-fight:dark': 15 };
// Blends: theme id -> the token Common starts on (the ladder runs from it to
// the Scan colour in OKLCH, the short way round the hue circle), optionally
// moved to lightness L (same hue and colour, gamut allowing).
export const BLEND_FROM = {
  aurora: '--accent',
  'power-up:dark': { token: '--accent', L: 0.62 },
  'cyberpunk:dark': { token: '--accent', L: 0.47 },
  'plasma:dark': { token: '--accent', L: 0.6 },
  'synthwave:dark': { token: '--accent', L: 0.45 },
  // Boss Fight light from a light orange in its accent's hue into its red, so
  // it stays orange-and-red rather than a second Bubblegum or Orange Crush.
  'boss-fight:light': { token: '--accent', L: 0.80 },
  cola: { token: '--accent', L: 0.42 },
  // Root Beer's cream Scan colour has almost no colour of its own, so its
  // ladder starts from a rich amber (OKLCH) close to the cream's hue.
  'root-beer': { lch: [0.6, 0.13, 72], chromaEase: 2 },
};
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

// chromaEase > 1 holds the colour longer before it fades toward a
// low-colour Scan (Root Beer's cream), so the middle tiers don't go tan.
export function blendLadder(fromRgb, colourRgb, chromaEase = 1) {
  const lch = (c) => { const [L, a, b] = srgbToOklab(c); return [L, Math.hypot(a, b), Math.atan2(b, a)]; };
  const [L0, C0, h0] = lch(fromRgb), [L1, C1, h1] = lch(colourRgb);
  const dh = ((h1 - h0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return [0, 0.25, 0.5, 0.75, 1].map((t) => (t === 1 ? colourRgb : fit(L0 + (L1 - L0) * t, C0 + (C1 - C0) * t ** chromaEase, h0 + dh * t)));
}

// Deepening ladders (owner-approved exceptions): Spring's palest palette
// colours vanish as tints on their own cream cards (Butter 1.13:1, Coral and
// Pistachio's whole bars were 1.1-2.2:1), so these START at the palette
// colour (Common) and climb into deeper, richer shades of it: OKLab
// lightness drop, chroma gain and hue drift (degrees) at Legendary.
// Butter eases toward gold; Coral toward red, Pistachio toward green, so
// neither deepens into brown or olive. Legendary is not the Scan colour.
export const DEEPEN = {
  'spring-butter': { depth: 0.16, boost: 0.08, hue: -12 },
  'spring-coral': { depth: 0.2, boost: 0.05, hue: -8 },
  'spring-pistachio': { depth: 0.24, boost: 0.07, hue: 15 },
};

export function tintLadder(id, colourRgb) {
  const [L, a, b] = srgbToOklab(colourRgb);
  if (Object.hasOwn(DEEPEN, id)) {
    const { depth, boost, hue } = DEEPEN[id];
    const C0 = Math.hypot(a, b), h0 = Math.atan2(b, a);
    return [0, 0.25, 0.5, 0.75, 1].map((t) => fit(L - depth * t, C0 + boost * t, h0 + (hue * Math.PI / 180) * t));
  }
  if (Object.hasOwn(SHADE_DEPTH, id)) {
    // Shades: deeper and a little more saturated below the Scan colour,
    // which stays Legendary exactly.
    const C0 = Math.hypot(a, b), h0 = Math.atan2(b, a);
    return [1, 0.75, 0.5, 0.25, 0].map((t) => (t ? fit(L - SHADE_DEPTH[id] * t, C0 + (SHADE_BOOST[id] ?? 0.04) * t, h0 + ((SHADE_HUE[id] ?? 0) * Math.PI / 180) * t) : colourRgb));
  }
  const shares = id.startsWith('alloy-') ? ALLOY_SHARES : id === 'carbon' ? CARBON_SHARES : id === 'sage' ? SAGE_SHARES : TINT_SHARES;
  return shares.map((t) => clampRgb(oklabToSrgb([1 - (1 - L) * t, a * t, b * t])));
}

if (process.argv[1]?.endsWith('generate-tint-ladders.mjs')) {
  let css = readFileSync(CSS_PATH, 'utf8');
  const rules = cssRules(css);
  const renderings = themeRenderings(readFileSync('src/hooks/useTheme.js', 'utf8'));
  for (const [key, source] of Object.entries(LADDERS)) {
    const [id, polarity] = key.split(':');
    const r = renderings.find((x) => x.id === id && (!polarity || x.polarity === polarity));
    const colour = source === 'scan' ? hslToRgb(parseHsl(resolveTokens(rules, r)('--cta'))) : hex(source);
    const head = polarity ? `[data-theme="${id}"][data-polarity="${polarity}"] {` : `[data-theme="${id}"] {`;
    let at = css.indexOf(head);
    while (at >= 0 && !css.slice(at, css.indexOf('}', at)).includes('--breakdown-common:')) at = css.indexOf(head, at + 1);
    const end = css.indexOf('}', at);
    let body = css.slice(at, end);
    const blend = typeof BLEND_FROM[key] === 'string' ? { token: BLEND_FROM[key] } : BLEND_FROM[key];
    let from = blend && (blend.lch ? fit(blend.lch[0], blend.lch[1], (blend.lch[2] * Math.PI) / 180) : hslToRgb(parseHsl(resolveTokens(rules, r)(blend.token))));
    if (blend?.L) { const [, fa, fb] = srgbToOklab(from); from = fit(blend.L, Math.hypot(fa, fb), Math.atan2(fb, fa)); }
    const ladder = (from ? blendLadder(from, colour, blend.chromaEase) : tintLadder(key, colour)).map((c) => formatHsl(rgbToHsl(c)));
    STEPS.forEach((s, i) => { body = body.replace(new RegExp(`(--breakdown-${s}:\\s*)[^;]+;`), `$1${ladder[i]};`); });
    css = css.slice(0, at) + body + css.slice(end);
    console.log(key.padEnd(17), ladder.join(' | '));
  }
  if (process.argv.includes('--write')) { writeFileSync(CSS_PATH, css); console.log(`wrote ${CSS_PATH}`); }
}
