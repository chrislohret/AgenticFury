// Scorecard rubric for evaluating a submitted idea across five weighted
// dimensions. Each dimension is scored 0–5; the weights below sum to 100 and
// drive the weighted total (see src/lib/scorecard.ts). These weights are the
// app-level DEFAULTS — admins can override them via the Scorecard Configuration
// page (stored in the afp_scorecardweight Dataverse table). When that table is
// empty the app falls back to the defaults defined here.

export type ScorecardDimensionKey =
  | 'businessValue'
  | 'efficiency'
  | 'adoption'
  | 'trustGovernance'
  | 'technicalPerformance';

export interface ScorecardRubricLevel {
  score: number;
  meaning: string;
}

export interface ScorecardDimension {
  key: ScorecardDimensionKey;
  label: string;
  /** Dataverse Whole Number column holding the 0–5 score. */
  scoreFieldLogicalName: string;
  /** Dataverse Memo column holding the optional justification note. */
  notesFieldLogicalName: string;
  /** Percentage weight applied to this dimension. All weights sum to 100. */
  weight: number;
  description: string;
  rubric: ScorecardRubricLevel[];
}

export const SCORECARD_MIN_SCORE = 0;
export const SCORECARD_MAX_SCORE = 5;
export const SCORECARD_MAX_TOTAL = 100;

export const SCORECARD_DIMENSIONS: ScorecardDimension[] = [
  {
    key: 'businessValue',
    label: 'Business Value',
    scoreFieldLogicalName: 'afp_businessvaluescore',
    notesFieldLogicalName: 'afp_businessvaluenotes',
    weight: 25,
    description: 'Strategic and measurable business impact of the idea.',
    rubric: [
      { score: 0, meaning: 'No clear business problem' },
      { score: 1, meaning: 'Nice-to-have productivity improvement' },
      { score: 2, meaning: 'Local team benefit' },
      { score: 3, meaning: 'Department-level measurable impact' },
      { score: 4, meaning: 'Enterprise or customer-facing measurable impact' },
      { score: 5, meaning: 'Strategic / revenue / mission-critical transformation' },
    ],
  },
  {
    key: 'efficiency',
    label: 'Operational Efficiency',
    scoreFieldLogicalName: 'afp_efficiencyscore',
    notesFieldLogicalName: 'afp_efficiencynotes',
    weight: 20,
    description: 'Time savings, automation, and process throughput gains.',
    rubric: [
      { score: 0, meaning: 'No efficiency gain' },
      { score: 1, meaning: 'Minor time savings' },
      { score: 2, meaning: 'Automates part of a task' },
      { score: 3, meaning: 'Reduces cycle time or manual effort materially' },
      { score: 4, meaning: 'Automates multi-step workflow with measurable savings' },
      { score: 5, meaning: 'Redesigns end-to-end process with major throughput gain' },
    ],
  },
  {
    key: 'adoption',
    label: 'Adoption & Experience',
    scoreFieldLogicalName: 'afp_adoptionscore',
    notesFieldLogicalName: 'afp_adoptionnotes',
    weight: 15,
    description: 'Clarity of the user group and fit into daily workflows.',
    rubric: [
      { score: 0, meaning: 'No clear user group' },
      { score: 1, meaning: 'Small, uncertain audience' },
      { score: 2, meaning: 'Defined users but weak workflow fit' },
      { score: 3, meaning: 'Clear users and repeatable usage pattern' },
      { score: 4, meaning: 'Strong workflow integration' },
      { score: 5, meaning: 'Embedded into daily operations / high expected reliance' },
    ],
  },
  {
    key: 'trustGovernance',
    label: 'Trust & Governance',
    scoreFieldLogicalName: 'afp_trustgovernancescore',
    notesFieldLogicalName: 'afp_trustgovernancenotes',
    weight: 25,
    description: 'A higher score means better governed — not higher risk.',
    rubric: [
      { score: 0, meaning: 'No controls defined' },
      { score: 1, meaning: 'High-risk data/actions with weak oversight' },
      { score: 2, meaning: 'Some controls, incomplete ownership' },
      { score: 3, meaning: 'Defined ownership, access boundaries, and human oversight' },
      { score: 4, meaning: 'Auditable, policy-aligned, monitored' },
      { score: 5, meaning: 'Fully governed, transparent, monitored, and ready for regulated use' },
    ],
  },
  {
    key: 'technicalPerformance',
    label: 'Technical Performance',
    scoreFieldLogicalName: 'afp_technicalperformancescore',
    notesFieldLogicalName: 'afp_technicalperformancenotes',
    weight: 15,
    description: 'Feasibility, data/integration readiness, and evaluation path.',
    rubric: [
      { score: 0, meaning: 'Feasibility unknown' },
      { score: 1, meaning: 'Major technical blockers' },
      { score: 2, meaning: 'Data or integration gaps' },
      { score: 3, meaning: 'Feasible with known constraints' },
      { score: 4, meaning: 'Strong data, integration, and evaluation path' },
      { score: 5, meaning: 'Production-ready architecture with evals, telemetry, and monitoring' },
    ],
  },
];

/**
 * Decision bands applied to a scorecard's 0–100 weighted total. They turn the
 * numeric score into an actionable recommendation. Bands are evaluated
 * top-to-bottom by descending `min`, so the first band whose `min` the total
 * meets or exceeds wins. These are app-level defaults.
 */
export interface ScoreBand {
  key: 'recommend' | 'conditional' | 'decline';
  label: string;
  /** Inclusive lower bound on the 0–100 weighted total. */
  min: number;
  badgeVariant: 'default' | 'secondary' | 'destructive';
  description: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  {
    key: 'recommend',
    label: 'Recommended for Approval',
    min: 75,
    badgeVariant: 'default',
    description: 'Strong across dimensions — recommended to approve.',
  },
  {
    key: 'conditional',
    label: 'Conditional',
    min: 50,
    badgeVariant: 'secondary',
    description: 'Promising but needs conditions or follow-up before approval.',
  },
  {
    key: 'decline',
    label: 'Decline',
    min: 0,
    badgeVariant: 'destructive',
    description: 'Below the bar — recommended to decline or rework.',
  },
];

/**
 * Returns the decision band for a weighted total, or null when no score exists.
 */
export function getScoreBand(total: number | undefined | null): ScoreBand | null {
  if (typeof total !== 'number' || Number.isNaN(total)) return null;
  return SCORE_BANDS.find((band) => total >= band.min) ?? null;
}
