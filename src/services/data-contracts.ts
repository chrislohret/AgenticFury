import type {
  IdeaSubmission,
  ApprovalStageRecord,
  ApprovalStage,
  LookupOption,
  LookupCategory,
  CoeStructuredReview,
  IdeaScorecard,
  CoeNote,
  CoeApprovalHistoryEntry,
  DirectoryUser,
  AiCoeRole,
  AiCoeTeamMember,
  AiCoeTeamApproval,
} from '@/types/domain-models';

export type DataverseFieldRequiredLevel = 'none' | 'recommended' | 'application' | 'system';

export interface DataverseFieldMetadata {
  tableLogicalName: string;
  fieldLogicalName: string;
  displayName?: string;
  requiredLevel: DataverseFieldRequiredLevel;
  isRequired: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  precision?: number;
}

export interface FieldMetadataRepository {
  getField(tableLogicalName: string, fieldLogicalName: string): Promise<DataverseFieldMetadata | null>;
}

export interface IdeaSubmissionRepository {
  list(): Promise<IdeaSubmission[]>;
  listBySubmitter(userId: string): Promise<IdeaSubmission[]>;
  listPendingForStage(stage: ApprovalStage): Promise<IdeaSubmission[]>;
  getById(id: string): Promise<IdeaSubmission | null>;
  save(input: Partial<IdeaSubmission>): Promise<IdeaSubmission>;
}

export interface ApprovalStageRepository {
  listBySubmission(submissionId: string): Promise<ApprovalStageRecord[]>;
  save(input: Partial<ApprovalStageRecord>): Promise<ApprovalStageRecord>;
}

export interface LookupOptionRepository {
  listByCategory(category: LookupCategory): Promise<LookupOption[]>;
  save(input: Partial<LookupOption>): Promise<LookupOption>;
  delete(id: string): Promise<void>;
}

export interface CoeStructuredReviewRepository {
  getBySubmissionId(submissionId: string): Promise<CoeStructuredReview | null>;
  save(input: Partial<CoeStructuredReview> & { submissionId: string }): Promise<CoeStructuredReview>;
}

/**
 * One scorecard per submission (1:1). `save` upserts by submissionId and the
 * provider computes/persists the weighted total and stamps the current user as
 * the scorer.
 */
export interface IdeaScorecardRepository {
  getBySubmissionId(submissionId: string): Promise<IdeaScorecard | null>;
  save(input: Partial<IdeaScorecard> & { submissionId: string }): Promise<IdeaScorecard>;
}

/**
 * Backed by the Dataverse `annotation` OOB activity table.
 * Notes are append-only in the Dataverse timeline — create only, no edit.
 */
export interface CoeNoteRepository {
  listBySubmission(submissionId: string): Promise<CoeNote[]>;
  create(input: { submissionId: string; noteText: string; subject?: string }): Promise<CoeNote>;
}

export interface CoeApprovalHistoryRepository {
  listBySubmission(submissionId: string): Promise<CoeApprovalHistoryEntry[]>;
  create(input: {
    submissionId: string;
    userName: string;
    roleName: string;
    decision: 'approved' | 'denied';
    comments?: string;
  }): Promise<CoeApprovalHistoryEntry>;
}

export interface DirectoryUserRepository {
  list(): Promise<DirectoryUser[]>;
}

export interface AiCoeRoleRepository {
  list(): Promise<AiCoeRole[]>;
  save(input: { id?: string; name: string; description?: string }): Promise<AiCoeRole>;
  delete(id: string): Promise<void>;
}

export interface AiCoeTeamRepository {
  list(): Promise<AiCoeTeamMember[]>;
  save(input: { id?: string; memberId: string; userName: string; userEmail: string; roleId: string }): Promise<AiCoeTeamMember>;
  delete(id: string): Promise<void>;
}

export interface AiCoeTeamApprovalRepository {
  listBySubmission(submissionId: string): Promise<AiCoeTeamApproval[]>;
  save(input: { submissionId: string; teamMemberId: string; approvalStatus: 'pending' | 'approved' | 'denied'; comment?: string }): Promise<AiCoeTeamApproval>;
  delete(id: string): Promise<void>;
}

export interface AppDataProvider {
  ideaSubmissions: IdeaSubmissionRepository;
  approvalStages: ApprovalStageRepository;
  lookupOptions: LookupOptionRepository;
  coeStructuredReviews: CoeStructuredReviewRepository;
  ideaScorecards: IdeaScorecardRepository;
  coeNotes: CoeNoteRepository;
  coeApprovalHistory: CoeApprovalHistoryRepository;
  aiCoeRoles: AiCoeRoleRepository;
  aiCoeTeam: AiCoeTeamRepository;
  aiCoeTeamApprovals: AiCoeTeamApprovalRepository;
  directoryUsers: DirectoryUserRepository;
  fieldMetadata: FieldMetadataRepository;
}
