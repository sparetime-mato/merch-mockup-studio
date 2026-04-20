import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: if you deploy to https://<user>.github.io/<repo-name>/
// change `base` below to '/<repo-name>/'. If you deploy to a custom
// domain (e.g. mockups.example.com), leave base as '/'.
export default defineConfig({
  plugins: [react()],
  base: './',
});
