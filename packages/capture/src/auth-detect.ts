import type { Page, Response } from 'playwright';

export interface AuthDetectionResult {
  detected: boolean;
  reason?: string;
}

const LOGIN_INDICATORS = [
  /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i,
  /\/sso/i, /\/oauth/i, /\/cas\/login/i,
];

export async function detectAuthWall(
  page: Page,
  originalUrl: string,
  response: Response | null,
): Promise<AuthDetectionResult> {
  // Check HTTP status
  if (response) {
    const status = response.status();
    if (status === 401 || status === 403) {
      return { detected: true, reason: `Server returned HTTP ${status}` };
    }
    if (status >= 500) {
      return { detected: true, reason: `Server error: HTTP ${status}` };
    }
  }

  // Check URL redirect to login page
  const currentUrl = page.url();
  if (currentUrl !== originalUrl) {
    for (const pattern of LOGIN_INDICATORS) {
      if (pattern.test(currentUrl)) {
        return { detected: true, reason: `Redirected to login page: ${currentUrl}` };
      }
    }
  }

  // Check for login form on page
  const hasLoginForm = await page.evaluate(() => {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    return passwordInputs.length > 0;
  });

  if (hasLoginForm && currentUrl !== originalUrl) {
    return { detected: true, reason: 'Page contains password input and URL changed (likely auth wall)' };
  }

  return { detected: false };
}
