/**
 * Component: Slideshow Settings Drawer ("Cài đặt nền Slideshow") — Batch 8 (03/07/2026), VIẾT LẠI
 * Batch 9 (04/07/2026, mục 4 phản hồi Giang):
 *   1. GỘP 2 section cũ ("Album" + "Cách chiếu") thành 1 section DUY NHẤT.
 *   2. Bỏ 2 nút "Chọn Album"/"Tắt" — thay bằng 1 cần gạt DUY NHẤT "#setting-slideshow-enable": gạt
 *      "On" TỰ mở panel chọn Album ngay (giống 3 toggle nền Video/Ảnh đã sửa ở mục 1 — cùng ngày);
 *      huỷ/đóng panel không chọn gì -> tự gạt về "off". Khi ĐANG bật, hàng
 *      "#slideshow-current-album-row" hiện ra (tên + avatar tròn album đang chạy) — BẤM VÀO hàng
 *      này để MỞ LẠI panel đổi sang album khác bất kỳ lúc nào (không cần gạt tắt/bật lại).
 *   3. Panel chọn Album ĐỔI HẲN sang kiểu "notify center" — TÁI DÙNG class `.glass-control-center`
 *      + animation scale/opacity của `#visualizer-control-center` (xem assets/css/style.css) thay
 *      cho modal tối toàn màn hình cũ (`openAlbumPickerModal`, ĐÃ XOÁ). Album hiển thị GRID hình
 *      TRÒN (cùng shape avatar ở story slider Photo & Album). Album đang active có viền sáng +
 *      vòng "đang chạy" quay quanh; các album khác bị blur mờ (chỉ khi CÓ 1 album đang active).
 *
 * Logic: event/workflow/slideshow.js (workflowSlideshow); listener/router: cụm "slideshowSettings"
 * (event/listener,router/slideshow.js).
 */
const TPL_SLIDESHOW_SETTINGS_DRAWER = `
    <div id="drawer-slideshow-settings" class="fixed inset-0 drawer-glass z-[90] transform translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2">
                <button id="btn-back-slideshow-settings" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="slideshowSettingsDrawer.backToSettings.title" title="${t('slideshowSettingsDrawer.backToSettings.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="slideshowSettingsDrawer.title">${t('slideshowSettingsDrawer.title')}</h2>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
            <div class="max-w-2xl mx-auto space-y-8">

                <!-- SECTION DUY NHẤT (Batch 9 — gộp 2 section cũ) -->
                <div>
                    <h3 class="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2 ml-2" data-i18n="slideshowSettingsDrawer.sectionTitle">${t('slideshowSettingsDrawer.sectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">

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

                        <!-- MỚI (Batch 9) — hàng hiện album đang chạy, CHỈ hiện khi đang bật (JS
                             toggle class hidden). Bấm vào để MỞ LẠI panel đổi sang album khác. -->
                        <button id="slideshow-current-album-row" class="hidden justify-between items-center gap-3 p-4 border-b border-white/5 hover:bg-white/5 transition-colors text-left w-full">
                            <div class="flex items-center gap-3 min-w-0">
                                <div id="slideshow-current-album-thumb" class="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 bg-cover bg-center"></div>
                                <div class="min-w-0">
                                    <div class="text-xs text-slate-400" data-i18n="slideshowSettingsDrawer.album.label">${t('slideshowSettingsDrawer.album.label')}</div>
                                    <div id="slideshow-settings-album-name" class="text-sm font-semibold text-white truncate" data-i18n="slideshowSettingsDrawer.album.none">${t('slideshowSettingsDrawer.album.none')}</div>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>

                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.mode.label">${t('slideshowSettingsDrawer.mode.label')}</span>
                            <select id="setting-slideshow-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="sequential" data-i18n="slideshowSettingsDrawer.mode.sequential">${t('slideshowSettingsDrawer.mode.sequential')}</option>
                                <option value="random" data-i18n="slideshowSettingsDrawer.mode.random">${t('slideshowSettingsDrawer.mode.random')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div>
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.interval.label">${t('slideshowSettingsDrawer.interval.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowSettingsDrawer.interval.hint">${t('slideshowSettingsDrawer.interval.hint')}</div>
                            </div>
                            <input id="setting-slideshow-interval" type="number" min="5" step="1" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-20 text-right shrink-0">
                        </div>
                        <div class="flex justify-between items-center p-4">
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
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- MỚI (Batch 9, mục 4) — Panel chọn Album kiểu "notify center" (TÁI DÙNG pattern
         #visualizer-control-center: overlay mờ + panel .glass-control-center scale/opacity). Mount
         Ở NGOÀI #drawer-slideshow-settings (z-index cao hơn hẳn, [130]/[131]) để không bị giới hạn
         bởi overflow/transform của drawer cha. -->
    <div id="slideshow-album-picker-overlay" class="hidden fixed inset-0 z-[130] pointer-events-auto bg-black/40"></div>
    <div id="slideshow-album-picker-panel" class="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] top-1/2 -translate-y-1/2 glass-control-center rounded-3xl shadow-2xl transform scale-0 opacity-0 transition-all duration-300 ease-out z-[131] pointer-events-auto p-5 max-h-[70vh] flex flex-col">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 text-center shrink-0" data-i18n="slideshowSettingsDrawer.albumPicker.title">${t('slideshowSettingsDrawer.albumPicker.title')}</h3>
        <div id="slideshow-album-picker-grid" class="grid grid-cols-3 gap-x-2 gap-y-5 overflow-y-auto"></div>
        <p id="slideshow-album-picker-empty" class="hidden text-sm text-slate-300 text-center py-8" data-i18n="slideshowSettingsDrawer.albumPicker.empty">${t('slideshowSettingsDrawer.albumPicker.empty')}</p>
    </div>
`;
