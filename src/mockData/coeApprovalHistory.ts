import type { CoeApprovalHistoryEntry } from '@/types/domain-models';

export const mockCoeApprovalHistory: CoeApprovalHistoryEntry[] = [
  {
    id: 'approval-history-1',
    submissionId: 'mock-idea-3',
    userName: 'Priya Sharma',
    roleName: 'CoE Lead',
    decision: 'approved',
    comments: 'Approved after confirming the business value and downstream support model.',
    reviewedOn: '2026-05-23T13:10:00Z',
  },
  {
    id: 'approval-history-2',
    submissionId: 'mock-idea-3',
    userName: 'James Park',
    roleName: 'Technical Reviewer',
    decision: 'denied',
    comments: 'Denied pending clarification on the source system access pattern and retention policy.',
    reviewedOn: '2026-05-24T09:42:00Z',
  },
  {
    id: 'approval-history-3',
    submissionId: 'mock-idea-3',
    userName: 'Sarah Chen',
    roleName: 'Security Reviewer',
    decision: 'approved',
    comments: 'No blocking security concerns identified. Monitoring controls are sufficient for prototype use.',
    reviewedOn: '2026-05-26T15:25:00Z',
  },
];