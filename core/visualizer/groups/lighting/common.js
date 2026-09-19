/**
 * core/visualizer/groups/lighting/common.js — Registry style con của group "lighting" (đăng ký
 * theo yêu cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng).
 * Trước đây `core/visualizer/types/lighting.js` gộp 2 style 'thunder'/'fireworks' — giờ mỗi style
 * 1 file riêng (`thunder.js`/`fireworks.js`, cùng thư mục).
 *
 * [SỬA — 19/09/2026, yêu cầu Giang] `drawLightingFlash()` ĐÃ XOÁ — chớp toàn màn hình giờ vẽ bằng
 * `drawScreenFlash()` (core/visualizer/draw/screen-flash.js, dùng chung Lighting + Rain, có cap
 * opacity), Workflow gọi trực tiếp. `flashThreshold` (ngưỡng kích hoạt chớp) + `flashMaxOpacity`
 * (trần opacity) vẫn dùng CHUNG cho cả 2 style qua customEffect.lighting.*.
 *
 * NẠP: TRƯỚC `thunder.js`/`fireworks.js`.
 */

/** Danh sách style con thuộc group "lighting" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). */
const LIGHTING_GROUP_STYLE_KEYS = ['thunder', 'fireworks'];
