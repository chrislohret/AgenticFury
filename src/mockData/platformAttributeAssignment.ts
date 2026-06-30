import type { PlatformAttributeAssignment } from '@/types/domain-models';

/**
 * Seed platform↔attribute assignments for prototype/mock mode. Each row links a
 * platform to one reusable attribute (capability / decision criteria / cost).
 */
export const mockPlatformAttributeAssignments: PlatformAttributeAssignment[] = [
  // Microsoft 365 Agent Builder
  { id: 'pa-ab-1', platformId: 'platform-agent-builder', attributeId: 'attr-cap-nocode' },
  { id: 'pa-ab-2', platformId: 'platform-agent-builder', attributeId: 'attr-cap-grounding' },
  { id: 'pa-ab-3', platformId: 'platform-agent-builder', attributeId: 'attr-dec-low-complexity' },
  { id: 'pa-ab-4', platformId: 'platform-agent-builder', attributeId: 'attr-cost-included-license' },

  // Microsoft Copilot Studio
  { id: 'pa-cs-1', platformId: 'platform-copilot-studio', attributeId: 'attr-cap-nocode' },
  { id: 'pa-cs-2', platformId: 'platform-copilot-studio', attributeId: 'attr-cap-connectors' },
  { id: 'pa-cs-3', platformId: 'platform-copilot-studio', attributeId: 'attr-dec-governance' },
  { id: 'pa-cs-4', platformId: 'platform-copilot-studio', attributeId: 'attr-cost-message-meter' },

  // Microsoft Azure AI Foundry
  { id: 'pa-af-1', platformId: 'platform-ai-foundry', attributeId: 'attr-cap-custom-models' },
  { id: 'pa-af-2', platformId: 'platform-ai-foundry', attributeId: 'attr-dec-procode-team' },
  { id: 'pa-af-3', platformId: 'platform-ai-foundry', attributeId: 'attr-dec-governance' },
  { id: 'pa-af-4', platformId: 'platform-ai-foundry', attributeId: 'attr-cost-azure-consumption' },
];
