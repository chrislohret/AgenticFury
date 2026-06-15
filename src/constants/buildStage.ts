/**
 * Build phase (`afp_ideabuildstage`) — tracks delivery of an idea after it has
 * been approved. Drives the Build Phase dashboard and gates the Realized
 * Outcomes section on the submission detail page. An approved idea with no
 * build stage set yet is "Not started".
 */
export const BUILD_STAGE = {
  IN_PROGRESS: 747150000,
  COMPLETED: 747150001,
  CANCELLED: 747150002,
} as const;

export type BuildStageValue = (typeof BUILD_STAGE)[keyof typeof BUILD_STAGE];

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const BUILD_STAGE_LABELS: Record<number, string> = {
  [BUILD_STAGE.IN_PROGRESS]: 'In Progress',
  [BUILD_STAGE.COMPLETED]: 'Completed',
  [BUILD_STAGE.CANCELLED]: 'Cancelled',
};

/**
 * Build phases in workflow order, used to render the full picker in the process
 * flow. `null` (Not started) precedes these and is offered separately.
 */
export const BUILD_STAGE_ORDER: number[] = [
  BUILD_STAGE.IN_PROGRESS,
  BUILD_STAGE.COMPLETED,
  BUILD_STAGE.CANCELLED,
];

/** Label for a build stage value that may be null (Not started). */
export function buildStageLabel(stage: number | null | undefined): string {
  if (stage == null) return 'Not started';
  return BUILD_STAGE_LABELS[stage] ?? `Build ${stage}`;
}

export const BUILD_STAGE_BADGE_VARIANT: Record<number, BadgeVariant> = {
  [BUILD_STAGE.IN_PROGRESS]: 'default',
  [BUILD_STAGE.COMPLETED]: 'secondary',
  [BUILD_STAGE.CANCELLED]: 'destructive',
};

export function buildStageBadgeVariant(stage: number | null | undefined): BadgeVariant {
  if (stage == null) return 'outline';
  return BUILD_STAGE_BADGE_VARIANT[stage] ?? 'outline';
}

/** Allowed transitions per build stage. `null` (Not started) may begin or cancel. */
export const BUILD_STAGE_TRANSITIONS: Record<number, number[]> = {
  [BUILD_STAGE.IN_PROGRESS]: [BUILD_STAGE.COMPLETED, BUILD_STAGE.CANCELLED],
  [BUILD_STAGE.COMPLETED]: [BUILD_STAGE.IN_PROGRESS],
  [BUILD_STAGE.CANCELLED]: [BUILD_STAGE.IN_PROGRESS],
};

/**
 * Returns the selectable build stages for a record currently at `stage`,
 * including the current stage. A Not-started (null) idea may move to In
 * Progress or Cancelled.
 */
export function getAllowedBuildStages(stage: number | null | undefined): number[] {
  if (stage == null) return [BUILD_STAGE.IN_PROGRESS, BUILD_STAGE.CANCELLED];
  const next = BUILD_STAGE_TRANSITIONS[stage] ?? [];
  return [stage, ...next.filter((s) => s !== stage)];
}
