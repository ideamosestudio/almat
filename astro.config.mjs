import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const customDomain = process.env.ALMAT_CUSTOM_DOMAIN === 'true';

export default defineConfig({
  site: customDomain ? 'https://almatcerramientos.com.ar' : 'https://ideamosestudio.github.io',
  base: customDomain ? '/' : '/almat',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: { syntaxHighlight: false },
  security: {
    csp: {
      scriptDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: "'none'", kind: 'attribute' }
        ]
      },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          // Responsive images and parallax use inline CSS custom properties.
          { resource: "'unsafe-inline'", kind: 'attribute' }
        ]
      },
      directives: [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://mail.almatcerramientos.com.ar",
        "form-action https://mail.almatcerramientos.com.ar",
        "frame-src https://www.google.com",
        "worker-src 'none'",
        "upgrade-insecure-requests"
      ]
    }
  },
  build: {
    assets: '_assets'
  },
  image: {
    responsiveStyles: true
  }
});
