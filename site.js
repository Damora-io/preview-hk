/* Damora Scroll Film starter: the page's own small interactions (the film itself is film-engine.js).
   Works on film pages and on secondary pages (page.html, 404.html); each part runs only if its markup is there. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // theme toggle: follows the phone until the visitor picks
  const t = $('.theme');
  if (t) t.addEventListener('click', () => {
    const r = document.documentElement;
    const cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    r.setAttribute('data-theme', next);
    try { localStorage.setItem('sf-theme', next); } catch (e) {}
  });

  // header: clear over the hero, solid once the hero lets go (the engine says where that is). Film pages only: a
  // secondary page ships <header class="top solid"> and keeps it.
  const top = $('.top');
  if (top && $('[data-film]')) {
    let heroEnd = (window.ScrollFilm && window.ScrollFilm.heroEnd) || innerHeight;
    const ui = () => top.classList.toggle('solid', scrollY > heroEnd - 40);
    addEventListener('scrollfilm', (e) => { heroEnd = e.detail.heroEnd; ui(); });
    addEventListener('scroll', ui, { passive: true }); ui();
  }

  // reveals: one short move per block, finished while it is on screen
  const els = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    els.forEach((e) => io.observe(e));
  }

  // card strip (optional): whole cards, one per step on phones, a counter, buttons that grey out at the ends
  const strip = $('.strip');
  if (strip) {
    const figs = $$('figure', strip), atEl = $('[data-strip-at]'), nEl = $('[data-strip-n]');
    const prev = $('[data-strip="-1"]'), next = $('[data-strip="1"]');
    if (nEl) nEl.textContent = figs.length;
    const padL = () => parseFloat(getComputedStyle(strip).paddingLeft || 0);
    const at = () => {
      const left = strip.getBoundingClientRect().left + padL();
      let best = 0, bd = 1e9;
      figs.forEach((f, i) => { const d = Math.abs(f.getBoundingClientRect().left - left); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const update = () => {
      if (atEl) atEl.textContent = at() + 1;
      if (prev) prev.setAttribute('aria-disabled', strip.scrollLeft < 4 ? 'true' : 'false');
      if (next) next.setAttribute('aria-disabled', strip.scrollLeft > strip.scrollWidth - strip.clientWidth - 4 ? 'true' : 'false');
    };
    let su = 0;
    strip.addEventListener('scroll', () => { if (!su) su = requestAnimationFrame(() => { su = 0; update(); }); }, { passive: true });
    [prev, next].forEach((b) => b && b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      const f = figs[Math.max(0, Math.min(figs.length - 1, at() + (+b.dataset.strip)))];
      strip.scrollBy({ left: f.getBoundingClientRect().left - strip.getBoundingClientRect().left - padL(), behavior: reduce ? 'auto' : 'smooth' });
    }));
    addEventListener('resize', update);
    update();
  }
})();
