/**
 * Component: sub-panel "Nền chuyển sắc" (gradient) của Visual Background — MỚI (v13, phản hồi Giang
 * mục 3: "chuyển nó sang một sub panel riêng -> bên trên là hình vuông preview, bên dưới là các
 * thanh tinh chỉnh").
 *
 * TRƯỚC ĐÂY toàn bộ cụm gradient nhét thẳng vào panel "Visual Background" cha, làm panel đó dài và
 * ô xem trước bị kẹp thành 1 dải mỏng. Giờ tách hẳn, push/pop qua Settings Stack (core/settings-
 * panel-stack-ui.js) — CÙNG khuôn `renderSlideshowPanelBody()`/`renderVisualBgPanelBody()`, không
 * phát minh cơ chế mới.
 *
 * Bố cục (tham khảo card Gradient của Settings -> Giao diện, components/settings/theme.js):
 *   [ô VUÔNG xem trước, aspect-square, vẽ chính linear-gradient đang cấu hình ]
 *   [thanh trượt Góc xoay 0-360°]
 *   [danh sách 2-7 chặng màu: ô màu + thanh trượt vị trí % + nút X]
 *   [nút + Thêm chặng màu]
 *
 * Danh sách chặng vẽ ĐỘNG bởi `workflowVisualBg._refreshGradientStopRows()`; template này chỉ dựng
 * KHUNG rỗng — cùng cách `#theme-mockup-gradient` để Workflow tự cập nhật.
 *
 * MÀU: dùng `sky` (accent CHUNG của Settings, xem `peer-checked:bg-sky-500` ở các panel khác) —
 * KHÔNG dùng `fuchsia` như bản đầu (màu đó là tuỳ biến riêng của drawer Slideshow, không phải màu
 * hệ thống).
 */
function renderVisualBgGradientPanelBody() {
    return `
                <div>
                    <div class="glass-modal rounded-2xl p-4 mb-4">
                        <div id="visual-bg-gradient-preview" class="w-full aspect-square rounded-xl border border-white/15"></div>
                    </div>

                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.gradientAngle.label">${t('visualBgSettingsDrawer.gradientAngle.label')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden mb-4">
                        <div class="flex justify-between items-center gap-3 p-4">
                            <input type="range" id="setting-visual-bg-gradient-angle" min="0" max="360" step="1" class="flex-1 accent-sky-500">
                            <span id="visual-bg-gradient-angle-value" class="text-xs text-slate-400 w-12 text-right tabular-nums"></span>
                        </div>
                    </div>

                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.gradientStops.label">${t('visualBgSettingsDrawer.gradientStops.label')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div id="visual-bg-gradient-stop-list" class="flex flex-col gap-3 p-4"></div>
                        <button type="button" id="setting-visual-bg-gradient-add" class="p-4 border-t border-white/5 text-sm font-medium text-sky-400 hover:bg-white/5 transition-colors" data-i18n="visualBgSettingsDrawer.gradientStops.add">${t('visualBgSettingsDrawer.gradientStops.add')}</button>
                    </div>
                </div>
`;
}
