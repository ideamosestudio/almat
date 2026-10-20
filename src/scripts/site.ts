const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initSmoothWheel = () => {
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let target = window.scrollY;
  let written = window.scrollY;
  let previousTime = 0;
  let direction = 0;
  const cancel = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    target = written = window.scrollY;
    direction = 0;
  };
  const blocked = () => !desktop.matches || reduced.matches
    || document.body.matches('.menu-is-open, .dialog-open')
    || !!document.querySelector('dialog[open]');
  const animate = (time: number) => {
    if (blocked() || Math.abs(window.scrollY - written) > 2) { cancel(); return; }
    const elapsed = Math.min(time - previousTime, 32);
    previousTime = time;
    const remaining = target - window.scrollY;
    const next = Math.abs(remaining) < 1.5
      ? target
      : window.scrollY + Math.sign(remaining) * Math.max(.5, Math.abs(remaining) * (1 - Math.exp(-elapsed / 140)));
    window.scrollTo({ top: next, behavior: 'instant' });
    written = window.scrollY;
    if (Math.abs(target - written) < 1.5) { cancel(); return; }
    frame = requestAnimationFrame(animate);
  };
  window.addEventListener('wheel', (event) => {
    if (blocked() || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey
      || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) {
      cancel(); return;
    }
    // Native scrolling for form controls and independently scrollable content.
    for (const node of event.composedPath()) {
      if (!(node instanceof HTMLElement) || node === document.body || node === document.documentElement) continue;
      if (node.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-menu]')) {
        cancel(); return;
      }
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) {
        cancel(); return;
      }
    }
    // Small, high-resolution trackpad gestures already provide smooth native motion.
    if (event.deltaMode === 0 && Math.abs(event.deltaY) < 40) { cancel(); return; }
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const sign = Math.sign(event.deltaY);
    if ((window.scrollY <= 0 && sign < 0) || (window.scrollY >= max && sign > 0)) { cancel(); return; }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const delta = sign * Math.min(Math.abs(event.deltaY) * unit * .55, 160);
    if (!frame || sign !== direction) target = window.scrollY;
    direction = sign;
    const backlog = Math.min(420, window.innerHeight * .6);
    target = Math.max(0, Math.min(max, window.scrollY + Math.max(-backlog, Math.min(backlog, target + delta - window.scrollY))));
    event.preventDefault();
    if (!frame) {
      written = window.scrollY;
      previousTime = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }, { passive: false });
  for (const event of ['pointerdown', 'touchstart', 'keydown', 'focusin', 'hashchange', 'resize']) {
    window.addEventListener(event, cancel, { passive: true });
  }
  document.addEventListener('visibilitychange', cancel);
  desktop.addEventListener('change', cancel);
  reduced.addEventListener('change', cancel);
};

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
    if (event.key === 'Tab' && toggle.getAttribute('aria-expanded') === 'true') {
      const focusable = [toggle, ...menu.querySelectorAll<HTMLAnchorElement>('a[href]')];
      const current = focusable.indexOf(document.activeElement as HTMLButtonElement);
      if (event.shiftKey && current <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && (current === -1 || current === focusable.length - 1)) {
        event.preventDefault();
        toggle.focus();
      }
    }
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (event) => {
    if (event.matches) setMenu(false);
  });
};

const initHeroCopyWidths = () => {
  const heroes = Array.from(document.querySelectorAll<HTMLElement>('.page-hero, .home-hero'));
  if (!heroes.length) return;

  const sync = () => {
    const measurements = heroes.map((hero) => {
      const title = hero.querySelector<HTMLElement>('[data-hero-title]');
      const intro = hero.querySelector<HTMLElement>('[data-hero-intro]');
      if (!title || !intro) return null;
      const range = document.createRange();
      range.selectNodeContents(title);
      const widestTitleLine = Math.max(...Array.from(range.getClientRects(), (rect) => rect.width));
      return { intro, width: Math.ceil(widestTitleLine) };
    });
    measurements.forEach((item) => item?.intro.style.setProperty('--hero-title-line-width', `${item.width}px`));
  };

  document.fonts.ready.then(sync);
  let pending = false;
  window.addEventListener('resize', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { sync(); pending = false; });
  }, { passive: true });
};

