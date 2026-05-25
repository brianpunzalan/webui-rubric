import type { Page } from 'playwright';

export interface SettleOptions {
  timeout?: number;
  additionalDelay?: number;
}

export async function waitForSettle(page: Page, options: SettleOptions = {}): Promise<void> {
  const additionalDelay = options.additionalDelay ?? 5000;

  try {
    await page.waitForLoadState('networkidle', { timeout: options.timeout ?? 30000 });
  } catch {
    // Timeout waiting for networkidle — proceed anyway
  }

  if (additionalDelay > 0) {
    await page.waitForTimeout(additionalDelay);
  }
}
