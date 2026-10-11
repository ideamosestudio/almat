import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const root = new URL('../.qa/', import.meta.url);
await mkdir(root, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true
});

const profiles = [
  ['desktop', 1440, 1100],
  ['tablet', 768, 1024],
  ['mobile', 390, 844]
];
const routes = ['', 'nosotros/', 'servicios/', 'contacto/'];
const errors = [];

for (const [profile, width, height] of profiles) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${profile}: ${message.text()}`);
  });
  for (const route of routes) {
    const response = await page.goto(`http://127.0.0.1:4322/almat/${route}`, { waitUntil: 'networkidle' });
    if (!response?.ok()) errors.push(`${profile}/${route || 'home'}: HTTP ${response?.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) errors.push(`${profile}/${route || 'home'}: horizontal overflow`);
    if (route === '') {
      await page.waitForTimeout(1800);
      const sections = await page.locator('main > section').all();
      for (const section of sections) {
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(140);
      }
      const ctas = await page.locator('a.whatsapp-cta').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      if (ctas.length < 12) errors.push(`${profile}/home: expected at least 12 WhatsApp CTAs, found ${ctas.length}`);
      if (ctas.some((href) => href !== 'https://wa.me/5491127332222?text=Hola%20ALMAT%2C%20quisiera%20solicitar%20un%20presupuesto.')) {
        errors.push(`${profile}/home: a WhatsApp CTA has an incorrect URL`);
      }
      const logosLoaded = await page.locator('.logo-strip__logos img').evaluateAll((images) => images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0));
      if (!logosLoaded) errors.push(`${profile}/home: partner logos did not load correctly`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
      await page.screenshot({ path: new URL(`home-${profile}.png`, root).pathname.slice(1), fullPage: true });
    }
  }
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('QA passed: 4 routes × 3 viewports, no console errors or horizontal overflow.');
