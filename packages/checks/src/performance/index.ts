import { PERFORMANCE_METRICS, scoreFromMetric } from './metric-map.js';

export interface PerformanceCheckResult {
  score: number | null;
  status: 'scored' | 'not_applicable' | 'tool_unavailable';
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string[];
  location: null;
  confidence: 'predicted';
}

export async function runLighthouseChecks(url: string): Promise<PerformanceCheckResult[]> {
  try {
    const chromeLauncher = await import('chrome-launcher');
    const lighthouse = await import('lighthouse');
    const { chromiumExecutablePath } = await import('@webui-rubric/capture');

    // Lighthouse is Chromium-only and independent of the Playwright capture
    // engine. Point chrome-launcher at Playwright's bundled Chromium so
    // performance metrics keep working even when capture runs on Firefox/WebKit
    // and even when no system Chrome is installed. Falls back to chrome-launcher's
    // default discovery when the path can't be resolved.
    const chromePath = chromiumExecutablePath();
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox'],
      ...(chromePath ? { chromePath } : {}),
    });

    const result = await lighthouse.default(url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance'],
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
      },
    });

    await chrome.kill();

    const findings: PerformanceCheckResult[] = [];
    const audits = result?.lhr?.audits ?? {};

    for (const metric of PERFORMANCE_METRICS) {
      const audit = audits[metric.lighthouse_audit_id];
      if (!audit || audit.numericValue === undefined) {
        findings.push({
          score: null,
          status: 'not_applicable',
          evidence: `${metric.metric_id}: metric not available`,
          evidence_source: `lighthouse.${metric.metric_id}`,
          severity: 0,
          suggested_fix: [],
          location: null,
          confidence: 'predicted',
        });
        continue;
      }

      const value = audit.numericValue;
      const s = scoreFromMetric(value, metric.thresholds);
      const severity = 4 - s;

      findings.push({
        score: s,
        status: 'scored',
        evidence: `${metric.metric_id}: ${value.toFixed(1)}${metric.unit} (score: ${s}/4)`.slice(
          0,
          300,
        ),
        evidence_source: `lighthouse.${metric.metric_id}`,
        severity,
        suggested_fix: s < 4 ? [metric.fix_template.replace('{value}', value.toFixed(1))] : [],
        location: null,
        confidence: 'predicted',
      });
    }

    return findings;
  } catch (error) {
    return PERFORMANCE_METRICS.map((m) => ({
      score: null,
      status: 'tool_unavailable' as const,
      evidence:
        `Lighthouse analysis failed: ${error instanceof Error ? error.message : 'unknown error'}`.slice(
          0,
          300,
        ),
      evidence_source: `lighthouse.${m.metric_id}`,
      severity: 0,
      suggested_fix: [],
      location: null,
      confidence: 'predicted' as const,
    }));
  }
}
