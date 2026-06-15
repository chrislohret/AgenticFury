import { Check, Circle, Lock, PauseCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  SUBMISSION_STAGE,
  SUBMISSION_STAGE_ORDER,
  submissionStageLabel,
} from '@/constants/submissionStage';
import { BUILD_STAGE, BUILD_STAGE_ORDER, buildStageLabel } from '@/constants/buildStage';
import { APPROVAL_STATUS, approvalStatusLabel } from '@/constants/approvalStatus';

type PhaseKey = 'submission' | 'approval' | 'build';

/**
 * Visual state of a single phase chevron. `done` = completed/passed,
 * `active` = current focus, `upcoming` = not yet reached, `locked` = gated by a
 * prerequisite, `offtrack` = a side state such as On Hold / Denied / Cancelled.
 */
type PhaseState = 'done' | 'active' | 'upcoming' | 'locked' | 'offtrack';

export interface SubmissionProcessFlowProps {
  /** Committed (server) values — drive the chevron summary line. */
  submissionStage: number | null;
  approvalStatus: number | null;
  buildStage: number | null;
  /** Pending (selected) values — what the user is about to save. */
  selectedStage: number | null;
  selectedApproval: number | null;
  selectedBuildStage: number | null;
  onStageChange: (value: string) => void;
  onApprovalChange: (value: string) => void;
  onBuildChange: (value: string) => void;
  statusChangeReason: string;
  onReasonChange: (value: string) => void;
  disabled?: boolean;
}

const PHASE_ORDER: PhaseKey[] = ['submission', 'approval', 'build'];
const PHASE_LABEL: Record<PhaseKey, string> = {
  submission: 'Submission',
  approval: 'Approval',
  build: 'Build',
};

function phaseStateClasses(state: PhaseState): string {
  switch (state) {
    case 'done':
      return 'border-primary bg-primary text-primary-foreground';
    case 'active':
      return 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40';
    case 'offtrack':
      return 'border-destructive bg-destructive/10 text-foreground';
    case 'locked':
      return 'border-muted bg-muted/40 text-muted-foreground';
    case 'upcoming':
    default:
      return 'border-muted bg-background text-muted-foreground';
  }
}

function PhaseGlyph({ state }: { state: PhaseState }) {
  const cls = 'h-4 w-4 shrink-0';
  if (state === 'done') return <Check className={cls} aria-hidden />;
  if (state === 'locked') return <Lock className={cls} aria-hidden />;
  if (state === 'offtrack') return <XCircle className={cls} aria-hidden />;
  return <Circle className={cls} aria-hidden />;
}

