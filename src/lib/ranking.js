// Competition-style ranking (ties share a rank, e.g. 1, 2, 2, 4) rather than
// plain array-index ranking (1, 2, 3, 4 regardless of ties). Shared by
// CollectorsLeaderboard and RegionalLeaderboard so a tied score can't show a
// different rank number in the row list than in each page's own "Your Rank"
// banner, which already counts ties this way via a `.gt(metric, myMetric)`
// query. `list` must already be sorted descending by `metricKey`.
export function withCompetitionRank(list, metricKey) {
  let lastValue = null;
  let lastRank = 0;
  return list.map((entry, i) => {
    const value = entry[metricKey];
    if (value !== lastValue) {
      lastRank = i + 1;
      lastValue = value;
    }
    return { ...entry, rank: lastRank };
  });
}
