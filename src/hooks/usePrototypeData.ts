import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createAppDataProvider } from '@/services/providerFactory';
import type {
  IdeaSubmission,
  ApprovalStageRecord,
  ApprovalStage,
  LookupCategory,
  LookupOption,
  CoeStructuredReview,
  IdeaScorecard,
  CoeNote,
  CoeApprovalHistoryEntry,
  AiCoeRole,
  AiCoeTeamApproval,
  AiCoeTeamMember,
  ScorecardWeight,
  IdeaRealization,
  Platform,
  PlatformAttribute,
  PlatformAttributeCategory,
  PlatformAttributeAssignment,
  SubmissionPlatform,
} from '@/types/domain-models';
import type { ScorecardDimensionKey } from '@/constants/scorecard';
import { SUBMISSION_STAGE } from '@/constants/submissionStage';

const provider = createAppDataProvider();

export const queryKeys = {
  ideaSubmissions: ['ideaSubmissions'] as const,
  ideaSubmissionById: (id: string) => ['ideaSubmissions', id] as const,
  ideaSubmissionsBySubmitter: (userId: string) => ['ideaSubmissions', 'submitter', userId] as const,
  ideaSubmissionsPendingForStage: (stage: ApprovalStage) => ['ideaSubmissions', 'pending', stage] as const,
  approvalStages: (submissionId: string) => ['approvalStages', submissionId] as const,
  lookupOptionsByCategory: (category: LookupCategory) => ['lookupOptions', category] as const,
  lookupOptionUsage: ['lookupOptions', 'usage'] as const,
  coeStructuredReviewBySubmission: (submissionId: string) => ['coeStructuredReview', submissionId] as const,
  ideaScorecardBySubmission: (submissionId: string) => ['ideaScorecard', submissionId] as const,
  scorecardWeights: ['scorecardWeights'] as const,
  coeNotesBySubmission: (submissionId: string) => ['coeNotes', submissionId] as const,
  coeApprovalHistoryBySubmission: (submissionId: string) => ['coeApprovalHistory', submissionId] as const,
  aiCoeTeam: ['aiCoeTeam'] as const,
  aiCoeRoles: ['aiCoeRoles'] as const,
  aiCoeTeamApprovalsBySubmission: (submissionId: string) => ['aiCoeTeamApprovals', submissionId] as const,
  ideaRealizationBySubmission: (submissionId: string) => ['ideaRealization', submissionId] as const,
  directoryUsers: ['directoryUsers'] as const,
  currentUserTeams: ['currentUser', 'teams'] as const,
  powerPlatformEnvironments: ['powerPlatformEnvironments'] as const,
  platforms: ['platforms'] as const,
  platformsWithAttributes: ['platforms', 'withAttributes'] as const,
  platformAttributesByCategory: (category: PlatformAttributeCategory) =>
    ['platformAttributes', category] as const,
  platformAssignments: (platformId: string) => ['platformAssignments', platformId] as const,
  submissionPlatforms: (submissionId: string) => ['submissionPlatforms', submissionId] as const,
  submissionPlatformsAll: ['submissionPlatforms', 'all'] as const,
};

export function useIdeaSubmissions() {
  return useQuery({
    queryKey: queryKeys.ideaSubmissions,
    queryFn: () => provider.ideaSubmissions.list(),
  });
}

