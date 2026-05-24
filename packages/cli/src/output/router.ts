import { writeFile } from 'node:fs/promises';

export interface OutputOptions {
  outFile?: string;
}

export async function routeJsonOutput(json: string, options: OutputOptions): Promise<void> {
  if (options.outFile) {
    await writeFile(options.outFile, json, 'utf-8');
  } else {
    process.stdout.write(json + '\n');
  }
}

export function routeSummary(summary: string, options: OutputOptions): void {
  if (options.outFile) {
    // When --out is used, summary goes to stdout
    process.stdout.write(summary + '\n');
  } else {
    // Default: summary goes to stderr
    process.stderr.write(summary + '\n');
  }
}
