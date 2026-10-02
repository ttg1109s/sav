/**
 * event/workflow/playlist-render.js — Lớp "dựng/đồng bộ DOM danh sách Playlist", MỚI — dời NGUYÊN
 * VẸN 4 hàm TỪ core/playlist/render.js (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ", CÙNG đợt
 * dời order.js -> event/workflow/playlist-order.js):
 *   - `buildSongNode()` — trả về 1 DOM node HOÀN CHỈNH cho 1 bài (đúng phép thử Rule 3c "giá trị
 *     trả về có Ý NGHĨA NGHIỆP VỤ RIÊNG" -> BẮT BUỘC là hàm top-level, KHÔNG được nhét thành
 *     closure lồng trong `renderPlaylistFull()`/`renderPlaylistDiff()`).
 *   - `renderPlaylistFull()`/`renderPlaylistDiff()`/`refreshSongNode()` — đều tự `appState.get()`
 *     (vi phạm Rule 2 nếu còn ở core) VÀ gọi `buildSongNode()` (hàm top-level riêng, vi phạm Rule
 *     3a — không đủ điều kiện Rule 3c) — `renderPlaylistDiff()` còn tự gọi `renderPlaylistFull()`
 *     (cũng vi phạm y hệt).
 * SỬA TẬN GỐC theo Rule 3b ("Core là tầng THI HÀNH, Workflow là tầng CHUẨN BỊ") — gộp cả 4 vào 1
 * object `workflowPlaylistRender`, gọi lẫn nhau qua `this.xxx()` (Workflow gọi Workflow CÙNG object
 * — không phải Core gọi Core, hợp lệ, CÙNG khuôn `workflowPlaylistOrder` đã làm). `core/playlist/
 * render.js` giờ CHỈ còn hàm THUẦN/tiện ích nhỏ (songActionMenuButtonHtml/attachCoverFallback/
 * revokeNodeCoverUrl/showPlaylistLoading/updatePlaylistLoading/
 * hidePlaylistLoading/resetPlaylistScrollTop — thuần hẳn) + nhóm tự đọc `appState` nhưng KHÔNG gọi
 * chéo hàm nào trong cụm này (`updateEmptyState`/`scrollToSongIfPending`/`scrollToCurrentKeyInstant`/
 * `scrollToCurrentKeyAnimated` — nợ kỹ thuật RIÊNG, chưa relocate đợt này, xem
 * docstring từng hàm đó).
 *
 * FIX (Giang chỉ ra — "search rồi tắt từ khoá lại rebuild DOM thay vì chỉ ẩn/hiện tạm") —
 * `renderPlaylistDiff()` TRƯỚC ĐÂY coi MỌI key rớt khỏi `renderOrder` là "bỏ vĩnh viễn" (destroy
 * node + revoke cover + xoá khỏi `domNodesByKey`), KHÔNG phân biệt 2 tình huống khác hẳn nhau:
 *   1. Key vẫn còn trong `playlistOrder` (chỉ đang bị Search/Filter ẩn bớt KHỎI VIEW — dữ liệu gốc
 *      KHÔNG đổi) -> giờ CHỈ thêm class `hidden` (display:none), GIỮ NGUYÊN node + cover đã tải
 *      trong `domNodesByKey` — gõ xoá từ khoá xong chỉ gỡ class đó ra, KHÔNG buildSongNode() lại,
 *      KHÔNG tải lại ảnh.
 *   2. Key KHÔNG còn trong `playlistOrder` (xoá bài THẬT) -> GIỮ NGUYÊN hành vi cũ — destroy hẳn
 *      (node không còn ý nghĩa, giữ lại là leak object URL cover trỏ vào blob không tồn tại nữa).
 * Với quy mô danh sách app này nhắm tới (~100-500 item, xem docstring components/items.js), giữ
 * TOÀN BỘ node ẩn trong DOM gần như không tốn gì (trình duyệt bỏ paint phần tử display:none) — rẻ
 * hơn nhiều so với build lại + tải lại ảnh mỗi lần gõ rồi xoá tìm kiếm.
 *
 * NẠP SAU: core/playlist/render.js (revokeNodeCoverUrl/songActionMenuButtonHtml/
 * attachCoverFallback/updateEmptyState), core/playlist/state.js
 * (formatTime), core/dom-refs.js (playlistContainer/btnPlaylistEmptyPlay/DEFAULT_VINYL/bgVideoElement/
 * audioPlayer). NẠP TRƯỚC: mọi file gọi `workflowPlaylistRender.*` — event/workflow/playlist.js,
 * video-player.js, photo-player.js, player.js, playlist-scope.js, playlist-empty-state.js,
 * playlist-order.js, file-manager-storage.js (đều nạp sau trong cùng nhóm EVENT), core/playlist/
 * actions.js, loader.js, core/storage-manager.js, core/player-controls.js (Core gọi Workflow — nợ
 * kỹ thuật RIÊNG của các file đó, CÙNG loại đã ghi nhận ở applySearchQuery()/removeKeyFromDisplay(),
 * chưa relocate cả hàm trong đợt này).
 */
