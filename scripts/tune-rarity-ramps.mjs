// Tunes every theme's rarity gauge (--breakdown-common ... -legendary in
// src/index.css) as a gradient from the Home glow-bubble colour (--accent)
// to the Scan colour (--cta), product direction 2026-10-27, within the
// gauge rules in src/lib/rampColour.js (rampProblems):
// - Legendary IS the Scan colour;
// - every tier reads at >= 3:1 against the card;
// - lightness moves one way in real steps, toward or away from Scan;
// - adjacent tiers >= 8 apart (deltaE-OK) in normal, protan and deutan vision;
// - Legendary is the most colourful tier.
//
// How: Legendary is pinned to the theme's resolved --cta. The other four
// tiers are a search over OKLCH lightness, chroma and hue: each rule is a
// penalty (with a little margin) until it holds; among passing ramps the
// one nearest the gradient wins (each tier's hue on the shortest arc from
// the accent's hue to Scan's, chroma climbing toward Scan's, Common near
// the accent colour itself). Both directions are tried: Common at the dark
// end (the ramp climbs to a bright Scan) or the light end (it descends into
// a mid-tone or light-theme Scan); the better passing ramp is written. A
// theme with none is left unchanged and reported.
//
//   node scripts/tune-rarity-ramps.mjs                    report only
//   node scripts/tune-rarity-ramps.mjs --write            rewrite src/index.css
//   CSS_OUT=path node scripts/... --write                 write a preview copy
//
// Then re-derive what reads the gauge:
//   node scripts/generate-rarity-text.mjs --write         badge/label text
//   (Alloy's holo stops are each theme's Legendary swept across nearby hues.)
import { readFileSync, writeFileSync } from 'node:fs';
import { themeRenderings, cssRules, resolveTokens } from '../src/lib/themeTokens.js';
import {
  STEPS, MIN_STEP, MIN_COMMON, MIN_LIGHT_STEP, parseHsl, formatHsl, hslToRgb, rgbToHsl,
  srgbToOklab, oklabToSrgb, inGamut, contrast, deltaEOk, adjacentSteps, rampProblems, labChroma,
} from '../src/lib/rampColour.js';

const CSS_PATH = 'src/index.css';
// Kept apart from a neighbour's gauge (themeDistance.test.js): the tiers of
// the key theme are pushed >= AVOID_GAP from the same tiers of the value
// theme as it stands in the file. Gradients that end on similar Scan
// colours otherwise converge (both start near-grey and climb the same way).
const AVOID = {
  '[data-theme="aurora"]': '[data-theme="plasma"][data-polarity="dark"]',
  '[data-theme="forest"]': '[data-theme="carbon"]',
  '[data-theme="sapphire"]': '[data-theme="amethyst"]',
  // Anodised Teal's tint ladder (pale aqua to teal) sits near Emerald's.
  '[data-theme="emerald"]': '[data-theme="alloy-teal"]',
};
const AVOID_GAP = 12;
// Pairs whose pages are near-identical, so the gauge has to carry more of
// the difference.
const AVOID_GAPS = { '[data-theme="emerald"]': 16 };
const DEG = Math.PI / 180;
const MAX_HUE_OFF = 35;

const css = readFileSync(CSS_PATH, 'utf8');
const rules = cssRules(css);
const renderings = themeRenderings(readFileSync('src/hooks/useTheme.js', 'utf8'));
const nl = css.includes('\r\n') ? '\r\n' : '\n';

// The tokens a theme block's gauge is shown with, resolved for its rendering
// (a Neon block names its polarity; other themes have one).
function tokensFor(name) {
  const id = name.match(/data-theme="([^"]+)"/)?.[1] ?? 'power-up';
  const polarity = name.match(/data-polarity="([^"]+)"/)?.[1] ?? 'dark';
  const r = renderings.find((x) => x.id === id && (!name.includes('data-polarity') || x.polarity === polarity))
    ?? renderings.find((x) => x.id === id);
  return resolveTokens(rules, r);
}

