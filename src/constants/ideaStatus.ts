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
