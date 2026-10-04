import { RARITY_ORDER } from '@/lib/rarityConsensus';
import { byAcquiredDesc } from '@/lib/canDate';

/**
 * Filters and sorts a user_collection array by the same rules Collection.jsx's
 * FilterBar drives — extracted out of Collection.jsx's own useMemo (behavior
 * unchanged) specifically so this logic (search, status/rarity/beverage
 * filters, favourites, six sort orders) can be unit tested without mounting
 * the whole page and its Supabase/react-query/router dependencies.
 *
 * getEffectiveRarity is passed in rather than imported, matching how
 * Collection.jsx already threads it through to CollectionCard elsewhere —
 * it depends on that page's own sharedCansMap, which this function has no
 * business knowing about.
 */
export function filterAndSortCollection(collection, filters, searchQuery, getEffectiveRarity) {
  return collection
    .filter(item => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.rarity !== 'all' && getEffectiveRarity(item) !== filters.rarity) return false;
      if (filters.beverageType !== 'all' && item.can_beverage_type !== filters.beverageType) return false;
      if (filters.favourites && !item.is_favourite) return false;
      if (searchQuery.length >= 2) {
        const q = searchQuery.toLowerCase();
        return (
          item.can_name?.toLowerCase().includes(q) ||
          item.can_brand?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const sort = filters.sort || 'date_desc';
      // By when the collector got the can (their own date, else when logged).
      if (sort === 'date_asc') return byAcquiredDesc(b, a);
      if (sort === 'date_desc') return byAcquiredDesc(a, b);
      if (sort === 'brand_asc') return (a.can_brand || '').localeCompare(b.can_brand || '');
      if (sort === 'brand_desc') return (b.can_brand || '').localeCompare(a.can_brand || '');
      if (sort === 'rarity_desc') return RARITY_ORDER.indexOf(getEffectiveRarity(b)) - RARITY_ORDER.indexOf(getEffectiveRarity(a));
      if (sort === 'rarity_asc') return RARITY_ORDER.indexOf(getEffectiveRarity(a)) - RARITY_ORDER.indexOf(getEffectiveRarity(b));
      return 0;
    });
}
