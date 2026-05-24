import type { Page } from 'playwright';

export async function captureDomSnapshot(page: Page): Promise<string> {
  return await page.content();
}
