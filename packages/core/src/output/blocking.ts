import type { BlockingEntry, SubCriterionFinding, Dimension } from '../types/index.js';

export function buildBlockingList(
  dimensions: Dimension[],
  dimensionFindings: Map<string, SubCriterionFinding[]>,
): BlockingEntry[] {
  const blocking: BlockingEntry[] = [];

  for (const dim of dimensions) {
    const findings = dimensionFindings.get(dim.id) ?? [];
    for (const sub of dim.sub_criteria) {
      if (!sub.blocking_if_zero) continue;
      const finding = findings.find(f => f.id === sub.id);
      if (finding && finding.score === 0 && finding.status === 'scored') {
        const wcagRef = sub.references.find(r => r.startsWith('WCAG')) ?? '';
        blocking.push({
          criterion_id: sub.id,
          reason: `${sub.name} failed (score 0)`,
          wcag_ref: wcagRef,
          evidence: finding.evidence,
          location: finding.location ?? null,
          severity: 4,
        });
      }
    }
  }

  return blocking;
}
