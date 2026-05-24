import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'commander',
        'yaml',
        '@webui-rubric/core',
        '@webui-rubric/capture',
        '@webui-rubric/checks',
        'node:crypto',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:os',
        'node:url',
      ],
    },
  },
});