/** MỚI (02/10/2026, rà event-bus-flow.md mục 7) — các rẽ nhánh trong buildSongNode()/renderPlaylistDiff() viết bằng
 * object map (trước đây if/else). Khoá boolean thật. */
const SONG_NODE_LAYOUT_BY_GRID = {
    true: (wrapper, view) => fillGridSongNode(wrapper, view), // core/playlist/render.js
    false: (wrapper, view) => fillListSongNode(wrapper, view), // core/playlist/render.js
};
// DOM khớp domNodesByKey -> diff tại chỗ; lệch (vd switchSource() vừa dọn domNodesByKey) -> dựng lại toàn bộ (lưới an toàn cũ).
const PLAYLIST_RENDER_BY_DOM_IN_SYNC = {
    true: () => workflowPlaylistRender._renderPlaylistDiffInPlace(),
    false: () => workflowPlaylistRender.renderPlaylistFull(),
};
// Node không còn trong renderOrder: bài vẫn còn thật (bị Search/Filter lọc tạm) -> CHỈ ẨN; đã xoá thật -> bỏ hẳn.
const STALE_NODE_BY_KEPT = {
    true: (key, node) => node.classList.add('hidden'),
    false: (key, node) => workflowPlaylistRender._destroyNode(key, node),
};
// Key có trong renderOrder: đã có node -> hiện lại (bỏ ẩn tạm); chưa có -> dựng mới.
const RENDER_NODE_BY_EXISTS = {
    true: (key, node) => workflowPlaylistRender._revealNode(node),
    false: (key) => workflowPlaylistRender._buildAndRegisterNode(key),
};

/** MỚI (02/10/2026, Giang chốt quy tắc A) — cuộn sau khi DANH SÁCH đổi nội dung (đổi từ khoá Search / đổi Nguồn):
 * media đang phát CÓ trong danh sách -> tới thẳng nó (tức thì, không animation — gõ từng ký tự mà trượt sẽ giật); KHÔNG
 * có -> về đầu danh sách. Object map theo event-bus-flow.md mục 7 (khoá boolean thật từ `isPlayingMediaListed()`). */
// MỚI (02/10/2026, rà mục 7) — scrollToCurrentOrDefer(): menu 3 chấm đang mở -> hoãn; không -> cuộn có animation.
const SCROLL_TO_CURRENT_BY_MENU_OPEN = {
    true: () => workflowPlaylistRender._deferScrollToCurrent(),
    false: () => workflowPlaylistRender.scrollToCurrentAnimated(),
};
const PLAYLIST_LOADING_HIDE_TASK = 'playlistLoadingHide'; // MỚI (02/10/2026) — xem hidePlaylistLoading()

const PLAYLIST_SCROLL_BY_CURRENT_LISTED = {
    true: () => workflowPlaylistRender.scrollToCurrentInstant(), // SỬA (02/10/2026) — bản đúng rule, xem method đó
    false: () => resetPlaylistScrollTop(), // core/playlist/render.js
};

