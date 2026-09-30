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

---

# Orb · Glyph Dither

Mở rộng từ [`<Orb />` của React Bits](https://reactbits.dev/backgrounds/orb): shader Orb gốc được
viết lại bằng WebGL thuần (không cần `ogl`), thêm tia sáng toả ra, pass **dither vạch ngang**
đổi màu tuỳ ý và tương tác chuột.

- Rê chuột vào orb: orb xoay + méo (giữ hành vi gốc `hoverIntensity`, `rotateOnHover`)
- Di chuột: vùng quanh con trỏ sáng lên (`mouseGlow`)
- Click / chạm: sóng tròn lan ra (`clickPulse`)

Copy 3 file vào project: `Orb.jsx`, `Orb.css`, `orbDither.js`.

```jsx
import Orb from './components/Orb/Orb';

<div style={{ width: '100%', height: '600px', position: 'relative' }}>
  <Orb
    hoverIntensity={0.14}
    rotateOnHover={true}
    hue={0}
    forceHoverState={false}
    backgroundColor="#100c4d"
    lineColors={['#0a14ff', '#1e6bff', '#5ef2ff']}
  />
</div>
```

Không dùng React: `import { createOrb } from './orbDither.js'` →
`const orb = createOrb(element, options)`, đổi option bằng `orb.update({...})`, huỷ bằng `orb.destroy()`.

| Prop | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `hue` | `0` | Xoay màu gốc của Orb (khi `useSourceColor` hoặc `dither={false}`) |
| `hoverIntensity` | `0.2` | Độ méo khi rê chuột |
| `rotateOnHover` | `true` | Xoay khi rê chuột vào orb |
| `forceHoverState` | `false` | Luôn ở trạng thái hover |
| `backgroundColor` | `#000000` | Màu nền |
| `lineColors` | `['#0a14ff', '#1e6bff', '#5ef2ff']` | 3 màu vạch: tối → giữa → sáng |
| `dither` | `true` | Bật/tắt hiệu ứng vạch ngang |
| `cellWidth` / `cellHeight` | `10` / `10` | Kích thước ô (px); `cellHeight` = khoảng cách giữa các vạch |
| `lineThickness` | `0.35` | Độ dày tối đa của vạch (0–1 của `cellHeight`) |
| `levels` | `4` | Số bậc độ dày / màu |
| `gap` | `0` | Khoảng hở cuối mỗi ô (px), 0 = vạch nối liền |
| `contrast` | `1.35` | >1 thì nhiều khoảng tối hơn |
| `rays` | `1` | Độ mạnh tia sáng quanh orb (0 = Orb thường) |
| `mouseGlow` | `0.8` | Độ sáng quanh con trỏ |
| `clickPulse` | `true` | Click tạo sóng |
| `useSourceColor` | `false` | Tô vạch bằng màu gốc của Orb thay vì `lineColors` |
| `transparent` | `false` | Nền trong suốt, chỉ vẽ vạch (để đè lên ảnh/nền khác) |

Playground: `orb-demo.html` (mở qua server như `demo.html`), có preset màu và nút Copy JSX.
