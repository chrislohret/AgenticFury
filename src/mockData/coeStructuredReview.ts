import type { CoeStructuredReview } from '@/types/domain-models';

export const mockCoeStructuredReviews: CoeStructuredReview[] = [
  {
    id: 'review-mock-1',
    submissionId: 'mock-idea-3',
    businessObjectiveIds: ['lkp-obj-1'],
    intendedUserRoleIds: ['lkp-role-1', 'lkp-role-2'],
    dataSourceIds: ['lkp-ds-1', 'lkp-ds-2'],
    expectedOutcomeIds: ['lkp-out-1'],
    riskFactorIds: ['lkp-risk-2'],
    departmentIds: ['lkp-dept-1'],
    updatedBy: 'CoE Lead',
    updatedOn: '2026-05-14',
  },
];
