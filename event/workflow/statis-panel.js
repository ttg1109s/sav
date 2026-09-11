/**
 * event/workflow/statis-panel.js — MỚI (Giang yêu cầu "tích hợp 1+2+3" cho panel Statis). "THẰNG
 * THỰC THI CUỐI" của router "statisPanel" — điều phối panel Statis (stat-grid tổng quan + card so
 * sánh Song/Video/Photo + Top list xếp hạng, xem components/statis-panel.js +
 * core/statis-panel-ui.js). CÙNG khuôn `workflowGameCatalog` (event/workflow/game-catalog.js).
 *
 * `listMediaRecords()` đọc DB trực tiếp (Rule 3 — Core cấm) nên PHẢI gọi từ đây, KHÔNG phải Core —
 * đọc CẢ 3 store (Song/Video/Photo) độc lập với `playlistCache` (chỉ giữ ĐÚNG 1 Nguồn đang active,
 * xem event/workflow/playlist-scope.js — không dùng được cho panel cần gộp CẢ 3 cùng lúc).
 *
 * `_sortMode`/`_filterType` — 2 field toggle UI CỤC BỘ của panel này, KHÔNG qua AppState (khác
 * `gameplayArmedGameId` — field đó cần NHIỀU cụm khác đọc/ghi qua lại, xem service/state/
 * gameplay-runtime.js; 2 field ở đây chỉ Workflow này tự đọc/tự ghi, không cụm nào khác cần biết —
 * không đáng thêm 1 entry AppState schema mới cho state thuần UI-local, mất khi đóng app CŨNG ĐÚNG
 * ý — không cần nhớ qua lần mở panel sau nữa cũng được, đơn giản hơn).
 *
 * KHÔNG cap giới hạn thumbnail/Blob URL nào ở đây (Top list dùng icon loại media tĩnh, xem docstring
 * core/statis-panel-ui.js) — `renderContent()` an toàn gọi lại nhiều lần liên tiếp (đổi sort/filter)
 * mà không cần dọn dẹp gì giữa các lần, KHÁC hẳn `buildSongNode()` (core/playlist/render.js) phải tự
 * revoke Blob URL cũ trước khi tạo URL mới.
 *
 * NẠP SAU: core/statis-panel-ui.js (buildStatisPanelBodyHtml), core/listen-stats.js (getSongStats),
 * core/playlist/loader.js (filterValidSongRecords), core/file-manager/video.js
 * (stripFileExtension), core/placeholder-panel.js (showPlaceholderPanel), core/dom-refs.js
 * (statisPanel, statisPanelBody), event/workflow/playlist-scope.js (workflowPlaylistScope.
 * listMediaRecords).
 * NẠP TRƯỚC: event/router/statis-panel.js.
 */
const STATIS_TOP_LIST_LIMIT = 20; // Top N hiện trong list — thư viện lớn (hàng trăm/nghìn file) vẫn chỉ cần xem nhanh vài chục đầu bảng, KHÔNG render hết toàn bộ

