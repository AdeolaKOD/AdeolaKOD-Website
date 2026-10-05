// adeolakod.com
// The orbs on the home page. Each <canvas class="orb" data-colors="a,b,c"> gets its own small
// WebGL shader: soft drifting clouds of colour filling a square, with a glass ball in front that
// magnifies them, picked out by a thin rim of light. Heavy grain on top.
// Loosely inspired by the orbs on elevenlabs.io.

(function () {
  'use strict';

  var VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

  var FRAGMENT = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec3 c1, c2, c3, c4, c5;   // main, second, deep, warm dark, light

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    float blob(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }

    vec2 warp(vec2 p, float t) { return p + 0.1 * vec2(sin(p.y * 2.3 + t * 0.9), cos(p.x * 2.1 - t * 0.7)); }
    vec2 drift(float t, float k) { return 0.2 * vec2(sin(t * (0.31 + 0.07 * k) + k * 1.7), cos(t * (0.27 + 0.05 * k) + k * 2.3)); }

    // What you see through the ball: mostly the main colour, with the second colour round one side,
    // the deep colour pooling at the bottom and a pale glow at the top left.
    vec3 inner(vec2 p, float t) {
      p = warp(p, t);
      vec3 col = c1;
      col = mix(col, c4, 0.50 * blob(p, vec2(-0.95, -0.10) + drift(t, 1.0), 0.50));
      col = mix(col, c2, 0.92 * blob(p, vec2(0.95, 0.20) + drift(t, 2.0), 0.68));
      col = mix(col, c2, 0.55 * blob(p, vec2(0.45, -0.70) + drift(t, 3.0), 0.32));
      col = mix(col, c3, 0.90 * blob(p, vec2(-0.05, -1.00) + drift(t, 4.0), 0.52));
      col = mix(col, c5, 0.70 * blob(p, vec2(-0.70, 0.85) + drift(t, 5.0), 0.50));
      return col;
    }

    // The square behind the ball: the same colours arranged round the corners, a little darker
    vec3 outer(vec2 p, float t) {
      p = warp(p, t * 0.8);
      vec3 col = mix(c1, c4, 0.55);
      col = mix(col, c2, 0.95 * blob(p, vec2(1.00, 1.00) + drift(t, 6.0), 0.80));
      col = mix(col, c5, 0.80 * blob(p, vec2(-1.00, 1.05) + drift(t, 7.0), 0.60));
      col = mix(col, c4, 0.90 * blob(p, vec2(1.00, -1.00) + drift(t, 8.0), 0.80));
      col = mix(col, c3, 0.70 * blob(p, vec2(-0.90, -1.05) + drift(t, 9.0), 0.50));
      return col * 0.92;
    }

    void main() {
      float S = min(uRes.x, uRes.y);
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / S;   // -1..1 across the square
      float t = uTime * 0.6;

      vec3 bg = outer(uv, t);

      // A glass ball almost as big as the square, read by what is inside it and a faint rim
      vec2 ctr = vec2(0.04, -0.03);
      float R = 0.98;
      vec2 n = (uv - ctr) / R;
      float r = length(n);
      float z = sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0)));
      float a = t * 0.04;
      vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * n * (0.92 + 0.1 * (1.0 - z));
      vec3 orb = inner(q, t);
      orb *= 0.93 + 0.1 * clamp(dot(vec3(n, z), normalize(vec3(-0.4, 0.5, 0.8))), 0.0, 1.0);

      vec2 dir = normalize(n + 1e-4);
      float rim = smoothstep(0.965, 0.99, r) * (1.0 - smoothstep(0.99, 1.0, r));
      orb += rim * (0.02 + 0.22 * max(dot(dir, normalize(vec2(0.55, 0.85))), 0.0)) * mix(c5, vec3(1.0), 0.6);
      orb *= 1.0 - 0.10 * smoothstep(0.88, 1.0, r) * max(dot(dir, normalize(vec2(-0.5, -0.9))), 0.0);

      float inside = 1.0 - smoothstep(0.996, 1.006, r);
      vec3 col = mix(bg, orb, inside);
      col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.12;   // film grain
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
    div.style.background = 'radial-gradient(circle at 45% 40%, ' + cols[0] + ' 0, ' + cols[1] + ' 70%, ' + cols[2] + ' 100%)';
    canvas.replaceWith(div);
  }

  function start(canvas) {
    var cols = (canvas.getAttribute('data-colors') || '#FF9A3D,#4FA65A,#1E4A5C,#B8461F,#FFE2B8').split(',');
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
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
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
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
