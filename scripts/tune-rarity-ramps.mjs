// Re-tunes theme rarity gauges (--breakdown-common ... -legendary in
// src/index.css) against the gauge rules in src/lib/rampColour.js
// (rampProblems): contrast against --card rising from >= 3:1; adjacent tiers
// >= 8 apart (deltaE-OK) in normal vision, and also under simulated
// protanopia and deuteranopia on dark themes; Legendary the most colourful
// tier; every tier >= 10 from the theme's Scan fill (--cta, resolved through
// the cascade). Ramps that already pass are left exactly as they are.
//
// How: a constrained search over each tier's OKLCH lightness, chroma and
// hue (15 numbers). Each rule is a penalty, with a little margin, until it
// holds; among ramps that pass, the most colourful wins (Legendary weighted
// most) with a cost for every degree a tier's hue drifts from the theme's
// own, capped at MAX_DRIFT. Several starts (the current ramp, the theme's
// own, an even rebuild, and hue-shifted variants) each run a shrinking
// random-step descent; the best passing ramp is written. A theme with none
// is left unchanged and reported.
//
// Why hue may drift: on a dark card the rarest tier has to be the lightest
// one, and reds, blues and violets can't stay vivid that light, so their
// peak travels towards a hue that can (Crimson rises to gold, Sapphire to
// ice-cyan). On a light card the peak is the darkest tier, where those hues
// are at their richest.
//
// --all re-tunes every ramp, not only failing ones; ORIG_CSS=path takes each
// theme's hues from another copy of index.css (e.g. the last commit), so a
// re-tune starts from the theme's identity, not a previous run's result.
//
// SEEDS re-route a theme's hues (HSL degrees, Common -> Legendary) before
// tuning, for ramps whose hue family fought their own Scan button
// (/impeccable critique, 2026-10-26): Sour Apple's forest greens under a
// lime Scan, Fern's mint under an olive Scan, Grape Candy's magenta under a
// violet Scan; Sage and Spring Olive (below).
//
//   node scripts/tune-rarity-ramps.mjs                    report only
//   node scripts/tune-rarity-ramps.mjs --write            rewrite src/index.css
//   CSS_OUT=path node scripts/... --write                 write a preview copy
import { readFileSync, writeFileSync } from 'node:fs';
import { themeRenderings, cssRules, resolveTokens } from '../src/lib/themeTokens.js';
import {
  STEPS, MIN_STEP, MIN_COMMON, MIN_SCAN_GAP, parseHsl, formatHsl, hslToRgb, rgbToHsl,
  srgbToOklab, oklabToSrgb, inGamut, contrast, deltaEOk, adjacentSteps, isDarkCard,
  rampProblems, labChroma,
} from '../src/lib/rampColour.js';

const CSS_PATH = 'src/index.css';
const MAX_DRIFT = 60;
const DEG = Math.PI / 180;

const SEEDS = {
  '[data-theme="sour-apple"]': [62, 70, 80, 92, 104],
  '[data-theme="fern"]': [44, 54, 64, 74, 84],
  '[data-theme="grape-candy"]': [232, 242, 252, 262, 272],
  // Scan sits in these ramps' own hue AND lightness, so a ramp in that hue
  // can only pass by going grey: Sage's runs into deep teal instead, Spring
  // Olive's into ochre and rust (olive's classic pairing).
  '[data-theme="sage"]': [165, 172, 180, 188, 196],
  '[data-theme="spring-olive"]': [45, 38, 30, 22, 15],
  // Kept apart from a neighbour (themeDistance.test.js): Sapphire rises into
  // ice-blue and cyan (Amethyst keeps violet to orchid); Boss Fight light
  // runs rose to crimson-magenta (Orange Crush keeps orange to red); Spring
  // Brick stays warm, terracotta to rust (Cherry Pop keeps pink to plum).
  '[data-theme="sapphire"]': [225, 215, 205, 198, 192],
  '[data-theme="boss-fight"][data-polarity="light"]': [350, 345, 340, 334, 328],
  '[data-theme="spring-brick"]': [22, 26, 30, 34, 38],
};

// Themes named for their colour keep their Legendary close to it (degrees
// of drift): on a dark card the search otherwise pulls a light peak toward
// lime, the hue that stays most vivid that light.
const PEAK_DRIFT = {
  '[data-theme="alloy-gold"]': 15,
  '[data-theme="stellar-gold"]': 15,
  '[data-theme="alloy-teal"]': 25,
};

