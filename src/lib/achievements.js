export const ACHIEVEMENT_DEFINITIONS = [
  {
    key: 'first_can', title: 'First Can', description: 'Add your first can to the vault', icon: '⚡',
    incremental: false, check: ({ collected }) => collected.length >= 1,
    getDate: ({ collected }) => collected[0]?.created_at,
  },
  {
    key: 'first_rare', title: 'First Rare Pull', description: 'Add your first Rare or higher can', icon: '★',
    incremental: false, check: ({ rarePlus }) => rarePlus.length >= 1,
    getDate: ({ rarePlus }) => rarePlus[0]?.created_at,
  },
  {
    key: 'ultra_find', title: 'Ultra Find', description: 'Collect your first Ultra Rare can', icon: '✦',
    incremental: false, check: ({ ultraRare }) => ultraRare.length >= 1,
    getDate: ({ ultraRare }) => ultraRare[0]?.created_at,
  },
  {
    key: 'limited_edition', title: 'Legend Status', description: 'Collect your first Legendary can', icon: '👑',
    incremental: false, check: ({ limited }) => limited.length >= 1,
    getDate: ({ limited }) => limited[0]?.created_at,
  },
  {
    key: 'first_wishlist', title: 'First Wishlist Add', description: 'Add your first can to your wishlist', icon: '📋',
    incremental: false, check: ({ wishlist }) => wishlist.length >= 1,
    getDate: ({ wishlist }) => wishlist[0]?.created_at,
  },
  {
    key: 'first_favourite', title: 'First Favourite', description: 'Star your first can', icon: '⭐',
    incremental: false, check: ({ favourites }) => favourites.length >= 1,
    getDate: ({ favourites }) => favourites[0]?.created_at,
  },
  {
    key: 'early_adopter', title: 'Early Adopter', description: 'Join Sippd in its first year', icon: '🚀',
    incremental: false,
    check: ({ userCreatedDate }) => { if (!userCreatedDate) return false; return new Date(userCreatedDate) < new Date('2027-05-14'); },
    getDate: ({ userCreatedDate }) => userCreatedDate,
  },
  {
    key: 'haul_10', title: 'Haul of 10', description: 'Collect 10 cans', icon: '🥫', incremental: true, goal: 10,
    getProgress: ({ collected }) => ({ current: collected.length, goal: 10, label: 'cans' }),
    check: ({ collected }) => collected.length >= 10, getDate: ({ collected }) => collected[9]?.created_at,
  },
  {
    key: 'haul_50', title: 'Haul of 50', description: 'Collect 50 cans', icon: '📦', incremental: true, goal: 50,
    getProgress: ({ collected }) => ({ current: collected.length, goal: 50, label: 'cans' }),
    check: ({ collected }) => collected.length >= 50, getDate: ({ collected }) => collected[49]?.created_at,
  },
  {
    key: 'haul_100', title: 'Haul of 100', description: 'Collect 100 cans', icon: '🏆', incremental: true, goal: 100,
    getProgress: ({ collected }) => ({ current: collected.length, goal: 100, label: 'cans' }),
    check: ({ collected }) => collected.length >= 100, getDate: ({ collected }) => collected[99]?.created_at,
  },
  {
    key: 'streak_7', title: 'Streak: 7 Days', description: 'Log activity 7 days in a row', icon: '🔥', incremental: true, goal: 7,
    getProgress: ({ streak }) => ({ current: Math.min(streak, 7), goal: 7, label: 'days' }),
    check: ({ streak }) => streak >= 7, getDate: () => null,
  },
  {
    key: 'streak_30', title: 'Streak: 30 Days', description: 'Log activity 30 days in a row', icon: '💥', incremental: true, goal: 30,
    getProgress: ({ streak }) => ({ current: Math.min(streak, 30), goal: 30, label: 'days' }),
    check: ({ streak }) => streak >= 30, getDate: () => null,
  },
  {
    key: 'rare_collector', title: 'Rare Collector', description: 'Collect 5 Rare or higher cans', icon: '💎', incremental: true, goal: 5,
    getProgress: ({ rarePlus }) => ({ current: rarePlus.length, goal: 5, label: 'rare cans' }),
    check: ({ rarePlus }) => rarePlus.length >= 5, getDate: ({ rarePlus }) => rarePlus[4]?.created_at,
  },
  {
    key: 'wishlist_hunter', title: 'Wishlist Hunter', description: 'Add 10 cans to your wishlist', icon: '🎁', incremental: true, goal: 10,
    getProgress: ({ wishlist }) => ({ current: wishlist.length, goal: 10, label: 'wishlist cans' }),
    check: ({ wishlist }) => wishlist.length >= 10, getDate: ({ wishlist }) => wishlist[9]?.created_at,
  },
  {
    key: 'brand_completionist', title: 'Brand Completionist', description: 'Collect 5 variants from the same brand', icon: '🎯', incremental: true, goal: 5,
    getProgress: ({ topBrand }) => ({ current: topBrand.count, goal: 5, label: topBrand.name ? `${topBrand.name} variants` : 'variants from one brand' }),
    check: ({ topBrand }) => topBrand.count >= 5, getDate: ({ topBrand }) => topBrand.date || null,
  },
  {
    key: 'brand_collector', title: 'Brand Collector', description: 'Collect 5 cans from the same brand', icon: '🏪', incremental: true, goal: 5,
    getProgress: ({ topBrand }) => ({ current: topBrand.count, goal: 5, label: topBrand.name ? `${topBrand.name} cans` : 'cans from one brand' }),
    check: ({ topBrand }) => topBrand.count >= 5, getDate: ({ topBrand }) => topBrand.date || null,
  },
  {
    key: 'community_pillar', title: 'Community Pillar', description: 'Contribute 20 rarity votes total', icon: '🌐', incremental: true, goal: 20,
    getProgress: ({ voteCount }) => ({ current: Math.min(voteCount, 20), goal: 20, label: 'votes' }),
    check: ({ voteCount }) => voteCount >= 20, getDate: () => null,
  },
  {
    key: 'vault_hunter', title: 'Vault Hunter', description: 'Push 5 cans from Unrated to Low Confidence by voting', icon: '🔍', incremental: true, goal: 5,
    getProgress: ({ voteCount }) => ({ current: Math.min(voteCount, 5), goal: 5, label: 'cans rated' }),
    check: ({ voteCount }) => voteCount >= 5, getDate: () => null,
  },
];

