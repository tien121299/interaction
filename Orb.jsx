import { useEffect, useRef } from 'react';
import { createOrb } from './orbDither';
import './Orb.css';

/**
 * Orb – bản mở rộng của <Orb /> (React Bits) với hiệu ứng Glyph Dither vạch ngang.
 * Nhận đúng các props gốc (hue, hoverIntensity, rotateOnHover, forceHoverState, backgroundColor)
 * cộng thêm các props dither / tương tác, xem ORB_DEFAULTS trong orbDither.js.
 * Không cần thư viện ngoài (WebGL thuần).
 */
export default function Orb({ className = '', ...props }) {
  const containerRef = useRef(null);
  const orbRef = useRef(null);

  // Khởi tạo WebGL một lần
  useEffect(() => {
    if (!containerRef.current) return;
    orbRef.current = createOrb(containerRef.current, props);
    return () => {
      orbRef.current?.destroy();
      orbRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cập nhật khi props đổi (không tạo lại WebGL)
  useEffect(() => {
    orbRef.current?.update(props);
  });

  return <div ref={containerRef} className={`orb-container ${className}`} />;
}
