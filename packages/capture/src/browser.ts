import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

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
}

export async function launchBrowser(options: BrowserOptions = {}): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: true });
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
