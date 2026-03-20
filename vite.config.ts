import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // PowerSync uses WASM internally
    exclude: ['@powersync/web'],
  },
  server: {
    port: 5173,
  },
});
