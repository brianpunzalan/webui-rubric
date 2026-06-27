import { z } from 'zod';

const LocationReferenceSchema = z
  .object({
    type: z.enum(['selector', 'bounding_box', 'coordinates']),
    selector: z.string().nullable().optional(),
    bounding_box: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .nullable()
      .optional(),
    viewport: z.string().nullable().optional(),
  })
  .nullable();

const SubCriterionFindingSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().int().min(0).max(4).nullable(),
  status: z.enum(['scored', 'not_applicable', 'tool_unavailable']),
  evidence: z.string().max(300),
  evidence_source: z.string(),
  severity: z.number().int().min(0).max(4),
  suggested_fix: z.array(z.string()),
  location: LocationReferenceSchema.optional(),
  confidence: z.enum(['deterministic', 'predicted']),
});

const DimensionResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  weight: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  sub_criteria: z.array(SubCriterionFindingSchema).min(1),
  applicable_count: z.number().int().min(0),
  excluded_count: z.number().int().min(0),
});

const BlockingEntrySchema = z.object({
  criterion_id: z.string(),
  reason: z.string(),
  wcag_ref: z.string(),
  evidence: z.string().max(300),
  location: LocationReferenceSchema.optional(),
  severity: z.number().int().min(0).max(4),
});

const TopIssueSchema = z.object({
  rank: z.number().int().min(1),
  criterion_id: z.string(),
  dimension_id: z.string(),
  priority_score: z.number().min(0),
  score: z.number().int().min(0).max(4),
  severity: z.number().int().min(0).max(4),
  fix: z.array(z.string()),
  fix_hash: z.string(),
  expected_impact: z.string().nullable(),
});

const ViewportDimsSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

const StyleDiffSchema = z.object({
  property: z.string(),
  actual: z.string(),
  expected: z.string(),
});

const MappedDiffElementSchema = z.object({
  selector: z.string(),
  tagName: z.string(),
  styleDiffs: z.array(StyleDiffSchema),
});

const MappedDiffRegionSchema = z.object({
  y_start: z.number().int().min(0),
  y_end: z.number().int().min(0),
  diff_pixel_count: z.number().int().min(0),
  pct_of_total_diff: z.number().min(0).max(1),
  elements: z.array(MappedDiffElementSchema),
});

const PixelComparisonViewportSchema = z.object({
  viewport: z.string(),
  diff_pixel_count: z.number().int().min(0),
  total_pixel_count: z.number().int().min(1),
  diff_ratio: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  diff_png_path: z.string().nullable(),
  reference_image_path: z.string(),
  screenshot_dimensions: ViewportDimsSchema,
  reference_dimensions: ViewportDimsSchema,
  diff_regions: z.array(MappedDiffRegionSchema).optional(),
});

const PixelComparisonResultSchema = z
  .object({
    viewports: z.array(PixelComparisonViewportSchema).min(1),
  })
  .nullable();

const ArtifactViewportImagesSchema = z.object({
  viewport: z.string(),
  reference: z.string(),
  screenshot: z.string(),
  diff: z.string().nullable(),
  composite: z.string().nullable(),
  regions: z.array(z.string()),
});

const ArtifactReferenceSchema = z.object({
  dir: z.string(),
  manifest_path: z.string(),
  report_path: z.string(),
  viewports: z.array(ArtifactViewportImagesSchema),
});

const EffectiveConfigSchema = z.object({
  weights: z.record(z.string(), z.number()),
  blocking_toggles: z.record(z.string(), z.boolean()),
  viewports: z.object({}).passthrough(),
  ship_threshold: z.number(),
  iteration_cap: z.number().int(),
  top_issues_cap: z.number().int(),
  tool_fallback_policy: z.string(),
  pixelmatch_threshold: z.number(),
});

const ToolVersionEntrySchema = z.object({
  pinned: z.string(),
  resolved: z.string(),
});

const EvaluationMetaSchema = z.object({
  cli_version: z.string(),
  rubric_version: z.string(),
  tool_versions: z.record(z.string(), ToolVersionEntrySchema),
  determinism: z.enum(['pinned', 'drifted']),
  tool_version_drift: z.record(z.string(), ToolVersionEntrySchema).nullable(),
  redaction: z.enum(['enabled', 'disabled']),
  effective_config: EffectiveConfigSchema,
  iteration: z.number().int().nullable(),
  previous_composite: z.number().nullable(),
  delta: z.number().nullable(),
  attempted_fixes_count: z.number().int().min(0),
  duration_ms: z.number().min(0),
});

const TargetReferenceSchema = z.object({
  url: z.string(),
  content_hash: z.string(),
  captured_at: z.string(),
  settle_timeout_ms: z.number().min(0),
});

export const EvaluationResultSchema = z.object({
  schema_version: z.string(),
  rubric_version: z.string(),
  run_id: z.string(),
  timestamp: z.string(),
  target: TargetReferenceSchema,
  composite_score: z.number().min(0).max(100),
  ship_ready: z.boolean(),
  no_progress: z.boolean(),
  blocking: z.array(BlockingEntrySchema),
  dimensions: z.array(DimensionResultSchema).length(10),
  top_issues: z.array(TopIssueSchema),
  pixel_comparison: PixelComparisonResultSchema,
  artifact: ArtifactReferenceSchema.optional(),
  meta: EvaluationMetaSchema,
});

export type ValidatedEvaluationResult = z.infer<typeof EvaluationResultSchema>;
