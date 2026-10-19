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

// Home's Scan button and selected brand chip are filled with each theme's
// --breakdown-uncommon; their label is --uncommon-action-foreground, which
// every theme must define at body-text contrast (12px label, so 4.5:1).
// The fill is --uncommon-action where a theme sets it to a literal colour
// (Spring: its exact palette hex), else --breakdown-uncommon, which
// --uncommon-action defaults to. Only blocks that DECLARE
// --breakdown-uncommon are themes; the defaults block merely var()s it.
const actionBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-uncommon:[^{}]*)\}/g)].map(([, sel, body]) => ({
  name: sel.trim().split('\n').pop().trim(),
  fill: body.match(/--uncommon-action:\s*([\d.]+ [^;]+);/)?.[1] ?? body.match(/--breakdown-uncommon:\s*([^;]+);/)[1],
  label: body.match(/--uncommon-action-foreground:\s*([^;]+);/)?.[1],
}));

describe('Uncommon action colour', () => {
  it.each(actionBlocks.map(b => [b.name, b]))('%s: label reads at 4.5:1 on the Uncommon fill', (_, b) => {
    expect(b.label, `${b.name} is missing --uncommon-action-foreground`).toBeTruthy();
    expect(contrast(b.fill, b.label)).toBeGreaterThanOrEqual(4.5);
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
  it('is set by the Spring themes', () => {
    expect(fillBlocks.length).toBe(6);
  });

  it.each(fillBlocks.map(b => [b.name, b]))('%s: button label 4.5:1 on the fill, icons 3:1 on the page', (_, b) => {
    expect(contrast(b.fill, b.label)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(b.primary, b.background)).toBeGreaterThanOrEqual(3);
  });
});
