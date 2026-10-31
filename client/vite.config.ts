import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            const httpRes = res as ServerResponse;
            if (httpRes && !httpRes.headersSent && typeof httpRes.writeHead === 'function') {
              httpRes.writeHead(503, { 'Content-Type': 'application/json' });
              httpRes.end(JSON.stringify({ success: false, error: 'Server initializing, please retry...' }));
            }
          });
        },
      },
    },
  },
})
