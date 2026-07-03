/**
 * event/listener/visualizer-display.js — TẤT CẢ listener thuộc "module Visualizer Display" (cấu
 * hình hiển thị: kiểu hiệu ứng, ảnh nền, màu sắc, kích thước bar, volume, EQ) nằm CHUNG file này.
 *
 * QUY TẮC (giống listener/player-controls.js — ẩn dụ "người gửi thư"):
 *   - Listener KHÔNG biết, KHÔNG quan tâm nội dung nghiệp vụ là gì.
 *   - Mỗi handler CHỈ làm 1 việc: gom đúng data cần gửi rồi gửi 1 message qua eventBus.send().
 *   - "Địa chỉ nhà" (msg.router) LUÔN là 'visualizerDisplay' cho mọi listener trong file này.
 *
 * FIX (03/07/2026, mục 1) — #setting-bg-upload (input file upload trực tiếp) ĐÃ XOÁ, thay bằng nút
 * #setting-bg-pick-library mở picker chọn ảnh có sẵn trong File Manager (cùng cụm
 * 'visualizerDisplay', xem event/router,workflow/visualizer-display.js).
 *
 * KHÔNG tự document.getElementById trong file này — dùng lại biến đã có sẵn ở core/dom-refs.js.
 *
 * NẠP SAU CÙNG (sau bus, core/visualizer/visualizer-display.js, router/visualizer-display.js, workflow/
 * visualizer-display.js, VÀ SAU dom-refs.js) — cần cả eventBus.send() và mọi biến DOM đã sẵn sàng
 * trước khi gắn addEventListener.
 */

if (btnCycleMode) {
    btnCycleMode.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cycleMode.click', payload: {} });
    });
}

if (qualitySelect) {
    qualitySelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.quality.change', payload: { value: e.target.value } });
    });
}

// ===================== Ảnh nền =====================
// FIX (03/07/2026, mục 1) — bỏ hẳn listener upload file trực tiếp (#setting-bg-upload đã xoá khỏi
// HTML), đổi sang nút mở picker chọn ảnh có sẵn trong File Manager.
if (btnSettingBgPickLibrary) {
    btnSettingBgPickLibrary.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.bgImage.pickFromLibrary', payload: {} });
    });
}

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

// ===================== Màu sắc =====================
if (bgColorPicker) {
    bgColorPicker.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.bgColor.input', payload: { value: e.target.value } });
    });
}

if (colorModeSelect) {
    colorModeSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.colorMode.change', payload: { value: e.target.value } });
    });
}

if (solidColorPicker) {
    solidColorPicker.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.solidColor.pickerInput', payload: { value: e.target.value } });
    });
}

if (solidColorText) {
    solidColorText.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.solidColor.textInput', payload: { value: e.target.value } });
    });
}

if (dynColorA) {
    dynColorA.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.dynColorA.input', payload: { value: e.target.value } });
    });
}

if (dynColorB) {
    dynColorB.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.dynColorB.input', payload: { value: e.target.value } });
    });
}

// ===================== Style con theo từng kiểu hiệu ứng =====================
if (vortexStyleSelect) {
    vortexStyleSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.vortexStyle.change', payload: { value: e.target.value } });
    });
}

if (barStyleSelect) {
    barStyleSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.barStyle.change', payload: { value: e.target.value } });
    });
}

if (rainStyleSelect) {
    rainStyleSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.rainStyle.change', payload: { value: e.target.value } });
    });
}

if (glassFlashToggle) {
    glassFlashToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.glassFlash.change', payload: { checked: e.target.checked } });
    });
}

// ===================== Kích thước bar/mirror =====================
if (maxHeightSlider) {
    maxHeightSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.maxHeight.input', payload: { value: e.target.value } });
    });
}

if (barWidthSlider) {
    barWidthSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.barWidth.input', payload: { value: e.target.value } });
    });
}

if (mirrorCountSlider) {
    mirrorCountSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.mirrorCount.input', payload: { value: e.target.value } });
    });
}

// ===================== Volume / EQ =====================
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
