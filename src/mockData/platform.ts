import type { Platform } from '@/types/domain-models';

/**
 * Seed platforms for prototype/mock mode. Mirrors the three platforms that were
 * previously hardcoded in the carousel, now as configurable records.
 */
export const mockPlatforms: Platform[] = [
  {
    id: 'platform-agent-builder',
    name: 'Microsoft 365 Agent Builder',
    description:
      'Lightweight, no-code agent creation inside Microsoft 365 for declarative scenarios grounded in your tenant data.',
    isActive: true,
    displayOrder: 10,
  },
  {
    id: 'platform-copilot-studio',
    name: 'Microsoft Copilot Studio',
    description:
      'Low-code conversational agent platform with topics, generative orchestration, connectors, and Power Platform integration.',
    isActive: true,
    displayOrder: 20,
  },
  {
    id: 'platform-ai-foundry',
    name: 'Microsoft Azure AI Foundry',
    description:
      'Pro-code platform for building, evaluating, and deploying custom AI models and agents with full control over the stack.',
    isActive: true,
    displayOrder: 30,
  },
];
