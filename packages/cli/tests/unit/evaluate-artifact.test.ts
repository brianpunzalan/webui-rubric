import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';

function createSolidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
  return PNG.sync.write(png);
}

const fakeCaptureResult = {
  url: 'http://example.com',
  captured_at: new Date().toISOString(),
  content_hash: 'abc123',
  viewports_captured: ['desktop', 'mobile'],
  screenshots: new Map<string, Buffer>(),
  dom_snapshot:
    '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><h1>Test</h1></main></body></html>',
  computed_styles: {},
  element_locations: [],
  console_errors: [],
  har: { log: { entries: [] } },
};

vi.mock('@webui-rubric/capture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@webui-rubric/capture')>();
  return {
    ...actual,
    capturePage: vi.fn(async () => fakeCaptureResult),
  };
});

vi.mock('@webui-rubric/checks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@webui-rubric/checks')>();
  return {
    ...actual,
    runLighthouseChecks: vi.fn(async () => []),
  };
});

describe('evaluate --artifact-dir', () => {
  let tmpDir: string;
  let capturedOutput: string | null;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'webui-rubric-artifact-'));
    capturedOutput = null;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  async function runEvaluate(args: string[]): Promise<Record<string, unknown>> {
    const { evaluateCommand } = await import('../../src/commands/evaluate.js');

    vi.spyOn(await import('../../src/output/index.js'), 'routeJsonOutput').mockImplementation(
      async (json: string) => {
        capturedOutput = json;
      },
    );
    vi.spyOn(await import('../../src/output/index.js'), 'routeSummary').mockImplementation(
      () => {},
    );
    vi.spyOn(await import('../../src/config/index.js'), 'resolveConfigPath').mockReturnValue(
      '/dev/null',
    );
    vi.spyOn(await import('../../src/config/index.js'), 'loadConfigFile').mockResolvedValue({});

    await evaluateCommand.parseAsync(['node', 'evaluate', ...args]);
    expect(capturedOutput).not.toBeNull();
    return JSON.parse(capturedOutput!);
  }

  it('writes the artifact bundle and references it in the result', async () => {
    const screenshot = createSolidPng(64, 64, [255, 0, 0, 255]);
    const reference = createSolidPng(64, 64, [0, 0, 255, 255]);
    fakeCaptureResult.screenshots = new Map([
      ['desktop', screenshot],
      ['mobile', screenshot],
    ]);

    const refPath = join(tmpDir, 'reference.png');
    writeFileSync(refPath, reference);
    const artifactDir = join(tmpDir, 'artifact');

    const result = await runEvaluate([
      'http://example.com',
      '--reference',
      refPath,
      '--artifact-dir',
      artifactDir,
      '--iteration',
      '2',
      '--previous-composite',
      '70',
    ]);

    // Result references the artifact with relative paths.
    const artifact = result.artifact as {
      dir: string;
      manifest_path: string;
      report_path: string;
      viewports: Array<{ viewport: string; composite: string; regions: string[] }>;
    };
    expect(artifact).toBeTruthy();
    expect(artifact.manifest_path).toBe('manifest.json');
    expect(artifact.report_path).toBe('report.html');
    expect(artifact.viewports[0].viewport).toBe('desktop');

    // Files exist on disk.
    for (const rel of [
      'reference-desktop.png',
      'screenshot-desktop.png',
      'diff-desktop.png',
      'composite-desktop.png',
      'manifest.json',
      'report.html',
    ]) {
      expect(existsSync(join(artifactDir, rel)), `${rel} should exist`).toBe(true);
    }

    // Composite is a valid PNG three panels wide.
    const composite = PNG.sync.read(readFileSync(join(artifactDir, 'composite-desktop.png')));
    expect(composite.width).toBe(64 * 3 + 8 * 2);

    // Manifest carries all four data categories.
    const manifest = JSON.parse(readFileSync(join(artifactDir, 'manifest.json'), 'utf-8'));
    expect(manifest.verdict.composite_score).toBe(result.composite_score);
    expect(manifest.verdict.dimensions).toHaveLength(10);
    expect(manifest.iteration.iteration).toBe(2);
    expect(manifest.iteration.previous_composite).toBe(70);
    expect(Array.isArray(manifest.top_issues)).toBe(true);
    expect(manifest.viewports[0].diff_pixel_count).toBeGreaterThan(0);
    expect(manifest.viewports[0].images.composite).toBe('composite-desktop.png');
  });

  it('skips artifact generation when no reference image is supplied', async () => {
    fakeCaptureResult.screenshots = new Map([['desktop', createSolidPng(64, 64, [1, 2, 3, 255])]]);
    const artifactDir = join(tmpDir, 'no-ref-artifact');

    const result = await runEvaluate(['http://example.com', '--artifact-dir', artifactDir]);

    expect(result.artifact).toBeUndefined();
    expect(existsSync(join(artifactDir, 'manifest.json'))).toBe(false);
  });

  it('copies the reference image into --debug-dir', async () => {
    const screenshot = createSolidPng(64, 64, [255, 0, 0, 255]);
    const reference = createSolidPng(64, 64, [0, 0, 255, 255]);
    fakeCaptureResult.screenshots = new Map([['desktop', screenshot]]);

    const refPath = join(tmpDir, 'reference.png');
    writeFileSync(refPath, reference);
    const debugDir = join(tmpDir, 'debug');

    await runEvaluate(['http://example.com', '--reference', refPath, '--debug-dir', debugDir]);

    expect(existsSync(join(debugDir, 'reference-desktop.png'))).toBe(true);
    expect(existsSync(join(debugDir, 'screenshot-desktop.png'))).toBe(true);
  });
});
