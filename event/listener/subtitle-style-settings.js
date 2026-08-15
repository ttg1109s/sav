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
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js). MỚI (mục 4b) — cũng cần
 * core/subtitle/subtitle-transition.js (SUBTITLE_TRANSITION_MAX_MS).
 */

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', (e) => {
        if (e.target.closest('#setting-open-subtitle-panel')) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openPanel.click', payload: {} });
        }
        // MỚI (15/08/2026, mục 4a) — nút "Styling" trong panel con "Phụ đề".
        if (e.target.closest('#setting-open-subtitle-styling')) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openStyling.click', payload: {} });
        }
    });
    settingsStackBody.addEventListener('change', (e) => {
        if (e.target.id === 'setting-subtitles-enabled') {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.enable.change', payload: { checked: e.target.checked } });
        }
        // MỚI (15/08/2026, mục 4b) — 5 field Comming/In/Outing (components/subtitle-settings-
        // drawer.js::_renderSubtitleTransitionSection()) — 1 event type CHUNG, payload {field,value}
        // (field = ĐÚNG tên key vizConfig, xem setSubtitleTransitionField(), core/subtitle/
        // subtitle-style-settings.js) — tránh 5 case gần giống hệt nhau ở router.
        const transitionFieldMap = {
            'setting-subtitle-comming-effect': 'subtitleCommingEffect',
            'setting-subtitle-in-effect': 'subtitleInEffect',
            'setting-subtitle-outing-effect': 'subtitleOutingEffect',
        };
        // MỚI — Comming/Outing giờ 2 control TÁCH RIÊNG (dropdown dấu +/- + ô số ĐỘ LỚN dương,
        // "thêm dropdown tuỳ chọn +-") — đổi CÁI NÀO cũng phải đọc LẠI CẢ 2 rồi ghép thành 1 giá
        // trị mili giây CÓ DẤU trước khi ghi state (config chỉ lưu 1 số duy nhất, xem core/config.js).
        const transitionValueGroups = {
            'setting-subtitle-comming-sign': { prefix: 'comming', configField: 'subtitleCommingValueMs' },
            'setting-subtitle-comming-magnitude': { prefix: 'comming', configField: 'subtitleCommingValueMs' },
            'setting-subtitle-outing-sign': { prefix: 'outing', configField: 'subtitleOutingValueMs' },
            'setting-subtitle-outing-magnitude': { prefix: 'outing', configField: 'subtitleOutingValueMs' },
        };
        if (transitionFieldMap[e.target.id]) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.transitionField.change', payload: { field: transitionFieldMap[e.target.id], value: e.target.value } });
        } else if (transitionValueGroups[e.target.id]) {
            const group = transitionValueGroups[e.target.id];
            const signEl = settingsStackBody.querySelector(`#setting-subtitle-${group.prefix}-sign`);
            const magnitudeEl = settingsStackBody.querySelector(`#setting-subtitle-${group.prefix}-magnitude`);
            const sign = signEl && signEl.value === '-' ? -1 : 1;
            // Độ lớn nhập GIÂY thập phân, LUÔN không âm (dấu tách riêng ở dropdown) -> quy đổi
            // mili giây + kẹp cứng [0, MAX] phòng người dùng gõ tay vượt biên input (min/max HTML
            // chỉ chặn nút tăng/giảm, KHÔNG chặn gõ tay trực tiếp).
            const magnitudeMs = Math.max(0, Math.min(SUBTITLE_TRANSITION_MAX_MS, Math.round(parseFloat((magnitudeEl && magnitudeEl.value) || '0') * 1000)));
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.transitionField.change', payload: { field: group.configField, value: sign * magnitudeMs } });
        }
    });
}
