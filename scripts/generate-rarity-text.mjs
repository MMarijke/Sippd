// Writes each theme's rarity TEXT colours (--rarity-common-text ...
// -legendary-text in src/index.css): the tier's own gauge colour
// (--breakdown-*, which the rarity fills, borders and glows now use too),
// same OKLCH hue and chroma, with lightness moved away from the card until
// it reads at >= MIN_TEXT against the page, the card and a badge's own
// tinted fill (the tier at 20% over each). Also the colour-blind override's
// text, checked against every card of its tone.
//
// Re-run after re-tuning any gauge (scripts/tune-rarity-ramps.mjs):
//   node scripts/generate-rarity-text.mjs --write
import { readFileSync, writeFileSync } from 'node:fs';
import { themeRenderings, cssRules, resolveTokens } from '../src/lib/themeTokens.js';
import {
  STEPS, parseHsl, formatHsl, hslToRgb, rgbToHsl, srgbToOklab, oklabToSrgb, inGamut, contrast, isDarkCard,
} from '../src/lib/rampColour.js';

const CSS_PATH = 'src/index.css';
const MIN_TEXT = 4.6;
let css = readFileSync(CSS_PATH, 'utf8');
const rules = cssRules(css);
const renderings = themeRenderings(readFileSync('src/hooks/useTheme.js', 'utf8'));
const rgb = (v) => hslToRgb(parseHsl(v));
const over = (c, base, a) => c.map((x, i) => x * a + base[i] * (1 - a));

function textFor(tier, surfaces, dark) {
  const [L0, a, b] = srgbToOklab(tier);
  const C0 = Math.hypot(a, b), h = Math.atan2(b, a);
  const at = (L) => {
    let C = C0, c;
    do { c = oklabToSrgb([L, C * Math.cos(h), C * Math.sin(h)]); C -= 0.004; } while (!inGamut(c) && C > 0);
    return c.map((v) => Math.min(1, Math.max(0, v)));
  };
  const reads = (c) => surfaces(tier).every((s) => contrast(c, s) >= MIN_TEXT);
  for (let L = L0; L >= 0 && L <= 1; L += dark ? 0.005 : -0.005) {
    const c = at(L);
    if (reads(c)) return c;
  }
  throw new Error('no legible shade');
}

const setText = (body, values) => {
  let out = body;
  for (const [i, s] of STEPS.entries()) {
    const line = `--rarity-${s}-text: ${values[i]};`;
    out = new RegExp(`--rarity-${s}-text:`).test(out)
      ? out.replace(new RegExp(`--rarity-${s}-text:[^;]+;`), line)
      : out.replace(/(\r?\n([ \t]*)--breakdown-legendary:[^;]+;)/, (m, all, indent) => `${all}\n${indent}${line}`);
  }
  return out;
};

// Theme colour blocks: every block with both a gauge and a card.
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)]
  .filter((m) => /--card:/.test(m[2]))
  .map((m) => ({ name: m[1].trim().split(/\r?\n/).pop().trim(), start: m.index + m[0].indexOf('{') + 1, body: m[2] }));

let out = css;
for (const block of [...blocks].reverse()) {
  const id = block.name.match(/data-theme="([^"]+)"/)?.[1] ?? 'power-up';
  const pol = block.name.match(/data-polarity="([^"]+)"/)?.[1];
  const r = renderings.find((x) => x.id === id && (!pol || x.polarity === pol));
  const get = resolveTokens(rules, r);
  const card = rgb(get('--card')), bg = rgb(get('--background'));
  const dark = isDarkCard(card);
  const surfaces = (t) => [card, bg, over(t, card, 0.2), over(t, bg, 0.2)];
  const texts = STEPS.map((s) => formatHsl(rgbToHsl(textFor(rgb(get(`--breakdown-${s}`)), surfaces, dark))));
  const body = setText(block.body, texts);
  out = out.slice(0, block.start) + body + out.slice(block.start + block.body.length);
}

// The colour-blind override: one text shade per tier per tone, legible on
// every card of that tone.
for (const [sel, wantDark] of [[':root[data-rarity="colour-blind"] {', true], [':root[data-rarity="colour-blind"][data-tone="light"] {', false]]) {
  const at = out.indexOf(sel), end = out.indexOf('}', at);
  const body = out.slice(at, end);
  const tones = renderings.map((r) => resolveTokens(rules, r)).filter((g) => isDarkCard(rgb(g('--card'))) === wantDark);
  const surfaces = (t) => tones.flatMap((g) => { const c = rgb(g('--card')), b = rgb(g('--background')); return [c, b, over(t, c, 0.2), over(t, b, 0.2)]; });
  const texts = STEPS.map((s) => formatHsl(rgbToHsl(textFor(rgb(body.match(new RegExp(`--breakdown-${s}:\s*([^;]+);`))[1]), surfaces, wantDark))));
  out = out.slice(0, at) + setText(body, texts) + out.slice(end);
}

console.log(`${blocks.length} theme blocks + 2 colour-blind overrides`);
if (process.argv.includes('--write')) { writeFileSync(CSS_PATH, out); console.log(`wrote ${CSS_PATH}`); }