const workflowStatisPanel = {
    _sortMode: 'count', // 'count' | 'totalTime' — mặc định "Lượt phát nhiều nhất"
    _filterType: 'all', // 'all' | 'song' | 'video' | 'photo'

    /** Ứng với 'appPanelNav.statis.click' — gọi THẲNG từ workflowAppPanelNav.openStatis() (liên
     * tuyến domain, CÙNG khuôn workflowGameCatalog.openPanel()). Hiện placeholder "đang tải" NGAY
     * (tránh đứng hình lúc await đọc 3 store DB) RỒI mới hiện panel — KHÁC Game (data tĩnh, render
     * xong mới hiện panel luôn) vì ở đây việc đọc DB thật sự tốn thời gian không xác định trước. */
    async openPanel() {
        statisPanelBody.innerHTML = `<p class="text-sm text-center py-14" data-uitk="textSecondary" data-i18n="statisPanel.loading">${t('statisPanel.loading')}</p>`;
        showPlaceholderPanel(statisPanel); // core/placeholder-panel.js
        await this.renderContent();
    },

    /** Đọc lại TOÀN BỘ 3 store (Song/Video/Photo) + mediaStatsMap, tổng hợp rồi vẽ lại HẲN nội dung
     * panel — CÙNG khuôn "re-render toàn bộ mỗi lần đổi state" của `workflowGameCatalog.renderList()`
     * (thư viện thực tế không đủ lớn để việc đọc lại tốn kém tới mức cần tối ưu diff riêng). Gọi lại
     * mỗi lần đổi `_sortMode`/`_filterType`. */
    async renderContent() {
        const [songRecordsRaw, videoRecords, photoRecords] = await Promise.all([
            workflowPlaylistScope.listMediaRecords('song'), // event/workflow/playlist-scope.js
            workflowPlaylistScope.listMediaRecords('video'),
            workflowPlaylistScope.listMediaRecords('photo'),
        ]);
        const songRecords = filterValidSongRecords(songRecordsRaw, appState.get('confirmedBrokenKeys')); // core/playlist/loader.js — CÙNG guard applyFolderScope() dùng cho Song

        const items = [
            ...songRecords.map((r) => this._buildStatisItem(r, 'song')),
            ...videoRecords.filter((r) => r.blob).map((r) => this._buildStatisItem(r, 'video')), // guard `!record.blob` — CÙNG lý do buildAdaptedPlaylistCache() (core/playlist/loader.js)
            ...photoRecords.filter((r) => r.blob).map((r) => this._buildStatisItem(r, 'photo')),
        ];

        const byType = {};
        for (const mediaType of ['song', 'video', 'photo']) {
            const ofType = items.filter((i) => i.mediaType === mediaType);
            byType[mediaType] = {
                itemCount: ofType.length,
                playCount: ofType.reduce((sum, i) => sum + i.count, 0),
                totalTime: ofType.reduce((sum, i) => sum + i.totalTime, 0),
            };
        }
        const grandTotal = {
            itemCount: items.length,
            playCount: items.reduce((sum, i) => sum + i.count, 0),
            totalTime: items.reduce((sum, i) => sum + i.totalTime, 0),
            neverPlayedCount: items.filter((i) => i.count === 0).length,
        };

        const filtered = this._filterType === 'all' ? items : items.filter((i) => i.mediaType === this._filterType);
        const topList = filtered.slice().sort((a, b) => b[this._sortMode] - a[this._sortMode]).slice(0, STATIS_TOP_LIST_LIMIT);

        statisPanelBody.innerHTML = buildStatisPanelBodyHtml(grandTotal, byType, topList, this._sortMode, this._filterType, t); // core/statis-panel-ui.js
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(statisPanelBody, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — nội dung dựng ĐỘNG, phải tự áp lại mỗi lần renderContent() chạy, CÙNG lý do renderList() của gameCatalog
    },

    /** Chuẩn hoá 1 record (Song/Video/Photo) thành shape thuần Top list cần — tên hiển thị CÙNG công
     * thức `buildAdaptedPlaylistCache()`/`buildSongPlaylistCache()` đã dùng (customName ưu tiên,
     * fallback filename bỏ đuôi cho Video/Photo; Song dùng thẳng `tag.title` đã đọc ID3). */
    _buildStatisItem(record, mediaType) {
        const name = mediaType === 'song' ? record.tag.title : (record.customName || stripFileExtension(record.filename)); // core/file-manager/video.js
        const stats = getSongStats(record.key); // core/listen-stats.js — key-agnostic, {count, totalTime}
        return { key: record.key, mediaType, name, count: stats.count, totalTime: stats.totalTime };
    },

    /** Ứng với 'statisPanel.sort.click'. */
    setSortMode(mode) {
        if (this._sortMode === mode) return;
        this._sortMode = mode;
        this.renderContent();
    },

    /** Ứng với 'statisPanel.filter.click'. */
    setFilterType(type) {
        if (this._filterType === type) return;
        this._filterType = type;
        this.renderContent();
    },
};
