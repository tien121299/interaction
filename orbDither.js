/*
 * Orb + Glyph Dither (horizontal lines)
 * Based on the <Orb /> background from React Bits (https://reactbits.dev/backgrounds/orb),
 * ported to plain WebGL (no dependencies) and extended with:
 *   - light rays streaming out of the orb
 *   - a horizontal-line glyph dither pass with custom colors
 *   - pointer interaction (hover warp + rotate, cursor glow, click pulse)
 *
 * Usage (plain JS):
 *   import { createOrb } from './orbDither.js';
 *   const orb = createOrb(document.querySelector('#orb'), { lineColors: ['#0b1cff', '#2b7bff', '#6ff6ff'] });
 *   orb.update({ hue: 40 });   // change any option live
 *   orb.destroy();
 */

export const ORB_DEFAULTS = {
  // --- original React Bits Orb props ---
  hue: 0,
  hoverIntensity: 0.2,
  rotateOnHover: true,
  forceHoverState: false,
  backgroundColor: '#000000',

  // --- extras ---
  rays: 1.0, // strength of the light rays around the orb (0 = plain orb)
  mouseGlow: 0.8, // brightening around the cursor
  clickPulse: true, // click / tap sends a shock-wave ring

  // --- glyph dither ---
  dither: true,
  cellWidth: 10, // CSS px, width of one glyph cell
  cellHeight: 10, // CSS px, height of one glyph cell (= line spacing)
  lineThickness: 0.35, // max thickness of a line, fraction of cellHeight
  levels: 4, // number of thickness/color steps
  gap: 0, // CSS px gap at the end of each cell (0 = lines join into long dashes)
  contrast: 1.35, // >1 darkens mid-tones, gives more black space
  lineColors: ['#0a14ff', '#1e6bff', '#5ef2ff'], // dark -> mid -> bright
  useSourceColor: false, // true = color lines with the orb's own colors instead of lineColors
  transparent: false // true = no background, only the lines are drawn
};

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const ORB_FRAG = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float hue;
uniform float hover;
uniform float rot;
uniform float hoverIntensity;
uniform vec3 backgroundColor;
uniform float rays;
uniform vec2 mouse;
uniform float mouseActive;
uniform float mouseGlow;
uniform float pulseAge;
varying vec2 vUv;

vec3 rgb2yiq(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  float i = dot(c, vec3(0.596, -0.274, -0.322));
  float q = dot(c, vec3(0.211, -0.523, 0.312));
  return vec3(y, i, q);
}

vec3 yiq2rgb(vec3 c) {
  float r = c.x + 0.956 * c.y + 0.621 * c.z;
  float g = c.x - 0.272 * c.y - 0.647 * c.z;
  float b = c.x - 1.106 * c.y + 1.703 * c.z;
  return vec3(r, g, b);
}

vec3 adjustHue(vec3 color, float hueDeg) {
  float hueRad = hueDeg * 3.14159265 / 180.0;
  vec3 yiq = rgb2yiq(color);
  float cosA = cos(hueRad);
  float sinA = sin(hueRad);
  float i = yiq.y * cosA - yiq.z * sinA;
  float q = yiq.y * sinA + yiq.z * cosA;
  yiq.y = i;
  yiq.z = q;
  return yiq2rgb(yiq);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
  return dot(vec4(31.316), n);
}

vec4 extractAlpha(vec3 colorIn) {
  float a = max(max(colorIn.r, colorIn.g), colorIn.b);
  return vec4(colorIn.rgb / (a + 1e-5), a);
}

