// Re-tunes theme rarity gauges (--breakdown-common ... -legendary in
// src/index.css) that break the gauge rules in src/lib/rampColour.js
// (rampProblems): adjacent tiers >= 8 apart (deltaE-OK), in normal vision on
// every theme and also under simulated protanopia and deuteranopia on dark
// themes; contrast against --card rising from >= 2:1; Legendary the most
// colourful tier (dark) or at least as colourful as Common (light).
// Ramps that already pass are left exactly as they are.
//
// How: separation is carried mainly by lightness, stepping away from the
// card (lighter on dark themes, darker on light ones). Each tier keeps its
// theme's hue, with at most MAX_DRIFT degrees of drift towards Legendary.
// A search tries where Common starts, how far and how evenly the ramp
// travels in lightness, and how colourfulness climbs; of the candidates
// that pass every rule, the one closest to the original ramp wins. A theme
// with no passing candidate is left unchanged and reported.
//
//   node scripts/tune-rarity-ramps.mjs                    report only
//   node scripts/tune-rarity-ramps.mjs --write            rewrite src/index.css
//   CSS_OUT=path node scripts/... --write                 write a preview copy
import { readFileSync, writeFileSync } from 'node:fs';
import {
  STEPS, parseHsl, formatHsl, hslToRgb, rgbToHsl, srgbToOklab, oklabToSrgb,
  inGamut, contrast, deltaEOk, isDarkCard, rampProblems,
} from '../src/lib/rampColour.js';

const CSS_PATH = 'src/index.css';
const MAX_DRIFT = 30;
const DRIFTS = [0, 15, -15, 30, -30].filter((d) => Math.abs(d) <= MAX_DRIFT);

const css = readFileSync(CSS_PATH, 'utf8');
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

const rgbOf = (hsl) => hslToRgb(parseHsl(hsl));
const problemsOf = (stepsHsl, cardHsl) => rampProblems(stepsHsl.map(rgbOf), rgbOf(cardHsl));

const toLch = (rgb) => {
  const [L, a, b] = srgbToOklab(rgb);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
};
const fromLch = ({ L, C, h }) => oklabToSrgb([L, C * Math.cos(h), C * Math.sin(h)]);

// Largest chroma at (L, h) that stays inside sRGB.
function maxChroma(L, h) {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    (inGamut(fromLch({ L, C: mid, h })) ? (lo = mid) : (hi = mid));
  }
  return lo;
}

// Lightness at which hue h / chroma C reaches `ratio` against the card.
function lightnessForContrast(cardRgb, h, C, ratio, dark) {
  const cardL = srgbToOklab(cardRgb)[0];
  let lo = dark ? cardL : 0, hi = dark ? 1 : cardL;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const k = contrast(fromLch({ L: mid, C: Math.min(C, maxChroma(mid, h)), h }), cardRgb);
    if (dark) (k >= ratio ? (hi = mid) : (lo = mid));
    else (k >= ratio ? (lo = mid) : (hi = mid));
  }
  return dark ? hi : lo;
}

function tune(block) {
  const card = rgbOf(block.card);
  const dark = isDarkCard(card);
  const dir = dark ? 1 : -1;
  const origRgb = block.steps.map(rgbOf);
  const orig = origRgb.map(toLch);
  const neutral = orig.every((o) => o.C < 0.02);

  let best = null;
  for (const startRatio of [2.05, 2.2, 2.4]) {
    const L0 = lightnessForContrast(card, orig[0].h, orig[0].C, startRatio, dark);
    for (let span = 0.24; span <= 0.6 + 1e-9; span += 0.02) {
      const L4 = L0 + dir * span;
      if (L4 < 0.12 || L4 > 0.96) continue;
      for (const g of [0.8, 1, 1.25]) {
        const Ls = STEPS.map((_, i) => L0 + (L4 - L0) * (i / 4) ** g);
        for (const drift of DRIFTS) {
          const hues = STEPS.map((_, i) => orig[i].h + (drift * Math.PI / 180) * (i / 4));
          const ceilings = STEPS.map((_, i) => 0.96 * maxChroma(Ls[i], hues[i]));
          // Colourfulness as a share of each tier's own gamut ceiling, or a
          // climb capped at Legendary's ceiling (on dark themes Legendary is
          // the lightest tier, with the least room, so lower tiers stay under it).
          for (const [profile, a] of [0.45, 0.6, 0.75, 0.9].flatMap((x) => [['own', x], ['capped', x]])) {
            const steps = STEPS.map((_, i) => {
              const share = a + (1 - a) * (i / 4);
              const C = neutral ? Math.min(orig[i].C, ceilings[i])
                : profile === 'own' ? ceilings[i] * share
                : Math.min(ceilings[4] * share, ceilings[i]);
              return formatHsl(rgbToHsl(fromLch({ L: Ls[i], C, h: hues[i] })));
            });
            if (problemsOf(steps, block.card).length) continue;
            const cost = steps.reduce((acc, s, i) => acc + deltaEOk(rgbOf(s), origRgb[i]), 0);
            if (!best || cost < best.cost) best = { steps, cost, drift };
          }
        }
      }
    }
  }
  return best;
}

let out = css;
const report = [];
for (const block of [...blocks].reverse()) { // from the end, so offsets stay valid
  const before = problemsOf(block.steps, block.card);
  if (!before.length) {
    report.unshift(`ok      ${block.name}`);
    continue;
  }
  const tuned = tune(block);
  if (!tuned) {
    report.unshift(`KEPT    ${block.name}: no on-theme ramp meets every rule (${before.join('; ')})`);
    continue;
  }
  report.unshift(`tuned   ${block.name}: drift ${tuned.drift}deg, ${(tuned.cost / 5).toFixed(1)} dE/tier from the original (was: ${before.join('; ')})`);
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
