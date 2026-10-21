/**
 * components/visual-bg-settings-drawer.js — markup các màn Visual Background trong Generic Drawer, cùng workflowVisualBg
 * (event/workflow/visual-bg-common.js) và cùng id control (Listener ủy quyền theo id, event/listener/visual-bg.js):
 *   - `renderVisualBgMediaPanelBody()` — Player > Song > Background Media: toggle tổng + card Media + card Playback.
 *   - `renderVisualBgColorPanelBody()` — Visualizer Screen > Background Color: card màu nền.
 *   - `renderVisualBgMultiPickerBodyHtml()` — khung picker Video/Ảnh multi-select (lưới chèn vào trong + nút "Chọn").
 * Gốc mỗi màn mang `data-visual-bg-panel` để Workflow nhận diện màn VBG đang gắn; giá trị control do
 * core/visual-bg-panel-ui.js điền.
 */
function renderVisualBgMediaPanelBody() {
    // Option Resolution: cùng danh sách mode + nhãn của Player (core/player-display-settings.js).
    const resolutionOptionsHtml = PLAYER_RESOLUTION_MODES.map((m) => `<option value="${m.value}">${t(m.labelKey)}</option>`).join('');
    return `
            <div data-visual-bg-panel="media">
                <!-- Toggle tổng — tắt chỉ dỡ media ảnh/video, lớp màu vẫn sơn; bật lại nạp lại từ đầu. -->
                <div>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center gap-3 p-4" data-uitk="cardHoverBg">
                            <div class="min-w-0">
                                <span class="text-sm font-medium block" data-i18n="visualBgSettingsDrawer.enabled.label">${t('visualBgSettingsDrawer.enabled.label')}</span>
                                <span class="text-xs block mt-0.5" data-uitk="textSecondary" data-i18n="visualBgSettingsDrawer.enabled.hint">${t('visualBgSettingsDrawer.enabled.hint')}</span>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-visual-bg-enabled" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" data-uitk="toggleTrackOff toggleTrackOn"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- ===================== MEDIA — chọn nguồn ===================== -->
                <div class="mt-6">
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText" data-i18n="visualBgSettingsDrawer.groupMedia.title">${t('visualBgSettingsDrawer.groupMedia.title')}</h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="p-4">
                            <!-- Nhãn nguồn (ghi qua DOM API sau khi đọc DB) + 2 nút Làm tươi/Gỡ nguồn. -->
                            <div class="flex justify-between items-center gap-3 mb-3">
                                <div class="min-w-0">
                                    <div id="visual-bg-source-name" class="text-sm font-medium truncate"></div>
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    <button type="button" id="setting-visual-bg-refresh-source" title="${t('visualBgSettingsDrawer.refreshSource.title')}" class="hidden w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="textSecondary hoverAccentText hoverAccentSoftBg">
                                        ${iconSvg('refresh', 'h-4 w-4')}
                                    </button>
                                    <button type="button" id="setting-visual-bg-clear-source" title="${t('visualBgSettingsDrawer.clearSource.title')}" class="hidden w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="iconBtnDestructive">
                                        ${iconSvg('link-off', 'h-4 w-4')}
                                    </button>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <button type="button" id="setting-visual-bg-pick-video" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg transition-colors" data-uitk="btnNeutralBg btnNeutralText btnNeutralHoverBg" data-i18n="visualBgSettingsDrawer.pickVideo.label">${t('visualBgSettingsDrawer.pickVideo.label')}</button>
                                <button type="button" id="setting-visual-bg-pick-photo" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg transition-colors" data-uitk="btnNeutralBg btnNeutralText btnNeutralHoverBg" data-i18n="visualBgSettingsDrawer.pickPhoto.label">${t('visualBgSettingsDrawer.pickPhoto.label')}</button>
                                <button type="button" id="setting-visual-bg-pick-folder" class="flex-1 text-xs font-medium text-center py-2.5 rounded-lg transition-colors" data-uitk="btnNeutralBg btnNeutralText btnNeutralHoverBg" data-i18n="visualBgSettingsDrawer.pickFolder.label">${t('visualBgSettingsDrawer.pickFolder.label')}</button>
                            </div>
                        </div>

                        <!-- Resolution media VBG — luôn hiện, giá trị riêng Video/Photo theo type đang chọn. -->
                        <div id="visual-bg-resolution-row" class="flex justify-between items-center p-4 border-t" data-uitk="dividerBorder cardHoverBg">
                            <span id="visual-bg-resolution-label" class="text-sm font-medium"></span>
                            <select id="setting-visual-bg-resolution" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                ${resolutionOptionsHtml}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== PLAYBACK — cách phát + Motion; ẩn cả nhóm khi chưa có media sống ===================== -->
                <div id="visual-bg-playback-group" class="mt-6 hidden">
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText" data-i18n="visualBgSettingsDrawer.groupPlayback.title">${t('visualBgSettingsDrawer.groupPlayback.title')}</h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">

                        <!-- 2 hàng dưới chỉ hiện khi còn >1 item sống. -->
                        <div id="visual-bg-list-playback-row" class="flex justify-between items-center p-4 hidden border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.listPlaybackMode.label">${t('visualBgSettingsDrawer.listPlaybackMode.label')}</span>
                            <select id="setting-visual-bg-list-playback-mode" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="perSong" data-i18n="visualBgSettingsDrawer.listPlaybackMode.perSong">${t('visualBgSettingsDrawer.listPlaybackMode.perSong')}</option>
                                <option value="slideshow" data-i18n="visualBgSettingsDrawer.listPlaybackMode.slideshow">${t('visualBgSettingsDrawer.listPlaybackMode.slideshow')}</option>
                            </select>
                        </div>

                        <div id="visual-bg-next-order-row" class="flex justify-between items-center p-4 hidden border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.nextOrder.label">${t('visualBgSettingsDrawer.nextOrder.label')}</span>
                            <select id="setting-visual-bg-next-order" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="random" data-i18n="visualBgSettingsDrawer.nextOrder.random">${t('visualBgSettingsDrawer.nextOrder.random')}</option>
                                <option value="sequential" data-i18n="visualBgSettingsDrawer.nextOrder.sequential">${t('visualBgSettingsDrawer.nextOrder.sequential')}</option>
                                <option value="playlist" data-i18n="visualBgSettingsDrawer.nextOrder.playlist">${t('visualBgSettingsDrawer.nextOrder.playlist')}</option>
                            </select>
                        </div>

                        <!-- "Seconds per video/photo" — dùng chung video/ảnh, chỉ khi đang cycle kiểu slideshow. -->
                        <div id="visual-bg-duration-mode-row" class="flex justify-between items-center p-4 hidden border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.durationMode.label">${t('visualBgSettingsDrawer.durationMode.label')}</span>
                            <select id="setting-visual-bg-duration-mode" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="duration" data-i18n="visualBgSettingsDrawer.durationMode.duration">${t('visualBgSettingsDrawer.durationMode.duration')}</option>
                                <option value="fixtime" data-i18n="visualBgSettingsDrawer.durationMode.fixtime">${t('visualBgSettingsDrawer.durationMode.fixtime')}</option>
                            </select>
                        </div>

                        <div id="visual-bg-duration-seconds-row" class="flex justify-between items-center p-4 hidden border-b" data-uitk="dividerBorder cardHoverBg">
                            <span id="visual-bg-duration-seconds-label" class="text-sm font-medium"></span>
                            <button type="button" id="setting-visual-bg-duration-seconds" class="rounded-lg px-3 py-1.5 text-xs outline-none w-20 text-right shrink-0" data-uitk="cardHoverBg inputBg inputBorder inputText">5s</button>
                        </div>

                        <!-- Motion (type photo/video) — cả hàng là 1 nút mở danh sách Motion ở chế độ Chọn, hiện tên preset đang
                             gắn. Tên gắn qua data-visual-bg-motion-name, không dùng id (Listener dò closest('[id]'), id con sẽ
                             "nuốt" click của nút). -->
                        <button type="button" id="setting-visual-bg-open-motion-picker" class="flex justify-between items-center gap-3 p-4 w-full text-left hidden border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium shrink-0" data-i18n="visualBgSettingsDrawer.motion.label">${t('visualBgSettingsDrawer.motion.label')}</span>
                            <span class="flex items-center gap-1 min-w-0">
                                <span data-visual-bg-motion-name class="text-xs truncate" data-uitk="textSecondary"></span>
                                ${iconSvg('chevron-right', 'h-4 w-4 shrink-0', 'data-uitk="textMutedIcon"')}
                            </span>
                        </button>

                        <!-- type 'video' — mặc định VBG chạy độc lập tốc độ phát chung, bật cờ này mới theo. -->
                        <div id="visual-bg-sync-speed-row" class="flex justify-between items-center p-4 hidden border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.syncSpeed.label">${t('visualBgSettingsDrawer.syncSpeed.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="setting-visual-bg-sync-speed" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" data-uitk="toggleTrackOff toggleTrackOn"></div>
                            </label>
                        </div>

                        <!-- type 'video' và ≥1 item sống. -->
                        <button id="setting-visual-bg-open-video-audio" class="flex justify-between items-center p-4 w-full text-left hidden" data-uitk="cardHoverBg">
                            <div class="flex items-center gap-3 min-w-0">
                                ${iconSvg('speaker-wave', 'h-5 w-5 shrink-0', 'data-uitk="accentText"')}
                                <div class="min-w-0">
                                    <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.openVideoAudio.label">${t('visualBgSettingsDrawer.openVideoAudio.label')}</div>
                                    <div class="text-xs mt-0.5 truncate" data-uitk="textSecondary" data-i18n="visualBgSettingsDrawer.openVideoAudio.hint">${t('visualBgSettingsDrawer.openVideoAudio.hint')}</div>
                                </div>
                            </div>
                            ${iconSvg('chevron-right', 'h-5 w-5 shrink-0', 'data-uitk="textMutedIcon"')}
                        </button>
                    </div>
                </div>

            </div>
`;
}

