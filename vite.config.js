import { defineConfig } from 'vite';
export default defineConfig({
  build: { chunkSizeWarningLimit: 2200 },
  define: { 'process.env.IS_PREACT': 'false' },
  plugins: [
    {
      name: 'local-only-excalidraw-fonts',
      enforce: 'pre',
      transform(code, id) {
        if (
          !id.includes('@excalidraw/excalidraw/dist/prod/') ||
          !code.includes('ASSETS_FALLBACK_URL')
        )
          return;
        // 0.18.1 always appends an esm.sh URL, even with local assets configured.
        // Remove that fallback at build time; never alter node_modules on disk.
        const pattern = /return (\w+)\.push\(new URL\((\w+),(\w+)\.ASSETS_FALLBACK_URL\)\),\1/;
        if (!pattern.test(code))
          throw Error('Excalidraw font loader changed: review the offline build adapter.');
        return { code: code.replace(pattern, 'return $1'), map: null };
      },
    },
  ],
});
