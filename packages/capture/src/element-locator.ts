import type { Page } from 'playwright';

export interface ElementLocation {
  selector: string;
  bbox: { x: number; y: number; width: number; height: number };
  tagName: string;
  computedStyles: Record<string, string>;
}

const STYLE_PROPERTIES = [
  'background-color',
  'color',
  'font-size',
  'font-family',
  'font-weight',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-width',
  'border-color',
  'border-radius',
  'width',
  'height',
  'display',
  'position',
];

export async function captureElementLocations(page: Page): Promise<ElementLocation[]> {
  return await page.evaluate((properties: string[]) => {
    function buildSelector(el: Element): string {
      if (el.id) return `#${el.id}`;

      const testId = el.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;

      const tag = el.tagName.toLowerCase();
      const classes =
        el.className && typeof el.className === 'string'
          ? el.className.trim().split(/\s+/).filter(Boolean)
          : [];

      if (classes.length > 0) {
        const classSelector = `${tag}.${classes.join('.')}`;
        if (document.querySelectorAll(classSelector).length === 1) {
          return classSelector;
        }
      }

      // Build a path-based selector
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body && parts.length < 4) {
        const t = current.tagName.toLowerCase();
        if (current.id) {
          parts.unshift(`#${current.id}`);
          break;
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c) => c.tagName === current!.tagName,
          );
          if (siblings.length > 1) {
            const idx = siblings.indexOf(current) + 1;
            parts.unshift(`${t}:nth-of-type(${idx})`);
          } else {
            parts.unshift(t);
          }
        } else {
          parts.unshift(t);
        }
        current = parent;
      }
      return parts.join(' > ');
    }

    const results: Array<{
      selector: string;
      bbox: { x: number; y: number; width: number; height: number };
      tagName: string;
      computedStyles: Record<string, string>;
    }> = [];

    const elements = document.querySelectorAll('body *');
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 10 || rect.height <= 10) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      const computed = window.getComputedStyle(el);
      if (computed.display === 'none' || computed.visibility === 'hidden') return;

      const styles: Record<string, string> = {};
      for (const prop of properties) {
        styles[prop] = computed.getPropertyValue(prop);
      }

      results.push({
        selector: buildSelector(el),
        bbox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        tagName: el.tagName.toLowerCase(),
        computedStyles: styles,
      });
    });

    return results;
  }, STYLE_PROPERTIES);
}
