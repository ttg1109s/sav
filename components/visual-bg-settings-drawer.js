/**
 * Component: "Visual Background" panel body — MỚI (v13, plan-v13-visual-background-unification.md
 * mục 2). THAY HẲN 3 entry rời rạc trong `TPL_SETTINGS_VISUALIZER` (components/settings/
 * visualizer-geometry-color.js):
 *   - toggle "#setting-video-enable"            (Video nền)
 *   - toggle "#setting-visual-bg-image-enable"  (Ảnh nền tĩnh)
 *   - nút    "#setting-open-slideshow-settings" (Slideshow)
 * → giờ CHỈ CÒN 1 nút điều hướng "#setting-open-visual-bg-settings" mở panel này (push/pop qua
 * Settings Stack, core/settings-panel-stack-ui.js — đúng khuôn `renderSlideshowPanelBody()`).
 *
 * Cấu trúc (đúng thứ tự Giang mô tả ở plan mục 2) — 4 hàng LUÔN có trong DOM, ẩn/hiện bằng class
 * `hidden` do Workflow toggle (KHÔNG dựng lại HTML mỗi lần đổi lựa chọn):
 *   [toggle] Bật Visual Background                       -> enabled          (LUÔN hiện)
 *   ---- #visual-bg-body: ẩn TOÀN BỘ phần dưới nếu enabled=false ----
 *   [select] Kiểu: Ảnh / Video                           -> mediaType
 *   [toggle] Danh sách (off = một ảnh/video)             -> sourceMode
 *   [nút]    Chọn nguồn...                               -> mở picker theo 4 tổ hợp (Batch B)
 *   ---- #visual-bg-list-playback-row: CHỈ khi list + image ----
 *   [select] Cách phát: Theo từng bài / Trình chiếu      -> listPlaybackMode
 *   ---- #visual-bg-next-order-row: CHỈ khi sourceMode='list' ----
 *   [select] Thứ tự kế tiếp: Ngẫu nhiên/Tuần tự/Theo Playlist -> nextOrder
 *   ---- #visual-bg-slideshow-row: CHỈ khi list + image + slideshow ----
 *   [nút]    Tuỳ chỉnh Trình chiếu...                    -> push sub-panel Slideshow
 *
 * LƯU Ý 1 điểm plan tự mâu thuẫn, ĐÃ CHỌN cách hiểu rộng hơn: mục 2 ghi nextOrder "LUÔN hiện khi
 * list+image", nhưng mục 3 lại nói list VIDEO cũng cần 1 quy tắc chọn video kế và "đề xuất dùng
 * chung field nextOrder... chỉ ẩn phần UI listPlaybackMode khi mediaType='video'". Nếu ẩn cả
 * nextOrder ở nhánh video thì người dùng KHÔNG có cách nào đổi quy tắc đó → hàng nextOrder hiện
 * cho CẢ 2 mediaType khi `sourceMode='list'`; chỉ `listPlaybackMode` mới riêng ảnh.
 *
 * Logic: event/workflow/visual-bg.js (workflowVisualBg); listener/router: cụm "visualBg"
 * (event/listener,router/visual-bg.js).
 */
