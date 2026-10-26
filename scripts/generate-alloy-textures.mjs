// Generates the Alloy family's card textures as pre-rendered PNG data URIs
// (printed as JSON) for --card-texture in src/index.css. PNG, not SVG
// filters: Android's WebView corrupts SVG-filter tiles (see
// generate-film-grain.mjs, Silver Screen). Seeded, so output is stable.
//
//   brushed  Brushed Aluminium (light): fine horizontal streaks, dark, <= 6%
//   anodised Anodised Teal/Red (dark): a fine satin speckle, white, <= 5%
//   foil     Gold Foil (dark): wavering diagonal folds, white, <= 5%
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

// Foil: one family of diagonal folds, wavered by a slow sweep across them,
// plus a little speckle: the crinkle of hot-foil stamping. Light highlights
// on a dark card. (It used to be two crossing sine ridges at 8%, whose
// crossings read as a transparency checkerboard at 1x; /impeccable critique,
// 2026-10-26.) Whole-number frequencies, so the tile still repeats seamlessly.
const foil = (() => {
  const rand = seeded(0xa3);
  const MAX = Math.floor(0.05 * 255);
  const tau = Math.PI * 2;
  return png(SIZE, SIZE, (x, y) => {
    const sweep = 1.6 * Math.sin(((x - y) / SIZE) * tau);
    const fold = 0.5 + 0.5 * Math.sin(((x + y) / SIZE) * tau * 4 + sweep);
    const v = Math.max(0, Math.min(1, fold * 0.85 + rand() * 0.15));
    return [255, Math.round(v * v * v * MAX)];
  });
})();

process.stdout.write(JSON.stringify({ brushed, anodised, foil }));
