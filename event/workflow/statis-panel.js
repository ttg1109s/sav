/**
 * event/workflow/statis-panel.js — Workflow của router "statisPanel": panel Statistics (Overview + Media types + Top list).
 * Đọc DB cả 3 store (workflowPlaylistScope.listMediaRecords() — `playlistCache` chỉ giữ 1 Nguồn) MỖI LẦN MỞ panel, chụp
 * vào `_cache`; đổi sort/filter/share/trang chỉ tính lại trên `_cache`. `_sortMode`/`_filterType`/`_shareMode` là state UI
 * cục bộ (không qua AppState, mất khi đóng app là đúng ý). Top list dùng icon loại tĩnh (không Blob URL) nên vẽ lại nhiều
 * lần không cần dọn gì.
 *
 * NẠP SAU: core/statis-panel.js, core/statis-panel-ui.js, components/statis-panel.js, core/number-countup.js,
 * event/workflow/number-countup.js, core/listen-stats.js, core/playlist/loader.js, core/file-manager/video.js,
 * core/placeholder-panel.js, core/dom-refs.js, event/workflow/playlist-scope.js, event/workflow/pagination.js.
 * NẠP TRƯỚC: event/router/statis-panel.js.
 */
const STATIS_COUNTUP_TASK = 'statisPanelCountUp'; // task đếm-lên số liệu lúc MỞ panel (workflowNumberCountup.run, event/workflow/number-countup.js)
const STATIS_COUNTUP_STEPS = 24; // x 35ms mặc định của workflowNumberCountup ≈ 0.85s
const STATIS_COUNTUP_EASE_POWER = 3; // ease-out cubic (computeCountupValue, core/number-countup.js) — nhanh lúc đầu, chậm dần khi chốt số
const STATIS_TOP_LIST_LIMIT = 20; // Top N khi không phân trang — thư viện lớn chỉ cần xem nhanh vài chục đầu bảng

/** Khung đếm-lên theo loại số: thanh tiến độ (độ rộng %), thời gian nghe, số nguyên. */
const STATIS_COUNTUP_PAINT_BY_FMT = {
    bar: (el, value) => setStatisCountupBarWidth(el, value), // core/statis-panel-ui.js
    time: (el, value) => setStatisCountupText(el, formatListenTime(value)), // core/listen-stats.js
    int: (el, value) => setStatisCountupText(el, formatStatisCount(value)), // core/statis-panel.js
};

