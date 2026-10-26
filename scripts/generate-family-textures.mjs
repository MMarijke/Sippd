// Generates each family's card texture as a PNG data URI (printed as JSON)
// for --card-texture in src/index.css: the texture axis of the per-family
// structure (corners, border weight, texture, lift, number face). PNG, not
// SVG filters: Android's WebView corrupts SVG-filter tiles (see
// generate-film-grain.mjs, Silver Screen). Seeded, so output is stable.
//
//   scanDark / scanLight  Neon Arcade: CRT scanlines, one line every 3px
//   stars                 Cosmic: a sparse starfield
//   paperLight / paperDark Botanical: laid paper, faint chain lines + fibre
//   grain                 Noir: fine photographic grain
//   riso                  Spring: risograph speckle
//   halftone              Soda Fountain: a 45-degree halftone dot screen
//
// Every alpha stays at or under 7%, so a texture shifts a card's colour by a
// few percent at its strongest point and text contrast holds (the tests
// check colours without texture). Candy and Alloy don't use
// these: Candy is smooth, Alloy has its own metals
// (generate-alloy-textures.mjs).
//
//   node scripts/generate-family-textures.mjs
import { png, seeded } from './png-tile.mjs';

const a = (share) => Math.round(share * 255);
const SIZE = 128;

// Scanlines: one 1px line in every 3, light on dark cards, dark on light.
const scanDark = png(2, 3, (x, y) => [255, y === 0 ? a(0.045) : 0]);
const scanLight = png(2, 3, (x, y) => [0, y === 0 ? a(0.035) : 0]);

// Stars: about 1 pixel in 180 lit, brightness skewed toward faint, with the
// odd brighter star.
const stars = (() => {
  const rand = seeded(0xc1);
  return png(SIZE, SIZE, () => {
    if (rand() > 1 / 180) return [255, 0];
    const v = rand();
    return [255, a(0.02 + 0.05 * v * v)];
  });
})();

// Laid paper: vertical chain lines every 16px, horizontal laid lines every
// 2px, and a soft fibre noise.
const paper = (ink, seed) => {
  const rand = seeded(seed);
  return png(SIZE, SIZE, (x, y) => {
    const chain = x % 16 === 0 ? 0.025 : 0;
    const laid = y % 2 === 0 ? 0.008 : 0;
    const fibre = rand() * rand() * 0.03;
    return [ink, a(Math.min(0.06, chain + laid + fibre))];
  });
};
const paperLight = paper(40, 0xb1);
const paperDark = paper(255, 0xb2);

// Grain: dense, fine, even; light points on Noir's dark cards.
const grain = (() => {
  const rand = seeded(0xd1);
  return png(SIZE, SIZE, () => [255, a(((rand() + rand() + rand()) / 3) * 0.06)]);
})();

// Riso: sparse ink specks over a faint tooth, dark on Spring's light cards.
const riso = (() => {
  const rand = seeded(0xe1);
  return png(SIZE, SIZE, () => {
    const tooth = rand() * 0.015;
    const speck = rand() < 1 / 60 ? 0.03 + rand() * 0.04 : 0;
    return [30, a(Math.min(0.07, tooth + speck))];
  });
})();

// Halftone: anti-aliased dots on a 45-degree screen (dots at the tile's
// corners and centre), light on Soda Fountain's dark cards.
const halftone = (() => {
  const CELL = 8;
  const R = 1.35;
  const centres = [[0, 0], [CELL, 0], [0, CELL], [CELL, CELL], [CELL / 2, CELL / 2]];
  return png(CELL, CELL, (x, y) => {
    const d = Math.min(...centres.map(([cx, cy]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy)));
    const cover = Math.max(0, Math.min(1, R + 0.5 - d));
    return [255, a(cover * 0.06)];
  });
})();

process.stdout.write(JSON.stringify({ scanDark, scanLight, stars, paperLight, paperDark, grain, riso, halftone }));
