import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

// Local Node runtime: no Sites account, Cloudflare account, or hosting bindings.
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  // Keep the next/link alias out of prebundling, like Vinext's link shim.
  optimizeDeps: {
    exclude: ['next/link'],
  },
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [vinext()],
});