export function useIdeaSubmission(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ideaSubmissionById(id || 'new'),
    queryFn: () => (id ? provider.ideaSubmissions.getById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useIdeaSubmissionsBySubmitter(userId: string) {
  return useQuery({
    queryKey: queryKeys.ideaSubmissionsBySubmitter(userId),
    queryFn: () => provider.ideaSubmissions.listBySubmitter(userId),
    enabled: Boolean(userId),
  });
}

export function useIdeaSubmissionsPendingForStage(stage: ApprovalStage) {
  return useQuery({
    queryKey: queryKeys.ideaSubmissionsPendingForStage(stage),
    queryFn: () => provider.ideaSubmissions.listPendingForStage(stage),
  });
}

export function useSaveIdeaSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<IdeaSubmission>) => provider.ideaSubmissions.save(input),
    onSuccess: (record, input) => {
      const merged = input.id
        ? { ...(queryClient.getQueryData<IdeaSubmission>(queryKeys.ideaSubmissionById(input.id)) ?? record), ...input } as IdeaSubmission
        : record;

      queryClient.setQueryData(queryKeys.ideaSubmissionById(merged.id), merged);
      queryClient.setQueryData<IdeaSubmission[]>(queryKeys.ideaSubmissions, (old) => {
        if (!old) return [merged];
        const idx = old.findIndex((item) => item.id === merged.id);
        return idx >= 0
          ? old.map((item) => (item.id === merged.id ? merged : item))
          : [merged, ...old];
      });

      // Keep My Ideas (submitter-scoped lists) synchronized with status/title edits.
      queryClient.invalidateQueries({ queryKey: ['ideaSubmissions', 'submitter'] });

      // Keep pending-review idea queries in sync right after create/update.
      queryClient.setQueryData<IdeaSubmission[]>(
        queryKeys.ideaSubmissionsPendingForStage('coe-review'),
        (old) => {
          const qualifies =
            merged.submissionStage === SUBMISSION_STAGE.SUBMITTED ||
            merged.submissionStage === SUBMISSION_STAGE.IN_REVIEW;
          const current = old ?? [];
          const without = current.filter((item) => item.id !== merged.id);
          return qualifies ? [merged, ...without] : without;
        },
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.ideaSubmissionsPendingForStage('coe-review') });

      // Refetch the detail (by-id) query regardless of how its id string was
      // formatted in the route. The optimistic setQueryData above keys off the
      // canonical record id, which can differ from the route-param id the detail
      // page reads with (casing/format). A predicate invalidation guarantees the
      // mounted detail page refetches authoritative data instead of serving a
      // stale cached record until the next hard refresh.
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'ideaSubmissions' &&
          query.queryKey.length === 2,
      });
    },
  });
}

export function useApprovalStages(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.approvalStages(submissionId || ''),
    queryFn: () => (submissionId ? provider.approvalStages.listBySubmission(submissionId) : Promise.resolve([])),
    enabled: Boolean(submissionId),
  });
}

export function useSaveApprovalStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ApprovalStageRecord>) => provider.approvalStages.save(input),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvalStages(record.submissionId) });
    },
  });
}

export function useLookupOptions(category: LookupCategory, enabled = true) {
  return useQuery({
    queryKey: queryKeys.lookupOptionsByCategory(category),
    queryFn: () => provider.lookupOptions.listByCategory(category),
    enabled,
  });
}

export function useLookupOptionUsage(enabled = true) {
  return useQuery({
    queryKey: queryKeys.lookupOptionUsage,
    queryFn: () => provider.lookupOptions.getUsageCounts(),
    enabled,
  });
}

export function useSaveLookupOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<LookupOption>) => provider.lookupOptions.save(input),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lookupOptionsByCategory(record.category) });
    },
  });
}

export function useDeleteLookupOption(category: LookupCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => provider.lookupOptions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lookupOptionsByCategory(category) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookupOptionUsage });
    },
  });
}

export function useCoeStructuredReview(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coeStructuredReviewBySubmission(submissionId || ''),
    queryFn: () => (
      submissionId
        ? provider.coeStructuredReviews.getBySubmissionId(submissionId)
        : Promise.resolve(null as CoeStructuredReview | null)
    ),
    enabled: Boolean(submissionId),
  });
}

export function useSaveCoeStructuredReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CoeStructuredReview> & { submissionId: string }) => (
      provider.coeStructuredReviews.save(input)
    ),
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.coeStructuredReviewBySubmission(record.submissionId), record);
      queryClient.invalidateQueries({
        queryKey: queryKeys.coeStructuredReviewBySubmission(record.submissionId),
      });
    },
  });
}

export function useIdeaScorecard(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ideaScorecardBySubmission(submissionId || ''),
    queryFn: () => (
      submissionId
        ? provider.ideaScorecards.getBySubmissionId(submissionId)
        : Promise.resolve(null as IdeaScorecard | null)
    ),
    enabled: Boolean(submissionId),
  });
}

