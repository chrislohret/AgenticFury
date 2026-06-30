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
  PowerPlatformEnvironmentRepository,
  PlatformRepository,
  PlatformAttributeRepository,
  PlatformAttributeAssignmentRepository,
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
  Platform,
  PlatformWithAttributes,
  PlatformAttribute,
  PlatformAttributeCategory,
  PlatformAttributeAssignment,
} from '@/types/domain-models';
import type { PowerPlatformEnvironment } from '@/types/domain-models';
import { AI_COE_FULL_TEAM_NAME } from '@/constants/security';
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
import { mockPlatforms } from '@/mockData/platform';
import { mockPlatformAttributes } from '@/mockData/platformAttribute';
import { mockPlatformAttributeAssignments } from '@/mockData/platformAttributeAssignment';
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
      const SUBMITTED = 747150003;
      const IN_REVIEW = 747150000;
      return records
        .filter((r) => r.submissionStage === SUBMITTED || r.submissionStage === IN_REVIEW)
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
        submissionStage: 747150004,
        approvalStatus: null,
        buildStage: null,
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

const MOCK_POWER_PLATFORM_ENVIRONMENTS: PowerPlatformEnvironment[] = [
  { id: 'env-zone1-a', name: 'Citizen Dev (Zone 1)', environmentZone: 747150000 },
  { id: 'env-zone1-b', name: 'Citizen Sandbox (Zone 1)', environmentZone: 747150000 },
  { id: 'env-zone2-a', name: 'IT Partnered Dev (Zone 2)', environmentZone: 747150001 },
  { id: 'env-zone2-b', name: 'IT Partnered Test (Zone 2)', environmentZone: 747150001 },
  { id: 'env-zone3-a', name: 'IT Dev (Zone 3)', environmentZone: 747150002 },
  { id: 'env-zone3-b', name: 'IT Prod (Zone 3)', environmentZone: 747150002 },
];

function createPowerPlatformEnvironmentRepository(): PowerPlatformEnvironmentRepository {
  return {
    async list() {
      return MOCK_POWER_PLATFORM_ENVIRONMENTS.map(cloneRecord);
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

function createPlatformRepository(
  platforms: Platform[],
  attributes: PlatformAttribute[],
  assignments: PlatformAttributeAssignment[],
): PlatformRepository {
  function attributesFor(
    platformId: string,
    category: PlatformAttributeCategory,
  ): PlatformAttribute[] {
    const assignedIds = new Set(
      assignments.filter((a) => a.platformId === platformId).map((a) => a.attributeId),
    );
    return attributes
      .filter((attr) => assignedIds.has(attr.id) && attr.category === category)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cloneRecord);
  }
  return {
    async list() {
      return platforms
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
        .map(cloneRecord);
    },
    async listWithAttributes(): Promise<PlatformWithAttributes[]> {
      return platforms
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
        .map((platform) => ({
          ...cloneRecord(platform),
          capabilities: attributesFor(platform.id, 'capability'),
          decisionCriteria: attributesFor(platform.id, 'decision-criteria'),
          costMechanisms: attributesFor(platform.id, 'cost-mechanism'),
        }));
    },
    async save(input: Partial<Platform> & { name: string }) {
      if (input.id) {
        const index = platforms.findIndex((p) => p.id === input.id);
        if (index >= 0) {
          platforms[index] = {
            ...platforms[index],
            ...input,
            name: input.name.trim() || platforms[index].name,
          };
          return cloneRecord(platforms[index]);
        }
      }
      const record: Platform = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        isActive: input.isActive ?? true,
        displayOrder: input.displayOrder ?? 0,
      };
      platforms.push(record);
      return cloneRecord(record);
    },
    async delete(id: string) {
      const index = platforms.findIndex((p) => p.id === id);
      if (index >= 0) platforms.splice(index, 1);
      // Remove orphaned assignments for the deleted platform.
      for (let i = assignments.length - 1; i >= 0; i -= 1) {
        if (assignments[i].platformId === id) assignments.splice(i, 1);
      }
    },
  };
}

function createPlatformAttributeRepository(
  attributes: PlatformAttribute[],
): PlatformAttributeRepository {
  return {
    async listByCategory(category: PlatformAttributeCategory) {
      return attributes
        .filter((a) => a.category === category)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(cloneRecord);
    },
    async save(input: Partial<PlatformAttribute> & { name: string; category: PlatformAttributeCategory }) {
      if (input.id) {
        const index = attributes.findIndex((a) => a.id === input.id);
        if (index >= 0) {
          attributes[index] = {
            ...attributes[index],
            ...input,
            name: input.name.trim() || attributes[index].name,
          };
          return cloneRecord(attributes[index]);
        }
      }
      const record: PlatformAttribute = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        category: input.category,
        isActive: input.isActive ?? true,
      };
      attributes.push(record);
      return cloneRecord(record);
    },
    async delete(id: string) {
      const index = attributes.findIndex((a) => a.id === id);
      if (index >= 0) attributes.splice(index, 1);
    },
  };
}

function createPlatformAttributeAssignmentRepository(
  assignments: PlatformAttributeAssignment[],
): PlatformAttributeAssignmentRepository {
  return {
    async listByPlatform(platformId: string) {
      return assignments.filter((a) => a.platformId === platformId).map(cloneRecord);
    },
    async setAssignments(platformId: string, attributeIds: string[]) {
      // Replace the full set for this platform.
      for (let i = assignments.length - 1; i >= 0; i -= 1) {
        if (assignments[i].platformId === platformId) assignments.splice(i, 1);
      }
      for (const attributeId of new Set(attributeIds)) {
        assignments.push({ id: crypto.randomUUID(), platformId, attributeId });
      }
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
  const platformStore = mockPlatforms.map(cloneRecord);
  const platformAttributeStore = mockPlatformAttributes.map(cloneRecord);
  const platformAssignmentStore = mockPlatformAttributeAssignments.map(cloneRecord);

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
    platforms: createPlatformRepository(platformStore, platformAttributeStore, platformAssignmentStore),
    platformAttributes: createPlatformAttributeRepository(platformAttributeStore),
    platformAttributeAssignments: createPlatformAttributeAssignmentRepository(platformAssignmentStore),
    directoryUsers: createDirectoryUserRepository(usersStore),    currentUser: {
      // Mock mode treats the local user as a member of the AI CoE Team Full
      // team so admin-only navigation is exercisable during prototype dev.
      async getTeamNames() {
        return [AI_COE_FULL_TEAM_NAME];
      },
    },
    fieldMetadata: {
      async getField() { return null; },
    },
    powerPlatformEnvironments: createPowerPlatformEnvironmentRepository(),
  } satisfies AppDataProvider;
}
