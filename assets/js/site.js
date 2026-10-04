// adeolakod.com
// Small bits of behaviour shared by every page: the interests carousel, the blur-in reveal,
// and prefetching the other pages so clicking around feels instant.

(function () {
  'use strict';

  var root = document.documentElement;

  // ---------- Interests carousel (home page) ----------

  document.querySelectorAll('[data-carousel]').forEach(function (car) {
    var slides = Array.prototype.slice.call(car.querySelectorAll('.slide'));
    var live = car.querySelector('[aria-live]');
    var n = slides.length;
    var cur = 0;
    var lastPos = [];

    function offset() {
      return parseFloat(getComputedStyle(car).getPropertyValue('--off')) || 340;
    }

    // pos is -1 (left), 0 (centre), 1 (right) or 2 (parked out of sight behind the centre).
    function place(first) {
      slides.forEach(function (s, i) {
        var d = (i - cur + n) % n;
        var pos = d === 0 ? 0 : d === 1 ? 1 : d === n - 1 ? -1 : 2;

        // A slide wrapping from one side to the other shouldn't slide across the middle.
        var jumped = !first && lastPos[i] !== undefined && Math.abs(lastPos[i] - pos) > 1;
        if (jumped) s.classList.add('jump');

        s.style.setProperty('--x', (pos === 2 ? 0 : pos * offset()) + 'px');
        s.style.opacity = pos === 2 ? '0' : '';
        s.classList.toggle('center', pos === 0);
        s.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
        // orb.js skips drawing parked slides, no point rendering what nobody can see
        s.toggleAttribute('data-parked', pos === 2);

        if (jumped) { void s.offsetWidth; s.classList.remove('jump'); }
        lastPos[i] = pos;
      });
      if (live) live.textContent = slides[cur].querySelector('h3').textContent;
    }

    function go(step) {
      cur = (cur + step + n) % n;
      place(false);
    }

    car.querySelector('.prev').addEventListener('click', function () { go(-1); });
    car.querySelector('.next').addEventListener('click', function () { go(1); });

    slides.forEach(function (s, i) {
      s.addEventListener('click', function () {
        var d = (i - cur + n) % n;
        if (d === 1) go(1);
        else if (d === n - 1) go(-1);
      });
    });

    car.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
    });

    // Swipe on phones
    var startX = null;
    car.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    car.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    });

    window.addEventListener('resize', function () { place(true); });
    place(true);
  });


  // ---------- Prefetch the other pages ----------

  function prefetchPages() {
    var c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    var seen = {};
    document.querySelectorAll('.bar a[href^="/"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === location.pathname || seen[href]) return;
      seen[href] = true;
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  window.addEventListener('load', function () {
    if ('requestIdleCallback' in window) requestIdleCallback(prefetchPages, { timeout: 2000 });
    else setTimeout(prefetchPages, 1000);
  });


  // ---------- Blur-in reveal ----------
  // Style borrowed from linear.app. The inline script in <head> only adds the "js" class
  // when the visitor hasn't asked for reduced motion, so this all switches off in that case.

  if (!root.classList.contains('js')) return;

  // Split each headline into words so they can blur in one after another.
  // Built with DOM calls rather than innerHTML so it plays nicely with the CSP (no inline styles).
  document.querySelectorAll('main h1').forEach(function (h) {
    var text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.textContent = '';
    text.split(/\s+/).forEach(function (word, i) {
      if (i) h.appendChild(document.createTextNode(' '));
      var span = document.createElement('span');
      span.className = 'w';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--i', i);
      span.textContent = word;
      h.appendChild(span);
    });
  });

  var targets = [];
  var headDelay = 0;

  function mark(el, delay) {
    el.style.setProperty('--d', delay + 'ms');
    el.classList.add('blur-in', 'no-tr');
    targets.push(el);
  }

  // Header blocks come in right after the headline
  document.querySelectorAll('.hero > div, .page-head > *').forEach(function (box) {
    if (box.matches('h1')) return;
    var kids = box.querySelector('h1')
      ? Array.prototype.filter.call(box.children, function (c) { return c.tagName !== 'H1'; })
      : [box];
    kids.forEach(function (el) {
      headDelay += 120;
      mark(el, headDelay + 200);
    });
  });

  // Then each section, staggering project cards individually
  document.querySelectorAll('main > section:not(.hero):not(.page-head)').forEach(function (sec) {
    // Sections already on screen start 0.5s in on the home page and 0.35s in elsewhere;
    // ones below the fold get no delay and reveal as they're scrolled to.
    var home = !!document.querySelector('.hero');
    var onScreen = sec.getBoundingClientRect().top < innerHeight;
    var base = onScreen ? (home ? 500 : 350) : 0;
    var step = home ? 80 : 110;
    Array.prototype.forEach.call(sec.children, function (el, i) {
      var cards = el.querySelectorAll(':scope > .project');
      if (cards.length) {
        Array.prototype.forEach.call(cards, function (card, j) { mark(card, base + j * (step + 20)); });
      } else {
        mark(el, base + i * step);
      }
    });
  });

  // Hidden state is applied with transitions off, then switched back on,
  // otherwise everything visibly fades *out* first.
  void document.body.offsetHeight;
  targets.forEach(function (el) { el.classList.remove('no-tr'); });

  function show(el) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-in'); });
    });
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    root.classList.remove('wait');

    // Anything that is even partly on screen right now comes in straight away.
    // Waiting for the observer here made tall blocks near the bottom of the screen lag behind.
    var later = targets.filter(function (el) {
      if (el.getBoundingClientRect().top < innerHeight) { show(el); return false; }
      el.classList.add('quick');   // scroll reveals are shorter so they never feel like a wait
      return true;
    });

    // The rest start just *before* they scroll into view, so they're already arriving when you get there
    if (!('IntersectionObserver' in window)) { later.forEach(show); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px 25% 0px' });
    later.forEach(function (el) { io.observe(el); });
  }

  // Wait for Geist so the headline doesn't reflow mid-animation, but never longer than 1.2s.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
    setTimeout(start, 1200);
  } else {
    start();
  }
})();
