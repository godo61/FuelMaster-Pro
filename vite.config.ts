import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // CRÍTICO: Rutas relativas para que funcione en cualquier subcarpeta
  publicDir: 'public', // CORREGIDO: Apunta explícitamente a tu nueva carpeta 'public' (o bórrala, es el valor por defecto)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        // Tu lógica para limpiar nombres de archivos clave
        assetFileNames: (assetInfo) => {
          // Nota: Al estar en 'public', Vite los copiará tal cual, 
          // pero mantenemos esto por seguridad si algún plugin los procesa.
          if (assetInfo.name === 'manifest.json' || assetInfo.name === 'sw.js') {
            return '[name][ext]';
          }
          return 'assets/[name]-[hash][ext]';
        }
      }
    }
  }
});
