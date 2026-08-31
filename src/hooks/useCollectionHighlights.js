import { useMemo } from 'react';
import { RARITY_ORDER, getEffectiveRarity as getEffectiveRarityBase } from '@/lib/rarityConsensus';
import { computeAchievements } from '@/lib/achievements';

const RARITY_RANK = { Common: 1, Uncommon: 2, Rare: 3, 'Ultra Rare': 4, Legendary: 5 };

// Shared between ShareCardModal's export card and Profile's live "Top Pulls"
// hero — both surfaces need the same top-6/rarity-breakdown/latest-achievement
// computation. Extracted because the two files' own getEffectiveRarity had
// quietly diverged: Profile's local copy skipped the low-confidence fallback
// ShareCardModal's always applied, and was unused dead code besides.
export function useCollectionHighlights({ collection, sharedCansMap, streak = 0, voteCount = 0, userCreatedDate = null }) {
  const collected = useMemo(
    () => collection.filter(c => c.status === 'collected'),
    [collection]
  );

  const getEffectiveRarity = (item) => getEffectiveRarityBase(item, sharedCansMap);

  const top6 = useMemo(() => {
    const pinned = collected
      .filter(c => c.pinned_at)
      .sort((a, b) => new Date(a.pinned_at) - new Date(b.pinned_at));
    const pinnedIds = new Set(pinned.map(c => c.id));
    const rest = collected
      .filter(c => !pinnedIds.has(c.id))
      .sort((a, b) => (RARITY_RANK[getEffectiveRarity(b)] || 0) - (RARITY_RANK[getEffectiveRarity(a)] || 0));
    return [...pinned, ...rest].slice(0, 6);
  }, [collected, sharedCansMap]);

  const rarityBreakdown = useMemo(() => {
    const counts = {};
    collected.forEach(item => {
      const r = getEffectiveRarity(item);
      counts[r] = (counts[r] || 0) + 1;
    });
    return RARITY_ORDER
      .filter(r => counts[r])
      .map(r => ({ rarity: r, count: counts[r], pct: collected.length ? (counts[r] / collected.length) * 100 : 0 }));
  }, [collected, sharedCansMap]);

  const latestAchievement = useMemo(() => {
    const all = computeAchievements(collection, streak, voteCount, userCreatedDate);
    const unlocked = all.filter(a => a.unlocked);
    const withDate = unlocked.filter(a => a.unlockedAt).sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt));
    return withDate[0] || unlocked[unlocked.length - 1] || null;
  }, [collection, streak, voteCount, userCreatedDate]);

  return { collected, getEffectiveRarity, top6, rarityBreakdown, latestAchievement };
}