const workflowStatisPanel = {
    _sortMode: 'count', // 'count' | 'totalTime' — mặc định "Lượt phát nhiều nhất"
    _filterType: 'all', // 'all' | 'song' | 'video' | 'photo'
    _shareMode: 'count', // 'count' | 'totalTime' — biểu đồ tròn + % Media types chia theo lượt phát / thời gian
    _topListPageIndex: 0, // trang Top list (nơi 'statisTopList' của Pagination); về 0 khi mở panel/đổi sort/đổi filter
    _cache: null, // {items, byType, grandTotal} — chụp 1 lần lúc MỞ panel (openPanel()), đổi sort/filter chỉ lọc/sort lại trên đây
    _loadToken: 0, // tăng mỗi lần openPanel() — loại kết quả đọc DB của lần mở CŨ nếu đã có lần mở mới hơn

    /** 'appPanelNav.statis.click' (gọi thẳng từ workflowAppPanelNav.openStatis()). Hiện skeleton ngay rồi mới hiện panel
     * (đọc DB tốn thời gian không xác định), đọc xong vẽ thật + đếm-lên. */
    async openPanel() {
        const loadToken = ++this._loadToken;
        taskManager.kill(STATIS_COUNTUP_TASK); // mở lại panel lúc lượt đếm-lên cũ chưa xong
        setStatisPanelBodyHtml(statisPanelBody, renderStatisPanelSkeletonHtml()); // core/statis-panel-ui.js + components/statis-panel.js
        applyUiThemeToDom(statisPanelBody, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — nội dung dựng động (data-uitk)
        showPlaceholderPanel(statisPanel); // core/placeholder-panel.js
        this._topListPageIndex = 0;
        const data = await this._loadData();
        if (loadToken !== this._loadToken) return; // đã đóng/mở lại trong lúc đọc DB — lần mở mới hơn tự vẽ
        this._cache = data;
        this.renderContent(true);
    },

    /** Đọc 3 store + thống kê nghe rồi tổng hợp — số liệu chụp lúc MỞ panel (panel phủ toàn màn, không cần số nhảy live). */
    async _loadData() {
        const [songRecordsRaw, videoRecords, photoRecords] = await Promise.all([
            workflowPlaylistScope.listMediaRecords('song'), // event/workflow/playlist-scope.js
            workflowPlaylistScope.listMediaRecords('video'),
            workflowPlaylistScope.listMediaRecords('photo'),
        ]);
        const songRecords = filterValidSongRecords(songRecordsRaw, appState.get('confirmedBrokenKeys')); // core/playlist/loader.js
        const items = [
            ...songRecords.map((r) => this._buildStatisItem(r, 'song')),
            ...pickMediaRecordsWithBlob(videoRecords).map((r) => this._buildStatisItem(r, 'video')), // core/statis-panel.js
            ...pickMediaRecordsWithBlob(photoRecords).map((r) => this._buildStatisItem(r, 'photo')),
        ];
        return { items, ...computeStatisAggregates(items) }; // core/statis-panel.js
    },

    /** Vẽ lại nội dung từ `_cache` (đồng bộ, không đọc DB) — lúc mở xong (`animate` = đếm-lên) và mỗi lần đổi sort/filter/
     * share/trang (không animate). `_cache` null (chưa tải xong) -> bỏ qua, openPanel() tự vẽ với state mới nhất. */
    renderContent(animate) {
        if (!this._cache) return;
        taskManager.kill(STATIS_COUNTUP_TASK); // DOM cũ sắp bị thay
        const { items, byType, grandTotal } = this._cache;
        // Pagination 'statisTopList' BẬT -> phân trang toàn bộ bảng xếp hạng; TẮT -> chỉ Top STATIS_TOP_LIST_LIMIT.
        const isPaginated = workflowPagination.getPlaceSettings('statisTopList').enabled; // event/workflow/pagination.js
        const rankSource = rankStatisItems(items, this._filterType, this._sortMode, isPaginated ? null : STATIS_TOP_LIST_LIMIT); // core/statis-panel.js
        const view = workflowPagination.computePlaceView('statisTopList', rankSource, this._topListPageIndex);
        this._topListPageIndex = view.pageIndex; // giá trị đã kẹp
        const html = renderStatisPanelBodyHtml({ // components/statis-panel.js
            grandTotal, byType,
            topList: view.pageItems,
            sortMode: this._sortMode, filterType: this._filterType, shareMode: this._shareMode,
            rankOffset: view.startIndex,
            rankedTotal: rankSource.length,
            paginationHtml: workflowPagination.buildControlsHtml(view),
            chart: computeStatisShareChart(byType, this._shareMode), // core/statis-panel.js
        });
        setStatisPanelBodyHtml(statisPanelBody, html); // core/statis-panel-ui.js
        applyUiThemeToDom(statisPanelBody, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        if (animate) this._startCountup();
    },

    /** Đếm-lên các con số Overview / Media types + thanh "Library played" (Top media không đếm). Ép về khung 0 ngay (không
     * nhá số cuối trước khi đếm) rồi chạy vòng lặp dùng chung workflowNumberCountup.run(). */
    _startCountup() {
        const targets = collectStatisCountupTargets(statisPanelBody); // core/statis-panel-ui.js
        if (targets.length === 0) return;
        const paintFrame = (step, steps) => {
            for (const { el, finalValue, fmt } of targets) {
                const value = computeCountupValue(finalValue, step, steps, STATIS_COUNTUP_EASE_POWER, 0); // core/number-countup.js
                (STATIS_COUNTUP_PAINT_BY_FMT[fmt] || STATIS_COUNTUP_PAINT_BY_FMT.int)(el, value);
            }
        };
        paintFrame(0, STATIS_COUNTUP_STEPS);
        workflowNumberCountup.run(STATIS_COUNTUP_TASK, { steps: STATIS_COUNTUP_STEPS, onFrame: paintFrame }); // event/workflow/number-countup.js
    },

    /** 1 record -> item Top list; tên hiển thị cùng công thức playlist (Song: `tag.title`; Video/Photo: customName, không có
     * thì filename bỏ đuôi). */
    _buildStatisItem(record, mediaType) {
        const name = mediaType === 'song' ? record.tag.title : (record.customName || stripFileExtension(record.filename)); // core/file-manager/video.js
        const stats = workflowListenStats.getStats(mediaType, record.key); // event/workflow/listen-stats.js — SỬA 06/10/2026: đúng loại media, {count, totalTime}
        return { key: record.key, mediaType, name, count: stats.count, totalTime: stats.totalTime };
    },

    /** 'statisPanel.topList.page.change'. @param {number} pageIndex */
    setTopListPage(pageIndex) {
        this._topListPageIndex = pageIndex;
        this.renderContent();
    },

    /** 'statisPanel.sort.click' — đổi tiêu chí, về trang 1. */
    setSortMode(mode) {
        if (this._sortMode === mode) return;
        this._sortMode = mode;
        this._topListPageIndex = 0;
        this.renderContent();
    },

    /** 'statisPanel.shareMode.click' — chia % Media types theo lượt phát / thời gian. */
    setShareMode(mode) {
        if (this._shareMode === mode) return;
        this._shareMode = mode;
        this.renderContent();
    },

    /** 'statisPanel.filter.click' — đổi loại, về trang 1. */
    setFilterType(type) {
        if (this._filterType === type) return;
        this._filterType = type;
        this._topListPageIndex = 0;
        this.renderContent();
    },
};
