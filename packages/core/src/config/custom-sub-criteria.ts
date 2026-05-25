import type { CustomSubCriterion, Dimension, SubCriterion, BoundCheck } from '../types/index.js';

export function applyCustomSubCriteria(
  dimensions: Dimension[],
  customs: CustomSubCriterion[],
): { dimensions: Dimension[]; errors: string[] } {
  const errors: string[] = [];
  const updated = dimensions.map((d) => ({ ...d, sub_criteria: [...d.sub_criteria] }));

  for (const custom of customs) {
    const dim = updated.find((d) => d.id === custom.dimension);
    if (!dim) {
      errors.push(
        `Custom sub-criterion "${custom.id}" references unknown dimension "${custom.dimension}"`,
      );
      continue;
    }

    if (!custom.anchors || custom.anchors.length !== 5) {
      errors.push(`Custom sub-criterion "${custom.id}" must have exactly 5 anchor descriptors`);
      continue;
    }

    if (!custom.bound_check || !custom.bound_check.check_family || !custom.bound_check.check_id) {
      errors.push(
        `Custom sub-criterion "${custom.id}" must have a bound_check with check_family and check_id`,
      );
      continue;
    }

    const boundCheck: BoundCheck = {
      ...custom.bound_check,
      full_id:
        custom.bound_check.full_id ??
        `${custom.bound_check.check_family}.${custom.bound_check.check_id}`,
      threshold_map: custom.bound_check.threshold_map ?? {},
      pinned_tool_version: custom.bound_check.pinned_tool_version ?? '1.0.0',
      fix_template: custom.bound_check.fix_template ?? '',
      severity_map: custom.bound_check.severity_map ?? {},
    };

    const subCriterion: SubCriterion = {
      id: custom.id,
      name: custom.name,
      description: custom.description ?? '',
      bound_check: boundCheck,
      anchors: custom.anchors,
      blocking_if_zero: custom.blocking_if_zero ?? false,
      visual_parity: custom.visual_parity ?? false,
      references: custom.references ?? [],
    };

    dim.sub_criteria.push(subCriterion);
  }

  return { dimensions: updated, errors };
}
