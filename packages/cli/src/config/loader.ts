import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export async function loadConfigFile(configPath: string): Promise<unknown> {
  if (!existsSync(configPath)) {
    return {};
  }

  const content = await readFile(configPath, 'utf-8');
  const { parse } = await import('yaml');
  return parse(content) ?? {};
}

export function resolveConfigPath(specified?: string): string {
  return specified ?? '.webui-rubric.yml';
}