export function SubmissionProcessFlow({
  submissionStage,
  approvalStatus,
  buildStage,
  selectedStage,
  selectedApproval,
  selectedBuildStage,
  onStageChange,
  onApprovalChange,
  onBuildChange,
  statusChangeReason,
  onReasonChange,
  disabled,
}: SubmissionProcessFlowProps) {
  // The "selected" values represent the user's pending intent and are kept in
  // sync with the committed record by the parent, so they are the source of
  // truth here. Note: `null` is a *meaningful* selection (Pending / Not started),
  // so we must NOT coalesce it back to the committed value — doing so would make
  // those two choices un-selectable. Only `stage` carries a Draft default.
  const stage = selectedStage ?? submissionStage ?? SUBMISSION_STAGE.DRAFT;
  const approval = selectedApproval;
  const build = selectedBuildStage;

  const approvalDecided = approval != null;
  const approved = approval === APPROVAL_STATUS.APPROVED;
  const denied = approval === APPROVAL_STATUS.DENIED;

  // The approval phase unlocks only once the submission review is complete, or
  // once a decision has already been recorded.
  const reviewCompleted = stage === SUBMISSION_STAGE.REVIEW_COMPLETED;
  const approvalUnlocked = reviewCompleted || approvalDecided;

  // Derive per-phase state for the chevron rail.
  const submissionState: PhaseState =
    stage === SUBMISSION_STAGE.ON_HOLD
      ? 'offtrack'
      : approvalUnlocked
        ? 'done'
        : 'active';

  const approvalState: PhaseState = !approvalUnlocked
    ? 'locked'
    : denied
      ? 'offtrack'
      : approved
        ? 'done'
        : 'active';

  const buildState: PhaseState = !approved
    ? 'locked'
    : build === BUILD_STAGE.CANCELLED
      ? 'offtrack'
      : build === BUILD_STAGE.COMPLETED
        ? 'done'
        : 'active';

  const phaseState: Record<PhaseKey, PhaseState> = {
    submission: submissionState,
    approval: approvalState,
    build: buildState,
  };

  // The active phase is the first one not yet completed; this is what we expand.
  const activePhase: PhaseKey =
    !approvalUnlocked || stage === SUBMISSION_STAGE.ON_HOLD
      ? 'submission'
      : approved
        ? 'build'
        : 'approval';

  const phaseSummary: Record<PhaseKey, string> = {
    submission: submissionStageLabel(submissionStage),
    approval: approvalUnlocked ? approvalStatusLabel(approvalStatus) : 'Locked',
    build: approved ? buildStageLabel(buildStage) : 'Locked',
  };

  const stageChangedFromCommitted =
    selectedStage != null && selectedStage !== (submissionStage ?? SUBMISSION_STAGE.DRAFT);

  return (
    <div className="rounded-lg border bg-card">
      {/* Chevron rail */}
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-stretch sm:gap-0">
        {PHASE_ORDER.map((phase, index) => {
          const state = phaseState[phase];
          const isActive = phase === activePhase;
          return (
            <div key={phase} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                  phaseStateClasses(state),
                  isActive && 'shadow-sm',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                    state === 'done'
                      ? 'border-primary-foreground/40 bg-primary-foreground/15'
                      : 'border-current',
                  )}
                >
                  {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {PHASE_LABEL[phase]}
                    <PhaseGlyph state={state} />
                  </div>
                  <div className="truncate text-xs opacity-80">{phaseSummary[phase]}</div>
                </div>
              </div>
              {index < PHASE_ORDER.length - 1 && (
                <div className="hidden px-1 text-muted-foreground sm:block" aria-hidden>
                  ›
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active phase controls */}
      <div className="border-t bg-muted/20 p-4">
        {activePhase === 'submission' && (
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Move submission to
            </Label>
            <div className="flex flex-wrap gap-2">
              {SUBMISSION_STAGE_ORDER.map((value) => {
                const isCurrent = value === stage;
                const isOnHold = value === SUBMISSION_STAGE.ON_HOLD;
                return (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={isCurrent ? 'default' : isOnHold ? 'outline' : 'secondary'}
                    disabled={disabled}
                    onClick={() => onStageChange(String(value))}
                    className={cn(isOnHold && !isCurrent && 'border-destructive/40 text-destructive')}
                  >
                    {isOnHold && <PauseCircle className="h-3.5 w-3.5" aria-hidden />}
                    {submissionStageLabel(value)}
                  </Button>
                );
              })}
            </div>
            {stageChangedFromCommitted && (
              <div className="space-y-1">
                <Label htmlFor="process-status-reason" className="text-xs">
                  Reason for status change<span className="text-destructive"> *</span>
                </Label>
                <Textarea
                  id="process-status-reason"
                  rows={2}
                  value={statusChangeReason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  placeholder="Explain why the status is changing. Captured in the activity notes."
                  aria-required
                  disabled={disabled}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The submission moves through CoE intake here. Mark it{' '}
              <span className="font-medium">Review Completed</span> to unlock the approval decision.
            </p>
          </div>
        )}

        {activePhase === 'approval' && (
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Approval decision
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={approval == null ? 'default' : 'secondary'}
                disabled={disabled}
                onClick={() => onApprovalChange('pending')}
              >
                Pending
              </Button>
              <Button
                type="button"
                size="sm"
                variant={approved ? 'default' : 'secondary'}
                disabled={disabled}
                onClick={() => onApprovalChange(String(APPROVAL_STATUS.APPROVED))}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant={denied ? 'destructive' : 'outline'}
                disabled={disabled}
                onClick={() => onApprovalChange(String(APPROVAL_STATUS.DENIED))}
                className={cn(!denied && 'border-destructive/40 text-destructive')}
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                Deny
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Approving unlocks the build phase. Denying closes the idea.
            </p>
          </div>
        )}

        {activePhase === 'build' && (
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Build phase
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={build == null ? 'default' : 'secondary'}
                disabled={disabled}
                onClick={() => onBuildChange('none')}
              >
                Not started
              </Button>
              {BUILD_STAGE_ORDER.map((value) => {
                const isCurrent = value === build;
                const isCancelled = value === BUILD_STAGE.CANCELLED;
                return (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={isCurrent ? 'default' : isCancelled ? 'outline' : 'secondary'}
                    disabled={disabled}
                    onClick={() => onBuildChange(String(value))}
                    className={cn(
                      isCancelled && !isCurrent && 'border-destructive/40 text-destructive',
                    )}
                  >
                    {isCancelled && <XCircle className="h-3.5 w-3.5" aria-hidden />}
                    {buildStageLabel(value)}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Track delivery of the approved idea. Completing the build closes the flow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
