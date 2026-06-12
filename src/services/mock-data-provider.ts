import type {
  AppDataProvider,
  IdeaSubmissionRepository,
  ApprovalStageRepository,
  LookupOptionRepository,
  CoeStructuredReviewRepository,
  IdeaScorecardRepository,
  CoeNoteRepository,
  CoeApprovalHistoryRepository,
  DirectoryUserRepository,
  AiCoeRoleRepository,
  AiCoeTeamRepository,
  AiCoeTeamApprovalRepository,
  ScorecardWeightRepository,
  IdeaRealizationRepository,
} from '@/services/data-contracts';
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
  ScorecardWeight,
  IdeaRealization,
} from '@/types/domain-models';
import { mockIdeaSubmissions } from '@/mockData/ideaSubmission';
import { mockApprovalStageRecords } from '@/mockData/approvalStageRecord';
import { mockLookupOptions } from '@/mockData/lookupOption';
import { mockCoeStructuredReviews } from '@/mockData/coeStructuredReview';
import { mockIdeaScorecards } from '@/mockData/ideaScorecard';
import { mockCoeNotes } from '@/mockData/coeNote';
import { mockCoeApprovalHistory } from '@/mockData/coeApprovalHistory';
import { mockDirectoryUsers } from '@/mockData/directoryUsers';
import { mockAiCoeTeamMembers } from '@/mockData/aiCoeTeamMember';
import { mockAiCoeTeamApprovals } from '@/mockData/aiCoeTeamApproval';
import { mockScorecardWeights } from '@/mockData/scorecardWeight';
import { mockIdeaRealizations } from '@/mockData/ideaRealization';
import { computeWeightedTotal, weightsListToMap } from '@/lib/scorecard';

function cloneRecord<T>(record: T): T {
  return JSON.parse(JSON.stringify(record)) as T;
}

function createIdeaSubmissionRepository(records: IdeaSubmission[]): IdeaSubmissionRepository {
  return {
    async list() {
      return records.map(cloneRecord);
    },
    async listBySubmitter(userId: string) {
      return records.filter((r) => r.submittedBy === userId).map(cloneRecord);
    },
    async listPendingForStage(_stage: ApprovalStage) {
      // Returns submitted/under-review ideas regardless of stage for prototype
      const SUBMITTED = 100000001;
      const UNDER_REVIEW = 100000002;
      return records
        .filter((r) => r.status === SUBMITTED || r.status === UNDER_REVIEW)
        .map(cloneRecord);
    },
    async getById(id: string) {
      const record = records.find((r) => r.id === id);
      return record ? cloneRecord(record) : null;
    },
    async save(input: Partial<IdeaSubmission>) {
      if (input.id) {
        const index = records.findIndex((r) => r.id === input.id);
        if (index >= 0) {
          records[index] = { ...records[index], ...input };
          return cloneRecord(records[index]);
        }
      }
      const record: IdeaSubmission = {
        id: crypto.randomUUID(),
        title: '',
        businessObjectives: '',
        intendedUserRoles: '',
        phiRequired: false,
        expectedOutcomes: '',
        status: 100000000,
        createdOn: new Date().toISOString().split('T')[0],
        submittedBy: 'user-mock-1',
        ...input,
      };
      records.unshift(record);
      return cloneRecord(record);
    },
  };
}

function createApprovalStageRepository(records: ApprovalStageRecord[]): ApprovalStageRepository {
  return {
    async listBySubmission(submissionId: string) {
      return records.filter((r) => r.submissionId === submissionId).map(cloneRecord);
    },
    async save(input: Partial<ApprovalStageRecord>) {
      if (input.id) {
        const index = records.findIndex((r) => r.id === input.id);
        if (index >= 0) {
          records[index] = { ...records[index], ...input };
          return cloneRecord(records[index]) as ApprovalStageRecord;
        }
      }
      const record = {
        id: crypto.randomUUID(),
        submissionId: '',
        stage: 'coe-review' as ApprovalStage,
        stageStatus: 'pending' as const,
        ...input,
      } as ApprovalStageRecord;
      records.push(record);
      return cloneRecord(record);
    },
  };
}

