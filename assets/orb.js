(function () {
  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FRAG = [
    'precision mediump float;',
    'uniform vec2 uRes; uniform float uTime; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform float uTile;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int k = 0; k < 5; k++){ v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }',
    'vec3 fluid(vec2 p, float t){',
    '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(t*0.8, 0.0)));',
    '  vec2 w = vec2(fbm(p + 3.2*q + vec2(1.7, 9.2) + 0.6*t), fbm(p + 3.2*q + vec2(8.3, 2.8) - 0.5*t));',
    '  float f = fbm(p + 3.0*w);',
    '  vec3 col = mix(c1, c2, smoothstep(0.25, 0.75, f));',
    '  return mix(col, c3, smoothstep(0.35, 0.9, length(w) * 0.85) * 0.75);',
    '}',
    'void tileMain(){',
    '  vec2 uv = (gl_FragCoord.xy*2.0 - uRes) / min(uRes.x, uRes.y);',
    '  float t = uTime * 0.18;',
    '  float n1 = noise(uv * 0.9 + vec2(t * 0.5, -t * 0.3));',
    '  float n2 = noise(uv * 0.7 + vec2(-t * 0.4, t * 0.6) + 7.0);',
    '  vec3 bg = mix(c3, c1, smoothstep(0.15, 0.85, n1));',
    '  bg = mix(bg, c2, smoothstep(0.45, 0.95, n2) * 0.7);',
    '  bg = mix(bg, bg * 0.78, smoothstep(0.2, 1.5, length(uv)) * 0.6);',
    '  vec2 c = vec2(sin(t*0.9)*0.06, cos(t*0.7)*0.05);',
    '  float r = length(uv - c);',
    '  float edge = 0.66 + 0.035*sin(atan(uv.y - c.y, uv.x - c.x)*3.0 + t*2.0);',
    '  float m = 1.0 - smoothstep(edge - 0.06, edge + 0.02, r);',
    '  vec3 sph = fluid((uv - c) * 1.3, t);',
    '  float hl = 1.0 - smoothstep(0.0, 0.9, length(uv - c - vec2(-0.22, 0.26)));',
    '  sph = mix(sph, vec3(1.0), hl * 0.28);',
    '  sph = mix(sph, sph * 0.82, smoothstep(edge - 0.25, edge, r) * 0.6);',
    '  float rimL = smoothstep(edge - 0.16, edge - 0.01, r) * m;',
    '  sph = mix(sph, vec3(1.0), rimL * 0.22);',
    '  vec3 col = mix(bg, sph, m * 0.9);',
    '  float g = hash(gl_FragCoord.xy + fract(uTime * 7.0) * 97.0) - 0.5;',
    '  col += g * 0.07;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
    'void main(){',
    '  if (uTile > 0.5) { tileMain(); return; }',
    '  vec2 uv = (gl_FragCoord.xy*2.0 - uRes) / min(uRes.x, uRes.y);',
    '  float r = length(uv);',
    '  float aa = 2.0 / min(uRes.x, uRes.y);',
    '  float mask = 1.0 - smoothstep(1.0 - aa*1.5, 1.0, r);',
    '  if (mask <= 0.0) { gl_FragColor = vec4(0.0); return; }',
    '  float t = uTime * 0.22;',
    '  vec2 p = uv * 1.35;',
    '  float ang = t * 0.35; mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));',
    '  p = rot * p;',
    '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(t*0.8, 0.0)));',
    '  vec2 w = vec2(fbm(p + 3.2*q + vec2(1.7, 9.2) + 0.6*t), fbm(p + 3.2*q + vec2(8.3, 2.8) - 0.5*t));',
    '  float f = fbm(p + 3.0*w);',
    '  vec3 col = mix(c1, c2, smoothstep(0.25, 0.75, f));',
    '  col = mix(col, c3, smoothstep(0.35, 0.9, length(w) * 0.85) * 0.75);',
    '  float hl = 1.0 - smoothstep(0.0, 1.15, length(uv - vec2(-0.38, 0.42)));',
    '  col = mix(col, vec3(1.0), hl * 0.38);',
    '  float rim = smoothstep(0.7, 1.0, r);',
    '  col = mix(col, col * 0.88 + 0.12, rim * 0.6);',
    '  gl_FragColor = vec4(col * mask, mask);',
    '}'
  ].join('\n');

  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255]; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fallback(c, cols) {
    var d = document.createElement('div');
    d.className = c.className;
    d.style.background = 'radial-gradient(circle at 35% 30%, #ffffff 0, ' + cols[1] + ' 30%, ' + cols[0] + ' 65%, ' + cols[2] + ' 100%)';
    c.replaceWith(d);
  }

  function start(c) {
    var cols = (c.getAttribute('data-colors') || '#8CC8FF,#C7B4FF,#FFC9E3').split(',');
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
    gl.uniform1f(gl.getUniformLocation(pr, 'uTile'), c.getAttribute('data-mode') === 'tile' ? 1 : 0);
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