const workflowPlaylistRender = {
    /** Dựng 1 DOM node HOÀN CHỈNH cho 1 bài (Song/Video/Photo dùng CHUNG, chỉ khác nội dung
     * `cached`) — 2 layout (grid/list) loại trừ nhau theo `isGridView`. Dời NGUYÊN VẸN từ
     * core/playlist/render.js::buildSongNode() (đã xoá khỏi đó) — KHÔNG đổi 1 dòng logic. */
    buildSongNode(key) {
        const cached = appState.get('playlistCache').get(key);
        const title = cached ? cached.tag.title : key;
        const artist = cached ? cached.tag.artist : '';
        const durationLabel = formatTime(cached ? cached.duration : 0);
        const secondLineHtml = artist
            ? `${artist} <span class="opacity-50">·</span> ${durationLabel}`
            : durationLabel;
        const hasRealCover = !!(cached && cached.cover);
        // SỬA (02/10/2026, tối ưu 10000 item) — KHÔNG tạo object URL cho bìa thật lúc dựng nữa (đo: chiếm ~70% thời gian
        // dựng 10000 node). Node bìa thật dựng ở trạng thái "chờ bìa": <img> chưa có src + `data-cover-pending="true"`;
        // URL gắn sau qua workflowPlaylistRender._attachNodeCover() khi node lại gần khung nhìn. Bìa mặc định (đĩa than)
        // là URL tĩnh, gắn luôn như cũ.
        const coverSrcAttr = hasRealCover ? '' : `src="${DEFAULT_VINYL}"`; // chọn GIÁ TRỊ

        // FIX (02/10/2026, Giang) — trước đây chỉ so key: đang phát video mà sang Nguồn Photo, ảnh nào trùng slug tên file với
        // video đó bị tô "đang phát". Giờ phải khớp thêm LOẠI media đang phát với Nguồn đang xem (playlistCache luôn là cache
        // của `activeMediaSource`, nên đó chính là loại của node đang dựng).
        const isPlaying = key === appState.get('currentKey') && this._playingMediaType() === appState.get('activeMediaSource');
        const isActuallyPlaying = isPlaying && !((cached && cached.mediaType === 'video') ? bgVideoElement.paused : audioPlayer.paused);
        const eqIconHtml = isActuallyPlaying ? `<div class="flex items-end gap-[2px] h-3 w-3"><div class="w-[3px] eq-1" data-uitk="eqBarBg"></div><div class="w-[3px] eq-2" data-uitk="eqBarBg"></div><div class="w-[3px] eq-3" data-uitk="eqBarBg"></div></div>` : (isPlaying ? `<div class="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.8)]" data-uitk="btnPrimaryPillBg"></div>` : '');
        // SỬA (24/09/2026, rà soát refresh DOM) — node dựng ra LUÔN ở dạng "thường" (có nút 3 chấm, không vòng
        // tròn chọn, nền thường). Lớp "Chọn nhiều" áp SAU qua `_applySelectionLayer()` bằng ĐÚNG cơ chế
        // show/hideSelectionIndicator() mà bật/tắt/toggle chọn dùng — trước đây hàm này tự vẽ vòng tròn INLINE
        // (không `data-role`) + bỏ nút 3 chấm, lệch với cơ chế kia: hàng bị dựng lại lúc đang chọn (play/pause,
        // Next/Prev, ảnh/video tự chuyển, đổi grid/list) bị 2 vòng tròn khi bấm chọn, kẹt nền đã-chọn khi bỏ
        // chọn, thoát chọn thì còn vòng tròn + mất nút 3 chấm.
        const isGridViewNow = appState.get('isGridView'); // đọc 1 lần, dùng lại cho cả menuBtnHtml lẫn nhánh render bên dưới
        const menuBtnHtml = songActionMenuButtonHtml(key, isGridViewNow); // core/playlist/render.js — tham số 2 MỚI (09/09/2026), xem docstring hàm đó

        const wrapper = document.createElement('div');
        wrapper.dataset.key = key;
        wrapper._coverObjectUrl = null; // gắn sau bởi _attachNodeCover()
        wrapper.dataset.coverPending = String(hasRealCover); // event/listener/playlist.js chỉ theo dõi node 'true'

        // SỬA (02/10/2026, rà event-bus-flow.md mục 7) — if/else Grid/List -> object map; 2 bố cục dời nguyên văn sang
        // core/playlist/render.js (fillGridSongNode()/fillListSongNode()).
        SONG_NODE_LAYOUT_BY_GRID[!!isGridViewNow](wrapper, { coverSrcAttr, isPlaying, eqIconHtml, menuBtnHtml, title, secondLineHtml });
        // MỚI (02/10/2026, Giang chốt phương án A) — `loading="lazy"` + `decoding="async"` ở 2 thẻ <img> trên: item đang bị
        // trình duyệt bỏ qua render (`content-visibility: auto`, assets/css/layout-nav.css) hoặc đang ẩn vì Search
        // (`display:none`) KHÔNG tải ảnh bìa cho tới khi lại gần khung nhìn; decode ảnh không chặn main thread.
        attachCoverFallback(wrapper.querySelector('img')); // core/playlist/render.js
        applyUiThemeToDom(wrapper, _activeUiThemeKeyList); // SỬA (02/10/2026) — bỏ `typeof ... === 'function'`: apply-ui.js luôn nạp trước file này (index.html), điều kiện đó không bao giờ sai. // core/ui-theme/apply-ui.js — MỚI (09/09/2026, hệ UI Theme mở rộng "đổi hết trừ Visualizer") — node dựng ĐỘNG (createElement+innerHTML), KHÔNG tự động qua applyUiThemeToDom(document,...) lúc boot như nội dung tĩnh — phải tự áp NGAY ở đây mỗi khi dựng 1 node mới
        this._applySelectionLayer(wrapper, key); // MỚI (24/09/2026) — xem docstring hàm đó
        return wrapper;
    },

    /** MỚI (24/09/2026, rà soát refresh DOM) — áp lớp "Chọn nhiều" lên 1 node VỪA dựng nếu đang ở chế độ chọn,
     * bằng ĐÚNG `showSelectionIndicator()` (core/playlist/selection.js) mà `workflowPlaylist.toggleSelectionMode()`/
     * `toggleSongSelectionAndRefresh()` dùng — nên `hideSelectionIndicator()` lúc thoát chọn gỡ sạch được, bấm
     * chọn/bỏ chọn cập nhật đúng 1 vòng tròn. Mọi đường dựng node (renderPlaylistFull/renderPlaylistDiff/
     * refreshSongNode) đều qua `buildSongNode()` nên chỉ cần gọi ở cuối hàm đó.
     * @param {HTMLElement} node @param {string} key */
    _applySelectionLayer(node, key) {
        // SỬA (02/10/2026, tối ưu 10000 item) — vòng tròn TRỐNG (chưa chọn) + ẩn nút 3 chấm giờ do CSS vẽ theo class
        // `is-selecting` của #playlist-container (applySelectionChrome(), core/playlist/selection.js; assets/css/
        // layout-nav.css) — node chưa chọn KHÔNG cần patch gì. Chỉ node ĐÃ CHỌN mới cần tint + vòng có dấu tick.
        const isSelectedNode = appState.get('selectionMode') && appState.get('selectedMediaKeys').has(key);
        if (!isSelectedNode) return; // guard
        showSelectionIndicator(node, key, appState.get('selectedMediaKeys'), workflowPlaylist._selectionThemeClasses()); // core/playlist/selection.js + event/workflow/playlist.js
    },

    /** Dựng lại TOÀN BỘ DOM (đổi layout grid/list, hoặc lệch số lượng node). Dời NGUYÊN VẸN từ
     * core/playlist/render.js::renderPlaylistFull() (đã xoá khỏi đó). */
    renderPlaylistFull() {
        const _t0 = performance.now();
        appState.get('domNodesByKey').forEach(revokeNodeCoverUrl); // core/playlist/render.js
        playlistContainer.innerHTML = '';
        appState.mutate('domNodesByKey', m => m.clear());
        appState.get('renderOrder').forEach((key) => {
            const node = this.buildSongNode(key);
            appState.mutate('domNodesByKey', m => m.set(key, node));
            playlistContainer.appendChild(node);
        });
        this._invalidateItemBlockSize(); // SỬA (02/10/2026) — dựng lại toàn bộ (có thể vừa đổi Grid/List) -> đo lại từ đầu
        this.syncItemBlockSize(); // MỚI (02/10/2026) — chiều cao ước lượng cho item ngoài khung nhìn, xem docstring hàm đó
        this.syncPlayButtonPlayingState(); // SỬA (02/10/2026) — khớp cả loại media, xem method đó
        this.syncEmptyState(); // SỬA (02/10/2026) — thay core updateEmptyState() (Rule 2/3a)
        console.log(`writer: "workflowPlaylistRender.renderPlaylistFull", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms cho ${appState.get('renderOrder').length} item (dựng lại TOÀN BỘ DOM)"`);
    },

    /** Đồng bộ DOM theo `renderOrder` MỚI, tái dùng tối đa node cũ.
     * FIX (Giang chỉ ra "search rồi tắt từ khoá lại rebuild thay vì chỉ ẩn/hiện") — xem docstring
     * đầu file: phân biệt key "lọc tạm" (còn trong `playlistOrder` — CHỈ ẩn) vs key "xoá thật"
     * (không còn — destroy hẳn như cũ). Dời từ core/playlist/render.js::renderPlaylistDiff(). */
    renderPlaylistDiff() {
        // SỬA (02/10/2026, rà event-bus-flow.md mục 7) — thân cũ (if lệch -> Full; 2 vòng lặp if/else) tách ra object map +
        // method riêng; hành vi GIỮ NGUYÊN.
        const isDomInSync = playlistContainer.children.length === appState.get('domNodesByKey').size;
        PLAYLIST_RENDER_BY_DOM_IN_SYNC[isDomInSync]();
    },

    /** Diff tại chỗ (DOM đang khớp domNodesByKey) — tách từ renderPlaylistDiff() 02/10/2026, logic giữ nguyên. */
    _renderPlaylistDiffInPlace() {
        const _t0 = performance.now();
        const renderOrder = appState.get('renderOrder');
        const renderKeySet = new Set(renderOrder);
        const playlistOrderSet = new Set(appState.get('playlistOrder')); // phân biệt "lọc tạm" vs "xoá thật"
        const nodeCountBefore = appState.get('domNodesByKey').size;

        let _hiddenCount = 0; // chẩn đoán — số node đang ẩn tạm sau lượt này
        for (const [key, node] of Array.from(appState.get('domNodesByKey').entries())) {
            if (renderKeySet.has(key)) continue; // guard — còn hiển thị, xử lý ở vòng dưới
            const isKept = playlistOrderSet.has(key);
            STALE_NODE_BY_KEPT[isKept](key, node);
            _hiddenCount += Number(isKept);
        }
        const nodeCountAfterPrune = appState.get('domNodesByKey').size;
        const _destroyedCount = nodeCountBefore - nodeCountAfterPrune;

        let prevNode = null;
        for (const key of renderOrder) {
            const node = RENDER_NODE_BY_EXISTS[appState.get('domNodesByKey').has(key)](key, appState.get('domNodesByKey').get(key));
            this._placeNodeAfter(node, prevNode);
            prevNode = node;
        }
        const _builtCount = appState.get('domNodesByKey').size - nodeCountAfterPrune;

        // SỬA (02/10/2026, tối ưu 10000 item) — chỉ đo khi chưa đo được lần nào (Full chạy lúc danh sách rỗng), xem docstring.
        this._syncItemBlockSizeIfUnmeasured();
        this.syncPlayButtonPlayingState();
        this.syncEmptyState();
        console.log(`writer: "workflowPlaylistRender._renderPlaylistDiffInPlace", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms — dựng mới ${_builtCount}/${appState.get('renderOrder').length} node, đang ẩn tạm ${_hiddenCount}, xoá hẳn ${_destroyedCount}"`);
    },

    /** Bài đã xoá THẬT (không còn trong playlistOrder) -> bỏ node vĩnh viễn. Tách từ renderPlaylistDiff() 02/10/2026. */
    _destroyNode(key, node) {
        revokeNodeCoverUrl(node); // core/playlist/render.js
        node.remove();
        appState.mutate('domNodesByKey', m => m.delete(key));
    },

    /** Node đã có, khớp lại renderOrder -> hiện lại NGAY (bỏ ẩn tạm), không dựng lại. */
    _revealNode(node) {
        node.classList.remove('hidden');
        return node;
    },

    /** Key chưa có node -> dựng mới + ghi vào domNodesByKey. */
    _buildAndRegisterNode(key) {
        const node = this.buildSongNode(key);
        appState.mutate('domNodesByKey', m => m.set(key, node));
        return node;
    },

    /** Đặt `node` ngay sau `prevNode` (đầu danh sách nếu `prevNode` null) — đã đúng chỗ thì thôi (insertBefore một node
     * đã ở đúng chỗ vẫn gỡ ra gắn lại: tốn layout + bắn MutationObserver vô ích). */
    _placeNodeAfter(node, prevNode) {
        const expectedNextSibling = prevNode ? prevNode.nextSibling : playlistContainer.firstChild; // chọn GIÁ TRỊ
        if (expectedNextSibling === node) return; // guard — đã đúng chỗ
        playlistContainer.insertBefore(node, expectedNextSibling);
    },

    /** Patch riêng đúng 1 hàng (sau khi sửa tag / đổi trạng thái đang phát) — thay hẳn node cũ bằng
     * node mới dựng lại, KHÔNG đụng các hàng khác. Dời từ core/playlist/render.js::
     * refreshSongNode() (đã xoá khỏi đó) — THÊM: giữ đúng trạng thái ẩn tạm (class `hidden`, xem
     * renderPlaylistDiff() ở trên) nếu node cũ đang ẩn, tránh nháy hiện ra 1 khung hình rồi ẩn lại
     * ngay (VD: sửa tag 1 bài đang bị Search ẩn qua modal "Chi tiết" mở từ nơi khác). */
    refreshSongNode(key) {
        const oldNode = appState.get('domNodesByKey').get(key);
        if (!oldNode) return;
        const newNode = this.buildSongNode(key);
        this._attachNodeCover(newNode, key); // MỚI (02/10/2026) — node dựng lại TẠI CHỖ (thường đang trong khung nhìn): gắn bìa ngay, không chờ IntersectionObserver kẻo bìa chớp trắng
        newNode.classList.toggle('hidden', oldNode.classList.contains('hidden')); // SỬA (02/10/2026, mục 7) — chép trạng thái ẩn tạm, không còn if
        revokeNodeCoverUrl(oldNode); // core/playlist/render.js
        oldNode.replaceWith(newNode);
        appState.mutate('domNodesByKey', m => m.set(key, newNode));
    },

    /** MỚI (21/09/2026, Giang yêu cầu) — THAY cho gọi thẳng `scrollToCurrentKeyAnimated()` (core/playlist/
     * render.js) ở mọi nơi đổi bài lúc Playlist đang hiện (Next/Prev/auto-next: player.js, video-player.js,
     * photo-player.js). Menu 3 chấm của 1 item đang MỞ (`songActionMenuKey` khác null — menu neo `fixed` theo
     * toạ độ nút lúc mở) mà cuộn danh sách thì hàng bị kéo trượt đi còn menu đứng yên -> menu lìa khỏi item của
     * nó. Nên lúc đó BỎ QUA cuộn, chỉ ghi cờ chờ `scrollToCurrentPending`; đóng menu xong thì
     * `flushPendingScrollToCurrent()` (gọi từ `workflowPlaylist.closeActionMenu()`) mới cuộn — tới `currentKey`
     * MỚI NHẤT lúc đó (đổi bài nhiều lần trong lúc menu mở vẫn chỉ 1 lần cuộn, không nhảy qua từng bài). */
    scrollToCurrentOrDefer() {
        // SỬA (02/10/2026, rà mục 7) — if (menu mở) {hoãn; return} + cuộn -> object map 2 tiến trình.
        SCROLL_TO_CURRENT_BY_MENU_OPEN[playlistStore.get('songActionMenuKey') != null]();
    },

    /** Menu 3 chấm đang mở — chỉ ghi cờ chờ, flushPendingScrollToCurrent() cuộn bù sau khi menu đóng. */
    _deferScrollToCurrent() {
        playlistStore.set({ scrollToCurrentPending: true });
        console.log(`writer: "workflowPlaylistRender._deferScrollToCurrent", page: "playlistStore.scrollToCurrentPending", content: "true (menu 3 chấm đang mở — hoãn cuộn)"`);
    },

    /** MỚI (21/09/2026) — chạy lượt cuộn đang hoãn bởi `scrollToCurrentOrDefer()` (nếu có). Không có cờ chờ ->
     * no-op. Gọi SAU khi menu 3 chấm đã đóng (`workflowPlaylist.closeActionMenu()`). Nếu Playlist đã bị ẩn (đang
     * ở Visualizer) thì `scrollToCurrentAnimated()` tự bỏ qua, còn `scrollToCurrentInstant()` lo lúc quay lại. */
    flushPendingScrollToCurrent() {
        if (!playlistStore.get('scrollToCurrentPending')) return;
        playlistStore.set({ scrollToCurrentPending: false });
        console.log(`writer: "workflowPlaylistRender.flushPendingScrollToCurrent", page: "playlistStore.scrollToCurrentPending", content: "false (menu đã đóng — cuộn bù)"`);
        this.scrollToCurrentAnimated(); // SỬA (02/10/2026) — dời từ core scrollToCurrentKeyAnimated() (Rule 2)
    },

    /** MỚI (02/10/2026, Giang chốt phương án A — `content-visibility: auto` cho item Playlist) — đo chiều cao nội dung
     * của 1 item ĐANG HIỂN THỊ (phần tử đầu `renderOrder`) rồi ghi làm chiều cao ước lượng cho MỌI item đang bị trình
     * duyệt bỏ qua render. Item List cao đều nhau, tile Grid cao đều theo bề rộng cột -> 1 phép đo đúng cho cả danh
     * sách; ước lượng KHỚP chiều cao thật nên vị trí cuộn/scroll-to-current không lệch khi item vào/ra khung nhìn.
     * Gọi cuối renderPlaylistFull()/renderPlaylistDiff() (đổi Grid/List, lượt render đầu có item) + khi khung cuộn đổi
     * kích thước ('playlist.viewport.resize' — xoay máy làm đổi bề rộng cột Grid). */
    syncItemBlockSize() {
        const firstKey = appState.get('renderOrder')[0];
        const node = firstKey ? appState.get('domNodesByKey').get(firstKey) : null; // chọn GIÁ TRỊ, không rẽ tiến trình
        const px = measurePlaylistItemBlockSize(node); // core/playlist/render.js
        if (!(px > 0)) return; // guard — chưa có item / đang display:none, giữ giá trị cũ (CSS có fallback)
        if (px === playlistStore.get('itemBlockSizePx')) return; // guard — SỬA (02/10/2026): ghi lại cùng giá trị vẫn làm trình duyệt layout lại toàn danh sách
        applyPlaylistItemBlockSize(playlistContainer, px); // core/playlist/render.js
        playlistStore.set({ itemBlockSizePx: px });
        console.log(`writer: "workflowPlaylistRender.syncItemBlockSize", page: "playlistStore.itemBlockSizePx", content: "${px}"`);
    },

    /** MỚI (02/10/2026) — đo chỉ khi chưa đo được lần nào kể từ lần dựng lại toàn bộ gần nhất (xem renderPlaylistDiff()). */
    _syncItemBlockSizeIfUnmeasured() {
        if (playlistStore.get('itemBlockSizePx') > 0) return; // guard — đã đo
        this.syncItemBlockSize();
    },

    /** MỚI (02/10/2026) — quên số đo cũ (renderPlaylistFull(): Grid/List có thể vừa đổi, số cũ không còn đúng). */
    _invalidateItemBlockSize() {
        playlistStore.set({ itemBlockSizePx: 0 });
        console.log(`writer: "workflowPlaylistRender._invalidateItemBlockSize", page: "playlistStore.itemBlockSizePx", content: "0 (dựng lại toàn bộ — đo lại)"`);
    },

    /** MỚI (02/10/2026) — 'playlist.viewport.resize': CHỈ đo lại khi BỀ RỘNG khung cuộn đổi (xoay máy — tile Grid cao theo
     * bề rộng cột). Đổi chiều cao (bàn phím, thanh địa chỉ) không làm item đổi cao -> bỏ qua, khỏi tốn 2 lượt layout.
     * @param {number} width - bề rộng khung cuộn (ResizeObserver gửi kèm). */
    onViewportResize(width) {
        if (width === playlistStore.get('viewportWidth')) return; // guard
        playlistStore.set({ viewportWidth: width });
        console.log(`writer: "workflowPlaylistRender.onViewportResize", page: "playlistStore.viewportWidth", content: "${width}"`);
        this.syncItemBlockSize();
    },

    /** MỚI (02/10/2026, tối ưu 10000 item) — 'playlist.cover.nearViewport': gắn ảnh bìa thật cho các node vừa lại gần
     * khung nhìn (IntersectionObserver, event/listener/playlist.js). Tra node theo key NGAY LÚC NÀY (node lúc phát hiện
     * có thể đã bị dựng lại/đổi Nguồn — tra lại thì luôn đúng node đang sống).
     * @param {string[]} keys */
    attachCoverUrls(keys) {
        const domNodesByKey = appState.get('domNodesByKey');
        keys.forEach((key) => this._attachNodeCover(domNodesByKey.get(key), key));
    },

    /** MỚI (02/10/2026) — gắn bìa thật cho 1 node nếu bài có bìa (dùng chung attachCoverUrls()/refreshSongNode()). */
    _attachNodeCover(node, key) {
        if (!node || node._coverObjectUrl) return; // guard — node không còn / đã gắn bìa (1 node chỉ tạo 1 URL)
        const cached = appState.get('playlistCache').get(key);
        if (!cached || !cached.cover) return; // guard — bài không có bìa thật (đang dùng đĩa than mặc định)
        setNodeCoverUrl(node, createBlobUrl(cached.cover)); // service/blob-url.js (Workflow TẠO URL — Rule 3b) + core/playlist/render.js
    },

    /** MỚI (02/10/2026, Giang chốt quy tắc A + yêu cầu "current video -> đổi Nguồn Photo -> về lại Video -> phải về
     * current") — gọi SAU khi danh sách đã render lại (đổi từ khoá Search: workflowPlaylistOrder.applySearchQuery();
     * đổi Nguồn: workflowPlaylist.switchSource(), THAY `resetPlaylistScrollTop()` luôn-về-0 trước đây; đổi folder Scope:
     * tap folder — workflowFileManagerFolderBrowser.applyFolderFromTile(), nút X badge — workflowPlaylist.
     * exitActiveFolderScope(), SỬA 02/10/2026). */
    scrollToCurrentOrTop() {
        const isCurrentListed = isPlayingMediaListed( // core/playlist/render.js
            appState.get('currentKey'),
            this._playingMediaType(),
            appState.get('activeMediaSource'),
            appState.get('renderOrder'),
        );
        PLAYLIST_SCROLL_BY_CURRENT_LISTED[isCurrentListed]();
    },

    /** MỚI (02/10/2026) — loại media đang phát ('song'|'video'|'photo'), dùng chung cho buildSongNode() (tô "đang phát")
     * và scrollToCurrentOrTop() (quy tắc A) — 1 chỗ đọc 2 cờ player mode. */
    _playingMediaType() {
        return resolvePlayingMediaType(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode')); // core/playlist/render.js
    },

    // ===================== Dời từ core/playlist/render.js (02/10/2026, rà file đã đụng — Rule 1/2/3) =====================

    /** Nhãn "Phát / Đang phát" của nút Phát to — SỬA (02/10/2026, Giang báo bug key trùng giữa các Nguồn): "đang phát"
     * khi media đang phát nằm trong hàng đợi phát (displayOrder) VÀ cùng loại với Nguồn đang xem (isPlayingMediaListed(),
     * cùng công thức router playlistEmptyState dùng khi bấm nút). Gọi ở MỌI mốc currentKey/displayOrder có thể đổi
     * (render Full/Diff ngay trên + đổi bài ở event/workflow/player.js, video-player.js, photo-player.js). */
    syncPlayButtonPlayingState() {
        const isPlaying = isPlayingMediaListed( // core/playlist/render.js
            appState.get('currentKey'),
            this._playingMediaType(),
            appState.get('activeMediaSource'),
            appState.get('displayOrder'),
        );
        updatePlayButtonPlayingState(isPlaying); // core/playlist/render.js
    },

    /** Thay core `updateEmptyState()` — đếm sẵn rồi giao core vẽ; còn bài hiển thị thì tắt lớp "đang nạp". */
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

    /** Hiện lớp "đang nạp danh sách" — huỷ lượt ẩn hẹn giờ còn treo (nếu vừa gọi hidePlaylistLoading()) kẻo nó ẩn mất lớp vừa hiện. */
    showPlaylistLoading(done, total) {
        taskManager.kill(PLAYLIST_LOADING_HIDE_TASK);
        showPlaylistLoading(done, total); // core/playlist/render.js
    },

    /** Thay core `hidePlaylistLoading()` (taskManager trong core — Rule 3): mờ dần ngay, ẩn hẳn sau 320ms (khớp
     * transition-opacity duration-300). Task tên cố định -> gọi lặp chỉ còn 1 lượt hẹn. */
    hidePlaylistLoading() {
        fadeOutPlaylistLoading(); // core/playlist/render.js
        taskManager.once(() => concealPlaylistLoading(), 320, PLAYLIST_LOADING_HIDE_TASK); // core/playlist/render.js
    },

    /** Dời từ core `scrollToSongIfPending()` — quay về từ subtitle-editor.html: cờ `sav_editingSubtitle` + key
     * `sav_scrollToSongKey` (localStorage) -> cuộn MƯỢT tới đúng bài, rồi xoá cờ NGAY (chỉ dùng 1 lần). Thân giữ nguyên. */
    scrollToSongIfPending() {
        if (localStorage.getItem('sav_editingSubtitle') !== 'true') return; // guard — cờ false/chưa từng có
        const key = localStorage.getItem('sav_scrollToSongKey');
        localStorage.setItem('sav_editingSubtitle', 'false');
        localStorage.removeItem('sav_scrollToSongKey');
        if (!key) return; // guard
        requestAnimationFrame(() => this._scrollToKeyNode(key, 'smooth'));
    },

    /** Dời từ core `scrollToCurrentKeyInstant()` (bản core ĐÃ XOÁ 02/10/2026) — cuộn
     * TỨC THÌ tới currentKey (gọi lúc Playlist đang dịch ra ngoài khung nhìn).
     * FIX (02/10/2026, Giang báo "về Playlist rồi vào lại thì giật toàn bộ video/motion/visual, đổi Nguồn qua lại thì mượt
     * lại") — KHÔNG dùng `scrollIntoView()` nữa. `returnToPlaylistUI()` gọi hàm này TRƯỚC khi Playlist trượt vào, lúc
     * #app-stack còn nằm hẳn ngoài màn hình: mọi item đang bị `content-visibility: auto` bỏ qua render, và
     * `scrollIntoView()` (1) buộc trình duyệt xử lý node đích đang bị bỏ qua, (2) cuộn CẢ chuỗi khung cuộn tổ tiên chứ
     * không riêng khung Playlist. Lần vào đầu từ boot không dính vì lúc đó Playlist còn trên màn hình (cuộn cùng nhịp với
     * `slidePlaylistOut()`), đổi Nguồn không dính vì cuộn sau `renderPlaylistFull()` lúc Playlist đang hiện.
     * Giờ: tính đích "đặt node vào giữa khung" bằng CÙNG phép tính của bản animated (`computePlaylistCenterScrollPlan()` —
     * chỉ đọc hộp của chính node + khung cuộn, không đụng phần ruột đang bị bỏ qua), rồi gán thẳng `scrollTop` của ĐÚNG
     * khung cuộn Playlist. Vẫn tức thì, vẫn chạy trước khi trượt vào (giữ yêu cầu 29/07/2026 "cuộn tức thì cả 2 chiều"). */
    scrollToCurrentInstant() {
        const key = appState.get('currentKey');
        if (!key) return; // guard — chưa phát gì
        const node = appState.get('domNodesByKey').get(key);
        if (!node || !node.isConnected) return; // guard — node không còn (khác scope/kết quả tìm kiếm)
        if (node.classList.contains('hidden')) return; // guard — đang ẩn vì Search (display:none, không có hộp để đo) — bản scrollIntoView cũ cũng no-op ở case này
        const scrollEl = playlistContainer.parentElement; // div "overflow-y-auto" thật sự cuộn (components/playlist-view.js)
        const plan = computePlaylistCenterScrollPlan(scrollEl, node); // core/playlist/render.js — chỉ dùng start/distance, bỏ duration
        if (Math.abs(plan.distance) < 1) return; // guard — đã đúng vị trí
        setPlaylistScrollTop(scrollEl, plan.start + plan.distance); // core/playlist/render.js
    },

    /** Cuộn tới node của `key` nếu node còn gắn DOM (không có — đang khác scope/kết quả tìm kiếm — thì bỏ qua êm). */
    _scrollToKeyNode(key, behavior) {
        const node = appState.get('domNodesByKey').get(key);
        if (!node || !node.isConnected) return; // guard
        scrollPlaylistNodeIntoView(node, behavior); // core/playlist/render.js
    },

    /** Dời từ core `scrollToCurrentKeyAnimated()` — cuộn CÓ ANIMATION tới currentKey lúc Playlist ĐANG hiển thị (Next/
     * Prev), thời lượng tỉ lệ khoảng cách (xem computePlaylistCenterScrollPlan()). Đang ở Visualizer -> không cuộn. */
    scrollToCurrentAnimated() {
        if (appStack.classList.contains('playlist-hidden')) return; // guard — đang ở Visualizer
        const key = appState.get('currentKey');
        if (!key) return; // guard
        const node = appState.get('domNodesByKey').get(key);
        if (!node || !node.isConnected) return; // guard
        const scrollEl = playlistContainer.parentElement; // div "overflow-y-auto" thật sự cuộn (components/playlist-view.js)
        const plan = computePlaylistCenterScrollPlan(scrollEl, node); // core/playlist/render.js
        if (Math.abs(plan.distance) < 1) return; // guard — đã đúng vị trí
        const startTime = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - startTime) / plan.duration);
            setPlaylistScrollTop(scrollEl, plan.start + plan.distance * easeInOutQuad(t)); // core/playlist/render.js
            if (t >= 1) return; // guard — xong
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },
};
