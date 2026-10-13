import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const root = new URL('../.qa/', import.meta.url);
await mkdir(root, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true
});

const allProfiles = [
  ['desktop', 1440, 1100],
  ['laptop', 1024, 900],
  ['tablet', 768, 1024],
  ['mobile', 390, 844]
];
const requestedProfile = process.argv.find((argument) => argument.startsWith('--profile='))?.split('=')[1];
const profiles = requestedProfile ? allProfiles.filter(([profile]) => profile === requestedProfile) : allProfiles;
if (!profiles.length) throw new Error(`Unknown QA profile: ${requestedProfile}`);
const routes = ['', 'nosotros/', 'servicios/', 'contacto/'];
const errors = [];
const whatsappUrl = 'https://wa.me/5491127332222?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1n%3F%20Quisiera%20consultar%20por%20cerramientos%20en%20ALMAT%20Cerramientos.%20%C2%BFMe%20podr%C3%ADan%20asesorar%3F';

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
      const title = hero.querySelector('h1');
      const intro = hero.querySelector('.page-hero__intro, .home-hero__copy');
      if (!(heading instanceof HTMLElement) || !(support instanceof HTMLElement) || !(title instanceof HTMLElement) || !(intro instanceof HTMLElement)) return null;
      const headingRect = heading.getBoundingClientRect();
      const supportRect = support.getBoundingClientRect();
      const titleStyle = getComputedStyle(title);
      const introStyle = getComputedStyle(intro);
      const titleRange = document.createRange();
      titleRange.selectNodeContents(title);
      const widestTitleLine = Math.max(...Array.from(titleRange.getClientRects(), (rect) => rect.width));
      const titleLines = Math.round(title.getBoundingClientRect().height / parseFloat(titleStyle.lineHeight));
      const introLines = Math.round(intro.getBoundingClientRect().height / parseFloat(introStyle.lineHeight));
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
      const stackTop = headingRect.top;
      const stackBottom = supportRect.bottom;
      return {
        boundaryDelta: Math.abs(headingRect.right - supportRect.right),
        leftDelta: Math.abs(headingRect.left - supportRect.left),
        left: headingRect.left,
        centerDelta: Math.abs((stackTop + stackBottom) / 2 - (headerHeight + (innerHeight - headerHeight) / 2)),
        titleLines,
        introLines,
        introWidth: intro.getBoundingClientRect().width,
        widestTitleLine,
        introFontFamily: introStyle.fontFamily,
        introFontWeight: introStyle.fontWeight,
        crossesMidpoint: innerWidth > 960 && headingRect.right > innerWidth / 2 + 2
      };
    });
    if (!heroBox || heroBox.boundaryDelta > 2) errors.push(`${profile}/${route || 'home'}: hero content does not share one right boundary`);
    if (heroBox && width > 640 && heroBox.centerDelta > 56) errors.push(`${profile}/${route || 'home'}: hero content is not vertically centered`);
    if (heroBox && width <= 640 && (heroBox.leftDelta > 2 || Math.abs(heroBox.left - width * .08) > 2)) errors.push(`${profile}/${route || 'home'}: mobile hero content is not aligned to the 8% gutter`);
    if (heroBox && heroBox.titleLines > 3) errors.push(`${profile}/${route || 'home'}: hero title uses ${heroBox.titleLines} lines`);
    if (heroBox && heroBox.introLines > 2) errors.push(`${profile}/${route || 'home'}: hero intro uses ${heroBox.introLines} lines`);
    if (heroBox && heroBox.introWidth > heroBox.widestTitleLine + 2) errors.push(`${profile}/${route || 'home'}: hero intro is wider than the title`);
    if (heroBox && (!heroBox.introFontFamily.toLowerCase().includes('roboto') || heroBox.introFontWeight !== '300')) errors.push(`${profile}/${route || 'home'}: hero intro is not Roboto Light`);
    if (heroBox?.crossesMidpoint) errors.push(`${profile}/${route || 'home'}: hero box crosses the viewport midpoint`);
    const emptyCtas = await page.locator('.cta').evaluateAll((links) => links.filter((link) => !link.textContent?.trim() || (link instanceof HTMLAnchorElement && !link.getAttribute('href'))).length);
    if (emptyCtas) errors.push(`${profile}/${route || 'home'}: ${emptyCtas} CTA(s) missing label or href`);
    const invalidCtas = await page.locator('.cta').evaluateAll((items) => items.filter((item) => getComputedStyle(item).borderTopWidth !== '3px' || item.textContent?.includes('↗')).length);
    if (invalidCtas) errors.push(`${profile}/${route || 'home'}: ${invalidCtas} CTA(s) have an invalid border or arrow`);
    const asymmetricCtas = await page.locator('.cta').evaluateAll((items) => items.filter((item) => {
      const style = getComputedStyle(item);
      return Math.abs(parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) > .5;
    }).length);
    if (asymmetricCtas) errors.push(`${profile}/${route || 'home'}: ${asymmetricCtas} CTA(s) have asymmetric horizontal padding`);
    if (width <= 640) {
      const groupsWithMultipleVisibleCtas = await page.locator('.cta-group').evaluateAll((groups) => groups.filter((group) => Array.from(group.querySelectorAll('.cta')).filter((cta) => getComputedStyle(cta).display !== 'none').length > 1).length);
      if (groupsWithMultipleVisibleCtas) errors.push(`${profile}/${route || 'home'}: a mobile CTA group shows more than its first action`);
      const gutter = await page.locator('.wrap').first().evaluate((wrap) => parseFloat(getComputedStyle(wrap).paddingLeft));
      if (Math.abs(gutter - width * .08) > 1) errors.push(`${profile}/${route || 'home'}: mobile content gutter is not 8%`);
    }
    await page.waitForTimeout(900);
    const whatsappButton = await page.locator('.whatsapp-float').evaluate((button) => {
      const image = button.querySelector('img');
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        href: button.getAttribute('href'),
        target: button.getAttribute('target'),
        rel: button.getAttribute('rel'),
        label: button.getAttribute('aria-label'),
        position: style.position,
        right: Math.round(innerWidth - rect.right),
        bottom: Math.round(innerHeight - rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        imageLoaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth === 272 && image.naturalHeight === 272
      };
    });
    const expectedButton = width <= 640
      ? { size: 56, right: 20, bottom: 20 }
      : width <= 960
        ? { size: 62, right: 24, bottom: 24 }
        : { size: 68, right: 30, bottom: 30 };
    if (whatsappButton.href !== whatsappUrl) errors.push(`${profile}/${route || 'home'}: floating WhatsApp URL is incorrect`);
    if (whatsappButton.target !== '_blank' || whatsappButton.rel !== 'noopener noreferrer') errors.push(`${profile}/${route || 'home'}: floating WhatsApp link attributes are incorrect`);
    if (whatsappButton.label !== 'Escribinos por WhatsApp a ALMAT Cerramientos') errors.push(`${profile}/${route || 'home'}: floating WhatsApp aria-label is incorrect`);
    if (whatsappButton.position !== 'fixed') errors.push(`${profile}/${route || 'home'}: WhatsApp button is not fixed`);
    if (whatsappButton.width !== expectedButton.size || whatsappButton.height !== expectedButton.size || whatsappButton.right !== expectedButton.right || whatsappButton.bottom !== expectedButton.bottom) errors.push(`${profile}/${route || 'home'}: WhatsApp button has incorrect responsive geometry`);
    if (!whatsappButton.imageLoaded) errors.push(`${profile}/${route || 'home'}: WhatsApp image did not load at the optimized dimensions`);
    if (width > 960) {
      await page.locator('.whatsapp-float').hover();
      await page.waitForTimeout(300);
      const tooltipOpacity = await page.locator('.whatsapp-float__tooltip').evaluate((tooltip) => getComputedStyle(tooltip).opacity);
      if (tooltipOpacity !== '1') errors.push(`${profile}/${route || 'home'}: WhatsApp tooltip is not visible on hover`);
      await page.mouse.move(0, 0);
    } else {
      const tooltipDisplay = await page.locator('.whatsapp-float__tooltip').evaluate((tooltip) => getComputedStyle(tooltip).display);
      if (tooltipDisplay !== 'none') errors.push(`${profile}/${route || 'home'}: WhatsApp tooltip should be hidden on touch layouts`);
    }
    const sections = await page.locator('main > section').all();
    for (const section of sections) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
    }
    const floatingButtonVisible = await page.locator('.whatsapp-float').evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight && getComputedStyle(button).visibility === 'visible';
    });
    if (!floatingButtonVisible) errors.push(`${profile}/${route || 'home'}: WhatsApp button is not visible after scrolling`);
    if (route === '') {
      const whatsappCtas = await page.locator('a.cta[href^="https://wa.me/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      if (whatsappCtas.length < 10) errors.push(`${profile}/home: expected at least 10 WhatsApp CTAs, found ${whatsappCtas.length}`);
      if (whatsappCtas.some((href) => href !== 'https://wa.me/5491127332222?text=Hola%20ALMAT%2C%20quisiera%20solicitar%20un%20presupuesto.')) errors.push(`${profile}/home: a WhatsApp CTA has an incorrect URL`);
      const logosLoaded = await page.locator('.logo-strip__logos img').evaluateAll((images) => images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0));
      if (!logosLoaded) errors.push(`${profile}/home: partner logos did not load correctly`);
      if (await page.locator('.logo-strip__intro').count()) errors.push(`${profile}/home: removed logo-strip heading or CTA is still present`);
      const factoryServiceCta = page.locator('.factory-statement__copy .cta[href="/almat/servicios/"]');
      if (await factoryServiceCta.count() !== 1) errors.push(`${profile}/home: factory services CTA is missing or has an incorrect URL`);
      if (width <= 640 && await factoryServiceCta.isVisible()) errors.push(`${profile}/home: secondary factory CTA should be hidden on mobile`);
      if (width > 640 && !await factoryServiceCta.isVisible()) errors.push(`${profile}/home: secondary factory CTA should be visible outside mobile`);
      if (await page.locator('.services-feature .cta').count()) errors.push(`${profile}/home: removed services feature CTA is still present`);
      if (await page.locator('.services-head__meta').textContent() !== 'ALUMINIO · VIDRIO · PVC') errors.push(`${profile}/home: services material detail is missing`);
      const glassDetails = await page.evaluate(() => {
        const card = document.querySelector('.capability-card');
        const header = document.querySelector('.site-header');
        const cardStyle = card ? getComputedStyle(card) : null;
        const headerStyle = header ? getComputedStyle(header) : null;
        return {
          cardBackground: cardStyle?.backgroundImage ?? '',
          cardShadow: cardStyle?.boxShadow ?? 'none',
          headerBackground: headerStyle?.backgroundColor ?? '',
          headerShadow: headerStyle?.boxShadow ?? 'none'
        };
      });
      if (!glassDetails.cardBackground.includes('gradient') || glassDetails.cardShadow === 'none') errors.push(`${profile}/home: capability cards are missing the glass treatment`);
      if (!glassDetails.headerBackground.startsWith('rgba') || glassDetails.headerShadow === 'none') errors.push(`${profile}/home: scrolled navigation is missing the glass treatment`);
      if (width > 960) {
        const servicesTitleLines = await page.locator('.services-head .section-title').evaluate((title) => {
          const style = getComputedStyle(title);
          return Math.round(title.getBoundingClientRect().height / parseFloat(style.lineHeight));
        });
        if (servicesTitleLines !== 1) errors.push(`${profile}/home: services title should use one desktop line`);
        const capabilityCopy = await page.locator('.capability-card > p').evaluateAll((paragraphs) => paragraphs.map((paragraph) => {
          const style = getComputedStyle(paragraph);
          return {
            characters: paragraph.textContent?.trim().length ?? 0,
            words: paragraph.textContent?.trim().split(/\s+/).length ?? 0,
            lines: Math.round(paragraph.getBoundingClientRect().height / parseFloat(style.lineHeight))
          };
        }));
        if (capabilityCopy.some(({ lines }) => lines > 3)) errors.push(`${profile}/home: a capability description exceeds three lines`);
        if (Math.max(...capabilityCopy.map(({ characters }) => characters)) - Math.min(...capabilityCopy.map(({ characters }) => characters)) > 10) errors.push(`${profile}/home: capability descriptions are not balanced by character count`);
        if (Math.max(...capabilityCopy.map(({ words }) => words)) - Math.min(...capabilityCopy.map(({ words }) => words)) > 2) errors.push(`${profile}/home: capability descriptions are not balanced by word count`);
      }
      await page.waitForTimeout(1200);
      await page.locator('.factory-statement').screenshot({ path: new URL(`factory-statement-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.capabilities').screenshot({ path: new URL(`capabilities-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.services-feature').screenshot({ path: new URL(`services-feature-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.trust').screenshot({ path: new URL(`partners-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.logo-strip').screenshot({ path: new URL(`logo-strip-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.visual-cta').screenshot({ path: new URL(`visual-cta-${profile}.png`, root).pathname.slice(1) });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
    }
    if (route === 'nosotros/') {
      const trustLogosLoaded = await page.locator('.partner-logos img').evaluateAll((images) => images.length === 5 && images.every((image) => image.complete && image.naturalWidth > 0));
      if (!trustLogosLoaded) errors.push(`${profile}/${route || 'home'}: trust partner logos did not load correctly`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: new URL(`${route.replace('/', '') || 'home'}-${profile}.png`, root).pathname.slice(1), fullPage: false });
    if (width <= 960) {
      await page.locator('[data-menu-toggle]').click();
      await page.waitForTimeout(800);
      const menuState = await page.locator('[data-menu]').evaluate((menu) => ({
        visible: getComputedStyle(menu).visibility === 'visible',
        interactive: !menu.hasAttribute('inert'),
        links: Array.from(menu.querySelectorAll('nav a'), (link) => link.getAttribute('href'))
      }));
      const expectedLinks = ['/almat/', '/almat/nosotros/', '/almat/servicios/', '/almat/contacto/'];
      if (!menuState.visible || !menuState.interactive) errors.push(`${profile}/${route || 'home'}: mobile menu did not open`);
      if (JSON.stringify(menuState.links) !== JSON.stringify(expectedLinks)) errors.push(`${profile}/${route || 'home'}: mobile menu links are incorrect`);
      const targetHref = route === '' ? '/almat/contacto/' : '/almat/';
      await page.locator(`.mobile-link[href="${targetHref}"]`).click();
      await page.waitForLoadState('domcontentloaded');
      if (new URL(page.url()).pathname !== targetHref) errors.push(`${profile}/${route || 'home'}: mobile menu link did not navigate`);
    }
  }
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`QA passed: ${routes.length} routes × ${profiles.length} viewport${profiles.length === 1 ? '' : 's'}, functional CTAs, floating WhatsApp button, no console errors or horizontal overflow.`);
