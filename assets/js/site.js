// adeolakod.com
// Small bits of behaviour shared by every page: the interests carousel, the blur-in reveal,
// and prefetching the other pages so clicking around feels instant.

(function () {
  'use strict';

  var root = document.documentElement;

  // Email links marked to open in a new tab. Browsers that hand mailto: to Gmail in the browser
  // ignore target="_blank" and replace the site, so open the link in a new tab ourselves.
  document.querySelectorAll('a[href^="mailto:"][target="_blank"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener');
    });
  });

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


  // ---------- Project drawings ----------
  // They animate all the time; pause the ones that are off screen so phones don't burn battery.
  if ('IntersectionObserver' in window) {
    var figIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('paused', !e.isIntersecting); });
    });
    document.querySelectorAll('.fig').forEach(function (fig) { figIO.observe(fig); });
  }


  // ---------- Load the other pages before they're clicked ----------
  // Chrome, Edge, Android: speculation rules. The nav pages are fetched straight away, and whichever
  // link you hover (or start tapping) gets fully built in the background, so the click is instant.
  // Firefox only does <link rel="prefetch">. Safari does neither, so it gets a plain fetch that
  // leaves the pages in the cache.

  var conn = navigator.connection;
  var skipPreload = conn && (conn.saveData || /2g/.test(conn.effectiveType || ''));

  var navPages = [];
  document.querySelectorAll('.bar a[href^="/"]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href !== location.pathname && navPages.indexOf(href) < 0) navPages.push(href);
  });

  var hasSpeculation = window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules');

  // Prefetch every top-bar link straight away; fully build any on-site link on hover or tap,
  // except the PDFs and the page you're already on (marked aria-current).
  // This string must be the same on every page: the CSP allows it by its sha256 hash
  // ('inline-speculation-rules' gets ignored once a CSP has hashes). Change it, update the hash.
  var RULES = '{"prefetch":[{"where":{"selector_matches":".bar a:not([aria-current])"},"eagerness":"immediate"}],' +
    '"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/docs/*"}},{"not":{"selector_matches":"[aria-current]"}}]},"eagerness":"moderate"}]}';

  if (!skipPreload && hasSpeculation) {
    window.addEventListener('load', function () {
      var rules = document.createElement('script');
      rules.type = 'speculationrules';
      rules.textContent = RULES;
      document.head.appendChild(rules);
    });
  }

  function prefetchPages() {
    var probe = document.createElement('link');
    if (probe.relList && probe.relList.supports && probe.relList.supports('prefetch')) {
      navPages.forEach(function (href) {
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
      });
    } else if (window.fetch) {
      navPages.forEach(function (href) { fetch(href, { credentials: 'same-origin' }).catch(function () {}); });
    }
  }

  if (!skipPreload && !hasSpeculation) {
    window.addEventListener('load', function () {
      if ('requestIdleCallback' in window) requestIdleCallback(prefetchPages, { timeout: 2000 });
      else setTimeout(prefetchPages, 600);
    });
  }


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
      headDelay += 75;
      mark(el, headDelay + 120);
    });
  });

  // Then each section, staggering project cards individually
  document.querySelectorAll('main > section:not(.hero):not(.page-head)').forEach(function (sec) {
    // Sections already on screen start 0.3s in on the home page and 0.22s in elsewhere;
    // ones below the fold get no delay and reveal as they're scrolled to.
    var home = !!document.querySelector('.hero');
    var onScreen = sec.getBoundingClientRect().top < innerHeight;
    var base = onScreen ? (home ? 300 : 220) : 0;
    var step = home ? 60 : 75;
    Array.prototype.forEach.call(sec.children, function (el, i) {
      var cards = el.querySelectorAll(':scope > .project');
      if (cards.length) {
        Array.prototype.forEach.call(cards, function (card, j) { mark(card, base + j * (step + 10)); });
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

  // Wait for Geist so the headline doesn't reflow mid-animation, but never longer than 0.6s.
  function begin() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start);
      setTimeout(start, 600);
    } else {
      start();
    }
  }

  // If Chrome built this page ahead of time, hold the reveal until it's actually opened,
  // otherwise it plays out in the background and you'd land on a page that's already finished.
  if (document.prerendering) document.addEventListener('prerenderingchange', begin, { once: true });
  else begin();
})();
