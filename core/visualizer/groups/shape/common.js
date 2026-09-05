/**
 * core/visualizer/groups/shape/common.js — Registry style con của group "shape" (đăng ký theo
 * yêu cầu Giang, 05/09/2026 — tách "groups"). Hiện tại group này chỉ có 1 style: `rubik.js`
 * (Rubik's Cube, chuyển từ đứng riêng — trước đây `core/visualizer/types/rubik.js` — vào group
 * "shape"). Chưa có biến/cơ chế chung nào cần tách riêng — để trống, bổ sung khi group có ≥2 style
 * thực sự dùng chung logic (vd 1 style hình khối khác trong tương lai).
 */

/** Danh sách style con thuộc group "shape" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). */
const SHAPE_GROUP_STYLE_KEYS = ['rubik'];
