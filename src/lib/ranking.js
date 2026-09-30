// Competition-style ranking (ties share a rank, e.g. 1, 2, 2, 4) rather than
// plain array-index ranking (1, 2, 3, 4 regardless of ties). Shared by
// CollectorsLeaderboard and RegionalLeaderboard so a tied score can't show a
// different rank number in the row list than in each page's own "Your Rank"
// bar, which already counts ties this way via a `.gt(metric, myMetric)`
// query. `list` must already be sorted descending by `metricKey`.
// Each entry also gets `tieSize`: how many rows share its rank.
export function withCompetitionRank(list, metricKey) {
  let lastValue = null;
  let lastRank = 0;
  const ranked = list.map((entry, i) => {
    const value = entry[metricKey];
    if (value !== lastValue) {
      lastRank = i + 1;
      lastValue = value;
    }
    return { ...entry, rank: lastRank };
  });
  const sizes = {};
  for (const entry of ranked) sizes[entry.rank] = (sizes[entry.rank] || 0) + 1;
  return ranked.map(entry => ({ ...entry, tieSize: sizes[entry.rank] }));
}

// Ties past this size lose their medal: eight rows all wearing bronze is
// not a podium (raw can counts tie often).
export const MAX_MEDAL_TIE = 2;

// Rank label for a row: "#3", or "=3" when shared.
export function rankLabel(entry) {
  return `${entry.tieSize > 1 ? '=' : '#'}${entry.rank}`;
}

// 0/1/2 for gold/silver/bronze, or null for no medal.
export function medalIndex(entry) {
  if (entry.rank > 3 || entry.tieSize > MAX_MEDAL_TIE) return null;
  return entry.rank - 1;
}

// The collector directly above `myValue` in a descending-sorted list (the
// lowest value that still beats it), with the gap. null when nobody is
// above, i.e. you're #1 or unranked.
export function rivalAbove(list, metricKey, myValue) {
  if (!(myValue > 0)) return null;
  let rival = null;
  for (const entry of list) {
    if (entry[metricKey] > myValue) rival = entry;
    else break;
  }
  return rival ? { entry: rival, gap: rival[metricKey] - myValue } : null;
}

// "Priya Shah" -> "Priya S.", short enough for the rank bar's one line.
export function shortName(fullName) {
  const parts = (fullName || 'Collector').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}
