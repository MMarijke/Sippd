import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// useTheme.js imports the real supabase client at module scope; this test
// only needs its THEME_FAMILIES table (see useTheme.test.js for the why).
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { THEME_FAMILIES } from '@/hooks/useTheme';

// Error text (text-destructive -> --destructive-text) must read at 4.5:1 in
// every theme, in the tone that theme actually renders: against the page,
// the card, and the bg-destructive/10 error box over the card. The fill red
// it replaced read 3.3-4.0:1 as text everywhere (/impeccable audit).
const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

const hslToRgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
};
const rgb = v => hslToRgb(...v.trim().replace(/%/g, '').split(/\s+/).map(Number));
const lum = c => c.map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, bg, alpha) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

// The first block for a selector can be a shared font rule; take the one
// that sets colours.
const block = sel => {
  for (let i = css.indexOf(`${sel} {`); i >= 0; i = css.indexOf(`${sel} {`, i + 1)) {
    const body = css.slice(i, css.indexOf('}', i));
    if (/\s--background:/.test(body)) return body;
  }
  return null;
};
const token = (body, name) => body.match(new RegExp(`\\s${name}:\\s*([^;]+);`))?.[1];

const root = block(':root');
const lightTone = css.slice(css.indexOf(':root[data-tone="light"] {'), css.indexOf('}', css.indexOf(':root[data-tone="light"] {')));
const TEXT = { dark: rgb(token(root, '--destructive-text')), light: rgb(token(lightTone, '--destructive-text')) };
const FILL = rgb(token(root, '--destructive'));

const cases = THEME_FAMILIES.flatMap(family => family.themes.flatMap(theme => {
  const tones = ['dark', 'light'].filter(t => theme[t]);
  return tones.map(tone => {
    const body = tones.length === 2
      ? block(`[data-theme="${theme.id}"][data-polarity="${tone}"]`)
      : block(`[data-theme="${theme.id}"]`);
    return [`${theme.id} (${tone})`, { tone, body }];
  });
}));

describe('error text contrast', () => {
  it('covers every theme rendering', () => {
    // 38 renderings since Moss retired (2026-10-19).
    expect(cases.length).toBeGreaterThanOrEqual(38);
    for (const [name, c] of cases) expect(c.body, name).toBeTruthy();
  });

  it.each(cases)('%s: 4.5:1 on page, card and error box', (_, { tone, body }) => {
    const bg = rgb(token(body, '--background'));
    const card = rgb(token(body, '--card'));
    const text = TEXT[tone];
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, over(FILL, card, 0.1))).toBeGreaterThanOrEqual(4.5);
  });
});
