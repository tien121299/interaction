# WarpScanlines (phong cách React Bits)

Tái tạo hiệu ứng "tia warp dạng scanline" (làm trong Unicorn Studio) thành component React,
viết theo cấu trúc của các background trong React Bits (OGL + fragment shader).

React Bits không có sẵn component giống hệt hiệu ứng này (gần nhất là `Hyperspeed`, `LightRays`),
nên đây là một component mới cùng kiểu: copy file vào project là dùng được.

## Cài đặt

```bash
npm i ogl
```

Copy 3 file vào project, ví dụ `src/components/WarpScanlines/`:
`WarpScanlines.jsx`, `WarpScanlines.css`, `warpShader.js`.

## Dùng

```jsx
import WarpScanlines from './components/WarpScanlines/WarpScanlines';

<div style={{ width: '100%', height: 600 }}>
  <WarpScanlines colorA="#1f3dff" colorB="#5ee9ff" speed={0.25} />
</div>
```

## Props

| Prop | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `colorA` | `#1f3dff` | Màu tối của tia (xanh dương) |
| `colorB` | `#5ee9ff` | Màu sáng ở rìa (cyan) |
| `backgroundColor` | `#060607` | Màu nền |
| `rayCount` | `28` | Số tia |
| `density` | `0.42` | Tỉ lệ tia hiện (0–1) |
| `speed` | `0.25` | Tốc độ vệt chạy ra ngoài |
| `lineSpacing` | `6` | Khoảng cách giữa các vạch ngang (px) |
| `lineThickness` | `0.3` | Độ dày vạch (0–1) |
| `hole` | `0.24` | Bán kính vùng tối ở giữa |
| `streak` | `0.85` | Độ dài vệt (0–1) |
| `brightness` | `0.95` | Độ sáng |
| `gridSize` | `12` | Kích thước ô lưới nền (px) |
| `gridOpacity` | `0.6` | Độ rõ lưới nền |
| `seed` | `1` | Đổi để có bố cục tia khác |
| `center` | `[0.5, 0.5]` | Tâm toả tia |
| `mouseInfluence` | `0.15` | Tâm tia đi theo chuột (0 = tắt) |

## Playground

`demo.html` là trang chỉnh props trực tiếp và copy ra JSX. Cần mở qua server
(vì dùng ES module), ví dụ: `npx serve .` rồi mở `/demo.html`.
