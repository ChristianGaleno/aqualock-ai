import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` menghasilkan satu file dist/index.html yang bisa dibuka
// langsung di browser tanpa server (cocok untuk demo offline saat lomba).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
