import { useEffect, useRef } from 'react';
import { Renderer, Program, Triangle, Mesh } from 'ogl';
import { vertex, fragment, hexToRgb } from './warpShader';
import './WarpScanlines.css';

/**
 * WarpScanlines – component theo phong cách React Bits (OGL + shader).
 * Tái tạo hiệu ứng "tia warp dạng scanline" giống video Unicorn Studio.
 */
export default function WarpScanlines({
  colorA = '#1f3dff',
  colorB = '#5ee9ff',
  backgroundColor = '#060607',
  rayCount = 28,
  density = 0.42,
  speed = 0.25,
  lineSpacing = 6,
  lineThickness = 0.3,
  hole = 0.24,
  streak = 0.85,
  brightness = 0.95,
  gridSize = 12,
  gridOpacity = 0.6,
  seed = 1,
  center = [0.5, 0.5],
  mouseInfluence = 0.15, // 0 = tắt, tâm tia sẽ đi theo chuột
  className = ''
}) {
  const containerRef = useRef(null);
  const programRef = useRef(null);
  const propsRef = useRef({ center, mouseInfluence });
  propsRef.current = { center, mouseInfluence };

  // Khởi tạo WebGL một lần
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderer = new Renderer({ dpr, alpha: false, antialias: false });
    const gl = renderer.gl;
    container.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },
        uDpr: { value: dpr },
        uCenter: { value: [...center] },
        uColorA: { value: hexToRgb(colorA) },
        uColorB: { value: hexToRgb(colorB) },
        uBgColor: { value: hexToRgb(backgroundColor) },
        uRayCount: { value: rayCount },
        uDensity: { value: density },
        uSpeed: { value: speed },
        uLineSpacing: { value: lineSpacing },
        uLineThickness: { value: lineThickness },
        uHole: { value: hole },
        uStreak: { value: streak },
        uBrightness: { value: brightness },
        uGridSize: { value: gridSize },
        uGridOpacity: { value: gridOpacity },
        uSeed: { value: seed }
      }
    });
    programRef.current = program;
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      program.uniforms.iResolution.value = [gl.canvas.width, gl.canvas.height];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Chuột: tâm tia lệch nhẹ theo con trỏ
    const mouse = { x: 0.5, y: 0.5 };
    const smooth = { x: center[0], y: center[1] };
    const onMove = e => {
      const rect = container.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = 1 - (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener('pointermove', onMove);

    let raf;
    const loop = t => {
      const { center: c, mouseInfluence: mi } = propsRef.current;
      const tx = c[0] + (mouse.x - 0.5) * mi * 2;
      const ty = c[1] + (mouse.y - 0.5) * mi * 2;
      smooth.x += (tx - smooth.x) * 0.05;
      smooth.y += (ty - smooth.y) * 0.05;
      program.uniforms.uCenter.value = [smooth.x, smooth.y];
      program.uniforms.iTime.value = t * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      gl.canvas.remove();
      programRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cập nhật uniform khi props đổi (không tạo lại WebGL)
  useEffect(() => {
    const u = programRef.current?.uniforms;
    if (!u) return;
    u.uColorA.value = hexToRgb(colorA);
    u.uColorB.value = hexToRgb(colorB);
    u.uBgColor.value = hexToRgb(backgroundColor);
    u.uRayCount.value = rayCount;
    u.uDensity.value = density;
    u.uSpeed.value = speed;
    u.uLineSpacing.value = lineSpacing;
    u.uLineThickness.value = lineThickness;
    u.uHole.value = hole;
    u.uStreak.value = streak;
    u.uBrightness.value = brightness;
    u.uGridSize.value = gridSize;
    u.uGridOpacity.value = gridOpacity;
    u.uSeed.value = seed;
  }, [colorA, colorB, backgroundColor, rayCount, density, speed, lineSpacing,
      lineThickness, hole, streak, brightness, gridSize, gridOpacity, seed]);

  return <div ref={containerRef} className={`warp-scanlines ${className}`} />;
}
