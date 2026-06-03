import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

const envDefine = {
  'process.env.SYNCFLOW_MARKET': JSON.stringify(process.env.SYNCFLOW_MARKET || 'cn'),
  'process.env.VIVIDROP_API_BASE_URL': JSON.stringify(process.env.VIVIDROP_API_BASE_URL || ''),
  'process.env.SYNCFLOW_API_BASE_URL': JSON.stringify(process.env.SYNCFLOW_API_BASE_URL || ''),
  'process.env.SYNCFLOW_GIFTCARD_REDEEM_BASE_URL': JSON.stringify(
    process.env.SYNCFLOW_GIFTCARD_REDEEM_BASE_URL || '',
  ),
  'process.env.SYNCFLOW_AUTH_BASE_URL': JSON.stringify(
    process.env.SYNCFLOW_AUTH_BASE_URL || '',
  ),
  'process.env.SYNCFLOW_CLIENT_CONFIG_BASE_URL': JSON.stringify(
    process.env.SYNCFLOW_CLIENT_CONFIG_BASE_URL || '',
  ),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: envDefine,
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: envDefine,
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(projectRoot, 'src/renderer'),
      },
    },
    define: envDefine,
    optimizeDeps: {
      include: ['@syncflow/contracts', '@syncflow/design-tokens'],
    },
    plugins: [react()],
  },
});
