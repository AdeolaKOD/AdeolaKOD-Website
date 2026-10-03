(function () {
  // Soft, grainy orbs: a feathered circle of slowly flowing colour, set inside a square tile
  // of the same colours and motion, washed out so it sits in the background.
  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'vec2 flow(vec2 p, float t){',
    '  for (int k = 1; k < 6; k++){',
    '    float i = float(k);',
    '    p.x += 0.42 / i * sin(i * 1.7 * p.y + t * 0.9 + 0.3 * i);',
    '    p.y += 0.38 / i * cos(i * 1.3 * p.x - t * 0.7 + 0.6 * i);',
    '  }',
    '  return p;',
    '}',
    'vec3 field(vec2 p, float t){',
    '  vec2 q = flow(p, t);',
    '  float f1 = 0.5 + 0.5 * sin(q.x * 1.9 + q.y * 0.6);',
    '  float f2 = 0.5 + 0.5 * cos(q.y * 2.1 - q.x * 0.9 + 1.3);',
    '  vec3 col = mix(c2, c1, smoothstep(0.05, 0.95, f1));',
    '  return mix(col, c3, smoothstep(0.35, 1.0, f2) * 0.8);',
    '}',
    'void main(){',
    '  float S = min(uRes.x, uRes.y);',
    '  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / S;',
    '  float t = uTime * 0.35;',
    // Square backdrop: same colours and motion, broader and washed out so it sits behind the orb
    '  vec3 bg = field(uv * 0.8 + vec2(3.1, 1.7), t * 0.6);',
    '  bg = mix(bg, vec3(1.0), 0.45);',
    '  bg = mix(bg, bg * 0.92, smoothstep(0.7, 1.6, length(uv)));',
    // Orb: soft, matte, with a feathered edge
    '  float R = 0.72;',
    '  float r = length(uv) / R;',
    '  float rc = min(r, 1.0);',
    '  float z = sqrt(max(0.0, 1.0 - rc * rc));',
    '  vec2 sp = (uv / R) * (1.25 - 0.35 * z);',
    '  float a = t * 0.12; sp = mat2(cos(a), -sin(a), sin(a), cos(a)) * sp;',
    '  vec3 orb = field(sp * 1.6, t);',
    '  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));',
    '  orb *= 0.9 + 0.14 * clamp(dot(vec3(uv / R, z), L), 0.0, 1.0);',
    '  orb = mix(orb, vec3(1.0), (1.0 - smoothstep(0.0, 0.9, length(uv / R - vec2(-0.35, 0.4)))) * 0.1);',
    '  orb = mix(orb, orb * 0.92, smoothstep(0.55, 1.0, r));',
    '  float m = 1.0 - smoothstep(0.93, 1.04, r);',
    '  float halo = exp(-pow(max(r - 1.0, 0.0) * 2.6, 2.0)) * (1.0 - m);',
    '  bg = mix(bg, mix(c1, vec3(1.0), 0.35), halo * 0.22);',
    '  vec3 col = mix(bg, orb, m);',
    '  col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.07;',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255]; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fallback(c, cols) {
    var d = document.createElement('div');
    d.className = c.className;
    d.style.background = 'radial-gradient(circle at 50% 50%, ' + cols[0] + ' 0, ' + cols[2] + ' 33%, ' + cols[1] + ' 36%, #ffffff 100%)';
    c.replaceWith(d);
  }

  function start(c) {
    var cols = (c.getAttribute('data-colors') || '#9FD3FF,#E6F5FF,#4C7BEA').split(',');
    var gl = c.getContext('webgl', { premultipliedAlpha: true, antialias: true, alpha: true });
    if (!gl) { fallback(c, cols); return; }
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { fallback(c, cols); return; }
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(pr, 'uRes'), uTime = gl.getUniformLocation(pr, 'uTime');
    ['c1','c2','c3'].forEach(function (n, i) { var v = hex(cols[i] || cols[0]); gl.uniform3f(gl.getUniformLocation(pr, n), v[0], v[1], v[2]); });
    var seed = Math.random() * 100, visible = true, raf = 0;
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uRes, c.width, c.height);
    }
    function draw(ms) {
      size();
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, seed + (reduce ? 0 : ms / 1000));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function loop(ms) { draw(ms); if (visible && !reduce) raf = requestAnimationFrame(loop); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
      }).observe(c);
    }
    if ('ResizeObserver' in window) { new ResizeObserver(function () { draw(performance.now()); }).observe(c); }
    draw(0);
    if (!reduce) raf = requestAnimationFrame(loop);
  }
  document.querySelectorAll('canvas.orb').forEach(start);
})();