export function useSaveIdeaScorecard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<IdeaScorecard> & { submissionId: string }) => (
      provider.ideaScorecards.save(input)
    ),
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.ideaScorecardBySubmission(record.submissionId), record);
      queryClient.invalidateQueries({
        queryKey: queryKeys.ideaScorecardBySubmission(record.submissionId),
      });
    },
  });
}

export function useScorecardWeights() {
  return useQuery({
    queryKey: queryKeys.scorecardWeights,
    queryFn: () => provider.scorecardWeights.list(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSaveScorecardWeights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weights: { dimensionKey: ScorecardDimensionKey; weight: number }[]) =>
      provider.scorecardWeights.saveWeights(weights),
    onSuccess: (saved) => {
      queryClient.setQueryData<ScorecardWeight[]>(queryKeys.scorecardWeights, saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.scorecardWeights });
    },
  });
}

export function useCoeNotes(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coeNotesBySubmission(submissionId || ''),
    queryFn: () => (
      submissionId
        ? provider.coeNotes.listBySubmission(submissionId)
        : Promise.resolve([] as CoeNote[])
    ),
    enabled: Boolean(submissionId),
  });
}

export function useCreateCoeNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { submissionId: string; noteText: string; subject?: string }) =>
      provider.coeNotes.create(input),
    onSuccess: (note) => {
      queryClient.setQueryData<CoeNote[]>(
        queryKeys.coeNotesBySubmission(note.submissionId),
        (old) => (old ? [note, ...old] : [note]),
      );
    },
  });
}

export function useCoeApprovalHistory(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coeApprovalHistoryBySubmission(submissionId || ''),
    queryFn: () => (
      submissionId
        ? provider.coeApprovalHistory.listBySubmission(submissionId)
        : Promise.resolve([] as CoeApprovalHistoryEntry[])
    ),
    enabled: Boolean(submissionId),
  });
}

export function useCreateCoeApprovalHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      submissionId: string;
      userName: string;
      roleName: string;
      decision: 'approved' | 'denied';
      comments?: string;
    }) => provider.coeApprovalHistory.create(input),
    onSuccess: (entry) => {
      queryClient.setQueryData<CoeApprovalHistoryEntry[]>(
        queryKeys.coeApprovalHistoryBySubmission(entry.submissionId),
        (old) => (old ? [entry, ...old] : [entry]),
      );
    },
  });
}

export function useIdeaRealization(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ideaRealizationBySubmission(submissionId || ''),
    queryFn: () => (
      submissionId
        ? provider.ideaRealizations.getBySubmissionId(submissionId)
        : Promise.resolve(null as IdeaRealization | null)
    ),
    enabled: Boolean(submissionId),
  });
}

export function useSaveIdeaRealization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<IdeaRealization> & { submissionId: string }) =>
      provider.ideaRealizations.save(input),
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.ideaRealizationBySubmission(record.submissionId), record);
      queryClient.invalidateQueries({
        queryKey: queryKeys.ideaRealizationBySubmission(record.submissionId),
      });
    },
  });
}

export function useDirectoryUsers() {
  return useQuery({
    queryKey: queryKeys.directoryUsers,
    queryFn: () => provider.directoryUsers.list(),
    staleTime: 30 * 60 * 1000,
  });
}

export function usePowerPlatformEnvironments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.powerPlatformEnvironments,
    queryFn: () => provider.powerPlatformEnvironments.list(),
    staleTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useCurrentUserTeams() {
  return useQuery({
    queryKey: queryKeys.currentUserTeams,
    queryFn: () => provider.currentUser.getTeamNames(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAiCoeTeam(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiCoeTeam,
    queryFn: () => provider.aiCoeTeam.list(),
    enabled,
  });
}

export function useAiCoeRoles(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiCoeRoles,
    queryFn: () => provider.aiCoeRoles.list(),
    enabled,
  });
}

export function useSaveAiCoeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; name: string; description?: string }) =>
      provider.aiCoeRoles.save(input),
    onSuccess: (role) => {
      queryClient.setQueryData<AiCoeRole[]>(queryKeys.aiCoeRoles, (old) => {
        if (!old) return [role];
        const idx = old.findIndex((r) => r.id === role.id);
        return idx >= 0
          ? old.map((r) => (r.id === role.id ? role : r))
          : [...old, role].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
  });
}

