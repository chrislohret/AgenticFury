import type { IdeaScorecard } from '@/types/domain-models';

export const mockIdeaScorecards: IdeaScorecard[] = [
  {
    id: 'scorecard-mock-1',
    submissionId: 'mock-idea-3',
    businessValueScore: 4,
    efficiencyScore: 3,
    adoptionScore: 4,
    trustGovernanceScore: 3,
    technicalPerformanceScore: 4,
    businessValueNotes: 'Clear enterprise-wide impact with measurable savings.',
    efficiencyNotes: 'Automates a multi-step intake workflow.',
    adoptionNotes: 'Strong fit into the CoE daily review process.',
    trustGovernanceNotes: 'Ownership defined; needs a documented audit trail.',
    technicalPerformanceNotes: 'Feasible with existing Dataverse + connector stack.',
    weightedTotal: 71,
    scoredBy: 'systemuser-mock-1',
    scoredByName: 'CoE Reviewer',
    scoredOn: '2026-05-16',
  },
];
