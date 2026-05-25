import type { Page } from 'playwright';

export type ComputedStylesSnapshot = Record<string, Record<string, string>>;

export async function captureComputedStyles(page: Page): Promise<ComputedStylesSnapshot> {
  return await page.evaluate(() => {
    const result: Record<string, Record<string, string>> = {};
    const elements = document.querySelectorAll('body *');
    const properties = [
      'color',
      'background-color',
      'font-family',
      'font-size',
      'font-weight',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'display',
      'position',
      'width',
      'height',
      'border-color',
      'border-width',
      'border-style',
      'line-height',
      'text-align',
      'text-decoration',
    ];

    let index = 0;
    elements.forEach((el) => {
      // Generate a selector-like key
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes =
        el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).join('.')
          : '';
      const key = `${tag}${id}${classes}[${index}]`;

      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const prop of properties) {
        styles[prop] = computed.getPropertyValue(prop);
      }
      result[key] = styles;
      index++;
    });

    return result;
  });
}
