// AI platform selection options for the afp_aiplatformselection choice column.
// Shared between the submission detail editor and the analytics roll-up.

export interface AiPlatformOption {
  value: number;
  label: string;
}

export const AI_PLATFORM_OPTIONS: AiPlatformOption[] = [
  { value: 747150000, label: 'Agent Builder' },
  { value: 747150001, label: 'Copilot Studio' },
  { value: 747150002, label: 'Azure AI Foundry' },
];

export const AI_PLATFORM_LABELS: Record<number, string> = Object.fromEntries(
  AI_PLATFORM_OPTIONS.map((opt) => [opt.value, opt.label]),
);

export function aiPlatformLabel(value: number | undefined | null): string {
  if (value == null) return 'Unspecified';
  return AI_PLATFORM_LABELS[value] ?? `Platform ${value}`;
}
