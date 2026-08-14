/**
 * Component: panel "Sắp xếp" Playlist (mục 1b/1c, phản hồi Giang) — 2 <select> ĐỘC LẬP:
 *   - Trục (1) "Tên/Ngày" — 4 giá trị SẴN CÓ (az/za/newest/oldest), hành vi giữ NGUYÊN.
 *   - Trục (2) "Thống kê nghe" (MỚI) — none/countDesc/countAsc/timesDesc/timesAsc. Khi khác
 *     'none', trục này LÀ CHÍNH — trục (1) chỉ còn vai trò phá thế bằng (2 bài count/times bằng
 *     nhau) — xem core/playlist/order.js::sortKeysByMode().
 * Đồng bộ giá trị lúc mở panel qua `workflowPlaylist.openSortPanel()` (event/workflow/playlist.js).
 */
function renderPlaylistSortPanelBody() {
    return `
                <div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.nameMode.label">${t('playlistSortPanel.nameMode.label')}</span>
                            <select id="setting-playlist-sort-name" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="az" data-i18n="settingsPlaylistBg.sortMode.az">${t('settingsPlaylistBg.sortMode.az')}</option>
                                <option value="za" data-i18n="settingsPlaylistBg.sortMode.za">${t('settingsPlaylistBg.sortMode.za')}</option>
                                <option value="newest" data-i18n="settingsPlaylistBg.sortMode.newest">${t('settingsPlaylistBg.sortMode.newest')}</option>
                                <option value="oldest" data-i18n="settingsPlaylistBg.sortMode.oldest">${t('settingsPlaylistBg.sortMode.oldest')}</option>
                            </select>
                        </div>
                        <div class="flex flex-col p-4 hover:bg-white/5 transition-colors gap-1.5">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.statMode.label">${t('playlistSortPanel.statMode.label')}</span>
                                <select id="setting-playlist-sort-stat" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="none" data-i18n="playlistSortPanel.statMode.none">${t('playlistSortPanel.statMode.none')}</option>
                                    <option value="countDesc" data-i18n="playlistSortPanel.statMode.countDesc">${t('playlistSortPanel.statMode.countDesc')}</option>
                                    <option value="countAsc" data-i18n="playlistSortPanel.statMode.countAsc">${t('playlistSortPanel.statMode.countAsc')}</option>
                                    <option value="timesDesc" data-i18n="playlistSortPanel.statMode.timesDesc">${t('playlistSortPanel.statMode.timesDesc')}</option>
                                    <option value="timesAsc" data-i18n="playlistSortPanel.statMode.timesAsc">${t('playlistSortPanel.statMode.timesAsc')}</option>
                                    <option value="sizeDesc" data-i18n="playlistSortPanel.statMode.sizeDesc">${t('playlistSortPanel.statMode.sizeDesc')}</option>
                                    <option value="sizeAsc" data-i18n="playlistSortPanel.statMode.sizeAsc">${t('playlistSortPanel.statMode.sizeAsc')}</option>
                                    <option value="durationDesc" data-i18n="playlistSortPanel.statMode.durationDesc">${t('playlistSortPanel.statMode.durationDesc')}</option>
                                    <option value="durationAsc" data-i18n="playlistSortPanel.statMode.durationAsc">${t('playlistSortPanel.statMode.durationAsc')}</option>
                                </select>
                            </div>
                            <div class="text-xs text-slate-400" data-i18n="playlistSortPanel.statMode.hint">${t('playlistSortPanel.statMode.hint')}</div>
                        </div>
                    </div>
                </div>
`;
}
