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
      await page.screenshot({ path: new URL(`home-${profile}.png`, root).pathname.slice(1), fullPage: false });
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
