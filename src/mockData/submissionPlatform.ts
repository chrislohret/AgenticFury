import type { SubmissionPlatform } from '@/types/domain-models';

/**
 * Seed idea↔platform selections for prototype/mock mode. Demonstrates a
 * submission selecting multiple platforms.
 */
export const mockSubmissionPlatforms: SubmissionPlatform[] = [
  { id: 'ip-1-a', submissionId: 'mock-idea-1', platformId: 'platform-copilot-studio' },
  { id: 'ip-1-b', submissionId: 'mock-idea-1', platformId: 'platform-agent-builder' },
  { id: 'ip-2-a', submissionId: 'mock-idea-2', platformId: 'platform-ai-foundry' },
  { id: 'ip-3-a', submissionId: 'mock-idea-3', platformId: 'platform-copilot-studio' },
  { id: 'ip-3-b', submissionId: 'mock-idea-3', platformId: 'platform-ai-foundry' },
];
