import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';

// Guards BottomNav's active-tab rule in every theme rendering: the current
// tab (--foreground, on a 10% --primary pill) must be the most visible item
// in the bar, clearly ahead of the inactive tabs (--muted-foreground). The
// nav itself is bg-card/95 over the page background.
//
// Before this rule the active tab was text-primary, which was the faintest
// item in 30 of 38 renderings (theme critique, 2026-10-26).
//
// Tokens are resolved the way the browser does for <html>: :root defaults,
// then [data-theme] blocks, then [data-theme][data-polarity] blocks (more
// specific), later rules winning ties, var() references followed. Many
// themes inherit --muted-foreground from :root, so reading a theme's own
// block alone would miss it.

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const css = read('../index.css');
const themeSource = read('../hooks/useTheme.js');

// ── Every rendering and its tokens (shared resolver: themeTokens.js) ──
const renderings = themeRenderings(themeSource);
const rules = cssRules(css);
const resolveTokensFor = (rendering) => resolveTokens(rules, rendering);

// ── Colour maths (HSL triples -> sRGB, alpha blending, WCAG contrast) ──────
const hslToRgb = (triple) => {
  let [h, s, l] = triple.replace(/%/g, '').split(/\s+/).map(Number);
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
};
const over = (top, alpha, bottom) => top.map((c, i) => c * alpha + bottom[i] * (1 - alpha));
const lum = (rgb) => rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const measured = renderings.map((rendering) => {
  const get = resolveTokensFor(rendering);
  const background = hslToRgb(get('--background'));
  const nav = over(hslToRgb(get('--card')), 0.95, background);
  const pill = over(hslToRgb(get('--primary')), 0.1, nav);
  const active = hslToRgb(get('--foreground'));
  const inactive = hslToRgb(get('--muted-foreground'));
  return {
    name: `${rendering.id} (${rendering.polarity})`,
    activeOnNav: contrast(active, nav),
    activeOnPill: contrast(active, pill),
    inactiveOnNav: contrast(inactive, nav),
  };
});

describe('bottom nav: the active tab is the most visible item', () => {
  it('covers every theme rendering (41 themes, Neon Arcade in both polarities)', () => {
    expect(renderings).toHaveLength(46);
  });

  it.each(measured.map((m) => [m.name, m]))('%s', (_, m) => {
    // Label on the bar and icon on the pill both read as body text.
    expect(m.activeOnNav, 'active label on the nav bar').toBeGreaterThanOrEqual(4.5);
    expect(m.activeOnPill, 'active icon on its pill').toBeGreaterThanOrEqual(4.5);
    // Clearly ahead of the inactive tabs, not merely equal.
    expect(m.activeOnNav, 'active vs inactive').toBeGreaterThanOrEqual(m.inactiveOnNav * 1.25);
  });
});
