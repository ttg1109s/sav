/**
 * Component (sub-template): Settings Drawer — Section "Kiểu hiệu ứng" (rút gọn).
 *
 * Ver 8 refine (mục 3): toàn bộ "Hình học Visualizer" + "Màu sắc Visualizer" (Chất lượng Render,
 * độ cao/độ dày thanh, kiểu Vortex/Bar/Rain, màu nền/màu sóng âm — rất nhiều control) ĐÃ CHUYỂN
 * sang `components/visualizer-settings-drawer.js` — Batch D3 (06/07/2026) đổi tiếp file đó từ
 * template tĩnh (`TPL_VISUALIZER_SETTINGS_DRAWER`) sang hàm `renderVisualizerPanelBody()`, PUSH
 * ĐỘNG vào Settings Stack (core/settings-panel-stack.js) thay vì mount 1 lần lúc boot. File này
 * (vẫn giữ tên cũ + biến TPL_SETTINGS_VISUALIZER để không phải sửa object điều phối SettingsDrawer
 * ở settings-drawer.js) giờ chỉ còn 1 card:
 *
 * CARD — "Visualizer" (kiểu hiệu ứng):
 *   - select "Kiểu hiệu ứng" (#setting-visualizer-type) — chọn TRỰC TIẾP 1 trong 6 visual,
 *     thay cho việc phải bấm nút cycle (#btn-cycle-mode) nhiều lần mới tới đúng kiểu muốn —
 *     đây là phần người dùng cần "ngay trong giao diện", không phải mở drawer mới thấy.
 *   - nút "Tùy chỉnh Visualizer" mở drawer chứa phần còn lại (Chất lượng Render, hình học chi
 *     tiết theo từng kiểu, màu sắc, VÀ "Tự động đổi hiệu ứng" — xem mục dưới).
 *   - toggle "Hiện Visual" (#setting-visual-enable) — ver 10 refine: CHUYỂN VÀO ĐÂY từ section
 *     riêng "Hiệu ứng Visualizer" (trước nằm ở js/components/settings/playlist-background.js) —
 *     mọi setting liên quan tới HIỂN THỊ hiệu ứng (kiểu/tuỳ chỉnh/bật-tắt) giờ nằm 1 nơi. Lưu ý:
 *     đây KHÁC nút "Đổi hiệu ứng" (#btn-cycle-mode) ở Control Center của Visualizer UI — nút đó
 *     vẫn giữ nguyên, dùng để đổi NHANH sang kiểu hiệu ứng kế tiếp, không phải bật/tắt. id giữ
 *     nguyên `setting-visual-enable` — JS xử lý ở state-and-video-bg.js không cần đổi gì.
 *
 * FIX (ver 10 refine #2 — gộp "Tự động đổi hiệu ứng" vào đúng nhóm tuỳ chỉnh visualizer): card
 * "Tự động đổi hiệu ứng" (thêm mới ở ver 10) trước đây nằm NGAY TRONG Settings chính (ở đây) —
 * SAI VỊ TRÍ vì đây là 1 thiết lập NÂNG CAO của visualizer, không phải thứ người dùng cần thấy
 * ngay khi mở Settings. Đã CHUYỂN HẲN sang `js/components/visualizer-settings-drawer.js` (drawer
 * "Tùy chỉnh Visualizer", mở qua nút #setting-open-visualizer-settings ở card trên) — đúng đúng
 * nhóm với Chất lượng Render/Hình học/Màu sắc, tất cả đều là tuỳ chỉnh chi tiết cho visualizer.
 * Toàn bộ id/JS xử lý (js/core/auto-switch-visual.js) giữ nguyên, không đổi gì. Batch D3
 * (06/07/2026): section "Tự động đổi hiệu ứng" giờ push/pop động cùng panel Visualizer Settings
 * (core/settings-panel-stack.js) — đồng bộ giá trị lúc mở nằm ở
 * `workflowVisualizerDisplay.openPanel()`, KHÔNG còn `initAutoSwitchVisualUI()` (đổi tên/tách nhỏ,
 * xem core/auto-switch-visual.js).
 *
 * MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — thêm nút "#setting-open-slideshow-settings"
 * NGAY DƯỚI toggle "Hiện Visual" (vị trí CHỐT ở plan-v12-multimedia-update-3.md mục 3), mở
 * Slideshow Settings Drawer riêng (components/slideshow-settings-drawer.js, cụm router
 * "slideshowSettings" — event/listener,router/slideshow.js).
 */
const TPL_SETTINGS_VISUALIZER = `

        <!-- SECTION: KIỂU HIỆU ỨNG (rút gọn, ver 8 refine) -->
        <!-- Tái tổ chức (07/07/2026, phản hồi Giang mục 1) — ĐÚNG khuôn "Tiêu đề -> Sub setting ->
             Action": 2 sub setting (Kiểu hiệu ứng select + Hiện Visual toggle) đứng TRƯỚC, 2 nút
             điều hướng (Tùy chỉnh Visualizer + Slideshow background) đứng SAU — trước đây xen kẽ
             (select -> nav -> toggle -> nav), sai khuôn. -->
        <div>
            <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsVisualizer.sectionTitle">${t('settingsVisualizer.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsVisualizer.type.label">${t('settingsVisualizer.type.label')}</span>
                    <select id="setting-visualizer-type" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                        <option value="bar" data-i18n="settingsVisualizer.type.bar">${t('settingsVisualizer.type.bar')}</option>
                        <option value="lightning" data-i18n="settingsVisualizer.type.lightning">${t('settingsVisualizer.type.lightning')}</option>
                        <option value="rubik" data-i18n="settingsVisualizer.type.rubik">${t('settingsVisualizer.type.rubik')}</option>
                        <option value="vortex" data-i18n="settingsVisualizer.type.vortex">${t('settingsVisualizer.type.vortex')}</option>
                        <option value="black hole" data-i18n="settingsVisualizer.type.blackHole">${t('settingsVisualizer.type.blackHole')}</option>
                        <option value="rain" data-i18n="settingsVisualizer.type.rain">${t('settingsVisualizer.type.rain')}</option>
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.visualEnable.label">${t('settingsVisualizer.visualEnable.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsVisualizer.visualEnable.hint">${t('settingsVisualizer.visualEnable.hint')}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-visual-enable" class="sr-only peer" checked>
                        <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                    </label>
                </div>
                <button id="setting-open-visualizer-settings" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.openDrawer.label">${t('settingsVisualizer.openDrawer.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.openDrawer.hint">${t('settingsVisualizer.openDrawer.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <!-- MỚI (Batch 8, slideshow nền Visual) — nút điều hướng thứ 2, đứng NGAY SAU nút
                     điều hướng đầu (cùng nhóm "Action" — xem docstring tái tổ chức ở trên). -->
                <button id="setting-open-slideshow-settings" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-fuchsia-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 4h10a2 2 0 012 2v10M4 8v10a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2z" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.slideshowSetting.label">${t('settingsVisualizer.slideshowSetting.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.slideshowSetting.hint">${t('settingsVisualizer.slideshowSetting.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
`;
