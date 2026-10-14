/**
 * core/subtitle/subtitle-style-settings.js — Core ghi cài đặt phụ đề, áp style khung #subtitle-frame, tính + đổ giá trị panel
 * Settings > Subtitles. Mỗi hàm 1 việc, không đọc appState/config, không gọi core khác, không saveConfig() (Workflow lo lưu +
 * điều phối: event/workflow/subtitle-style-settings.js, event/workflow/subtitle-display.js).
 */

/** Ghi 1 field phụ đề trong vizConfig — `field` chỉ lập chỉ mục khoá (không rẽ tiến trình). */
function setSubtitleVizField(field, value) {
    appConfigViz.mutateAll((cfg) => { cfg[field] = value; });
}

/** Cờ bật/tắt hiển thị phụ đề (appState). */
function setSubtitlesEnabledState(enabled) {
    appState.set('isSubtitlesEnabled', enabled);
    console.log(`writer: "setSubtitlesEnabledState", page: "isSubtitlesEnabled", content: "${enabled}"`);
}

/** Xoá sạch style inline cũ của khung (tránh sót thuộc tính của chế độ trước khi áp lại). */
function resetSubtitleFrameStyle(frameEl) {
    frameEl.removeAttribute('style');
}

/** Style mặc định (Custom styling TẮT): chỉ màu + cỡ chữ; font-weight/line-height/bóng lấy từ class tĩnh
 * `.subtitle-default-appearance` + `.sub-text-glow` (assets/css/base.css). */
function applySubtitleFrameDefaultStyle(frameEl, color, fontSizePx) {
    frameEl.style.setProperty('color', color);
    frameEl.style.setProperty('font-size', `${fontSizePx}px`);
}

/** Khoá control karaoke trong panel Settings -> field vizConfig (dùng chung cho đồng bộ UI; listener có bảng riêng
 * kèm cách đọc giá trị). */
const SUBTITLE_KARAOKE_CONTROL_FIELDS = {
    'setting-subtitle-karaoke-mode': 'subtitleKaraokeMode',
    'setting-subtitle-karaoke-dissolve': 'subtitleKaraokeDissolve',
    'setting-subtitle-karaoke-color': 'subtitleKaraokeColor',
    'setting-subtitle-karaoke-effect': 'subtitleKaraokeActiveEffect',
    'setting-subtitle-karaoke-squash': 'subtitleKaraokeSquashDirection',
    'setting-subtitle-karaoke-pointer-shape': 'subtitleKaraokePointerShape',
};
const SUBTITLE_KARAOKE_TOGGLE_FIELDS = {
    'setting-subtitle-karaoke-enabled': 'subtitleKaraokeEnabled',
    'setting-subtitle-karaoke-outline': 'subtitleKaraokeOutline',
    'setting-subtitle-karaoke-pointer': 'subtitleKaraokePointer',
};
/** Thanh trượt: nhãn giá trị = value x scale + suffix. */
const SUBTITLE_KARAOKE_RANGE_FIELDS = {
    'setting-subtitle-karaoke-outline-width': { field: 'subtitleKaraokeOutlineWidth', scale: 1, suffix: 'px' },
    'setting-subtitle-karaoke-outline-opacity': { field: 'subtitleKaraokeOutlineOpacity', scale: 100, suffix: '%' },
    'setting-subtitle-karaoke-outline-glow': { field: 'subtitleKaraokeOutlineGlow', scale: 100, suffix: '%' },
    'setting-subtitle-karaoke-outline-blur': { field: 'subtitleKaraokeOutlineBlur', scale: 1, suffix: 'px' },
};

/** Đổ giá trị cấu hình karaoke vào các control trong panel. @param {Object} cfg vizConfig */
function syncSubtitleKaraokeSettingsUi(panelEl, cfg) {
    Object.entries(SUBTITLE_KARAOKE_CONTROL_FIELDS).forEach(([id, field]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.value = cfg[field];
    });
    Object.entries(SUBTITLE_KARAOKE_TOGGLE_FIELDS).forEach(([id, field]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.checked = !!cfg[field];
    });
    Object.entries(SUBTITLE_KARAOKE_RANGE_FIELDS).forEach(([id, spec]) => {
        const el = panelEl.querySelector(`#${id}`);
        const label = panelEl.querySelector(`#${id}-value`);
        if (el) el.value = String(cfg[spec.field]);
        if (label) label.textContent = `${Math.round(cfg[spec.field] * spec.scale * 10) / 10}${spec.suffix}`;
    });
}

