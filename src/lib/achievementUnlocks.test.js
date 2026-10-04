import { describe, expect, it } from 'vitest';
import { planUnlocks, summaryText } from './achievementUnlocks';

const a = (key, unlocked = true) => ({ key, title: key.toUpperCase(), unlocked });

describe('planUnlocks', () => {
  it('does nothing when nothing new unlocked', () => {
    const plan = planUnlocks([a('x'), a('y', false)], new Set(['x']), true);
    expect(plan.fresh).toEqual([]);
    expect(plan.animate).toEqual([]);
    expect(plan.summary).toEqual([]);
  });

  it('celebrates a single unlock with the full pop-up and posts it', () => {
    const plan = planUnlocks([a('x'), a('y')], new Set(['x']), true);
    expect(plan.animate.map(x => x.key)).toEqual(['y']);
    expect(plan.summary).toEqual([]);
    expect(plan.post.map(x => x.key)).toEqual(['y']);
  });

  it('summarises several unlocks at once on a known device, still posting them', () => {
    const plan = planUnlocks([a('x'), a('y'), a('z')], new Set(), true);
    expect(plan.animate).toEqual([]);
    expect(plan.summary.map(x => x.key)).toEqual(['x', 'y', 'z']);
    expect(plan.post.map(x => x.key)).toEqual(['x', 'y', 'z']);
  });

  it('on a new device, summarises what was already earned and posts nothing', () => {
    const plan = planUnlocks([a('x'), a('y')], new Set(), false);
    expect(plan.animate).toEqual([]);
    expect(plan.summary.map(x => x.key)).toEqual(['x', 'y']);
    expect(plan.post).toEqual([]);
  });

  it('on a new device, even a single earned achievement is a summary, not a replay', () => {
    const plan = planUnlocks([a('x')], new Set(), false);
    expect(plan.animate).toEqual([]);
    expect(plan.summary.map(x => x.key)).toEqual(['x']);
  });
});

describe('summaryText', () => {
  it('names up to three, then counts the rest', () => {
    expect(summaryText([a('x')])).toEqual({ title: '1 achievement unlocked', description: 'X' });
    const many = summaryText(['a', 'b', 'c', 'd', 'e'].map(k => a(k)));
    expect(many.title).toBe('5 achievements unlocked');
    expect(many.description).toBe('A, B, C and 2 more');
  });
});
