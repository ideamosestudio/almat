import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

const pages = ['index.html', 'nosotros/index.html', 'servicios/index.html', 'contacto/index.html'];
for (const page of pages) {
  const html = readFileSync(`dist/${page}`, 'utf8');
  const csp = html.match(/<meta[^>]+http-equiv="content-security-policy"[^>]+content="([^"]+)"/i)?.[1];
  assert.ok(csp, `CSP missing: ${page}`);
  for (const directive of ["default-src 'self'", "base-uri 'none'", "object-src 'none'", "script-src-attr 'none'", 'https://mail.almatcerramientos.com.ar']) {
    assert.ok(csp.includes(directive), `CSP missing ${directive}: ${page}`);
  }
  const scriptPolicy = csp.match(/(?:^|;)\s*script-src(?:-elem)?\s+([^;]+)/)?.[1] || '';
  assert.ok(scriptPolicy && !/unsafe-inline|unsafe-eval|\*/.test(scriptPolicy), `unsafe scripts: ${page}`);
  // These controls require HTTP response headers, not misleading meta tags.
  assert.ok(!/http-equiv="(?:Strict-Transport-Security|X-Frame-Options|Permissions-Policy)"/i.test(html));
  assert.ok(html.includes('name="referrer" content="strict-origin-when-cross-origin"'));
  assert.ok(!/\son\w+\s*=/i.test(html), `inline event handler: ${page}`);
  assert.ok(!/(?:src|href|action)="http:\/\//i.test(html), `insecure resource: ${page}`);
  assert.equal((html.match(/data-contact-form/g) || []).length, 1, `duplicate forms: ${page}`);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `H1 count: ${page}`);
  assert.ok(!/\ssrc="https:\/\/www\.google\.com/.test(html), `map loaded before interaction: ${page}`);
  assert.ok(html.includes('rel="canonical"') && html.includes('name="description"'), `SEO metadata: ${page}`);
}
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
];
for (const file of files) {
  if (!existsSync(file)) continue;
  assert.ok(!/(^|\/)\.env(?:$|\.(?!example$))/.test(file), `environment file tracked: ${file}`);
  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue;
  const content = buffer.toString('utf8');
  for (const pattern of secretPatterns) assert.ok(!pattern.test(content), `possible secret in ${file}`);
}
const assets = readdirSync('dist/_assets');
const bytes = (extension) => assets.filter((name) => name.endsWith(extension))
  .reduce((sum, name) => sum + statSync(`dist/_assets/${name}`).size, 0);
assert.ok(bytes('.js') < 35000, 'JS budget exceeded');
assert.ok(bytes('.css') < 85000, 'CSS budget exceeded');
assert.ok(!assets.some((name) => name.endsWith('.map')), 'source maps exposed');
for (const brand of ['almat-logo-black.webp', 'almat-logo-white.webp', 'whatsapp-almat.webp']) {
  assert.ok(statSync(`dist/brand/${brand}`).size < 25000, `brand budget: ${brand}`);
}
console.log(`PASS: CSP, one form/page, SEO, deferred map, tracked-secret patterns and asset budgets. JS=${bytes('.js')}B CSS=${bytes('.css')}B`);
