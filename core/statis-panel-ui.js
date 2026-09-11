/**
 * core/statis-panel-ui.js — MỚI (Giang yêu cầu "tích hợp 1+2+3" cho panel Statis, App Panel tab
 * "Statis" — THAY hẳn placeholder "coming soon" cũ, xem components/statis-panel.js). Core-ui
 * (Rule 5c, hậu tố `-ui`) DÙNG CHUNG, CÙNG khuôn `buildGamePanelListHtml()` (core/gameplay/
 * game-panel-ui.js): hàm CHỈ dựng chuỗi HTML — KHÔNG `addEventListener` (gắn tương tác là việc của
 * Workflow, xem event/workflow/statis-panel.js), KHÔNG `appState.get()` (Rule 2) — mọi số liệu đã
 * TỔNG HỢP SẴN do Workflow tự đọc DB (`workflowPlaylistScope.listMediaRecords()`) + `mediaStatsMap`
 * (core/listen-stats.js) rồi truyền vào tham số dưới dạng object thuần.
 *
 * 3 khối theo ĐÚNG thứ tự Giang chốt "tích hợp 1+2+3":
 *   1. Stat-grid — 3 ô số liệu nổi bật (Tổng thời gian/Tổng lượt phát/Chưa từng phát), gộp CẢ 3
 *      loại media.
 *   2. Card so sánh — 3 card Song/Video/Photo cạnh nhau, mỗi card {số file, tổng lượt phát, tổng
 *      thời gian}.
 *   3. Toggle sort (Lượt phát nhiều nhất/Thời gian nhiều nhất) + chip lọc (Tất cả/Song/Video/Photo)
 *      + Top list xếp hạng (tên + icon loại + số liệu theo ĐÚNG sortMode đang chọn).
 *
 * Icon loại media (nốt nhạc/máy quay/ảnh) — path SVG outline chuẩn (Heroicons-style, CÙNG bộ path
 * đã dùng rải khắp project cho các icon khác, vd nút X đóng panel `M6 18L18 6M6 6l12 12`) — KHÔNG
 * phải ảnh/thumbnail thật: Giang chốt bỏ qua thumbnail cho Top list (tránh vòng đời Blob URL phải
 * tự quản lý/revoke mỗi lần re-render list — xem cách buildSongNode() làm, core/playlist/render.js
 * — phức tạp không tương xứng lợi ích cho 1 list chỉ cần "xem nhanh xếp hạng").
 *
 * `escapeHtml()` (core/modal-choice-ui.js) cho MỌI `name` — dữ liệu người dùng thật (tên file/tên
 * đã đổi qua "Sửa"), khác `game.id` (data TĨNH dev tự khai) ở game-panel-ui.js không cần escape.
 *
 * @typedef {{itemCount:number, playCount:number, totalTime:number, neverPlayedCount:number}} StatisGrandTotal
 * @typedef {{itemCount:number, playCount:number, totalTime:number}} StatisTypeTotal
 * @typedef {{key:string, mediaType:'song'|'video'|'photo', name:string, count:number, totalTime:number}} StatisTopItem
 */
const STATIS_TYPE_ICON_PATH = {
    song: 'M9 19V6l12-3v13M5 21a2 2 0 100-4 2 2 0 000 4zm12-2a2 2 0 100-4 2 2 0 000 4z', // nốt nhạc — CÙNG path fieldPlayCount đã dùng (core/playlist/actions.js)
    video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', // máy quay
    photo: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', // ảnh
};
const STATIS_TYPE_ACCENT = {
    song: 'bg-indigo-100 text-indigo-600',
    video: 'bg-rose-100 text-rose-600',
    photo: 'bg-amber-100 text-amber-600',
};

/**
 * @param {StatisGrandTotal} grandTotal - gộp CẢ 3 loại (itemCount = tổng số file toàn thư viện, neverPlayedCount Workflow tự đếm số item `count===0` — KHÔNG suy ra lại ở đây, cùng lý do "Core không tự sort/lọc" ở tham số `topList` dưới).
 * @param {{song:StatisTypeTotal, video:StatisTypeTotal, photo:StatisTypeTotal}} byType
 * @param {StatisTopItem[]} topList - Workflow tự sort/filter/cắt TOP N SẴN theo `sortMode`/`filterType` — hàm này CHỈ vẽ, không tự sort/lọc lại (Rule 3a: Core cấm gọi Core khác, và sort/filter dữ liệu domain-agnostic đã có core/playlist/order.js — không viết trùng ở đây).
 * @param {'count'|'totalTime'} sortMode
 * @param {'all'|'song'|'video'|'photo'} filterType
 * @param {function} t
 * @returns {string}
 */
