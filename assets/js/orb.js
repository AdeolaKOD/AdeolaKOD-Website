// adeolakod.com
// The orbs on the home page. Each <canvas class="orb" data-colors="a,b,c"> gets its own small
// WebGL shader: a soft, grainy ball of slowly flowing colour sitting inside a darker square of the
// same colours, with a pale rim where the light catches its edge.
// Loosely inspired by the orbs on elevenlabs.io.

(function () {
  'use strict';

  var VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

  var FRAGMENT = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec3 c1, c2, c3;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    // Pushes the coordinates around with a few layers of sines. Gives the silky, liquid look.
    vec2 flow(vec2 p, float t) {
      for (int k = 1; k < 6; k++) {
        float i = float(k);
        p.x += 0.42 / i * sin(i * 1.7 * p.y + t * 0.9 + 0.3 * i);
        p.y += 0.38 / i * cos(i * 1.3 * p.x - t * 0.7 + 0.6 * i);
      }
      return p;
    }

    vec3 field(vec2 p, float t) {
      vec2 q = flow(p, t);
      float f1 = 0.5 + 0.5 * sin(q.x * 1.2 + q.y * 0.5);
      float f2 = 0.5 + 0.5 * cos(q.y * 1.3 - q.x * 0.7 + 1.3);
      vec3 col = mix(c3, c1, smoothstep(0.0, 1.0, f1));
      return mix(col, c2, smoothstep(0.55, 1.0, f2) * 0.55);
    }

    void main() {
      float S = min(uRes.x, uRes.y);
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / S;   // -1..1 across the square
      float t = uTime * 0.35;

      // Square backdrop: the same colours at full strength, slower, darker and very soft
      vec3 bg = field(uv * 0.55 + vec2(3.1, 1.7), t * 0.5);
      bg = mix(bg, c3, 0.15) * 0.82;
      bg *= 1.0 - 0.22 * smoothstep(0.5, 1.5, length(uv));

      // The orb. z fakes a sphere so the colour seems to wrap round it.
      float R = 0.86;
      vec2 n2 = uv / R;
      float r = length(n2);
      float rc = min(r, 1.0);
      float z = sqrt(max(0.0, 1.0 - rc * rc));
      vec2 sp = n2 * (1.3 - 0.4 * z);
      float a = t * 0.12;
      sp = mat2(cos(a), -sin(a), sin(a), cos(a)) * sp;
      vec3 orb = field(sp * 0.95, t);

      // Soft light from the top left, a pale rim catching light at the lower left
      vec3 N = vec3(n2, z);
      orb *= 0.82 + 0.3 * clamp(dot(N, normalize(vec3(-0.4, 0.55, 0.75))), 0.0, 1.0);
      float fres = pow(1.0 - z, 2.5);
      float side = 0.45 + 0.55 * clamp(dot(normalize(n2 + 1e-4), normalize(vec2(-0.7, -0.6))), 0.0, 1.0);
      orb = mix(orb, c2, fres * side * 0.45);

      float inside = 1.0 - smoothstep(0.975, 1.01, r);      // soft but readable edge
      float shade = exp(-pow(max(r - 1.0, 0.0) * 5.0, 2.0)) * (1.0 - inside);
      bg *= 1.0 - 0.14 * shade;                              // faint contact shadow round the ball

      vec3 col = mix(bg, orb, inside);
      col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.13;   // heavy film grain
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
    div.style.background = 'radial-gradient(circle at 50% 50%, ' + cols[0] + ' 0, ' + cols[2] + ' 33%, ' + cols[1] + ' 36%, #ffffff 100%)';
    canvas.replaceWith(div);
  }

  function start(canvas) {
    var cols = (canvas.getAttribute('data-colors') || '#9FD3FF,#E6F5FF,#4C7BEA').split(',');
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
    ['c1', 'c2', 'c3'].forEach(function (name, i) {
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
