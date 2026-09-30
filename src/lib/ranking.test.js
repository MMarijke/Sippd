import { describe, it, expect } from 'vitest';
import { withCompetitionRank, rankLabel, medalIndex, rivalAbove, shortName } from './ranking';

const rows = values => values.map((score, i) => ({ user_id: `u${i}`, score }));

describe('withCompetitionRank', () => {
  it('shares ranks across ties and skips the next ones', () => {
    const r = withCompetitionRank(rows([50, 40, 40, 30]), 'score');
    expect(r.map(e => e.rank)).toEqual([1, 2, 2, 4]);
    expect(r.map(e => e.tieSize)).toEqual([1, 2, 2, 1]);
  });
});

describe('rankLabel', () => {
  it('marks shared ranks with =', () => {
    const r = withCompetitionRank(rows([50, 40, 40]), 'score');
    expect(r.map(rankLabel)).toEqual(['#1', '=2', '=2']);
  });
});

describe('medalIndex', () => {
  it('gives the podium medals and none past 3', () => {
    const r = withCompetitionRank(rows([50, 40, 30, 20]), 'score');
    expect(r.map(medalIndex)).toEqual([0, 1, 2, null]);
  });

  it('keeps medals for a two-way tie', () => {
    const r = withCompetitionRank(rows([50, 50, 30]), 'score');
    expect(r.map(medalIndex)).toEqual([0, 0, 2]);
  });

  it('drops the medal once a tie is bigger than two', () => {
    const r = withCompetitionRank(rows([50, 40, 30, 30, 30, 30]), 'score');
    expect(r.map(medalIndex)).toEqual([0, 1, null, null, null, null]);
  });
});

describe('rivalAbove', () => {
  const list = rows([50, 40, 35, 29, 29, 10]);

  it('finds the closest collector ahead and the gap', () => {
    expect(rivalAbove(list, 'score', 29)).toEqual({ entry: list[2], gap: 6 });
  });

  it('skips people tied with you', () => {
    expect(rivalAbove(list, 'score', 10).entry).toBe(list[4]);
  });

  it('is null at the top or when unranked', () => {
    expect(rivalAbove(list, 'score', 50)).toBeNull();
    expect(rivalAbove(list, 'score', 0)).toBeNull();
  });
});

describe('shortName', () => {
  it('keeps the first name and last initial', () => {
    expect(shortName('Priya Shah')).toBe('Priya S.');
    expect(shortName('Ana de la Cruz')).toBe('Ana C.');
    expect(shortName('Mo')).toBe('Mo');
    expect(shortName(null)).toBe('Collector');
  });
});
