// Environment zone options for the afp_environmentzone choice column.
// Surfaced only when the AI platform is Copilot Studio.

export interface EnvironmentZoneOption {
  value: number;
  label: string;
}

export const ENVIRONMENT_ZONE_OPTIONS: EnvironmentZoneOption[] = [
  { value: 747150000, label: 'Zone 1 (Citizen)' },
  { value: 747150001, label: 'Zone 2 (IT Partnered Development)' },
  { value: 747150002, label: 'Zone 3 (IT Development)' },
];

export const ENVIRONMENT_ZONE_LABELS: Record<number, string> = Object.fromEntries(
  ENVIRONMENT_ZONE_OPTIONS.map((opt) => [opt.value, opt.label]),
);

export function environmentZoneLabel(value: number | undefined | null): string {
  if (value == null) return 'Unspecified';
  return ENVIRONMENT_ZONE_LABELS[value] ?? `Zone ${value}`;
}
