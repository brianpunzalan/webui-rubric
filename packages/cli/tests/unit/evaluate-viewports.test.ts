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

vi.mock('@webui-rubric/checks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@webui-rubric/checks')>();
  return {
    ...actual,
    runLighthouseChecks: vi.fn(async () => []),
  };
});

describe('evaluate viewport forwarding', () => {
  let capturedOutput: string | null;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let configOverride: Record<string, unknown>;

  beforeEach(() => {
    capturedOutput = null;
    configOverride = {};
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
    vi.spyOn(await import('../../src/config/index.js'), 'loadConfigFile').mockResolvedValue(
      configOverride,
    );

    const capture = await import('@webui-rubric/capture');
    const spy = vi.mocked(capture.capturePage);
    spy.mockClear();

    await evaluateCommand.parseAsync(['node', 'evaluate', ...args]);
    expect(capturedOutput).not.toBeNull();

    return { result: JSON.parse(capturedOutput!), capturePageSpy: spy };
  }

  it('uses default viewport dimensions when no config viewports are set', async () => {
    configOverride = {};

    const { capturePageSpy } = await runEvaluate(['http://example.com']);

    expect(capturePageSpy).toHaveBeenCalledOnce();
    const opts = capturePageSpy.mock.calls[0][1];
    expect(opts.viewports).toEqual([
      { name: 'desktop', width: 1280, height: 800, fullPage: false },
      { name: 'mobile', width: 375, height: 812, fullPage: false },
    ]);
  });

  it('forwards config viewport dimensions to capturePage', async () => {
    configOverride = {
      viewports: {
        desktop: { width: 2546, height: 1724 },
      },
    };

    const { capturePageSpy } = await runEvaluate(['http://example.com']);

    expect(capturePageSpy).toHaveBeenCalledOnce();
    const opts = capturePageSpy.mock.calls[0][1];
    const desktopVp = opts.viewports.find((v: { name: string }) => v.name === 'desktop');
    expect(desktopVp).toEqual({ name: 'desktop', width: 2546, height: 1724, fullPage: false });
  });

  it('fills in default mobile dimensions when config only sets desktop', async () => {
    configOverride = {
      viewports: {
        desktop: { width: 1920, height: 1080 },
      },
    };

    const { capturePageSpy } = await runEvaluate(['http://example.com']);

    const opts = capturePageSpy.mock.calls[0][1];
    const mobileVp = opts.viewports.find((v: { name: string }) => v.name === 'mobile');
    expect(mobileVp).toEqual({ name: 'mobile', width: 375, height: 812, fullPage: false });
  });

  it('respects --viewports CLI flag to filter captured viewports', async () => {
    configOverride = {
      viewports: {
        desktop: { width: 2546, height: 1724 },
        mobile: { width: 390, height: 844 },
      },
    };

    const { capturePageSpy } = await runEvaluate(['http://example.com', '--viewports', 'desktop']);

    const opts = capturePageSpy.mock.calls[0][1];
    expect(opts.viewports).toHaveLength(1);
    expect(opts.viewports[0]).toEqual({
      name: 'desktop',
      width: 2546,
      height: 1724,
      fullPage: false,
    });
  });

  it('resolves custom viewport names from config', async () => {
    configOverride = {
      viewports: {
        custom: {
          tablet: { width: 768, height: 1024 },
        },
      },
    };

    const { capturePageSpy } = await runEvaluate(['http://example.com', '--viewports', 'tablet']);

    const opts = capturePageSpy.mock.calls[0][1];
    expect(opts.viewports).toHaveLength(1);
    expect(opts.viewports[0]).toEqual({
      name: 'tablet',
      width: 768,
      height: 1024,
      fullPage: false,
    });
  });
});