// Theme gauge blocks: the ones that declare a gauge (--breakdown-common:)
// and a card. (Others only mention the tokens: the shared --rarity-* block
// reads them.)
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)]
  .filter((m) => /--breakdown-common:/.test(m[2]) && /--card:/.test(m[2]))
  .map((m) => ({
    name: m[1].trim().split(/\r?\n/).pop().trim(),
    bodyStart: m.index + m[0].indexOf('{') + 1,
    body: m[2],
    card: m[2].match(/--card:\s*([^;]+);/)?.[1],
    steps: STEPS.map((s) => m[2].match(new RegExp(`--breakdown-${s}:\\s*([^;]+);`))[1].trim()),
  }))
  .filter((b) => b.card);

const rgbOf = (hsl) => hslToRgb(parseHsl(hsl));
const toLch = (rgb) => {
  const [L, a, b] = srgbToOklab(rgb);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
};
function fromLch({ L, C, h }) {
  const at = (c) => oklabToSrgb([L, c * Math.cos(h), c * Math.sin(h)]);
  if (inGamut(at(C))) return at(C);
  let lo = 0, hi = C;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; (inGamut(at(mid)) ? (lo = mid) : (hi = mid)); }
  return at(lo).map((v) => Math.min(1, Math.max(0, v)));
}
const signedDeg = (a, b) => ((((a - b) / DEG + 540) % 360) - 180);

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function tune(block) {
  const get = tokensFor(block.name);
  const card = rgbOf(block.card);
  const scanHsl = get('--cta');
  const scan = rgbOf(scanHsl);
  const accent = rgbOf(get('--accent'));
  const S = toLch(scan), A = toLch(accent);
  const neutral = S.C < 0.02;
  const arc = signedDeg(S.h / DEG * DEG, A.h); // accent -> scan, shortest way
  const targetH = (i) => A.h + arc * DEG * (i / 4);
  const targetC = (i) => (neutral ? 0 : Math.min(A.C, 0.6 * S.C) + (0.85 * S.C - Math.min(A.C, 0.6 * S.C)) * (i / 4));
  const scanLab = labChroma(scan);
  const avoid = AVOID[block.name] ? blocks.find((b) => b.name === AVOID[block.name]).steps.map(rgbOf) : null;

  const clamp = (t, i) => ({
    L: Math.min(0.99, Math.max(0.05, t.L)),
    C: neutral ? 0 : Math.min(0.37, Math.max(0, t.C)),
    h: targetH(i) + Math.max(-MAX_HUE_OFF, Math.min(MAX_HUE_OFF, signedDeg(t.h, targetH(i)))) * DEG,
  });

  function score(tiers, dir) {
    const rgbs = [...tiers.map(fromLch), scan];
    const L = rgbs.map((c) => srgbToOklab(c)[0]);
    const C = rgbs.map(labChroma);
    let v = 0;
    for (let i = 0; i < 4; i++) v += 10 * Math.max(0, MIN_COMMON + 0.03 - contrast(rgbs[i], card));
    for (let i = 1; i < 5; i++) v += 20 * Math.max(0, MIN_LIGHT_STEP + 0.002 - (L[i] - L[i - 1]) * dir);
    for (const vision of ['normal', 'protan', 'deutan']) {
      for (const s of adjacentSteps(rgbs, vision)) v += Math.max(0, MIN_STEP + 0.15 - s);
    }
    for (let i = 0; i < 4; i++) v += 0.5 * Math.max(0, C[i] - (neutral ? scanLab + 0.3 : scanLab - 1));
    // A gradient, not a zig-zag: colour climbs tier by tier toward Scan.
    for (let i = 1; i < 5; i++) v += 0.5 * Math.max(0, C[i - 1] - 1 - C[i]);
    if (v > 0) return 1000 + 100 * v;
    const lch = tiers.map((t) => toLch(fromLch(t)));
    const hueOff = lch.reduce((acc, t, i) => acc + Math.abs(signedDeg(t.h, targetH(i))) * Math.min(1, t.C * 10), 0);
    const chromaOff = lch.reduce((acc, t, i) => acc + Math.abs(t.C - targetC(i)) * 100, 0);
    // Use only the lightness range the steps need (on a light card the
    // room is huge, and spending it all starts Common near black), and keep
    // Common near the glow colour itself.
    const span = Math.abs(L[4] - L[0]) * 100;
    const apart = avoid ? tiers.reduce((acc, t, i) => acc + Math.max(0, (AVOID_GAPS[block.name] ?? AVOID_GAP) - deltaEOk(fromLch(t), avoid[i])), 0) : 0;
    return 3 * apart + 0.3 * hueOff + 0.5 * chromaOff + 0.4 * deltaEOk(fromLch(tiers[0]), accent) + 0.6 * span;
  }

  const rand = seeded(0x9e37 ^ block.name.length);
  let best = null;
  for (const dir of [1, -1]) {
    // dir +1: lightness rises toward Scan (Common at the dark end).
    for (const step of [0.05, 0.06, 0.07, 0.08, 0.1]) {
      let cur = STEPS.slice(0, 4).map((_, i) => clamp({ L: S.L - dir * step * (4 - i), C: targetC(i), h: targetH(i) }, i));
      let curScore = score(cur, dir);
      for (let it = 0, n = 6000; it < n; it++) {
        const scale = 1 - it / n;
        const i = Math.floor(rand() * 4);
        const next = cur.map((t) => ({ ...t }));
        const which = rand();
        if (which < 0.45) next[i].L += (rand() - 0.5) * 0.12 * scale;
        else if (which < 0.8) next[i].C += (rand() - 0.5) * 0.08 * scale;
        else next[i].h += (rand() - 0.5) * 30 * DEG * scale;
        next[i] = clamp(next[i], i);
        const s = score(next, dir);
        if (s <= curScore) { cur = next; curScore = s; }
      }
      if (curScore < 1000 && (!best || curScore < best.score)) best = { tiers: cur, score: curScore, dir };
    }
  }
  if (!best) return null;
  const steps = [...best.tiers.map((t) => formatHsl(rgbToHsl(fromLch(t)))), formatHsl(parseHsl(scanHsl))];
  return rampProblems(steps.map(rgbOf), card, { scan }).length ? null : { steps, dir: best.dir };
}

