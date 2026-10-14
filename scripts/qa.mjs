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
    const heroContentBottomPadding = await page.locator('.page-hero__content, .home-hero__content').evaluate((content) => parseFloat(getComputedStyle(content).paddingBottom));
    if (heroContentBottomPadding !== 75) errors.push(`${profile}/${route || 'home'}: hero content does not have the requested 75px bottom padding`);
    const heroContentTopPadding = await page.locator('.page-hero__content, .home-hero__content').evaluate((content) => parseFloat(getComputedStyle(content).paddingTop));
    if (width > 960 && heroContentTopPadding !== 35) errors.push(`${profile}/${route || 'home'}: desktop hero content does not have 35px above the eyebrow`);
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
    if (width > 960) {
      const headerStyle = await page.locator('.site-header').evaluate((header) => {
        const style = getComputedStyle(header);
        return { backdrop: style.backdropFilter, background: style.backgroundColor };
      });
      const navWeights = await page.locator('.desktop-nav .nav-link').evaluateAll((links) => links.map((link) => parseInt(getComputedStyle(link).fontWeight, 10)));
      if (headerStyle.backdrop === 'none' || !headerStyle.background.startsWith('rgba(')) errors.push(`${profile}/${route || 'home'}: desktop navigation is missing its glass background`);
      if (navWeights.some((weight) => weight < 500)) errors.push(`${profile}/${route || 'home'}: desktop navigation type is too light`);
      const headerContact = page.locator('.header-contact');
      await headerContact.hover();
      await page.waitForTimeout(400);
      const headerContactHover = await headerContact.evaluate((link) => {
        const style = getComputedStyle(link);
        return { background: style.backgroundColor, color: style.color };
      });
      if (headerContactHover.background !== 'rgb(20, 21, 19)' || headerContactHover.color !== 'rgb(238, 234, 225)') errors.push(`${profile}/${route || 'home'}: desktop header CTA hover is not black with white type`);
      const titleCopyStyles = await page.locator('.page-hero__intro, .home-hero__copy, .section-title + .lead, .section-title + .body-large, .factory-statement__copy > p, .trust__content > .body-large, .method-grid__copy > .body-large, .services-intro > p, .service-scene__copy > p, .visual-cta__aside > p').evaluateAll((items) => items.map((item) => {
        const style = getComputedStyle(item);
        return { family: style.fontFamily.toLowerCase(), size: parseFloat(style.fontSize), weight: style.fontWeight };
      }));
      if (titleCopyStyles.some(({ family, size, weight }) => !family.includes('roboto') || size !== 16 || weight !== '300')) errors.push(`${profile}/${route || 'home'}: title supporting copy is not 16px Roboto Light on desktop`);
    }
    const punctuatedLargeTitles = await page.locator('h1, h2').evaluateAll((titles) => titles.map((title) => title.textContent?.trim() ?? '').filter((title) => title.endsWith('.')));
    if (punctuatedLargeTitles.length) errors.push(`${profile}/${route || 'home'}: large title still ends in a period: ${punctuatedLargeTitles.join(' | ')}`);
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
    const buttonType = await page.locator('.cta, .header-contact').evaluateAll((items) => items.filter((item) => item.getClientRects().length).map((item) => {
      const style = getComputedStyle(item);
      const label = item.querySelector('span') ?? item;
      return { weight: parseInt(style.fontWeight, 10), size: parseFloat(style.fontSize), transform: getComputedStyle(label).transform };
    }));
    if (buttonType.some(({ weight, size, transform }) => weight !== 550 || Math.abs(size - 9.52) > .05 || transform !== 'none')) errors.push(`${profile}/${route || 'home'}: button labels do not use the requested 2px smaller type without vertical displacement`);
    if (width <= 640) {
      const groupsWithMultipleVisibleCtas = await page.locator('.cta-group').evaluateAll((groups) => groups.filter((group) => Array.from(group.querySelectorAll('.cta')).filter((cta) => getComputedStyle(cta).display !== 'none').length > 1).length);
      if (groupsWithMultipleVisibleCtas) errors.push(`${profile}/${route || 'home'}: a mobile CTA group shows more than its first action`);
      const gutter = await page.locator('.wrap').first().evaluate((wrap) => parseFloat(getComputedStyle(wrap).paddingLeft));
      if (Math.abs(gutter - width * .08) > 1) errors.push(`${profile}/${route || 'home'}: mobile content gutter is not 8%`);
    }
    const footerContact = await page.locator('.footer-contact').evaluate((section) => ({
      background: getComputedStyle(section).backgroundColor,
      borderColor: getComputedStyle(section).borderBottomColor,
      borderWidth: parseFloat(getComputedStyle(section).borderBottomWidth),
      followedByFooter: section.nextElementSibling?.classList.contains('site-footer') ?? false,
      title: section.querySelector('h2')?.textContent?.trim(),
      formAction: section.querySelector('form')?.getAttribute('action'),
      fields: section.querySelectorAll('input:not([type="hidden"]):not([name="_honey"]), select, textarea').length
    }));
    if (footerContact.background !== 'rgb(20, 21, 19)' || footerContact.borderColor !== 'rgb(238, 234, 225)' || footerContact.borderWidth !== 1) errors.push(`${profile}/${route || 'home'}: footer contact module does not have the black background and white divider`);
    if (!footerContact.followedByFooter || footerContact.title !== 'Hablemos de tu próximo espacio') errors.push(`${profile}/${route || 'home'}: footer contact module is missing or misplaced`);
    if (footerContact.formAction !== 'https://formsubmit.co/almatcerramientos@gmail.com' || footerContact.fields !== 5) errors.push(`${profile}/${route || 'home'}: footer contact form is incomplete`);
    const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
      const ids = elements.map((element) => element.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    if (duplicateIds.length) errors.push(`${profile}/${route || 'home'}: duplicate IDs found: ${duplicateIds.join(', ')}`);
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
      await page.waitForFunction(() => document.querySelector('[data-count-up="30"]')?.textContent === '30');
      const homeSectionOrder = await page.locator('main > section').evaluateAll((sections) => sections.map((section) => section.classList[0]));
      if (JSON.stringify(homeSectionOrder.slice(0, 4)) !== JSON.stringify(['home-hero', 'factory-statement', 'trust', 'logo-strip'])) errors.push(`${profile}/home: trajectory module and logo strip are not directly below the first module`);
      const capabilitiesIndex = homeSectionOrder.indexOf('capabilities');
      if (capabilitiesIndex < 0 || homeSectionOrder[capabilitiesIndex + 1] !== 'benefits') errors.push(`${profile}/home: benefits module is not directly after five solutions`);
      if (homeSectionOrder.at(-2) !== 'visual-cta' || homeSectionOrder.at(-1) !== 'reviews-section') errors.push(`${profile}/home: closing modules are not visual CTA followed by reviews`);
      const whatsappCtas = await page.locator('a.cta[href^="https://wa.me/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      if (whatsappCtas.length < 10) errors.push(`${profile}/home: expected at least 10 WhatsApp CTAs, found ${whatsappCtas.length}`);
      const standardWhatsappCtas = await page.locator('a.cta[href^="https://wa.me/"]:not(.capability-card .cta)').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      if (standardWhatsappCtas.some((href) => href !== 'https://wa.me/5491127332222?text=Hola%20ALMAT%2C%20quisiera%20solicitar%20un%20presupuesto.')) errors.push(`${profile}/home: a standard WhatsApp CTA has an incorrect URL`);
      const logosLoaded = await page.locator('.logo-strip__logos img').evaluateAll((images) => images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0));
      if (!logosLoaded) errors.push(`${profile}/home: partner logos did not load correctly`);
      const verticalRhythm = await page.evaluate(() => {
        const logoInner = document.querySelector('.logo-strip__inner');
        const capabilitiesHead = document.querySelector('.capabilities__head');
        if (!(logoInner instanceof HTMLElement) || !(capabilitiesHead instanceof HTMLElement)) return null;
        const logoStyle = getComputedStyle(logoInner);
        const headStyle = getComputedStyle(capabilitiesHead);
        return {
          logoTop: parseFloat(logoStyle.paddingTop),
          logoBottom: parseFloat(logoStyle.paddingBottom),
          headTop: parseFloat(headStyle.paddingTop),
          headBottom: parseFloat(headStyle.paddingBottom)
        };
      });
      const expectedHeadPadding = width <= 640 ? 44 : width <= 960 ? 52 : 64;
      const expectedLogoPadding = width <= 960 ? 40 : 44;
      if (!verticalRhythm || verticalRhythm.headTop !== expectedHeadPadding || verticalRhythm.headBottom !== expectedHeadPadding || verticalRhythm.logoTop !== expectedLogoPadding || verticalRhythm.logoBottom !== expectedLogoPadding) errors.push(`${profile}/home: logo strip and capabilities heading do not use the balanced vertical rhythm`);
      if (await page.locator('.logo-strip__intro').count()) errors.push(`${profile}/home: removed logo-strip heading or CTA is still present`);
      const factoryServiceCta = page.locator('.factory-statement__copy .cta[href="/almat/servicios/"]');
      if (await factoryServiceCta.count() !== 1) errors.push(`${profile}/home: factory services CTA is missing or has an incorrect URL`);
      if (width <= 640 && await factoryServiceCta.isVisible()) errors.push(`${profile}/home: secondary factory CTA should be hidden on mobile`);
      if (width > 640 && !await factoryServiceCta.isVisible()) errors.push(`${profile}/home: secondary factory CTA should be visible outside mobile`);
      if (await page.locator('.services-feature').count()) errors.push(`${profile}/home: removed services feature module is still present`);
      const benefitsTheme = await page.locator('.benefits').evaluate((section) => ({
        background: getComputedStyle(section).backgroundColor,
        color: getComputedStyle(section).color,
        rows: section.querySelectorAll('.benefit-row').length,
        ctaLight: section.querySelector('.cta')?.classList.contains('cta--light'),
        eyebrowInsideSupport: Boolean(section.querySelector('.section-support > .eyebrow')),
        centeredDelta: (() => {
          const top = section.querySelector('.benefits__top')?.getBoundingClientRect();
          const support = section.querySelector('.section-support')?.getBoundingClientRect();
          return top && support ? Math.abs((top.top + top.bottom) / 2 - (support.top + support.bottom) / 2) : 999;
        })(),
        sideBySide: (() => {
          const top = section.querySelector('.benefits__top')?.getBoundingClientRect();
          const list = section.querySelector('.benefit-list')?.getBoundingClientRect();
          return Boolean(top && list && top.right < list.left && Math.abs((top.top + top.bottom) / 2 - (list.top + list.bottom) / 2) < 3);
        })(),
        height: section.getBoundingClientRect().height
      }));
      if (benefitsTheme.background !== 'rgb(20, 21, 19)' || benefitsTheme.color !== 'rgb(238, 234, 225)' || benefitsTheme.rows !== 4 || !benefitsTheme.ctaLight) errors.push(`${profile}/home: benefits section is not fully using the dark theme`);
      if (!benefitsTheme.eyebrowInsideSupport || benefitsTheme.centeredDelta > 2) errors.push(`${profile}/home: benefits eyebrow and content block are not correctly stacked and vertically centered`);
      if (width > 960 && (!benefitsTheme.sideBySide || benefitsTheme.height > 800)) errors.push(`${profile}/home: benefits should be a compact side-by-side desktop module`);
      if (width <= 960 && benefitsTheme.sideBySide) errors.push(`${profile}/home: benefits should stack on tablet and mobile`);
      const lateralHomeEyebrows = await page.locator('.capabilities__head > .eyebrow, .work-head > .eyebrow, .benefits__top > .eyebrow').count();
      if (lateralHomeEyebrows) errors.push(`${profile}/home: a section eyebrow is still positioned beside its title`);
      const capabilities = await page.locator('.capabilities').evaluate((section) => ({
        title: section.querySelector('h2')?.textContent?.trim(),
        cards: section.querySelectorAll('.capability-card').length,
        labels: Array.from(section.querySelectorAll('.capability-card .cta'), (button) => button.textContent?.trim() ?? ''),
        titleLines: Array.from(section.querySelectorAll('.capability-card h3'), (title) => {
          const style = getComputedStyle(title);
          return Math.round(title.getBoundingClientRect().height / parseFloat(style.lineHeight));
        }),
        copyLines: Array.from(section.querySelectorAll('.capability-card > p'), (copy) => {
          const style = getComputedStyle(copy);
          return Math.round(copy.getBoundingClientRect().height / parseFloat(style.lineHeight));
        }),
        messages: Array.from(section.querySelectorAll('.capability-card .cta'), (button) => new URL(button.href).searchParams.get('text')),
        pvcTitleLines: (() => {
          const title = section.querySelector('.capability-card:last-child h3');
          if (!(title instanceof HTMLElement)) return 0;
          const style = getComputedStyle(title);
          return Math.round(title.getBoundingClientRect().height / parseFloat(style.lineHeight));
        })(),
        fullWidth: (() => {
          const grid = section.querySelector('.capabilities-grid')?.getBoundingClientRect();
          return Boolean(grid && Math.abs(grid.left) < 1 && Math.abs(grid.right - innerWidth) < 1);
        })(),
        pvcAlt: section.querySelector('.capability-card:last-child img')?.getAttribute('alt'),
        pvcImageLoaded: (() => {
          const image = section.querySelector('.capability-card:last-child img');
          return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
        })()
      }));
      if (capabilities.title !== 'Cinco soluciones. Una misma precisión' || capabilities.cards !== 5 || capabilities.pvcAlt !== 'Abertura de PVC blanca en un dormitorio con vista al jardín' || !capabilities.pvcImageLoaded) errors.push(`${profile}/home: PVC capability card is incomplete`);
      if (!capabilities.fullWidth) errors.push(`${profile}/home: capabilities grid is not full viewport width`);
      if (capabilities.labels.some((label) => label !== 'Quiero más info')) errors.push(`${profile}/home: capability CTAs are not consistently labelled`);
      const expectedInfoMessages = [
        'Hola ALMAT Cerramientos, quiero más info de fabricación e instalación de aberturas de aluminio.',
        'Hola ALMAT Cerramientos, quiero más info de cerramientos de aluminio.',
        'Hola ALMAT Cerramientos, quiero más info de vidrios, espejos y templados.',
        'Hola ALMAT Cerramientos, quiero más info de cerramientos corredizos y plegadizos de vidrio.',
        'Hola ALMAT Cerramientos, quiero más info de aberturas de PVC.'
      ];
      if (JSON.stringify(capabilities.messages) !== JSON.stringify(expectedInfoMessages)) errors.push(`${profile}/home: a capability WhatsApp message is not personalized correctly`);
      if (width > 960 && capabilities.pvcTitleLines !== 2) errors.push(`${profile}/home: PVC title does not use exactly two desktop lines`);
      if (width > 960 && capabilities.titleLines.some((lines) => lines !== 2)) errors.push(`${profile}/home: every capability title must use exactly two desktop lines`);
      if (width > 960 && capabilities.copyLines.some((lines) => lines !== 3)) errors.push(`${profile}/home: every capability description must use exactly three desktop lines`);
      const galleryLayout = await page.locator('.masonry-gallery .gallery-item').evaluateAll((items) => ({
        sources: items.map((item) => item.querySelector('img')?.currentSrc),
        rects: items.map((item) => {
          const rect = item.getBoundingClientRect();
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) };
        })
      }));
      if (galleryLayout.rects.length !== 5 || new Set(galleryLayout.sources).size !== 5) errors.push(`${profile}/home: gallery should contain 5 unique images`);
      if (width > 640) {
        const [first, second, third, fourth, landscape] = galleryLayout.rects;
        const alignedPairs = first.top === second.top && third.top === fourth.top && first.height === second.height && third.height === fourth.height;
        const balancedColumns = first.width === second.width && third.width === fourth.width && first.left === third.left && second.right === fourth.right;
        const fullWidthLandscape = landscape.left === first.left && landscape.right === second.right && landscape.top > third.top;
        if (!alignedPairs || !balancedColumns || !fullWidthLandscape) errors.push(`${profile}/home: gallery does not use two balanced 2-image columns plus a full-width landscape image`);
      }
      const reviewsSection = await page.locator('.reviews-section').evaluate((section) => ({
        title: section.querySelector('h2')?.textContent?.trim(),
        reviews: Array.from(section.querySelectorAll('.review-item'), (review) => ({
          quote: review.querySelector('blockquote')?.textContent?.trim(),
          stars: review.querySelector('.review-item__stars')?.textContent?.trim(),
          starsLabel: review.querySelector('.review-item__stars')?.getAttribute('aria-label'),
          source: review.querySelector('.review-item__source')?.textContent?.trim()
        })),
        rating: section.querySelector('.reviews-section__rating')?.getAttribute('aria-label'),
        link: section.querySelector('.reviews-section__footer a')?.getAttribute('href')
      }));
      if (reviewsSection.title !== 'La confianza se construye en cada proyecto' || reviewsSection.reviews.length !== 3) errors.push(`${profile}/home: Google reviews section content is incomplete`);
      if (reviewsSection.reviews.some(({ quote, source }) => !quote || source !== 'Opinión de 5 estrellas en Google')) errors.push(`${profile}/home: a Google review is missing its quote or attribution`);
      if (reviewsSection.reviews.some(({ stars, starsLabel }) => stars !== '★★★★★' || starsLabel !== '5 de 5 estrellas')) errors.push(`${profile}/home: a Google review is missing its five-star rating`);
      if (reviewsSection.rating !== 'Calificación de 4,8 sobre 5 basada en 129 opiniones en Google') errors.push(`${profile}/home: Google review rating is incorrect`);
      if (reviewsSection.link !== 'https://share.google/H2V3YCetLLZqCp11D') errors.push(`${profile}/home: Google reviews source link is incorrect`);
      if (width >= 1280) {
        const capabilityCopy = await page.locator('.capability-card > p').evaluateAll((paragraphs) => paragraphs.map((paragraph) => {
          const style = getComputedStyle(paragraph);
          return {
            characters: paragraph.textContent?.trim().length ?? 0,
            words: paragraph.textContent?.trim().split(/\s+/).length ?? 0,
            lines: Math.round(paragraph.getBoundingClientRect().height / parseFloat(style.lineHeight))
          };
        }));
        if (capabilityCopy.some(({ lines }) => lines !== 3)) errors.push(`${profile}/home: a capability description does not use exactly three lines`);
        if (Math.max(...capabilityCopy.map(({ characters }) => characters)) - Math.min(...capabilityCopy.map(({ characters }) => characters)) > 10) errors.push(`${profile}/home: capability descriptions are not balanced by character count`);
        if (Math.max(...capabilityCopy.map(({ words }) => words)) - Math.min(...capabilityCopy.map(({ words }) => words)) > 2) errors.push(`${profile}/home: capability descriptions are not balanced by word count`);
      }
      if (width > 960) {
        const alignedSectionStarts = await page.evaluate(() => {
          const selectors = ['.capabilities__support', '.work-head .section-support', '.reviews-section__heading > div:first-child', '.visual-cta__content > div:first-child'];
          return selectors.map((selector) => Math.round(document.querySelector(selector)?.getBoundingClientRect().left ?? -1));
        });
        if (new Set(alignedSectionStarts).size !== 1) errors.push(`${profile}/home: major section text boxes do not share the same left axis (${alignedSectionStarts.join(', ')})`);
        const visualCtaTopAir = await page.locator('.visual-cta').evaluate((section) => {
          const eyebrow = section.querySelector('.eyebrow');
          return eyebrow ? Math.round(eyebrow.getBoundingClientRect().top - section.getBoundingClientRect().top) : -1;
        });
        if (visualCtaTopAir < 83) errors.push(`${profile}/home: visual CTA eyebrow does not have the added 35px top breathing room`);
      }
      await page.waitForTimeout(1200);
      await page.locator('.factory-statement').screenshot({ path: new URL(`factory-statement-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.capabilities').screenshot({ path: new URL(`capabilities-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.benefits').screenshot({ path: new URL(`benefits-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.reviews-section').screenshot({ path: new URL(`reviews-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.trust').screenshot({ path: new URL(`partners-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.logo-strip').screenshot({ path: new URL(`logo-strip-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.visual-cta').screenshot({ path: new URL(`visual-cta-${profile}.png`, root).pathname.slice(1) });
      await page.locator('.footer-contact').screenshot({ path: new URL(`footer-contact-${profile}.png`, root).pathname.slice(1) });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
    }
    if (route === 'nosotros/') {
      const trustLogosLoaded = await page.locator('.partner-logos img').evaluateAll((images) => images.length === 5 && images.every((image) => image.complete && image.naturalWidth > 0));
      if (!trustLogosLoaded) errors.push(`${profile}/${route || 'home'}: trust partner logos did not load correctly`);
    }
    if (route === 'servicios/') {
      const serviceScenes = await page.locator('.service-scene').count();
      const pvcServiceImage = await page.locator('#servicio-5 img').evaluate((image) => ({
        alt: image.getAttribute('alt'),
        loaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
      }));
      if (serviceScenes !== 5 || pvcServiceImage.alt !== 'Abertura de PVC blanca en un dormitorio con vista al jardín' || !pvcServiceImage.loaded) errors.push(`${profile}/servicios: PVC solution is incomplete`);
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