const css = readFileSync(CSS_PATH, 'utf8');
const origCss = process.env.ORIG_CSS ? readFileSync(process.env.ORIG_CSS, 'utf8') : css;
const rules = cssRules(css);
const renderings = themeRenderings(readFileSync('src/hooks/useTheme.js', 'utf8'));
// The Scan fill a theme block's gauge is shown beside: --cta resolved for
// that rendering (a Neon block names its polarity; other themes have one).
function scanFor(name) {
  const id = name.match(/data-theme="([^"]+)"/)?.[1];
  const polarity = name.match(/data-polarity="([^"]+)"/)?.[1];
  const r = renderings.find((x) => x.id === id && (!polarity || x.polarity === polarity));
  return r ? resolveTokens(rules, r)('--cta') : null;
}
const nl = css.includes('\r\n') ? '\r\n' : '\n';

const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)]
  .map((m) => ({
    name: m[1].trim().split(/\r?\n/).pop().trim(),
    bodyStart: m.index + m[0].indexOf('{') + 1,
    body: m[2],
    card: m[2].match(/--card:\s*([^;]+);/)?.[1],
    steps: STEPS.map((s) => m[2].match(new RegExp(`--breakdown-${s}:\\s*([^;]+);`))[1].trim()),
  }))
  .filter((b) => b.card); // blocks without a card (the colour-blind override) aren't themes

// The same block in ORIG_CSS: the occurrence of its selector whose body
// carries a gauge (selectors also appear in family font/structure lists).
function origStepsFor(name) {
  for (let at = origCss.indexOf(`${name} {`); at >= 0; at = origCss.indexOf(`${name} {`, at + 1)) {
    const body = origCss.slice(at, origCss.indexOf('}', at));
    if (body.includes('--breakdown-common')) {
      return STEPS.map((x) => body.match(new RegExp(`--breakdown-${x}:\\s*([^;]+);`))[1].trim());
    }
  }
  return null;
}

const rgbOf = (hsl) => hslToRgb(parseHsl(hsl));
const problemsOf = (stepsHsl, cardHsl, scanHsl) =>
  rampProblems(stepsHsl.map(rgbOf), rgbOf(cardHsl), { scan: scanHsl ? rgbOf(scanHsl) : undefined });

const toLch = (rgb) => {
  const [L, a, b] = srgbToOklab(rgb);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
};
// OKLCH -> sRGB, with chroma pulled in until the colour fits the gamut.
function fromLch({ L, C, h }) {
  const at = (c) => oklabToSrgb([L, c * Math.cos(h), c * Math.sin(h)]);
  if (inGamut(at(C))) return at(C);
  let lo = 0, hi = C;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; (inGamut(at(mid)) ? (lo = mid) : (hi = mid)); }
  return at(lo).map((v) => Math.min(1, Math.max(0, v)));
}
const angle = (a, b) => Math.abs((((a - b) / DEG + 540) % 360) - 180);

