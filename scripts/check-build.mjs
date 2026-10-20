import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const custom = process.argv.includes('--domain');
const origin = custom ? 'https://almatcerramientos.com.ar' : 'https://ideamosestudio.github.io';
const base = custom ? '' : '/almat';
const routes = ['', 'nosotros/', 'servicios/', 'contacto/'];
for (const route of routes) {
  const html = readFileSync(`dist/${route}index.html`, 'utf8');
  assert.ok(html.includes(`rel="canonical" href="${origin}${base}/${route}"`), `canonical: ${route}`);
  assert.ok(html.includes('action="https://mail.almatcerramientos.com.ar/almat-api/contact.php"'), `own mail endpoint: ${route}`);
  assert.ok(!html.includes('formsubmit.co'), `third-party form endpoint: ${route}`);
  if (custom) assert.ok(!html.includes('ideamosestudio.github.io'), `old domain: ${route}`);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
    const url = match[1];
    if (url.startsWith('//')) continue;
    assert.ok(url.startsWith(`${base}/`), `wrong base: ${url}`);
    const relative = decodeURIComponent(url.slice(base.length));
    const file = `dist${relative}${relative.endsWith('/') ? 'index.html' : ''}`;
    assert.ok(existsSync(file), `missing asset or page: ${url}`);
  }
}
assert.ok(readFileSync('dist/robots.txt', 'utf8').includes(`${origin}${base}/sitemap-index.xml`));
assert.ok(readFileSync('dist/sitemap-index.xml', 'utf8').includes(`${origin}${base}/sitemap-0.xml`));
const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
for (const route of routes) assert.ok(sitemap.includes(`<loc>${origin}${base}/${route}</loc>`), `sitemap: ${route}`);
console.log(`PASS: ${custom ? 'custom domain' : 'Pages subpath'} — 4 pages, canonicals, local links/assets, form returns, robots and sitemap`);
