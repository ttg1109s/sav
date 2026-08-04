/**
 * core/image-zoom.js — Core THUẦN, bọc Panzoom (timmywil, CDN). Dùng chung cho mọi modal cần
 * zoom/pan — Zoom mode xem Ảnh (view-only, luôn reset khi thoát) và modal xem Video (đọc lại
 * scale/pan để lưu, xem `getPanzoomState()`).
 *
 * AUDIT wrapper thư viện ngoài (readme/core-function-conventions.md, Rule 3d) — cô lập Panzoom để
 * sau này đổi thư viện chỉ sửa THÂN các hàm dưới, giữ nguyên chữ ký, nơi gọi không cần sửa gì.
 *
 * Session = instance Panzoom, Workflow tự giữ tham chiếu.
 * NẠP SAU: Panzoom (CDN, global `Panzoom`).
 */

/** @param {HTMLElement} el @param {object} [options] - options gốc Panzoom (maxScale/minScale/contain/cursor/...).
 * @returns {any} session */
function initPanzoomSession(el, options) {
    return Panzoom(el, options); // factory function, không phải constructor
}

/** Huỷ session — `session.destroy()` một mình không dọn hết style (bug timmywil/panzoom#554), phải
 * `reset({animate:false})` trước để đưa transform về mặc định, rồi `resetStyle()` dọn nốt overflow/
 * cursor. @param {any} session */
function destroyPanzoomSession(session) {
    session.reset({ animate: false });
    session.destroy();
    session.resetStyle();
}

/** Đưa về scale/pan mặc định, không huỷ session. @param {any} session */
function resetPanzoomSession(session) {
    session.reset();
}

/** Đọc lại scale/pan hiện tại — không reset/destroy gì. Dùng khi cần lưu lại vị trí zoom/pan (vd
 * modal xem Video lúc Lưu/Lưu mới). @param {any} session @returns {{scale: number, x: number, y: number}} */
function getPanzoomState(session) {
    const pan = session.getPan();
    return { scale: session.getScale(), x: pan.x, y: pan.y };
}
