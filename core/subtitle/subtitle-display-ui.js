/**
 * core/subtitle/subtitle-display-ui.js — Core DOM hiển thị phụ đề lúc phát (Song mode). THAY
 * core/subtitle/subtitle-display.js cũ (processSubtitles() tự đọc appState, core gọi core, rAF trong core).
 * Mỗi hàm 1 việc; điều phối (dòng nào active, pha nào, dựng kiểu nào): event/workflow/subtitle-display.js.
 *
 * Dòng <p> KHÔNG gắn class font/màu/bóng — kế thừa hoàn toàn từ #subtitle-frame (style mặc định hoặc Element
 * Style Editor), để style tuỳ chỉnh luôn thắng.
 */

/** Dựng khối <p> cho 1 dòng thường. @param {{id: string, start: number, text: string}} sub @returns {HTMLElement} */
function buildPlainSubtitleBlockUi(sub) {
    const block = document.createElement('p');
    block.id = `sub-active-${sub.id}`;
    block.dataset.subId = sub.id;
    block.dataset.start = String(sub.start);
    block.innerHTML = sub.text.replace(/\n/g, '<br>');
    return block;
}

/** Chèn khối theo start tăng dần (dòng bắt đầu trước nằm trên). */
function insertSubtitleBlockUi(containerEl, block) {
    const start = parseFloat(block.dataset.start);
    const next = Array.from(containerEl.children).find((child) => parseFloat(child.dataset.start) > start);
    containerEl.insertBefore(block, next || null);
}

function removeSubtitleBlockUi(containerEl, subId) {
    const block = containerEl.querySelector(`#sub-active-${CSS.escape(subId)}`);
    if (block) block.remove();
}

function removeAllSubtitleBlocksUi(containerEl) {
    containerEl.replaceChildren();
}

/** Khung phụ đề chỉ chiếm chỗ khi có dòng đang hiện (hoặc hạt karaoke còn bay). */
function setSubtitleDisplayVisibleUi(displayEl, visible) {
    displayEl.classList.toggle('hidden', !visible);
}

/** Dọn class hiệu ứng In cũ + ghi pha mới. */
function markSubtitleBlockPhaseUi(block, phase) {
    block.dataset.phase = phase;
    block.classList.remove(...Object.values(SUBTITLE_IN_EFFECTS)); // core/subtitle/subtitle-transition.js (dữ liệu)
}

/** Pha Comming có hiệu ứng: đặt trạng thái ẩn (tắt transition), ép reflow, rồi chạy sang trạng thái hiện trong
 * đúng thời gian còn lại của pha (vào giữa pha do seek vẫn kết thúc đúng mốc). @param {{hiddenCss: string,
 * visibleCss: string}} fx @param {number} remainingMs */
function playSubtitleCommingUi(block, fx, remainingMs) {
    block.style.cssText = `${fx.hiddenCss};transition:none`;
    void block.offsetWidth;
    block.style.cssText = `${fx.visibleCss};transition:all ${remainingMs}ms linear`;
}

/** Pha Outing có hiệu ứng: từ hiện chạy sang ẩn trong đúng thời gian còn lại của pha. */
function playSubtitleOutingUi(block, fx, remainingMs) {
    block.style.cssText = 'opacity:1;transition:none';
    void block.offsetWidth;
    block.style.cssText = `${fx.hiddenCss};transition:all ${remainingMs}ms linear`;
}

/** Trạng thái tĩnh (hiện đầy đủ / không hiệu ứng) — `stableCss` = visibleCss của Comming nếu có (không giật khi
 * chuyển comming -> in), không thì 'opacity:1'. */
function setSubtitleBlockStableUi(block, stableCss) {
    block.style.cssText = `${stableCss};transition:none`;
}

/** Bật hiệu ứng In (class chạy liên tục suốt pha in). */
function addSubtitleInEffectUi(block, inClass) {
    block.classList.add(inClass);
}
