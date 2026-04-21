import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' works for both Vercel (served at /) and GitHub Pages (served at /repo-name/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
