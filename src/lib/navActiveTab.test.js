import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
const css = read('../index.css').replace(/\/\*[\s\S]*?\*\//g, '');
const themeSource = read('../hooks/useTheme.js');

// ── The 38 renderings, from THEME_FAMILIES (each theme's dark/light keys) ──
const familiesSrc = themeSource.slice(
  themeSource.indexOf('export const THEME_FAMILIES'),
  themeSource.indexOf('export const THEMES'),
);
const renderings = familiesSrc
  .split("{ id: '")
  .slice(1)
  .flatMap((chunk) => {
    const id = chunk.slice(0, chunk.indexOf("'"));
    const polarities = ['dark', 'light'].filter((p) => new RegExp(`\\b${p}: \\{`).test(chunk));
    return polarities.map((polarity) => ({ id, polarity }));
  });

// ── A small cascade for <html> ─────────────────────────────────────────────
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectorText, body], order) => ({
  selectors: selectorText.split(',').map((s) => s.trim()),
  decls: Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])),
  order,
}));

// Specificity of a selector that applies to <html> for this rendering, or
// -1. Only :root and [data-theme]/[data-polarity] attribute selectors are
// considered (the other attributes, e.g. data-tone, don't set these tokens).
function specificity(selector, { id, polarity }) {
  const m = selector.match(/^(:root)?((?:\[data-(?:theme|polarity)="[^"]+"\])*)$/);
  if (!m || (!m[1] && !m[2])) return -1;
  const attrs = [...m[2].matchAll(/\[data-(theme|polarity)="([^"]+)"\]/g)];
  const ok = attrs.every(([, key, value]) => (key === 'theme' ? value === id : value === polarity));
  return ok ? (m[1] ? 1 : 0) + attrs.length : -1;
}

function resolveTokens(rendering) {
  const applied = rules
    .flatMap((r) => r.selectors.map((s) => ({ spec: specificity(s, rendering), r })))
    .filter((x) => x.spec >= 0)
    .sort((a, b) => a.spec - b.spec || a.r.order - b.r.order);
  const tokens = {};
  for (const { r } of applied) Object.assign(tokens, r.decls);
  const get = (name, depth = 0) => {
    const v = tokens[name];
    const ref = v?.match(/^var\((--[\w-]+)\)$/);
    return ref && depth < 10 ? get(ref[1], depth + 1) : v;
  };
  return get;
}

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
  const get = resolveTokens(rendering);
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
  it('covers every theme rendering (33 themes, Neon Arcade in both polarities)', () => {
    expect(renderings).toHaveLength(38);
  });

  it.each(measured.map((m) => [m.name, m]))('%s', (_, m) => {
    // Label on the bar and icon on the pill both read as body text.
    expect(m.activeOnNav, 'active label on the nav bar').toBeGreaterThanOrEqual(4.5);
    expect(m.activeOnPill, 'active icon on its pill').toBeGreaterThanOrEqual(4.5);
    // Clearly ahead of the inactive tabs, not merely equal.
    expect(m.activeOnNav, 'active vs inactive').toBeGreaterThanOrEqual(m.inactiveOnNav * 1.25);
  });
});
