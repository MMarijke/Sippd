import { useMemo } from 'react';
import { RARITY_ORDER, getEffectiveRarity as getEffectiveRarityBase } from '@/lib/rarityConsensus';
import { computeAchievements } from '@/lib/achievements';
import { getMaxPins } from '@/hooks/useTogglePin';

const RARITY_RANK = { Common: 1, Uncommon: 2, Rare: 3, 'Ultra Rare': 4, Legendary: 5 };

// Extracted so PublicProfile.jsx (which shows the full collection, not a
// sliced-to-N highlight set) can still order pinned items first — without
// this, the Trophy Case hero spotlight (always index 0) would land on
// whatever item happens to be first in an otherwise-unordered query result,
// not a genuinely showcased one.
export function sortPinnedFirst(items, getEffectiveRarity) {
  const pinned = items
    .filter(c => c.pinned_at)
    .sort((a, b) => new Date(a.pinned_at) - new Date(b.pinned_at));
  const pinnedIds = new Set(pinned.map(c => c.id));
  const rest = items
    .filter(c => !pinnedIds.has(c.id))
    .sort((a, b) => (RARITY_RANK[getEffectiveRarity(b)] || 0) - (RARITY_RANK[getEffectiveRarity(a)] || 0));
  return [...pinned, ...rest];
}

// Feeds Profile's live "Top Pulls" hero (CollectionCard) — top-N,
// rarity-breakdown, and latest-achievement computation in one place after
// an earlier version of this logic lived duplicated inline in Profile.jsx
// and had quietly diverged from the one other surface that needed it.
export function useCollectionHighlights({ collection, sharedCansMap, streak = 0, voteCount = 0, userCreatedDate = null, isPro = false }) {
  const collected = useMemo(
    () => collection.filter(c => c.status === 'collected'),
    [collection]
  );

  const getEffectiveRarity = (item) => getEffectiveRarityBase(item, sharedCansMap);

  // Cap matches getMaxPins(isPro) — this used to be an independently
  // hardcoded 6 that just happened to match useTogglePin's own MAX_PINS; a
  // Pro user pinning a 7th-10th item would otherwise succeed at the DB
  // layer and then never actually render anywhere. (/impeccable critique)
  const topPulls = useMemo(() => {
    const maxPins = getMaxPins(isPro);
    return sortPinnedFirst(collected, getEffectiveRarity).slice(0, maxPins);
  }, [collected, sharedCansMap, isPro]);

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

  return { collected, getEffectiveRarity, topPulls, rarityBreakdown, latestAchievement };
}
