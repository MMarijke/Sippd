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
import { deflateSync } from 'node:zlib';

function png(size, pixel) {
  const raw = Buffer.alloc(size * (1 + size * 2));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 2);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [grey, alpha] = pixel(x, y);
      raw[row + 1 + x * 2] = grey;
      raw[row + 2 + x * 2] = alpha;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 4; // 8-bit greyscale + alpha
  return `data:image/png;base64,${Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')}`;
}

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

const SIZE = 128;

// Brushed: each row gets its own streak strength, smeared along x, so it
// reads as fine horizontal brushing marks. Dark marks on a light card.
const brushed = (() => {
  const rand = seeded(0xa1);
  const rows = Array.from({ length: SIZE }, () => rand());
  const MAX = Math.floor(0.06 * 255);
  return png(SIZE, (x, y) => {
    const streak = rows[y] * 0.75 + rand() * 0.25;
    return [0, Math.round(streak * MAX)];
  });
})();

// Anodised: a fine, even satin speckle. Light points on a dark card.
const anodised = (() => {
  const rand = seeded(0xa2);
  const MAX = Math.floor(0.05 * 255);
  return png(SIZE, () => [255, Math.round(((rand() + rand()) / 2) * MAX)]);
})();

// Foil: soft diagonal ridges (two crossing frequencies) plus speckle, the
// crinkle of hot-foil stamping. Light highlights on a dark card.
const foil = (() => {
  const rand = seeded(0xa3);
  const MAX = Math.floor(0.08 * 255);
  const tau = Math.PI * 2;
  return png(SIZE, (x, y) => {
    const ridge = 0.5 + 0.25 * Math.sin(((x + y) / SIZE) * tau * 6) + 0.25 * Math.sin(((x - 2 * y) / SIZE) * tau * 3);
    const v = Math.max(0, Math.min(1, ridge * 0.8 + rand() * 0.2));
    return [255, Math.round(v * v * MAX)];
  });
})();

process.stdout.write(JSON.stringify({ brushed, anodised, foil }));
