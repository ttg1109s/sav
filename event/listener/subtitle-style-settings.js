/**
 * event/listener/subtitle-style-settings.js — TẤT CẢ listener của cụm "subtitleStyleSettings".
 *
 * === VIẾT LẠI (mục 2, phản hồi Giang — "vẫn cấp cho subtitle một sub panel ở trong Display
 * Visualizer") === CẢ 2 control giờ đều SỐNG ĐỘNG (không còn gì tĩnh ở Main list nữa):
 *   - `#setting-open-subtitle-panel` — nested BÊN TRONG panel "Display" (components/settings/
 *     visualizer-display-panel.js, cụm `visualizerDisplay`, KHÁC router — bình thường, 1 panel có
 *     thể chứa nút mở sang router/cụm khác).
 *   - `#setting-subtitles-enabled` — bên trong panel con "Phụ đề" (components/subtitle-settings-
 *     drawer.js), push TỪ nút trên.
 * 8 input style CŨ (bgColor/bgOpacity/.../letterSpacing) ĐÃ XOÁ cùng `SUBTITLE_STYLE_INPUT_MAP`.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', (e) => {
        if (e.target.closest('#setting-open-subtitle-panel')) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openPanel.click', payload: {} });
        }
    });
    settingsStackBody.addEventListener('change', (e) => {
        if (e.target.id === 'setting-subtitles-enabled') {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.enable.change', payload: { checked: e.target.checked } });
        }
    });
}
