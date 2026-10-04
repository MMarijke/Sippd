import { describe, it, expect } from 'vitest';
import { filterAndSortCollection } from './filterCollection';

// getEffectiveRarity in the real app resolves through sharedCansMap
// (Collection.jsx) — tests here just read can_rarity directly off the item,
// since filterAndSortCollection has no idea where that value came from.
const effectiveRarity = (item) => item.can_rarity;

const baseFilters = { status: 'all', rarity: 'all', beverageType: 'all', favourites: false, sort: 'date_desc' };

function makeItem(overrides) {
  return {
    id: 'item-1',
    status: 'collected',
    can_rarity: 'Common',
    can_beverage_type: 'energy_drink',
    is_favourite: false,
    can_name: 'Test Can',
    can_brand: 'Test Brand',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('filterAndSortCollection', () => {
  it('returns every item when no filters are active and no search query', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    const result = filterAndSortCollection(items, baseFilters, '', effectiveRarity);
    expect(result.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('filters by status', () => {
    const items = [
      makeItem({ id: 'collected', status: 'collected' }),
      makeItem({ id: 'wishlist', status: 'wishlist' }),
    ];
    const result = filterAndSortCollection(items, { ...baseFilters, status: 'wishlist' }, '', effectiveRarity);
    expect(result.map(i => i.id)).toEqual(['wishlist']);
  });

  it('filters by rarity using the provided getEffectiveRarity, not a raw field read', () => {
    const items = [
      makeItem({ id: 'common', can_rarity: 'Common' }),
      makeItem({ id: 'legendary', can_rarity: 'Legendary' }),
    ];
    const result = filterAndSortCollection(items, { ...baseFilters, rarity: 'Legendary' }, '', effectiveRarity);
    expect(result.map(i => i.id)).toEqual(['legendary']);
  });

  it('filters by beverage type', () => {
    const items = [
      makeItem({ id: 'energy', can_beverage_type: 'energy_drink' }),
      makeItem({ id: 'soft', can_beverage_type: 'soft_drink' }),
    ];
    const result = filterAndSortCollection(items, { ...baseFilters, beverageType: 'soft_drink' }, '', effectiveRarity);
    expect(result.map(i => i.id)).toEqual(['soft']);
  });

  it('filters to favourites only', () => {
    const items = [
      makeItem({ id: 'fav', is_favourite: true }),
      makeItem({ id: 'not-fav', is_favourite: false }),
    ];
    const result = filterAndSortCollection(items, { ...baseFilters, favourites: true }, '', effectiveRarity);
    expect(result.map(i => i.id)).toEqual(['fav']);
  });

  it('combines multiple active filters (AND, not OR)', () => {
    const items = [
      makeItem({ id: 'match', status: 'collected', can_beverage_type: 'soft_drink', is_favourite: true }),
      makeItem({ id: 'wrong-status', status: 'wishlist', can_beverage_type: 'soft_drink', is_favourite: true }),
      makeItem({ id: 'wrong-type', status: 'collected', can_beverage_type: 'energy_drink', is_favourite: true }),
      makeItem({ id: 'not-fav', status: 'collected', can_beverage_type: 'soft_drink', is_favourite: false }),
    ];
    const result = filterAndSortCollection(
      items,
      { ...baseFilters, status: 'collected', beverageType: 'soft_drink', favourites: true },
      '',
      effectiveRarity
    );
    expect(result.map(i => i.id)).toEqual(['match']);
  });

  describe('search query', () => {
    it('is ignored below the 2-character threshold', () => {
      const items = [makeItem({ id: 'a', can_name: 'Zzz Nomatch' })];
      const result = filterAndSortCollection(items, baseFilters, 'q', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['a']);
    });

    it('matches against can_name case-insensitively', () => {
      const items = [
        makeItem({ id: 'match', can_name: 'Blue Bolt Energy' }),
        makeItem({ id: 'no-match', can_name: 'Cherry Cola' }),
      ];
      const result = filterAndSortCollection(items, baseFilters, 'BLUE bolt', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['match']);
    });

    it('matches against can_brand case-insensitively', () => {
      const items = [
        makeItem({ id: 'match', can_name: 'Whatever', can_brand: 'Monster' }),
        makeItem({ id: 'no-match', can_name: 'Whatever', can_brand: 'Red Bull' }),
      ];
      const result = filterAndSortCollection(items, baseFilters, 'monster', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['match']);
    });

    it('still excludes an item that matches the search query but fails another active filter', () => {
      // status/rarity/beverageType/favourites are all checked before the
      // search branch runs — a search match does not bypass them.
      const items = [makeItem({ id: 'a', can_name: 'Match Me', status: 'wishlist' })];
      const result = filterAndSortCollection(
        items,
        { ...baseFilters, status: 'collected' },
        'match',
        effectiveRarity
      );
      expect(result).toEqual([]);
    });

    it('includes an item that matches the search query and every active filter', () => {
      const items = [makeItem({ id: 'a', can_name: 'Match Me', status: 'collected' })];
      const result = filterAndSortCollection(
        items,
        { ...baseFilters, status: 'collected' },
        'match',
        effectiveRarity
      );
      expect(result.map(i => i.id)).toEqual(['a']);
    });
  });

  describe('sorting', () => {
    const items = [
      makeItem({ id: 'mid', can_brand: 'Monster', can_rarity: 'Rare', created_at: '2026-02-01T00:00:00Z' }),
      makeItem({ id: 'early', can_brand: 'Arizona', can_rarity: 'Common', created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ id: 'late', can_brand: 'Zevia', can_rarity: 'Legendary', created_at: '2026-03-01T00:00:00Z' }),
    ];

    it('date_desc (default): newest created_at first', () => {
      const result = filterAndSortCollection(items, { ...baseFilters, sort: 'date_desc' }, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['late', 'mid', 'early']);
    });

    it('date_asc: oldest created_at first', () => {
      const result = filterAndSortCollection(items, { ...baseFilters, sort: 'date_asc' }, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['early', 'mid', 'late']);
    });

    it('brand_asc: A→Z by can_brand', () => {
      const result = filterAndSortCollection(items, { ...baseFilters, sort: 'brand_asc' }, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['early', 'mid', 'late']); // Arizona, Monster, Zevia
    });

    it('brand_desc: Z→A by can_brand', () => {
      const result = filterAndSortCollection(items, { ...baseFilters, sort: 'brand_desc' }, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['late', 'mid', 'early']);
    });

    it('rarity_desc: Legendary→Common', () => {
      const result = filterAndSortCollection(items, { ...baseFilters, sort: 'rarity_desc' }, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['late', 'mid', 'early']); // Legendary, Rare, Common
    });

    it('rarity_asc: Common→Legendary', () => {
      const result = filterAndSortCollection(items, { ...baseFilters, sort: 'rarity_asc' }, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['early', 'mid', 'late']);
    });

    it('date sorts use the collector date over when the can was logged', () => {
      const backdated = makeItem({ id: 'backdated', can_brand: 'X', acquired_on: '2025-01-01', created_at: '2026-04-01T00:00:00Z' });
      const result = filterAndSortCollection([...items, backdated], { ...baseFilters, sort: 'date_asc' }, '', effectiveRarity);
      expect(result[0].id).toBe('backdated');
    });

    it('falls back to date_desc when filters.sort is unset', () => {
      const { sort, ...withoutSort } = baseFilters;
      const result = filterAndSortCollection(items, withoutSort, '', effectiveRarity);
      expect(result.map(i => i.id)).toEqual(['late', 'mid', 'early']);
    });
  });

  it('returns an empty array when nothing matches, without throwing', () => {
    const items = [makeItem({ id: 'a', status: 'collected' })];
    const result = filterAndSortCollection(items, { ...baseFilters, status: 'wishlist' }, '', effectiveRarity);
    expect(result).toEqual([]);
  });

  it('does not mutate the original collection array', () => {
    const items = [
      makeItem({ id: 'a', created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ id: 'b', created_at: '2026-02-01T00:00:00Z' }),
    ];
    const originalOrder = items.map(i => i.id);
    filterAndSortCollection(items, { ...baseFilters, sort: 'date_asc' }, '', effectiveRarity);
    expect(items.map(i => i.id)).toEqual(originalOrder);
  });
});
