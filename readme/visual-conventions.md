# Quy ước BẮT BUỘC khi viết / sửa một Visual (từ ver 6, đường dẫn cập nhật ver 11)

Mọi visual trong `core/visualizer/types/*.js` PHẢI hỗ trợ đầy đủ 4 nhóm cấu hình chung dưới đây.
Đây là hợp đồng chung — visual nào bỏ sót sẽ bị coi là lỗi:

1. **Video nền (`vizConfig.videoBgEnabled`)** — khi BẬT, visual KHÔNG được tô một lớp nền đục phủ
   kín canvas (sky/background fill) đè lên video. Hãy bọc mọi lệnh
   `fillRect(0,0,canvas.width,canvas.height)` mang tính "nền" trong
   `if (!appState.get('vizConfig').videoBgEnabled) { ... }` để video hiện xuyên qua (mẫu: cả
   `drawRainGlass` lẫn `drawRainStreet` trong `rain.js`). Các phần tử tiền cảnh (thanh, hạt, đèn,
   mặt đất...) vẫn vẽ đè bình thường lên trên video.
2. **Màu nền (`vizConfig.bgColor`)** — khi KHÔNG dùng video, nền phải theo `bgColor` người dùng
   chọn (qua `updateDOMBackground()` cho body, và/hoặc lệnh fill nền trong chính visual).
3. **Chế độ màu (`vizConfig.mode` = `solid` | `dynamic` | `rainbow/auto`)** — màu của các phần tử
   vẽ phải lấy từ helper màu chung (`getComputedColor()` / `interpolateColor()` /
   `vizConfig.solidColor` / `dynA`-`dynB`) thay vì hard-code, để nhất quán với lựa chọn người dùng.
4. **Hiệu năng (`vizConfig.quality` + `PERFORMANCE_PROFILES`)** — số lượng phần tử (hạt, thanh,
   tia...) phải co giãn theo `perf` được truyền vào hàm vẽ, để máy yếu vẫn chạy mượt.

**[v11] Cách đọc `vizConfig` — BẮT BUỘC qua `appState.get('vizConfig')`, không còn biến `vizConfig`
trần nào để đọc trực tiếp** (đã migrate 100% qua `service/state.js`, xem
[changelog/v11.md](./changelog/v11.md) mục 3). Trong 1 hàm vẽ gọi nhiều lần/khung hình, đọc 1 lần
ra biến cục bộ đầu hàm (`const cfg = appState.get('vizConfig');`) rồi dùng `cfg.xxx` trong toàn hàm
— KHÔNG gọi `appState.get('vizConfig')` lặp lại nhiều lần trong cùng 1 vòng lặp vẽ (đúng khuyến
nghị hiệu năng hot path 60fps của `service/state.js`). `PERFORMANCE_PROFILES`/`MODES` [v11] đã
migrate sang `CONST` (`service/state.js`) — đọc qua `CONST.PERFORMANCE_PROFILES`/`CONST.MODES`,
không còn bản local trong `core/config.js` nữa. Property LỒNG BÊN TRONG (`CONST.PERFORMANCE_PROFILES[quality].stars`/`.streetRain`/`.tunnelRings`...)
giữ nguyên như cũ, chỉ tên hằng số ngoài cùng đổi.

Khi thêm visual mới: đăng ký hàm vẽ vào `VISUALIZER_DRAWERS` trong
`core/visualizer/draw-visualizer.js`, thêm tên `type` vào `MODES` (`core/config.js`), và tự kiểm 4
mục trên trước khi coi là hoàn tất. Nếu visual mới cần đọc/ghi biến runtime riêng (kiểu
`beatTimes`/`stars`/`rubikCubes`...), khai thêm key vào `STATE_SCHEMA` (`service/state.js`) thay vì
tự khai `let` cục bộ mới trong file visual — xem quy ước STATE ở
[changelog/v11.md](./changelog/v11.md) mục 3.

## Ghi chú cho visual WebGL (Vortex, Space "Galaxy Journey") — bổ sung 21/07/2026

`VISUALIZER_DRAWERS` (mục "Khi thêm visual mới" ở trên) ĐÃ DỜI sang
`event/workflow/visualizer-render.js` từ 20/07/2026 (plan-space-galaxy.md Phần A,
`core/visualizer/draw-visualizer.js` nay RỖNG) — đăng ký hàm vẽ 2D mới ở object đó thay vì file cũ.
2 visual dùng canvas WebGL riêng (`#webgl-canvas`, dùng CHUNG 1 `tRenderer`) KHÔNG nằm trong bảng
`VISUALIZER_DRAWERS` (xử lý riêng bằng `if/else` ngay trong `_tick()`), nhưng VẪN PHẢI tuân đủ 4
mục ở trên — cách áp dụng có khác biệt so với visual canvas 2D thường:

1. **Video nền** — TỰ ĐỘNG thoả mãn: `tRenderer` khởi tạo với `alpha: true`
   (`core/webgl/three-vortex.js`), scene KHÔNG set `scene.background`, nên phần khung hình không
   có mesh nào che phủ luôn trong suốt, video nền hiện xuyên qua bình thường — KHÔNG cần thêm
   `if (!videoBgEnabled)` như visual 2D.
2. **Màu nền** — TỰ ĐỘNG thoả mãn cùng lý do trên: nền THẬT SỰ là CSS/body (`updateDOMBackground()`
   theo `bgColor`), canvas WebGL trong suốt để lộ ra.
3. **Chế độ màu (`mode`)** — PHẢI tự áp dụng trong code sinh màu của visual, KHÔNG tự động như 2
   mục trên. FIX (21/07/2026, phản hồi Giang mục 4 — Space từng bỏ sót mục này, luôn dùng
   `dynA`/`dynB` bất kể `mode`): xem `pickGalaxyPalette()` (`core/webgl/three-space.js`) —
   `mode === 'solid'` dùng `solidColor` cho cả colorIn/colorOut, `dynamic`/`gradient` dùng
   `dynA`/`dynB` (gradient còn hue-shift theo `globalHueOffset` mỗi frame, xem
   `GalaxyCluster.update()`). Vortex hiện KHÔNG đổi màu theo `mode` (nợ kỹ thuật cũ, chưa đụng tới).
4. **Hiệu năng** — `PERFORMANCE_PROFILES` áp dụng bình thường (`galaxyStarsMin/Max`,
   `galaxyNebulaCount`, `galaxyDustCount` cho Space; `stars`/`tunnelRings` cho Vortex).

← [Quay lại README](../README.md)
