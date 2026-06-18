import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSideBySide, cropStrip } from '@webui-rubric/checks';
import type { ArtifactReference, EvaluationResult, MappedDiffRegion } from '@webui-rubric/core';
import { buildManifest, type ArtifactManifest, type ArtifactViewportData } from './manifest.js';
import { buildReportHtml } from './report.js';

/** Raw image buffers and metrics for one compared viewport. */
export interface ArtifactViewportInput {
  viewport: string;
  referenceBuffer: Buffer;
  screenshotBuffer: Buffer;
  diffBuffer: Buffer;
  diff_ratio: number;
  diff_pixel_count: number;
  total_pixel_count: number;
  threshold: number;
  score: number | null;
  diff_regions: MappedDiffRegion[];
}

export interface WriteArtifactOptions {
  dir: string;
  result: EvaluationResult;
  viewports: ArtifactViewportInput[];
}

const MANIFEST_FILE = 'manifest.json';
const REPORT_FILE = 'report.html';

/**
 * Write a self-contained evaluation-results artifact: the three source images
 * (reference, screenshot, diff), a side-by-side composite, per-region crops, a
 * manifest.json summary, and an HTML report. Returns an {@link ArtifactReference}
 * with paths relative to `dir` for embedding in the evaluation result.
 */
export async function writeArtifact(options: WriteArtifactOptions): Promise<ArtifactReference> {
  const dir = resolve(options.dir);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (options.viewports.some((vp) => vp.diff_regions.length > 0)) {
    await mkdir(resolve(dir, 'regions'), { recursive: true, mode: 0o700 });
  }

  const manifestViewports: ArtifactViewportData[] = [];
  const referenceViewports: ArtifactReference['viewports'] = [];

  for (const vp of options.viewports) {
    const referenceRel = `reference-${vp.viewport}.png`;
    const screenshotRel = `screenshot-${vp.viewport}.png`;
    const diffRel = `diff-${vp.viewport}.png`;
    const compositeRel = `composite-${vp.viewport}.png`;

    const composite = buildSideBySide(vp.referenceBuffer, vp.screenshotBuffer, vp.diffBuffer);

    await Promise.all([
      writeFile(resolve(dir, referenceRel), vp.referenceBuffer),
      writeFile(resolve(dir, screenshotRel), vp.screenshotBuffer),
      writeFile(resolve(dir, diffRel), vp.diffBuffer),
      writeFile(resolve(dir, compositeRel), composite),
    ]);

    const regionRels: string[] = [];
    for (let i = 0; i < vp.diff_regions.length; i++) {
      const region = vp.diff_regions[i];
      const crop = cropStrip(vp.screenshotBuffer, region.y_start, region.y_end);
      const rel = `regions/region-${vp.viewport}-${i + 1}.png`;
      await writeFile(resolve(dir, rel), crop);
      regionRels.push(rel);
    }

    const images = {
      reference: referenceRel,
      screenshot: screenshotRel,
      diff: diffRel,
      composite: compositeRel,
      regions: regionRels,
    };

    manifestViewports.push({
      viewport: vp.viewport,
      diff_ratio: vp.diff_ratio,
      diff_pixel_count: vp.diff_pixel_count,
      total_pixel_count: vp.total_pixel_count,
      threshold: vp.threshold,
      score: vp.score,
      images,
      diff_regions: vp.diff_regions,
    });
    referenceViewports.push({ viewport: vp.viewport, ...images });
  }

  const manifest: ArtifactManifest = buildManifest(options.result, manifestViewports);
  await writeFile(resolve(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
  await writeFile(resolve(dir, REPORT_FILE), buildReportHtml(manifest));

  return {
    dir,
    manifest_path: MANIFEST_FILE,
    report_path: REPORT_FILE,
    viewports: referenceViewports,
  };
}

export { buildManifest, buildReportHtml };
export type { ArtifactManifest, ArtifactViewportData } from './manifest.js';
