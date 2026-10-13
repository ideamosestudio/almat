const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initHeader = () => {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  if (!header || !menu || !toggle) return;

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 36);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only')!.textContent = open ? 'Cerrar menú' : 'Abrir menú';
    menu.setAttribute('aria-hidden', String(!open));
    menu.toggleAttribute('inert', !open);
    menu.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-is-open', open);
    if (open) menu.querySelector<HTMLAnchorElement>('nav a')?.focus({ preventScroll: true });
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
};

const initHeroCopyWidths = () => {
  const heroes = Array.from(document.querySelectorAll<HTMLElement>('.page-hero, .home-hero'));
  if (!heroes.length) return;

  const sync = () => {
    heroes.forEach((hero) => {
      const title = hero.querySelector<HTMLElement>('[data-hero-title]');
      const intro = hero.querySelector<HTMLElement>('[data-hero-intro]');
      if (!title || !intro) return;
      const range = document.createRange();
      range.selectNodeContents(title);
      const widestTitleLine = Math.max(...Array.from(range.getClientRects(), (rect) => rect.width));
      intro.style.setProperty('--hero-title-line-width', `${Math.ceil(widestTitleLine)}px`);
    });
  };

  document.fonts.ready.then(sync);
  window.addEventListener('resize', sync, { passive: true });
};

const initReveals = () => {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal], .reveal-up');
  const titles = document.querySelectorAll<HTMLElement>('.reveal-title');
  if (prefersReduced) {
    targets.forEach((target) => target.classList.add('is-visible'));
    titles.forEach((title) => title.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });
  targets.forEach((target) => observer.observe(target));

  const titleGroups = new Map<Element, HTMLElement[]>();
  titles.forEach((title) => {
    const anchor = title.parentElement ?? title;
    titleGroups.set(anchor, [...(titleGroups.get(anchor) ?? []), title]);
  });
  const titleObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      titleGroups.get(entry.target)?.forEach((title) => title.classList.add('is-visible'));
      titleObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  titleGroups.forEach((_titles, anchor) => titleObserver.observe(anchor));
};

const initParallax = () => {
  if (prefersReduced) return;
  const images = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (!images.length) return;
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    images.forEach((image) => {
      const rect = image.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      image.style.setProperty('--parallax-y', `${progress * -22}px`);
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
};

const initServiceList = () => {
  document.querySelectorAll<HTMLElement>('[data-service-list]').forEach((list) => {
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-service-row]'));
    const images = Array.from(list.querySelectorAll<HTMLElement>('[data-service-image]'));
    const activate = (index: number) => {
      rows.forEach((row, i) => row.classList.toggle('is-active', i === index));
      images.forEach((image, i) => image.classList.toggle('is-active', i === index));
    };
    rows.forEach((row, index) => {
      row.addEventListener('mouseenter', () => activate(index));
      row.addEventListener('focusin', () => activate(index));
    });
    activate(0);
  });
};

const initLightbox = () => {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lightbox-src]'));
  if (!dialog || !triggers.length) return;
  const image = dialog.querySelector<HTMLImageElement>('img')!;
  const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]')!;
  let current = 0;

  const show = (index: number) => {
    current = (index + triggers.length) % triggers.length;
    image.src = triggers[current].dataset.lightboxSrc!;
    image.alt = triggers[current].dataset.lightboxAlt ?? 'Trabajo realizado por ALMAT';
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(triggers.length).padStart(2, '0')}`;
  };
  triggers.forEach((trigger, index) => trigger.addEventListener('click', () => {
    show(index);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }));
  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
};

const initForm = () => {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;
  if (new URLSearchParams(window.location.search).get('enviado') === '1') {
    status.textContent = 'Gracias. Tu consulta fue enviada correctamente.';
    status.dataset.state = 'success';
  }
  form.addEventListener('submit', (event) => {
    if (!form.checkValidity()) {
      event.preventDefault();
      form.classList.add('was-validated');
      status.textContent = 'Revisá los campos marcados antes de enviar.';
      status.dataset.state = 'error';
      form.querySelector<HTMLElement>(':invalid')?.focus();
      return;
    }
    status.textContent = 'Enviando consulta…';
    status.dataset.state = 'sending';
  });
};

initHeader();
initHeroCopyWidths();
initReveals();
initParallax();
initServiceList();
initLightbox();
initForm();
