// adeolakod.com
// The orbs on the home page. Each <canvas class="orb" data-colors="a,b,c,d,e"> gets its own small
// WebGL shader. The colour is a slowly folding, silky liquid made with domain-warped noise
// (noise fed back into itself, so shapes stretch and fold like thick paint), seen on a ball that
// curves away at the edges, with soft shading and a film grain. Inspired by the orbs on elevenlabs.io.

(function () {
  'use strict';

  var VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

  var FRAGMENT = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec3 c1, c2, c3, c4, c5;   // main, second, deep, accent, light

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);   // quintic: no creases in the folds
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * noise(p); p = ROT * p * 2.02; a *= 0.5; }
      return v / 0.875;
    }

    void main() {
      float S = min(uRes.x, uRes.y);
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / S;    // -1..1 across the canvas

      float R = 0.95;
      vec2 n = uv / R;
      float r = length(n);
      float px = 2.0 / (S * R);
      float alpha = 1.0 - smoothstep(1.0 - 1.5 * px, 1.0, r);
      if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
      float z = sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0)));

      // The surface bends away at the edge, so the liquid seems to wrap round a ball
      vec2 p = n * (1.0 + 0.45 * (1.0 - z)) * 0.6;
      float t = uTime * 0.16;

      // Domain warping: each layer of noise bends the next, which gives slow, folding,
      // viscous shapes instead of smooth bands
      vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + vec2(0.30, 0.10) * t),
                    fbm(p + vec2(5.2, 1.3) - vec2(0.12, 0.25) * t));
      vec2 w = vec2(fbm(p + 1.8 * q + vec2(1.7, 9.2) + 0.35 * t),
                    fbm(p + 1.8 * q + vec2(8.3, 2.8) - 0.30 * t));
      float f = fbm(p + 1.6 * w);
      float g = fbm(p + 1.6 * w + vec2(0.07, 0.07));   // a step away, for the sheen on the folds

      // Two or three colours carry the ball; the deep, accent and light ones only touch it
      vec3 col = mix(c1, c2, smoothstep(0.36, 0.60, f));
      col = mix(col, c3, smoothstep(0.55, 1.05, length(q) * f * 1.6) * 0.75);
      col = mix(col, c4, smoothstep(0.58, 0.90, w.x) * 0.5);
      col = mix(col, c5, smoothstep(0.62, 0.95, w.y) * 0.40);

      // Silk-like light and shadow along the folds of the liquid
      col *= 1.0 + clamp((g - f) * 4.0, -0.16, 0.16);

      // Soft shading: a little light from the top left, darker as the ball turns away
      col *= 0.80 + 0.20 * z;
      col *= 1.0 - 0.16 * smoothstep(0.2, 1.0, r) * clamp(0.5 - 0.6 * n.y + 0.3 * n.x, 0.0, 1.0);
      col += 0.05 * smoothstep(0.9, 0.0, length(n - vec2(-0.45, 0.5)));

      col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.11;   // film grain
      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col * alpha, alpha);
    }
  `;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hexToRgb(h) {
    h = h.trim().replace('#', '');
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; });
  }

  // No WebGL (old phones, some locked-down browsers): fall back to a plain CSS gradient.
  function fallback(canvas, cols) {
    var div = document.createElement('div');
    div.className = canvas.className + ' ready';
    div.style.background = 'radial-gradient(circle at 38% 32%, ' + (cols[4] || cols[0]) + ' 0, ' + cols[0] + ' 35%, ' + cols[1] + ' 75%, ' + cols[2] + ' 100%)';
    div.style.borderRadius = '50%';
    canvas.replaceWith(div);
  }

  function start(canvas) {
    var cols = (canvas.getAttribute('data-colors') || '#FF9A3D,#4FA65A,#1E4A5C,#B8461F,#FFE2B8').split(',');
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) { fallback(canvas, cols); return; }

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback(canvas, cols); return; }
    gl.useProgram(prog);

    // One quad covering the whole canvas
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(function (name, i) {
      var v = hexToRgb(cols[i] || cols[0]);
      gl.uniform3f(gl.getUniformLocation(prog, name), v[0], v[1], v[2]);
    });

    var slide = canvas.closest('.slide');
    var seed = Math.random() * 100;   // so the orbs aren't all in step
    var onScreen = true;
    var raf = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
      }
    }

    function draw(ms) {
      gl.uniform1f(uTime, seed + (reduceMotion ? 0 : ms / 1000));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function loop(ms) {
      if (!onScreen) return;
      if (!(slide && slide.hasAttribute('data-parked'))) draw(ms);
      raf = requestAnimationFrame(loop);
    }

    resize();
    draw(0);
    canvas.classList.add('ready');   // fades in (see .orb in site.css)

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { resize(); draw(performance.now()); }).observe(canvas);
    }
    if (reduceMotion) return;   // one still frame is enough

    // Only animate while the carousel is actually on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        cancelAnimationFrame(raf);
        if (onScreen) raf = requestAnimationFrame(loop);
      }).observe(canvas);
    } else {
      raf = requestAnimationFrame(loop);
    }
  }

  // Start each orb as soon as this script runs (it's deferred, so the page is already parsed),
  // but only once the carousel is near the screen. On phones it starts below the fold.
  function whenNear(canvas) {
    if (!('IntersectionObserver' in window)) { start(canvas); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); start(canvas); }
    }, { rootMargin: '400px 0px' });
    io.observe(canvas);
  }

  document.querySelectorAll('canvas.orb').forEach(whenNear);
})();
