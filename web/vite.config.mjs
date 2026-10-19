import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // 本地开发时把接口和上传目录代理到后端，前后端可分别热更新
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2015'
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  }
});
