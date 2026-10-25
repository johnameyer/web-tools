/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Overridden in the deploy workflow for GitHub Pages
  base: process.env.VITE_BASE ?? '/',
  plugins: [ react() ],
  test: {
    environment: 'jsdom',
  },
});
