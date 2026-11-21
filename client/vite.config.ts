import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({command}) => ({
  define: command === 'build' ? {'process.env.NODE_ENV': JSON.stringify('production')} : {},
  resolve: {dedupe:['react','react-dom']},
  plugins: [react()],
  build: {
    minify: 'esbuild',
    sourcemap: false,
    cssMinify: true,
  },
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
}));
