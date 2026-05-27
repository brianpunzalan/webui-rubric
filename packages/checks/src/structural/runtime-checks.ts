interface ConsoleEntry {
  level: 'error' | 'warning';
  text: string;
}

export interface RuntimeCheckResult {
  score: number;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string[];
  location: null;
}

// console.error-count
export function checkConsoleErrors(consoleErrors: ConsoleEntry[]): RuntimeCheckResult {
  const errorCount = consoleErrors.filter((e) => e.level === 'error').length;
  const score =
    errorCount === 0 ? 4 : errorCount <= 2 ? 3 : errorCount <= 5 ? 2 : errorCount <= 10 ? 1 : 0;
  return {
    score,
    evidence: `${errorCount} console errors detected during page load`,
    evidence_source: 'console.error-count',
    severity: 4 - score,
    suggested_fix:
      score < 4 ? [`Fix console errors; ${errorCount} errors detected during page load`] : [],
    location: null,
  };
}

// har.resource-count
export function checkResourceCount(har: unknown): RuntimeCheckResult {
  let requestCount = 0;
  try {
    const harObj = har as Record<string, unknown>;
    const log = harObj?.log as Record<string, unknown> | undefined;
    const entries = log?.entries;
    if (Array.isArray(entries)) {
      requestCount = entries.length;
    }
  } catch {
    return {
      score: 4,
      evidence: 'HAR data unavailable',
      evidence_source: 'har.resource-count',
      severity: 0,
      suggested_fix: [],
      location: null,
    };
  }

  const score =
    requestCount <= 25
      ? 4
      : requestCount <= 40
        ? 3
        : requestCount <= 60
          ? 2
          : requestCount <= 100
            ? 1
            : 0;
  return {
    score,
    evidence: `${requestCount} network requests during page load`,
    evidence_source: 'har.resource-count',
    severity: 4 - score,
    suggested_fix:
      score < 4
        ? [`Reduce number of network requests; current count is ${requestCount} (target: ≤40)`]
        : [],
    location: null,
  };
}
