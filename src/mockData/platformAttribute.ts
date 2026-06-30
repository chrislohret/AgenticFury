import type { PlatformAttribute } from '@/types/domain-models';

/**
 * Seed reusable platform attributes for prototype/mock mode, spanning the three
 * categories. Assigned to platforms via mockPlatformAttributeAssignments.
 */
export const mockPlatformAttributes: PlatformAttribute[] = [
  // ── Capabilities ──────────────────────────────────────────────────────────
  {
    id: 'attr-cap-nocode',
    name: 'No-code authoring',
    description: 'Build and publish agents without writing code.',
    category: 'capability',
    isActive: true,
  },
  {
    id: 'attr-cap-connectors',
    name: 'Power Platform connectors',
    description: 'Reach 1,000+ connectors and custom connectors for actions.',
    category: 'capability',
    isActive: true,
  },
  {
    id: 'attr-cap-custom-models',
    name: 'Custom model deployment',
    description: 'Deploy and fine-tune your own foundation models.',
    category: 'capability',
    isActive: true,
  },
  {
    id: 'attr-cap-grounding',
    name: 'Tenant data grounding',
    description: 'Ground responses in Microsoft 365 tenant content.',
    category: 'capability',
    isActive: true,
  },
  // ── Decision criteria ─────────────────────────────────────────────────────
  {
    id: 'attr-dec-low-complexity',
    name: 'Best for low complexity',
    description: 'Ideal when the scenario is simple and declarative.',
    category: 'decision-criteria',
    isActive: true,
  },
  {
    id: 'attr-dec-procode-team',
    name: 'Requires pro-code team',
    description: 'Choose when you have engineering capacity for custom builds.',
    category: 'decision-criteria',
    isActive: true,
  },
  {
    id: 'attr-dec-governance',
    name: 'Enterprise governance needs',
    description: 'Pick when DLP, ALM, and environment isolation matter.',
    category: 'decision-criteria',
    isActive: true,
  },
  // ── Cost mechanisms ───────────────────────────────────────────────────────
  {
    id: 'attr-cost-message-meter',
    name: 'Per-message metering',
    description: 'Consumption billed per billed message / Copilot Credit.',
    category: 'cost-mechanism',
    isActive: true,
  },
  {
    id: 'attr-cost-included-license',
    name: 'Included with M365 license',
    description: 'Covered by an existing Microsoft 365 Copilot license.',
    category: 'cost-mechanism',
    isActive: true,
  },
  {
    id: 'attr-cost-azure-consumption',
    name: 'Azure consumption',
    description: 'Pay-as-you-go Azure compute and model inference costs.',
    category: 'cost-mechanism',
    isActive: true,
  },
];
