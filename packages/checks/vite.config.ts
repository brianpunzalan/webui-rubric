import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'lighthouse',
        'chrome-launcher',
        'pixelmatch',
        'pngjs',
        '@webui-rubric/core',
        '@webui-rubric/capture',
        'node:crypto',
        'node:fs',
        'node:fs/promises',
        'node:path',
      ],
    },
  },
});
