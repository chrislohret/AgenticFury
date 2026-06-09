import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createAppDataProvider } from '@/services/providerFactory';
import type {
  IdeaSubmission,
  ApprovalStageRecord,
  ApprovalStage,
  LookupCategory,
  LookupOption,
  CoeStructuredReview,
  CoeNote,
  CoeApprovalHistoryEntry,
  AiCoeRole,
  AiCoeTeamApproval,
  AiCoeTeamMember,
} from '@/types/domain-models';

const provider = createAppDataProvider();

export const queryKeys = {
  ideaSubmissions: ['ideaSubmissions'] as const,
  ideaSubmissionById: (id: string) => ['ideaSubmissions', id] as const,
  ideaSubmissionsBySubmitter: (userId: string) => ['ideaSubmissions', 'submitter', userId] as const,
  ideaSubmissionsPendingForStage: (stage: ApprovalStage) => ['ideaSubmissions', 'pending', stage] as const,
  approvalStages: (submissionId: string) => ['approvalStages', submissionId] as const,
  lookupOptionsByCategory: (category: LookupCategory) => ['lookupOptions', category] as const,
  coeStructuredReviewBySubmission: (submissionId: string) => ['coeStructuredReview', submissionId] as const,
  coeNotesBySubmission: (submissionId: string) => ['coeNotes', submissionId] as const,
  coeApprovalHistoryBySubmission: (submissionId: string) => ['coeApprovalHistory', submissionId] as const,
  aiCoeTeam: ['aiCoeTeam'] as const,
  aiCoeRoles: ['aiCoeRoles'] as const,
  aiCoeTeamApprovalsBySubmission: (submissionId: string) => ['aiCoeTeamApprovals', submissionId] as const,
  directoryUsers: ['directoryUsers'] as const,
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
          const qualifies = merged.status === 100000001 || merged.status === 100000002;
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

export function useDirectoryUsers() {
  return useQuery({
    queryKey: queryKeys.directoryUsers,
    queryFn: () => provider.directoryUsers.list(),
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
