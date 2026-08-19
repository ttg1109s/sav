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
 *
 * SỬA (16/08/2026, mục 3) — 2 nút magnitude (`setting-${prefix}-magnitude`, components/
 * subtitle-settings-drawer.js) ĐỔI từ `<input type="number">` (event 'change') sang `<button>`
 * (event 'click', mở modal picker DÙNG CHUNG — xem workflowSubtitleStyleSettings.openMagnitudePicker(),
 * event/workflow/subtitle-style-settings.js) — 2 entry tương ứng ĐÃ CHUYỂN khỏi
 * `transitionValueGroups` (nhánh 'change') SANG click handler riêng bên dưới. Nhánh 'change' của
 * dropdown DẤU (+/-) VẪN GIỮ, chỉ đổi NGUỒN đọc độ lớn từ `magnitudeEl.value` (input số cũ) sang
 * `magnitudeEl.dataset.ms` (button MỚI tự giữ mili giây hiện có qua thuộc tính `data-ms`, do
 * Workflow đồng bộ mỗi lần đổi — xem `_syncMagnitudeButton()`, event/workflow/subtitle-style-
 * settings.js).
 *
 * MỚI (16/08/2026, mục 3 tiếp) — toggle `#setting-subtitle-use-custom-styling` (>1 bước -> Workflow)
 * + 2 field mặc định `#setting-subtitle-default-fontsize`/`#setting-subtitle-default-color` (1 hàm
 * core -> gọi thẳng, CÙNG quy ước `transitionField.change`).
 */

if (genericDrawerBody) { // SỬA (đợt migrate Visualizer Screen) — settingsStackBody nay thuộc Photo
    genericDrawerBody.addEventListener('click', (e) => {
        if (e.target.closest('#setting-open-subtitle-panel')) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openPanel.click', payload: {} });
        }
        // MỚI (15/08/2026, mục 4a) — nút "Styling" trong panel con "Phụ đề".
        if (e.target.closest('#setting-open-subtitle-styling')) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openStyling.click', payload: {} });
        }
        // MỚI (16/08/2026, mục 3) — 2 nút magnitude Comming/Outing -> mở modal picker (>1 bước,
        // xem docstring đầu file) — router chuyển thẳng Workflow, KHÔNG xử lý ở đây.
        const magnitudeBtn = e.target.closest('#setting-subtitle-comming-magnitude, #setting-subtitle-outing-magnitude');
        if (magnitudeBtn) {
            const prefix = magnitudeBtn.id.includes('comming') ? 'comming' : 'outing';
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.openMagnitudePicker.click', payload: { prefix } });
        }
    });
    genericDrawerBody.addEventListener('change', (e) => {
        if (e.target.id === 'setting-subtitles-enabled') {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.enable.change', payload: { checked: e.target.checked } });
        }
        // MỚI (16/08/2026, mục 3) — toggle "Custom styling" — >1 bước (ghi config + ẩn/hiện nút
        // Styling/2 field mặc định trong panel) -> Workflow, KHÁC `enable.change` ngay trên (CHỈ
        // ghi config, checkbox tự phản ánh trạng thái của chính nó, không cần đụng UI khác).
        if (e.target.id === 'setting-subtitle-use-custom-styling') {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.useCustomStyling.change', payload: { checked: e.target.checked } });
        }
        // MỚI (16/08/2026, mục 3 — "nếu là mặc định cho phép chỉnh cỡ chữ 8-16px, cho phép chỉnh
        // color") — 2 field CHỈ hiện lúc Custom TẮT — 1 event type CHUNG (CÙNG PRECEDENT
        // transitionFieldMap ngay dưới), router gọi thẳng core (1 hàm, không đụng UI nào khác).
        const defaultFieldMap = {
            'setting-subtitle-default-fontsize': 'subtitleDefaultFontSize',
            'setting-subtitle-default-color': 'subtitleDefaultColor',
        };
        if (defaultFieldMap[e.target.id]) {
            const isNumeric = e.target.id === 'setting-subtitle-default-fontsize';
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.defaultField.change', payload: { field: defaultFieldMap[e.target.id], value: isNumeric ? parseInt(e.target.value, 10) : e.target.value } });
        }
        // MỚI (15/08/2026, mục 4b) — 3 dropdown effect (components/subtitle-settings-drawer.js::
        // _renderSubtitleTransitionSection()) — 1 event type CHUNG, payload {field,value}
        // (field = ĐÚNG tên key vizConfig, xem setSubtitleTransitionField(), core/subtitle/
        // subtitle-style-settings.js) — tránh 3 case gần giống hệt nhau ở router.
        const transitionFieldMap = {
            'setting-subtitle-comming-effect': 'subtitleCommingEffect',
            'setting-subtitle-in-effect': 'subtitleInEffect',
            'setting-subtitle-outing-effect': 'subtitleOutingEffect',
        };
        // Dropdown DẤU (+/-, "thêm dropdown tuỳ chọn +-") — đổi dấu phải đọc LẠI độ lớn hiện có
        // (giờ nằm ở `data-ms` của nút magnitude, xem docstring đầu file) rồi ghép thành 1 giá trị
        // mili giây CÓ DẤU trước khi ghi state (config chỉ lưu 1 số duy nhất, xem core/config.js).
        const transitionSignGroups = {
            'setting-subtitle-comming-sign': { prefix: 'comming', configField: 'subtitleCommingValueMs' },
            'setting-subtitle-outing-sign': { prefix: 'outing', configField: 'subtitleOutingValueMs' },
        };
        if (transitionFieldMap[e.target.id]) {
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.transitionField.change', payload: { field: transitionFieldMap[e.target.id], value: e.target.value } });
        } else if (transitionSignGroups[e.target.id]) {
            const group = transitionSignGroups[e.target.id];
            const magnitudeEl = genericDrawerBody.querySelector(`#setting-subtitle-${group.prefix}-magnitude`);
            const sign = e.target.value === '-' ? -1 : 1;
            // `data-ms` LUÔN đã kẹp sẵn [0, MAX] từ lúc modal picker ghi vào (openMagnitudePicker(),
            // event/workflow/subtitle-style-settings.js) — kẹp lại đây CHỈ là lớp phòng thủ thêm,
            // không còn ý nghĩa "phòng gõ tay vượt biên" như input số cũ (nút bấm không gõ tay được).
            const magnitudeMs = Math.max(0, Math.min(SUBTITLE_TRANSITION_MAX_MS, parseFloat((magnitudeEl && magnitudeEl.dataset.ms) || '0')));
            eventBus.send({ router: 'subtitleStyleSettings', type: 'subtitleStyleSettings.transitionField.change', payload: { field: group.configField, value: sign * magnitudeMs } });
        }
    });
}
