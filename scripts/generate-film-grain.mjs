// Generates Silver Screen's film-grain tile as a pre-rendered PNG data URI
// (printed to stdout) for --card-texture in src/index.css.
//
// Why a PNG: the grain used to be an SVG feTurbulence filter inside a
// data-URI background. Android's WebView rasterises that filter per tile on
// the GPU and, in scrolling layers and next to backdrop-filter blur,
// composited garbage tiles over Home's cards (reported 2026-10-26). A plain
// bitmap takes that code path out entirely.
//
// Same look as the SVG: white speckle whose alpha is 0.07 x a noise value in
// 0..1 (feColorMatrix "0.07 0 0 0 0" on fractalNoise), so the brightest
// grain is 7% white and the theme's "muted text >= 6:1" guarantee holds.
// Seeded, so re-running gives the identical tile.
//
//   node scripts/generate-film-grain.mjs
import { deflateSync } from 'node:zlib';

const SIZE = 128;
const MAX_ALPHA = Math.floor(0.07 * 255); // 17: never brighter than 7% white

let seed = 0x5133d; // deterministic
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
// Roughly bell-shaped around 0.5, like fractal noise: mean of three uniforms.
const noise = () => (rand() + rand() + rand()) / 3;

// Raw scanlines: filter byte 0, then gray+alpha pairs (gray fixed at white).
const raw = Buffer.alloc(SIZE * (1 + SIZE * 2));
for (let y = 0; y < SIZE; y++) {
  const row = y * (1 + SIZE * 2);
  raw[row] = 0;
  for (let x = 0; x < SIZE; x++) {
    raw[row + 1 + x * 2] = 255;
    raw[row + 2 + x * 2] = Math.min(MAX_ALPHA, Math.round(noise() * MAX_ALPHA));
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
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 4; // colour type: greyscale + alpha
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

process.stdout.write(`data:image/png;base64,${png.toString('base64')}`);