/** Background Color: card màu nền (Solid/Gradient), độc lập với media (vẫn sơn khi toggle tổng tắt). Sub panel Gradient
 * mở từ hàng `#setting-visual-bg-open-gradient`. */
function renderVisualBgColorPanelBody() {
    return `
            <div data-visual-bg-panel="color">
                <!-- ===================== MÀU NỀN — độc lập, luôn hiện ===================== -->
                <div>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.colorMode.label">${t('visualBgSettingsDrawer.colorMode.label')}</span>
                            <select id="setting-visual-bg-color-mode" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="solid" data-i18n="visualBgSettingsDrawer.colorMode.solid">${t('visualBgSettingsDrawer.colorMode.solid')}</option>
                                <option value="gradient" data-i18n="visualBgSettingsDrawer.colorMode.gradient">${t('visualBgSettingsDrawer.colorMode.gradient')}</option>
                            </select>
                        </div>

                        <div id="visual-bg-solid-color-row" class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="visualBgSettingsDrawer.solidColor.label">${t('visualBgSettingsDrawer.solidColor.label')}</span>
                            <div class="w-8 h-8 rounded-full overflow-hidden shrink-0" data-uitk="inputBorder"><input type="color" id="setting-visual-bg-solid-color" class="w-12 h-12 -m-2 cursor-pointer bg-transparent border-0"></div>
                        </div>

                        <button id="setting-visual-bg-open-gradient" class="flex justify-between items-center p-4 w-full text-left hidden" data-uitk="cardHoverBg">
                            <div class="flex items-center gap-3 min-w-0">
                                <div id="visual-bg-gradient-swatch" class="w-8 h-8 rounded-lg shrink-0" data-uitk="inputBorder"></div>
                                <div class="text-sm font-medium truncate" data-i18n="visualBgSettingsDrawer.openGradient.label">${t('visualBgSettingsDrawer.openGradient.label')}</div>
                            </div>
                            ${iconSvg('chevron-right', 'h-5 w-5 shrink-0', 'data-uitk="textMutedIcon"')}
                        </button>
                    </div>
                </div>
            </div>
`;
}

/** Khung picker Video/Ảnh multi-select: vùng cuộn (lưới chèn vào trong) + dòng "trống" + nút "Chọn" cố định phía dưới (id
 * khớp `wireMediaPickerConfirmButtonUi()`, core/media-picker-drawer-ui.js).
 * @param {string} scrollId @param {string} emptyId @param {string} emptyText */
function renderVisualBgMultiPickerBodyHtml(scrollId, emptyId, emptyText) {
    return `${renderMediaPickerBodyHtml(scrollId, emptyId, emptyText, 'textSecondary')}
            <div class="px-5 py-3 shrink-0 border-t" data-uitk="dividerBorder">
                <button type="button" id="btn-file-manager-image-picker-confirm" class="w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-uitk="btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent" disabled>${t('visualBgSettingsDrawer.picker.confirmEmpty')}</button>
            </div>
        `;
}
