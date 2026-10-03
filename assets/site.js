(function () {
  document.querySelectorAll('[data-carousel]').forEach(function (car) {
    var slides = Array.prototype.slice.call(car.querySelectorAll('.slide'));
    var n = slides.length, cur = 0, prevOff = [];
    var live = car.querySelector('[aria-live]');
    function off() { return parseFloat(getComputedStyle(car).getPropertyValue('--off')) || 340; }
    function place(first) {
      slides.forEach(function (s, i) {
        var d = (i - cur + n) % n;
        var pos = d === 0 ? 0 : (d === 1 ? 1 : (d === n - 1 ? -1 : 2));
        var jumped = !first && prevOff[i] !== undefined && Math.abs(prevOff[i] - pos) > 1;
        if (jumped) s.classList.add('jump');
        s.style.setProperty('--x', (pos === 2 ? 0 : pos * off()) + 'px');
        s.style.opacity = pos === 2 ? '0' : '';
        s.classList.toggle('center', pos === 0);
        s.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
        if (jumped) { void s.offsetWidth; s.classList.remove('jump'); }
        prevOff[i] = pos;
      });
      if (live) live.textContent = slides[cur].querySelector('h3').textContent;
    }
    function go(step) { cur = (cur + step + n) % n; place(false); }
    car.querySelector('.prev').addEventListener('click', function () { go(-1); });
    car.querySelector('.next').addEventListener('click', function () { go(1); });
    slides.forEach(function (s, i) { s.addEventListener('click', function () { var d = (i - cur + n) % n; if (d === 1) go(1); else if (d === n - 1) go(-1); }); });
    car.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); } if (e.key === 'ArrowRight') { go(1); e.preventDefault(); } });
    var sx = null;
    car.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    car.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
    window.addEventListener('resize', function () { place(true); });
    place(true);
  });
})();

(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var root = document.documentElement; root.classList.add('js', 'wait');
  document.querySelectorAll('main h1').forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w, i) { return '<span class="w" aria-hidden="true" style="--i:' + i + '">' + w.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>'; }).join(' ');
  });
  var targets = [];
  var headDelay = 0;
  document.querySelectorAll('.hero > div, .page-head > *').forEach(function (box) {
    var kids = box.matches('h1') ? [] : (box.querySelector('h1') ? Array.prototype.filter.call(box.children, function (c) { return c.tagName !== 'H1'; }) : [box]);
    kids.forEach(function (el) { headDelay += 120; el.style.setProperty('--d', (headDelay + 200) + 'ms'); el.classList.add('blur-in', 'no-tr'); targets.push(el); });
  });
  document.querySelectorAll('main > section:not(.hero):not(.page-head)').forEach(function (sec) {
    var base = sec.getBoundingClientRect().top < innerHeight ? headDelay + 450 : 0;
    Array.prototype.forEach.call(sec.children, function (el, n) {
      if (!el.querySelector(':scope > .project')) el.style.setProperty('--d', (base + n * 90) + 'ms');
      var items = el.querySelectorAll(':scope > .project');
      if (items.length) {
        Array.prototype.forEach.call(items, function (it, i) { it.style.setProperty('--d', (base + i * 110) + 'ms'); it.classList.add('blur-in', 'no-tr'); targets.push(it); });
      } else { el.classList.add('blur-in', 'no-tr'); targets.push(el); }
    });
  });
  function show(el) { requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-in'); }); }); }
  void document.body.offsetHeight;
  targets.forEach(function (el) { el.classList.remove('no-tr'); });
  function start() {
  if (start.done) return; start.done = true;
  root.classList.remove('wait');
  if (!('IntersectionObserver' in window)) { targets.forEach(show); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(function (el) { io.observe(el); });
  setTimeout(function () { targets.forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) show(el); }); }, 1500);
  }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(start); setTimeout(start, 1200); } else { start(); }
})();
