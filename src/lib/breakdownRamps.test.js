import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STEPS, MIN_STEP, MIN_COMMON, MIN_LIGHT_STEP, MAX_SCAN_MATCH, rampProblems, adjacentSteps,
  contrast as contrastRgb, deltaEOk, labChroma, hslToRgb as hslTripleToRgb, parseHsl, srgbToOklab,
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

// Theme blocks: the ones that declare both a gauge and a card.
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

  // Since 2026-10-27 the gauge ends on the Scan colour, so a ramp that
  // descends into a mid-tone Scan has its highest contrast at Common. Every
  // tier still reads; the floor is the same for all five.
  it.each(blocks.filter(b => !/data-theme="((spring|alloy)-|bubblegum|blue-pop|grape-candy|orange-crush|sour-apple|cherry-pop|carbon|crimson|amethyst|sapphire|emerald|sage|meadow|fern|forest|deep-space|stellar-gold|solar-flare|nebula|aurora|power-up|cyberpunk|plasma|boss-fight|synthwave|cola|root-beer)/.test(b.name)).map(b => [b.name, b]))('%s: Common and Legendary both read at >= 3:1', (_, b) => {
    expect(contrast(b.common, b.card)).toBeGreaterThanOrEqual(MIN_COMMON);
    expect(contrast(b.legendary, b.card)).toBeGreaterThanOrEqual(MIN_COMMON);
  });
});

// The gauge rules, shared with scripts/tune-rarity-ramps.mjs
// (src/lib/rampColour.js, rampProblems): Legendary is the Scan colour,
// every tier reads at >= 3:1, lightness moves one way in real steps,
// adjacent tiers are >= MIN_STEP (8) apart in deltaE-OK in normal,
// protan and deutan vision on every theme, and Legendary is the most
// colourful tier. (Before 2026-10-26 only 3 of 38 renderings had every step
// >= 8; before 2026-10-27 light themes were checked in normal vision only,
// and several separated their tiers by hue alone.)
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
      accent: rgbToken(get, '--accent'),
      steps: STEPS.map((s) => rgbToken(get, `--breakdown-${s}`)),
      edge: get('--gauge-edge'),
    };
  });
// Every theme but Spring, Alloy, Candy, Noir (bar Silver Screen) and Botanical, whose ladders follow their own rules below.
const isLadder = (g) => /^((spring|alloy)-|bubblegum|blue-pop|grape-candy|orange-crush|sour-apple|cherry-pop|carbon|crimson|amethyst|sapphire|emerald|sage|meadow|fern|forest|deep-space|stellar-gold|solar-flare|nebula|aurora|power-up|cyberpunk|plasma|boss-fight|synthwave|cola|root-beer)/.test(g.name);
const ruled = renderings.filter((g) => !isLadder(g));

describe('gauge rules: clear steps, rising contrast, vivid Legendary', () => {
  it('covers every theme rendering', () => {
    expect(renderings).toHaveLength(44);
  });

  it.each(ruled.map(g => [g.name, g]))('%s', (_, g) => {
    expect(rampProblems(g.steps, g.card, { scan: g.scan })).toEqual([]);
  });
});

