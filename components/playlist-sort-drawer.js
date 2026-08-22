/**
 * Component: panel "Sắp xếp" Playlist (mục 1b/1c, phản hồi Giang) — 2 trục:
 *   - Trục (1) "Tên/Ngày" — 4 giá trị SẴN CÓ (az/za/newest/oldest), hành vi giữ NGUYÊN.
 *   - Trục (2) "Stats" (SỬA mục 3, phản hồi Giang — đổi tên từ "Listening stats", TÁCH thành 2
 *     dropdown riêng thay vì gộp 9 giá trị trong 1 dropdown như bản trước):
 *       + Dropdown (a) chọn FIELD — none/count/times/size/duration.
 *       + Dropdown (b) chọn HƯỚNG — lớn→bé/bé→lớn — CHỈ HIỆN khi field khác 'none' (ẩn/hiện qua
 *         `data-sort-direction-row`, xử lý ở workflowPlaylist.openSortPanel()/changeStatSortField()).
 * Khi field khác 'none', trục này LÀ CHÍNH — trục (1) chỉ còn vai trò phá thế bằng (2 bài bằng
 * nhau) — xem core/playlist/order.js::sortKeysByMode().
 *
 * MỞ RỘNG (hợp nhất Photo vào Playlist) — 2 field 'times' (tổng thời gian nghe)/'duration' (thời
 * lượng) KHÔNG áp dụng cho Photo (ảnh không có 2 khái niệm này) — ẩn khỏi dropdown khi
 * `source==='photo'` (CHỐT Giang). `count` GIỮ LẠI cho Photo, đổi ý nghĩa thành "lượt click xem"
 * (xem event/workflow/file-manager-photo.js::openImagePreview() — bumpSongPlayCount()).
 * @param {string} source - 'song' | 'video' | 'photo'.
 */
function renderPlaylistSortPanelBody(source) {
    const isPhoto = source === 'photo';
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
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.statField.label">${t('playlistSortPanel.statField.label')}</span>
                            <select id="setting-playlist-sort-stat-field" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="none" data-i18n="playlistSortPanel.statField.none">${t('playlistSortPanel.statField.none')}</option>
                                <option value="count" data-i18n="playlistSortPanel.statField.count">${t('playlistSortPanel.statField.count')}</option>
                                ${isPhoto ? '' : `<option value="times" data-i18n="playlistSortPanel.statField.times">${t('playlistSortPanel.statField.times')}</option>`}
                                <option value="size" data-i18n="playlistSortPanel.statField.size">${t('playlistSortPanel.statField.size')}</option>
                                ${isPhoto ? '' : `<option value="duration" data-i18n="playlistSortPanel.statField.duration">${t('playlistSortPanel.statField.duration')}</option>`}
                            </select>
                        </div>
                        <!-- MỚI (mục 3) — dropdown hướng, CHỈ hiện khi field ở trên khác 'none' —
                             mặc định "hidden", workflowPlaylist.openSortPanel() tự gỡ/gắn lại lúc
                             mở panel + lúc đổi field (changeStatSortField()). -->
                        <div data-sort-direction-row class="hidden flex flex-col p-4 gap-1.5">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.statDirection.label">${t('playlistSortPanel.statDirection.label')}</span>
                                <select id="setting-playlist-sort-stat-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="desc" data-i18n="playlistSortPanel.statDirection.desc">${t('playlistSortPanel.statDirection.desc')}</option>
                                    <option value="asc" data-i18n="playlistSortPanel.statDirection.asc">${t('playlistSortPanel.statDirection.asc')}</option>
                                </select>
                            </div>
                            <div class="text-xs text-slate-400" data-i18n="playlistSortPanel.statField.hint">${t('playlistSortPanel.statField.hint')}</div>
                        </div>
                    </div>
                </div>
`;
}
