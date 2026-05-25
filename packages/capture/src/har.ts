import { readFile } from 'node:fs/promises';

export async function readHarFile(harPath: string): Promise<unknown> {
  const content = await readFile(harPath, 'utf-8');
  return JSON.parse(content);
}
