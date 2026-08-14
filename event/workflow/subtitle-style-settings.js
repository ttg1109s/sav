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
 * drawer.js (renderSubtitlePanelBody), core/config.js (appConfigViz).
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

    /** Đồng bộ toggle "Hiện phụ đề" theo `appConfigViz.subtitlesEnabled` hiện tại — gọi lúc mở panel. */
    refresh() {
        if (!subtitleSettingsPanelEl) return; // guard: panel đã đóng
        subtitleSettingsPanelEl.querySelector('#setting-subtitles-enabled').checked = appConfigViz.getAll().subtitlesEnabled !== false;
    },
};
