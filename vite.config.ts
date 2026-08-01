import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const fastApiTarget = env.FASTAPI_PROXY_TARGET || 'http://192.168.176.130:8000';

  return {
    plugins: [react()],
    base: '/noc-network-incident-copilot/',
    server: {
      proxy: {
        '/fastapi': {
          target: fastApiTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/fastapi/, ''),
        },
      },
    },
  };
});
