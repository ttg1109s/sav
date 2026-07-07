/**
 * Component: Slideshow Settings panel body ("Cài đặt nền Slideshow") — Batch 8 (03/07/2026), VIẾT
 * LẠI Batch 9 (04/07/2026, mục 4 phản hồi Giang):
 *   1. GỘP 2 section cũ ("Album" + "Cách chiếu") thành 1 section DUY NHẤT.
 *   2. Bỏ 2 nút "Chọn Album"/"Tắt" — thay bằng 1 cần gạt DUY NHẤT "#setting-slideshow-enable": gạt
 *      "On" TỰ mở panel chọn Album ngay (giống 3 toggle nền Video/Ảnh đã sửa ở mục 1 — cùng ngày);
 *      huỷ/đóng panel không chọn gì -> tự gạt về "off".
 *   3. Panel chọn Album ĐỔI HẲN sang kiểu "notify center" — TÁI DÙNG class `.glass-control-center`
 *      (xem `TPL_SLIDESHOW_ALBUM_PICKER` bên dưới, ĐỘC LẬP với panel Settings).
 *
 * === Batch D4 (Settings restructure, tiếp D1/D2/D3) ===
 * TRƯỚC ĐÂY `TPL_SLIDESHOW_SETTINGS_DRAWER` gộp CẢ khung `fixed inset-0 drawer-glass z-[90]` LẪN
 * panel chọn Album (2 phần tử ĐỘC LẬP mount ở z-[130]/[131], không lồng trong khung trên — xem
 * comment gốc). Tách làm 2:
 *   - `renderSlideshowPanelBody()` — 6 input (enable/mode/photoPerSong/interval/transition/
 *     showCaption), PUSH ĐỘNG vào Settings Stack (core/settings-panel-stack.js), giống About/
 *     Subtitle/Visualizer.
 *   - `TPL_SLIDESHOW_ALBUM_PICKER` — panel chọn Album kiểu "notify center", GIỮ NGUYÊN TĨNH (mount
 *     1 lần lúc boot, KHÔNG di chuyển) — đây là 1 overlay ĐỘC LẬP với Settings Stack (ngang hàng
 *     kiến trúc, giống Modal Subtitle Giang đã chỉ ra 06/07/2026), không phải 1 tầng lồng trong
 *     ngăn xếp Settings — không cần push/pop gì cả, chỉ toggle hidden/scale như trước giờ.
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
                                <option value="kenburns" data-i18n="slideshowSettingsDrawer.transition.kenburns">${t('slideshowSettingsDrawer.transition.kenburns')}</option>
                                <option value="blur" data-i18n="slideshowSettingsDrawer.transition.blur">${t('slideshowSettingsDrawer.transition.blur')}</option>
                                <option value="rotateFade" data-i18n="slideshowSettingsDrawer.transition.rotateFade">${t('slideshowSettingsDrawer.transition.rotateFade')}</option>
                                <option value="curtain" data-i18n="slideshowSettingsDrawer.transition.curtain">${t('slideshowSettingsDrawer.transition.curtain')}</option>
                                <option value="circleReveal" data-i18n="slideshowSettingsDrawer.transition.circleReveal">${t('slideshowSettingsDrawer.transition.circleReveal')}</option>
                                <option value="glitch" data-i18n="slideshowSettingsDrawer.transition.glitch">${t('slideshowSettingsDrawer.transition.glitch')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.showCaption.label">${t('slideshowSettingsDrawer.showCaption.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.showCaption.hint">${t('slideshowSettingsDrawer.showCaption.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-show-caption" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-fuchsia-500 shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                </div>
`;
}

/**
 * Panel chọn Album kiểu "notify center" (TÁI DÙNG pattern #visualizer-control-center: overlay mờ +
 * panel .glass-control-center scale/opacity) — ĐỘC LẬP với Settings Stack, KHÔNG di chuyển (xem
 * docstring đầu file). Mount TĨNH 1 lần lúc boot (main.js), z-index cao hơn hẳn [130]/[131] để
 * không bị giới hạn bởi overflow/transform của bất kỳ drawer nào (kể cả #drawer-settings).
 */
const TPL_SLIDESHOW_ALBUM_PICKER = `
    <div id="slideshow-album-picker-overlay" class="hidden fixed inset-0 z-[130] pointer-events-auto bg-black/40"></div>
    <div id="slideshow-album-picker-panel" class="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] top-1/2 -translate-y-1/2 glass-control-center rounded-3xl shadow-2xl transform scale-0 opacity-0 transition-all duration-300 ease-out z-[131] pointer-events-auto p-5 max-h-[70vh] flex flex-col">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 text-center shrink-0" data-i18n="slideshowSettingsDrawer.albumPicker.title">${t('slideshowSettingsDrawer.albumPicker.title')}</h3>
        <div id="slideshow-album-picker-grid" class="grid grid-cols-3 gap-x-2 gap-y-5 overflow-y-auto"></div>
        <p id="slideshow-album-picker-empty" class="hidden text-sm text-slate-300 text-center py-8" data-i18n="slideshowSettingsDrawer.albumPicker.empty">${t('slideshowSettingsDrawer.albumPicker.empty')}</p>
    </div>
`;
