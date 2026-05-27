import { readFile } from 'node:fs/promises';

/** Input parameters parsed from CLI loop flags for a single evaluation iteration. */
export interface LoopInput {
  iteration: number | null;
  previousComposite: number | null;
  attemptedFixHashes: Set<string>;
}

/** Parse loop-related CLI options into a LoopInput, reading attempted-fix hashes from disk if provided. */
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
