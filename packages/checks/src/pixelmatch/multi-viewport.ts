import { runPixelmatch, type PixelComparisonOutput } from './index.js';

export interface ViewportComparisonInput {
  viewport: string;
  screenshotBuffer: Buffer;
  referenceBuffer: Buffer;
  referenceImagePath: string;
  threshold?: number;
  diffOutputPath?: string | null;
}

export function runMultiViewportComparison(
  inputs: ViewportComparisonInput[],
): Array<PixelComparisonOutput & { viewport: string; reference_image_path: string }> {
  return inputs.map(input => {
    const result = runPixelmatch({
      screenshotBuffer: input.screenshotBuffer,
      referenceBuffer: input.referenceBuffer,
      threshold: input.threshold,
      diffOutputPath: input.diffOutputPath,
    });

    return {
      ...result,
      viewport: input.viewport,
      reference_image_path: input.referenceImagePath,
    };
  });
}
