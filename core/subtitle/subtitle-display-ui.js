/**
 * core/subtitle/subtitle-display-ui.js — Core DOM hiển thị phụ đề lúc phát (Song). Mỗi hàm 1 việc; điều phối (dòng nào
 * hiện, pha nào, ghim ra sao): event/workflow/subtitle-display.js.
 *
 * Dòng <p> không gắn class font/màu/bóng — kế thừa từ #subtitle-frame (style mặc định hoặc Element Style Editor).
 * 2 lớp Web Animation trên mỗi dòng, khác thuộc tính nên không đè nhau:
 *   - `sub-phase` (opacity/transform) — Comming/Outing, ghim theo thời gian media (pinSubtitlePhaseAnimationUi()).
 *   - `sub-reflow` (translate) — dòng khác thêm/bớt làm dòng này xê dịch: trượt mượt từ chỗ cũ (FLIP).
 */
const SUBTITLE_PHASE_ANIMATION_ID = 'sub-phase';
const SUBTITLE_REFLOW_ANIMATION_ID = 'sub-reflow';
const SUBTITLE_REFLOW_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

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

/** @returns {HTMLElement|null} */
function findSubtitleBlockUi(containerEl, subId) {
    return containerEl.querySelector(`#sub-active-${CSS.escape(subId)}`);
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

/** Ghi pha mới: dọn class hiệu ứng In + huỷ hiệu ứng pha cũ. Pha không đổi -> giữ nguyên.
 * @returns {boolean} true = vừa đổi pha */
function markSubtitleBlockPhaseUi(block, phase) {
    if (block.dataset.phase === phase) return false;
    block.dataset.phase = phase;
    block.classList.remove(...Object.values(SUBTITLE_IN_EFFECTS)); // core/subtitle/subtitle-transition.js (dữ liệu)
    block.getAnimations().filter((a) => a.id === SUBTITLE_PHASE_ANIMATION_ID).forEach((a) => a.cancel());
    return true;
}

/** Ghim hiệu ứng pha (tạo lần đầu, các lần sau chỉ chỉnh): đặt đúng tiến độ, theo tốc độ phát, chạy hoặc đứng yên.
 * @param {HTMLElement} block @param {Keyframe[]} keyframes @param {string} easing
 * @param {{durationMs: number, elapsedMs: number, running: boolean}} pin - computeSubtitlePhasePin()
 * @param {number} playbackRate */
function pinSubtitlePhaseAnimationUi(block, keyframes, easing, pin, playbackRate) {
    const anim = block.getAnimations().find((a) => a.id === SUBTITLE_PHASE_ANIMATION_ID)
        || block.animate(keyframes, { duration: pin.durationMs, easing, fill: 'both', id: SUBTITLE_PHASE_ANIMATION_ID });
    anim.playbackRate = playbackRate;
    if (pin.running) anim.play(); else anim.pause();
    anim.currentTime = pin.elapsedMs; // đặt SAU play/pause — lệnh đó chỉ có hiệu lực ở khung hình kế, đặt trước sẽ trôi thêm 1 khung
}

/** Bật hiệu ứng In (class chạy liên tục suốt pha in). */
function addSubtitleInEffectUi(block, inClass) {
    block.classList.add(inClass);
}

/** Vị trí đang NHÌN THẤY (kể cả đang trượt dở) của từng dòng — chụp trước khi thêm/bớt dòng.
 * @returns {Map<string, number>} subId -> top (px) */
function measureSubtitleBlockTopsUi(containerEl) {
    return new Map(Array.from(containerEl.children).map((block) => [block.dataset.subId, block.getBoundingClientRect().top]));
}

/** Huỷ các lần trượt dở — để đo đúng vị trí bố cục mới. */
function cancelSubtitleReflowUi(containerEl) {
    Array.from(containerEl.children).forEach((block) => {
        block.getAnimations().filter((a) => a.id === SUBTITLE_REFLOW_ANIMATION_ID).forEach((a) => a.cancel());
    });
}

/** FLIP: dòng nào có vị trí cũ thì trượt từ chỗ cũ về chỗ mới (dòng mới thêm không trượt). Gọi sau
 * cancelSubtitleReflowUi(). @param {Map<string, number>} beforeTops @param {number} durationMs */
function playSubtitleReflowUi(containerEl, beforeTops, durationMs) {
    Array.from(containerEl.children).forEach((block) => {
        if (!beforeTops.has(block.dataset.subId)) return;
        const dy = beforeTops.get(block.dataset.subId) - block.getBoundingClientRect().top;
        if (Math.abs(dy) < 0.5) return;
        block.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: durationMs, easing: SUBTITLE_REFLOW_EASING, id: SUBTITLE_REFLOW_ANIMATION_ID });
    });
}
