import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ['argon2', 'argon2-browser']
  },
  ssr: {
    noExternal: ['@noble/hashes', '@noble/post-quantum', 'secrets.js-34r7h']
  },
  define: {
    global: 'globalThis'
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
});
