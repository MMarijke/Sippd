import { describe, expect, it } from 'vitest';
import {
  rarityTileBackground, UNRATED_CAN_BG, DEFAULT_CAN_BG, TILE_HUES,
  hueValue, parseTileHue, hueTileBackground, tileBackground,
} from './canBgColors';

describe('custom tile colour', () => {
  it('round-trips a hue through the stored value', () => {
    expect(hueValue(215)).toBe('hue:215');
    expect(parseTileHue(hueValue(215))).toBe(215);
    expect(hueValue(360)).toBe('hue:0');
    expect(hueValue(-20)).toBe('hue:340');
    expect(hueValue(44.6)).toBe('hue:45');
  });

  it('treats the default, old hex picks and junk as "wear the rarity"', () => {
    for (const v of [DEFAULT_CAN_BG, '#2B0D1F', null, undefined, '', 'hue:', 'hue:abc', 'hue:400', 'hue:-5']) {
      expect(parseTileHue(v), String(v)).toBeNull();
      expect(tileBackground('Rare', v)).toBe(rarityTileBackground('Rare'));
    }
  });

  it('paints a picked hue as a wash over the card, whatever the rarity', () => {
    const bg = tileBackground('Legendary', 'hue:215');
    expect(bg).toBe(hueTileBackground(215));
    expect(bg).toContain('hsl(var(--card))');
    expect(bg).toMatch(/hsl\(215 /);
    expect(bg).not.toContain('--rarity-');
  });

  it('washes no stronger than a Legendary tile, and avoids color-mix', () => {
    const alpha = s => Number(s.match(/\/ ([\d.]+)\)/)[1]);
    expect(alpha(hueTileBackground(0))).toBeLessThanOrEqual(alpha(rarityTileBackground('Legendary')));
    expect(hueTileBackground(0)).not.toMatch(/color-mix/);
  });

  it('offers distinct quick-pick hues round the wheel', () => {
    const hues = TILE_HUES.map(h => h.hue);
    expect(new Set(hues).size).toBe(hues.length);
    expect([...hues].sort((a, b) => a - b)).toEqual(hues);
    for (const h of hues) expect(parseTileHue(hueValue(h))).toBe(h);
  });
});

describe('rarityTileBackground', () => {
  it('washes the card with the rarity hue', () => {
    expect(rarityTileBackground('Legendary')).toContain('--rarity-legendary');
    expect(rarityTileBackground('Rare')).toContain('--rarity-rare');
    expect(rarityTileBackground('Common')).toContain('hsl(var(--card))');
  });

  it('accepts stored spellings of the same tier', () => {
    const ultra = rarityTileBackground('Ultra Rare');
    expect(ultra).toContain('--rarity-ultra');
    expect(rarityTileBackground('ultra_rare')).toBe(ultra);
    expect(rarityTileBackground('ULTRA RARE')).toBe(ultra);
  });

  it('washes rarer tiers more strongly', () => {
    const alpha = r => Number(rarityTileBackground(r).match(/\/ ([\d.]+)\)/)[1]);
    const tiers = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary'].map(alpha);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it('gives unrated or unknown cans a neutral tile, not a rarity or accent hue', () => {
    expect(UNRATED_CAN_BG).toContain('--foreground');
    expect(UNRATED_CAN_BG).not.toContain('--primary');
    expect(rarityTileBackground('???')).toBe(UNRATED_CAN_BG);
    expect(rarityTileBackground(null)).toBe(UNRATED_CAN_BG);
    expect(rarityTileBackground(undefined)).toBe(UNRATED_CAN_BG);
    expect(rarityTileBackground('Mythic')).toBe(UNRATED_CAN_BG);
  });

  it('avoids color-mix, which the recap image export cannot parse', () => {
    expect(rarityTileBackground('Rare')).not.toMatch(/color-mix/);
    expect(UNRATED_CAN_BG).not.toMatch(/color-mix/);
  });
});
