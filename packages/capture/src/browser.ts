import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';

/** Playwright browser engine to drive capture with. */
export type BrowserEngine = 'chromium' | 'firefox' | 'webkit';

const BROWSER_ENGINES = { chromium, firefox, webkit } as const;

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export interface BrowserOptions {
  harPath?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  deviceScaleFactor?: number;
  /** Playwright engine to launch. Defaults to 'chromium'. */
  browser?: BrowserEngine;
}

export async function launchBrowser(options: BrowserOptions = {}): Promise<BrowserSession> {
  const engine = BROWSER_ENGINES[options.browser ?? 'chromium'];
  const browser = await engine.launch({ headless: true });
  const contextOptions: Record<string, unknown> = {
    viewport: {
      width: options.viewportWidth ?? 1280,
      height: options.viewportHeight ?? 800,
    },
    deviceScaleFactor: options.deviceScaleFactor ?? 1,
  };
  if (options.harPath) {
    contextOptions.recordHar = { path: options.harPath, omitContent: true };
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  return { browser, context, page };
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

/**
 * Path to Playwright's bundled Chromium executable, or undefined if it cannot
 * be resolved (e.g. the browser binary was never installed). Used to let
 * Chromium-only tools such as Lighthouse reuse Playwright's Chromium regardless
 * of which engine capture runs on.
 */
export function chromiumExecutablePath(): string | undefined {
  try {
    return chromium.executablePath();
  } catch {
    return undefined;
  }
}
