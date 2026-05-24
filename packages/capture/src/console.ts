import type { Page, ConsoleMessage } from 'playwright';

export interface CapturedConsoleEntry {
  level: 'error' | 'warning';
  text: string;
  url: string | null;
  line: number | null;
}

export function setupConsoleCapture(page: Page): CapturedConsoleEntry[] {
  const entries: CapturedConsoleEntry[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const location = msg.location();
      entries.push({
        level: type === 'error' ? 'error' : 'warning',
        text: msg.text(),
        url: location.url || null,
        line: location.lineNumber ?? null,
      });
    }
  });

  return entries;
}
