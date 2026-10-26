// Generates the Alloy family's card textures as pre-rendered PNG data URIs
// (printed as JSON) for --card-texture in src/index.css. PNG, not SVG
// filters: Android's WebView corrupts SVG-filter tiles (see
// generate-film-grain.mjs, Silver Screen). Seeded, so output is stable.
//
//   brushed  Brushed Aluminium (light): fine horizontal streaks, dark, <= 6%
//   anodised Anodised Teal/Red (dark): a fine satin speckle, white, <= 5%
//   foil     Gold Foil (dark): diagonal crinkle highlights, white, <= 8%
//
// Alphas stay low so every text contrast in those themes is unaffected in
// practice (the tests check colours without texture; these only lighten or
// darken a card by a few percent at their strongest point).
//
//   node scripts/generate-alloy-textures.mjs
import { png, seeded } from './png-tile.mjs';

const SIZE = 128;

// Brushed: each row gets its own streak strength, smeared along x, so it
// reads as fine horizontal brushing marks. Dark marks on a light card.
const brushed = (() => {
  const rand = seeded(0xa1);
  const rows = Array.from({ length: SIZE }, () => rand());
  const MAX = Math.floor(0.06 * 255);
  return png(SIZE, SIZE, (x, y) => {
    const streak = rows[y] * 0.75 + rand() * 0.25;
    return [0, Math.round(streak * MAX)];
  });
})();

// Anodised: a fine, even satin speckle. Light points on a dark card.
const anodised = (() => {
  const rand = seeded(0xa2);
  const MAX = Math.floor(0.05 * 255);
  return png(SIZE, SIZE, () => [255, Math.round(((rand() + rand()) / 2) * MAX)]);
})();

// Foil: soft diagonal ridges (two crossing frequencies) plus speckle, the
// crinkle of hot-foil stamping. Light highlights on a dark card.
const foil = (() => {
  const rand = seeded(0xa3);
  const MAX = Math.floor(0.08 * 255);
  const tau = Math.PI * 2;
  return png(SIZE, SIZE, (x, y) => {
    const ridge = 0.5 + 0.25 * Math.sin(((x + y) / SIZE) * tau * 6) + 0.25 * Math.sin(((x - 2 * y) / SIZE) * tau * 3);
    const v = Math.max(0, Math.min(1, ridge * 0.8 + rand() * 0.2));
    return [255, Math.round(v * v * MAX)];
  });
})();

process.stdout.write(JSON.stringify({ brushed, anodised, foil }));