let out = css;
const report = [];
for (const block of [...blocks].reverse()) { // from the end, so offsets stay valid
  // Spring's, Alloy's, Candy's, Noir's and Botanical's gauges are ladders of their main colour,
  // written by scripts/generate-tint-ladders.mjs under their own rules.
  if (/data-theme="((spring|alloy)-|bubblegum|blue-pop|grape-candy|orange-crush|sour-apple|cherry-pop|carbon|crimson|amethyst|sapphire|emerald|sage|meadow|fern|forest|deep-space|stellar-gold|solar-flare|nebula|aurora|power-up|cyberpunk|plasma|boss-fight|synthwave)/.test(block.name)) {
    report.unshift(`skip    ${block.name}: tint ladder (generate-tint-ladders.mjs)`);
    continue;
  }
  const tuned = tune(block);
  if (!tuned) {
    report.unshift(`KEPT    ${block.name}: no gradient meets every rule`);
    continue;
  }
  report.unshift(`tuned   ${block.name}: ${tuned.dir > 0 ? 'climbs to' : 'descends into'} Scan`);
  let body = block.body;
  STEPS.forEach((s, i) => {
    body = body.replace(new RegExp(`(--breakdown-${s}:\\s*)[^;]+;`), `$1${tuned.steps[i]};`);
  });
  out = out.slice(0, block.bodyStart) + body + out.slice(block.bodyStart + block.body.length);
}

console.log(report.join('\n'));
console.log(`\n${blocks.length} theme gauges`);
if (process.argv.includes('--write')) {
  const target = process.env.CSS_OUT || CSS_PATH;
  writeFileSync(target, out.replace(/\r?\n/g, nl));
  console.log(`wrote ${target}`);
}
