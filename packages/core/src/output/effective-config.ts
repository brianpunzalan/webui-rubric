import type { EffectiveConfig, ViewportConfig } from '../types/index.js';

/** Assemble the effective config snapshot embedded in the output artifact meta block. */
export function buildEffectiveConfig(params: {
  weights: Record<string, number>;
  blockingToggles: Record<string, boolean>;
  viewports: ViewportConfig;
  shipThreshold: number;
  iterationCap: number;
  topIssuesCap: number;
  toolFallbackPolicy: string;
  pixelmatchThreshold: number;
}): EffectiveConfig {
  return {
    weights: params.weights,
    blocking_toggles: params.blockingToggles,
    viewports: params.viewports,
    ship_threshold: params.shipThreshold,
    iteration_cap: params.iterationCap,
    top_issues_cap: params.topIssuesCap,
    tool_fallback_policy: params.toolFallbackPolicy,
    pixelmatch_threshold: params.pixelmatchThreshold,
  };
}
