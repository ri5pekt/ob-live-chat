import { defineConfig } from 'vite'
import path from 'path'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [cssInjectedByJs()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/widget.js'),
      name: 'LiveChatWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 32768,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
