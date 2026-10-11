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
  ['laptop', 1024, 900],
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
    const h1Count = await page.locator('h1').count();
    if (h1Count !== 1) errors.push(`${profile}/${route || 'home'}: expected one H1, found ${h1Count}`);
    const heroCtaCount = await page.locator('.page-hero .cta, .home-hero .cta').count();
    if (heroCtaCount < 1) errors.push(`${profile}/${route || 'home'}: hero has no CTA`);
    const heroEyebrows = await page.locator('.page-hero .eyebrow, .home-hero .eyebrow').allTextContents();
    if (heroEyebrows.length !== 1 || heroEyebrows[0].trim() !== 'ABERTURAS Y CERRAMIENTOS') errors.push(`${profile}/${route || 'home'}: hero eyebrow is missing or incorrect`);
    const heroBox = await page.locator('.page-hero, .home-hero').evaluate((hero) => {
      const heading = hero.querySelector('.page-hero__heading, .home-hero__heading');
      const support = hero.querySelector('.page-hero__support, .home-hero__lower');
      if (!(heading instanceof HTMLElement) || !(support instanceof HTMLElement)) return null;
      const headingRect = heading.getBoundingClientRect();
      const supportRect = support.getBoundingClientRect();
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
      const stackTop = headingRect.top;
      const stackBottom = supportRect.bottom;
      return {
        boundaryDelta: Math.abs(headingRect.right - supportRect.right),
        centerDelta: Math.abs((stackTop + stackBottom) / 2 - (headerHeight + (innerHeight - headerHeight) / 2))
      };
    });
    if (!heroBox || heroBox.boundaryDelta > 2) errors.push(`${profile}/${route || 'home'}: hero content does not share one right boundary`);
    if (heroBox && heroBox.centerDelta > 56) errors.push(`${profile}/${route || 'home'}: hero content is not vertically centered`);
    const emptyCtas = await page.locator('.cta').evaluateAll((links) => links.filter((link) => !link.textContent?.trim() || (link instanceof HTMLAnchorElement && !link.getAttribute('href'))).length);
    if (emptyCtas) errors.push(`${profile}/${route || 'home'}: ${emptyCtas} CTA(s) missing label or href`);
    const invalidCtas = await page.locator('.cta').evaluateAll((items) => items.filter((item) => getComputedStyle(item).borderTopWidth !== '3px' || item.textContent?.includes('↗')).length);
    if (invalidCtas) errors.push(`${profile}/${route || 'home'}: ${invalidCtas} CTA(s) have an invalid border or arrow`);
    await page.waitForTimeout(900);
    const sections = await page.locator('main > section').all();
    for (const section of sections) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
    }
    if (route === '') {
      const whatsappCtas = await page.locator('a.cta[href^="https://wa.me/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      if (whatsappCtas.length < 12) errors.push(`${profile}/home: expected at least 12 WhatsApp CTAs, found ${whatsappCtas.length}`);
      if (whatsappCtas.some((href) => href !== 'https://wa.me/5491127332222?text=Hola%20ALMAT%2C%20quisiera%20solicitar%20un%20presupuesto.')) errors.push(`${profile}/home: a WhatsApp CTA has an incorrect URL`);
      const logosLoaded = await page.locator('.logo-strip__logos img').evaluateAll((images) => images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0));
      if (!logosLoaded) errors.push(`${profile}/home: partner logos did not load correctly`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: new URL(`${route.replace('/', '') || 'home'}-${profile}.png`, root).pathname.slice(1), fullPage: false });
  }
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('QA passed: 4 routes × 4 viewports, one H1 per page, functional CTAs, no console errors or horizontal overflow.');
