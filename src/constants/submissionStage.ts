/**
 * Submission stage (`afp_ideasubmissionstage`) — the workflow position of an
 * idea as it moves through CoE intake. Approval/rejection is tracked separately
 * in `afp_approvalstatus`; this field only describes where the submission is in
 * the review pipeline. Values mirror the live Dataverse option set.
 */
export const SUBMISSION_STAGE = {
  IN_REVIEW: 747150000,
  ON_HOLD: 747150001,
  SUBMITTED: 747150003,
  DRAFT: 747150004,
  REVIEW_COMPLETED: 747150006,
} as const;

export type SubmissionStageValue = (typeof SUBMISSION_STAGE)[keyof typeof SUBMISSION_STAGE];

/**
 * Sentinel for the Draft stage. New ideas use an explicit Draft value rather
 * than leaving the field unset, but a missing value is still treated as Draft.
 */
export const SUBMISSION_STAGE_DRAFT = SUBMISSION_STAGE.DRAFT;

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const SUBMISSION_STAGE_LABELS: Record<number, string> = {
  [SUBMISSION_STAGE.DRAFT]: 'Draft',
  [SUBMISSION_STAGE.SUBMITTED]: 'Submitted',
  [SUBMISSION_STAGE.IN_REVIEW]: 'In Review',
  [SUBMISSION_STAGE.REVIEW_COMPLETED]: 'Review Completed',
  [SUBMISSION_STAGE.ON_HOLD]: 'On Hold',
};

/**
 * Submission stages in workflow order, used to render the full picker in the
 * process flow. Review Completed is the gate that unlocks the approval phase.
 */
export const SUBMISSION_STAGE_ORDER: number[] = [
  SUBMISSION_STAGE.DRAFT,
  SUBMISSION_STAGE.SUBMITTED,
  SUBMISSION_STAGE.IN_REVIEW,
  SUBMISSION_STAGE.REVIEW_COMPLETED,
  SUBMISSION_STAGE.ON_HOLD,
];

/** Label for a stage value that may be null/undefined (treated as Draft). */
export function submissionStageLabel(stage: number | null | undefined): string {
  if (stage == null) return 'Draft';
  return SUBMISSION_STAGE_LABELS[stage] ?? `Stage ${stage}`;
}

export const SUBMISSION_STAGE_BADGE_VARIANT: Record<number, BadgeVariant> = {
  [SUBMISSION_STAGE.DRAFT]: 'outline',
  [SUBMISSION_STAGE.SUBMITTED]: 'secondary',
  [SUBMISSION_STAGE.IN_REVIEW]: 'default',
  [SUBMISSION_STAGE.REVIEW_COMPLETED]: 'default',
  [SUBMISSION_STAGE.ON_HOLD]: 'destructive',
};

export function submissionStageBadgeVariant(stage: number | null | undefined): BadgeVariant {
  if (stage == null) return 'outline';
  return SUBMISSION_STAGE_BADGE_VARIANT[stage] ?? 'outline';
}

/**
 * Allowed forward/back transitions per submission stage. Draft begins the flow;
 * Review Completed is the gate that unlocks the approval decision.
 */
export const SUBMISSION_STAGE_TRANSITIONS: Record<number, number[]> = {
  [SUBMISSION_STAGE.DRAFT]: [SUBMISSION_STAGE.SUBMITTED],
  [SUBMISSION_STAGE.SUBMITTED]: [SUBMISSION_STAGE.IN_REVIEW, SUBMISSION_STAGE.ON_HOLD],
  [SUBMISSION_STAGE.IN_REVIEW]: [
    SUBMISSION_STAGE.REVIEW_COMPLETED,
    SUBMISSION_STAGE.ON_HOLD,
  ],
  [SUBMISSION_STAGE.REVIEW_COMPLETED]: [SUBMISSION_STAGE.IN_REVIEW, SUBMISSION_STAGE.ON_HOLD],
  [SUBMISSION_STAGE.ON_HOLD]: [SUBMISSION_STAGE.IN_REVIEW, SUBMISSION_STAGE.SUBMITTED],
};

/**
 * Returns the selectable stages for a record currently at `stage`: the current
 * stage itself plus its allowed transitions. A null stage is treated as Draft.
 */
export function getAllowedSubmissionStages(stage: number | null | undefined): number[] {
  const current = stage ?? SUBMISSION_STAGE.DRAFT;
  const next = SUBMISSION_STAGE_TRANSITIONS[current] ?? [];
  return [current, ...next.filter((s) => s !== current)];
}
