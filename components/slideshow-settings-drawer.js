/**
 * Component: Slideshow Settings Drawer (ngăn kéo "Cài đặt nền Slideshow") — Batch 8, ver 12
 * "Multi Media" (plan-v12-multimedia.md mục 4.b3, vị trí nút mở CHỐT ở
 * plan-v12-multimedia-update-3.md mục 3: dưới toggle "Hiện Visual" trong Settings chính, xem
 * components/settings/visualizer-geometry-color.js).
 *
 * Cùng pattern navigation stack với Visualizer/Subtitle Settings Drawer (z-[90], transform
 * translate-y-full, nút Back chỉ ẩn drawer này, không động #drawer-settings bên dưới).
 *
 * 3 khối nội dung:
 *   - Album nền: tên album đang dùng (hoặc "Chưa chọn") + nút "Chọn Album" (mở picker,
 *     core/file-manager/photo-ui.js::openAlbumPickerModal) + nút "Tắt" (chỉ hiện khi có album).
 *   - Cách chọn ảnh kế tiếp: Tuần tự / Ngẫu nhiên.
 *   - Thời gian mỗi ảnh (giây, tối thiểu 5) + Hiệu ứng chuyển cảnh (13 kiểu).
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

                <!-- SECTION: ALBUM NỀN -->
                <div>
                    <h3 class="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2 ml-2" data-i18n="slideshowSettingsDrawer.albumSectionTitle">${t('slideshowSettingsDrawer.albumSectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 gap-3">
                            <span id="slideshow-settings-album-name" class="text-sm font-semibold text-white truncate min-w-0" data-i18n="slideshowSettingsDrawer.album.none">${t('slideshowSettingsDrawer.album.none')}</span>
                            <div class="flex items-center gap-2 shrink-0">
                                <button id="btn-slideshow-pick-album" class="px-3.5 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-bold transition-colors shadow" data-i18n="slideshowSettingsDrawer.btnPickAlbum">${t('slideshowSettingsDrawer.btnPickAlbum')}</button>
                                <button id="btn-slideshow-clear-album" class="hidden px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors" data-i18n="slideshowSettingsDrawer.btnClearAlbum">${t('slideshowSettingsDrawer.btnClearAlbum')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION: CÁCH CHIẾU -->
                <div>
                    <h3 class="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2 ml-2" data-i18n="slideshowSettingsDrawer.playbackSectionTitle">${t('slideshowSettingsDrawer.playbackSectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
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
`;
