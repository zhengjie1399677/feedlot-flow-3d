import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：GitHub Pages 的项目页跑在 /feedlot-flow-3d/ 子路径下也能直接开
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2020' },
  assetsInclude: ['**/*.glb'],
});
