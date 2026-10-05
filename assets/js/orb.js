// adeolakod.com
// The orbs on the home page. Each <canvas class="orb" data-colors="a,b,c,d,e"> gets its own small
// WebGL shader that draws a lit sphere on a transparent background. Its colours are a slow, thick
// liquid that flows around the surface (layers of sines warping a point on the sphere), with soft
// light from the top left, a glossy highlight and a pale rim. Inspired by the orbs on elevenlabs.io.

(function () {
  'use strict';

  var VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

  var FRAGMENT = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec3 c1, c2, c3, c4, c5;   // main, second, deep, warm dark, light

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

    // A point on the sphere pushed around by layers of slow sines: the shapes stretch, fold and
    // stay smooth, like honey or paint being stirred rather than water.
    vec3 liquid(vec3 p, float t) {
      for (int k = 1; k < 6; k++) {
        float i = float(k);
        p += (0.55 / i) * sin(i * 1.15 * p.yzx + t * (0.55 + 0.12 * i) + vec3(0.0, 1.7, 3.1) * i);
      }
      return p;
    }

    // The five colours in a loop, ordered so neighbours blend cleanly:
    // main -> light -> second -> deep -> warm dark -> back to main.
    vec3 stop(float i) {
      if (i < 0.5) return c1;
      if (i < 1.5) return c5;
      if (i < 2.5) return c2;
      if (i < 3.5) return c3;
      return c4;
    }
    vec3 ramp(float x) {
      x = fract(x) * 5.0;
      float i = floor(x);
      float f = smoothstep(0.18, 0.82, fract(x));   // each colour holds its ground, then melts into the next
      return mix(stop(i), stop(mod(i + 1.0, 5.0)), f);
    }

    // Bands of all five colours, folded through each other by the liquid, so every colour
    // keeps running into every other one
    vec3 paint(vec3 q) {
      float x = 0.22 * (q.x * 1.1 + q.y * 0.8 - q.z * 0.6) + 0.12 * sin(q.z * 1.7 + q.x * 0.9);
      vec3 col = ramp(x);
      float sheen = 0.5 + 0.5 * sin(q.y * 2.3 - q.x * 1.4);
      col = mix(col, ramp(x + 0.2), smoothstep(0.75, 1.0, sheen) * 0.35);   // streaks of a second colour within each band
      col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.25);     // rich, never chalky
      return col;
    }

    void main() {
      float S = min(uRes.x, uRes.y);
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / S;   // -1..1 across the canvas
      float t = uTime * 0.3;                             // thick liquid, not water

      float R = 0.94;
      vec2 n2 = uv / R;
      float r = length(n2);
      float px = 2.0 / (S * R);                          // one pixel, for a smooth edge
      float alpha = 1.0 - smoothstep(1.0 - 1.5 * px, 1.0, r);
      if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

      float z = sqrt(max(0.0, 1.0 - min(r, 1.0) * min(r, 1.0)));
      vec3 N = vec3(n2, z);

      // The colours live on the sphere itself and the whole ball slowly turns, so it reads as 3D
      vec3 P = rotX(0.35) * rotY(t * 0.6) * N;
      vec3 col = paint(liquid(P * 1.6, t));

      // Light: soft from the top left, darker toward the far edge, glossy highlight, pale rim
      vec3 L = normalize(vec3(-0.45, 0.6, 0.75));
      float diff = clamp(dot(N, L), 0.0, 1.0);
      col *= 0.72 + 0.38 * diff;
      col *= 0.86 + 0.14 * z;
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      float nh = clamp(dot(N, H), 0.0, 1.0);
      col += mix(c5, vec3(1.0), 0.6) * (0.12 * pow(nh, 5.0) + 0.20 * pow(nh, 28.0));   // soft, satin sheen
      float fres = pow(1.0 - z, 3.0);
      col = mix(col, mix(c5, vec3(1.0), 0.45), fres * 0.5);   // glowing rim

      col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.05;   // a little grain
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
