import { readFile } from 'node:fs/promises';

export interface LoopInput {
  iteration: number | null;
  previousComposite: number | null;
  attemptedFixHashes: Set<string>;
}

export async function parseLoopInput(options: {
  iteration?: number;
  previousComposite?: number;
  attemptedFixesPath?: string;
}): Promise<LoopInput> {
  const attemptedFixHashes = new Set<string>();

  if (options.attemptedFixesPath) {
    try {
      const content = await readFile(options.attemptedFixesPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        for (const hash of parsed) {
          if (typeof hash === 'string') {
            attemptedFixHashes.add(hash);
          }
        }
      }
    } catch {
      // FR edge case: malformed file → log warning, treat as empty
    }
  }

  return {
    iteration: options.iteration ?? null,
    previousComposite: options.previousComposite ?? null,
    attemptedFixHashes,
  };
}
