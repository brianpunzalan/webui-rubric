export type ThresholdOperator = 'range' | 'eq' | 'lte' | 'gte' | 'lt' | 'gt';

export interface ThresholdRange {
  min: number | null;
  max: number | null;
  operator: ThresholdOperator;
  value: number | null;
}

export type AnchorScore = 0 | 1 | 2 | 3 | 4;

export interface AnchorDescriptor {
  score: AnchorScore;
  label: string;
  description: string;
  threshold: ThresholdRange;
}

export type AnchorTuple = [
  AnchorDescriptor,
  AnchorDescriptor,
  AnchorDescriptor,
  AnchorDescriptor,
  AnchorDescriptor,
];

export type SeverityMapping = Record<string, AnchorScore>;

export interface BoundCheck {
  check_family: string;
  check_id: string;
  full_id: string;
  threshold_map: Record<number, ThresholdRange>;
  pinned_tool_version: string;
  fix_template: string;
  severity_map: SeverityMapping;
}

export interface SubCriterion {
  id: string;
  name: string;
  description: string;
  bound_check: BoundCheck;
  anchors: AnchorTuple;
  blocking_if_zero: boolean;
  visual_parity: boolean;
  references: string[];
}

export interface Dimension {
  id: string;
  name: string;
  default_weight: number;
  weight_floor: number | null;
  sub_criteria: SubCriterion[];
}

export interface RubricDefinition {
  rubric_version: string;
  dimensions: Dimension[];
  tool_versions: Record<string, string>;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface ViewportConfig {
  desktop: ViewportDimensions;
  mobile: ViewportDimensions;
  custom?: Record<string, ViewportDimensions>;
}

export interface CaptureConfig {
  dismiss_selectors?: string[];
  auto_dismiss?: boolean;
}

export interface PixelComparisonConfig {
  mask_selectors?: string[];
  mask_color?: string;
  device_pixel_ratio?: 'auto' | number;
}

export interface ProjectConfig {
  rubric_version?: string;
  weights?: Record<string, number>;
  weight_overrides_ack?: string[];
  blocking_overrides?: Record<string, boolean>;
  custom_sub_criteria?: CustomSubCriterion[];
  viewports?: ViewportConfig;
  reference_images?: Record<string, string>;
  reference_image_mismatch_policy?: 'fail-fast' | 'resize';
  pixelmatch_threshold?: number;
  tool_fallback_policy?: 'fail-fast' | 'mark-unavailable';
  iteration_cap?: number;
  ship_threshold?: number;
  top_issues_cap?: number;
  settle_timeout_ms?: number;
  redaction?: boolean;
  capture?: CaptureConfig;
  pixel_comparison?: PixelComparisonConfig;
}

export interface CustomSubCriterion {
  dimension: string;
  id: string;
  name: string;
  description: string;
  bound_check: BoundCheck;
  anchors: AnchorTuple;
  blocking_if_zero?: boolean;
  visual_parity?: boolean;
  references?: string[];
}

export interface ConsoleEntry {
  level: 'error' | 'warning';
  text: string;
  url: string | null;
  line: number | null;
}

export interface LocationReference {
  type: 'selector' | 'bounding_box' | 'coordinates';
  selector: string | null;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
  viewport: string | null;
}

export type FindingStatus = 'scored' | 'not_applicable' | 'tool_unavailable';
export type Confidence = 'deterministic' | 'predicted';

export interface SubCriterionFinding {
  id: string;
  name: string;
  score: number | null;
  status: FindingStatus;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string[];
  location: LocationReference | null;
  confidence: Confidence;
}

export interface DimensionResult {
  id: string;
  name: string;
  weight: number;
  score: number;
  sub_criteria: SubCriterionFinding[];
  applicable_count: number;
  excluded_count: number;
}

export interface BlockingEntry {
  criterion_id: string;
  reason: string;
  wcag_ref: string;
  evidence: string;
  location: LocationReference | null;
  severity: number;
}

export interface TopIssue {
  rank: number;
  criterion_id: string;
  dimension_id: string;
  priority_score: number;
  score: number;
  severity: number;
  fix: string[];
  fix_hash: string;
  expected_impact: string | null;
}

export interface PixelComparisonViewport {
  viewport: string;
  diff_pixel_count: number;
  total_pixel_count: number;
  diff_ratio: number;
  threshold: number;
  diff_png_path: string | null;
  reference_image_path: string;
  screenshot_dimensions: ViewportDimensions;
  reference_dimensions: ViewportDimensions;
}

export interface PixelComparisonResult {
  viewports: PixelComparisonViewport[];
}

export interface EffectiveConfig {
  weights: Record<string, number>;
  blocking_toggles: Record<string, boolean>;
  viewports: ViewportConfig;
  ship_threshold: number;
  iteration_cap: number;
  top_issues_cap: number;
  tool_fallback_policy: string;
  pixelmatch_threshold: number;
}

export interface ToolVersionEntry {
  pinned: string;
  resolved: string;
}

export interface EvaluationMeta {
  cli_version: string;
  rubric_version: string;
  tool_versions: Record<string, ToolVersionEntry>;
  determinism: 'pinned' | 'drifted';
  tool_version_drift: Record<string, ToolVersionEntry> | null;
  redaction: 'enabled' | 'disabled';
  effective_config: EffectiveConfig;
  iteration: number | null;
  previous_composite: number | null;
  delta: number | null;
  attempted_fixes_count: number;
  duration_ms: number;
}

export interface TargetReference {
  url: string;
  content_hash: string;
  captured_at: string;
  settle_timeout_ms: number;
}

export interface EvaluationResult {
  schema_version: string;
  rubric_version: string;
  run_id: string;
  timestamp: string;
  target: TargetReference;
  composite_score: number;
  ship_ready: boolean;
  no_progress: boolean;
  blocking: BlockingEntry[];
  dimensions: DimensionResult[];
  top_issues: TopIssue[];
  pixel_comparison: PixelComparisonResult | null;
  meta: EvaluationMeta;
}

export type ComputedStylesSnapshot = Record<string, Record<string, string>>;

export interface TargetCapture {
  url: string;
  captured_at: string;
  content_hash: string;
  viewports_captured: string[];
  screenshots: Map<string, Buffer>;
  dom_snapshot: string;
  computed_styles: ComputedStylesSnapshot;
  element_locations: Array<{
    selector: string;
    bbox: { x: number; y: number; width: number; height: number };
    tagName: string;
    computedStyles: Record<string, string>;
  }>;
  console_errors: ConsoleEntry[];
  har: unknown;
}

export interface CheckResult {
  score: number | null;
  status: FindingStatus;
  evidence: string;
  evidence_source: string;
  severity: number;
  suggested_fix: string[];
  location: LocationReference | null;
  confidence: Confidence;
}

export interface CheckAdapter {
  check_family: string;
  check_id: string;
  full_id: string;
  run(capture: TargetCapture, config?: ProjectConfig): Promise<CheckResult[]>;
}
