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
 * MỞ RỘNG (hợp nhất Photo vào Playlist) — field 'times' (tổng thời gian nghe) KHÔNG áp dụng cho
 * Photo (ảnh không tính "thời gian nghe" — xem event/workflow/photo-player.js, docstring đầu file:
 * Photo KHÔNG dùng startListenClock()/stopListenClock()) — ẩn khỏi dropdown khi `source==='photo'`
 * (CHỐT Giang). `count` GIỮ LẠI cho Photo, đổi ý nghĩa thành "lượt click xem" (xem event/workflow/
 * file-manager-photo.js::openImagePreview() — bumpSongPlayCount()).
 * SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — field 'duration' TRƯỚC ĐÂY ẩn
 * cho Photo (lúc đó `duration` hard-code 0, vô nghĩa) — giờ `duration` là số THẬT (tính lúc upload,
 * core/playlist/loader.js::buildAdaptedPlaylistCache()), HIỆN LẠI cho Photo giống Song/Video.
 * @param {string} source - 'song' | 'video' | 'photo'.
 *
 * SỬA (09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — viết LẠI TRỰC TIẾP bằng bảng màu sáng,
 * không còn phụ thuộc `.app-settings-scope` đè màu (assets/css/layout-nav.css) để hiện đúng trên
 * Generic Drawer nền trắng.
 */
function renderPlaylistSortPanelBody(source) {
    const isPhoto = source === 'photo';
    return `
                <div>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.nameMode.label">${t('playlistSortPanel.nameMode.label')}</span>
                            <select id="setting-playlist-sort-name" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="az" data-i18n="settingsPlaylistBg.sortMode.az">${t('settingsPlaylistBg.sortMode.az')}</option>
                                <option value="za" data-i18n="settingsPlaylistBg.sortMode.za">${t('settingsPlaylistBg.sortMode.za')}</option>
                                <option value="newest" data-i18n="settingsPlaylistBg.sortMode.newest">${t('settingsPlaylistBg.sortMode.newest')}</option>
                                <option value="oldest" data-i18n="settingsPlaylistBg.sortMode.oldest">${t('settingsPlaylistBg.sortMode.oldest')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.statField.label">${t('playlistSortPanel.statField.label')}</span>
                            <select id="setting-playlist-sort-stat-field" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="none" data-i18n="playlistSortPanel.statField.none">${t('playlistSortPanel.statField.none')}</option>
                                <option value="count" data-i18n="playlistSortPanel.statField.count">${t('playlistSortPanel.statField.count')}</option>
                                ${isPhoto ? '' : `<option value="times" data-i18n="playlistSortPanel.statField.times">${t('playlistSortPanel.statField.times')}</option>`}
                                <option value="size" data-i18n="playlistSortPanel.statField.size">${t('playlistSortPanel.statField.size')}</option>
                                <option value="duration" data-i18n="playlistSortPanel.statField.duration">${t('playlistSortPanel.statField.duration')}</option>
                            </select>
                        </div>
                        <!-- MỚI (mục 3) — dropdown hướng, CHỈ hiện khi field ở trên khác 'none' —
                             mặc định "hidden", workflowPlaylist.openSortPanel() tự gỡ/gắn lại lúc
                             mở panel + lúc đổi field (changeStatSortField()). -->
                        <div data-sort-direction-row class="hidden flex flex-col p-4 gap-1.5">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium truncate" data-i18n="playlistSortPanel.statDirection.label">${t('playlistSortPanel.statDirection.label')}</span>
                                <select id="setting-playlist-sort-stat-direction" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                    <option value="desc" data-i18n="playlistSortPanel.statDirection.desc">${t('playlistSortPanel.statDirection.desc')}</option>
                                    <option value="asc" data-i18n="playlistSortPanel.statDirection.asc">${t('playlistSortPanel.statDirection.asc')}</option>
                                </select>
                            </div>
                            <div class="text-xs text-slate-500" data-i18n="playlistSortPanel.statField.hint">${t('playlistSortPanel.statField.hint')}</div>
                        </div>
                    </div>
                </div>
`;
}
