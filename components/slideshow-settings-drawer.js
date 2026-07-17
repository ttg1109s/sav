/**
 * Component: Slideshow Settings panel body ("Cài đặt nền Slideshow") — Batch 8 (03/07/2026), VIẾT
 * LẠI Batch 9 (04/07/2026, mục 4 phản hồi Giang):
 *   1. GỘP 2 section cũ ("Album" + "Cách chiếu") thành 1 section DUY NHẤT.
 *   2. Bỏ 2 nút "Chọn Album"/"Tắt" — thay bằng 1 cần gạt DUY NHẤT "#setting-slideshow-enable": gạt
 *      "On" TỰ mở panel chọn Album ngay (giống 3 toggle nền Video/Ảnh đã sửa ở mục 1 — cùng ngày);
 *      huỷ/đóng panel không chọn gì -> tự gạt về "off".
 *   3. VIẾT LẠI LẦN 2 (Giai đoạn 4, rewrite Photo/Album, mục 1, Giang yêu cầu "bỏ modal đi mà áp
 *      dụng gentic drawer") — panel chọn Album ĐỔI HẲN từ "notify center" tĩnh (mount sẵn lúc boot)
 *      sang Generic Drawer ĐỘNG (core/generic-drawer.js) — xem event/workflow/slideshow.js::
 *      openAlbumPicker(). File NÀY (component) không còn markup panel chọn Album nào cả.
 *
 * === Batch D4 (Settings restructure, tiếp D1/D2/D3) ===
 * TRƯỚC ĐÂY `TPL_SLIDESHOW_SETTINGS_DRAWER` gộp CẢ khung `fixed inset-0 drawer-glass z-[90]` LẪN
 * panel chọn Album (2 phần tử ĐỘC LẬP mount ở z-[130]/[131], không lồng trong khung trên — xem
 * comment gốc). Tách làm 2:
 *   - `renderSlideshowPanelBody()` — 6 input (enable/mode/photoPerSong/interval/transition/
 *     kenBurns — Ken Burns TÁCH KHỎI transition select thành toggle riêng, 18/07/2026), PUSH ĐỘNG
 *     vào Settings Stack (core/settings-panel-stack.js), giống About/Subtitle/Visualizer.
 *   - Panel chọn Album — ĐÃ ĐỔI SANG Generic Drawer động (Giai đoạn 4, xem mục 3 ngay trên) —
 *     KHÔNG còn `TPL_SLIDESHOW_ALBUM_PICKER` mount tĩnh nào ở file này nữa.
 *
 * Logic: event/workflow/slideshow.js (workflowSlideshow); listener/router: cụm "slideshowSettings"
 * (event/listener,router/slideshow.js).
 */
function renderSlideshowPanelBody() {
    return `
                <!-- SECTION DUY NHẤT (Batch 9 — gộp 2 section cũ) -->
                <div>
                    <h3 class="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2 ml-2" data-i18n="slideshowSettingsDrawer.sectionTitle">${t('slideshowSettingsDrawer.sectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">

                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.enable.label">${t('slideshowSettingsDrawer.enable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.enable.hint">${t('slideshowSettingsDrawer.enable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-500 shadow-inner"></div>
                            </label>
                        </div>

                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.mode.label">${t('slideshowSettingsDrawer.mode.label')}</span>
                            <select id="setting-slideshow-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="sequential" data-i18n="slideshowSettingsDrawer.mode.sequential">${t('slideshowSettingsDrawer.mode.sequential')}</option>
                                <option value="random" data-i18n="slideshowSettingsDrawer.mode.random">${t('slideshowSettingsDrawer.mode.random')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.photoPerSong.label">${t('slideshowSettingsDrawer.photoPerSong.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.photoPerSong.hint">${t('slideshowSettingsDrawer.photoPerSong.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-photo-per-song" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div id="slideshow-interval-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div>
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.interval.label">${t('slideshowSettingsDrawer.interval.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.interval.hint">${t('slideshowSettingsDrawer.interval.hint')}</div>
                            </div>
                            <input id="setting-slideshow-interval" type="number" min="5" step="1" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-20 text-right shrink-0">
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transition.label">${t('slideshowSettingsDrawer.transition.label')}</span>
                            <select id="setting-slideshow-transition" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <option value="fade" data-i18n="slideshowSettingsDrawer.transition.fade">${t('slideshowSettingsDrawer.transition.fade')}</option>
                                <option value="slideLeft" data-i18n="slideshowSettingsDrawer.transition.slideLeft">${t('slideshowSettingsDrawer.transition.slideLeft')}</option>
                                <option value="slideRight" data-i18n="slideshowSettingsDrawer.transition.slideRight">${t('slideshowSettingsDrawer.transition.slideRight')}</option>
                                <option value="zoomIn" data-i18n="slideshowSettingsDrawer.transition.zoomIn">${t('slideshowSettingsDrawer.transition.zoomIn')}</option>
                                <option value="zoomOut" data-i18n="slideshowSettingsDrawer.transition.zoomOut">${t('slideshowSettingsDrawer.transition.zoomOut')}</option>
                                <option value="wipe" data-i18n="slideshowSettingsDrawer.transition.wipe">${t('slideshowSettingsDrawer.transition.wipe')}</option>
                                <option value="flip" data-i18n="slideshowSettingsDrawer.transition.flip">${t('slideshowSettingsDrawer.transition.flip')}</option>
                                <option value="blur" data-i18n="slideshowSettingsDrawer.transition.blur">${t('slideshowSettingsDrawer.transition.blur')}</option>
                                <option value="rotateFade" data-i18n="slideshowSettingsDrawer.transition.rotateFade">${t('slideshowSettingsDrawer.transition.rotateFade')}</option>
                                <option value="curtain" data-i18n="slideshowSettingsDrawer.transition.curtain">${t('slideshowSettingsDrawer.transition.curtain')}</option>
                                <option value="circleReveal" data-i18n="slideshowSettingsDrawer.transition.circleReveal">${t('slideshowSettingsDrawer.transition.circleReveal')}</option>
                                <option value="glitch" data-i18n="slideshowSettingsDrawer.transition.glitch">${t('slideshowSettingsDrawer.transition.glitch')}</option>
                            </select>
                        </div>
                        <!-- MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — toggle ĐỘC LẬP, TÁCH khỏi
                             select Transition ngay trên (trước đây 'kenburns' là 1 option trong đó,
                             chọn nó là khoá cứng transition về fade — giờ Ken Burns dùng ĐƯỢC cùng
                             lúc với BẤT KỲ kiểu transition nào). Mặc định OFF. -->
                        <div class="flex justify-between items-center p-4">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.kenBurns.label">${t('slideshowSettingsDrawer.kenBurns.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.kenBurns.hint">${t('slideshowSettingsDrawer.kenBurns.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-kenburns" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-500 shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                </div>
`;
}

// ===================== ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — Panel chọn Album kiểu
// "notify center" tĩnh =========================================================================
// `TPL_SLIDESHOW_ALBUM_PICKER` (bản trước ở đây, mount tĩnh 1 lần lúc boot) XOÁ HẲN — panel chọn
// Album giờ dùng Generic Drawer ĐỘNG (core/generic-drawer.js), dựng lúc cần qua
// event/workflow/slideshow.js::openAlbumPicker() — KHÔNG còn overlay/panel riêng mount sẵn nữa.
