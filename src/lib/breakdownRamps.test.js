import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Guards index.css's ramp ORDER RULE: in every theme, the Legendary step of
// --breakdown-* stands out at least as much as Common against that theme's
// --card, so the rarest slice of a collection reads loudest.
const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

const hslToRgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
};
const lum = rgb => rgb.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
const parse = v => v.trim().replace(/%/g, '').split(/\s+/).map(Number);
const contrast = (a, b) => {
  const [x, y] = [lum(hslToRgb(...parse(a))), lum(hslToRgb(...parse(b)))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)].map(([, sel, body]) => ({
  name: sel.trim().split('\n').pop().trim(),
  card: body.match(/--card:\s*([^;]+);/)?.[1],
  common: body.match(/--breakdown-common:\s*([^;]+);/)[1],
  legendary: body.match(/--breakdown-legendary:\s*([^;]+);/)[1],
}));

describe('rarity breakdown ramps', () => {
  it('covers every theme block', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(30);
    for (const b of blocks) expect(b.card, b.name).toBeTruthy();
  });

  it.each(blocks.map(b => [b.name, b]))('%s: Legendary stands out at least as much as Common', (_, b) => {
    // 3% tolerance for hue-only ramps whose ends match in contrast.
    expect(contrast(b.legendary, b.card)).toBeGreaterThanOrEqual(contrast(b.common, b.card) * 0.97);
  });
});

// The gauge rule (index.css, 2026-10-19): Common -> Legendary rises in
// contrast against --card at EVERY step, and in colourfulness, so
// Legendary is the most vivid step, never a fading pastel. Colourfulness is
// CIELAB chroma; neutral gauges (all steps under 8: Carbon, Silver Screen)
// are exempt from the chroma half.
const STEPS = ['common', 'uncommon', 'rare', 'ultra', 'legendary'];
const chroma = v => {
  const lin = hslToRgb(...parse(v)).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = lin;
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return Math.hypot(500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)));
};
const gauges = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)].map(([, sel, body]) => ({
  name: sel.trim().split('\n').pop().trim(),
  card: body.match(/--card:\s*([^;]+);/)[1],
  steps: STEPS.map(s => body.match(new RegExp(`--breakdown-${s}:\\s*([^;]+);`))[1]),
}));

describe('gauge rule: rises to a vivid Legendary', () => {
  it.each(gauges.map(g => [g.name, g]))('%s', (_, g) => {
    const K = g.steps.map(s => contrast(s, g.card));
    for (let i = 1; i < 5; i++) expect(K[i], `${STEPS[i]} contrast`).toBeGreaterThan(K[i - 1]);
    const C = g.steps.map(chroma);
    if (Math.max(...C) < 8) return;
    expect(C[4], 'Legendary is the most colourful step').toBeGreaterThanOrEqual(Math.max(...C) - 2);
    for (let i = 1; i < 5; i++) expect(C[i], `${STEPS[i]} colourfulness`).toBeGreaterThanOrEqual(C[i - 1] - 4);
  });
});

// Scan (and the selected brand chip) wear --cta, which defaults to the
// theme's own button fill (--primary-fill, else --primary) with its label
// (--primary-foreground): Scan is never quieter than Save. In every theme
// the label must read at 4.5:1 on that fill, and the fill must stand out
// from the page at 3:1 OR the theme must outline it with --fill-edge at 3:1.
// Theme blocks are the ones that DECLARE --breakdown-common.
const scanBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common:[^{}]*)\}/g)].map(([, sel, body]) => ({
  name: sel.trim().split('\n').pop().trim(),
  background: body.match(/--background:\s*([^;]+);/)[1],
  fill: body.match(/--cta:\s*([\d.]+ [^;]+);/)?.[1]
    ?? body.match(/--primary-fill:\s*([\d.]+ [^;]+);/)?.[1]
    ?? body.match(/--primary:\s*([^;]+);/)[1],
  label: body.match(/--cta-foreground:\s*([\d.]+ [^;]+);/)?.[1] ?? body.match(/--primary-foreground:\s*([^;]+);/)[1],
  edge: body.match(/--fill-edge:\s*hsl\(([^)]+)\);/)?.[1],
}));

describe('Scan (cta)', () => {
  it('no theme still carries the retired Uncommon-based Scan tokens', () => {
    expect(css).not.toMatch(/--uncommon-action/);
  });

  it.each(scanBlocks.map(b => [b.name, b]))('%s: label 4.5:1 on the fill; shape 3:1 against the page', (_, b) => {
    expect(contrast(b.fill, b.label)).toBeGreaterThanOrEqual(4.5);
    const shape = Math.max(contrast(b.fill, b.background), b.edge ? contrast(b.edge, b.background) : 0);
    expect(shape, `${b.name}: fill ${contrast(b.fill, b.background).toFixed(2)}:1 and no --fill-edge`).toBeGreaterThanOrEqual(3);
  });
});

// Where a theme fills buttons with a different colour from its text-primary
// (--primary-fill, Spring's exact palette hex), the button label must read
// on the FILL, and the text shade must still read as icons on the page.
const fillBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*--primary-fill:\s*[\d.]+ [^{}]*)\}/g)].map(([, sel, body]) => ({
  name: sel.trim().split('\n').pop().trim(),
  fill: body.match(/--primary-fill:\s*([^;]+);/)[1],
  label: body.match(/--primary-foreground:\s*([^;]+);/)[1],
  primary: body.match(/--primary:\s*([^;]+);/)[1],
  background: body.match(/--background:\s*([^;]+);/)[1],
}));

describe('primary fill', () => {
  // The six Spring themes, plus the sign-up page's own fixed palette
  // (.login-world), whose magenta fill gets the same label check below.
  it('is set by the Spring themes and the login page', () => {
    const names = fillBlocks.map(b => b.name);
    expect(names).toContain('.login-world');
    expect(names.filter(n => n !== '.login-world')).toHaveLength(6);
  });

  it.each(fillBlocks.map(b => [b.name, b]))('%s: button label 4.5:1 on the fill, icons 3:1 on the page', (_, b) => {
    expect(contrast(b.fill, b.label)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(b.primary, b.background)).toBeGreaterThanOrEqual(3);
  });
});

// Card edges and dividers: every theme's --border reads at >= 1.35:1
// against both the page and the card (/impeccable polish, 2026-10-19; Sour
// Apple's was 1.10, Meadow 1.23, Synthwave dark 1.24, Deep Space 1.25).
const borderBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)].map(([, sel, body]) => ({
  name: sel.trim().split('\n').pop().trim(),
  background: body.match(/--background:\s*([^;]+);/)[1],
  card: body.match(/--card:\s*([^;]+);/)[1],
  border: body.match(/--border:\s*([^;]+);/)?.[1],
}));

describe('borders', () => {
  it.each(borderBlocks.map(b => [b.name, b]))('%s: border visible against page and card', (_, b) => {
    expect(b.border, `${b.name} has no --border`).toBeTruthy();
    expect(contrast(b.border, b.background)).toBeGreaterThanOrEqual(1.35);
    expect(contrast(b.border, b.card)).toBeGreaterThanOrEqual(1.35);
  });
});
