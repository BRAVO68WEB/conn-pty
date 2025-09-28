import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: false,
        headers: { 'Connection': 'keep-alive' },
      },
      '/ws/ssh': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        headers: { 'Connection': 'Upgrade', 'Upgrade': 'websocket' },
      }
    }
  },
  // Ensure Vite treats WASM files as assets
  assetsInclude: ['**/*.wasm'],
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
