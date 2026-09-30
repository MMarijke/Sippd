// What AddCanForm still writes into user_collection.can_bg_color. Tiles no
// longer read that column (see rarityTileBackground); it stays written so
// the column keeps a value and older rows are left untouched.
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

// Unrated or unknown rarity: the theme's own accent, as before.
export const THEME_CAN_BG = wash('primary', 0.18);

// Accepts the app's display names ("Ultra Rare") and stored variants
// ("ultra_rare", "ULTRA RARE"). Use as a `background` shorthand value.
export function rarityTileBackground(rarity) {
  const key = String(rarity ?? '').trim().toLowerCase().replace(/_/g, ' ');
  const entry = RARITY_TOKEN[key];
  return entry ? wash(`rarity-${entry[0]}`, entry[1]) : THEME_CAN_BG;
}
