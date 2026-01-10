import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // Fix CSP for development
  define: {
    'process.env': {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - loaded on every page
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // Charts - only used in specific pages
          'charts': ['recharts'],

          // Icons - used everywhere
          'icons': ['@phosphor-icons/react'],

          // React window - only used in MatchList
          'react-window': ['react-window'],
        },
      },
    },
    // Increase chunk size warning limit to 600kb
    chunkSizeWarningLimit: 600,
  },
})
