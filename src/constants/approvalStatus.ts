import { SUBMISSION_STAGE } from '@/constants/submissionStage';
import { BUILD_STAGE } from '@/constants/buildStage';
import { IDEA_STATUS, IDEA_STATE } from '@/constants/ideaStatus';

/**
 * Formal approval decision (`afp_approvalstatus`) — the CoE's Approve/Deny
 * outcome, set independently of the submission stage. Pending is represented by
 * an unset (null) value. An Approved idea enters the build phase
 * (`afp_ideabuildstage`).
 */
export const APPROVAL_STATUS = {
  APPROVED: 100000000,
  DENIED: 100000001,
} as const;

export type ApprovalStatusValue = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const APPROVAL_STATUS_LABELS: Record<number, string> = {
  [APPROVAL_STATUS.APPROVED]: 'Approved',
  [APPROVAL_STATUS.DENIED]: 'Denied',
};

export function approvalStatusLabel(value: number | null | undefined): string {
  if (value == null) return 'Pending';
  return APPROVAL_STATUS_LABELS[value] ?? `Decision ${value}`;
}

export const APPROVAL_STATUS_BADGE_VARIANT: Record<number, BadgeVariant> = {
  [APPROVAL_STATUS.APPROVED]: 'default',
  [APPROVAL_STATUS.DENIED]: 'destructive',
};

export function approvalStatusBadgeVariant(value: number | null | undefined): BadgeVariant {
  if (value == null) return 'secondary';
  return APPROVAL_STATUS_BADGE_VARIANT[value] ?? 'secondary';
}

/**
 * Derives the legacy OOB `statuscode` from the new approval/build/submission
 * fields. The app no longer reads `statuscode` for status, but it is still
 * written so Dataverse views, the active/inactive state, and downstream flows
 * stay coherent. The approval decision takes precedence over the submission
 * stage; the build stage refines an approved idea.
 */
export function deriveLegacyStatusCode(
  stage: number | null | undefined,
  approvalStatus: number | null | undefined,
  buildStage: number | null | undefined,
): number {
  if (approvalStatus === APPROVAL_STATUS.DENIED) return IDEA_STATUS.REJECTED;
  if (approvalStatus === APPROVAL_STATUS.APPROVED) {
    if (buildStage === BUILD_STAGE.IN_PROGRESS) return IDEA_STATUS.IN_PROGRESS;
    if (buildStage === BUILD_STAGE.COMPLETED) return IDEA_STATUS.COMPLETED;
    if (buildStage === BUILD_STAGE.CANCELLED) return IDEA_STATUS.ON_HOLD;
    return IDEA_STATUS.APPROVED;
  }
  switch (stage ?? SUBMISSION_STAGE.DRAFT) {
    case SUBMISSION_STAGE.SUBMITTED:
      return IDEA_STATUS.SUBMITTED;
    case SUBMISSION_STAGE.IN_REVIEW:
    case SUBMISSION_STAGE.REVIEW_COMPLETED:
      return IDEA_STATUS.UNDER_REVIEW;
    case SUBMISSION_STAGE.ON_HOLD:
      return IDEA_STATUS.ON_HOLD;
    case SUBMISSION_STAGE.DRAFT:
    default:
      return IDEA_STATUS.DRAFT;
  }
}

/** Maps a derived legacy statuscode to its parent statecode (Active/Inactive). */
export function legacyStateForStatusCode(statusCode: number): number {
  switch (statusCode) {
    case IDEA_STATUS.APPROVED:
    case IDEA_STATUS.REJECTED:
    case IDEA_STATUS.COMPLETED:
      return IDEA_STATE.INACTIVE;
    default:
      return IDEA_STATE.ACTIVE;
  }
}
