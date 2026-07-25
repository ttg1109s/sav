/**
 * Subtitle Style Settings — toggle "Hiện phụ đề" + 8 input style (màu nền/viền/chữ, opacity,
 * kích thước, khoảng cách dòng/chữ) trong Settings > "Tùy chỉnh Phụ đề".
 *
 * ĐÃ TÁCH từ core/equalizer-settings.js (cũ, tên file gây nhầm) — đây là cấu hình HIỂN THỊ phụ
 * đề, không liên quan EQ.
 *
 * === VIẾT LẠI TOÀN BỘ (07/07/2026, phản hồi Giang — "làm lại từ đầu") ===
 * Không đổi bản chất Rule 1-4 so với trước (mỗi hàm ghi state + đồng bộ DOM CỦA CHÍNH NÓ qua
 * `displayEl` nhận từ tham số, KHÔNG tự gọi core khác) — viết lại để loại trừ khả năng có sai sót
 * ẩn không phát hiện được qua đọc code tĩnh. `setSubtitlesEnabled()` GIỮ NGUYÊN (checkbox Main,
 * tĩnh, không thuộc panel di chuyển).
 *
 * PHẢI nạp SAU: core/config.js (vizConfig/saveConfig), core/subtitle/subtitle-display.js
 * (applySubtitleStyle/updateSubToggleUI/clearAllActiveSubBlocks).
 */

function setSubtitlesEnabled(checked) {
    appState.set('isSubtitlesEnabled', checked);
    appConfigViz.mutateAll(cfg => { cfg.subtitlesEnabled = appState.get('isSubtitlesEnabled'); });
    saveConfig();
    updateSubToggleUI();
    if (!appState.get('isSubtitlesEnabled')) clearAllActiveSubBlocks();
}

function setSubtitleStyleBgColor(value) {
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.bgColor = value; });
}

/** @param {string} rawValue @param {HTMLElement} [displayEl] */
function setSubtitleStyleBgOpacity(rawValue, displayEl) {
    const v = parseInt(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.bgOpacity = v / 100; });
    if (displayEl) displayEl.textContent = v + '%';
}

function setSubtitleStyleBorderColor(value) {
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.borderColor = value; });
}

/** @param {HTMLElement} [displayEl] */
function setSubtitleStyleBorderOpacity(rawValue, displayEl) {
    const v = parseInt(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.borderOpacity = v / 100; });
    if (displayEl) displayEl.textContent = v + '%';
}

/** @param {HTMLElement} [displayEl] */
function setSubtitleStyleBorderWidth(rawValue, displayEl) {
    const v = parseInt(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.borderWidth = v; });
    if (displayEl) displayEl.textContent = v;
}

/** @param {HTMLElement} [displayEl] */
function setSubtitleStyleBorderRadius(rawValue, displayEl) {
    const v = parseInt(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.borderRadius = v; });
    if (displayEl) displayEl.textContent = v;
}

function setSubtitleStyleTextColor(value) {
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.textColor = value; });
}

/** @param {HTMLElement} [displayEl] */
function setSubtitleStyleFontSize(rawValue, displayEl) {
    const v = parseInt(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.fontSize = v; });
    if (displayEl) displayEl.textContent = v;
}

/** @param {HTMLElement} [displayEl] */
function setSubtitleStyleLineHeight(rawValue, displayEl) {
    const v = parseFloat(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.lineHeight = v; });
    if (displayEl) displayEl.textContent = v;
}

/** @param {HTMLElement} [displayEl] */
function setSubtitleStyleLetterSpacing(rawValue, displayEl) {
    const v = parseFloat(rawValue);
    appConfigViz.mutateAll(cfg => { cfg.subtitleStyle.letterSpacing = v; });
    if (displayEl) displayEl.textContent = v;
}

/**
 * Đồng bộ UI Subtitle ở MAIN list lúc boot — CHỈ phần TĨNH (checkbox "Hiện phụ đề" + badge
 * `#sub-toggle-badge` ở Visualizer overlay). Gọi từ loadConfig() (core/config.js).
 */
function initSubtitleToggleUIFromConfig() {
    appState.set('isSubtitlesEnabled', appConfigViz.getAll().subtitlesEnabled !== false);
    if (typeof settingSubtitlesEnabled !== 'undefined' && settingSubtitlesEnabled) settingSubtitlesEnabled.checked = appState.get('isSubtitlesEnabled');
    updateSubToggleUI();
    applySubtitleStyle();
}
