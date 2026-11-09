import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Listen on the local network too, so phones on the shop Wi-Fi can open the site
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