function renderVisualBgPanelBody() {
    return `
                <!-- ===================== NHÓM 1: NGUỒN ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.groupSource.title">${t('visualBgSettingsDrawer.groupSource.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">

                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.enable.label">${t('visualBgSettingsDrawer.enable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualBgSettingsDrawer.enable.hint">${t('visualBgSettingsDrawer.enable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-visual-bg-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>

                        <!-- Ẩn TOÀN BỘ phần dưới khi toggle tổng đang tắt (Workflow toggle class). -->
                        <div id="visual-bg-body" class="flex flex-col border-t border-white/5 hidden">

                            <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.mediaType.label">${t('visualBgSettingsDrawer.mediaType.label')}</span>
                                <select id="setting-visual-bg-media-type" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="color" data-i18n="visualBgSettingsDrawer.mediaType.color">${t('visualBgSettingsDrawer.mediaType.color')}</option>
                                    <option value="image" data-i18n="visualBgSettingsDrawer.mediaType.image">${t('visualBgSettingsDrawer.mediaType.image')}</option>
                                    <option value="video" data-i18n="visualBgSettingsDrawer.mediaType.video">${t('visualBgSettingsDrawer.mediaType.video')}</option>
                                </select>
                            </div>

                            <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                <div class="pr-3">
                                    <div class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.sourceMode.label">${t('visualBgSettingsDrawer.sourceMode.label')}</div>
                                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualBgSettingsDrawer.sourceMode.hint">${t('visualBgSettingsDrawer.sourceMode.hint')}</div>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" id="setting-visual-bg-source-mode" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                                </label>
                            </div>

                            <!-- Nhãn nguồn đang chọn ("Chưa chọn"/tên thật) do Workflow ghi vào
                                 #visual-bg-source-name sau khi đọc DB — KHÔNG nội suy vào chuỗi
                                 tĩnh (Rule 5d: dữ liệu người dùng phải là slot rỗng, gán qua DOM API). -->
                            <!-- Nút "Gỡ nguồn" đứng NGAY CẠNH nút "Chọn nguồn" (v13 Batch F) — cùng
                                 1 hàng, icon link-slash. CHỈ hiện khi tổ hợp hiện tại đã có nguồn.
                                 Cần thiết vì Block gate chặn xoá mọi ảnh/video/album/folder đang
                                 được tham chiếu: không có đường gỡ thì người dùng kẹt cứng. -->
                            <div class="flex items-stretch border-b border-white/5">
                                <button type="button" id="setting-visual-bg-pick-source" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors flex-1 min-w-0 text-left gap-3">
                                    <div class="min-w-0">
                                        <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.pickSource.label">${t('visualBgSettingsDrawer.pickSource.label')}</div>
                                        <div id="visual-bg-source-name" class="text-xs text-slate-400 mt-0.5 truncate"></div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                                <button type="button" id="setting-visual-bg-clear-source" title="${t('visualBgSettingsDrawer.clearSource.title')}" class="hidden px-4 flex items-center justify-center border-l border-white/5 text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5M3 3l18 18" /></svg>
                                </button>
                            </div>

                            <!-- ===== Nền MÀU (mediaType='color') — dời từ card Visualizer + thêm gradient ===== -->
                            <div id="visual-bg-color-mode-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors hidden">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.colorMode.label">${t('visualBgSettingsDrawer.colorMode.label')}</span>
                                <select id="setting-visual-bg-color-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="solid" data-i18n="visualBgSettingsDrawer.colorMode.solid">${t('visualBgSettingsDrawer.colorMode.solid')}</option>
                                    <option value="gradient" data-i18n="visualBgSettingsDrawer.colorMode.gradient">${t('visualBgSettingsDrawer.colorMode.gradient')}</option>
                                </select>
                            </div>

                            <div id="visual-bg-solid-color-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors hidden">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.solidColor.label">${t('visualBgSettingsDrawer.solidColor.label')}</span>
                                <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-visual-bg-solid-color" class="w-12 h-12 -m-2 cursor-pointer bg-transparent border-0"></div>
                            </div>

                            <button id="setting-visual-bg-open-gradient" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left hidden">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div id="visual-bg-gradient-swatch" class="w-8 h-8 rounded-lg border border-white/20 shrink-0"></div>
                                    <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.openGradient.label">${t('visualBgSettingsDrawer.openGradient.label')}</div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </button>

                            <div id="visual-bg-list-playback-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors hidden">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.listPlaybackMode.label">${t('visualBgSettingsDrawer.listPlaybackMode.label')}</span>
                                <select id="setting-visual-bg-list-playback-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="perSong" data-i18n="visualBgSettingsDrawer.listPlaybackMode.perSong">${t('visualBgSettingsDrawer.listPlaybackMode.perSong')}</option>
                                    <option value="slideshow" data-i18n="visualBgSettingsDrawer.listPlaybackMode.slideshow">${t('visualBgSettingsDrawer.listPlaybackMode.slideshow')}</option>
                                </select>
                            </div>

                            <div id="visual-bg-next-order-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors hidden">
                                <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.nextOrder.label">${t('visualBgSettingsDrawer.nextOrder.label')}</span>
                                <select id="setting-visual-bg-next-order" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="random" data-i18n="visualBgSettingsDrawer.nextOrder.random">${t('visualBgSettingsDrawer.nextOrder.random')}</option>
                                    <option value="sequential" data-i18n="visualBgSettingsDrawer.nextOrder.sequential">${t('visualBgSettingsDrawer.nextOrder.sequential')}</option>
                                    <option value="playlist" data-i18n="visualBgSettingsDrawer.nextOrder.playlist">${t('visualBgSettingsDrawer.nextOrder.playlist')}</option>
                                </select>
                            </div>

                            <button id="setting-visual-bg-open-slideshow" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left hidden">
                                <div class="flex items-center gap-3 min-w-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 4h10a2 2 0 012 2v10M4 8v10a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2z" /></svg>
                                    <div class="min-w-0">
                                        <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.openSlideshow.label">${t('visualBgSettingsDrawer.openSlideshow.label')}</div>
                                        <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="visualBgSettingsDrawer.openSlideshow.hint">${t('visualBgSettingsDrawer.openSlideshow.hint')}</div>
                                    </div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
`;
}
