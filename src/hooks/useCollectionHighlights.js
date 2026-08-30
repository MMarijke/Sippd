import { useMemo } from 'react';
import { getDisplayRarity, getConfidence, RARITY_ORDER } from '@/lib/rarityConsensus';
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

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    if (!sc) return item.can_rarity || 'Common';
    const conf = getConfidence(sc.total_votes);
    return conf === 'unrated' ? (item.can_rarity || 'Common') : getDisplayRarity(sc);
  };

  const top6 = useMemo(() => {
    return [...collected]
      .sort((a, b) => (RARITY_RANK[getEffectiveRarity(b)] || 0) - (RARITY_RANK[getEffectiveRarity(a)] || 0))
      .slice(0, 6);
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
