/**
 * event/listener/subtitle-style-settings.js — Listener cụm "subtitleStyleSettings": delegation trên
 * genericDrawerBody (panel Components Display có #setting-subtitles-enabled; panel Subtitles
 * dựng bởi components/subtitle-settings-drawer.js). Chỉ đọc giá trị control rồi gửi message.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, dom-refs). Cần core/subtitle/subtitle-transition.js
 * (SUBTITLE_TRANSITION_MAX_MS), core/subtitle/subtitle-style-settings.js (bảng id -> field karaoke).
 */
const SUBTITLE_SETTINGS_DEFAULT_FIELDS = {
    'setting-subtitle-default-fontsize': { field: 'subtitleDefaultFontSize', read: (el) => parseInt(el.value, 10) },
    'setting-subtitle-default-color': { field: 'subtitleDefaultColor', read: (el) => el.value },
};
const SUBTITLE_SETTINGS_TRANSITION_FIELDS = {
    'setting-subtitle-comming-effect': 'subtitleCommingEffect',
    'setting-subtitle-in-effect': 'subtitleInEffect',
    'setting-subtitle-outing-effect': 'subtitleOutingEffect',
};
/** Dropdown dấu +/-: đọc lại độ lớn đang có ở data-ms của nút magnitude rồi ghép thành ms có dấu. */
const SUBTITLE_SETTINGS_SIGN_GROUPS = {
    'setting-subtitle-comming-sign': { prefix: 'comming', field: 'subtitleCommingValueMs' },
    'setting-subtitle-outing-sign': { prefix: 'outing', field: 'subtitleOutingValueMs' },
};

function _sendSubtitleSettings(type, payload) {
    eventBus.send({ router: 'subtitleStyleSettings', type: `subtitleStyleSettings.${type}`, payload });
}

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', (e) => {
        // (05/10/2026) Bỏ '#setting-open-subtitle-panel' -> 'openPanel.click' — nút đã gỡ, Subtitles mở qua row
        // 'subtitle' của Visualizer Screen (router 'appSettings', data-app-settings-nav).
        if (e.target.closest('#setting-open-subtitle-styling')) _sendSubtitleSettings('openStyling.click', {});
        const magnitudeBtn = e.target.closest('#setting-subtitle-comming-magnitude, #setting-subtitle-outing-magnitude');
        if (magnitudeBtn) _sendSubtitleSettings('openMagnitudePicker.click', { prefix: magnitudeBtn.id.includes('comming') ? 'comming' : 'outing' });
    });

    genericDrawerBody.addEventListener('change', (e) => {
        const id = e.target.id;
        if (id === 'setting-subtitles-enabled') _sendSubtitleSettings('enable.change', { checked: e.target.checked });
        if (id === 'setting-subtitle-use-custom-styling') _sendSubtitleSettings('useCustomStyling.change', { checked: e.target.checked });
        const defaultSpec = SUBTITLE_SETTINGS_DEFAULT_FIELDS[id];
        if (defaultSpec) _sendSubtitleSettings('defaultField.change', { field: defaultSpec.field, value: defaultSpec.read(e.target) });
        if (SUBTITLE_SETTINGS_TRANSITION_FIELDS[id]) _sendSubtitleSettings('transitionField.change', { field: SUBTITLE_SETTINGS_TRANSITION_FIELDS[id], value: e.target.value });
        const signGroup = SUBTITLE_SETTINGS_SIGN_GROUPS[id];
        if (signGroup) {
            const magnitudeEl = genericDrawerBody.querySelector(`#setting-subtitle-${signGroup.prefix}-magnitude`);
            const magnitudeMs = Math.max(0, Math.min(SUBTITLE_TRANSITION_MAX_MS, parseFloat((magnitudeEl && magnitudeEl.dataset.ms) || '0')));
            _sendSubtitleSettings('transitionField.change', { field: signGroup.field, value: (e.target.value === '-' ? -1 : 1) * magnitudeMs });
        }
        // Karaoke — dropdown + toggle (màu + thanh trượt đi qua 'input' bên dưới để thấy ngay khi kéo).
        if (SUBTITLE_KARAOKE_CONTROL_FIELDS[id] && e.target.type !== 'color') _sendSubtitleSettings('karaokeField.change', { field: SUBTITLE_KARAOKE_CONTROL_FIELDS[id], value: e.target.value });
        if (SUBTITLE_KARAOKE_TOGGLE_FIELDS[id]) _sendSubtitleSettings('karaokeField.change', { field: SUBTITLE_KARAOKE_TOGGLE_FIELDS[id], value: e.target.checked });
    });

    genericDrawerBody.addEventListener('input', (e) => {
        const id = e.target.id;
        const rangeSpec = SUBTITLE_KARAOKE_RANGE_FIELDS[id];
        if (rangeSpec) _sendSubtitleSettings('karaokeField.change', { field: rangeSpec.field, value: parseFloat(e.target.value) });
        if (id === 'setting-subtitle-karaoke-color') _sendSubtitleSettings('karaokeField.change', { field: 'subtitleKaraokeColor', value: e.target.value });
    });
}