function buildStatisPanelBodyHtml(grandTotal, byType, topList, sortMode, filterType, t) {
    if (grandTotal.itemCount === 0) {
        return `<p class="text-sm text-center py-14" data-uitk="textSecondary" data-i18n="statisPanel.comingSoon">${t('statisPanel.comingSoon')}</p>`;
    }

    // ===== Khối 1 — stat-grid =====
    const statGrid = `
        <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="rounded-xl p-3 text-center" data-uitk="cardBg">
                <p class="text-lg font-bold leading-tight" data-uitk="textPrimary">${formatListenTime(grandTotal.totalTime)}</p>
                <p class="text-[11px] mt-0.5" data-uitk="textSecondary" data-i18n="statisPanel.overview.totalTime">${t('statisPanel.overview.totalTime')}</p>
            </div>
            <div class="rounded-xl p-3 text-center" data-uitk="cardBg">
                <p class="text-lg font-bold leading-tight" data-uitk="textPrimary">${grandTotal.playCount}</p>
                <p class="text-[11px] mt-0.5" data-uitk="textSecondary" data-i18n="statisPanel.overview.totalPlays">${t('statisPanel.overview.totalPlays')}</p>
            </div>
            <div class="rounded-xl p-3 text-center" data-uitk="cardBg">
                <p class="text-lg font-bold leading-tight" data-uitk="textPrimary">${grandTotal.itemCount - grandTotal.playedItemCount}</p>
                <p class="text-[11px] mt-0.5" data-uitk="textSecondary" data-i18n="statisPanel.overview.neverPlayed">${t('statisPanel.overview.neverPlayed')}</p>
            </div>
        </div>`;

    // ===== Khối 2 — card so sánh Song/Video/Photo =====
    const compareCards = ['song', 'video', 'photo'].map((mediaType) => {
        const totals = byType[mediaType];
        return `
            <div class="rounded-xl p-3 flex-1" data-uitk="cardBg">
                <div class="flex items-center gap-1.5 mb-1.5">
                    <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${STATIS_TYPE_ACCENT[mediaType]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="${STATIS_TYPE_ICON_PATH[mediaType]}"/></svg></span>
                    <span class="text-xs font-semibold truncate" data-uitk="textPrimary" data-i18n="statisPanel.type.${mediaType}">${t('statisPanel.type.' + mediaType)}</span>
                </div>
                <p class="text-sm font-bold" data-uitk="textPrimary">${formatListenTime(totals.totalTime)}</p>
                <p class="text-[11px]" data-uitk="textSecondary">${tFormat('statisPanel.compare.itemCount', { n: totals.itemCount })} · ${tFormat('statisPanel.compare.playCount', { n: totals.playCount })}</p>
            </div>`;
    }).join('');

    // ===== Khối 3 — toggle sort + chip lọc + Top list =====
    const sortToggle = ['count', 'totalTime'].map((mode) => {
        const active = mode === sortMode;
        const labelKey = mode === 'count' ? 'statisPanel.sort.byCount' : 'statisPanel.sort.byTime';
        return `<button type="button" class="statis-sort-btn flex-1 h-9 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-sky-500 text-white' : ''}" ${active ? '' : 'data-uitk="cardBg textSecondary"'} data-sort-mode="${mode}" data-i18n="${labelKey}">${t(labelKey)}</button>`;
    }).join('');

    const filterChips = ['all', 'song', 'video', 'photo'].map((type) => {
        const active = type === filterType;
        return `<button type="button" class="statis-filter-btn shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${active ? 'bg-sky-500 text-white' : ''}" ${active ? '' : 'data-uitk="cardBg textSecondary"'} data-filter-type="${type}" data-i18n="statisPanel.type.${type}">${t('statisPanel.type.' + type)}</button>`;
    }).join('');

    const listRows = topList.length === 0
        ? `<p class="text-sm text-center py-10" data-uitk="textSecondary" data-i18n="statisPanel.topList.empty">${t('statisPanel.topList.empty')}</p>`
        : topList.map((item, index) => {
            const value = sortMode === 'count' ? tFormat('playlistView.songInfo.fieldPlayCountValue', { n: item.count }) : formatListenTime(item.totalTime);
            return `
                <div class="flex items-center gap-2.5 py-2 border-b last:border-b-0" data-uitk="dividerBorder">
                    <span class="w-5 text-xs font-bold text-center shrink-0" data-uitk="textSecondary">${index + 1}</span>
                    <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${STATIS_TYPE_ACCENT[item.mediaType]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="${STATIS_TYPE_ICON_PATH[item.mediaType]}"/></svg></span>
                    <span class="flex-1 text-sm truncate" data-uitk="textPrimary">${escapeHtml(item.name)}</span>
                    <span class="text-xs font-semibold shrink-0" data-uitk="textSecondary">${value}</span>
                </div>`;
        }).join('');

    return statGrid +
        `<div class="flex gap-2 mb-4">${compareCards}</div>` +
        `<div class="flex gap-2 mb-2.5">${sortToggle}</div>` +
        `<div class="flex gap-1.5 mb-2 overflow-x-auto pb-0.5">${filterChips}</div>` +
        `<div>${listRows}</div>`;
}
