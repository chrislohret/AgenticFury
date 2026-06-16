import type { ScorecardDimensionKey } from '@/constants/scorecard';

export type ApprovalStage = 'coe-review' | 'it-signoff' | 'executive-approval';
export type StageStatus = 'pending' | 'approved' | 'rejected' | 'on-hold';export type LookupCategory =
  | 'business-objectives'
  | 'intended-user-roles'
  | 'data-sources'
  | 'expected-outcomes'
  | 'risk-factors'
  | 'departments'
  | 'ai-coe-roles';

export interface IdeaSubmission {
  id: string;
  /** Human-readable submission identifier (afp_submissionid autonumber). */
  submissionRef?: string;
  title: string;
  businessObjectives: string;
  intendedUserRoles: string;
  dataSources?: string;
  phiRequired: boolean;
  expectedOutcomes: string;
  riskFactors?: string;
  // Prototype: data URL string. Real Dataverse mapping should target an image/file column.
  estimatedCostsImageUrl?: string;
  // Copilot Studio Estimator PDF, stored in the afp_copilotcreditestimatorpdf File column.
  copilotCreditEstimatorPdfUrl?: string;
  copilotCreditEstimatorPdfName?: string;
  monthlyCopilotCreditsCost?: number;
  monthlyCopilotCreditsNotes?: string;
  userBasedLicensingCost?: number;
  userBasedLicensingNotes?: string;
  dataSourceCost?: number;
  dataSourceNotes?: string;
  overallCostNotesHtml?: string;
  aiPlatformSelection?: number;
  /**
   * Environment zone (afp_environmentzone choice). Only meaningful when the AI
   * platform is Copilot Studio; cleared to null otherwise.
   */
  environmentZone?: number | null;
  status: number;
  /**
   * Submission stage (afp_ideasubmissionstage): Submitted, In Review, On Hold,
   * Approved, Rejected. `null`/undefined means Draft (the field has no Draft
   * option). This is the status surfaced on the Submission Status dashboard and
   * the detail page selector.
   */
  submissionStage?: number | null;
  /**
   * Formal approval decision (afp_approvalstatus): Approved or Denied. Set
   * automatically when the submission stage reaches Approved/Rejected.
   */
  approvalStatus?: number | null;
  /**
   * Build phase (afp_ideabuildstage): In Progress, Completed, Cancelled. Only
   * meaningful once approved; `null` means Not started. Drives the Build Phase
   * dashboard and gates the Realized Outcomes section.
   */
  buildStage?: number | null;
  department?: string;
  /**
   * CoE-normalized department names mirrored from the structured review
   * (afp_aicoedepartments). Empty/undefined until a reviewer normalizes the idea.
   */
  normalizedDepartments?: string[];
  submittedBy?: string;
  createdOn?: string;
  /** systemuser GUID of the assigned AI CoE reviewer (afp_assignedreviewer lookup). */
  assignedReviewer?: string;
  /** Expanded systemuser fullname for the assigned reviewer. */
  assignedReviewerName?: string;
}

export interface ApprovalStageRecord {
  id: string;
  submissionId: string;
  stage: ApprovalStage;
  stageStatus: StageStatus;
  comments?: string;
  reviewedBy?: string;
  reviewedOn?: string;
}

export interface LookupOption {
  id: string;
  category: LookupCategory;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface DirectoryUser {
  id: string;
  displayName: string;
  email: string;
  department?: string;
  jobTitle?: string;
}

export interface AiCoeRole {
  id: string;
  name: string;
  description?: string;
}

export interface AiCoeTeamMember {
  id: string;
  /** GUID of the related systemuser record (afp_memberid lookup). */
  memberId: string;
  /** Mirror of memberId, kept for backward compatibility with existing callers. */
  userId: string;
  userName: string;
  userEmail: string;
  /** GUID of the related afp_aicoeroles record (afp_roleid lookup). */
  roleId: string;
  addedOn: string;
}

export type AiCoeTeamApprovalStatus = 'pending' | 'approved' | 'denied';

export interface AiCoeTeamApproval {
  id: string;
  submissionId: string;
  teamMemberId: string;
  approvalStatus: AiCoeTeamApprovalStatus;
  comment?: string;
  reviewedBy?: string;
  reviewedOn?: string;
}

export type CoeApprovalDecision = 'approved' | 'denied';

export interface CoeApprovalHistoryEntry {
  id: string;
  submissionId: string;
  userName: string;
  roleName: string;
  decision: CoeApprovalDecision;
  comments?: string;
  reviewedOn: string;
}

export interface CoeStructuredReview {
  id: string;
  submissionId: string;
  businessObjectiveIds: string[];
  intendedUserRoleIds: string[];
  dataSourceIds: string[];
  expectedOutcomeIds: string[];
  riskFactorIds: string[];
  departmentIds: string[];
  updatedBy?: string;
  updatedOn?: string;
}

/**
 * Weighted evaluation scorecard for a submitted idea. Has a 1:1 relationship
 * with the idea submission (one scorecard per submission). Each dimension is
 * scored 0–5; `weightedTotal` is the persisted 0–100 weighted result. The
 * scorer is a Dataverse `systemuser` lookup (`afp_scoredby`).
 */
export interface IdeaScorecard {
  id: string;
  submissionId: string;
  businessValueScore?: number;
  efficiencyScore?: number;
  adoptionScore?: number;
  trustGovernanceScore?: number;
  technicalPerformanceScore?: number;
  businessValueNotes?: string;
  efficiencyNotes?: string;
  adoptionNotes?: string;
  trustGovernanceNotes?: string;
  technicalPerformanceNotes?: string;
  weightedTotal?: number;
  scoredBy?: string;     // systemuser GUID (afp_scoredby lookup)
  scoredByName?: string; // expanded systemuser fullname
  scoredOn?: string;     // ISO 8601
}

/**
 * Maps to the Dataverse `afp_scorecardweight` table — one row per scorecard
 * dimension holding its configurable percentage weight. The five weights are
 * expected to sum to 100. When the table is empty the app falls back to the
 * code-default weights in `SCORECARD_DIMENSIONS`.
 */
export interface ScorecardWeight {
  id: string;                      // afp_scorecardweightid
  dimensionKey: ScorecardDimensionKey; // afp_dimensionkey
  label: string;                   // afp_name (display label)
  weight: number;                  // afp_weight (0–100)
}

/** Outcome rating choice values mirroring the afp_outcomerating option set. */
export type IdeaOutcomeRating = 747150000 | 747150001 | 747150002 | 747150003;

/**
 * Post-approval realized outcomes for a submitted idea. Has a 1:1 relationship
 * with the idea submission (one record per submission, enforced by the app).
 * Maps to the Dataverse `afp_idearealization` table.
 */
export interface IdeaRealization {
  id: string;
  submissionId: string;
  actualMonthlyCost?: number;
  realizedBenefit?: string;
  actualGoLiveDate?: string; // ISO 8601 (date only)
  outcomeRating?: IdeaOutcomeRating;
}

/**
 * Maps to the Dataverse `annotation` (Notes) OOB activity table.
 * objectid relates to afp_ideasubmission; createdby / createdon are system-populated.
 * The MDA timeline control renders these automatically when the annotation table
 * is enabled for the parent entity.
 */
export interface CoeNote {
  id: string;           // annotationid
  submissionId: string; // objectid → afp_ideasubmission
  noteText: string;     // notetext
  subject?: string;     // subject
  createdByName: string; // createdby.fullname (expanded)
  createdOn: string;    // createdon (ISO 8601)
}
