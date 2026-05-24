export const AXE_IMPACT_TO_SEVERITY: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

export function axeSeverity(impact: string | undefined): number {
  return AXE_IMPACT_TO_SEVERITY[impact ?? 'minor'] ?? 1;
}
