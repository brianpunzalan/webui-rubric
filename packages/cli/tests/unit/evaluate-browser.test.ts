import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const runLighthouseMock = vi.fn(async () => [] as unknown[]);
vi.mock('@webui-rubric/checks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@webui-rubric/checks')>();
  return {
    ...actual,
    runLighthouseChecks: (...args: unknown[]) => runLighthouseMock(...(args as [])),
  };
});

describe('evaluate browser-engine forwarding', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let configOverride: Record<string, unknown>;

  beforeEach(() => {
    configOverride = {};
    runLighthouseMock.mockReset();
    runLighthouseMock.mockResolvedValue([]);
    fakeCaptureResult.screenshots = new Map([
      ['desktop', createSolidPng(64, 64, [255, 0, 0, 255])],
      ['mobile', createSolidPng(64, 64, [255, 0, 0, 255])],
    ]);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  async function runEvaluate(args: string[]) {
    const { evaluateCommand } = await import('../../src/commands/evaluate.js');

    vi.spyOn(await import('../../src/output/index.js'), 'routeJsonOutput').mockResolvedValue(
      undefined,
    );
    vi.spyOn(await import('../../src/output/index.js'), 'routeSummary').mockImplementation(
      () => {},
    );

    vi.spyOn(await import('../../src/config/index.js'), 'resolveConfigPath').mockReturnValue(
      '/dev/null',
    );
    vi.spyOn(await import('../../src/config/index.js'), 'loadConfigFile').mockResolvedValue(
      configOverride,
    );

    const capture = await import('@webui-rubric/capture');
    const spy = vi.mocked(capture.capturePage);
    spy.mockClear();

    await evaluateCommand.parseAsync(['node', 'evaluate', ...args]);

    return { capturePageSpy: spy };
  }

  it('defaults to chromium when no flag or config is set', async () => {
    const { capturePageSpy } = await runEvaluate(['http://example.com']);

    expect(capturePageSpy).toHaveBeenCalledOnce();
    expect(capturePageSpy.mock.calls[0][1].browser).toBe('chromium');
  });

  it('forwards the --browser flag to capturePage', async () => {
    const { capturePageSpy } = await runEvaluate(['http://example.com', '--browser', 'firefox']);

    expect(capturePageSpy.mock.calls[0][1].browser).toBe('firefox');
  });

  it('reads capture.browser from config when no flag is given', async () => {
    configOverride = { capture: { browser: 'webkit' } };

    const { capturePageSpy } = await runEvaluate(['http://example.com']);

    expect(capturePageSpy.mock.calls[0][1].browser).toBe('webkit');
  });

  it('lets the --browser flag override config', async () => {
    configOverride = { capture: { browser: 'webkit' } };

    const { capturePageSpy } = await runEvaluate(['http://example.com', '--browser', 'firefox']);

    expect(capturePageSpy.mock.calls[0][1].browser).toBe('firefox');
  });

  it('rejects an unknown engine before capturing', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(runEvaluate(['http://example.com', '--browser', 'safari'])).rejects.toThrow(
      /process\.exit/,
    );

    const logged = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toMatch(/Unknown browser engine "safari"/);
  });

  it('warns when Lighthouse degrades to tool_unavailable', async () => {
    runLighthouseMock.mockResolvedValue([
      {
        evidence_source: 'lighthouse.lcp',
        score: null,
        status: 'tool_unavailable',
        evidence: 'Lighthouse analysis failed',
        severity: 0,
        suggested_fix: [],
      },
    ]);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await runEvaluate(['http://example.com']);

    const warned = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(warned).toMatch(/Lighthouse unavailable/);
    expect(warned).toMatch(/resource-efficiency/);
  });
});
