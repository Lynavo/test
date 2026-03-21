import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(projectRoot, 'src/renderer'),
      },
    },
    optimizeDeps: {
      include: ['@syncflow/contracts', '@syncflow/design-tokens'],
    },
    plugins: [react()],
  },
});
