import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const customDomain = process.env.ALMAT_CUSTOM_DOMAIN === 'true';

export default defineConfig({
  site: customDomain ? 'https://almatcerramientos.com.ar' : 'https://ideamosestudio.github.io',
  base: customDomain ? '/' : '/almat',
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
