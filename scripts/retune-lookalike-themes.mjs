// One-off re-tune of the lookalike themes found by the theme catalogue
// critique (2026-10-26): each moves into its own colour territory, nobody
// loses a theme. Writes the tokens below into each theme's block in
// src/index.css (as HSL triples) and the picker swatches in useTheme.js.
// Ramps are re-tuned afterwards by scripts/tune-rarity-ramps.mjs.
//
//   node scripts/retune-lookalike-themes.mjs          dry run: contrast report
//   node scripts/retune-lookalike-themes.mjs --write  apply
import { readFileSync, writeFileSync } from 'node:fs';
import { rgbToHsl, formatHsl, contrast, hslToRgb, parseHsl } from '../src/lib/rampColour.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const triple = (h) => formatHsl(rgbToHsl(hex(h)));

// selector -> tokens (hex). fillEdge is written as hsl(...), like Spring's.
const THEMES = {
  // Meadow keeps grass green on cream; Sour Apple goes acid lime.
  '[data-theme="sour-apple"]': {
    swatch: { id: 'sour-apple', swatch: '#B6F000', sup: '#3D6B00', background: '#F3FFD2' },
    background: '#F3FFD2', card: '#F8FFE4', popover: '#F8FFE4',
    primary: '#4E7A00', 'primary-fill': '#B6F000', 'primary-foreground': '#0A0A0F', fillEdge: '#6E9A00',
    accent: '#3D6B00', foreground: '#2E3D10', 'muted-foreground': '#556630',
    border: '#BBDA6C', input: '#BBDA6C', ring: '#4E7A00',
  },
  // Orange Crush keeps its orange; Coral goes lighter and peachier...
  '[data-theme="spring-coral"]': {
    swatch: { id: 'spring-coral', swatch: '#FFB08A', sup: '#B4592F', background: '#FFEDE2' },
    background: '#FFEDE2', card: '#FFF5EE', popover: '#FFF5EE',
    primary: '#B4592F', 'primary-fill': '#FFB08A', 'primary-foreground': '#0A0A0F', fillEdge: '#C8714A',
    accent: '#C8662F', border: '#EEBDA2', input: '#EEBDA2', ring: '#B4592F',
  },
  // ...and Brick deeper and browner.
  '[data-theme="spring-brick"]': {
    swatch: { id: 'spring-brick', swatch: '#8A4330', sup: '#C49483', background: '#F3EDE6' },
    background: '#F3EDE6', card: '#F9F5F0', popover: '#F9F5F0',
    primary: '#8A4330', 'primary-fill': '#8A4330', 'primary-foreground': '#FFFFFF',
    accent: '#6E3424', foreground: '#4A2219', 'muted-foreground': '#7E4436',
    border: '#DCC3B5', input: '#DCC3B5', ring: '#8A4330',
  },
  // Forest keeps deep green; Fern goes moss-yellow, Emerald blue-teal.
  '[data-theme="fern"]': {
    swatch: { id: 'fern', swatch: '#A4B23E', sup: '#6F7A2C', background: '#13160C' },
    background: '#13160C', card: '#1C2112', popover: '#1C2112',
    primary: '#A4B23E', 'primary-foreground': '#0A0A0F',
    accent: '#6F7A2C', foreground: '#F5F7E8', border: '#363E20', input: '#363E20', ring: '#A4B23E',
  },
  '[data-theme="emerald"]': {
    swatch: { id: 'emerald', swatch: '#2AA5B8', sup: '#1F7A8A', background: '#071417' },
    background: '#071417', card: '#0E2226', popover: '#0E2226',
    primary: '#2AA5B8', 'primary-foreground': '#0A0A0F',
    accent: '#1F7A8A', foreground: '#EAF8FB', border: '#1E3D44', input: '#1E3D44', ring: '#2AA5B8',
  },
  // Spring's yellow-greens: a real butter, a true pistachio, a real olive.
  '[data-theme="spring-butter"]': {
    swatch: { id: 'spring-butter', swatch: '#FFD84D', sup: '#8A6A00', background: '#FFF7D9' },
    background: '#FFF7D9', card: '#FFFBEB', popover: '#FFFBEB',
    primary: '#8A6A00', 'primary-fill': '#FFD84D', 'primary-foreground': '#0A0A0F', fillEdge: '#A88200',
    accent: '#9C7A12', foreground: '#4D3F12', 'muted-foreground': '#76653A',
    border: '#E0D29A', input: '#E0D29A', ring: '#8A6A00',
  },
  '[data-theme="spring-pistachio"]': {
    swatch: { id: 'spring-pistachio', swatch: '#A3CC6E', sup: '#4E6E30', background: '#EEF6E6' },
    background: '#EEF6E6', card: '#F6FBF1', popover: '#F6FBF1',
    primary: '#5C7F3A', 'primary-fill': '#A3CC6E', 'primary-foreground': '#0A0A0F', fillEdge: '#6E9446',
    accent: '#4E6E30', foreground: '#34452A', 'muted-foreground': '#566849',
    border: '#C3D7A8', input: '#C3D7A8', ring: '#5C7F3A',
  },
  '[data-theme="spring-olive"]': {
    swatch: { id: 'spring-olive', swatch: '#6B6A1F', sup: '#A39C5C', background: '#F2F1E6' },
    background: '#F2F1E6', card: '#F8F7EF', popover: '#F8F7EF',
    primary: '#6B6A1F', 'primary-fill': '#6B6A1F', 'primary-foreground': '#FFFFFF',
    accent: '#857A35', foreground: '#33321A', 'muted-foreground': '#5C5A36',
    border: '#D3D0B4', input: '#D3D0B4', ring: '#6B6A1F',
  },
  // Neon light pair: Cyberpunk = magenta on icy cyan-white with a cyan
  // accent; Synthwave = purple on a warm sunset-pink with an orange accent.
  '[data-theme="cyberpunk"][data-polarity="light"]': {
    swatch: { id: 'cyberpunk', polarity: 'light', swatch: '#EE00BF', sup: '#008FAD', background: '#EEFAFD' },
    background: '#EEFAFD', card: '#F6FDFE', popover: '#F6FDFE',
    accent: '#008FAD', foreground: '#26304D', 'muted-foreground': '#4F5E80',
    border: '#9FDCEA', input: '#9FDCEA',
  },
  '[data-theme="synthwave"][data-polarity="light"]': {
    swatch: { id: 'synthwave', polarity: 'light', swatch: '#C635FF', sup: '#E8561C', background: '#FDF0F6' },
    background: '#FDF0F6', card: '#FEF6FA', popover: '#FEF6FA',
    accent: '#E8561C', 'muted-foreground': '#7A5E86',
    border: '#EDBBD6', input: '#EDBBD6',
  },
};

