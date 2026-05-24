import { axeSeverity } from './severity-map.js';

export interface AxeViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
  }>;
}

export interface AxeCheckResult {
  score: number | null;
  status: 'scored' | 'not_applicable' | 'tool_unavailable';
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string;
  location: { type: 'selector'; selector: string | null; bounding_box: null; viewport: null } | null;
  confidence: 'deterministic';
}

export async function runAxeChecks(page: unknown): Promise<AxeCheckResult[]> {
  // This function is called with a Playwright Page during the capture phase
  // In production, it would use @axe-core/playwright's AxeBuilder
  // For now, provide the adapter structure
  try {
    const { AxeBuilder } = await import('@axe-core/playwright');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await new AxeBuilder({ page: page as Record<string, any> }).analyze();

    const findings: AxeCheckResult[] = [];

    // Process violations
    for (const violation of results.violations) {
      const sev = axeSeverity(violation.impact);
      const selector = violation.nodes[0]?.target?.[0] ?? null;

      findings.push({
        score: 0,
        status: 'scored',
        evidence: `${violation.id}: ${violation.help}`.slice(0, 300),
        evidence_source: `axe.${violation.id}`,
        severity: sev,
        suggested_fix: (violation.nodes[0]?.failureSummary ?? violation.help).slice(0, 280),
        location: selector ? { type: 'selector', selector, bounding_box: null, viewport: null } : null,
        confidence: 'deterministic',
      });
    }

    // If no violations, report a passing check
    if (findings.length === 0) {
      findings.push({
        score: 4,
        status: 'scored',
        evidence: 'No accessibility violations detected by axe-core',
        evidence_source: 'axe.all-rules',
        severity: 0,
        suggested_fix: '',
        location: null,
        confidence: 'deterministic',
      });
    }

    return findings;
  } catch {
    return [{
      score: null,
      status: 'tool_unavailable',
      evidence: 'axe-core analysis could not be executed',
      evidence_source: 'axe.all-rules',
      severity: 0,
      suggested_fix: '',
      location: null,
      confidence: 'deterministic',
    }];
  }
}

export const accessibilityAdapter = {
  check_family: 'axe',
  check_id: 'all-rules',
  full_id: 'axe.all-rules',
};
