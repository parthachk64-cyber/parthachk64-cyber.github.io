import { defineConfig } from 'astro/config';

// User site: https://parthachk64-cyber.github.io/  (base "/").
// For a project repository set SITE_BASE="/research-portfolio/" at build time.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://parthachk64-cyber.github.io',
  base: process.env.SITE_BASE ?? '/',
  output: 'static',
  devToolbar: { enabled: false },
});
