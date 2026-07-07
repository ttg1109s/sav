/**
 * event/listener/subtitle-style-settings.js — TẤT CẢ listener của cụm "subtitleStyleSettings".
 *
 * === Batch D2 (Settings restructure, 06/07/2026) ===
 * 8 input style (bgColor/bgOpacity/.../letterSpacing) giờ sống BÊN TRONG panel PUSH/POP động
 * (core/settings-panel-stack.js) — KHÔNG còn là DOM tĩnh, dom-refs.js KHÔNG còn giữ const nào cho
 * chúng (xem core/dom-refs.js). Chuyển từ 8 listener `elementConst.addEventListener(...)` RIÊNG LẺ
 * sang 1 listener DUY NHẤT DELEGATE trên `settingsStackBody` (phần tử ổn định, KHÔNG BAO GIỜ bị
 * xoá — xem components/settings-drawer.js) — CHUẨN DÙNG CHUNG cho MỌI panel còn lại từ nay
 * (Visualizer/Slideshow/File Manager sẽ theo đúng mẫu này, xem plan-v12-batch-list.md).
 *
 * `SUBTITLE_STYLE_INPUT_MAP` tra id -> {msg.type, kind}: `kind: 'value'` (input màu, không có span
 * hiển thị đi kèm) hoặc `kind: 'rawValue'` (range, CÓ span — tìm qua `data-value-target` gắn sẵn
 * trên chính input đó, xem components/subtitle-settings-drawer.js) — payload gửi kèm `displayEl`
 * (phần tử THẬT, không phải id chuỗi — eventBus.send() truyền tay nguyên object, KHÔNG serialize,
 * xem event/bus.js) để Router/Workflow không phải tự dò lại.
 *
 * `settingSubtitlesEnabled` (Main, tĩnh) + `btnOpenSubtitleSettings` (Main, tĩnh, DỜI VỀ ĐÂY từ
 * event/listener/visualizer-misc-settings.js cho gọn — cùng router với 8 input còn lại) GIỮ nguyên
 * kiểu listener trực tiếp, KHÔNG cần delegation (không bao giờ bị xoá khỏi DOM).
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

if (settingsStackBody) {
    settingsStackBody.addEventListener('input', (e) => {
        const entry = SUBTITLE_STYLE_INPUT_MAP[e.target.id];
        if (!entry) return; // không phải input của cụm này (panel khác cũng delegate qua đây)
        const payload = entry.kind === 'value' ? { value: e.target.value } : { rawValue: e.target.value };
        if (e.target.dataset.valueTarget) {
            payload.displayEl = e.target.closest('.settings-stack-panel').querySelector('#' + e.target.dataset.valueTarget);
        }
        eventBus.send({ router: 'subtitleStyleSettings', type: entry.type, payload });
    });
}
