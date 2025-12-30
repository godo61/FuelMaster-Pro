import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        // Aseguramos que los archivos de la raíz se copien o mantengan nombres limpios
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'manifest.json' || assetInfo.name === 'sw.js') {
            return '[name][ext]';
          }
          return 'assets/[name]-[hash][ext]';
        }
      }
    }
  },
  publicDir: './' // Esto hará que Vite copie sw.js y manifest.json a dist automáticamente
});