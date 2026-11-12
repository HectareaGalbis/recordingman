import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const objetivo = mode === 'android' || mode === 'desktop' ? mode : 'web';
  return {
    base: './',
    define: { __OBJETIVO__: JSON.stringify(objetivo) },
    build: { outDir: `dist/${objetivo}`, emptyOutDir: true, target: 'es2020' },
    server: { host: true },
  };
});
