/**
 * event/listener/visualizer-display.js — TẤT CẢ listener thuộc "module Visualizer Display" (cấu
 * hình hiển thị: kiểu hiệu ứng, ảnh nền, màu sắc, kích thước bar, volume, EQ) nằm CHUNG file này.
 *
 * QUY TẮC (giống listener/player-controls.js — ẩn dụ "người gửi thư"):
 *   - Listener KHÔNG biết, KHÔNG quan tâm nội dung nghiệp vụ là gì.
 *   - Mỗi handler CHỈ làm 1 việc: gom đúng data cần gửi rồi gửi 1 message qua eventBus.send().
 *   - "Địa chỉ nhà" (msg.router) LUÔN là 'visualizerDisplay' cho mọi listener trong file này.
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * 14 input sống BÊN TRONG panel Visualizer Settings (push/pop động, core/settings-panel-stack.js)
 * ĐỔI từ listener RIÊNG LẺ trên dom-refs tĩnh sang 1 CẶP listener DUY NHẤT DELEGATE (input+change)
 * trên `settingsStackBody` — CHUẨN đã dùng từ Batch D2 (Subtitle), xem
 * `VISUALIZER_DISPLAY_INPUT_MAP` bên dưới. THÊM `btnOpenVisualizerSettings` (dời từ event/listener/
 * visualizer-misc-settings.js — cùng router với 14 input của chính nó, xem event/router/
 * visualizer-display.js).
 *
 * 5 input KHÔNG di chuyển (Main/Control Center, vẫn tĩnh, giữ NGUYÊN): btnCycleMode,
 * bgImageEnableToggle, bgBlurSlider, volumeSlider, eqSelect.
 *
 * KHÔNG tự document.getElementById trong file này — dùng lại biến đã có sẵn ở core/dom-refs.js.
 *
 * NẠP SAU CÙNG (sau bus, core/visualizer/visualizer-display.js, router/visualizer-display.js,
 * workflow/visualizer-display.js, core/settings-panel-stack.js, VÀ SAU dom-refs.js).
 */

if (btnOpenVisualizerSettings) {
    btnOpenVisualizerSettings.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.openPanel.click', payload: {} });
    });
}

if (btnCycleMode) {
    btnCycleMode.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cycleMode.click', payload: {} });
    });
}

// ===================== Ảnh nền (Main, KHÔNG di chuyển) =====================
// FIX (04/07/2026, mục 1 phản hồi Giang) — bỏ hẳn nút riêng #setting-bg-pick-library: gạt
// #setting-bg-image-enable lên "On" giờ TỰ mở picker luôn (xem
// event/workflow/visualizer-display.js::toggleBgImage) — không còn 2 control làm cùng 1 việc.
if (bgImageEnableToggle) {
    bgImageEnableToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.bgImage.toggle', payload: { enabled: e.target.checked } });
    });
}

if (bgBlurSlider) {
    bgBlurSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.bgBlur.input', payload: { value: e.target.value } });
    });
}

// ===================== Volume / EQ (Main, KHÔNG di chuyển) =====================
if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.volume.input', payload: { value: e.target.value } });
    });
}

if (eqSelect) {
    eqSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.eqMode.change', payload: { value: e.target.value } });
    });
}

// ===================== 14 input BÊN TRONG panel Visualizer Settings (delegate) =====================
// Bảng tra id -> {msg.type, event mong đợi, cách gom payload} — DÙNG CHUNG 1 cặp handler
// (input+change) thay vì 14 listener riêng lẻ trên dom-refs tĩnh (nay không còn tồn tại tĩnh nữa).
const VISUALIZER_DISPLAY_INPUT_MAP = {
    'setting-quality': { type: 'visualizerDisplay.quality.change', event: 'change' },
    'bg-color-picker': { type: 'visualizerDisplay.bgColor.input', event: 'input' },
    'setting-color-mode': { type: 'visualizerDisplay.colorMode.change', event: 'change' },
    'solid-color-picker': { type: 'visualizerDisplay.solidColor.pickerInput', event: 'input', cross: true },
    'solid-color-text': { type: 'visualizerDisplay.solidColor.textInput', event: 'input', cross: true },
    'dyn-color-a': { type: 'visualizerDisplay.dynColorA.input', event: 'input' },
    'dyn-color-b': { type: 'visualizerDisplay.dynColorB.input', event: 'input' },
    'setting-vortex-style': { type: 'visualizerDisplay.vortexStyle.change', event: 'change' },
    'setting-bar-style': { type: 'visualizerDisplay.barStyle.change', event: 'change' },
    'setting-rain-style': { type: 'visualizerDisplay.rainStyle.change', event: 'change' },
    'setting-glass-flash': { type: 'visualizerDisplay.glassFlash.change', event: 'change', checkbox: true },
    'setting-max-height': { type: 'visualizerDisplay.maxHeight.input', event: 'input', display: true },
    'setting-bar-width': { type: 'visualizerDisplay.barWidth.input', event: 'input', display: true },
    'setting-mirror-count': { type: 'visualizerDisplay.mirrorCount.input', event: 'input', display: true },
};

/** Tìm phần tử CÙNG panel (data-value-target/data-cross-target chỉ là id, không đủ để
 * document.getElementById nếu 2 panel lỡ cùng tồn tại tức thời lúc trượt animation — luôn scope
 * theo đúng panel chứa input vừa đổi). */
function findVisualizerDisplayPanelScoped(el, targetId) {
    if (!targetId) return null;
    const panel = el.closest('.settings-stack-panel');
    return panel ? panel.querySelector('#' + targetId) : null;
}

function handleVisualizerDisplayDelegatedEvent(e) {
    const entry = VISUALIZER_DISPLAY_INPUT_MAP[e.target.id];
    if (!entry || entry.event !== e.type) return; // không phải input cụm này, hoặc đúng id nhưng sai loại event (vd change bắn trên input đang nghe input)

    const payload = entry.checkbox ? { checked: e.target.checked } : { value: e.target.value };
    if (entry.display) payload.displayEl = findVisualizerDisplayPanelScoped(e.target, e.target.dataset.valueTarget);
    if (entry.cross) payload.crossEl = findVisualizerDisplayPanelScoped(e.target, e.target.dataset.crossTarget);

    eventBus.send({ router: 'visualizerDisplay', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('input', handleVisualizerDisplayDelegatedEvent);
    settingsStackBody.addEventListener('change', handleVisualizerDisplayDelegatedEvent);
}
