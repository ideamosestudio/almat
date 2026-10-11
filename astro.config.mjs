import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ideamosestudio.github.io',
  base: '/almat',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: {
    assets: '_assets'
  },
  image: {
    responsiveStyles: true
  }
});
