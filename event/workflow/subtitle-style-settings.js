/**
 * event/workflow/subtitle-style-settings.js — "THẰNG THỰC THI CUỐI" của router
 * "subtitleStyleSettings".
 *
 * === VIẾT LẠI TOÀN BỘ (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung box, xoá toàn bộ tuỳ
 * chọn... vẫn cấp cho subtitle một sub panel ở trong Display Visualizer") === 10 method set* (màu
 * nền/viền/chữ, opacity, cỡ chữ, line/letter-spacing) ĐÃ XOÁ cùng 10 input tương ứng
 * (components/subtitle-settings-drawer.js). `openPanel()` GIỮ NGUYÊN Ý NGHĨA (push panel con) —
 * chỉ khác NƠI GỌI: trước đây từ nút tĩnh ở Main list, giờ từ nút `#setting-open-subtitle-panel`
 * NESTED bên trong panel "Display" (components/settings/visualizer-display-panel.js), qua
 * delegation trên `settingsStackBody` (xem event/listener/subtitle-style-settings.js).
 * `enable.change` KHÔNG cần method riêng ở đây nữa — router gọi THẲNG core
 * `setSubtitlesEnabled()` (1 hàm core, đúng quy ước "router gọi thẳng").
 *
 * NẠP SAU: core/settings-panel-stack.js (pushSettingsPanel), components/subtitle-settings-
 * drawer.js (renderSubtitlePanelBody), core/config.js (appConfigViz). MỚI (mục 4a) — cũng cần
 * event/workflow/element-style-editor.js (workflowElementStyleEditor.open()), core/subtitle/
 * subtitle-style-settings.js (setSubtitleBoxCss()), core/dom-refs.js (subtitleFrame).
 */
let subtitleSettingsPanelEl = null; // panel Subtitle đang mở — null nếu đang đóng

const workflowSubtitleStyleSettings = {

    /** Ứng với msg.type = 'subtitleStyleSettings.openPanel.click' — push panel con + đồng bộ 1
     * toggle từ config hiện tại. */
    openPanel() {
        subtitleSettingsPanelEl = pushSettingsPanel({
            title: t('subtitleSettingsDrawer.title'),
            bodyHtml: renderSubtitlePanelBody(),
        });
        this.refresh();
    },

    /** Đồng bộ toggle "Hiện phụ đề" + MỚI (mục 4b) 5 field Comming/In/Outing theo
     * `appConfigViz` hiện tại — gọi lúc mở panel. 2 field Comming/Outing giờ TÁCH 2 control
     * (dropdown dấu +/- + ô số ĐỘ LỚN dương, MỚI — "thêm dropdown tuỳ chọn +-") thay vì 1 input
     * số âm/dương gộp — tách `valueMs` (có dấu) thành dấu + độ lớn (giây) lúc đổ ra UI. */
    refresh() {
        if (!subtitleSettingsPanelEl) return; // guard: panel đã đóng
        const cfg = appConfigViz.getAll();
        subtitleSettingsPanelEl.querySelector('#setting-subtitles-enabled').checked = cfg.subtitlesEnabled !== false;
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-comming-effect').value = cfg.subtitleCommingEffect || 'none';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-comming-sign').value = (cfg.subtitleCommingValueMs || 0) < 0 ? '-' : '+';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-comming-magnitude').value = Math.abs(cfg.subtitleCommingValueMs || 0) / 1000;
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-in-effect').value = cfg.subtitleInEffect || 'none';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-outing-effect').value = cfg.subtitleOutingEffect || 'none';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-outing-sign').value = (cfg.subtitleOutingValueMs || 0) < 0 ? '-' : '+';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-outing-magnitude').value = Math.abs(cfg.subtitleOutingValueMs || 0) / 1000;
    },

    /** MỚI (15/08/2026, mục 4a) — nút "Styling" -> mở Element Style Editor (event/workflow/
     * element-style-editor.js) target `subtitleFrame` (khung bao mọi dòng, CHUNG — KHÔNG áp riêng
     * từng dòng). `onApply` LƯU lại chuỗi CSS (setSubtitleBoxCss(), core/subtitle/subtitle-style-
     * settings.js) rồi saveConfig() NGAY, để survive qua reload (CÙNG UX "lưu bền ngay" của Filter/
     * Scope, không đợi rời Settings). */
    openStyling() {
        workflowElementStyleEditor.open(subtitleFrame, (cssString) => {
            setSubtitleBoxCss(cssString); // core
            saveConfig();
        });
    },
};
