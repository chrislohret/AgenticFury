import type { ApprovalStageRecord } from '@/types/domain-models';

export const mockApprovalStageRecords: ApprovalStageRecord[] = [
  // mock-idea-3 (Under Review) — CoE Review in progress
  {
    id: 'mock-stage-1',
    submissionId: 'mock-idea-3',
    stage: 'coe-review',
    stageStatus: 'pending',
    comments: 'Initial triage complete. Scheduled for full CoE review panel on June 3rd.',
    reviewedBy: undefined,
    reviewedOn: undefined,
  },

  // mock-idea-4 (Approved) — all 3 stages completed
  {
    id: 'mock-stage-2',
    submissionId: 'mock-idea-4',
    stage: 'coe-review',
    stageStatus: 'approved',
    comments: 'Strong alignment with HR digital transformation objectives. Recommended for IT sign-off.',
    reviewedBy: 'CoE Lead',
    reviewedOn: '2026-04-01',
  },
  {
    id: 'mock-stage-3',
    submissionId: 'mock-idea-4',
    stage: 'it-signoff',
    stageStatus: 'approved',
    comments: 'Data sources are accessible and compliant with security policy. Approved to proceed.',
    reviewedBy: 'IT Architecture Lead',
    reviewedOn: '2026-04-10',
  },
  {
    id: 'mock-stage-4',
    submissionId: 'mock-idea-4',
    stage: 'executive-approval',
    stageStatus: 'approved',
    comments: 'Strategic priority for FY2026 HR transformation. Full approval granted.',
    reviewedBy: 'CHRO',
    reviewedOn: '2026-04-20',
  },

  // mock-idea-5 (Rejected) — rejected at CoE stage
  {
    id: 'mock-stage-5',
    submissionId: 'mock-idea-5',
    stage: 'coe-review',
    stageStatus: 'rejected',
    comments: 'External social media API costs exceed projected ROI. Consider a scaled-down pilot with a single platform before resubmission.',
    reviewedBy: 'CoE Lead',
    reviewedOn: '2026-04-15',
  },

  // mock-idea-6 (On Hold) — on hold at IT sign-off stage
  {
    id: 'mock-stage-6',
    submissionId: 'mock-idea-6',
    stage: 'coe-review',
    stageStatus: 'approved',
    comments: 'Excellent ROI potential. Approved for IT review.',
    reviewedBy: 'CoE Lead',
    reviewedOn: '2026-04-05',
  },
  {
    id: 'mock-stage-7',
    submissionId: 'mock-idea-6',
    stage: 'it-signoff',
    stageStatus: 'on-hold',
    comments: 'Pending data governance review of ERP purchase history access. Re-evaluate after DG board meeting in Q3.',
    reviewedBy: 'IT Security',
    reviewedOn: '2026-04-18',
  },

  // mock-idea-7 (In Progress) — all stages approved
  {
    id: 'mock-stage-8',
    submissionId: 'mock-idea-7',
    stage: 'coe-review',
    stageStatus: 'approved',
    comments: 'High-impact, low-risk. Teams integration is well-supported. Recommend fast-track.',
    reviewedBy: 'CoE Lead',
    reviewedOn: '2026-02-20',
  },
  {
    id: 'mock-stage-9',
    submissionId: 'mock-idea-7',
    stage: 'it-signoff',
    stageStatus: 'approved',
    comments: 'SharePoint data source compliant. Teams channel deployment approved.',
    reviewedBy: 'IT Architecture Lead',
    reviewedOn: '2026-02-28',
  },
  {
    id: 'mock-stage-10',
    submissionId: 'mock-idea-7',
    stage: 'executive-approval',
    stageStatus: 'approved',
    comments: 'Fully aligned with HR efficiency goals. Build approved.',
    reviewedBy: 'CHRO',
    reviewedOn: '2026-03-05',
  },

  // mock-idea-8 (Completed) — all stages approved
  {
    id: 'mock-stage-11',
    submissionId: 'mock-idea-8',
    stage: 'coe-review',
    stageStatus: 'approved',
    comments: 'Proven use case with clear ROI. Approved.',
    reviewedBy: 'CoE Lead',
    reviewedOn: '2026-01-20',
  },
  {
    id: 'mock-stage-12',
    submissionId: 'mock-idea-8',
    stage: 'it-signoff',
    stageStatus: 'approved',
    comments: 'ERP integration scope confirmed. Approved.',
    reviewedBy: 'IT Architecture Lead',
    reviewedOn: '2026-01-25',
  },
  {
    id: 'mock-stage-13',
    submissionId: 'mock-idea-8',
    stage: 'executive-approval',
    stageStatus: 'approved',
    comments: 'Finance priority project. Full approval.',
    reviewedBy: 'CFO',
    reviewedOn: '2026-02-01',
  },
];
