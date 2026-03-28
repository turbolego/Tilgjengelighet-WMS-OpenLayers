import { defineConfig } from 'vite'

export default defineConfig({
  // Set this to your repo name for GitHub Pages:
  // e.g. if your repo is github.com/username/geonorge-wms-viewer
  // base: '/geonorge-wms-viewer/'
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
