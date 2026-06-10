export type ApprovalStage = 'coe-review' | 'it-signoff' | 'executive-approval';
export type StageStatus = 'pending' | 'approved' | 'rejected' | 'on-hold';
export type LookupCategory =
  | 'business-objectives'
  | 'intended-user-roles'
  | 'data-sources'
  | 'expected-outcomes'
  | 'risk-factors'
  | 'departments'
  | 'ai-coe-roles';

export interface IdeaSubmission {
  id: string;
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
  status: number;
  department?: string;
  submittedBy?: string;
  createdOn?: string;
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
