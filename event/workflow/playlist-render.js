/**
 * event/workflow/playlist-render.js — `workflowPlaylistRender`: dựng/đồng bộ DOM danh sách Playlist theo `renderOrder`,
 * nút Phát, trạng thái rỗng, lớp "đang nạp", cuộn tới bài đang phát, chiều cao ước lượng item, ảnh bìa theo khung nhìn.
 * Chỉ đọc state + điều phối; dữ liệu/kế hoạch ở core/playlist/render.js, thao tác node ở core/playlist/node-ui.js, markup
 * ở components/playlist-view.js.
 *
 * Diff (`renderPlaylistDiff()`): key rớt khỏi `renderOrder` mà vẫn còn trong `playlistOrder` (bị Search/Filter lọc tạm)
 * -> chỉ ẩn, giữ node + ảnh bìa đã tải (xoá từ khoá xong chỉ hiện lại, không dựng lại/tải lại ảnh); không còn trong
 * `playlistOrder` (xoá thật) -> bỏ hẳn (giữ lại là rò object URL bìa). Ảnh bìa thật chỉ tạo object URL khi node lại gần
 * khung nhìn (`attachCoverUrls()`) — tạo hết lúc dựng chiếm ~70% thời gian với 10000 item.
 *
 * NẠP SAU: components/playlist-view.js, core/playlist/{render,node-ui,selection,order,state}.js, core/dom-refs.js,
 * service/blob-url.js. Lúc chạy: event/workflow/playlist.js (`_selectionThemeClasses()`).
 */

/** Bố cục node theo Kiểu xem (khoá boolean thật). */
const SONG_NODE_HTML_BY_GRID = {
    true: (view, durationLabel) => renderGridSongNodeHtml(view, durationLabel), // components/playlist-view.js
    false: (view, durationLabel) => renderListSongNodeHtml(view, durationLabel),
};
// DOM khớp domNodesByKey -> diff tại chỗ; lệch (vd switchSource() vừa dọn domNodesByKey) -> dựng lại toàn bộ.
const PLAYLIST_RENDER_BY_DOM_IN_SYNC = {
    true: () => workflowPlaylistRender._renderPlaylistDiffInPlace(),
    false: () => workflowPlaylistRender.renderPlaylistFull(),
};
// Key có trong renderOrder: đã có node -> hiện lại (bỏ ẩn tạm); chưa có -> dựng mới.
const RENDER_NODE_BY_EXISTS = {
    true: (key, node) => revealPlaylistNode(node), // core/playlist/node-ui.js
    false: (key) => workflowPlaylistRender._buildAndRegisterNode(key),
};
// Đổi bài lúc Playlist có thể đang hiện: menu 3 chấm đang mở -> hoãn (menu neo `fixed` theo nút, cuộn là lìa khỏi item).
const SCROLL_TO_CURRENT_BY_MENU_OPEN = {
    true: () => workflowPlaylistRender._deferScrollToCurrent(),
    false: () => workflowPlaylistRender.scrollToCurrentWhenShown(),
};
// Danh sách vừa đổi nội dung (Search / đổi Nguồn / đổi folder Scope): media đang phát có trong danh sách -> tới thẳng nó
// (tức thì — gõ từng ký tự mà trượt sẽ giật); không có -> về đầu danh sách.
const PLAYLIST_SCROLL_BY_CURRENT_LISTED = {
    true: () => workflowPlaylistRender.scrollToCurrentInstant(),
    false: () => resetPlaylistScrollTop(), // core/playlist/render.js
};
const PLAYLIST_LOADING_HIDE_TASK = 'playlistLoadingHide';
const PLAYLIST_LOADING_FADE_MS = 320; // khớp transition-opacity duration-300 của lớp "đang nạp"
const PLAYLIST_SCROLL_TO_SONG_FRAME_TASK = 'playlistScrollToSongFrame';