export function useDeleteAiCoeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => provider.aiCoeRoles.delete(id),
    onSuccess: (_void, deletedId) => {
      queryClient.setQueryData<AiCoeRole[]>(queryKeys.aiCoeRoles, (old) =>
        old ? old.filter((r) => r.id !== deletedId) : [],
      );
    },
  });
}

// ── Platform catalog ───────────────────────────────────────────────────────

export function usePlatforms(enabled = true) {
  return useQuery({
    queryKey: queryKeys.platforms,
    queryFn: () => provider.platforms.list(),
    enabled,
  });
}

export function usePlatformsWithAttributes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.platformsWithAttributes,
    queryFn: () => provider.platforms.listWithAttributes(),
    enabled,
  });
}

function invalidatePlatformQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.platforms });
  queryClient.invalidateQueries({ queryKey: queryKeys.platformsWithAttributes });
}

export function useSavePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Platform> & { name: string }) => provider.platforms.save(input),
    onSuccess: () => invalidatePlatformQueries(queryClient),
  });
}

export function useDeletePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => provider.platforms.delete(id),
    onSuccess: () => invalidatePlatformQueries(queryClient),
  });
}

export function usePlatformAttributes(category: PlatformAttributeCategory, enabled = true) {
  return useQuery({
    queryKey: queryKeys.platformAttributesByCategory(category),
    queryFn: () => provider.platformAttributes.listByCategory(category),
    enabled,
  });
}

export function useSavePlatformAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PlatformAttribute> & { name: string; category: PlatformAttributeCategory }) =>
      provider.platformAttributes.save(input),
    onSuccess: (attribute) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.platformAttributesByCategory(attribute.category),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformsWithAttributes });
    },
  });
}

export function useDeletePlatformAttribute(category: PlatformAttributeCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => provider.platformAttributes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platformAttributesByCategory(category) });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformsWithAttributes });
    },
  });
}

export function usePlatformAssignments(platformId: string, enabled = true) {
  return useQuery<PlatformAttributeAssignment[]>({
    queryKey: queryKeys.platformAssignments(platformId || 'none'),
    queryFn: () => provider.platformAttributeAssignments.listByPlatform(platformId),
    enabled: enabled && Boolean(platformId),
  });
}

export function useSetPlatformAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { platformId: string; attributeIds: string[] }) =>
      provider.platformAttributeAssignments.setAssignments(input.platformId, input.attributeIds),
    onSuccess: (_void, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platformAssignments(input.platformId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.platformsWithAttributes });
    },
  });
}

// ── Submission platform selections (idea ↔ platform, many-to-many) ──────────

export function useSubmissionPlatforms(submissionId: string | undefined, enabled = true) {
  return useQuery<SubmissionPlatform[]>({
    queryKey: queryKeys.submissionPlatforms(submissionId || 'none'),
    queryFn: () => provider.submissionPlatforms.listBySubmission(submissionId as string),
    enabled: enabled && Boolean(submissionId),
  });
}

export function useAllSubmissionPlatforms(enabled = true) {
  return useQuery<SubmissionPlatform[]>({
    queryKey: queryKeys.submissionPlatformsAll,
    queryFn: () => provider.submissionPlatforms.listAll(),
    enabled,
  });
}

export function useSetSubmissionPlatforms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { submissionId: string; platformIds: string[] }) =>
      provider.submissionPlatforms.setForSubmission(input.submissionId, input.platformIds),
    onSuccess: (_void, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.submissionPlatforms(input.submissionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.submissionPlatformsAll });
    },
  });
}

export function useSaveAiCoeTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; memberId: string; userName: string; userEmail: string; roleId: string }) =>
      provider.aiCoeTeam.save(input),
    onSuccess: (member) => {
      queryClient.setQueryData<AiCoeTeamMember[]>(queryKeys.aiCoeTeam, (old) => {
        if (!old) return [member];
        const idx = old.findIndex((m) => m.id === member.id);
        return idx >= 0
          ? old.map((m) => (m.id === member.id ? member : m))
          : [...old, member].sort((a, b) => a.userName.localeCompare(b.userName));
      });
    },
  });
}

