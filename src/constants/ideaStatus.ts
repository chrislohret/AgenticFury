export const IDEA_STATUS = {
  DRAFT: 100000000,
  SUBMITTED: 100000001,
  UNDER_REVIEW: 100000002,
  APPROVED: 100000003,
  REJECTED: 100000004,
  ON_HOLD: 100000005,
  IN_PROGRESS: 100000006,
  COMPLETED: 100000007,
} as const;

export type IdeaStatusValue = (typeof IDEA_STATUS)[keyof typeof IDEA_STATUS];

// Each idea statuscode (Status Reason) belongs to a specific statecode (Status).
// Dataverse rejects a statuscode that does not match the record's current
// statecode unless BOTH are sent together on the update, so writes must include
// the matching statecode. Mirrors the oobLifecycle mapping in
// dataverse/planning-payload.json.
export const IDEA_STATE = {
  ACTIVE: 0,
  INACTIVE: 1,
} as const;

export const IDEA_STATUS_STATECODE: Record<number, number> = {
  [IDEA_STATUS.DRAFT]: IDEA_STATE.ACTIVE,
  [IDEA_STATUS.SUBMITTED]: IDEA_STATE.ACTIVE,
  [IDEA_STATUS.UNDER_REVIEW]: IDEA_STATE.ACTIVE,
  [IDEA_STATUS.APPROVED]: IDEA_STATE.INACTIVE,
  [IDEA_STATUS.REJECTED]: IDEA_STATE.INACTIVE,
  [IDEA_STATUS.ON_HOLD]: IDEA_STATE.ACTIVE,
  [IDEA_STATUS.IN_PROGRESS]: IDEA_STATE.ACTIVE,
  [IDEA_STATUS.COMPLETED]: IDEA_STATE.INACTIVE,
};

export const IDEA_STATUS_LABELS: Record<number, string> = {
  [IDEA_STATUS.DRAFT]: 'Draft',
  [IDEA_STATUS.SUBMITTED]: 'Submitted',
  [IDEA_STATUS.UNDER_REVIEW]: 'Under Review',
  [IDEA_STATUS.APPROVED]: 'Approved',
  [IDEA_STATUS.REJECTED]: 'Rejected',
  [IDEA_STATUS.ON_HOLD]: 'On Hold',
  [IDEA_STATUS.IN_PROGRESS]: 'In Progress',
  [IDEA_STATUS.COMPLETED]: 'Completed',
};

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const IDEA_STATUS_BADGE_VARIANT: Record<number, BadgeVariant> = {
  [IDEA_STATUS.DRAFT]: 'secondary',
  [IDEA_STATUS.SUBMITTED]: 'outline',
  [IDEA_STATUS.UNDER_REVIEW]: 'default',
  [IDEA_STATUS.APPROVED]: 'default',
  [IDEA_STATUS.REJECTED]: 'destructive',
  [IDEA_STATUS.ON_HOLD]: 'secondary',
  [IDEA_STATUS.IN_PROGRESS]: 'default',
  [IDEA_STATUS.COMPLETED]: 'secondary',
};

// Allowed lifecycle transitions. A status may only move to one of the values
// listed for its current state (in addition to staying on itself). This keeps
// the workflow coherent — e.g. an idea cannot jump straight from Draft to
// Completed. The status selector on the submission detail page is constrained
// to these options.
export const LIFECYCLE_TRANSITIONS: Record<number, number[]> = {
  [IDEA_STATUS.DRAFT]: [IDEA_STATUS.SUBMITTED],
  [IDEA_STATUS.SUBMITTED]: [IDEA_STATUS.UNDER_REVIEW, IDEA_STATUS.ON_HOLD, IDEA_STATUS.REJECTED],
  [IDEA_STATUS.UNDER_REVIEW]: [
    IDEA_STATUS.APPROVED,
    IDEA_STATUS.REJECTED,
    IDEA_STATUS.ON_HOLD,
  ],
  [IDEA_STATUS.ON_HOLD]: [IDEA_STATUS.UNDER_REVIEW, IDEA_STATUS.SUBMITTED, IDEA_STATUS.REJECTED],
  [IDEA_STATUS.APPROVED]: [IDEA_STATUS.IN_PROGRESS, IDEA_STATUS.ON_HOLD],
  [IDEA_STATUS.IN_PROGRESS]: [IDEA_STATUS.COMPLETED, IDEA_STATUS.ON_HOLD],
  [IDEA_STATUS.REJECTED]: [IDEA_STATUS.UNDER_REVIEW],
  [IDEA_STATUS.COMPLETED]: [IDEA_STATUS.IN_PROGRESS],
};

/**
 * Returns the selectable statuses for a record currently in `status`: the
 * current status itself plus every allowed forward/backward transition.
 */
export function getAllowedStatusOptions(status: number): number[] {
  const next = LIFECYCLE_TRANSITIONS[status] ?? [];
  return [status, ...next.filter((s) => s !== status)];
}
