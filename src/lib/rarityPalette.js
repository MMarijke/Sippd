// "Colour-blind-friendly rarity colours" (Settings > Accessibility).
//
// When on, <html data-rarity="colour-blind"> swaps every theme's rarity
// gauge for one fixed ramp (index.css) that stays >= 8 apart between tiers
// under protanopia and deuteranopia on every theme's card. Theme ramps only
// guarantee that on dark themes; see src/lib/rampColour.js (rampProblems).
//
// A per-device preference, like the rest of Settings' Preferences: it's
// stored in this browser/app only, and applied before the first render
// (main.jsx) so the gauge never flashes the theme's own colours first.

const KEY = 'sippd-rarity-palette';
export const COLOUR_BLIND = 'colour-blind';

export function readRarityPalette() {
  try {
    return localStorage.getItem(KEY) === COLOUR_BLIND ? COLOUR_BLIND : 'theme';
  } catch {
    return 'theme'; // storage blocked: the theme's own gauge
  }
}

export function applyRarityPalette(value = readRarityPalette()) {
  const root = document.documentElement;
  if (value === COLOUR_BLIND) root.dataset.rarity = COLOUR_BLIND;
  else delete root.dataset.rarity;
}

export function setRarityPalette(value) {
  try {
    if (value === COLOUR_BLIND) localStorage.setItem(KEY, COLOUR_BLIND);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: still applies for this session.
  }
  applyRarityPalette(value);
}
