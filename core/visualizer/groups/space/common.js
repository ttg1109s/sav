/**
 * core/visualizer/groups/space/common.js — Registry style con của group "space" (đăng ký theo
 * yêu cầu Giang, 05/09/2026 — tách "groups", mỗi group tự đăng ký style con + biến/cơ chế chung
 * nếu có). Hiện tại group này chỉ có 1 style: `galaxy-explore.js` (đổi tên từ "space", xem docstring
 * đầu file đó). Chưa có biến/cơ chế chung nào cần tách riêng — để trống, bổ sung khi group có ≥2
 * style thực sự dùng chung logic.
 */

/** Danh sách style con thuộc group "space" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). */
const SPACE_GROUP_STYLE_KEYS = ['galaxy-explore'];