const initReveals = () => {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal], .reveal-up');
  const titles = document.querySelectorAll<HTMLElement>('.reveal-title');
  if (prefersReduced) {
    targets.forEach((target) => target.classList.add('is-visible'));
    titles.forEach((title) => title.classList.add('is-visible'));
    return;
  }
  // Visible-by-default HTML: no JS failure can hide the page. Preserve reveals
  // below the fold without delaying the hero's first meaningful paint.
  [...targets, ...titles].forEach((element) => {
    if (element.getBoundingClientRect().top < window.innerHeight) {
      element.classList.add('is-visible');
    } else {
      element.classList.add('will-reveal');
    }
  });
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
  const visible = new Set<HTMLElement>();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
      else visible.delete(entry.target as HTMLElement);
    });
  }, { rootMargin: '100px' });
  images.forEach((image) => observer.observe(image));
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    const positions = [...visible].map((image) => {
      const rect = image.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      return { image, offset: progress * -22 };
    });
    positions.forEach(({ image, offset }) => image.style.setProperty('--parallax-y', `${offset}px`));
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

const initCountUps = () => {
  document.querySelectorAll<HTMLElement>('[data-count-up]').forEach((counter) => {
    const target = Number(counter.dataset.countUp);
    const milestone = counter.closest<HTMLElement>('.trust__milestone');
    if (!Number.isFinite(target) || !milestone) return;

    const complete = () => {
      counter.textContent = String(target);
      milestone.classList.add('is-counted');
    };

    if (prefersReduced) {
      complete();
      return;
    }

    counter.textContent = '0';
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const startedAt = performance.now();
      const duration = 1600;
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
        else complete();
      };
      requestAnimationFrame(tick);
    }, { threshold: .45 });
    observer.observe(milestone);
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
  document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach((form) => {
    const status = form.querySelector<HTMLElement>('[data-form-status]')!;
    const fields = form.querySelector<HTMLElement>('[data-form-fields]')!;
    const success = form.querySelector<HTMLElement>('[data-form-success]')!;
    form.querySelector('[data-form-again]')?.addEventListener('click', () => {
      success.hidden = true;
      fields.hidden = false;
      status.classList.remove('sr-only');
      status.textContent = '';
      delete status.dataset.state;
      form.querySelector<HTMLInputElement>('[name="nombre"]')?.focus();
    });
    let sending = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (sending) return;
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
      sending = true;
      form.setAttribute('aria-busy', 'true');
      const button = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
      button.disabled = true;
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          credentials: 'omit',
          signal: AbortSignal.timeout(30000),
        });
        if (!response.headers.get('content-type')?.includes('application/json')) throw new TypeError('Unexpected response');
        const result = await response.json();
        if (!response.ok || result?.ok !== true) {
          const message = response.status === 429
            ? 'Recibimos varias consultas. Intentá más tarde o escribinos por WhatsApp.'
            : response.status === 422
              ? 'Revisá los datos ingresados antes de enviar.'
              : 'No pudimos enviar tu consulta. Intentá más tarde o escribinos por WhatsApp.';
          throw new Error(message);
        }
        status.textContent = 'Gracias. Tu consulta fue enviada correctamente.';
        status.dataset.state = 'success';
        status.classList.add('sr-only');
        form.reset();
        form.classList.remove('was-validated');
        fields.hidden = true;
        success.hidden = false;
        success.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
        success.scrollIntoView({ behavior: prefersReduced ? 'instant' : 'smooth', block: 'center' });
      } catch (error) {
        status.textContent = error instanceof Error && error.name === 'Error'
          ? error.message
          : 'No pudimos confirmar el envío. Intentá más tarde o escribinos por WhatsApp.';
        status.dataset.state = 'error';
      } finally {
        sending = false;
        form.removeAttribute('aria-busy');
        button.disabled = false;
      }
    });
  });
};

const initFooterNavigation = () => {
  const toggle = document.querySelector<HTMLButtonElement>('[data-footer-toggle]');
  const nav = document.querySelector<HTMLElement>('#footer-navigation');
  if (!toggle || !nav) return;
  const close = () => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  window.matchMedia('(max-width: 600px)').addEventListener('change', close);
};

initHeader();
initSmoothWheel();
initFooterNavigation();
initHeroCopyWidths();
initReveals();
initParallax();
initCountUps();
initLightbox();
initForm();
