// user_collection.can_bg_color's default, meaning "wear the rarity" (see
// tileBackground). So does any other value that isn't a `hue:` pick: old
// hex picks from the retired picker are deliberately not revived.
export const DEFAULT_CAN_BG = '#0D2B2B';

// A can tile wears its rarity. It used to wear a colour its owner picked,
// which broke two ways (/impeccable critique): picked colours were clamped
// dark, so on light themes they became black blocks, and the badges drawn on
// top (rarity, VAULT, LOW CONF., star) take theme colours, so a dark or
// saturated pick made them unreadable. A preset literally named "Legendary"
// could also sit behind a COMMON badge.
//
// The tile is the card surface washed with the rarity's own hue, which works
// on both polarities: a dark tint on dark themes, a pastel on light ones, and
// the badges keep the contrast they were tuned for on the card. The wash
// grows with the tier, so a Legendary tile glows more than a Common one.
//
// Written as a gradient layer over the card colour rather than color-mix():
// html2canvas (the recap image export) can't parse color-mix(), but reads
// hsl()/rgba() gradients. Inline var()s, so it follows a [data-theme] preview.
const RARITY_TOKEN = {
  'common': ['common', 0.10],
  'uncommon': ['uncommon', 0.14],
  'rare': ['rare', 0.16],
  'ultra rare': ['ultra', 0.20],
  'legendary': ['legendary', 0.24],
};

// Tint of `hsl(var(--<token>))` at `alpha` over the card surface.
function wash(token, alpha) {
  const layer = `hsl(var(--${token}) / ${alpha})`;
  return `linear-gradient(${layer}, ${layer}), hsl(var(--card))`;
}

// Unrated or unknown rarity: a faint neutral wash of the text colour. It
// used to be the theme's accent, which in Power-Up (green) made an unrated
// '? ? ?' tile look Uncommon; a tile only carries a hue once it has a rarity.
export const UNRATED_CAN_BG = wash('foreground', 0.06);

// Accepts the app's display names ("Ultra Rare") and stored variants
// ("ultra_rare", "ULTRA RARE"). Use as a `background` shorthand value.
export function rarityTileBackground(rarity) {
  const key = String(rarity ?? '').trim().toLowerCase().replace(/_/g, ' ');
  const entry = RARITY_TOKEN[key];
  return entry ? wash(`rarity-${entry[0]}`, entry[1]) : UNRATED_CAN_BG;
}

// ── Custom tile colour ───────────────────────────────────────────────────
// A collector can give a can its own tile colour instead of its rarity's.
// Only a HUE is chosen, never a finished colour: it's laid over the card as
// the same kind of wash the rarity tiles use, at a fixed strength, so it
// comes out a dark tint on dark themes and a pastel on light ones, and the
// theme-coloured badges on top keep their contrast. (The retired picker
// stored finished hex colours, which became black blocks on light themes.)
// Stored in can_bg_color as 'hue:<0-359>'.
export const HUE_PREFIX = 'hue:';

// Mid-lightness, high-chroma source colour; the wash strength sits between
// the Rare and Ultra Rare tiers so a picked tile reads as clearly as a
// rarity tile without out-glowing a Legendary one.
const HUE_SAT = 85;
const HUE_LIGHT = 55;
export const HUE_WASH_ALPHA = 0.18;

// Quick picks, ordered round the wheel. Custom covers every other hue.
export const TILE_HUES = [
  { label: 'Red', hue: 0 },
  { label: 'Orange', hue: 25 },
  { label: 'Gold', hue: 45 },
  { label: 'Lime', hue: 85 },
  { label: 'Green', hue: 140 },
  { label: 'Teal', hue: 175 },
  { label: 'Blue', hue: 215 },
  { label: 'Violet', hue: 265 },
  { label: 'Pink', hue: 320 },
];

export const hueValue = hue => `${HUE_PREFIX}${((Math.round(hue) % 360) + 360) % 360}`;

// The picked hue, or null for "wear the rarity" (unset, the default, an old
// hex pick, or anything malformed).
export function parseTileHue(value) {
  const m = typeof value === 'string' && value.match(/^hue:(\d{1,3})$/);
  if (!m) return null;
  const hue = Number(m[1]);
  return hue < 360 ? hue : null;
}

// The swatch colour itself (for picker chips and the hue slider thumb).
export const hueSwatch = hue => `hsl(${hue} ${HUE_SAT}% ${HUE_LIGHT}%)`;

export function hueTileBackground(hue) {
  const layer = `hsl(${hue} ${HUE_SAT}% ${HUE_LIGHT}% / ${HUE_WASH_ALPHA})`;
  return `linear-gradient(${layer}, ${layer}), hsl(var(--card))`;
}

// What every collection tile paints: the collector's picked hue if there
// is one, else the rarity wash. Use as a `background` shorthand value.
export function tileBackground(rarity, canBg) {
  const hue = parseTileHue(canBg);
  return hue == null ? rarityTileBackground(rarity) : hueTileBackground(hue);
}
