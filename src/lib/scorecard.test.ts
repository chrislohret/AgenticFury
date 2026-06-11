import { describe, expect, it } from 'vitest';
import { computeWeightedTotal, isScorecardComplete, type ScorecardScores } from './scorecard';

describe('computeWeightedTotal', () => {
  it('returns 100 when every dimension is the maximum score', () => {
    const scores: ScorecardScores = {
      businessValue: 5,
      efficiency: 5,
      adoption: 5,
      trustGovernance: 5,
      technicalPerformance: 5,
    };
    expect(computeWeightedTotal(scores)).toBe(100);
  });

  it('returns 0 when every dimension is the minimum score', () => {
    const scores: ScorecardScores = {
      businessValue: 0,
      efficiency: 0,
      adoption: 0,
      trustGovernance: 0,
      technicalPerformance: 0,
    };
    expect(computeWeightedTotal(scores)).toBe(0);
  });

  it('applies the weighted formula for a mixed scorecard', () => {
    // ((4/5)*25)+((3/5)*20)+((4/5)*15)+((3/5)*25)+((4/5)*15)
    // = 20 + 12 + 12 + 15 + 12 = 71
    const scores: ScorecardScores = {
      businessValue: 4,
      efficiency: 3,
      adoption: 4,
      trustGovernance: 3,
      technicalPerformance: 4,
    };
    expect(computeWeightedTotal(scores)).toBe(71);
  });

  it('treats undefined/null dimensions as contributing 0', () => {
    const scores: ScorecardScores = { businessValue: 5 };
    expect(computeWeightedTotal(scores)).toBe(25);
  });

  it('clamps out-of-range scores to the 0–5 bounds', () => {
    const scores: ScorecardScores = {
      businessValue: 9,
      efficiency: -3,
      adoption: 5,
      trustGovernance: 5,
      technicalPerformance: 5,
    };
    // BV clamps to 5 → 25, Eff clamps to 0 → 0, others max → 15+25+15
    expect(computeWeightedTotal(scores)).toBe(80);
  });
});

describe('isScorecardComplete', () => {
  it('is true only when all five dimensions have a valid score', () => {
    expect(
      isScorecardComplete({
        businessValue: 0,
        efficiency: 1,
        adoption: 2,
        trustGovernance: 3,
        technicalPerformance: 4,
      }),
    ).toBe(true);
  });

  it('is false when a dimension is missing', () => {
    expect(
      isScorecardComplete({
        businessValue: 4,
        efficiency: 3,
        adoption: 4,
        trustGovernance: 3,
      }),
    ).toBe(false);
  });
});
