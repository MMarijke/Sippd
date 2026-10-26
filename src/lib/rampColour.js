// Colour maths for the rarity gauge (--breakdown-* in index.css): HSL
// triples <-> sRGB, OKLab, WCAG contrast, CIELAB chroma, and colour-vision
// deficiency simulation. Shared by src/lib/breakdownRamps.test.js (which
// guards the gauge rules) and scripts/tune-rarity-ramps.mjs (which tunes
// the ramps to meet them), so both measure exactly the same way.

export const STEPS = ['common', 'uncommon', 'rare', 'ultra', 'legendary'];

// Adjacent rarity tiers must be at least this far apart (deltaE-OK x100)
// in normal vision and under simulated protanopia and deuteranopia.
export const MIN_STEP = 8;

export const parseHsl = (v) => v.trim().replace(/%/g, '').split(/\s+/).map(Number);
export const formatHsl = ([h, s, l]) => `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;

export function hslToRgb([h, s, l]) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
}

export function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60) % 360, s * 100, l * 100];
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function srgbToOklab(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// Unclamped (may fall outside 0..1); see inGamut.
export function oklabToSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => (c < 0 ? -toGamma(-c) : toGamma(c)));
}

export const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

export function luminance(rgb) {
  return rgb.map(toLinear).reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// CIELAB chroma (D65), the "colourfulness" the gauge rule measures.
export function labChroma(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return Math.hypot(500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)));
}

// Machado, Oliveira & Fernandes (2009), severity 1.0, in linear RGB.
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};

export function simulate(rgb, vision) {
  if (vision === 'normal') return rgb;
  const lin = rgb.map(toLinear);
  return CVD[vision].map((row) => toGamma(Math.min(1, Math.max(0, row.reduce((acc, k, i) => acc + k * lin[i], 0)))));
}

export const deltaEOk = (a, b) => {
  const [p, q] = [srgbToOklab(a), srgbToOklab(b)];
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

// deltaE-OK between each pair of adjacent tiers, as seen with `vision`.
export function adjacentSteps(rgbs, vision = 'normal') {
  const seen = rgbs.map((c) => simulate(c, vision));
  return seen.slice(1).map((c, i) => deltaEOk(seen[i], c));
}

export const isDarkCard = (cardRgb) => srgbToOklab(cardRgb)[0] < 0.5;

// The gauge rules for one theme's ramp (sRGB tiers, Common first) on its
// card. Returns the list of broken rules (empty = passes).
//
// Every theme (2026-10-26, /impeccable colorize):
// - Common reads at >= MIN_COMMON (3:1, the graphics floor) against the
//   card, and contrast rises at every tier from there;
// - adjacent tiers are >= MIN_STEP apart in normal vision;
// - Legendary is the most colourful tier: the peak in colour as well as in
//   contrast. Neutral ramps (Carbon, Silver Screen) pass as a tie: every
//   tier there has ~0 colour, by design;
// - with `scan` (the theme's Scan fill, --cta): every tier is >= MIN_SCAN_GAP
//   from it, so the app's main action never reads as a rarity colour.
//
// Dark themes also: >= MIN_STEP apart under simulated protanopia and
// deuteranopia, and colourfulness may dip by at most 4 between tiers. On a
// light card colour-blind users get the fixed ramp from the "colour-blind-
// friendly rarity colours" setting instead (index.css,
// [data-rarity="colour-blind"]), which meets the dark-theme rules on every
// light card.
export const MIN_COMMON = 3;
export const MIN_SCAN_GAP = 10;

export function rampProblems(stepRgbs, cardRgb, { scan } = {}) {
  const problems = [];
  const K = stepRgbs.map((c) => contrast(c, cardRgb));
  const C = stepRgbs.map(labChroma);
  if (K[0] < MIN_COMMON) problems.push(`Common only ${K[0].toFixed(2)}:1 against the card`);
  for (let i = 1; i < 5; i++) if (!(K[i] > K[i - 1])) problems.push(`contrast does not rise at ${STEPS[i]}`);

  if (C[4] < Math.max(...C) - 0.5) problems.push('Legendary is not the most colourful tier');
  const dark = isDarkCard(cardRgb);
  if (dark && Math.max(...C) >= 8) {
    for (let i = 1; i < 5; i++) if (C[i] < C[i - 1] - 4) problems.push(`colourfulness drops at ${STEPS[i]}`);
  }

  if (scan) {
    const gaps = stepRgbs.map((c) => deltaEOk(c, scan));
    const i = gaps.indexOf(Math.min(...gaps));
    if (gaps[i] < MIN_SCAN_GAP) problems.push(`${STEPS[i]} only ${gaps[i].toFixed(1)} from Scan`);
  }

  for (const vision of dark ? ['normal', 'protan', 'deutan'] : ['normal']) {
    const min = Math.min(...adjacentSteps(stepRgbs, vision));
    if (min < MIN_STEP) problems.push(`${vision} smallest step ${min.toFixed(1)} (< ${MIN_STEP})`);
  }
  return problems;
}
