export interface MetricThresholds {
  metric_id: string;
  lighthouse_audit_id: string;
  unit: string;
  thresholds: [number, number, number, number]; // [score4max, score3max, score2max, score1max]
  fix_template: string;
}

export const PERFORMANCE_METRICS: MetricThresholds[] = [
  {
    metric_id: 'lcp',
    lighthouse_audit_id: 'largest-contentful-paint',
    unit: 'ms',
    thresholds: [1200, 2500, 4000, 6000],
    fix_template: 'Reduce Largest Contentful Paint; current LCP is {value}ms (target: ≤2500ms)',
  },
  {
    metric_id: 'fcp',
    lighthouse_audit_id: 'first-contentful-paint',
    unit: 'ms',
    thresholds: [1000, 1800, 4000, 6000],
    fix_template: 'Reduce First Contentful Paint; current FCP is {value}ms (target: ≤1800ms)',
  },
  {
    metric_id: 'cls',
    lighthouse_audit_id: 'cumulative-layout-shift',
    unit: '',
    thresholds: [0.05, 0.1, 0.25, 0.5],
    fix_template: 'Reduce Cumulative Layout Shift; current CLS is {value} (target: ≤0.1)',
  },
  {
    metric_id: 'tbt',
    lighthouse_audit_id: 'total-blocking-time',
    unit: 'ms',
    thresholds: [150, 300, 600, 2000],
    fix_template: 'Reduce Total Blocking Time; current TBT is {value}ms (target: ≤300ms)',
  },
];

export function scoreFromMetric(value: number, thresholds: [number, number, number, number]): number {
  if (value <= thresholds[0]) return 4;
  if (value <= thresholds[1]) return 3;
  if (value <= thresholds[2]) return 2;
  if (value <= thresholds[3]) return 1;
  return 0;
}