const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
const float innerRadius = 0.6;
const float noiseScale = 0.65;

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}
float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec3 draw(vec2 uv) {
  vec3 color1 = adjustHue(baseColor1, hue);
  vec3 color2 = adjustHue(baseColor2, hue);
  vec3 color3 = adjustHue(baseColor3, hue);

  float ang = atan(uv.y, uv.x);
  float len = length(uv);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;

  float bgLuminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));

  float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0, d0);

  v0 *= smoothstep(r0 * 1.05, r0, len);
  float innerFade = smoothstep(r0 * 0.8, r0 * 0.95, len);
  v0 *= mix(innerFade, 1.0, bgLuminance * 0.7);
  float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

  float a = iTime * -1.0;
  vec2 pos = vec2(cos(a), sin(a)) * r0;
  float d = distance(uv, pos);
  float v1 = light2(1.5, 5.0, d);
  v1 *= light1(1.0, 50.0, d0);

  float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
  float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

  vec3 colBase = mix(color1, color2, cl);
  float fadeAmount = mix(1.0, 0.1, bgLuminance);

  vec3 darkCol = mix(color3, colBase, v0);
  darkCol = (darkCol + v1) * v2 * v3;
  darkCol = clamp(darkCol, 0.0, 1.0);

  vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
  lightCol = mix(backgroundColor, lightCol, v0);
  lightCol = clamp(lightCol, 0.0, 1.0);

  vec3 finalCol = mix(darkCol, lightCol, bgLuminance);

  // --- light rays: angular noise streaks that start at the orb rim and stream outward ---
  if (rays > 0.0) {
    vec2 dir = vec2(cos(ang), sin(ang));
    // 12 thin spokes (integer count keeps them seamless at the atan wrap), each with its own
    // slowly-changing brightness and a small angular wobble
    float wobble = snoise3(vec3(dir * 2.0, iTime * 0.2)) * 0.35;
    float spokes = pow(0.5 + 0.5 * cos(ang * 12.0 + wobble + iTime * 0.1), 6.0);
    float gain = snoise3(vec3(dir * 3.0, iTime * 0.25 + 3.0)) * 0.5 + 0.5;
    float streak = spokes * smoothstep(0.2, 0.8, gain);
    // dashes travelling outward along each ray
    float dash = snoise3(vec3(dir * 6.0, len * 2.0 - iTime * 0.6)) * 0.5 + 0.5;
    streak *= smoothstep(0.25, 0.6, dash);
    float rim = smoothstep(r0 * 0.8, r0 * 1.05, len);
    float fall = exp(-max(len - r0, 0.0) * 0.45);
    vec3 rayCol = mix(color3, mix(colBase, color2, 0.5), streak);
    finalCol += rayCol * streak * rim * fall * rays * 1.8;
  }

  return clamp(finalCol, 0.0, 1.0);
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec2 center = iResolution.xy * 0.5;
  float size = min(iResolution.x, iResolution.y);
  vec2 uv = (fragCoord - center) / size * 2.0;
  vec2 screenUv = uv;

  float s = sin(rot);
  float c = cos(rot);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
  uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

  vec3 col = draw(uv);

  // cursor glow: brighten what is already lit near the pointer
  float md = distance(screenUv, mouse);
  float glow = exp(-md * md * 6.0) * mouseActive * mouseGlow;
  col *= 1.0 + glow * 1.5;
  col += vec3(0.05, 0.1, 0.3) * glow * 0.35;

  // click pulse: an expanding ring
  if (pulseAge >= 0.0) {
    float ringR = pulseAge * 1.6;
    float ring = exp(-pow((length(screenUv) - ringR) * 9.0, 2.0)) * exp(-pulseAge * 1.8);
    col += vec3(0.25, 0.55, 1.0) * ring;
  }

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

const DITHER_FRAG = `
precision highp float;

uniform sampler2D tSource;
uniform vec2 gridSize;     // columns, rows
uniform vec2 cellPx;       // cell size in device pixels
uniform vec2 canvasPx;
uniform float lineThickness;
uniform float levels;
uniform float gapPx;
uniform float contrast;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 bgColor;
uniform float bgAlpha;
uniform float useSourceColor;

// 4x4 ordered (Bayer) threshold in [0,1)
float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main() {
  // top-left origin so rows line up from the top of the element
  vec2 px = vec2(gl_FragCoord.x, canvasPx.y - gl_FragCoord.y);
  vec2 cell = floor(px / cellPx);
  vec2 local = px - cell * cellPx;

  vec2 sampleUv = vec2((cell.x + 0.5) / gridSize.x, 1.0 - (cell.y + 0.5) / gridSize.y);
  vec3 src = texture2D(tSource, sampleUv).rgb;
  float b = max(max(src.r, src.g), src.b);
  b = pow(clamp(b, 0.0, 1.0), contrast);

  float level = floor(b * levels + bayer4(cell) * 0.999);
  level = clamp(level, 0.0, levels);
  float t = level / levels;

  // glyph: one horizontal line centered in the cell, thicker when brighter
  float thick = max(1.0, t * lineThickness * cellPx.y);
  float dy = abs(local.y + 0.5 - cellPx.y * 0.5);
  float inLine = step(dy, thick * 0.5) * step(local.x, cellPx.x - gapPx - 0.001) * step(0.5, level);

  vec3 lineCol = t < 0.5 ? mix(color1, color2, t * 2.0) : mix(color2, color3, (t - 0.5) * 2.0);
  if (useSourceColor > 0.5) {
    lineCol = clamp(src / max(max(src.r, src.g), max(src.b, 0.001)), 0.0, 1.0) * mix(0.55, 1.0, t);
  }

  float alpha = mix(bgAlpha, 1.0, inLine);
  vec3 col = mix(bgColor * bgAlpha, lineCol, inLine);
  gl_FragColor = vec4(col, alpha);
}
`;

