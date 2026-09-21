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
 * NẠP SAU: core/number-countup.js (computeCountupValue), event/workflow/number-countup.js
 * (workflowNumberCountup), core/statis-panel-ui.js (buildStatisPanelBodyHtml), core/listen-stats.js (getSongStats),
 * core/playlist/loader.js (filterValidSongRecords), core/file-manager/video.js
 * (stripFileExtension), core/placeholder-panel.js (showPlaceholderPanel), core/dom-refs.js
 * (statisPanel, statisPanelBody), event/workflow/playlist-scope.js (workflowPlaylistScope.
 * listMediaRecords).
 * NẠP TRƯỚC: event/router/statis-panel.js.
 */
const STATIS_COUNTUP_TASK = 'statisPanelCountUp'; // task đếm-lên số liệu lúc MỞ panel (workflowNumberCountup.run, event/workflow/number-countup.js)
const STATIS_COUNTUP_STEPS = 24; // x 35ms mặc định của workflowNumberCountup ≈ 0.85s
const STATIS_COUNTUP_EASE_POWER = 3; // ease-out cubic (computeCountupValue, core/number-countup.js) — nhanh lúc đầu, chậm dần khi chốt số
const STATIS_TOP_LIST_LIMIT = 20; // Top N hiện trong list — thư viện lớn (hàng trăm/nghìn file) vẫn chỉ cần xem nhanh vài chục đầu bảng, KHÔNG render hết toàn bộ

