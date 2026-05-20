import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.SYNCFLOW_MARKET': JSON.stringify(process.env.SYNCFLOW_MARKET || 'cn'),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.SYNCFLOW_MARKET': JSON.stringify(process.env.SYNCFLOW_MARKET || 'cn'),
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(projectRoot, 'src/renderer'),
      },
    },
    define: {
      'process.env.SYNCFLOW_MARKET': JSON.stringify(process.env.SYNCFLOW_MARKET || 'cn'),
    },
    optimizeDeps: {
      include: ['@syncflow/contracts', '@syncflow/design-tokens'],
    },
    plugins: [react()],
  },
});
