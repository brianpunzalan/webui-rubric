import type { EvaluationResult, MappedDiffRegion } from '@webui-rubric/core';

/** Relative paths (within the artifact dir) to the images for one viewport. */
export interface ArtifactViewportImages {
  reference: string;
  screenshot: string;
  /** Null when the pixel diff could not be computed (e.g. dimension mismatch). */
  diff: string | null;
  /** Null when no diff was produced, so no side-by-side composite exists. */
  composite: string | null;
  regions: string[];
}

/** Pixel-diff metrics plus image paths and DOM-mapped regions for one viewport. */
export interface ArtifactViewportData {
  viewport: string;
  /**
   * True when the reference and screenshot dimensions matched and pixelmatch
   * ran. When false the metrics below are not meaningful and `note` explains why.
   */
  compared: boolean;
  note?: string;
  diff_ratio: number;
  diff_pixel_count: number;
  total_pixel_count: number;
  threshold: number;
  score: number | null;
  images: ArtifactViewportImages;
  diff_regions: MappedDiffRegion[];
}

/** LLM-facing summary bundled alongside the artifact images. */
export interface ArtifactManifest {
  run_id: string;
  url: string;
  timestamp: string;
  verdict: {
    composite_score: number;
    ship_ready: boolean;
    no_progress: boolean;
    blocking_count: number;
    dimensions: Array<{ id: string; name: string; weight: number; score: number }>;
  };
  iteration: {
    iteration: number | null;
    previous_composite: number | null;
    delta: number | null;
    attempted_fixes_count: number;
  };
  top_issues: Array<{
    rank: number;
    criterion_id: string;
    dimension_id: string;
    severity: number;
    score: number;
    fix: string[];
    fix_hash: string;
  }>;
  blocking: Array<{ criterion_id: string; wcag_ref: string; evidence: string }>;
  viewports: ArtifactViewportData[];
}

/**
 * Assemble the manifest from the already-computed evaluation result and the
 * per-viewport image data. Reuses result fields verbatim — no recomputation.
 */
export function buildManifest(
  result: EvaluationResult,
  viewports: ArtifactViewportData[],
): ArtifactManifest {
  return {
    run_id: result.run_id,
    url: result.target.url,
    timestamp: result.timestamp,
    verdict: {
      composite_score: result.composite_score,
      ship_ready: result.ship_ready,
      no_progress: result.no_progress,
      blocking_count: result.blocking.length,
      dimensions: result.dimensions.map((d) => ({
        id: d.id,
        name: d.name,
        weight: d.weight,
        score: d.score,
      })),
    },
    iteration: {
      iteration: result.meta.iteration,
      previous_composite: result.meta.previous_composite,
      delta: result.meta.delta,
      attempted_fixes_count: result.meta.attempted_fixes_count,
    },
    top_issues: result.top_issues.map((t) => ({
      rank: t.rank,
      criterion_id: t.criterion_id,
      dimension_id: t.dimension_id,
      severity: t.severity,
      score: t.score,
      fix: t.fix,
      fix_hash: t.fix_hash,
    })),
    blocking: result.blocking.map((b) => ({
      criterion_id: b.criterion_id,
      wcag_ref: b.wcag_ref,
      evidence: b.evidence,
    })),
    viewports,
  };
}