const COPY_FRAG = `
precision highp float;
uniform sampler2D tSource;
uniform float bgAlpha;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSource, vUv).rgb;
  float a = bgAlpha > 0.5 ? 1.0 : max(max(c.r, c.g), c.b);
  gl_FragColor = vec4(c, a);
}
`;

export function parseColor(color) {
  if (Array.isArray(color)) return color;
  if (typeof color !== 'string') return [0, 0, 0];
  const c = color.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  }
  const rgb = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map(v => parseInt(v, 10) / 255);
  const hsl = c.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
  if (hsl) return hslToRgb(parseInt(hsl[1], 10) / 360, parseInt(hsl[2], 10) / 100, parseInt(hsl[3], 10) / 100);
  return [0, 0, 0];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Orb shader error: ' + log);
  }
  return sh;
}

function createProgram(gl, fragSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.bindAttribLocation(prog, 0, 'position');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Orb link error: ' + gl.getProgramInfoLog(prog));
  const uniforms = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    uniforms[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, uniforms };
}

export function createOrb(container, options = {}) {
  const opts = { ...ORB_DEFAULTS };
  for (const k in options) if (options[k] !== undefined && k in ORB_DEFAULTS) opts[k] = options[k];

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) {
    console.warn('Orb: WebGL not supported');
    return { update() {}, destroy() { canvas.remove(); } };
  }

  const orbProg = createProgram(gl, ORB_FRAG);
  const ditherProg = createProgram(gl, DITHER_FRAG);
  const copyProg = createProgram(gl, COPY_FRAG);

  // one big triangle covering the viewport
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  let texW = 0;
  let texH = 0;

  let dpr = 1;
  let gridW = 1;
  let gridH = 1;
  let cellPxW = 1;
  let cellPxH = 1;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (opts.dither) {
      cellPxW = Math.max(1, Math.round(opts.cellWidth * dpr));
      cellPxH = Math.max(2, Math.round(opts.cellHeight * dpr));
      gridW = Math.ceil(canvas.width / cellPxW);
      gridH = Math.ceil(canvas.height / cellPxH);
    } else {
      // render the plain orb at half resolution, it is smooth anyway
      gridW = Math.ceil(canvas.width / 2);
      gridH = Math.ceil(canvas.height / 2);
    }
    if (gridW !== texW || gridH !== texH) {
      texW = gridW;
      texH = gridH;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.dither ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.dither ? gl.NEAREST : gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    }
  }

  const ro = new ResizeObserver(layout);
  ro.observe(container);
  layout();

  // ---- interaction ----
  let targetHover = 0;
  let hover = 0;
  let mouseActive = 0;
  let mouseTarget = 0;
  const mouse = [0, 0];
  const mouseSmooth = [0, 0];
  let pulseStart = -1;

  function toUv(e) {
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    return {
      inside: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom,
      x: ((e.clientX - rect.left - rect.width / 2) / size) * 2,
      y: -((e.clientY - rect.top - rect.height / 2) / size) * 2
    };
  }

  // listen on window so overlays on top of the orb don't block the interaction
  const onMove = e => {
    const p = toUv(e);
    if (!p.inside) {
      targetHover = 0;
      mouseTarget = 0;
      return;
    }
    mouse[0] = p.x;
    mouse[1] = p.y;
    if (mouseTarget === 0) {
      mouseSmooth[0] = p.x;
      mouseSmooth[1] = p.y;
    }
    mouseTarget = 1;
    targetHover = Math.hypot(p.x, p.y) < 0.8 ? 1 : 0;
  };
  const onLeave = () => {
    targetHover = 0;
    mouseTarget = 0;
  };
  const onDown = e => {
    if (!opts.clickPulse) return;
    if (toUv(e).inside) pulseStart = performance.now();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);

  // ---- render loop ----
  let rafId;
  let lastTime = performance.now();
  let rot = 0;
  const rotationSpeed = 0.3;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastTime) * 0.001);
    lastTime = now;
    const time = now * 0.001;

    const effectiveHover = opts.forceHoverState ? 1 : targetHover;
    hover += (effectiveHover - hover) * 0.1;
    if (opts.rotateOnHover && effectiveHover > 0.5) rot += dt * rotationSpeed;
    mouseActive += (mouseTarget - mouseActive) * 0.08;
    mouseSmooth[0] += (mouse[0] - mouseSmooth[0]) * 0.15;
    mouseSmooth[1] += (mouse[1] - mouseSmooth[1]) * 0.15;
    const pulseAge = pulseStart < 0 ? -1 : (now - pulseStart) * 0.001;
    if (pulseAge > 2.5) pulseStart = -1;

    const bg = parseColor(opts.backgroundColor);

    // pass 1: orb -> small texture (one texel per glyph cell)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, texW, texH);
    gl.useProgram(orbProg.prog);
    const u = orbProg.uniforms;
    gl.uniform1f(u.iTime, time);
    gl.uniform3f(u.iResolution, canvas.width, canvas.height, canvas.width / canvas.height);
    gl.uniform1f(u.hue, opts.hue);
    gl.uniform1f(u.hover, hover);
    gl.uniform1f(u.rot, rot);
    gl.uniform1f(u.hoverIntensity, opts.hoverIntensity);
    gl.uniform3fv(u.backgroundColor, opts.dither ? [0, 0, 0] : bg);
    gl.uniform1f(u.rays, opts.rays);
    gl.uniform2fv(u.mouse, mouseSmooth);
    gl.uniform1f(u.mouseActive, mouseActive);
    gl.uniform1f(u.mouseGlow, opts.mouseGlow);
    gl.uniform1f(u.pulseAge, pulseAge);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2: dither (or plain upscale) -> canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const bgAlpha = opts.transparent ? 0 : 1;
    if (opts.dither) {
      const d = ditherProg.uniforms;
      gl.useProgram(ditherProg.prog);
      gl.uniform1i(d.tSource, 0);
      gl.uniform2f(d.gridSize, texW, texH);
      gl.uniform2f(d.cellPx, cellPxW, cellPxH);
      gl.uniform2f(d.canvasPx, canvas.width, canvas.height);
      gl.uniform1f(d.lineThickness, opts.lineThickness);
      gl.uniform1f(d.levels, Math.max(1, Math.round(opts.levels)));
      gl.uniform1f(d.gapPx, opts.gap * dpr);
      gl.uniform1f(d.contrast, opts.contrast);
      const [c1, c2, c3] = opts.lineColors;
      gl.uniform3fv(d.color1, parseColor(c1));
      gl.uniform3fv(d.color2, parseColor(c2 ?? c1));
      gl.uniform3fv(d.color3, parseColor(c3 ?? c2 ?? c1));
      gl.uniform3fv(d.bgColor, bg);
      gl.uniform1f(d.bgAlpha, bgAlpha);
      gl.uniform1f(d.useSourceColor, opts.useSourceColor ? 1 : 0);
    } else {
      gl.useProgram(copyProg.prog);
      gl.uniform1i(copyProg.uniforms.tSource, 0);
      gl.uniform1f(copyProg.uniforms.bgAlpha, bgAlpha);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  rafId = requestAnimationFrame(frame);

  return {
    canvas,
    get options() {
      return { ...opts };
    },
    update(next = {}) {
      next = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && k in ORB_DEFAULTS));
      const relayout = ['dither', 'cellWidth', 'cellHeight'].some(k => k in next && next[k] !== opts[k]);
      Object.assign(opts, next);
      if (relayout) {
        texW = 0;
        layout();
      }
    },
    destroy() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    }
  };
}
