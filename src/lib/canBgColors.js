export const DEFAULT_CAN_BG = '#0D2B2B';

// Quick-pick presets for CanBackgroundPicker — sit alongside the free-hue
// native picker rather than replacing it, so the app's own dark neon-glow
// identity still shows up first at this moment instead of handing the whole
// interaction to raw OS chrome. Hue isn't arbitrary: after "Signature" (the
// app's own brand teal), the remaining six deliberately echo the five
// --rarity-* hues in index.css in ascending order (Common's gray through
// Legendary's pink), plus one warm bonus — so picking a background can
// double as picking "the mood of my best pull," not just a random color.
export const QUICK_PICK_BG_COLORS = [
  { label: 'Signature',   hex: '#0D2B2B' },
  { label: 'Common',      hex: '#1C1C1E' },
  { label: 'Uncommon',    hex: '#0D1F0D' },
  { label: 'Rare',        hex: '#0C1D38' },
  { label: 'Ultra Rare',  hex: '#170B33' },
  { label: 'Legendary',   hex: '#2B0D1F' },
  { label: 'Ember',       hex: '#2B0F0F' },
  // Trophy Case exclusives — same dark-safe lightness band as the free
  // swatches above, just hues none of those touch (a warm gold and a cool
  // violet-black), so a Pro card visibly stands out in a mixed grid without
  // reading as an obviously different "locked" style.
  { label: 'Gilded',      hex: '#2B2408', pro: true },
  { label: 'Voidglass',   hex: '#0F0D2B', pro: true },
];

// Existing preset backgrounds (Deep Teal, Midnight Navy, etc.) all measured
// 9-14% lightness — dark enough to keep white/light foreground text and can
// art readable when used as a tile/card background across the app
// (CanCard, CollectionCard, TradeHistory, MonthlyReport's recap card, ...).
// Replaced by a free-hue color picker (CanBackgroundPicker.jsx); this clamp
// is what keeps a user-picked color from landing somewhere that breaks that
// same contrast guarantee — hue and saturation stay whatever the user
// picked, only lightness gets pulled back into the same safe band the old
// presets already lived in.
const MIN_LIGHTNESS = 6;
const MAX_LIGHTNESS = 18;

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = n => Math.round(255 * f(n)).toString(16).padStart(2, '0');
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

// Takes any #rrggbb the native <input type="color"> can produce and pulls
// its lightness back into the same dark-safe band the old fixed presets
// occupied, so a freely-chosen hue can never end up too light to read
// through as a card background.
export function clampToDarkSafeBg(hex) {
  const [h, s, l] = hexToHsl(hex);
  const clampedL = Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, l));
  return hslToHex(h, s, clampedL);
}
