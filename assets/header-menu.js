(() => {
  const header = document.querySelector('.header-menu');
  const toggle = header.querySelector('.header-menu-toggle');
  const panel = document.getElementById(toggle.getAttribute('aria-controls'));
  const disc = header.querySelector('.header-menu-disc');
  const labels = header.querySelectorAll('.header-menu-label span');
  const lines = header.querySelectorAll('.header-menu-line');
  const core = header.querySelector('.header-menu-core');
  const links = Array.from(panel.querySelectorAll('a'));
  const page = document.querySelector('main');
  const skip = document.querySelector('.skip');
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const radius = { progress: 0 };
  let open = false;
  let bounds;

  function paintRadius() {
    panel.style.setProperty('--menu-radius', bounds.start + (bounds.end - bounds.start) * radius.progress + 'px');
  }

  function measure() {
    const box = disc.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    bounds = {
      start: box.width / 2,
      end: Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2
    };
    panel.style.setProperty('--menu-x', x + 'px');
    panel.style.setProperty('--menu-y', y + 'px');
    paintRadius();
  }

  function focusFirstLink() {
    if (open && document.activeElement === toggle) links[0].focus({ preventScroll: true });
  }

  const motion = window.gsap;
  const timeline = motion?.timeline({
    paused: true,
    onComplete: focusFirstLink,
    onReverseComplete() { panel.hidden = !open; }
  });
  timeline?.to(radius, { progress: 1, duration: .8, ease: 'expo.inOut', onUpdate: paintRadius }, 0)
    .to(core, { scale: 0, opacity: 0, duration: .18 }, .08)
    .fromTo(lines[0], { rotation: 0, scaleX: 0, opacity: 0 },
      { rotation: 45, scaleX: 1, opacity: 1, duration: .32, ease: 'back.out(1.5)' }, .22)
    .fromTo(lines[1], { rotation: 0, scaleX: 0, opacity: 0 },
      { rotation: -45, scaleX: 1, opacity: 1, duration: .32, ease: 'back.out(1.5)' }, .22)
    .to(labels, { yPercent: -100, duration: .34, ease: 'power3.inOut' }, .13)
    .fromTo(links, { yPercent: 85, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: .46, stagger: .046, ease: 'power3.out' }, .36);

  function setOpen(value, restoreFocus = true) {
    if (open === value) return;
    open = value;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    page.inert = open;
    skip.inert = open;
    panel.inert = !open;
    root.classList.toggle('header-menu-locked', open);
    if (open) {
      panel.hidden = false;
      panel.scrollTop = 0;
      measure();
    } else if (restoreFocus) {
      toggle.focus({ preventScroll: true });
    }

    if (!timeline || reducedMotion.matches) {
      timeline?.pause().progress(open ? 1 : 0);
      radius.progress = Number(open);
      paintRadius();
      header.classList.toggle('header-menu-instant', open && !timeline);
      panel.hidden = !open;
      if (open) focusFirstLink();
    } else if (open) {
      timeline.timeScale(1).play();
    } else if (timeline.progress() > 0) {
      timeline.timeScale(1.35).reverse();
    } else {
      timeline.pause();
      panel.hidden = true;
    }
  }

  toggle.addEventListener('click', () => setOpen(!open));
  panel.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (event.target.closest('a[href^="#"]')) setOpen(false, false);
  });
  if (motion && matchMedia('(pointer: fine)').matches) {
    const xTo = motion.quickTo(disc, 'x', { duration: .32, ease: 'power3.out', onUpdate: measure });
    const yTo = motion.quickTo(disc, 'y', { duration: .32, ease: 'power3.out', onUpdate: measure });
    disc.addEventListener('pointermove', event => {
      if (open || reducedMotion.matches) return;
      const box = disc.getBoundingClientRect();
      const x = box.left + box.width / 2 - motion.getProperty(disc, 'x');
      const y = box.top + box.height / 2 - motion.getProperty(disc, 'y');
      xTo((event.clientX - x) * .28);
      yTo((event.clientY - y) * .28);
    });
    disc.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  }
  window.addEventListener('resize', measure);
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      const first = toggle;
      const last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  measure();
})();
