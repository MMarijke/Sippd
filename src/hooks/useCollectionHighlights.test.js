import { describe, it, expect, vi } from 'vitest';

// useTogglePin (for getMaxPins) imports the real supabase client at module
// scope, which throws without env vars in CI -- same mock as useTheme.test.
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { buildShowcase } from './useCollectionHighlights';

const can = (id, rarity, pinnedAt = null) => ({ id, rarity, pinned_at: pinnedAt });
const rarityOf = item => item.rarity;

describe('buildShowcase', () => {
  it('puts a free collector\'s rarest can first (the spotlight tile)', () => {
    const items = [can('a', 'Common'), can('b', 'Legendary'), can('c', 'Rare')];
    expect(buildShowcase(items, rarityOf, false)[0].id).toBe('b');
  });

  it('never pushes a free collector\'s pinned pick out to make room', () => {
    // 6 pinned commons fill the free cap; the unpinned Legendary stays out,
    // and the spotlight is the rarest of what they chose to show.
    const pinned = Array.from({ length: 6 }, (_, i) => can(`p${i}`, i === 3 ? 'Uncommon' : 'Common', `2026-09-0${i + 1}`));
    const out = buildShowcase([...pinned, can('L', 'Legendary')], rarityOf, false);
    expect(out.map(i => i.id)).not.toContain('L');
    expect(out).toHaveLength(6);
    expect(out[0].id).toBe('p3');
  });

  it('keeps a pinned can ahead on a rarity tie', () => {
    const items = [can('x', 'Rare'), can('y', 'Rare', '2026-09-01')];
    expect(buildShowcase(items, rarityOf, false)[0].id).toBe('y');
  });

  it('gives Pro a custom hero: their first pin, even if rarer cans exist', () => {
    const items = [can('rare', 'Legendary'), can('mine', 'Common', '2026-09-01')];
    expect(buildShowcase(items, rarityOf, true)[0].id).toBe('mine');
  });

  it('caps free at 6 and Pro at 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => can(`c${i}`, 'Common'));
    expect(buildShowcase(many, rarityOf, false)).toHaveLength(6);
    expect(buildShowcase(many, rarityOf, true)).toHaveLength(10);
  });
});