export function useDeleteAiCoeTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => provider.aiCoeTeam.delete(id),
    onSuccess: (_void, deletedId) => {
      queryClient.setQueryData<AiCoeTeamMember[]>(queryKeys.aiCoeTeam, (old) =>
        old ? old.filter((m) => m.id !== deletedId) : [],
      );
    },
  });
}

export function useAiCoeTeamApprovals(submissionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.aiCoeTeamApprovalsBySubmission(submissionId || ''),
    queryFn: () => (
      submissionId
        ? provider.aiCoeTeamApprovals.listBySubmission(submissionId)
        : Promise.resolve([] as AiCoeTeamApproval[])
    ),
    enabled: Boolean(submissionId),
  });
}

export function useSaveAiCoeTeamApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { submissionId: string; teamMemberId: string; approvalStatus: 'pending' | 'approved' | 'denied'; comment?: string }) =>
      provider.aiCoeTeamApprovals.save(input),
    onSuccess: (approval) => {
      queryClient.setQueryData<AiCoeTeamApproval[]>(
        queryKeys.aiCoeTeamApprovalsBySubmission(approval.submissionId),
        (old) => {
        if (!old) return [approval];
        const idx = old.findIndex((item) => item.teamMemberId === approval.teamMemberId);
        return idx >= 0
          ? old.map((item) => (item.teamMemberId === approval.teamMemberId ? approval : item))
          : [...old, approval];
        },
      );
    },
  });
}

export function useDeleteAiCoeTeamApproval(submissionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (approvalId: string) => provider.aiCoeTeamApprovals.delete(approvalId),
    onSuccess: (_void, approvalId) => {
      if (!submissionId) return;
      queryClient.setQueryData<AiCoeTeamApproval[]>(
        queryKeys.aiCoeTeamApprovalsBySubmission(submissionId),
        (old) => (old ? old.filter((a) => a.id !== approvalId) : []),
      );
    },
  });
}

/**
 * An entry in the signed-in reviewer's personal approvals queue: a submission
 * awaiting CoE review together with its scorecard and the reviewer's own
 * approval record (if any).
 */
export interface MyApprovalItem {
  submission: IdeaSubmission;
  scorecard: IdeaScorecard | null;
  myApproval: AiCoeTeamApproval | undefined;
}

/**
 * Builds the "My Approvals" queue for a given AI CoE team member. Returns the
 * submissions in CoE review that the member has NOT yet approved or denied
 * (no approval record, or one still marked pending), each enriched with its
 * scorecard so the queue can show the weighted score and decision band.
 *
 * Pass the team-member record id (AiCoeTeamMember.id) — resolve it in the page
 * from useCurrentUser() + useAiCoeTeam() to avoid a circular import here.
 */
export function useMyPendingApprovals(memberId: string | undefined) {
  const { data: pending = [], isLoading: pendingLoading } =
    useIdeaSubmissionsPendingForStage('coe-review');

  const approvalResults = useQueries({
    queries: pending.map((submission) => ({
      queryKey: queryKeys.aiCoeTeamApprovalsBySubmission(submission.id),
      queryFn: () => provider.aiCoeTeamApprovals.listBySubmission(submission.id),
    })),
  });

  const scorecardResults = useQueries({
    queries: pending.map((submission) => ({
      queryKey: queryKeys.ideaScorecardBySubmission(submission.id),
      queryFn: () => provider.ideaScorecards.getBySubmissionId(submission.id),
    })),
  });

  const items = useMemo<MyApprovalItem[]>(() => {
    return pending
      .map((submission, index) => {
        const approvals = approvalResults[index]?.data ?? [];
        const scorecard = scorecardResults[index]?.data ?? null;
        const myApproval = memberId
          ? approvals.find((a) => a.teamMemberId === memberId)
          : undefined;
        return { submission, scorecard, myApproval };
      })
      .filter((item) => !item.myApproval || item.myApproval.approvalStatus === 'pending');
  }, [pending, approvalResults, scorecardResults, memberId]);

  const isLoading =
    pendingLoading ||
    approvalResults.some((r) => r.isLoading) ||
    scorecardResults.some((r) => r.isLoading);

  return { items, isLoading };
}
