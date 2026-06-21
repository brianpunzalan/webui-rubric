import { describe, it, expect, vi, beforeEach } from 'vitest';

// Each engine exposes a `launch` that returns a minimal fake Browser whose
// context/page methods are no-ops, so launchBrowser can run without a real
// browser binary. Built via vi.hoisted so the mock factory (also hoisted) can
// reference them.
const { chromium, firefox, webkit } = vi.hoisted(() => {
  const makeEngine = () => ({
    launch: vi.fn(async () => ({
      newContext: vi.fn(async () => ({
        newPage: vi.fn(async () => ({})),
        close: vi.fn(async () => {}),
      })),
      close: vi.fn(async () => {}),
    })),
    executablePath: vi.fn(() => '/path/to/chromium'),
  });
  return { chromium: makeEngine(), firefox: makeEngine(), webkit: makeEngine() };
});

vi.mock('playwright', () => ({ chromium, firefox, webkit }));

import { launchBrowser, chromiumExecutablePath } from '../../src/browser.js';

describe('launchBrowser engine selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromium.executablePath.mockReturnValue('/path/to/chromium');
  });

  it('defaults to chromium when no engine is given', async () => {
    await launchBrowser();
    expect(chromium.launch).toHaveBeenCalledOnce();
    expect(firefox.launch).not.toHaveBeenCalled();
    expect(webkit.launch).not.toHaveBeenCalled();
  });

  it('launches firefox when requested', async () => {
    await launchBrowser({ browser: 'firefox' });
    expect(firefox.launch).toHaveBeenCalledOnce();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it('launches webkit when requested', async () => {
    await launchBrowser({ browser: 'webkit' });
    expect(webkit.launch).toHaveBeenCalledOnce();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it('launches headless', async () => {
    await launchBrowser({ browser: 'chromium' });
    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
  });
});

describe('chromiumExecutablePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Playwright Chromium path', () => {
    chromium.executablePath.mockReturnValue('/path/to/chromium');
    expect(chromiumExecutablePath()).toBe('/path/to/chromium');
  });

  it('returns undefined when the path cannot be resolved', () => {
    chromium.executablePath.mockImplementationOnce(() => {
      throw new Error('not installed');
    });
    expect(chromiumExecutablePath()).toBeUndefined();
  });
});
