import { describe, expect, it } from 'vitest';
import { canTileBackground, DEFAULT_CAN_BG, THEME_CAN_BG } from './canBgColors';

// DEFAULT_CAN_BG is also what AddCanForm stores for "left at default", so
// that stored value has to render as the theme colour too, not the old teal.
describe('canTileBackground', () => {
  it('follows the theme when no colour is set', () => {
    expect(canTileBackground(null)).toBe(THEME_CAN_BG);
    expect(canTileBackground(undefined)).toBe(THEME_CAN_BG);
    expect(canTileBackground('')).toBe(THEME_CAN_BG);
  });

  it('follows the theme for the stored default, in any case', () => {
    expect(canTileBackground(DEFAULT_CAN_BG)).toBe(THEME_CAN_BG);
    expect(canTileBackground(DEFAULT_CAN_BG.toLowerCase())).toBe(THEME_CAN_BG);
  });

  it('keeps a colour someone deliberately picked', () => {
    expect(canTileBackground('#170B33')).toBe('#170B33');
  });
});
