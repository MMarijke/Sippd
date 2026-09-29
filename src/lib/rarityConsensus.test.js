import { describe, expect, it } from 'vitest';
import { computeConsensus, computeTrustedStats, pointsAddedSince, getConfidence, getDisplayRarity, getItemScore } from './rarityConsensus';

describe('getConfidence', () => {
  it('is unrated below 5 votes', () => {
    expect(getConfidence(0)).toBe('unrated');
    expect(getConfidence(4)).toBe('unrated');
  });

  it('is low confidence from 5 up to 14 votes', () => {
    expect(getConfidence(5)).toBe('low');
    expect(getConfidence(14)).toBe('low');
  });

  it('is confirmed at 15+ votes', () => {
    expect(getConfidence(15)).toBe('confirmed');
    expect(getConfidence(500)).toBe('confirmed');
  });
});

describe('computeConsensus', () => {
  it('defaults to Common with no votes', () => {
    expect(computeConsensus({})).toBe('Common');
  });

  it('picks the tier with all the votes', () => {
    expect(computeConsensus({ rare_votes: 10 })).toBe('Rare');
  });

  it('resolves an exact tie toward the higher tier', () => {
    // Common(1) + Legendary(5) averages to 3.0 exactly -> Rare, not a coin flip
    expect(computeConsensus({ common_votes: 1, legendary_votes: 1 })).toBe('Rare');
  });
});

describe('getDisplayRarity', () => {
  it('falls back to Common for a missing can', () => {
    expect(getDisplayRarity(null)).toBe('Common');
  });

  it('uses consensus_rarity once the can has votes', () => {
    expect(getDisplayRarity({ total_votes: 5, consensus_rarity: 'Ultra Rare', rarity: 'Common' })).toBe('Ultra Rare');
  });

  it('falls back to the legacy rarity field with no votes yet', () => {
    expect(getDisplayRarity({ total_votes: 0, rarity: 'Rare' })).toBe('Rare');
  });
});

describe('getItemScore', () => {
  it('scores off the item\'s own cached rarity with no shared can', () => {
    expect(getItemScore({ can_rarity: 'Legendary' }, null)).toBe(5);
  });

  it('scores off the cached personal vote while unrated', () => {
    const sharedCan = { total_votes: 2, consensus_rarity: 'Legendary' };
    expect(getItemScore({ can_rarity: 'Common' }, sharedCan)).toBe(1);
  });

  it('scores off community consensus once confirmed', () => {
    const sharedCan = { total_votes: 20, consensus_rarity: 'Ultra Rare' };
    expect(getItemScore({ can_rarity: 'Common' }, sharedCan)).toBe(4);
  });
});

// Must agree with sync_leaderboard_for_user() so a signed-out visitor's
// view of a profile shows the same score and rare pulls the leaderboard
// ranks by (20260914000000_harden_leaderboard_rarity_trust.sql).
describe('computeTrustedStats', () => {
  const map = {
    a: { consensus_rarity: 'Legendary', total_votes: 20 },
    b: { consensus_rarity: 'Common', total_votes: 1 },
    c: { consensus_rarity: null, total_votes: 0 },
  };

  it('scores and counts rare pulls from consensus_rarity only', () => {
    const items = [{ can_id: 'a' }, { can_id: 'b' }];
    expect(computeTrustedStats(items, map)).toEqual({ score: 6, rarePulls: 1 });
  });

  it("ignores the owner's own can_rarity snapshot, even for a thinly voted can", () => {
    // getItemScore would trust can_rarity here (unrated confidence); the
    // leaderboard doesn't, and neither may this.
    const items = [{ can_id: 'b', can_rarity: 'Legendary' }];
    expect(computeTrustedStats(items, map)).toEqual({ score: 1, rarePulls: 0 });
  });

  it('scores a can with no consensus as 1, like the SQL else-branch', () => {
    expect(computeTrustedStats([{ can_id: 'c' }], map)).toEqual({ score: 1, rarePulls: 0 });
  });

  it('skips items with no shared can, like the SQL inner join', () => {
    expect(computeTrustedStats([{ can_id: 'missing', can_rarity: 'Rare' }], map)).toEqual({ score: 0, rarePulls: 0 });
  });
});

describe('pointsAddedSince', () => {
  const map = { a: { consensus_rarity: 'Legendary' }, b: { consensus_rarity: 'Rare' } };
  const since = new Date('2026-09-22T00:00:00Z');

  it('sums trusted points for cans added on or after the cutoff', () => {
    const items = [
      { can_id: 'a', created_at: '2026-09-28T10:00:00Z' },
      { can_id: 'b', created_at: '2026-09-22T00:00:00Z' },
      { can_id: 'b', created_at: '2026-09-21T23:59:59Z' },
    ];
    expect(pointsAddedSince(items, map, since)).toBe(8);
  });

  it('ignores items with no created_at instead of guessing', () => {
    expect(pointsAddedSince([{ can_id: 'a' }], map, since)).toBe(0);
  });
});
