import { describe, expect, it } from 'vitest';
import { computeAchievements, selectHighlightAchievements, selectShelfAchievements } from './achievements';

function collectedCan(overrides = {}) {
  return {
    status: 'collected',
    can_brand: 'BrandX',
    can_name: 'Flavour',
    can_rarity: 'Common',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeAchievements', () => {
  it('unlocks nothing for an empty collection', () => {
    const achievements = computeAchievements([], 0, 0, null);
    expect(achievements.every(a => !a.unlocked)).toBe(true);
  });

  it('unlocks first_can on the first collected item', () => {
    const achievements = computeAchievements([collectedCan()], 0, 0, null);
    expect(achievements.find(a => a.key === 'first_can').unlocked).toBe(true);
  });

  it('ignores wishlist/duplicate items for collected-based achievements', () => {
    const collection = [collectedCan({ status: 'wishlist' })];
    const achievements = computeAchievements(collection, 0, 0, null);
    expect(achievements.find(a => a.key === 'first_can').unlocked).toBe(false);
  });

  it('tracks haul thresholds independently', () => {
    const collection = Array.from({ length: 10 }, () => collectedCan());
    const achievements = computeAchievements(collection, 0, 0, null);
    expect(achievements.find(a => a.key === 'haul_10').unlocked).toBe(true);
    expect(achievements.find(a => a.key === 'haul_50').unlocked).toBe(false);
  });

  it('unlocks first_rare only for Rare tier or above', () => {
    const collection = [collectedCan({ can_rarity: 'Uncommon' })];
    expect(computeAchievements(collection, 0, 0, null).find(a => a.key === 'first_rare').unlocked).toBe(false);

    const rareCollection = [collectedCan({ can_rarity: 'Rare' })];
    expect(computeAchievements(rareCollection, 0, 0, null).find(a => a.key === 'first_rare').unlocked).toBe(true);
  });

  it('gates streak achievements on the passed-in streak value', () => {
    const achievements = computeAchievements([], 7, 0, null);
    expect(achievements.find(a => a.key === 'streak_7').unlocked).toBe(true);
    expect(achievements.find(a => a.key === 'streak_30').unlocked).toBe(false);
  });

  it('gates community_pillar/vault_hunter on the passed-in vote count', () => {
    const achievements = computeAchievements([], 0, 20, null);
    expect(achievements.find(a => a.key === 'community_pillar').unlocked).toBe(true);
    expect(achievements.find(a => a.key === 'vault_hunter').unlocked).toBe(true);
  });
});

describe('selectHighlightAchievements', () => {
  it('orders unlocked achievements before locked ones', () => {
    const achievements = computeAchievements([collectedCan()], 0, 0, null);
    const highlighted = selectHighlightAchievements(achievements, achievements.length);
    const firstLockedIndex = highlighted.findIndex(a => !a.unlocked);
    const lastUnlockedIndex = highlighted.map(a => a.unlocked).lastIndexOf(true);
    expect(lastUnlockedIndex).toBeLessThan(firstLockedIndex);
  });

  it('orders locked incremental achievements by proximity to their goal', () => {
    // 9/10 cans -> haul_10 is one can away; nothing else should outrank it
    // among the locked incremental achievements.
    const collection = Array.from({ length: 9 }, () => collectedCan());
    const achievements = computeAchievements(collection, 0, 0, null);
    const highlighted = selectHighlightAchievements(achievements, achievements.length);
    const lockedIncremental = highlighted.filter(a => !a.unlocked && a.incremental);
    expect(lockedIncremental[0].key).toBe('haul_10');
  });

  it('respects the limit', () => {
    const achievements = computeAchievements([], 0, 0, null);
    expect(selectHighlightAchievements(achievements, 3)).toHaveLength(3);
  });
});

describe('selectShelfAchievements', () => {
  const a = (key, unlocked, extra = {}) => ({ key, unlocked, ...extra });

  it('shows the 3 most recent unlocked, then the 2 closest to unlocking', () => {
    const list = [
      a('u1', true, { unlockedAt: '2026-09-01' }), a('u2', true, { unlockedAt: '2026-09-20' }),
      a('u3', true, { unlockedAt: '2026-09-10' }), a('u4', true, { unlockedAt: '2026-08-01' }),
      a('far', false, { incremental: true, progress: { current: 1, goal: 10 } }),
      a('close', false, { incremental: true, progress: { current: 9, goal: 10 } }),
      a('mid', false, { incremental: true, progress: { current: 5, goal: 10 } }),
    ];
    expect(selectShelfAchievements(list).map(x => x.key)).toEqual(['u2', 'u3', 'u1', 'close', 'mid']);
  });

  it('fills with more locked ones when fewer than 3 are unlocked', () => {
    const list = [
      a('only', true, { unlockedAt: '2026-09-01' }),
      a('l1', false, { incremental: true, progress: { current: 8, goal: 10 } }),
      a('l2', false, { incremental: true, progress: { current: 6, goal: 10 } }),
      a('l3', false, { incremental: true, progress: { current: 4, goal: 10 } }),
      a('l4', false, { incremental: true, progress: { current: 2, goal: 10 } }),
      a('l5', false, { incremental: true, progress: { current: 1, goal: 10 } }),
    ];
    expect(selectShelfAchievements(list).map(x => x.key)).toEqual(['only', 'l1', 'l2', 'l3', 'l4']);
  });

  it('shows 5 for a brand-new collector', () => {
    const list = Array.from({ length: 8 }, (_, i) => a(`l${i}`, false));
    expect(selectShelfAchievements(list)).toHaveLength(5);
  });
});