const CSS = 'src/index.css';
let css = readFileSync(CSS, 'utf8');
const nl = css.includes('\r\n') ? '\r\n' : '\n';
const report = [];

for (const [selector, spec] of Object.entries(THEMES)) {
  const start = css.search(new RegExp(`(^|\\n)\\s*${selector.replace(/[[\]"]/g, '\\$&')}\\s*\\{`));
  if (start < 0) throw new Error(`no block for ${selector}`);
  const open = css.indexOf('{', start), close = css.indexOf('}', open);
  let body = css.slice(open + 1, close);
  for (const [token, value] of Object.entries(spec)) {
    if (token === 'swatch') continue;
    const name = token === 'fillEdge' ? '--fill-edge' : `--${token}`;
    const v = token === 'fillEdge' ? `hsl(${triple(value)})` : triple(value);
    const re = new RegExp(`(${name}:\\s*)[^;]+;`);
    if (re.test(body)) body = body.replace(re, `$1${v};`);
    else body = body.replace(/\s*$/, `${nl}    ${name}: ${v};${nl}  `);
  }
  css = css.slice(0, open + 1) + body + css.slice(close);

  // Contrast report, read back from the block as written.
  const get = (n) => body.match(new RegExp(`--${n}:\\s*([^;]+);`))?.[1];
  const rgb = (n) => (get(n) ? hslToRgb(parseHsl(get(n))) : null);
  const bg = rgb('background'), card = rgb('card'), fill = rgb('primary-fill') ?? rgb('primary');
  const edge = body.match(/--fill-edge:\s*hsl\(([^)]+)\)/)?.[1];
  const r = (x) => x.toFixed(2);
  report.push(`${selector.padEnd(46)} label/fill ${r(contrast(rgb('primary-foreground') ?? hex('#0A0A0F'), fill))}`
    + `  fill/page ${r(contrast(fill, bg))}${edge ? ` edge/page ${r(contrast(hslToRgb(parseHsl(edge)), bg))}` : ''}`
    + `  primary/page ${r(contrast(rgb('primary') ?? fill, bg))}`
    + (rgb('foreground') ? `  fg/card ${r(contrast(rgb('foreground'), card))}` : '')
    + (rgb('muted-foreground') ? `  muted/card ${r(contrast(rgb('muted-foreground'), card))}` : '')
    + `  border ${r(contrast(rgb('border'), bg))}/${r(contrast(rgb('border'), card))}`);
}

console.log(report.join('\n'));

if (process.argv.includes('--write')) {
  writeFileSync(CSS, css);
  // Picker swatches in useTheme.js: { id: 'x', ..., <polarity>: { swatch, sup, background } }
  let js = readFileSync('src/hooks/useTheme.js', 'utf8');
  for (const { swatch } of Object.values(THEMES)) {
    const polarity = swatch.polarity ?? (/^#[0-3]/.test(swatch.background) ? 'dark' : 'light');
    // Bounded to this theme's own entry: an unbounded lazy match once ran
    // past entries with a different shape (Neon's, no `sup`) and wrote
    // Synthwave light's colours onto Sage. themeSwatches.test.js now guards it.
    const re = new RegExp(`(\\{ id: '${swatch.id}'(?:(?!\\{ id: )[\\s\\S])*?${polarity}: \\{ )swatch: '#[0-9A-Fa-f]{6}', sup: '#[0-9A-Fa-f]{6}', background: '#[0-9A-Fa-f]{6}'`);
    if (!re.test(js)) throw new Error(`no ${polarity} swatch for ${swatch.id}`);
    js = js.replace(re, `$1swatch: '${swatch.swatch}', sup: '${swatch.sup}', background: '${swatch.background}'`);
  }
  writeFileSync('src/hooks/useTheme.js', js);
  console.log('\nwrote src/index.css and src/hooks/useTheme.js');
}
