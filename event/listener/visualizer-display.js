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
 * 4 input KHÔNG di chuyển (Main/Control Center, vẫn tĩnh, giữ NGUYÊN): btnCycleMode, bgBlurSlider,
 * volumeSlider, eqSelect. (bgImageEnableToggle ĐÃ XOÁ khỏi danh sách này — 07/07/2026, HOTFIX 4:
 * checkbox không còn tồn tại, xem comment "Ảnh nền" bên dưới đã bị xoá.)
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

// (07/07/2026, HOTFIX 4 — khối listener "Ảnh nền" cho #setting-bg-image-enable ĐÃ XOÁ HẲN: checkbox
// đó không còn tồn tại trong DOM từ khi Theme 3-card thay thế section Background cũ (xem
// components/settings/theme.js) — `if (bgImageEnableToggle)` tham chiếu 1 biến CHƯA TỪNG KHAI BÁO
// (không phải `null`) nên ném `ReferenceError` ngay khi file này chạy, làm HỎNG mọi listener khai
// báo PHÍA SAU trong CÙNG file (bgBlurSlider/volumeSlider/eqSelect/14 input delegate bên dưới đều
// không được gắn). Luồng bật/tắt ảnh nền giờ đi qua card "Background" (event/listener/theme.js ->
// event/router/theme.js, VirtualMachineState chọn method -> event/workflow/theme.js::
// applyNonBackgroundMode()/pickNewBackgroundImage()/reuseExistingBackgroundImage(), ĐÃ CẬP NHẬT
// 17/07/2026 — KHÔNG còn qua workflowVisualizerDisplay.toggleBgImage() nữa, hàm đó giờ mồ côi) —
// không cần thay thế gì ở đây.

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
    // ('bg-color-picker' XOÁ — v13: màu nền dời sang panel Visual Background.)
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
    'setting-stats-panel-enable': { type: 'visualizerDisplay.statsPanelEnable.change', event: 'change', checkbox: true },
    'setting-hide-player-ui': { type: 'visualizerDisplay.hidePlayerUi.change', event: 'change', checkbox: true },
    // (Phần B, Galaxy — 5 entry spaceStyle/4 slider tinh chỉnh ĐÃ BỎ 21/07/2026, phản hồi Giang
    // mục 1 — panel tinh chỉnh Space đã xoá khỏi components/visualizer-settings-drawer.js).
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
