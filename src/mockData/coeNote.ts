import type { CoeNote } from '@/types/domain-models';

export const mockCoeNotes: CoeNote[] = [
  {
    id: 'note-1',
    submissionId: 'mock-idea-3',
    noteText:
      'Initial triage complete. The proposed use case aligns with our Q3 AI strategy. Need IT sign-off on the data source access method before we can progress to executive review.',
    subject: 'Triage Complete',
    createdByName: 'Sarah Mitchell',
    createdOn: '2026-05-20T09:15:00Z',
  },
  {
    id: 'note-2',
    submissionId: 'mock-idea-3',
    noteText:
      'Confirmed with Legal that PHI handling will require a Business Associate Agreement (BAA). Flagging for IT security review prior to finalising the risk assessment.',
    createdByName: 'David Ramirez',
    createdOn: '2026-05-22T14:30:00Z',
  },
  {
    id: 'note-3',
    submissionId: 'mock-idea-3',
    noteText:
      'Risk assessment drafted. Recommend adding a data retention policy clause before the record goes to executive approval. Shared draft with the submitter for comment.',
    createdByName: 'Sarah Mitchell',
    createdOn: '2026-05-26T11:00:00Z',
  },
];
