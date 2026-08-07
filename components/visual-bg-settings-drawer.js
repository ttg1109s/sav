/**
 * Component: panel body "Visual Background" (v14, source hợp nhất 1 mảng).
 * KHÔNG còn toggle "Bật"/"Danh sách" — 3 trạng thái (ẩn/tĩnh/cycle) tự suy từ số item trong
 * `source.list` (workflowVisualBg.refreshPanelUI() tự ẩn/hiện đúng hàng). Nhóm "Màu nền" tách
 * riêng, LUÔN hiện (không phụ thuộc đã chọn ảnh/video hay chưa — xem core/config.js).
 * Logic: event/workflow/visual-bg.js (workflowVisualBg) + event/workflow/slideshow.js
 * (workflowSlideshow, panel "Tuỳ chỉnh Trình chiếu"). Listener/router: cụm "visualBg".
 */
function renderVisualBgPanelBody() {
    return `
                <!-- ===================== NGUỒN ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualBgSettingsDrawer.groupSource.title">${t('visualBgSettingsDrawer.groupSource.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">

                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.type.label">${t('visualBgSettingsDrawer.type.label')}</span>
                            <select id="setting-visual-bg-type" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="photo" data-i18n="visualBgSettingsDrawer.type.photo">${t('visualBgSettingsDrawer.type.photo')}</option>
                                <option value="video" data-i18n="visualBgSettingsDrawer.type.video">${t('visualBgSettingsDrawer.type.video')}</option>
                            </select>
                        </div>

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
                            <div class="flex gap-2">
                                <button type="button" id="setting-visual-bg-pick-single" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"></button>
                                <button type="button" id="setting-visual-bg-pick-group" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"></button>
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
