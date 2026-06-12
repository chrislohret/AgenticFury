import type { ScorecardWeight } from '@/types/domain-models';
import { SCORECARD_DIMENSIONS } from '@/constants/scorecard';

/**
 * Seed weights mirror the code defaults in SCORECARD_DIMENSIONS (sum = 100).
 * One row per dimension, matching the afp_scorecardweight Dataverse table.
 */
export const mockScorecardWeights: ScorecardWeight[] = SCORECARD_DIMENSIONS.map((dimension) => ({
  id: `weight-${dimension.key}`,
  dimensionKey: dimension.key,
  label: dimension.label,
  weight: dimension.weight,
}));
