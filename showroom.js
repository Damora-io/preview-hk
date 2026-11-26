/* HKDIAMONDZ & CO showroom: in-stock cards from inventory.json, and the inquiry-to-viewing form.
   No data lost (references/rules/no-data-lost.md): every answer is saved the moment it is given (this device first,
   then the back end at /api/inquiry), skipped fields go as explicit values, and the visitor sees "received" only when
   the back end answered "saved". With no back end (a static preview) the form says so plainly. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gem = '<svg viewBox="0 0 200 170" aria-hidden="true"><use href="#gem"/></svg>';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.dataLayer = window.dataLayer || [];

  /* ---------- IN STOCK ---------- */
  const grid = $('[data-pieces]');
  let rows = [];
  const card = (p) => {
    const ph = p.placeholder;
    const v = (x, fallback) => (x == null || x === '' ? '<span class="tbc">' + fallback + '</span>' : esc(x));
    return '<article class="piece" data-cat="' + esc(p.category) + '">' +
      '<div class="ph">' + (ph ? '<span class="tag">Placeholder</span>' : '') + gem +
      (ph ? '<span class="yp">Your piece here</span>' : '') + '</div>' +
      '<div class="bd"><h3>' + esc(p.piece) + '</h3><dl>' +
      '<dt>Stone</dt><dd>' + v(p.stone_type, 'Natural / lab-grown / moissanite') + '</dd>' +
      '<dt>Metal</dt><dd>' + v(p.karat ? p.karat + 'K ' + p.metal : (ph ? null : p.metal), 'Metal and karat') + '</dd>' +
      '<dt>Weight</dt><dd>' + v(p.grams ? p.grams + ' g' : null, 'Gram weight') + '</dd>' +
      '<dt>Certificate</dt><dd>' + v(p.certificate, 'GIA / IGI where there is one') + '</dd>' +
      '<dt>Price</dt><dd>' + esc(p.price || 'On request') + '</dd>' +
      (p.brand_note ? '<dt>Note</dt><dd>' + esc(p.brand_note) + '</dd>' : '') +
      '</dl><button type="button" class="ask" data-ask="' + esc(p.id) + '">Ask about this piece</button></div></article>';
  };
  const show = (cat) => {
    $$('.tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === cat ? 'true' : 'false'));
    $$('.piece', grid).forEach((el) => { el.hidden = !(cat === 'all' || el.dataset.cat === cat); });
  };
  if (grid) {
    fetch('inventory.json', { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
      rows = (d.pieces || []).filter((p) => p.status !== 'sold' && (p.placeholder || p.stone_type));
      grid.innerHTML = rows.map(card).join('');
    }).catch(() => { grid.innerHTML = '<p class="note">The pieces could not load. Refresh to try again.</p>'; });
    $$('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.cat)));
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ask]'); if (!b) return;
      const p = rows.find((r) => r.id === b.dataset.ask); if (!p) return;
      askAbout(p);
    });
  }

  /* ---------- THE INQUIRY ---------- */
  const form = $('[data-inquiry]');
  if (!form) return;
  const KEY = 'hk-inq', IDK = 'hk-inq-id';
  const API = 'api/inquiry', PHOTO = 'api/photo';
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { const pn = $('[data-preview-note]'); if (pn) pn.hidden = false; }
  const steps = $$('[data-step]', form), dots = $$('[data-dot]', form);
  const next = $('[data-next]', form), back = $('[data-back]', form), saved = $('[data-saved]', form);
  const done = $('[data-done]', form), nav = $('[data-inq-nav]', form);
  let step = 1, photos = [], backend = null; // backend: null unknown, true answered saved, false not reachable
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let id = read(IDK); if (!id) { id = uid(); store(IDK, id); }

  const EXPLICIT = { want: 'Not chosen', piece: 'None', piece_type: 'Not chosen', metal: 'Not chosen', stone: 'Not chosen', budget: 'Not chosen',
    needed_by: 'Flexible', occasion: 'Not given', notes: 'Not given', name: 'Not given', phone: 'Not given', instagram: 'Not given',
    email: 'Not given', channel: 'Not chosen', vip: 'No', viewing: 'Not chosen', view_day: 'Flexible', view_time: 'Not chosen' };
  const values = () => {
    const out = {};
    Object.keys(EXPLICIT).forEach((k) => {
      const els = $$('[name="' + k + '"]', form);
      let v = '';
      els.forEach((el) => { if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked) v = el.value; } else v = el.value.trim(); });
      out[k] = v || EXPLICIT[k];
    });
    out.photos = photos.length ? photos.join(', ') : 'None';
    return out;
  };
  const restore = () => {
    let s = null; try { s = JSON.parse(read(KEY) || 'null'); } catch (e) {}
    if (!s || !s.f) return;
    Object.entries(s.f).forEach(([k, v]) => {
      $$('[name="' + k + '"]', form).forEach((el) => {
        if (el.type === 'file') return;
        if (el.type === 'radio' || el.type === 'checkbox') el.checked = el.value === v;
        else if (v !== EXPLICIT[k]) el.value = v;
      });
    });
    if (s.f.piece && s.f.piece !== 'None') $('[data-piece-row]', form).hidden = false;
    photos = (s.photos || []);
  };

  let timer = 0, inflight = null;
  const send = (status) => {
    const body = { id, step, status, fields: values(), page: location.pathname, at: new Date().toISOString() };
    store(KEY, JSON.stringify({ f: body.fields, photos, step }));
    window.dataLayer.push(Object.assign({ event: status === 'submitted' ? 'inquiry_submit' : 'inquiry_step', inquiry_step: step }, body.fields));
    inflight = fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j) => { backend = !!(j && j.saved); saved.textContent = backend ? 'Saved' : 'Saved on this device'; return backend; })
      .catch(() => { backend = false; saved.textContent = 'Saved on this device'; return false; });
    return inflight;
  };
  const soon = () => { clearTimeout(timer); saved.textContent = 'Saving…'; timer = setTimeout(() => send('partial'), 600); };
  form.addEventListener('change', (e) => { if (e.target.type !== 'file') soon(); });
  form.addEventListener('input', (e) => { if (e.target.matches('input[type="text"], input[type="tel"], input[type="email"], textarea')) soon(); });

  // reference photos: shrunk on the device, then saved with the inquiry the moment they are picked
  const shrink = (file) => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
  const fileIn = $('input[type="file"]', form), pnote = $('[data-photo-note]', form);
  if (fileIn) fileIn.addEventListener('change', async () => {
    const files = [...fileIn.files].slice(0, 3);
    if (!files.length) return;
    pnote.textContent = 'Saving ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…';
    let ok = 0, local = 0;
    for (const f of files) {
      try {
        const data = await shrink(f);
        const r = await fetch(PHOTO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: f.name, data }) });
        const j = r.ok ? await r.json() : null;
        if (j && j.saved) { photos.push(j.file); ok++; } else { photos.push(f.name + ' (not uploaded)'); local++; }
      } catch (e) { photos.push(f.name + ' (not uploaded)'); local++; }
    }
    pnote.textContent = local ? 'Preview: ' + local + ' photo' + (local > 1 ? 's' : '') + ' noted but not uploaded (no back end here).' : ok + ' photo' + (ok > 1 ? 's' : '') + ' saved.';
    send('partial');
  });

  const go = (n) => {
    step = n;
    steps.forEach((s) => { s.hidden = +s.dataset.step !== n; });
    dots.forEach((d) => { const k = +d.dataset.dot; d.classList.toggle('on', k === n); d.classList.toggle('done', k < n); });
    back.hidden = n === 1;
    next.textContent = n === 4 ? 'Request my viewing' : 'Next';
  };
  const check = (n) => {
    const f = values(), err = $('[data-err="' + n + '"]', form);
    let msg = '';
    if (n === 3) {
      if (f.name === 'Not given') msg = 'Add your name so HK knows who to ask for.';
      else if (f.phone === 'Not given' && f.instagram === 'Not given' && f.email === 'Not given') msg = 'Add a phone, an Instagram handle or an email so HK can reach you.';
    }
    if (n === 4 && f.viewing === 'Not chosen') msg = 'Choose in person or a video call.';
    if (err) err.textContent = msg;
    return !msg;
  };
  next.addEventListener('click', async () => {
    if (!check(step)) return;
    clearTimeout(timer);
    if (step < 4) { send('partial'); go(step + 1); $('legend', steps[step - 1]).scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); return; }
    next.disabled = true; next.textContent = 'Sending…';
    const ok = await send('submitted');
    steps.forEach((s) => { s.hidden = true; }); nav.hidden = true; done.hidden = false;
    $('[data-done-msg]', form).textContent = ok
      ? 'HK will confirm your viewing by your chosen channel. Reference ' + id.slice(0, 8).toUpperCase() + '.'
      : 'Preview mode: your request is saved on this device only and has not been sent. On the live site HK gets a text and an email with every answer.';
    done.focus();
    store(IDK, null); store(KEY, null); id = uid(); store(IDK, id);
  });
  back.addEventListener('click', () => go(Math.max(1, step - 1)));

  function askAbout(p) {
    const r = $('input[name="want"][value="In-stock piece"]', form); if (r) r.checked = true;
    const pf = $('input[name="piece"]', form); pf.value = p.piece + (p.placeholder ? ' (placeholder card ' + p.id + ')' : ' (' + p.id + ')');
    $('[data-piece-row]', form).hidden = false;
    go(1); send('partial');
    const a = document.getElementById('book'); if (a) a.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  restore();
  go(1);
})();
