// Generates every app icon and splash image from one square source image
// (resources/icon-source.jpg: the mark centred on its own dark background).
//
//   node scripts/generate-icons.mjs
//
// Re-run after replacing the source. Crops are relative to the source size,
// so a re-exported source at another resolution still works.
//
// sharp is not a declared dependency (it resolves transitively today); if the
// import fails, install it first. android/ is gitignored, so after a fresh
// `npx cap add android` re-run this and set ic_launcher_background to BG.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SOURCE = 'resources/icon-source.jpg';
// The source's own background, for anything that needs a solid backing.
const BG = '#212429';
const RES = 'android/app/src/main/res';

// Square crops centred on the mark, as a fraction of the source side. The
// mark spans ~40% of the source. tight: icons shown as-is (~67% mark).
// maskable: Android/PWA masks keep the inner 80% circle. adaptive: Android's
// adaptive foreground keeps a 61% safe circle.
const CROPS = { tight: 0.59, maskable: 0.75, adaptive: 0.86 };
const CENTRE = { x: 0.5, y: 0.508 };

const meta = await sharp(SOURCE).metadata();
const side = Math.min(meta.width, meta.height);

function crop(kind) {
  const size = Math.round(side * CROPS[kind]);
  const left = Math.round(meta.width * CENTRE.x - size / 2);
  const top = Math.round(meta.height * CENTRE.y - size / 2);
  return sharp(SOURCE).extract({ left, top, width: size, height: size });
}

async function out(path, pipeline) {
  mkdirSync(dirname(path), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(path);
  console.log('wrote', path);
}

const roundedMask = (s, r) => Buffer.from(`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${r}" ry="${r}"/></svg>`);
const circleMask = s => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);

// ── Web (public/) ───────────────────────────────────────────────────────────
for (const s of [16, 32, 48]) await out(`public/favicon-${s}.png`, crop('tight').resize(s, s));
await out('public/apple-touch-icon.png', crop('tight').resize(180, 180));
await out('public/icon-192.png', crop('tight').resize(192, 192));
await out('public/icon-512.png', crop('tight').resize(512, 512));
await out('public/icon-maskable-512.png', crop('maskable').resize(512, 512));

// ── Android launcher icons ──────────────────────────────────────────────────
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, m] of Object.entries(DENSITIES)) {
  const legacy = Math.round(48 * m);
  const tight = await crop('tight').resize(legacy, legacy).png().toBuffer();
  await out(`${RES}/mipmap-${d}/ic_launcher.png`,
    sharp(tight).composite([{ input: roundedMask(legacy, Math.round(legacy * 0.18)), blend: 'dest-in' }]));
  const round = await crop('maskable').resize(legacy, legacy).png().toBuffer();
  await out(`${RES}/mipmap-${d}/ic_launcher_round.png`,
    sharp(round).composite([{ input: circleMask(legacy), blend: 'dest-in' }]));
  const fg = Math.round(108 * m);
  await out(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, crop('adaptive').resize(fg, fg));
}

// ── Android splash (portrait/landscape × density, plus the default) ─────────
const SPLASH = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480], ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280],
];
for (const [dir, w, h] of SPLASH) {
  const mark = Math.round(Math.min(w, h) * 0.55);
  // Feather the crop's edge so the source's vignette fades into the flat BG
  // instead of showing as a square.
  const feather = Buffer.from(`<svg width="${mark}" height="${mark}"><defs><radialGradient id="f"><stop offset="0.6" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${mark}" height="${mark}" fill="url(#f)"/></svg>`);
  const art = await crop('adaptive').resize(mark, mark).ensureAlpha()
    .composite([{ input: feather, blend: 'dest-in' }]).png().toBuffer();
  await out(`${RES}/${dir}/splash.png`,
    sharp({ create: { width: w, height: h, channels: 3, background: BG } })
      .composite([{ input: art, gravity: 'centre' }]));
}

console.log(`\nbackground colour for adaptive icon / manifest: ${BG}`);
