/**
 * event/listener/subtitle-style-settings.js — TẤT CẢ listener của cụm "subtitleStyleSettings".
 *
 * === VIẾT LẠI TOÀN BỘ (07/07/2026) — xem docstring event/workflow/subtitle-style-settings.js. ===
 * Đơn giản hoá: payload chỉ còn `value`/`rawValue`/`checked` thuần — KHÔNG còn tính `displayEl`
 * ở đây nữa (workflow tự tìm qua `subtitleSettingsPanelEl`).
 *
 * `settingSubtitlesEnabled` (Main, tĩnh) + `btnOpenSubtitleSettings` (Main, tĩnh) dùng listener
 * trực tiếp, KHÔNG cần delegation. 8 input BÊN TRONG panel dùng delegation trên `settingsStackBody`.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (typeof settingSubtitlesEnabled !== 'undefined' && settingSubtitlesEnabled) {
    settingSubtitlesEnabled.addEventListener('change', (e) => {
        eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.enable.change', payload: { checked: e.target.checked } });
    });
}

if (typeof btnOpenSubtitleSettings !== 'undefined' && btnOpenSubtitleSettings) {
    btnOpenSubtitleSettings.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openPanel.click', payload: {} });
    });
}

const SUBTITLE_STYLE_INPUT_MAP = {
    'setting-sub-bg-color': { type: 'subtitleStyleSettings.bgColor.input', kind: 'value' },
    'setting-sub-bg-opacity': { type: 'subtitleStyleSettings.bgOpacity.input', kind: 'rawValue' },
    'setting-sub-border-color': { type: 'subtitleStyleSettings.borderColor.input', kind: 'value' },
    'setting-sub-border-opacity': { type: 'subtitleStyleSettings.borderOpacity.input', kind: 'rawValue' },
    'setting-sub-border-width': { type: 'subtitleStyleSettings.borderWidth.input', kind: 'rawValue' },
    'setting-sub-border-radius': { type: 'subtitleStyleSettings.borderRadius.input', kind: 'rawValue' },
    'setting-sub-text-color': { type: 'subtitleStyleSettings.textColor.input', kind: 'value' },
    'setting-sub-font-size': { type: 'subtitleStyleSettings.fontSize.input', kind: 'rawValue' },
    'setting-sub-line-height': { type: 'subtitleStyleSettings.lineHeight.input', kind: 'rawValue' },
    'setting-sub-letter-spacing': { type: 'subtitleStyleSettings.letterSpacing.input', kind: 'rawValue' },
};

function handleSubtitleStyleSettingsDelegatedInput(e) {
    const entry = SUBTITLE_STYLE_INPUT_MAP[e.target.id];
    if (!entry) return; // không phải input của cụm này
    const payload = entry.kind === 'value' ? { value: e.target.value } : { rawValue: e.target.value };
    eventBus.send({ router: 'subtitleStyleSettings', type: entry.type, payload });
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('input', handleSubtitleStyleSettingsDelegatedInput);
}