function createLookupOptionRepository(
  records: LookupOption[],
  reviews: CoeStructuredReview[],
): LookupOptionRepository {
  return {
    async listByCategory(category: LookupCategory) {
      return records
        .filter((r) => r.category === category)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(cloneRecord);
    },
    async save(input: Partial<LookupOption>) {
      if (input.id) {
        const index = records.findIndex((r) => r.id === input.id);
        if (index >= 0) {
          records[index] = {
            ...records[index],
            ...input,
            name: input.name?.trim() || records[index].name,
          };
          return cloneRecord(records[index]);
        }
      }
      if (!input.category || !input.name?.trim()) {
        throw new Error('Category and name are required for lookup options.');
      }
      const record: LookupOption = {
        id: crypto.randomUUID(),
        category: input.category,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        isActive: input.isActive ?? true,
      };
      records.push(record);
      return cloneRecord(record);
    },
    async delete(id: string) {
      const index = records.findIndex((r) => r.id === id);
      if (index >= 0) {
        records.splice(index, 1);
      }
    },
    async getUsageCounts() {
      const counts: Record<string, number> = {};
      for (const review of reviews) {
        const ids = new Set<string>([
          ...review.businessObjectiveIds,
          ...review.intendedUserRoleIds,
          ...review.dataSourceIds,
          ...review.expectedOutcomeIds,
          ...review.riskFactorIds,
          ...review.departmentIds,
        ]);
        for (const id of ids) {
          counts[id] = (counts[id] ?? 0) + 1;
        }
      }
      return counts;
    },
  };
}

function createCoeStructuredReviewRepository(records: CoeStructuredReview[]): CoeStructuredReviewRepository {
  return {
    async getBySubmissionId(submissionId: string) {
      const record = records.find((r) => r.submissionId === submissionId);
      return record ? cloneRecord(record) : null;
    },
    async save(input: Partial<CoeStructuredReview> & { submissionId: string }) {
      const index = records.findIndex((r) => r.submissionId === input.submissionId);
      if (index >= 0) {
        records[index] = {
          ...records[index],
          ...input,
          updatedOn: new Date().toISOString().split('T')[0],
          updatedBy: input.updatedBy ?? records[index].updatedBy ?? 'CoE Reviewer',
        };
        return cloneRecord(records[index]);
      }

      const record: CoeStructuredReview = {
        id: crypto.randomUUID(),
        submissionId: input.submissionId,
        businessObjectiveIds: input.businessObjectiveIds ?? [],
        intendedUserRoleIds: input.intendedUserRoleIds ?? [],
        dataSourceIds: input.dataSourceIds ?? [],
        expectedOutcomeIds: input.expectedOutcomeIds ?? [],
        riskFactorIds: input.riskFactorIds ?? [],
        departmentIds: input.departmentIds ?? [],
        updatedBy: input.updatedBy ?? 'CoE Reviewer',
        updatedOn: new Date().toISOString().split('T')[0],
      };
      records.push(record);
      return cloneRecord(record);
    },
  };
}

function createIdeaScorecardRepository(
  records: IdeaScorecard[],
  weightStore: ScorecardWeight[],
): IdeaScorecardRepository {
  return {
    async getBySubmissionId(submissionId: string) {
      const record = records.find((r) => r.submissionId === submissionId);
      return record ? cloneRecord(record) : null;
    },
    async save(input: Partial<IdeaScorecard> & { submissionId: string }) {
      const weightMap = weightsListToMap(weightStore);
      const scores = {
        businessValue: input.businessValueScore,
        efficiency: input.efficiencyScore,
        adoption: input.adoptionScore,
        trustGovernance: input.trustGovernanceScore,
        technicalPerformance: input.technicalPerformanceScore,
      };
      const index = records.findIndex((r) => r.submissionId === input.submissionId);
      if (index >= 0) {
        const merged = { ...records[index], ...input };
        merged.weightedTotal = computeWeightedTotal(
          {
            businessValue: merged.businessValueScore,
            efficiency: merged.efficiencyScore,
            adoption: merged.adoptionScore,
            trustGovernance: merged.trustGovernanceScore,
            technicalPerformance: merged.technicalPerformanceScore,
          },
          weightMap,
        );
        merged.scoredBy = input.scoredBy ?? records[index].scoredBy;
        merged.scoredByName = input.scoredByName ?? records[index].scoredByName ?? 'CoE Reviewer';
        merged.scoredOn = new Date().toISOString().split('T')[0];
        records[index] = merged;
        return cloneRecord(records[index]);
      }

      const record: IdeaScorecard = {
        id: crypto.randomUUID(),
        submissionId: input.submissionId,
        businessValueScore: input.businessValueScore,
        efficiencyScore: input.efficiencyScore,
        adoptionScore: input.adoptionScore,
        trustGovernanceScore: input.trustGovernanceScore,
        technicalPerformanceScore: input.technicalPerformanceScore,
        businessValueNotes: input.businessValueNotes,
        efficiencyNotes: input.efficiencyNotes,
        adoptionNotes: input.adoptionNotes,
        trustGovernanceNotes: input.trustGovernanceNotes,
        technicalPerformanceNotes: input.technicalPerformanceNotes,
        weightedTotal: computeWeightedTotal(scores, weightMap),
        scoredBy: input.scoredBy,
        scoredByName: input.scoredByName ?? 'CoE Reviewer',
        scoredOn: new Date().toISOString().split('T')[0],
      };
      records.push(record);
      return cloneRecord(record);
    },
  };
}