const workflowStatisPanel = {
    _sortMode: 'count', // 'count' | 'totalTime' — mặc định "Lượt phát nhiều nhất"
    _filterType: 'all', // 'all' | 'song' | 'video' | 'photo'
    _cache: null, // {items, byType, grandTotal} — chụp 1 lần lúc MỞ panel (openPanel()), đổi sort/filter chỉ lọc/sort lại trên đây
    _loadToken: 0, // tăng mỗi lần openPanel() — loại kết quả đọc DB của lần mở CŨ nếu đã có lần mở mới hơn

    /** Ứng với 'appPanelNav.statis.click' — gọi THẲNG từ workflowAppPanelNav.openStatis() (liên
     * tuyến domain, CÙNG khuôn workflowGameCatalog.openPanel()). Hiện SKELETON "đang tải" NGAY
     * (tránh đứng hình lúc await đọc 3 store DB) RỒI mới hiện panel — KHÁC Game (data tĩnh, render
     * xong mới hiện panel luôn) vì ở đây việc đọc DB thật sự tốn thời gian không xác định trước.
     * SỬA 21/09/2026 (Giang yêu cầu "làm nốt"): (1) placeholder chữ "Loading stats…" đổi thành
     * skeleton đúng bố cục thật (`buildStatisPanelSkeletonHtml()`, core/statis-panel-ui.js); (2) đọc
     * DB CHỈ ở đây, mỗi lần MỞ panel — đổi sort/filter sau đó dùng lại `_cache`, không query lại. */
    async openPanel() {
        const loadToken = ++this._loadToken;
        taskManager.kill(STATIS_COUNTUP_TASK); // mở lại panel lúc lượt đếm-lên cũ chưa xong
        statisPanelBody.innerHTML = buildStatisPanelSkeletonHtml(t); // core/statis-panel-ui.js
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(statisPanelBody, _activeUiThemeKeyList); // skeleton cũng dựng ĐỘNG (data-uitk) — phải áp theme như renderContent()
        showPlaceholderPanel(statisPanel); // core/placeholder-panel.js
        const data = await this._loadData();
        if (loadToken !== this._loadToken) return; // người dùng đã đóng/mở lại panel trong lúc đọc DB — lần mở MỚI hơn sẽ tự vẽ, bỏ kết quả cũ này
        this._cache = data;
        this.renderContent(true); // CHỈ lúc MỞ panel mới animation đếm-lên số liệu
    },

    /** Đọc lại TOÀN BỘ 3 store (Song/Video/Photo) + mediaStatsMap rồi TỔNG HỢP (items/byType/
     * grandTotal) — CHỈ gọi từ `openPanel()`. Trả object thuần, KHÔNG tự ghi `_cache`/vẽ (việc của
     * openPanel, sau khi kiểm tra token còn đúng). Số liệu chụp tại thời điểm MỞ panel — nếu vẫn đang
     * phát nhạc/video phía sau, số chỉ cập nhật khi mở lại panel (panel phủ toàn màn hình, không
     * nhìn số nhảy live). */
    async _loadData() {
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
        const neverPlayedCount = items.filter((i) => i.count === 0).length;
        const playedItemCount = items.length - neverPlayedCount;
        const grandTotal = {
            itemCount: items.length,
            playCount: items.reduce((sum, i) => sum + i.count, 0),
            totalTime: items.reduce((sum, i) => sum + i.totalTime, 0),
            neverPlayedCount,
            // `playedItemCount` (TRƯỚC ĐÂY UI đọc field này nhưng Workflow không tạo -> `itemCount - undefined` = NaN ở ô "Never played") + `playedPercent` cho card "Library played". Math.floor (KHÔNG round) để không bao giờ hiện 100% khi vẫn còn file chưa phát (vd 1023/1024).
            playedItemCount,
            playedPercent: items.length > 0 ? Math.floor((playedItemCount / items.length) * 100) : 0,
        };
        // Tỷ trọng % lượt phát từng loại trên TỔNG lượt phát (card "Media types") — tính ở Workflow, Core-ui chỉ vẽ. Math.round nên tổng 3 loại có thể lệch 99/101, chấp nhận được với số hiển thị.
        for (const mediaType of ['song', 'video', 'photo']) {
            byType[mediaType].playSharePercent = grandTotal.playCount > 0 ? Math.round((byType[mediaType].playCount / grandTotal.playCount) * 100) : 0;
        }
        return { items, byType, grandTotal };
    },

    /** Vẽ lại HẲN nội dung panel từ `_cache` (ĐỒNG BỘ, không đọc DB) — gọi lúc mở panel xong tải (`animate` = true -> chạy đếm-lên số liệu,
     * `_startCountup()`) VÀ mỗi lần đổi `_sortMode`/`_filterType` (không animate — chỉ vẽ lại số cuối, tránh
     * mỗi lần bấm sort/filter là cả panel đếm lại từ 0). Vì không còn `await` nào nên các lần click liên tiếp chạy
     * tuần tự đúng thứ tự, KHÔNG còn nguy cơ render cũ ghi đè render mới. `_cache` null (panel chưa
     * tải xong mà người dùng đã bấm) -> bỏ qua, `openPanel()` tự vẽ khi tải xong với state mới nhất. */
    renderContent(animate) {
        if (!this._cache) return;
        taskManager.kill(STATIS_COUNTUP_TASK); // đổi sort/filter lúc lượt đếm-lên đang chạy -> dừng, DOM cũ sắp bị thay
        const { items, byType, grandTotal } = this._cache;

        // Top list CHỈ xếp hạng item CÓ dữ liệu theo tiêu chí đang sort (count > 0 khi "Most played", totalTime > 0 khi "Most time") — item 0 lượt không chen vào đáy bảng và empty state theo loại mới đúng nghĩa.
        const filteredByType = this._filterType === 'all' ? items : items.filter((i) => i.mediaType === this._filterType);
        const topList = filteredByType.filter((i) => i[this._sortMode] > 0).sort((a, b) => b[this._sortMode] - a[this._sortMode]).slice(0, STATIS_TOP_LIST_LIMIT); // `.filter()` đã trả mảng MỚI nên `.sort()` thẳng không đụng `items` trong cache

        statisPanelBody.innerHTML = buildStatisPanelBodyHtml(grandTotal, byType, topList, this._sortMode, this._filterType, t); // core/statis-panel-ui.js
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(statisPanelBody, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — nội dung dựng ĐỘNG, phải tự áp lại mỗi lần renderContent() chạy, CÙNG lý do renderList() của gameCatalog
        if (animate) this._startCountup();
    },

    /** Đếm-lên MỌI con số trong panel (Overview / Media types / giá trị Top list + thanh "Library played")
     * — MỚI 21/09/2026 (Giang yêu cầu animation number cho Overview và Statistics). Quét các phần tử
     * `[data-countup]` core-ui đã gắn sẵn (core/statis-panel-ui.js: `data-countup` = số đích,
     * `data-countup-fmt` = 'int' | 'time' | 'bar'), ép về khung 0 NGAY (đồng bộ ngay sau khi gán
     * innerHTML -> không nhá số cuối trước khi đếm), rồi chạy vòng lặp dùng chung
     * `workflowNumberCountup.run()`; giá trị mỗi khung do `computeCountupValue()` (core/number-countup.js). */
    _startCountup() {
        const targets = [...statisPanelBody.querySelectorAll('[data-countup]')].map((el) => ({ el, finalValue: Number(el.dataset.countup), fmt: el.dataset.countupFmt }));
        if (targets.length === 0) return;
        const paintFrame = (step, steps) => {
            for (const { el, finalValue, fmt } of targets) {
                const value = computeCountupValue(finalValue, step, steps, STATIS_COUNTUP_EASE_POWER, 0); // core
                if (fmt === 'bar') el.style.width = `${value}%`;
                else el.textContent = fmt === 'time' ? formatListenTime(value) : Number(value).toLocaleString(); // core/listen-stats.js
            }
        };
        paintFrame(0, STATIS_COUNTUP_STEPS);
        workflowNumberCountup.run(STATIS_COUNTUP_TASK, { steps: STATIS_COUNTUP_STEPS, onFrame: paintFrame });
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
