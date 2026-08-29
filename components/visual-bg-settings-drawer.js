/**
 * Component: panel body "Visual Background" (v15, MỚI 29/08/2026, phản hồi Giang — bỏ dropdown
 * "Kiểu" thủ công, thay bằng 3 nút chọn nguồn TRỰC TIẾP: Video/Ảnh/Thư mục — `type` giờ là HỆ QUẢ
 * của nút vừa bấm (không còn field UI riêng để chọn trước). Cả 3 picker giờ hỗ trợ CHỌN NHIỀU
 * (multi-select, đánh số theo thứ tự chọn) — 1 item vẫn hoạt động y hệt "chọn 1" cũ (mảng độ dài 1).
 * Logic: event/workflow/visual-bg.js (workflowVisualBg) + event/workflow/slideshow.js
 * (workflowSlideshow, panel "Tuỳ chỉnh Trình chiếu"). Listener/router: cụm "visualBg".
 */
function renderVisualBgPanelBody() {
    return `
                <!-- ===================== NGUỒN ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.groupSource.title">${t('visualBgSettingsDrawer.groupSource.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">

                        <div class="p-4 border-b border-white/5">
                            <!-- Nhãn nguồn + 2 nút Làm tươi/Gỡ — Workflow ghi #visual-bg-source-name qua DOM API sau khi đọc DB (Rule 5d). -->
                            <div class="flex justify-between items-center gap-3 mb-3">
                                <div class="min-w-0">
                                    <div id="visual-bg-source-name" class="text-sm font-medium truncate"></div>
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    <button type="button" id="setting-visual-bg-refresh-source" title="${t('visualBgSettingsDrawer.refreshSource.title')}" class="hidden w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-sky-400 hover:bg-white/10 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                    <button type="button" id="setting-visual-bg-clear-source" title="${t('visualBgSettingsDrawer.clearSource.title')}" class="hidden w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5M3 3l18 18" /></svg>
                                    </button>
                                </div>
                            </div>
                            <!-- 3 nút CHỌN NGUỒN trực tiếp — MỚI (29/08/2026), thay hẳn dropdown Kiểu + 2 nút "Chọn 1"/"Chọn nhóm" cũ. -->
                            <div class="flex gap-2">
                                <button type="button" id="setting-visual-bg-pick-video" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" data-i18n="visualBgSettingsDrawer.pickVideo.label">${t('visualBgSettingsDrawer.pickVideo.label')}</button>
                                <button type="button" id="setting-visual-bg-pick-photo" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" data-i18n="visualBgSettingsDrawer.pickPhoto.label">${t('visualBgSettingsDrawer.pickPhoto.label')}</button>
                                <button type="button" id="setting-visual-bg-pick-folder" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" data-i18n="visualBgSettingsDrawer.pickFolder.label">${t('visualBgSettingsDrawer.pickFolder.label')}</button>
                            </div>
                        </div>

                        <!-- 3 hàng dưới CHỈ hiện khi source.list còn >1 item sống (Workflow toggle class). -->
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

                        <!-- MỚI (08/08/2026) — hiện khi type='video' VÀ ≥1 item sống (CẢ single lẫn
                             list, khác hàng Slideshow ở trên chỉ dành cho list ảnh) — Workflow tự
                             toggle qua refreshPanelUI(). -->
                        <button id="setting-visual-bg-open-video-audio" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left hidden">
                            <div class="flex items-center gap-3 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6v12M6 9v6a2 2 0 002 2h2l4 4V3l-4 4H8a2 2 0 00-2 2z" /></svg>
                                <div class="min-w-0">
                                    <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.openVideoAudio.label">${t('visualBgSettingsDrawer.openVideoAudio.label')}</div>
                                    <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="visualBgSettingsDrawer.openVideoAudio.hint">${t('visualBgSettingsDrawer.openVideoAudio.hint')}</div>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                <!-- ===================== MÀU NỀN — độc lập, luôn hiện ===================== -->
                <div class="mt-6">
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.groupColor.title">${t('visualBgSettingsDrawer.groupColor.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.colorMode.label">${t('visualBgSettingsDrawer.colorMode.label')}</span>
                            <select id="setting-visual-bg-color-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="solid" data-i18n="visualBgSettingsDrawer.colorMode.solid">${t('visualBgSettingsDrawer.colorMode.solid')}</option>
                                <option value="gradient" data-i18n="visualBgSettingsDrawer.colorMode.gradient">${t('visualBgSettingsDrawer.colorMode.gradient')}</option>
                            </select>
                        </div>

                        <div id="visual-bg-solid-color-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.solidColor.label">${t('visualBgSettingsDrawer.solidColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-visual-bg-solid-color" class="w-12 h-12 -m-2 cursor-pointer bg-transparent border-0"></div>
                        </div>

                        <button id="setting-visual-bg-open-gradient" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left hidden">
                            <div class="flex items-center gap-3 min-w-0">
                                <div id="visual-bg-gradient-swatch" class="w-8 h-8 rounded-lg border border-white/20 shrink-0"></div>
                                <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.openGradient.label">${t('visualBgSettingsDrawer.openGradient.label')}</div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
`;
}
