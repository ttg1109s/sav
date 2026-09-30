/**
 * core/subtitle/subtitle-style-settings.js — Core ghi cài đặt phụ đề + áp style khung #subtitle-frame.
 * Mỗi hàm 1 việc, không đọc appState, không gọi core khác, không saveConfig() (Workflow lo lưu + điều phối:
 * event/workflow/subtitle-style-settings.js, event/workflow/subtitle-display.js).
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
