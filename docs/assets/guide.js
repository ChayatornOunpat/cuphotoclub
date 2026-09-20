/* CU Photo Club admin guide — shared behaviour for every page.
   Loaded with a plain <script src>, no build step, no dependencies. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* localStorage throws outright in private mode and wherever site data is
     blocked. Remembering a preference is a convenience, never a requirement,
     so both accessors swallow that and the guide carries on with defaults. */
  function saveSetting(key, value) {
    try { localStorage.setItem(key, value); } catch { return; }
  }
  function readSetting(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  /* ── language ───────────────────────────────────────────────
     Both languages are in the markup; a class on <html> hides one. */
  var langBtn = document.getElementById('lang');

  function setLang(l, remember) {
    root.classList.toggle('lang-th', l === 'th');
    root.classList.toggle('lang-en', l !== 'th');
    root.setAttribute('lang', l === 'th' ? 'th' : 'en');
    if (langBtn) {
      langBtn.textContent = l === 'th' ? 'EN' : 'ไทย';
      langBtn.setAttribute('aria-pressed', l === 'th' ? 'true' : 'false');
    }
    var q = document.getElementById('q');
    if (q) q.placeholder = q.getAttribute('data-ph-' + (l === 'th' ? 'th' : 'en'));
    if (remember) saveSetting('cu-lang', l);
  }

  var startLang = 'en';
  var urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang === 'th' || urlLang === 'en') {
    startLang = urlLang;
  } else {
    var stored = readSetting('cu-lang');
    if (stored) startLang = stored;
    else if ((navigator.language || '').toLowerCase().indexOf('th') === 0) startLang = 'th';
  }
  setLang(startLang, false);

  if (langBtn) {
    langBtn.addEventListener('click', function () {
      setLang(root.classList.contains('lang-th') ? 'en' : 'th', true);
    });
  }

  /* Carry the chosen language across internal links, so a Thai reader
     following the directory does not land back in English. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !root.classList.contains('lang-th')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(https?:|mailto:)/.test(href)) return;
    if (href.indexOf('lang=') === -1) {
      a.setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'lang=th');
    }
  }, true);

  /* ── theme ──────────────────────────────────────────────────── */
  var themeBtn = document.getElementById('theme');
  var storedTheme = readSetting('cu-theme');
  if (storedTheme) root.setAttribute('data-theme', storedTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark'
        || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme:dark)').matches);
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      saveSetting('cu-theme', next);
    });
  }

  /* ── directory filter (index only) ──────────────────────────── */
  var q = document.getElementById('q');
  if (q) {
    var cards = [].slice.call(document.querySelectorAll('.card'));
    var groups = [].slice.call(document.querySelectorAll('.dirgroup'));
    var empty = document.getElementById('searchEmpty');

    cards.forEach(function (c) {
      c.dataset.hay = (c.textContent + ' ' + (c.dataset.keys || ''))
        .toLowerCase().replace(/\s+/g, ' ');
    });

    function filter() {
      var term = q.value.trim().toLowerCase();
      var hits = 0;
      cards.forEach(function (c) {
        var match = !term || c.dataset.hay.indexOf(term) !== -1;
        c.classList.toggle('hidden', !match);
        if (match) hits++;
      });
      /* Hide a group heading and its grid when nothing under it survives. */
      groups.forEach(function (g) {
        var grid = g.nextElementSibling;
        var any = grid && [].slice.call(grid.querySelectorAll('.card'))
          .some(function (c) { return !c.classList.contains('hidden'); });
        g.classList.toggle('hidden', !any);
        if (grid) grid.classList.toggle('hidden', !any);
      });
      if (empty) empty.classList.toggle('show', hits === 0);
    }

    q.addEventListener('input', filter);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { q.value = ''; filter(); q.blur(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
        e.preventDefault();
        q.focus();
      }
    });
  }

  /* ── on-this-page highlight + back to top ───────────────────
     Plain scroll maths rather than IntersectionObserver: with IO and a
     rootMargin band, a fast scroll or a section shorter than the band can
     leave nothing highlighted. Walking a handful of sections is cheap
     once throttled to a frame. */
  var tocLinks = [].slice.call(document.querySelectorAll('.toc a'));
  var sections = [].slice.call(document.querySelectorAll('section[id]'));
  var totop = document.getElementById('totop');
  var byId = {};
  tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var ticking = false;

  function scrollPos() {
    return window.pageYOffset || root.scrollTop || 0;
  }

  function update() {
    ticking = false;
    var top = scrollPos();

    if (tocLinks.length && sections.length) {
      var probe = top + 90;               /* just under the sticky header */
      var current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top + top <= probe) current = sections[i];
        else break;
      }
      /* At the very bottom the last section may never clear the probe line. */
      if (top + window.innerHeight >= root.scrollHeight - 4) {
        current = sections[sections.length - 1];
      }
      tocLinks.forEach(function (a) { a.classList.remove('active'); });
      var hit = current && byId[current.id];
      if (hit) hit.classList.add('active');
    }

    if (totop) totop.classList.toggle('show', top > 500);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  if (totop) {
    totop.addEventListener('click', function () {
      scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