/** Ẩn/hiện các hàng phụ thuộc của khối Karaoke. @param {Object} vis resolveKaraokeSettingsVisibility() */
function applySubtitleKaraokeSettingsVisibilityUi(panelEl, vis) {
    const rows = {
        'setting-subtitle-karaoke-body': vis.body,
        'setting-subtitle-karaoke-dissolve-row': vis.dissolve,
        'setting-subtitle-karaoke-squash-row': vis.squashDir,
        'setting-subtitle-karaoke-outline-params': vis.outlineParams,
        'setting-subtitle-karaoke-pointer-shape-row': vis.pointerShape,
    };
    Object.entries(rows).forEach(([id, visible]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.classList.toggle('hidden', !visible);
    });
}

/** Field vizConfig chứa giá trị (ms, có dấu) của Comming/Outing theo tiền tố control. */
const SUBTITLE_TRANSITION_VALUE_FIELD_BY_PREFIX = { comming: 'subtitleCommingValueMs', outing: 'subtitleOutingValueMs' };

/** THUẦN — độ lớn của 1 giá trị Comming/Outing (ms có dấu): `ms` = |giá trị|, `label` = "X.Xs". @param {number} valueMs
 * @returns {{ms:number, label:string}} */
function computeSubtitleTransitionMagnitude(valueMs) {
    const ms = Math.abs(valueMs || 0);
    return { ms, label: `${(ms / 1000).toFixed(1)}s` };
}

/** THUẦN — ghép dấu đang chọn ('-' | '+') với độ lớn vừa chọn thành ms có dấu. @param {string} sign @param {number} magnitudeMs */
function computeSignedSubtitleTransitionMs(sign, magnitudeMs) {
    return (sign === '-' ? -1 : 1) * magnitudeMs;
}

/** THUẦN — giá trị các control của panel Subtitles (phần ngoài Karaoke và 2 nút độ lớn) từ vizConfig, có mặc định cho data
 * cũ thiếu field. @param {object} cfg vizConfig */
function computeSubtitleStylePanelView(cfg) {
    return {
        useCustomStyling: !!cfg.subtitleUseCustomStyling,
        defaultFontSize: cfg.subtitleDefaultFontSize || 16,
        defaultColor: cfg.subtitleDefaultColor || '#ffffff',
        commingEffect: cfg.subtitleCommingEffect || 'none',
        commingSign: (cfg.subtitleCommingValueMs || 0) < 0 ? '-' : '+',
        inEffect: cfg.subtitleInEffect || 'none',
        outingEffect: cfg.subtitleOutingEffect || 'none',
        outingSign: (cfg.subtitleOutingValueMs || 0) < 0 ? '-' : '+',
    };
}

/** Bật Custom styling -> hiện nút Styling, ẩn 2 field mặc định; tắt thì ngược lại. @param {HTMLElement} panelEl @param {boolean} useCustom */
function setSubtitleCustomStylingVisibilityUi(panelEl, useCustom) {
    const stylingBtn = panelEl.querySelector('#setting-open-subtitle-styling');
    const defaultFields = panelEl.querySelector('#setting-subtitle-default-fields');
    if (stylingBtn) stylingBtn.classList.toggle('hidden', !useCustom);
    if (defaultFields) defaultFields.classList.toggle('hidden', useCustom);
}

/** Nút độ lớn Comming/Outing: chữ "X.Xs" + giữ mili giây ở `data-ms`. @param {HTMLElement} panelEl @param {'comming'|'outing'} prefix
 * @param {{ms:number, label:string}} magnitude */
function setSubtitleTransitionMagnitudeUi(panelEl, prefix, magnitude) {
    const btn = panelEl.querySelector(`#setting-subtitle-${prefix}-magnitude`);
    if (!btn) return;
    btn.dataset.ms = String(magnitude.ms);
    btn.textContent = magnitude.label;
}

/** Đổ giá trị các control của panel Subtitles (ẩn/hiện Custom styling và 2 nút độ lớn ghi riêng). @param {HTMLElement} panelEl
 * @param {ReturnType<typeof computeSubtitleStylePanelView>} view */
function syncSubtitleStylePanelUi(panelEl, view) {
    const values = {
        'setting-subtitle-default-fontsize': view.defaultFontSize,
        'setting-subtitle-default-color': view.defaultColor,
        'setting-subtitle-comming-effect': view.commingEffect,
        'setting-subtitle-comming-sign': view.commingSign,
        'setting-subtitle-in-effect': view.inEffect,
        'setting-subtitle-outing-effect': view.outingEffect,
        'setting-subtitle-outing-sign': view.outingSign,
    };
    const customToggle = panelEl.querySelector('#setting-subtitle-use-custom-styling');
    if (customToggle) customToggle.checked = view.useCustomStyling;
    Object.entries(values).forEach(([id, value]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.value = value;
    });
}