function createScorecardWeightRepository(records: ScorecardWeight[]): ScorecardWeightRepository {
  return {
    async list() {
      return records.map(cloneRecord);
    },
    async saveWeights(weights) {
      for (const entry of weights) {
        const index = records.findIndex((r) => r.dimensionKey === entry.dimensionKey);
        if (index >= 0) {
          records[index] = { ...records[index], weight: entry.weight };
        }
      }
      return records.map(cloneRecord);
    },
  };
}

function createIdeaRealizationRepository(records: IdeaRealization[]): IdeaRealizationRepository {
  return {
    async getBySubmissionId(submissionId: string) {
      const record = records.find((r) => r.submissionId === submissionId);
      return record ? cloneRecord(record) : null;
    },
    async save(input: Partial<IdeaRealization> & { submissionId: string }) {
      const index = records.findIndex((r) => r.submissionId === input.submissionId);
      if (index >= 0) {
        records[index] = { ...records[index], ...input };
        return cloneRecord(records[index]);
      }
      const record: IdeaRealization = {
        id: crypto.randomUUID(),
        submissionId: input.submissionId,
        actualMonthlyCost: input.actualMonthlyCost,
        realizedBenefit: input.realizedBenefit,
        actualGoLiveDate: input.actualGoLiveDate,
        outcomeRating: input.outcomeRating,
      };
      records.push(record);
      return cloneRecord(record);
    },
  };
}

function createCoeNoteRepository(records: CoeNote[]): CoeNoteRepository {
  return {
    async listBySubmission(submissionId: string) {
      return records
        .filter((r) => r.submissionId === submissionId)
        .sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime())
        .map(cloneRecord);
    },
    async create(input) {
      const record: CoeNote = {
        id: crypto.randomUUID(),
        submissionId: input.submissionId,
        noteText: input.noteText,
        subject: input.subject,
        createdByName: 'Chris Lohret',
        createdOn: new Date().toISOString(),
      };
      records.unshift(record);
      return cloneRecord(record);
    },
  };
}

function createCoeApprovalHistoryRepository(records: CoeApprovalHistoryEntry[]): CoeApprovalHistoryRepository {
  return {
    async listBySubmission(submissionId: string) {
      return records
        .filter((entry) => entry.submissionId === submissionId)
        .sort((a, b) => new Date(b.reviewedOn).getTime() - new Date(a.reviewedOn).getTime())
        .map(cloneRecord);
    },
    async create(input) {
      const record: CoeApprovalHistoryEntry = {
        id: crypto.randomUUID(),
        submissionId: input.submissionId,
        userName: input.userName,
        roleName: input.roleName,
        decision: input.decision,
        comments: input.comments?.trim() || undefined,
        reviewedOn: new Date().toISOString(),
      };
      records.unshift(record);
      return cloneRecord(record);
    },
  };
}

function createDirectoryUserRepository(users: DirectoryUser[]): DirectoryUserRepository {
  return {
    async list() {
      return users.map(cloneRecord);
    },
  };
}

