// How different two theme renderings look: the weighted mean deltaE-OK
// (OKLab x100) over the colours a user actually sees on every screen. The
// page background and the button fill (Scan, Save) carry most of a theme's
// identity, so they weigh most; the card and the supporting accent next;
// each rarity gauge tier a little. Same measure the theme catalogue
// critique used (2026-10-26).
import { STEPS, deltaEOk, hslToRgb, parseHsl } from './rampColour.js';

export const THEME_DISTANCE_WEIGHTS = {
  background: 3,
  fill: 3,
  card: 1.5,
  accent: 1.5,
  ...Object.fromEntries(STEPS.map((s) => [`breakdown-${s}`, 0.5])),
};

// get: a resolveTokens() getter. Returns { token: sRGB } for the measured set.
export function themeColours(get) {
  const rgb = (name) => hslToRgb(parseHsl(get(name)));
  return {
    background: rgb('--background'),
    fill: rgb(get('--primary-fill') ? '--primary-fill' : '--primary'),
    card: rgb('--card'),
    accent: rgb('--accent'),
    ...Object.fromEntries(STEPS.map((s) => [`breakdown-${s}`, rgb(`--breakdown-${s}`)])),
  };
}

export function themeDistance(a, b) {
  let sum = 0, weight = 0;
  for (const [token, w] of Object.entries(THEME_DISTANCE_WEIGHTS)) {
    sum += w * deltaEOk(a[token], b[token]);
    weight += w;
  }
  return sum / weight;
}

// Per-token deltaE-OK, for explaining why two themes are close.
export function themeDistanceBreakdown(a, b) {
  return Object.fromEntries(Object.keys(THEME_DISTANCE_WEIGHTS).map((t) => [t, deltaEOk(a[t], b[t])]));
}