/**
 * Shared ordering: unlocked ones first (most recently unlocked first),
 * then locked incremental ones ordered by how close they are to unlocking.
 */
function sortAchievements(achievements) {
  const unlocked = [...achievements.filter(a => a.unlocked)].sort((a, b) => {
    if (a.unlockedAt && b.unlockedAt) return new Date(b.unlockedAt) - new Date(a.unlockedAt);
    if (a.unlockedAt) return -1;
    if (b.unlockedAt) return 1;
    return 0;
  });

  const locked = [...achievements.filter(a => !a.unlocked)].sort((a, b) => {
    const pctA = a.incremental && a.progress ? a.progress.current / a.progress.goal : 0;
    const pctB = b.incremental && b.progress ? b.progress.current / b.progress.goal : 0;
    return pctB - pctA;
  });

  return [...unlocked, ...locked];
}

/**
 * Pick achievements for a compact highlight strip: sortAchievements'
 * ordering, capped at `limit`.
 */
export function selectHighlightAchievements(achievements, limit = 10) {
  return sortAchievements(achievements).slice(0, limit);
}

/**
 * Order the full achievements gallery the same way as the highlight strip
 * (unlocked-first, then closest-to-unlocking), uncapped — every achievement
 * still shows, just in the order that actually answers "what's next".
 */
export function sortAchievementsForGallery(achievements) {
  return sortAchievements(achievements);
}

export function computeAchievements(collection, streak = 0, voteCount = 0, userCreatedDate = null) {
  const collected = collection.filter(c => c.status === 'collected').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const wishlist = collection.filter(c => c.status === 'wishlist').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const favourites = collection.filter(c => c.is_favourite).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const rarePlus = collected.filter(c => ['Rare', 'Ultra Rare', 'Legendary'].includes(c.can_rarity)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const ultraRare = collected.filter(c => c.can_rarity === 'Ultra Rare').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const limited = collected.filter(c => c.can_rarity === 'Legendary').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const brandCounts = {};
  const brandDates = {};
  collected.forEach(c => {
    const b = c.can_brand || 'Unknown';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
    if (!brandDates[b]) brandDates[b] = c.created_at;
  });
  const topBrandName = Object.keys(brandCounts).sort((a, b) => brandCounts[b] - brandCounts[a])[0] || null;
  const topBrand = { name: topBrandName, count: topBrandName ? brandCounts[topBrandName] : 0, date: topBrandName ? brandDates[topBrandName] : null };

  const ctx = { collected, wishlist, favourites, rarePlus, ultraRare, limited, streak, topBrand, voteCount, userCreatedDate };

  return ACHIEVEMENT_DEFINITIONS.map(def => {
    const unlocked = def.check(ctx);
    const progress = def.incremental ? def.getProgress(ctx) : null;
    return { key: def.key, title: def.title, description: def.description, icon: def.icon, incremental: def.incremental, progress, unlocked, unlockedAt: unlocked ? def.getDate(ctx) : null };
  });
}
