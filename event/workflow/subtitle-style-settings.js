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
 * subtitle-style-settings.js (setSubtitleBoxCss()), core/dom-refs.js (subtitleFrame). MỚI
 * (16/08/2026, mục 3) — cũng cần core/time-picker-modal.js (openTimePickerModal(), đã nạp từ trước
 * cho Slideshow/Subtitle Editor, xem index.html).
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
     * (dropdown dấu +/- + nút ĐỘ LỚN dương, MỚI — "thêm dropdown tuỳ chọn +-") thay vì 1 input
     * số âm/dương gộp — tách `valueMs` (có dấu) thành dấu + độ lớn lúc đổ ra UI.
     * SỬA (16/08/2026, mục 3) — 2 dòng đổ độ lớn ĐỔI từ gán `.value` (input số cũ) sang gọi
     * `_syncMagnitudeButton()` (nút mới, xem hàm dưới). */
    refresh() {
        if (!subtitleSettingsPanelEl) return; // guard: panel đã đóng
        const cfg = appConfigViz.getAll();
        subtitleSettingsPanelEl.querySelector('#setting-subtitles-enabled').checked = cfg.subtitlesEnabled !== false;
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-comming-effect').value = cfg.subtitleCommingEffect || 'none';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-comming-sign').value = (cfg.subtitleCommingValueMs || 0) < 0 ? '-' : '+';
        this._syncMagnitudeButton('comming', cfg.subtitleCommingValueMs);
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-in-effect').value = cfg.subtitleInEffect || 'none';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-outing-effect').value = cfg.subtitleOutingEffect || 'none';
        subtitleSettingsPanelEl.querySelector('#setting-subtitle-outing-sign').value = (cfg.subtitleOutingValueMs || 0) < 0 ? '-' : '+';
        this._syncMagnitudeButton('outing', cfg.subtitleOutingValueMs);
    },

    /** MỚI (16/08/2026, mục 3) — gán LẠI chữ hiển thị + `data-ms` cho nút magnitude
     * (`setting-subtitle-${prefix}-magnitude`) theo 1 giá trị mili giây CÓ DẤU bất kỳ (hàm tự lấy
     * trị tuyệt đối — nút chỉ hiển thị ĐỘ LỚN, dấu đã có dropdown riêng) — DÙNG CHUNG cho cả
     * refresh() (đổ từ config lúc mở panel) LẪN openMagnitudePicker() (đổ ngay sau khi xác nhận
     * modal, xem dưới), tránh lặp lại công thức format. CÙNG format "Xs" (1 chữ số thập phân) tiền
     * lệ đã dùng cho nút Slideshow (`#setting-slideshow-transition-duration`, event/workflow/
     * slideshow.js) — nhất quán UI 2 nơi cùng dùng openTimePickerModal(format:'s-ms'). */
    _syncMagnitudeButton(prefix, valueMs) {
        if (!subtitleSettingsPanelEl) return;
        const btn = subtitleSettingsPanelEl.querySelector(`#setting-subtitle-${prefix}-magnitude`);
        if (!btn) return;
        const ms = Math.abs(valueMs || 0);
        btn.dataset.ms = String(ms);
        btn.textContent = `${(ms / 1000).toFixed(1)}s`;
    },

    /** MỚI (16/08/2026, mục 3 — Giang hỏi "sao ô nhập s không dùng timer picker modal với đơn vị
     * s:ms?") — ứng với click nút magnitude Comming/Outing (event/listener/subtitle-style-
     * settings.js) — mở modal "bánh xe cuộn số" DÙNG CHUNG (core/time-picker-modal.js), format
     * 's-ms' (CÙNG token đã dùng cho Slideshow transitionDuration — 'ms' ở đây là x100ms, KHÔNG
     * phải mili giây thật, xem docstring core/time-picker-modal.js, quy ước SẴN CÓ trong app, không
     * phải diễn giải mới). Biên [0, SUBTITLE_TRANSITION_MAX_MS] (core/subtitle/subtitle-
     * transition.js) — DẤU không nằm trong modal (đã có dropdown riêng), modal CHỈ chọn ĐỘ LỚN
     * dương, xác nhận xong mới ghép lại với dấu HIỆN CÓ trên dropdown rồi ghi thẳng qua core
     * (setSubtitleTransitionField() — CÙNG hàm router vẫn gọi thẳng cho case field khác, Workflow ở
     * đây gọi TRỰC TIẾP vì đã ở trong callback multi-step rồi, không cần vòng lại eventBus).
     * @param {'comming'|'outing'} prefix
     */
    openMagnitudePicker(prefix) {
        if (!subtitleSettingsPanelEl) return; // guard: panel đã đóng (vd đóng Settings ngay khi vừa bấm)
        const cfg = appConfigViz.getAll();
        const configField = prefix === 'comming' ? 'subtitleCommingValueMs' : 'subtitleOutingValueMs';
        const currentMs = Math.abs(cfg[configField] || 0);
        openTimePickerModal({ // core/time-picker-modal.js
            title: t(`settingsSubtitleStyle.${prefix}.label`),
            format: 's-ms',
            valueMs: currentMs,
            minMs: 0,
            maxMs: SUBTITLE_TRANSITION_MAX_MS, // core/subtitle/subtitle-transition.js
            onConfirm: (resultMs) => {
                const signEl = subtitleSettingsPanelEl && subtitleSettingsPanelEl.querySelector(`#setting-subtitle-${prefix}-sign`);
                const sign = signEl && signEl.value === '-' ? -1 : 1;
                const signedMs = sign * resultMs;
                this._syncMagnitudeButton(prefix, signedMs);
                setSubtitleTransitionField(configField, signedMs); // core
            },
        });
    },

    /** MỚI (15/08/2026, mục 4a) — nút "Styling" -> mở Element Style Editor (event/workflow/
     * element-style-editor.js) target `subtitleFrame` (khung bao mọi dòng, CHUNG — KHÔNG áp riêng
     * từng dòng). `onApply` LƯU lại chuỗi CSS (setSubtitleBoxCss(), core/subtitle/subtitle-style-
     * settings.js) rồi saveConfig() NGAY, để survive qua reload (CÙNG UX "lưu bền ngay" của Filter/
     * Scope, không đợi rời Settings).
     * SỬA (16/08/2026, mục 2 — Giang yêu cầu "cung cấp cấu hình mặc định giống hiện tại khi bật
     * styling editor") — truyền THÊM `appConfigViz.getAll().subtitleBoxCss` làm `initialCssString`
     * (tham số MỚI của open(), xem event/workflow/element-style-editor.js) — Drawer giờ tự NẠP LẠI
     * khớp đúng giá trị ĐÃ LƯU trước đó (nếu có) thay vì luôn mở trắng mỗi lần, đúng UX "mở lại thấy
     * lại đúng cấu hình cũ" — rỗng ('' mặc định, core/config.js) thì hành vi CŨ giữ nguyên (mở trắng). */
    openStyling() {
        workflowElementStyleEditor.open(subtitleFrame, (cssString) => {
            setSubtitleBoxCss(cssString); // core
            saveConfig();
        }, appConfigViz.getAll().subtitleBoxCss);
    },
};
