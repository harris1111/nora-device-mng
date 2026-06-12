import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:13000';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __COMMIT_HASH__: JSON.stringify(
        (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })()
      ),
    },
    server: {
      proxy: {
        '/api': apiProxyTarget,
      },
    },
  };
});
