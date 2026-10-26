import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STEPS, MIN_STEP, MIN_COMMON, MIN_SCAN_GAP, rampProblems, adjacentSteps, isDarkCard,
  contrast as contrastRgb, deltaEOk, labChroma, hslToRgb as hslTripleToRgb, parseHsl,
} from './rampColour';
import { themeRenderings, cssRules, resolveTokens } from './themeTokens';

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

// Theme blocks: the ones that declare both a gauge and a card. (The
// colour-blind override, [data-rarity="colour-blind"], declares only the
// gauge; it's checked against every theme's card further down.)
const themeBlockMatches = [...css.matchAll(/([^{}]+)\{([^{}]*--breakdown-common[^{}]*)\}/g)]
  .filter(([, , body]) => /--card:/.test(body));

const blocks = themeBlockMatches.map(([, sel, body]) => ({
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

// The gauge rules, shared with scripts/tune-rarity-ramps.mjs
// (src/lib/rampColour.js, rampProblems): Common reads at >= 3:1, contrast
// rises at every tier, adjacent tiers are >= MIN_STEP (8) apart in
// deltaE-OK, Legendary is the most colourful tier, and every tier is >= 10
// from the theme's Scan fill. Dark themes: steps also hold under simulated
// protanopia and deuteranopia; colour-blind users on light themes get the
// fixed override below. Before 2026-10-26 only 3 of 38 renderings had every
// step >= 8, and Nebula, Crimson, Amethyst and Cyberpunk collapsed to one
// colour under protanopia.
//
// Measured per rendering through the cascade (themeTokens.js), so each
// gauge is checked beside the Scan fill it's actually shown with.
const rules = cssRules(css);
const rgbToken = (get, t) => hslTripleToRgb(parseHsl(get(t)));
const renderings = themeRenderings(readFileSync(fileURLToPath(new URL('../hooks/useTheme.js', import.meta.url)), 'utf8'))
  .map((r) => {
    const get = resolveTokens(rules, r);
    return {
      name: `${r.id} (${r.polarity})`,
      card: rgbToken(get, '--card'),
      scan: rgbToken(get, '--cta'),
      steps: STEPS.map((s) => rgbToken(get, `--breakdown-${s}`)),
    };
  });
// Every theme block's card, for the colour-blind override checks below.
const gauges = themeBlockMatches.map(([, sel, body]) => ({
  name: sel.trim().split(/\r?\n/).pop().trim(),
  card: hslToRgb(...parse(body.match(/--card:\s*([^;]+);/)[1])),
}));

describe('gauge rules: clear steps, rising contrast, vivid Legendary', () => {
  it('covers every theme rendering', () => {
    expect(renderings).toHaveLength(46);
  });

  it.each(renderings.map(g => [g.name, g]))('%s', (_, g) => {
    expect(rampProblems(g.steps, g.card, { scan: g.scan })).toEqual([]);
  });
});

// Rarity badges, chips and labels wear the theme's own gauge (2026-10-26):
// fills are the gauge colours, and each tier's text twin
// (scripts/generate-rarity-text.mjs) reads on the page, the card and the
// badge's own tint.
describe('rarity text follows the theme', () => {
  const over = (c, base, a) => c.map((x, i) => x * a + base[i] * (1 - a));
  const textRenderings = themeRenderings(readFileSync(fileURLToPath(new URL('../hooks/useTheme.js', import.meta.url)), 'utf8'))
    .map((r) => ({ name: `${r.id} (${r.polarity})`, get: resolveTokens(rules, r) }));

  it.each(textRenderings.map((r) => [r.name, r]))('%s', (_, { get }) => {
    const card = rgbToken(get, '--card'), bg = rgbToken(get, '--background');
    for (const s of STEPS) {
      expect(get(`--rarity-${s}`), `${s} fill`).toBe(get(`--breakdown-${s}`));
      const fill = rgbToken(get, `--rarity-${s}`), text = rgbToken(get, `--rarity-${s}-text`);
      for (const surface of [card, bg, over(fill, card, 0.2), over(fill, bg, 0.2)]) {
        expect(contrastRgb(text, surface), `${s} text`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

// The three rules from the 2026-10-26 critique, spelled out on their own so
// a failure names which one broke.
describe('rarity vs Scan (2026-10-26)', () => {
  it.each(renderings.map(g => [g.name, g]))('%s: Common reads at >= 3:1 against the card', (_, g) => {
    expect(contrastRgb(g.steps[0], g.card)).toBeGreaterThanOrEqual(MIN_COMMON);
  });

  it.each(renderings.map(g => [g.name, g]))('%s: no tier within 10 of Scan', (_, g) => {
    for (const [i, step] of g.steps.entries()) {
      expect(deltaEOk(step, g.scan), STEPS[i]).toBeGreaterThanOrEqual(MIN_SCAN_GAP);
    }
  });

  it.each(renderings.map(g => [g.name, g]))('%s: Legendary is the peak in contrast and colour', (_, g) => {
    const K = g.steps.map((c) => contrastRgb(c, g.card));
    const C = g.steps.map(labChroma);
    expect(K[4]).toBe(Math.max(...K));
    // 0.5 tolerance: neutral ramps (Carbon, Silver Screen) are ~0 throughout.
    expect(C[4]).toBeGreaterThanOrEqual(Math.max(...C) - 0.5);
  });
});

// The fixed colour-blind-safe gauge (Settings > Accessibility): dark and
// light versions, each checked against EVERY theme card of that polarity,
// with the strict rules in all three vision modes.
const overrideRamp = selector => {
  // The block whose selector is exactly `selector` (followed by its "{").
  const at = css.search(new RegExp(`${selector.replace(/[[\]"().*+?^$|\\]/g, '\\$&')}\\s*\\{`));
  if (at < 0) return null; // missing: reported by the tests below, not a load-time crash
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return STEPS.map(s => hslToRgb(...parse(body.match(new RegExp(`--breakdown-${s}:\\s*([^;]+);`))[1])));
};
const cvdRamps = {
  dark: overrideRamp(':root[data-rarity="colour-blind"]'),
  light: overrideRamp(':root[data-rarity="colour-blind"][data-tone="light"]'),
};

describe('colour-blind-friendly rarity colours', () => {
  it('defines a dark and a light override', () => {
    expect(cvdRamps.dark, ':root[data-rarity="colour-blind"]').toBeTruthy();
    expect(cvdRamps.light, ':root[data-rarity="colour-blind"][data-tone="light"]').toBeTruthy();
  });

  it.each(gauges.map(g => [g.name, g]))('%s: the override reads on this card', (_, g) => {
    const ramp = isDarkCard(g.card) ? cvdRamps.dark : cvdRamps.light;
    expect(ramp, 'override block present').toBeTruthy();
    const K = ramp.map(c => contrastRgb(c, g.card));
    expect(K[0], 'Common contrast').toBeGreaterThanOrEqual(MIN_COMMON);
    for (let i = 1; i < 5; i++) expect(K[i], `${STEPS[i]} contrast`).toBeGreaterThan(K[i - 1]);
  });

  it.each(['dark', 'light'])('%s override: >= 8 apart in normal, protan and deutan vision', tone => {
    expect(cvdRamps[tone], 'override block present').toBeTruthy();
    for (const vision of ['normal', 'protan', 'deutan']) {
      expect(Math.min(...adjacentSteps(cvdRamps[tone], vision)), vision).toBeGreaterThanOrEqual(MIN_STEP);
    }
  });
});

// Scan (and the selected brand chip) wear --cta, which defaults to the
// theme's own button fill (--primary-fill, else --primary) with its label
// (--primary-foreground): Scan is never quieter than Save. In every theme
// the label must read at 4.5:1 on that fill, and the fill must stand out
// from the page at 3:1 OR the theme must outline it with --fill-edge at 3:1.
// Theme blocks are the ones that DECLARE --breakdown-common.
const scanBlocks = themeBlockMatches.map(([, sel, body]) => ({
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
  // The six Spring themes, Sour Apple (acid-lime button, deeper lime for
  // text and icons, since 2026-10-26), plus the sign-up page's own fixed
  // palette (.login-world), whose magenta fill gets the same label check.
  it('is set by the Spring themes, Sour Apple and the login page', () => {
    const names = fillBlocks.map(b => b.name);
    expect(names).toContain('.login-world');
    expect(names).toContain('[data-theme="sour-apple"]');
    expect(names.filter(n => n !== '.login-world')).toHaveLength(7);
  });

  it.each(fillBlocks.map(b => [b.name, b]))('%s: button label 4.5:1 on the fill, icons 3:1 on the page', (_, b) => {
    expect(contrast(b.fill, b.label)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(b.primary, b.background)).toBeGreaterThanOrEqual(3);
  });
});

// Card edges and dividers: every theme's --border reads at >= 1.35:1
// against both the page and the card (/impeccable polish, 2026-10-19; Sour
// Apple's was 1.10, Meadow 1.23, Synthwave dark 1.24, Deep Space 1.25).
const borderBlocks = themeBlockMatches.map(([, sel, body]) => ({
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
