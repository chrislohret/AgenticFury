import {
  SCORECARD_DIMENSIONS,
  SCORECARD_MAX_SCORE,
  SCORECARD_MIN_SCORE,
  type ScorecardDimensionKey,
} from '@/constants/scorecard';

export type ScorecardScores = Partial<Record<ScorecardDimensionKey, number | undefined | null>>;

function clampScore(score: number): number {
  if (score < SCORECARD_MIN_SCORE) return SCORECARD_MIN_SCORE;
  if (score > SCORECARD_MAX_SCORE) return SCORECARD_MAX_SCORE;
  return score;
}

/**
 * Computes the weighted scorecard total on a 0–100 scale using the formula:
 *   sum over dimensions of (score / 5) * weight
 * Dimensions with no score (undefined/null) contribute 0. The result is rounded
 * to two decimal places.
 */
export function computeWeightedTotal(scores: ScorecardScores): number {
  let total = 0;
  for (const dimension of SCORECARD_DIMENSIONS) {
    const raw = scores[dimension.key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      total += (clampScore(raw) / SCORECARD_MAX_SCORE) * dimension.weight;
    }
  }
  return Math.round(total * 100) / 100;
}

/** True when every dimension has a score in the valid 0–5 range. */
export function isScorecardComplete(scores: ScorecardScores): boolean {
  return SCORECARD_DIMENSIONS.every((dimension) => {
    const raw = scores[dimension.key];
    return (
      typeof raw === 'number' &&
      Number.isFinite(raw) &&
      raw >= SCORECARD_MIN_SCORE &&
      raw <= SCORECARD_MAX_SCORE
    );
  });
}
