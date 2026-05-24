import { z } from 'zod';

export const ViewportDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const ViewportConfigSchema = z.object({
  desktop: ViewportDimensionsSchema.default({ width: 1280, height: 800 }),
  mobile: ViewportDimensionsSchema.default({ width: 375, height: 812 }),
  custom: z.record(z.string(), ViewportDimensionsSchema).optional(),
});

export const CaptureConfigSchema = z.object({
  dismiss_selectors: z.array(z.string()).optional(),
  auto_dismiss: z.boolean().optional(),
});

export const PixelComparisonConfigSchema = z.object({
  mask_selectors: z.array(z.string()).optional(),
  mask_color: z.string().optional(),
  device_pixel_ratio: z.union([z.literal('auto'), z.number().positive()]).optional(),
});

export const ThresholdRangeSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  operator: z.enum(['range', 'eq', 'lte', 'gte', 'lt', 'gt']),
  value: z.number().nullable(),
});

export const AnchorDescriptorSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  label: z.string(),
  description: z.string(),
  threshold: ThresholdRangeSchema,
});

export const BoundCheckSchema = z.object({
  check_family: z.string(),
  check_id: z.string(),
  full_id: z.string().optional(),
  threshold_map: z.record(z.string(), ThresholdRangeSchema).optional(),
  pinned_tool_version: z.string().optional(),
  fix_template: z.string().max(280).optional(),
  severity_map: z
    .record(
      z.string(),
      z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    )
    .optional(),
});

export const CustomSubCriterionSchema = z.object({
  dimension: z.string(),
  id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  bound_check: BoundCheckSchema,
  anchors: z.tuple([
    AnchorDescriptorSchema,
    AnchorDescriptorSchema,
    AnchorDescriptorSchema,
    AnchorDescriptorSchema,
    AnchorDescriptorSchema,
  ]),
  blocking_if_zero: z.boolean().optional(),
  visual_parity: z.boolean().optional(),
  references: z.array(z.string()).optional(),
});

export const ProjectConfigSchema = z.object({
  rubric_version: z.string().optional(),
  weights: z.record(z.string(), z.number()).optional(),
  weight_overrides_ack: z.array(z.string()).optional(),
  blocking_overrides: z.record(z.string(), z.boolean()).optional(),
  custom_sub_criteria: z.array(CustomSubCriterionSchema).optional(),
  viewports: ViewportConfigSchema.optional(),
  reference_images: z.record(z.string(), z.string()).optional(),
  reference_image_mismatch_policy: z.enum(['fail-fast', 'resize']).optional(),
  pixelmatch_threshold: z.number().min(0).max(1).optional(),
  tool_fallback_policy: z.enum(['fail-fast', 'mark-unavailable']).optional(),
  iteration_cap: z.number().int().positive().optional(),
  ship_threshold: z.number().min(0).max(100).optional(),
  top_issues_cap: z.number().int().positive().optional(),
  settle_timeout_ms: z.number().int().nonnegative().optional(),
  redaction: z.boolean().optional(),
  capture: CaptureConfigSchema.optional(),
  pixel_comparison: PixelComparisonConfigSchema.optional(),
});

export type ValidatedProjectConfig = z.infer<typeof ProjectConfigSchema>;
