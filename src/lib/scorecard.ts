import {
  SCORECARD_DIMENSIONS,
  SCORECARD_MAX_SCORE,
  SCORECARD_MIN_SCORE,
  type ScorecardDimensionKey,
} from '@/constants/scorecard';

export type ScorecardScores = Partial<Record<ScorecardDimensionKey, number | undefined | null>>;

/** Per-dimension percentage weights. Missing keys fall back to the code default. */
export type ScorecardWeightMap = Partial<Record<ScorecardDimensionKey, number>>;

function clampScore(score: number): number {
  if (score < SCORECARD_MIN_SCORE) return SCORECARD_MIN_SCORE;
  if (score > SCORECARD_MAX_SCORE) return SCORECARD_MAX_SCORE;
  return score;
}

/** Builds a weight map from a list of dimension/weight pairs. */
export function weightsListToMap(
  weights: { dimensionKey: ScorecardDimensionKey; weight: number }[],
): ScorecardWeightMap {
  const map: ScorecardWeightMap = {};
  for (const entry of weights) {
    map[entry.dimensionKey] = entry.weight;
  }
  return map;
}

/**
 * Computes the weighted scorecard total on a 0–100 scale using the formula:
 *   sum over dimensions of (score / 5) * weight
 * Dimensions with no score (undefined/null) contribute 0. When a `weights` map
 * is supplied, each dimension uses its configured weight (falling back to the
 * code default for any missing key); otherwise the code defaults are used. The
 * result is rounded to two decimal places.
 */
export function computeWeightedTotal(scores: ScorecardScores, weights?: ScorecardWeightMap): number {
  let total = 0;
  for (const dimension of SCORECARD_DIMENSIONS) {
    const raw = scores[dimension.key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const weight = weights?.[dimension.key] ?? dimension.weight;
      total += (clampScore(raw) / SCORECARD_MAX_SCORE) * weight;
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
