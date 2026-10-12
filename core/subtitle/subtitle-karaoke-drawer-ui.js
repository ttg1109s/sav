/**
 * core/subtitle/subtitle-karaoke-drawer-ui.js — thao tác DOM của waveform mini trong drawer Karaoke (subtitle-editor.html):
 * gắn chữ/tắt chạm cho region, dựng lớp núm kéo mốc chia, phản hồi "đang cầm" núm. Nhận phần tử/region qua tham số; không
 * đọc appState, không gọi core khác, không gắn sự kiện (kéo núm đi Listener ủy quyền, event/listener/subtitle-editor.js).
 *
 * NẠP SAU: không phụ thuộc gì (markup lấy từ components/subtitle-karaoke-drawer.js, do Workflow truyền vào).
 */

/** Vùng TỪ: không nhận chạm + gắn chữ của từ THẲNG vào element region — KHÔNG qua option `content` (Regions v7 tự đẩy lệch
 * `content` của các region chồng lấn, chữ các từ liền kề sẽ lệch lung tung).
 * @param {{element?: HTMLElement}} region @param {string} labelHtml - components/subtitle-karaoke-drawer.js::renderKaraokeWordRegionLabel() */
function decorateKaraokeWordRegion(region, labelHtml) {
    if (!region.element) return;
    region.element.style.pointerEvents = 'none';
    region.element.insertAdjacentHTML('beforeend', labelHtml);
}

/** Vạch mốc chia: CHỈ hiển thị, không nhận chạm (kéo mốc qua núm). @param {{element?: HTMLElement}} region */
function decorateKaraokeMarkerRegion(region) {
    if (!region.element) return;
    region.element.style.pointerEvents = 'none';
}

/** Thay toàn bộ núm trong `#karaoke-mini-knobs`. @param {HTMLElement} knobsEl
 * @param {string} knobsHtml - components/subtitle-karaoke-drawer.js::renderKaraokeKnobsHtml() */
function setKaraokeKnobsHtml(knobsEl, knobsHtml) {
    knobsEl.innerHTML = knobsHtml;
}

/** Giữ con trỏ cho núm đang kéo — ngón tay lệch khỏi núm vẫn nhận pointermove/pointerup. Trình duyệt cũ không hỗ trợ -> bỏ
 * qua (vẫn kéo được khi ngón tay còn trên núm). @param {HTMLElement} knobEl @param {number} pointerId */
function captureKaraokeKnobPointer(knobEl, pointerId) {
    try { knobEl.setPointerCapture(pointerId); } catch (err) { /* không hỗ trợ */ }
}

/** Phản hồi "đang cầm": phóng to chấm tròn của núm. @param {HTMLElement} knobEl @param {boolean} isGrabbed */
function setKaraokeKnobGrabbed(knobEl, isGrabbed) {
    if (!knobEl.firstElementChild) return;
    knobEl.firstElementChild.style.transform = isGrabbed ? 'scale(1.35)' : '';
}
