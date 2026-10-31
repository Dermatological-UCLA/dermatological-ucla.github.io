// Navigation, scroll reveals, and photo galleries.
(() => {
  'use strict';
  document.documentElement.classList.replace('no-js', 'js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header hairline once the page scrolls.
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile navigation.
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const setOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
  });
  matchMedia('(min-width: 981px)').addEventListener('change', e => { if (e.matches) setOpen(false); });

  // Gentle fade-up as sections enter the viewport.
  const revealer = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      revealer.unobserve(e.target);
    }
  }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealer.observe(el));

  // Horizontal photo galleries with previous/next controls.
  document.querySelectorAll('.gallery').forEach(gallery => {
    const track = gallery.querySelector('.gallery-track');
    const slides = [...track.children];
    const prev = gallery.querySelector('[data-dir="-1"]');
    const next = gallery.querySelector('[data-dir="1"]');

    const current = () => {
      const left = track.scrollLeft;
      let best = 0;
      slides.forEach((s, i) => {
        if (Math.abs(s.offsetLeft - left) < Math.abs(slides[best].offsetLeft - left)) best = i;
      });
      return best;
    };
    const update = () => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = atEnd;
    };
    const go = dir => {
      const i = Math.min(slides.length - 1, Math.max(0, current() + dir));
      track.scrollTo({ left: slides[i].offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    window.addEventListener('resize', update);
    update();
  });
})();
