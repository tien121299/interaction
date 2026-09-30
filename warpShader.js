// Shader dùng chung cho WarpScanlines.jsx (React/OGL) và demo.html (WebGL thuần).
// Hiệu ứng: các tia "warp" toả ra từ tâm, được vẽ bằng các vạch scanline nằm ngang,
// dải màu xanh dương -> cyan, nền đen với lưới ô cờ mờ.

export const vertex = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const fragment = /* glsl */ `
precision highp float;

uniform float iTime;
uniform vec2  iResolution;
uniform float uDpr;
uniform vec2  uCenter;        // tâm toả tia (0..1)
uniform vec3  uColorA;        // màu tối (xanh dương)
uniform vec3  uColorB;        // màu sáng (cyan)
uniform vec3  uBgColor;
uniform float uRayCount;      // số tia chính
uniform float uDensity;       // tỉ lệ tia hiển thị (0..1)
uniform float uSpeed;
uniform float uLineSpacing;   // khoảng cách giữa các vạch (px CSS)
uniform float uLineThickness; // độ dày vạch (0..1 của khoảng cách)
uniform float uHole;          // bán kính vùng tối ở giữa
uniform float uStreak;        // độ dài vệt (0..1)
uniform float uBrightness;
uniform float uGridSize;      // kích thước ô lưới nền (px CSS)
uniform float uGridOpacity;
uniform float uSeed;

float hash(float n) { return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.13) * 43758.5453); }

// Một lớp tia: trả về cường độ 0..1 tại góc a, bán kính r
float rayLayer(float a, float r, float count, float density, float t, float salt) {
  float sa = (a / 6.2831853 + 0.5) * count;
  float id = floor(sa);
  float f = fract(sa);
  float h = hash(id + salt);
  if (h < 1.0 - density) return 0.0;

  // độ rộng & vị trí ngẫu nhiên của tia trong ô góc
  float w = mix(0.18, 0.85, hash(id + salt + 7.0));
  float o = (1.0 - w) * hash(id + salt + 13.0);
  float edge = smoothstep(o, o + 0.04, f) * (1.0 - smoothstep(o + w - 0.04, o + w, f));

  // vệt chạy ra ngoài theo log(r) -> cảm giác tăng tốc
  float lr = log(max(r, 1e-3));
  float spd = mix(0.6, 1.4, hash(id + salt + 21.0));
  float seg = fract(lr * mix(0.8, 1.6, hash(id + salt + 3.0)) - t * spd + hash(id + salt + 5.0) * 10.0);
  float streak = smoothstep(0.0, 0.05, seg) * (1.0 - smoothstep(uStreak, uStreak + 0.08, seg));

  return edge * streak * mix(0.55, 1.0, hash(id + salt + 31.0));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float spacing = max(uLineSpacing * uDpr, 1.0);

  // Scanline: mỗi hàng lấy mẫu tại tâm hàng -> tạo các vạch ngang
  float row = floor(frag.y / spacing);
  float inRow = fract(frag.y / spacing);
  float lineMask = 1.0 - smoothstep(uLineThickness, uLineThickness + 1.0 / spacing, inRow);

  vec2 samp = vec2(frag.x, (row + 0.5) * spacing);
  vec2 c = uCenter * iResolution;
  vec2 p = (samp - c) / iResolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = iTime * uSpeed;

  float rays = max(
    rayLayer(a, r, uRayCount, uDensity, t, 0.0),
    rayLayer(a, r, uRayCount * 2.7, uDensity * 0.35, t * 1.2, 97.0) * 0.7
  );

  // Vùng tối ở giữa + sáng dần ra ngoài
  float fade = smoothstep(uHole, uHole + 0.6, r);

  // Độ sáng thay đổi theo từng hàng + nhấp nháy nhẹ
  float rowRand = hash2(vec2(row, floor(t * 6.0 + hash(row) * 4.0)));
  float rowBright = mix(0.45, 1.0, rowRand);

  float intensity = rays * fade * rowBright;
  float cyanMix = clamp(intensity * smoothstep(0.35, 1.1, r) * 1.6 * rowRand, 0.0, 1.0);
  vec3 col = mix(uColorA, uColorB, cyanMix) * intensity * uBrightness;

  // Nền lưới ô cờ
  vec2 g = floor(frag / max(uGridSize * uDpr, 1.0));
  float checker = mod(g.x + g.y, 2.0);
  vec3 bg = uBgColor + vec3(0.018) * checker * uGridOpacity;

  gl_FragColor = vec4(bg + col * lineMask, 1.0);
}
`;

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
