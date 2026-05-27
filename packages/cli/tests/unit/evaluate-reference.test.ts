import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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

describe('evaluate --reference integration', () => {
  let tmpDir: string;
  let capturedOutput: string | null;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'webui-rubric-test-'));
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
    // Re-import to get fresh command with mocks applied
    const { evaluateCommand } = await import('../../src/commands/evaluate.js');

    // Intercept JSON output
    vi.spyOn(await import('../../src/output/index.js'), 'routeJsonOutput').mockImplementation(
      async (json: string) => {
        capturedOutput = json;
      },
    );
    vi.spyOn(await import('../../src/output/index.js'), 'routeSummary').mockImplementation(
      () => {},
    );

    // Mock config loading to return defaults
    vi.spyOn(await import('../../src/config/index.js'), 'resolveConfigPath').mockReturnValue(
      '/dev/null',
    );
    vi.spyOn(await import('../../src/config/index.js'), 'loadConfigFile').mockResolvedValue({});

    await evaluateCommand.parseAsync(['node', 'evaluate', ...args]);
    expect(capturedOutput).not.toBeNull();
    return JSON.parse(capturedOutput!);
  }

  it('scores visual parity sub-criteria when --reference is supplied', async () => {
    const width = 64;
    const height = 64;
    const screenshotPng = createSolidPng(width, height, [255, 0, 0, 255]);
    const referencePng = createSolidPng(width, height, [255, 0, 0, 255]);

    fakeCaptureResult.screenshots = new Map([
      ['desktop', screenshotPng],
      ['mobile', screenshotPng],
    ]);

    const refPath = join(tmpDir, 'reference.png');
    writeFileSync(refPath, referencePng);

    const result = await runEvaluate(['http://example.com', '--reference', refPath]);

    // pixel_comparison must be populated
    expect(result.pixel_comparison).not.toBeNull();
    const pc = result.pixel_comparison as {
      viewports: Array<{ viewport: string; diff_ratio: number }>;
    };
    expect(pc.viewports).toHaveLength(1);
    expect(pc.viewports[0].viewport).toBe('desktop');

    // Visual parity sub-criteria bound to desktop should be scored, not not_applicable
    const dimensions = result.dimensions as Array<{
      id: string;
      sub_criteria: Array<{ id: string; status: string; evidence: string }>;
    }>;
    const visualParityFindings = dimensions.flatMap((d) =>
      d.sub_criteria.filter((s) => s.id.includes('visual-parity')),
    );
    expect(visualParityFindings.length).toBeGreaterThan(0);

    const desktopParityFindings = visualParityFindings.filter((f) => !f.id.includes('mobile'));
    for (const finding of desktopParityFindings) {
      expect(finding.status).toBe('scored');
      expect(finding.evidence).not.toContain('No reference image');
    }
  });

  it('marks visual parity as not_applicable when --reference is omitted', async () => {
    fakeCaptureResult.screenshots = new Map([
      ['desktop', createSolidPng(64, 64, [255, 0, 0, 255])],
      ['mobile', createSolidPng(64, 64, [255, 0, 0, 255])],
    ]);

    const result = await runEvaluate(['http://example.com']);

    expect(result.pixel_comparison).toBeNull();

    const dimensions = result.dimensions as Array<{
      id: string;
      sub_criteria: Array<{ id: string; status: string; evidence: string }>;
    }>;
    const visualParityFindings = dimensions.flatMap((d) =>
      d.sub_criteria.filter((s) => s.id.includes('visual-parity')),
    );
    for (const finding of visualParityFindings) {
      expect(finding.status).toBe('not_applicable');
      expect(finding.evidence).toContain('No reference image');
    }
  });

  it('exits with error when --reference points to nonexistent file', async () => {
    fakeCaptureResult.screenshots = new Map([
      ['desktop', createSolidPng(64, 64, [255, 0, 0, 255])],
    ]);

    await expect(
      runEvaluate(['http://example.com', '--reference', join(tmpDir, 'does-not-exist.png')]),
    ).rejects.toThrow('process.exit');
  });

  it('populates pixel diff metrics when images differ', async () => {
    const width = 64;
    const height = 64;
    const screenshotPng = createSolidPng(width, height, [255, 0, 0, 255]);
    const referencePng = createSolidPng(width, height, [0, 0, 255, 255]);

    fakeCaptureResult.screenshots = new Map([
      ['desktop', screenshotPng],
      ['mobile', screenshotPng],
    ]);

    const refPath = join(tmpDir, 'reference-diff.png');
    writeFileSync(refPath, referencePng);

    const result = await runEvaluate(['http://example.com', '--reference', refPath]);

    const pc = result.pixel_comparison as {
      viewports: Array<{ viewport: string; diff_ratio: number; diff_pixel_count: number }>;
    };
    expect(pc).not.toBeNull();
    expect(pc.viewports[0].diff_ratio).toBeGreaterThan(0);
    expect(pc.viewports[0].diff_pixel_count).toBeGreaterThan(0);

    const dimensions = result.dimensions as Array<{
      sub_criteria: Array<{ id: string; status: string; score: number | null }>;
    }>;
    const desktopParity = dimensions
      .flatMap((d) => d.sub_criteria)
      .filter((s) => s.id.includes('visual-parity') && !s.id.includes('mobile'));
    for (const finding of desktopParity) {
      expect(finding.status).toBe('scored');
      expect(finding.score).not.toBeNull();
    }
  });
});
