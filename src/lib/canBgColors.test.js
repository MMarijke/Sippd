import { describe, expect, it } from 'vitest';
import { rarityTileBackground, THEME_CAN_BG } from './canBgColors';

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

  it('falls back to the theme tile when unrated or unknown', () => {
    expect(rarityTileBackground('???')).toBe(THEME_CAN_BG);
    expect(rarityTileBackground(null)).toBe(THEME_CAN_BG);
    expect(rarityTileBackground(undefined)).toBe(THEME_CAN_BG);
    expect(rarityTileBackground('Mythic')).toBe(THEME_CAN_BG);
  });

  it('avoids color-mix, which the recap image export cannot parse', () => {
    expect(rarityTileBackground('Rare')).not.toMatch(/color-mix/);
    expect(THEME_CAN_BG).not.toMatch(/color-mix/);
  });
});
