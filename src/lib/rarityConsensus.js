// Rarity tiers in ascending order (index 0 = lowest)
export const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary'];

// Hex values for contexts that can't consume CSS custom properties directly
// (canvas/html2canvas capture, SVG chart fills, inline styles). Kept in sync
// with the --rarity-* tokens in index.css by hand — same colors, two forms.
export const RARITY_HEX = {
  Common: '#6B7280',
  Uncommon: '#22C55E',
  Rare: '#3B82F6',
  'Ultra Rare': '#A855F7',
  Legendary: '#EC4899',
};

// Numeric value per tier for mean-based scoring
export const RARITY_VALUES = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  'Ultra Rare': 4,
  Legendary: 5,
};

// Points per rarity for leaderboard/dashboard scoring
export const RARITY_POINTS = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  'Ultra Rare': 4,
  Legendary: 5,
};

// Vote field names per rarity
export const VOTE_FIELDS = {
  Common: 'common_votes',
  Uncommon: 'uncommon_votes',
  Rare: 'rare_votes',
  'Ultra Rare': 'ultra_rare_votes',
  Legendary: 'legendary_votes',
};

/**
 * Confidence level based on total vote count.
 * unrated: <5 | low: 5-14 | confirmed: 15+
 */
export function getConfidence(totalVotes) {
  if (!totalVotes || totalVotes < 5) return 'unrated';
  if (totalVotes < 15) return 'low';
  return 'confirmed';
}

/**
 * Compute consensus rarity from vote counts using mean-based scoring.
 * Ties resolve toward the higher tier.
 */
export function computeConsensus(can) {
  const votes = {
    Common: can.common_votes || 0,
    Uncommon: can.uncommon_votes || 0,
    Rare: can.rare_votes || 0,
    'Ultra Rare': can.ultra_rare_votes || 0,
    Legendary: can.legendary_votes || 0,
  };

  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  if (total === 0) return 'Common';

  // Weighted mean: sum(tier_value * tier_votes) / total_votes
  const weightedSum = RARITY_ORDER.reduce((acc, tier) => {
    return acc + RARITY_VALUES[tier] * (votes[tier] || 0);
  }, 0);

  const mean = weightedSum / total;

  // Round to nearest integer, clamp to valid range [1,5]
  // Tie between x.5 resolves upward (Math.round rounds .5 up)
  const rounded = Math.min(5, Math.max(1, Math.round(mean)));

  // Map integer back to tier name
  return RARITY_ORDER[rounded - 1];
}

/**
 * Build the updated vote fields when a user submits a vote.
 */
export function buildVoteUpdate(can, votedRarity) {
  const field = VOTE_FIELDS[votedRarity];
  const newCounts = {
    common_votes: can.common_votes || 0,
    uncommon_votes: can.uncommon_votes || 0,
    rare_votes: can.rare_votes || 0,
    ultra_rare_votes: can.ultra_rare_votes || 0,
    legendary_votes: can.legendary_votes || 0,
  };
  newCounts[field] = (newCounts[field] || 0) + 1;
  const total_votes = (can.total_votes || 0) + 1;
  const consensus_rarity = computeConsensus({ ...newCounts, total_votes });
  const confidence = getConfidence(total_votes);
  return { ...newCounts, total_votes, consensus_rarity, confidence };
}

/**
 * Get consensus rarity for display.
 * Falls back to can.rarity for legacy cans with no votes.
 */
export function getDisplayRarity(can) {
  if (!can) return 'Common';
  if (can.total_votes > 0) return can.consensus_rarity || 'Common';
  return can.rarity || 'Common';
}

/**
 * Returns true if the can has enough votes to show a consensus tier.
 * Replaces old `verified` boolean.
 */
export function isRated(can) {
  return (can?.total_votes || 0) >= 5;
}

/**
 * Compute score for a collection item.
 * If unrated, uses the user's personal vote value temporarily.
 */
export function getItemScore(collectionItem, sharedCan) {
  if (!sharedCan) return RARITY_POINTS[collectionItem.can_rarity] || 1;
  const confidence = getConfidence(sharedCan.total_votes);
  if (confidence === 'unrated') {
    // Fall back to cached personal vote value
    return RARITY_POINTS[collectionItem.can_rarity] || 1;
  }
  return RARITY_POINTS[getDisplayRarity(sharedCan)] || 1;
}

/**
 * Compute total score for a collection using the new scoring system.
 */
export function computeCollectionScore(collectionItems, sharedCansMap) {
  return collectionItems
    .filter(c => c.status === 'collected')
    .reduce((acc, c) => {
      const sharedCan = sharedCansMap[c.can_id];
      return acc + getItemScore(c, sharedCan);
    }, 0);
}