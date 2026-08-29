/**
 * Component: sub-panel "Nền chuyển sắc" (gradient) của Visual Background — MỚI (v13, phản hồi Giang
 * mục 3: "chuyển nó sang một sub panel riêng -> bên trên là hình vuông preview, bên dưới là các
 * thanh tinh chỉnh").
 *
 * TRƯỚC ĐÂY toàn bộ cụm gradient nhét thẳng vào panel "Visual Background" cha, làm panel đó dài và
 * ô xem trước bị kẹp thành 1 dải mỏng. Giờ tách hẳn, push/pop qua Settings Stack (core/settings-
 * panel-stack-ui.js) — CÙNG khuôn `renderVisualBgPanelBody()`, không phát minh cơ chế mới.
 *
 * Bố cục (tham khảo card Gradient của Settings -> Giao diện, components/settings/theme.js):
 *   [ô VUÔNG xem trước, aspect-square, vẽ chính linear-gradient đang cấu hình ]
 *   [thanh trượt Góc xoay 0-360°]
 *   [danh sách 2-7 chặng màu: ô màu + thanh trượt vị trí % + nút X]
 *   [nút + Thêm chặng màu]
 *   [MỚI 12/08/2026 — "Movement": bật/tắt + mode Time/Audio + input riêng từng mode]
 *   [MỚI 12/08/2026 — "Color swap": bật/tắt + 2 nút mở time-picker (khoảng tráo/thời gian chuyển)]
 *
 * LƯU Ý: ô preview vuông ở đầu panel CHỈ vẽ gradient TĨNH (angle/stops LƯU DB), KHÔNG chạy animation
 * Movement trực tiếp trong preview — hiệu ứng THẬT chỉ thấy trên nền màn Visualizer khi Movement
 * đang bật (event/workflow/visual-bg.js::_tickGradientMovement()), giữ preview đơn giản/nhẹ.
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

                    <!-- MỚI (12/08/2026, Giang yêu cầu mục 6) — "Movement": gradient tự xoay/dao
                         động thay vì đứng yên. 2 mode LOẠI TRỪ NHAU (chỉ 1 chạy tại 1 thời điểm,
                         xem event/workflow/visual-bg.js::_tickGradientMovement()):
                           'time'  — góc xoay chạy ĐỀU, hết 1 vòng 360° sau X giây (picker).
                           'audio' — góc xoay + độ giãn stop DAO ĐỘNG giữa 2 mốc, theo smoothedEnergy
                                     (core/audio-analysis.js — đã làm mượt, hợp driving hiệu ứng nền
                                     liên tục, xem phân tích chọn thông số ở docstring
                                     core/config.js::DEFAULT_VISUAL_BG_CONFIG.gradientMovement). -->
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="visualBgSettingsDrawer.gradientMovement.label">${t('visualBgSettingsDrawer.gradientMovement.label')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden mb-4">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.enable.label">${t('visualBgSettingsDrawer.gradientMovement.enable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualBgSettingsDrawer.gradientMovement.enable.hint">${t('visualBgSettingsDrawer.gradientMovement.enable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-visual-bg-gradient-movement-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div id="visual-bg-gradient-movement-options" class="hidden flex-col">
                            <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.mode.label">${t('visualBgSettingsDrawer.gradientMovement.mode.label')}</span>
                                <select id="setting-visual-bg-gradient-movement-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="time" data-i18n="visualBgSettingsDrawer.gradientMovement.mode.time">${t('visualBgSettingsDrawer.gradientMovement.mode.time')}</option>
                                    <option value="audio" data-i18n="visualBgSettingsDrawer.gradientMovement.mode.audio">${t('visualBgSettingsDrawer.gradientMovement.mode.audio')}</option>
                                </select>
                            </div>

                            <div id="visual-bg-gradient-movement-time-block" class="hidden flex-col">
                                <button type="button" id="setting-visual-bg-gradient-movement-open-duration" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                                    <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.duration.label">${t('visualBgSettingsDrawer.gradientMovement.duration.label')}</span>
                                    <span id="visual-bg-gradient-movement-duration-value" class="text-xs text-slate-300 font-mono"></span>
                                </button>
                            </div>

                            <div id="visual-bg-gradient-movement-audio-block" class="hidden flex-col">
                                <div class="p-4 border-b border-white/5">
                                    <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.audioRotate.label">${t('visualBgSettingsDrawer.gradientMovement.audioRotate.label')}</span>
                                    <div class="flex items-center gap-2 mt-2">
                                        <span class="text-xs text-slate-400 shrink-0" data-i18n="visualBgSettingsDrawer.gradientMovement.rangeFrom">${t('visualBgSettingsDrawer.gradientMovement.rangeFrom')}</span>
                                        <input type="number" id="setting-visual-bg-gradient-movement-audio-rotate-from" min="0" max="360" step="1" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-right">
                                        <span class="text-xs text-slate-400 shrink-0" data-i18n="visualBgSettingsDrawer.gradientMovement.rangeTo">${t('visualBgSettingsDrawer.gradientMovement.rangeTo')}</span>
                                        <input type="number" id="setting-visual-bg-gradient-movement-audio-rotate-to" min="0" max="360" step="1" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-right">
                                    </div>
                                </div>
                                <div class="p-4">
                                    <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.audioSpread.label">${t('visualBgSettingsDrawer.gradientMovement.audioSpread.label')}</span>
                                    <div class="flex items-center gap-2 mt-2">
                                        <span class="text-xs text-slate-400 shrink-0" data-i18n="visualBgSettingsDrawer.gradientMovement.rangeFrom">${t('visualBgSettingsDrawer.gradientMovement.rangeFrom')}</span>
                                        <input type="number" id="setting-visual-bg-gradient-movement-audio-spread-from" min="0" max="50" step="1" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-right">
                                        <span class="text-xs text-slate-400 shrink-0" data-i18n="visualBgSettingsDrawer.gradientMovement.rangeTo">${t('visualBgSettingsDrawer.gradientMovement.rangeTo')}</span>
                                        <input type="number" id="setting-visual-bg-gradient-movement-audio-spread-to" min="0" max="50" step="1" class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-right">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.gradientMovement.colorSwapSectionTitle">${t('visualBgSettingsDrawer.gradientMovement.colorSwapSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.colorSwapEnable.label">${t('visualBgSettingsDrawer.gradientMovement.colorSwapEnable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualBgSettingsDrawer.gradientMovement.colorSwapEnable.hint">${t('visualBgSettingsDrawer.gradientMovement.colorSwapEnable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-visual-bg-gradient-colorswap-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div id="visual-bg-gradient-colorswap-options" class="hidden flex-col">
                            <button type="button" id="setting-visual-bg-gradient-colorswap-open-interval" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.colorSwapInterval.label">${t('visualBgSettingsDrawer.gradientMovement.colorSwapInterval.label')}</span>
                                <span id="visual-bg-gradient-colorswap-interval-value" class="text-xs text-slate-300 font-mono"></span>
                            </button>
                            <button type="button" id="setting-visual-bg-gradient-colorswap-open-transition" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.gradientMovement.colorSwapTransition.label">${t('visualBgSettingsDrawer.gradientMovement.colorSwapTransition.label')}</span>
                                <span id="visual-bg-gradient-colorswap-transition-value" class="text-xs text-slate-300 font-mono"></span>
                            </button>
                        </div>
                    </div>
                </div>
`;
}