function createAiCoeRoleRepository(roles: LookupOption[]): AiCoeRoleRepository {
  return {
    async list(): Promise<AiCoeRole[]> {
      return roles
        .filter((r) => r.category === 'ai-coe-roles' && r.isActive)
        .map((r) => ({ id: r.id, name: r.name, description: r.description }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async save(input: { id?: string; name: string; description?: string }): Promise<AiCoeRole> {
      if (input.id) {
        const index = roles.findIndex((r) => r.id === input.id);
        if (index >= 0) {
          roles[index] = { ...roles[index], name: input.name, description: input.description };
          return { id: roles[index].id, name: roles[index].name, description: roles[index].description };
        }
      }
      const record: LookupOption = {
        id: crypto.randomUUID(),
        category: 'ai-coe-roles',
        name: input.name,
        description: input.description,
        isActive: true,
      };
      roles.push(record);
      return { id: record.id, name: record.name, description: record.description };
    },
    async delete(id: string): Promise<void> {
      const index = roles.findIndex((r) => r.id === id);
      if (index >= 0) roles.splice(index, 1);
    },
  };
}

function createAiCoeTeamRepository(records: AiCoeTeamMember[]): AiCoeTeamRepository {
  return {
    async list() {
      return records
        .sort((a, b) => a.userName.localeCompare(b.userName))
        .map(cloneRecord);
    },
    async save(input: { id?: string; memberId: string; userName: string; userEmail: string; roleId: string }) {
      if (input.id) {
        const index = records.findIndex((r) => r.id === input.id);
        if (index >= 0) {
          records[index] = { ...records[index], ...input, userId: input.memberId };
          return cloneRecord(records[index]);
        }
      }
      // Prevent duplicate users
      const existing = records.find((r) => r.memberId === input.memberId);
      if (existing) {
        throw new Error(`${input.userName} is already a member of the AI CoE team.`);
      }
      const record: AiCoeTeamMember = {
        id: crypto.randomUUID(),
        memberId: input.memberId,
        userId: input.memberId,
        userName: input.userName,
        userEmail: input.userEmail,
        roleId: input.roleId,
        addedOn: new Date().toISOString().split('T')[0],
      };
      records.push(record);
      return cloneRecord(record);
    },
    async delete(id: string) {
      const index = records.findIndex((r) => r.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
}

function createAiCoeTeamApprovalRepository(records: AiCoeTeamApproval[]): AiCoeTeamApprovalRepository {
  return {
    async listBySubmission(submissionId: string) {
      return records
        .filter((r) => r.submissionId === submissionId)
        .sort((a, b) => a.teamMemberId.localeCompare(b.teamMemberId))
        .map(cloneRecord);
    },
    async save(input) {
      const index = records.findIndex(
        (r) => r.submissionId === input.submissionId && r.teamMemberId === input.teamMemberId,
      );
      const record: AiCoeTeamApproval = {
        id: index >= 0 ? records[index].id : crypto.randomUUID(),
        submissionId: input.submissionId,
        teamMemberId: input.teamMemberId,
        approvalStatus: input.approvalStatus,
        comment: input.comment?.trim() || undefined,
        reviewedBy: 'CoE Approver',
        reviewedOn: new Date().toISOString(),
      };
      if (index >= 0) {
        records[index] = record;
      } else {
        records.push(record);
      }
      return cloneRecord(record);
    },
    async delete(id: string) {
      const index = records.findIndex((r) => r.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
}

export function createMockDataProvider(): AppDataProvider {
  const ideaStore = mockIdeaSubmissions.map(cloneRecord);
  const stageStore = mockApprovalStageRecords.map(cloneRecord);
  const lookupStore = mockLookupOptions.map(cloneRecord);
  const reviewStore = mockCoeStructuredReviews.map(cloneRecord);
  const scorecardStore = mockIdeaScorecards.map(cloneRecord);
  const noteStore = mockCoeNotes.map(cloneRecord);
  const approvalHistoryStore = mockCoeApprovalHistory.map(cloneRecord);
  const usersStore = mockDirectoryUsers.map(cloneRecord);
  const teamStore = mockAiCoeTeamMembers.map(cloneRecord);
  const approvalStore = mockAiCoeTeamApprovals.map(cloneRecord);
  const scorecardWeightStore = mockScorecardWeights.map(cloneRecord);
  const realizationStore = mockIdeaRealizations.map(cloneRecord);

  return {
    ideaSubmissions: createIdeaSubmissionRepository(ideaStore),
    approvalStages: createApprovalStageRepository(stageStore),
    lookupOptions: createLookupOptionRepository(lookupStore, reviewStore),
    coeStructuredReviews: createCoeStructuredReviewRepository(reviewStore),
    ideaScorecards: createIdeaScorecardRepository(scorecardStore, scorecardWeightStore),
    scorecardWeights: createScorecardWeightRepository(scorecardWeightStore),
    coeNotes: createCoeNoteRepository(noteStore),
    coeApprovalHistory: createCoeApprovalHistoryRepository(approvalHistoryStore),
    aiCoeRoles: createAiCoeRoleRepository(lookupStore),
    aiCoeTeam: createAiCoeTeamRepository(teamStore),
    aiCoeTeamApprovals: createAiCoeTeamApprovalRepository(approvalStore),
    ideaRealizations: createIdeaRealizationRepository(realizationStore),
    directoryUsers: createDirectoryUserRepository(usersStore),
    fieldMetadata: {
      async getField() { return null; },
    },
  } satisfies AppDataProvider;
}
