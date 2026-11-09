import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The browser always calls the API through the same-origin `/_api` prefix.
// In development Vite proxies it; in production nginx does (see nginx/).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_UPSTREAM || 'http://localhost:8001';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/_api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/_api/, ''),
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
  };
});