// Spring's, Alloy's and Candy's gauges are tint ladders of their main colour
// (product direction, 2026-10-27; scripts/generate-tint-ladders.mjs), under
// their own rules: the Scan colour (Spring: the palette colour) is
// Legendary, except Spring Butter, whose ladder climbs from the palette
// butter into richer golds; every tier stays in that colour's hue;
// lightness moves one way; neighbours are >= 4 apart; and where the palest
// tint is faint on its card (under 2:1), every segment draws its hairline
// (--gauge-edge).
describe('Spring, Alloy, Candy, Noir and Botanical: ladders of the main colour', () => {
  const ladders = renderings.filter(isLadder);
  const hueOf = (c) => { const [, a, b] = srgbToOklab(c); return (Math.atan2(b, a) * 180) / Math.PI; };
  const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  it('covers all forty-two', () => expect(ladders).toHaveLength(42));

  it.each(ladders.map((g) => [g.name, g]))('%s', (name, g) => {
    // Butter, Coral and Pistachio (owner-approved, 2026-10-31) are too pale
    // to end a ladder on: theirs START at the palette colour and deepen.
    if (/^spring-(butter|coral|pistachio) /.test(name)) {
      expect(deltaEOk(g.steps[0], g.scan), 'Common is the palette colour').toBeLessThanOrEqual(MAX_SCAN_MATCH);
    } else {
      expect(deltaEOk(g.steps[4], g.scan), 'Legendary is the Scan colour').toBeLessThanOrEqual(MAX_SCAN_MATCH);
    }
    // Hue only means something where there's colour (Brushed Aluminium's
    // graphite is all but neutral). Aurora and Nebula run from their accent
    // blue (Aurora's glow bubble), and Neon's dark renderings from their
    // accent (their glow bubble's colour), and Cola from its cola-red accent,
    // to the Scan colour instead: Aurora starts
    // ON the accent, and both turn steadily from the accent's hue to the Scan's.
    if (/^(aurora|nebula|cola) |^(power-up|cyberpunk|plasma|synthwave) \(dark\)|^boss-fight \(light\)/.test(name)) {
      if (name.startsWith('aurora')) expect(deltaEOk(g.steps[0], g.accent), 'Common is the bubble blue').toBeLessThanOrEqual(MAX_SCAN_MATCH);
      expect(hueGap(hueOf(g.steps[0]), hueOf(g.accent)), 'Common in the accent hue').toBeLessThanOrEqual(15);
      const toScan = g.steps.map((c) => hueGap(hueOf(c), hueOf(g.scan)));
      for (let i = 1; i < 5; i++) expect(toScan[i], 'hue turns toward the Scan colour').toBeLessThan(toScan[i - 1]);
    } else {
      for (const c of g.steps) if (labChroma(c) >= 5) expect(hueGap(hueOf(c), hueOf(g.scan)), 'hue').toBeLessThanOrEqual(15);
    }
    const L = g.steps.map((c) => srgbToOklab(c)[0]);
    const dir = Math.sign(L[4] - L[0]);
    for (let i = 1; i < 5; i++) expect((L[i] - L[i - 1]) * dir, 'lightness').toBeGreaterThan(0.02);
    for (const s of adjacentSteps(g.steps)) expect(s, 'step').toBeGreaterThanOrEqual(4);
    if (contrastRgb(g.steps[0], g.card) < 2) expect(g.edge, '--gauge-edge').not.toBe('transparent');
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

  // A filled Legendary badge (RarityBadge) labels in --rarity-legendary-on.
  it.each(textRenderings.map((r) => [r.name, r]))('%s: filled Legendary badge label reads', (_, { get }) => {
    expect(contrastRgb(rgbToken(get, '--rarity-legendary-on'), rgbToken(get, '--rarity-legendary'))).toBeGreaterThanOrEqual(4.5);
  });

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
// The gauge as a gradient that ends on the Scan colour (product direction,
// 2026-10-27), each rule spelled out on its own so a failure names it.
describe('rarity gauge: a gradient to the Scan colour', () => {
  it.each(ruled.map(g => [g.name, g]))('%s: Legendary is the Scan colour', (_, g) => {
    expect(deltaEOk(g.steps[4], g.scan)).toBeLessThanOrEqual(MAX_SCAN_MATCH);
  });

  it.each(ruled.map(g => [g.name, g]))('%s: every tier reads at >= 3:1 against the card', (_, g) => {
    for (const [i, step] of g.steps.entries()) {
      expect(contrastRgb(step, g.card), STEPS[i]).toBeGreaterThanOrEqual(MIN_COMMON);
    }
  });

  it.each(ruled.map(g => [g.name, g]))('%s: lightness moves one way in real steps', (_, g) => {
    const L = g.steps.map((c) => srgbToOklab(c)[0]);
    const dir = Math.sign(L[4] - L[0]);
    for (let i = 1; i < 5; i++) expect((L[i] - L[i - 1]) * dir, STEPS[i]).toBeGreaterThanOrEqual(MIN_LIGHT_STEP);
  });

  it.each(ruled.map(g => [g.name, g]))('%s: tiers stay apart in colour-blind vision', (_, g) => {
    for (const vision of ['protan', 'deutan']) {
      expect(Math.min(...adjacentSteps(g.steps, vision)), vision).toBeGreaterThanOrEqual(MIN_STEP);
    }
  });

  it.each(ruled.map(g => [g.name, g]))('%s: Legendary is the most colourful tier', (_, g) => {
    const C = g.steps.map(labChroma);
    // 0.5 tolerance: neutral ramps (Carbon, Silver Screen) are ~0 throughout.
    expect(C[4]).toBeGreaterThanOrEqual(Math.max(...C) - 0.5);
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
