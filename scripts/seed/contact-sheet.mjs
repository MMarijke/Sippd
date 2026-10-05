// Before/after contact sheet for scripts/seed/bg_removal.py's output, drawn
// with the app's own tiles: the built CSS (theme tokens) and
// rarityTileBackground from src/lib/canBgColors.js, in the same markup as
// CanCard's square tile (image contained on a rarity wash) and
// CanListItem's 48px thumb (image cropped to fill, on bg-secondary).
//
// Every sampled can gets one row, pass or fail, in Power-Up dark and light:
//   before  OFF's own photo on the unrated tile (what a seeded can shows
//           without background removal)
//   after   the isolated can on the unrated, Rare and Legendary tiles, and
//           in a list-row thumb
//
//   node scripts/seed/contact-sheet.mjs <out_dir>   (after `npm run build`)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { rarityTileBackground } from '../../src/lib/canBgColors.js';

const out = path.resolve(process.argv[2] ?? 'scripts/seed/out');
const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
const assets = path.resolve('dist/assets');
const css = fs.readdirSync(assets).filter(f => f.endsWith('.css'))
  .map(f => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');

// Layout is inline: the built CSS only carries the utility classes the app
// itself uses. Colours are the theme's own tokens, so they follow the theme.
const tok = name => `hsl(var(--${name}))`;
const MONO = 'font-family:ui-monospace,monospace';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (file, fit) => `<img src="${file}" style="width:100%;height:100%;object-fit:${fit};display:block" alt="">`;
const caption = text => `<figcaption style="margin-top:4px;font-size:11px;${MONO};color:${tok('muted-foreground')}">${text}</figcaption>`;
// CanCard: square tile, 1rem radius, image contained on the rarity wash.
const tile = (file, rarity, label) => `
  <figure style="margin:0;width:128px">
    <div style="width:128px;height:128px;border-radius:16px;overflow:hidden;border:1px solid ${tok('border')};background:${rarityTileBackground(rarity)}">${img(file, 'contain')}</div>
    ${caption(label)}
  </figure>`;
// CanListItem: 48px thumb, image cropped to fill, on bg-secondary.
const thumb = file => `
  <figure style="margin:0">
    <div style="width:48px;height:48px;border-radius:8px;overflow:hidden;background:${tok('secondary')}">${img(file, 'cover')}</div>
    ${caption('list row')}
  </figure>`;

const fmt = r => [
  `source ${r.source}`, `coverage ${r.coverage}`, `main shape ${r.main_shape}`,
  `edges ${r.edges_touched?.length ? r.edges_touched.join('+') : 'none'}`,
  `halo ${r.halo}`, `aspect ${r.aspect}`, `can ${r.can_px}`, `${r.seconds}s`,
].join(' · ');

const rows = report.items.map(r => {
  const n = String(r.n).padStart(2, '0');
  const ok = r.verdict === 'pass';
  return `
  <section style="padding:16px 0;border-bottom:1px solid ${tok('border')}">
    <p style="margin:0;font-size:14px;font-weight:600">${r.n}. ${esc(r.brand) || '<i>no brand</i>'} | ${esc(r.name) || '<i>no name</i>'} ${r.quantity ? `| ${esc(r.quantity)}` : ''} <span style="${MONO};font-size:11px;color:${tok('muted-foreground')}">${r.code}</span></p>
    <p style="margin:4px 0 0;font-size:12px;${MONO};font-weight:600;color:${ok ? tok('primary') : tok('destructive')}">${ok ? 'PASS' : `FALLBACK TO ORIGINAL: failed ${r.failed.join(', ')}`}</p>
    <p style="margin:2px 0 0;font-size:11px;${MONO};color:${tok('muted-foreground')}">${fmt(r)}${r.used === 'full' ? '' : ` · used ${esc(r.used)}`}</p>
    <div style="display:flex;gap:12px;margin-top:12px;align-items:flex-start;flex-wrap:wrap">
      ${tile(`${n}-before.jpg`, null, 'before · unrated')}
      ${tile(`${n}-after.webp`, null, 'after · unrated')}
      ${tile(`${n}-after.webp`, 'Rare', 'after · Rare')}
      ${tile(`${n}-after.webp`, 'Legendary', 'after · Legendary')}
      ${thumb(`${n}-after.webp`)}
    </div>
  </section>`;
}).join('');

const page = polarity => `<!doctype html>
<html data-theme="power-up" data-polarity="${polarity}"><head><meta charset="utf-8">
<style>${css}</style></head>
<body style="margin:0;background:${tok('background')};color:${tok('foreground')};padding:24px;width:760px;font-family:system-ui,sans-serif">
  <h1 style="margin:0;font-size:18px">Background removal sample · Power-Up ${polarity}</h1>
  <p style="margin:4px 0 0;font-size:12px;${MONO};color:${tok('muted-foreground')}">${esc(report.summary)} · model ${report.model} · peak memory ${report.peak_rss_mb} MB · ${report.total_s}s total</p>
  ${rows}
</body></html>`;

// PW_CHANNEL=msedge locally, where Playwright's own Chromium isn't installed.
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
for (const polarity of ['dark', 'light']) {
  const file = path.join(out, `contact-${polarity}.html`);
  fs.writeFileSync(file, page(polarity));
  const p = await browser.newPage({ viewport: { width: 810, height: 1000 } });
  await p.goto('file://' + file);
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: path.join(out, `contact-${polarity}.png`), fullPage: true });
  await p.close();
  console.log('wrote', `contact-${polarity}.png`);
}
await browser.close();