// How far a ramp is from passing (0 = passes, with margin), and how good
// it is once it does (lower is better).
function score(tiers, ctx) {
  const rgbs = tiers.map(fromLch);
  const K = rgbs.map((c) => contrast(c, ctx.card));
  const C = rgbs.map(labChroma);
  let v = 10 * Math.max(0, MIN_COMMON + 0.08 - K[0]);
  for (let i = 1; i < 5; i++) v += 10 * Math.max(0, K[i - 1] * 1.04 - K[i]);
  for (const vision of ctx.dark ? ['normal', 'protan', 'deutan'] : ['normal']) {
    for (const s of adjacentSteps(rgbs, vision)) v += Math.max(0, MIN_STEP + 0.5 - s);
  }
  v += 0.5 * Math.max(0, Math.max(...C.slice(0, 4)) - C[4] + 1);
  if (ctx.dark) for (let i = 1; i < 5; i++) v += 0.5 * Math.max(0, C[i - 1] - 4 - C[i]);
  if (ctx.scan) for (const c of rgbs) v += Math.max(0, MIN_SCAN_GAP + 0.8 - deltaEOk(c, ctx.scan));
  // Read as one ordered climb, not just pass the rules: colour rises tier
  // by tier, and the hue travels one way in steps of at most 35 degrees
  // (without these the search zig-zags to buy colour).
  for (let i = 1; i < 5; i++) v += 0.5 * Math.max(0, C[i - 1] - 1 - C[i]);
  // Common may be a plain grey (the classic rarity convention), but
  // Uncommon already carries the theme's colour.
  if (!ctx.neutral) v += 0.3 * Math.max(0, 15 - C[1]);
  const lch = rgbs.map(toLch);
  const turns = lch.slice(1).map((t, i) => (t.C > 0.03 && lch[i].C > 0.03 ? angleSigned(t.h, lch[i].h) : 0));
  v += 0.1 * Math.min(turns.reduce((a, d) => a + Math.max(0, d), 0), turns.reduce((a, d) => a + Math.max(0, -d), 0));
  for (const d of turns) v += 0.1 * Math.max(0, Math.abs(d) - 35);
  if (v > 0) return 1000 + 100 * v;
  // Legendary's drift costs less: on a dark card the peak may travel to a
  // hue that stays vivid that light, while the lower tiers keep the theme's.
  const drift = lch.reduce((acc, t, i) => acc + (i === 4 ? 0.3 : 1) * angle(t.h, ctx.home[i]) * Math.min(1, t.C * 10), 0);
  return 0.6 * drift - (300 * lch[4].C + 50 * lch.reduce((acc, t) => acc + t.C, 0));
}

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function optimise(block) {
  const card = rgbOf(block.card);
  const dark = isDarkCard(card);
  const seed = SEEDS[block.name];
  const homeSteps = (block.origSteps ?? block.steps).map((s, i) => {
    if (!seed) return rgbOf(s);
    const [, sat, light] = parseHsl(s);
    return hslToRgb([seed[i], Math.max(sat, 45), light]);
  });
  const home = homeSteps.map(toLch);
  const neutral = home.every((o) => o.C < 0.02);
  const ctx = { card, dark, neutral, scan: block.scan ? rgbOf(block.scan) : null, home: home.map((t) => t.h) };
  const cardL = srgbToOklab(card)[0];
  const cap = (i) => (i === 4 && PEAK_DRIFT[block.name] !== undefined ? PEAK_DRIFT[block.name] : MAX_DRIFT);
  const clampTier = (t, i) => ({
    L: Math.min(0.99, Math.max(0.05, t.L)),
    C: neutral ? 0 : Math.min(0.37, Math.max(0, t.C)),
    h: home[i].h + Math.max(-cap(i), Math.min(cap(i), angleSigned(t.h, home[i].h))) * DEG,
  });

  // Starts: the current ramp, the theme's own, and even rebuilds (from
  // just past 3:1 to a far end) at the theme's hues and shifted ones.
  const starts = [block.steps.map(rgbOf).map(toLch), home];
  const L0 = dark ? cardL + 0.38 : cardL - 0.36;
  for (const span of [0.2, 0.3]) {
    for (const shift of [0, 30, -30]) {
      starts.push(STEPS.map((_, i) => ({
        L: L0 + (dark ? 1 : -1) * span * (i / 4),
        C: neutral ? 0 : 0.06 + 0.03 * i,
        h: home[i].h + (shift + (dark ? 12 : 0) * i) * DEG,
      })));
    }
  }

  const rand = seeded(0x5eed ^ block.name.length);
  let best = null;
  for (const start of starts) {
    let cur = start.map(clampTier);
    let curScore = score(cur, ctx);
    for (let it = 0, n = 3500; it < n; it++) {
      const scale = 1 - it / n;
      const i = Math.floor(rand() * 5);
      const next = cur.map((t) => ({ ...t }));
      const which = rand();
      if (which < 0.4) next[i].L += (rand() - 0.5) * 0.12 * scale;
      else if (which < 0.75) next[i].C += (rand() - 0.5) * 0.08 * scale;
      else next[i].h += (rand() - 0.5) * 40 * DEG * scale;
      next[i] = clampTier(next[i], i);
      const s = score(next, ctx);
      if (s <= curScore) { cur = next; curScore = s; }
    }
    if (curScore < 1000 && (!best || curScore < best.score)) best = { tiers: cur, score: curScore };
  }
  if (!best) return null;
  const steps = best.tiers.map((t) => formatHsl(rgbToHsl(fromLch(t))));
  // HSL rounding can undo a margin: only hand back a ramp that passes as written.
  return problemsOf(steps, block.card, block.scan).length ? null : { steps, drift: Math.max(...best.tiers.map((t, i) => angle(t.h, home[i].h))) };
}

function angleSigned(a, b) {
  return ((((a - b) / DEG + 540) % 360) - 180);
}

let out = css;
const report = [];
for (const block of [...blocks].reverse()) { // from the end, so offsets stay valid
  block.scan = scanFor(block.name);
  block.origSteps = origStepsFor(block.name);
  const before = problemsOf(block.steps, block.card, block.scan);
  if (process.argv.includes('--all') && block.name !== ':root') before.push('re-tuned (--all)');
  if (!before.length) {
    report.unshift(`ok      ${block.name}`);
    continue;
  }
  const tuned = optimise(block);
  if (!tuned) {
    report.unshift(`KEPT    ${block.name}: no ramp meets every rule (${before.join('; ')})`);
    continue;
  }
  report.unshift(`tuned   ${block.name}: max hue drift ${tuned.drift.toFixed(0)}deg (was: ${before.join('; ')})`);
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