const workflowPlaylistRender = {
    /** Dựng 1 node hoàn chỉnh cho 1 mục (Song/Video/Photo dùng chung) theo Kiểu xem. Node luôn dựng ở dạng "thường"; lớp
     * "Chọn nhiều" áp sau bằng đúng cơ chế bật/tắt chọn dùng (`_applySelectionLayer()`), nên node dựng lại lúc đang chọn
     * (play/pause, Next/Prev, đổi Grid/List…) không lệch dấu chọn. Node dựng động nên phải tự áp UI Theme.
     * @param {string} key @returns {HTMLElement} */
    buildSongNode(key) {
        const { playlistCache, currentKey, activeMediaSource, isGridView, isVideoPlayerMode, isPhotoPlayerMode, selectionMode, selectedMediaKeys } = appState.get([
            'playlistCache', 'currentKey', 'activeMediaSource', 'isGridView', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'selectionMode', 'selectedMediaKeys',
        ]);
        const cached = playlistCache.get(key);
        const mediaEl = (cached && cached.mediaType === 'video') ? bgVideoElement : audioPlayer; // chọn GIÁ TRỊ
        const playingMediaType = resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode); // core/playlist/render.js
        const view = computeSongNodeView(key, cached, currentKey, playingMediaType, activeMediaSource, mediaEl.paused); // core/playlist/render.js
        const node = createSongNode(SONG_NODE_HTML_BY_GRID[!!isGridView](view, formatTime(view.duration))); // core/playlist/node-ui.js + core/playlist/state.js
        attachCoverFallback(findSongNodeCoverImg(node)); // core/playlist/render.js + node-ui.js
        applyUiThemeToDom(node, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        this._applySelectionLayer(node, key, selectionMode, selectedMediaKeys);
        return node;
    },

    /** Lớp "Chọn nhiều" cho node vừa dựng — chỉ node ĐÃ chọn cần tint + vòng tick (vòng trống của node còn lại là CSS theo
     * class `is-selecting`). @param {HTMLElement} node @param {string} key @param {boolean} selectionMode @param {Set<string>} selectedMediaKeys */
    _applySelectionLayer(node, key, selectionMode, selectedMediaKeys) {
        if (!selectionMode || !selectedMediaKeys.has(key)) return; // guard
        showSelectionIndicator(node, key, selectedMediaKeys, workflowPlaylist._selectionThemeClasses()); // core/playlist/selection.js + event/workflow/playlist.js
    },

    /** Dựng lại toàn bộ DOM (đổi Grid/List, hoặc DOM lệch domNodesByKey). */
    renderPlaylistFull() {
        const startMs = performance.now();
        const { domNodesByKey, renderOrder } = appState.get(['domNodesByKey', 'renderOrder']);
        domNodesByKey.forEach(revokeNodeCoverUrl); // core/playlist/render.js
        clearPlaylistContainer(playlistContainer); // core/playlist/node-ui.js
        appState.mutate('domNodesByKey', m => m.clear());
        renderOrder.forEach((key) => {
            const node = this.buildSongNode(key);
            appState.mutate('domNodesByKey', m => m.set(key, node));
            appendPlaylistNode(playlistContainer, node); // core/playlist/node-ui.js
        });
        this._invalidateItemBlockSize(); // Grid/List có thể vừa đổi -> đo lại từ đầu
        this.syncItemBlockSize();
        this.syncPlayButtonPlayingState();
        this.syncEmptyState();
        console.log(`writer: "workflowPlaylistRender.renderPlaylistFull", page: "(chẩn đoán)", content: "${computePlaylistElapsedMs(startMs, performance.now())}ms cho ${renderOrder.length} item (dựng lại TOÀN BỘ DOM)"`); // core/playlist/render.js
    },

    /** Đồng bộ DOM theo `renderOrder` mới, tái dùng tối đa node cũ (xem đầu file). */
    renderPlaylistDiff() {
        PLAYLIST_RENDER_BY_DOM_IN_SYNC[isPlaylistDomInSync(playlistContainer, appState.get('domNodesByKey'))](); // core/playlist/node-ui.js
    },

    /** Diff tại chỗ (DOM đang khớp domNodesByKey): ẩn node lọc tạm, bỏ node đã xoá, hiện lại/dựng mới rồi xếp đúng thứ tự. */
    _renderPlaylistDiffInPlace() {
        const startMs = performance.now();
        const { renderOrder, playlistOrder, domNodesByKey } = appState.get(['renderOrder', 'playlistOrder', 'domNodesByKey']);
        const plan = planPlaylistDiff(domNodesByKey, renderOrder, playlistOrder); // core/playlist/render.js
        plan.hide.forEach(([, node]) => hidePlaylistNode(node)); // core/playlist/node-ui.js
        plan.destroy.forEach(([key, node]) => this._destroyNode(key, node));
        let prevNode = null;
        for (const key of renderOrder) {
            const node = RENDER_NODE_BY_EXISTS[domNodesByKey.has(key)](key, domNodesByKey.get(key));
            placePlaylistNodeAfter(playlistContainer, node, prevNode); // core/playlist/node-ui.js
            prevNode = node;
        }
        this._syncItemBlockSizeIfUnmeasured(); // chỉ đo khi chưa đo được lần nào (Full chạy lúc danh sách rỗng)
        this.syncPlayButtonPlayingState();
        this.syncEmptyState();
        console.log(`writer: "workflowPlaylistRender._renderPlaylistDiffInPlace", page: "(chẩn đoán)", content: "${computePlaylistElapsedMs(startMs, performance.now())}ms — dựng mới ${plan.buildCount}/${renderOrder.length} node, đang ẩn tạm ${plan.hide.length}, xoá hẳn ${plan.destroy.length}"`);
    },

    /** Bài đã xoá thật -> bỏ node vĩnh viễn. */
    _destroyNode(key, node) {
        revokeNodeCoverUrl(node); // core/playlist/render.js
        removePlaylistNode(node); // core/playlist/node-ui.js
        appState.mutate('domNodesByKey', m => m.delete(key));
    },

    /** Key chưa có node -> dựng mới + ghi vào domNodesByKey. */
    _buildAndRegisterNode(key) {
        const node = this.buildSongNode(key);
        appState.mutate('domNodesByKey', m => m.set(key, node));
        return node;
    },

    /** Dựng lại đúng 1 hàng (sau khi sửa tag / đổi trạng thái đang phát), giữ trạng thái ẩn tạm; node dựng lại tại chỗ
     * (thường đang trong khung nhìn) gắn bìa ngay, không chờ IntersectionObserver kẻo bìa chớp trắng. */
    refreshSongNode(key) {
        const oldNode = appState.get('domNodesByKey').get(key);
        if (!oldNode) return;
        const newNode = this.buildSongNode(key);
        this._attachNodeCover(newNode, key);
        revokeNodeCoverUrl(oldNode); // core/playlist/render.js
        replacePlaylistNode(oldNode, newNode); // core/playlist/node-ui.js
        appState.mutate('domNodesByKey', m => m.set(key, newNode));
    },

    /** Cuộn tới bài đang phát khi đổi bài lúc Playlist có thể đang hiện (Next/Prev/auto-next: player.js, video-player.js,
     * photo-player.js). Menu 3 chấm đang mở thì chỉ ghi cờ chờ; đóng menu xong `flushPendingScrollToCurrent()` cuộn tới
     * `currentKey` MỚI NHẤT (đổi bài nhiều lần lúc menu mở vẫn chỉ 1 lần cuộn). */
    scrollToCurrentOrDefer() {
        SCROLL_TO_CURRENT_BY_MENU_OPEN[playlistStore.get('songActionMenuKey') != null]();
    },

    _deferScrollToCurrent() {
        playlistStore.set({ scrollToCurrentPending: true });
        console.log(`writer: "workflowPlaylistRender._deferScrollToCurrent", page: "playlistStore.scrollToCurrentPending", content: "true (menu 3 chấm đang mở — hoãn cuộn)"`);
    },

    /** Chạy lượt cuộn đang hoãn (nếu có) — gọi sau khi menu 3 chấm đóng (`workflowPlaylist.closeActionMenu()`). */
    flushPendingScrollToCurrent() {
        if (!playlistStore.get('scrollToCurrentPending')) return;
        playlistStore.set({ scrollToCurrentPending: false });
        console.log(`writer: "workflowPlaylistRender.flushPendingScrollToCurrent", page: "playlistStore.scrollToCurrentPending", content: "false (menu đã đóng — cuộn bù)"`);
        this.scrollToCurrentWhenShown();
    },

    /** Đo chiều cao nội dung của item đầu `renderOrder` rồi ghi làm chiều cao ước lượng cho mọi item đang bị
     * `content-visibility: auto` bỏ qua render (item List cao đều, tile Grid cao đều theo bề rộng cột -> 1 phép đo đúng cho
     * cả danh sách, vị trí cuộn không lệch khi item vào/ra khung nhìn). Gọi sau render và khi khung cuộn đổi bề rộng. */
    syncItemBlockSize() {
        const { renderOrder, domNodesByKey } = appState.get(['renderOrder', 'domNodesByKey']);
        const firstKey = renderOrder[0];
        const node = firstKey ? domNodesByKey.get(firstKey) : null; // chọn GIÁ TRỊ
        const px = measurePlaylistItemBlockSize(node); // core/playlist/render.js
        if (!(px > 0)) return; // guard — chưa có item / đang display:none, giữ giá trị cũ (CSS có fallback)
        if (px === playlistStore.get('itemBlockSizePx')) return; // guard — ghi lại cùng giá trị vẫn làm trình duyệt layout lại cả danh sách
        applyPlaylistItemBlockSize(playlistContainer, px); // core/playlist/render.js
        playlistStore.set({ itemBlockSizePx: px });
        console.log(`writer: "workflowPlaylistRender.syncItemBlockSize", page: "playlistStore.itemBlockSizePx", content: "${px}"`);
    },

    _syncItemBlockSizeIfUnmeasured() {
        if (playlistStore.get('itemBlockSizePx') > 0) return; // guard — đã đo
        this.syncItemBlockSize();
    },

    /** Quên số đo cũ (dựng lại toàn bộ: Grid/List có thể vừa đổi). */
    _invalidateItemBlockSize() {
        playlistStore.set({ itemBlockSizePx: 0 });
        console.log(`writer: "workflowPlaylistRender._invalidateItemBlockSize", page: "playlistStore.itemBlockSizePx", content: "0 (dựng lại toàn bộ — đo lại)"`);
    },

    /** 'playlist.viewport.resize': chỉ đo lại khi BỀ RỘNG khung cuộn đổi (xoay máy — tile Grid cao theo bề rộng cột); đổi
     * chiều cao (bàn phím, thanh địa chỉ) không làm item đổi cao. @param {number} width */
    onViewportResize(width) {
        if (width === playlistStore.get('viewportWidth')) return; // guard
        playlistStore.set({ viewportWidth: width });
        console.log(`writer: "workflowPlaylistRender.onViewportResize", page: "playlistStore.viewportWidth", content: "${width}"`);
        this.syncItemBlockSize();
    },

    /** 'playlist.cover.nearViewport': gắn ảnh bìa thật cho các node vừa lại gần khung nhìn (IntersectionObserver,
     * event/listener/playlist.js). Tra node theo key ngay lúc này (node lúc phát hiện có thể đã bị dựng lại/đổi Nguồn).
     * @param {string[]} keys */
    attachCoverUrls(keys) {
        const domNodesByKey = appState.get('domNodesByKey');
        keys.forEach((key) => this._attachNodeCover(domNodesByKey.get(key), key));
    },

    /** Gắn bìa thật cho 1 node nếu bài có bìa (1 node chỉ tạo 1 URL). */
    _attachNodeCover(node, key) {
        if (!node || node._coverObjectUrl) return; // guard — node không còn / đã gắn bìa
        const cached = appState.get('playlistCache').get(key);
        if (!cached || !cached.cover) return; // guard — bài không có bìa thật (đĩa than mặc định)
        setNodeCoverUrl(node, createBlobUrl(cached.cover)); // service/blob-url.js + core/playlist/render.js
    },

    /** Sau khi danh sách render lại vì đổi từ khoá Search / đổi Nguồn / đổi folder Scope — xem PLAYLIST_SCROLL_BY_CURRENT_LISTED. */
    scrollToCurrentOrTop() {
        const { currentKey, activeMediaSource, renderOrder, isVideoPlayerMode, isPhotoPlayerMode } = appState.get([
            'currentKey', 'activeMediaSource', 'renderOrder', 'isVideoPlayerMode', 'isPhotoPlayerMode',
        ]);
        const playingMediaType = resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode); // core/playlist/render.js
        PLAYLIST_SCROLL_BY_CURRENT_LISTED[isPlayingMediaListed(currentKey, playingMediaType, activeMediaSource, renderOrder)](); // core/playlist/render.js
    },

    /** Nhãn "Phát / Đang phát" của nút Phát to: media đang phát nằm trong hàng đợi phát (displayOrder) VÀ cùng loại với
     * Nguồn đang xem (cùng công thức router playlistEmptyState dùng khi bấm nút). Gọi ở mọi mốc currentKey/displayOrder
     * có thể đổi (render + đổi bài ở player.js, video-player.js, photo-player.js). */
    syncPlayButtonPlayingState() {
        const { currentKey, activeMediaSource, displayOrder, isVideoPlayerMode, isPhotoPlayerMode } = appState.get([
            'currentKey', 'activeMediaSource', 'displayOrder', 'isVideoPlayerMode', 'isPhotoPlayerMode',
        ]);
        const playingMediaType = resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode); // core/playlist/render.js
        updatePlayButtonPlayingState(isPlayingMediaListed(currentKey, playingMediaType, activeMediaSource, displayOrder)); // core/playlist/render.js
    },

    /** Trạng thái rỗng: đếm sẵn rồi giao core vẽ; còn bài hiển thị thì tắt lớp "đang nạp". */
    syncEmptyState() {
        const { playlistOrder, confirmedBrokenKeys, renderOrder, activeMediaSource } = appState.get(['playlistOrder', 'confirmedBrokenKeys', 'renderOrder', 'activeMediaSource']);
        const totalCount = liveKeys(playlistOrder, confirmedBrokenKeys).length; // core/playlist/order.js
        applyPlaylistEmptyState(totalCount, renderOrder.length, activeMediaSource); // core/playlist/render.js
        this._hidePlaylistLoadingIfHasItems(renderOrder.length);
    },

    /** Bước tuỳ chọn của syncEmptyState() — đã có dữ liệu thật để dựng list thì lớp "đang nạp" không còn cần. */
    _hidePlaylistLoadingIfHasItems(renderCount) {
        if (renderCount === 0) return; // guard
        this.hidePlaylistLoading();
    },

    /** Hiện lớp "đang nạp danh sách" — huỷ lượt ẩn hẹn giờ còn treo kẻo nó ẩn mất lớp vừa hiện. */
    showPlaylistLoading(done, total) {
        taskManager.kill(PLAYLIST_LOADING_HIDE_TASK);
        showPlaylistLoading(done, total); // core/playlist/render.js
    },

    /** Mờ dần ngay, ẩn hẳn sau khi transition xong. Task tên cố định -> gọi lặp chỉ còn 1 lượt hẹn. */
    hidePlaylistLoading() {
        fadeOutPlaylistLoading(); // core/playlist/render.js
        taskManager.once(() => concealPlaylistLoading(), PLAYLIST_LOADING_FADE_MS, PLAYLIST_LOADING_HIDE_TASK); // core/playlist/render.js
    },

    /** Quay về từ subtitle-editor.html: cờ `sav_editingSubtitle` + key `sav_scrollToSongKey` (localStorage) -> cuộn tới đúng
     * bài ở khung hình kế (danh sách vừa dựng), rồi xoá cờ ngay (chỉ dùng 1 lần). */
    scrollToSongIfPending() {
        if (localStorage.getItem('sav_editingSubtitle') !== 'true') return; // guard — cờ false/chưa từng có
        const key = localStorage.getItem('sav_scrollToSongKey');
        localStorage.setItem('sav_editingSubtitle', 'false');
        localStorage.removeItem('sav_scrollToSongKey');
        if (!key) return; // guard
        taskManager.onceFrame(() => this._scrollToKeyInstant(key), 1, PLAYLIST_SCROLL_TO_SONG_FRAME_TASK);
    },

    /** Cuộn tức thì tới currentKey — gọi được cả lúc Playlist đang dịch ra ngoài khung nhìn (`returnToPlaylistUI()` gọi
     * trước khi trượt vào, `switchToVisualizer()`). */
    scrollToCurrentInstant() {
        const key = appState.get('currentKey');
        if (!key) return; // guard — chưa phát gì
        this._scrollToKeyInstant(key);
    },

    /** Cuộn tới bài đang phát khi Playlist đang hiện; đang ở Visualizer -> không cuộn (`scrollToCurrentInstant()` lo lúc
     * quay lại). */
    scrollToCurrentWhenShown() {
        if (appStack.classList.contains('playlist-hidden')) return; // guard — đang ở Visualizer
        this.scrollToCurrentInstant();
    },

    /** Gán thẳng scrollTop đặt node của `key` vào giữa khung cuộn Playlist (không animation, không `scrollIntoView()` —
     * nó cuộn cả chuỗi khung cuộn tổ tiên). Node không còn gắn DOM hoặc đang ẩn vì Search (không có hộp để đo) -> bỏ qua. */
    _scrollToKeyInstant(key) {
        const node = appState.get('domNodesByKey').get(key);
        if (!node || !node.isConnected) return; // guard
        if (node.classList.contains('hidden')) return; // guard — đang ẩn vì Search
        const scroll = computePlaylistCenterScroll(playlistContainer, node); // core/playlist/render.js
        if (scroll.isSettled) return; // guard — đã đúng vị trí
        setPlaylistScrollTop(playlistContainer, scroll.top); // core/playlist/render.js
    },
};
