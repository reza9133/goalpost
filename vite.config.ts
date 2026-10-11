import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Some browser builds of Ethereum tooling still reference the Node global.
  define: { global: 'globalThis' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173 },
});
