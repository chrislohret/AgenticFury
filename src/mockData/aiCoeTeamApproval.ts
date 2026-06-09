import type { AiCoeTeamApproval } from '@/types/domain-models';

export const mockAiCoeTeamApprovals: AiCoeTeamApproval[] = [
  {
    id: 'approval-team-1-idea-3',
    submissionId: 'mock-idea-3',
    teamMemberId: 'team-1',
    approvalStatus: 'approved',
    comment: 'Approved for CoE progression.',
    reviewedBy: 'Priya Sharma',
    reviewedOn: '2026-05-24T10:15:00Z',
  },
  {
    id: 'approval-team-2-idea-3',
    submissionId: 'mock-idea-3',
    teamMemberId: 'team-2',
    approvalStatus: 'denied',
    comment: 'Need additional controls before approval.',
    reviewedBy: 'James Park',
    reviewedOn: '2026-05-24T11:20:00Z',
  },
  {
    id: 'approval-team-3-idea-3',
    submissionId: 'mock-idea-3',
    teamMemberId: 'team-3',
    approvalStatus: 'pending',
  },
  {
    id: 'approval-team-4-idea-3',
    submissionId: 'mock-idea-3',
    teamMemberId: 'team-4',
    approvalStatus: 'pending',
  },
  {
    id: 'approval-team-1-idea-1',
    submissionId: 'mock-idea-1',
    teamMemberId: 'team-1',
    approvalStatus: 'pending',
  },
];