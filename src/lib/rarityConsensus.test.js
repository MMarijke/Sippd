import { describe, expect, it } from 'vitest';
import { computeConsensus, getConfidence, getDisplayRarity, getItemScore } from './rarityConsensus';

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
