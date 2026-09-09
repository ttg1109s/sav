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
 * revokeNodeCoverUrl/selectionIndicatorHtml/showPlaylistLoading/updatePlaylistLoading/
 * hidePlaylistLoading/resetPlaylistScrollTop — thuần hẳn) + nhóm tự đọc `appState` nhưng KHÔNG gọi
 * chéo hàm nào trong cụm này (`updateEmptyState`/`scrollToSongIfPending`/`scrollToCurrentKeyInstant`/
 * `scrollToCurrentKeyAnimated`/`applySearchQuery` — nợ kỹ thuật RIÊNG, chưa relocate đợt này, xem
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
 * attachCoverFallback/selectionIndicatorHtml/updateEmptyState), core/playlist/state.js
 * (formatTime), core/dom-refs.js (playlistContainer/btnReturnVisual/DEFAULT_VINYL/bgVideoElement/
 * audioPlayer). NẠP TRƯỚC: mọi file gọi `workflowPlaylistRender.*` — event/workflow/playlist.js,
 * video-player.js, photo-player.js, player.js, playlist-scope.js, playlist-empty-state.js,
 * playlist-order.js, file-manager-storage.js (đều nạp sau trong cùng nhóm EVENT), core/playlist/
 * actions.js, loader.js, core/storage-manager.js, core/player-controls.js (Core gọi Workflow — nợ
 * kỹ thuật RIÊNG của các file đó, CÙNG loại đã ghi nhận ở applySearchQuery()/removeKeyFromDisplay(),
 * chưa relocate cả hàm trong đợt này).
 */
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
        const coverUrl = hasRealCover ? URL.createObjectURL(cached.cover) : DEFAULT_VINYL;

        const isPlaying = (key === appState.get('currentKey'));
        const isActuallyPlaying = isPlaying && !((cached && cached.mediaType === 'video') ? bgVideoElement.paused : audioPlayer.paused);
        const eqIconHtml = isActuallyPlaying ? `<div class="flex items-end gap-[2px] h-3 w-3"><div class="w-[3px] bg-sky-400 eq-1"></div><div class="w-[3px] bg-sky-400 eq-2"></div><div class="w-[3px] bg-sky-400 eq-3"></div></div>` : (isPlaying ? `<div class="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_5px_rgba(14,165,233,0.8)]"></div>` : '');
        const selectionMode = appState.get('selectionMode');
        const isSelected = selectionMode && appState.get('selectedMediaKeys').has(key);
        const menuBtnHtml = selectionMode ? '' : songActionMenuButtonHtml(key); // core/playlist/render.js

        const wrapper = document.createElement('div');
        wrapper.dataset.key = key;
        wrapper._coverObjectUrl = hasRealCover ? coverUrl : null;

        if (appState.get('isGridView')) {
            wrapper.className = `flex flex-col cursor-pointer active:scale-[0.98] transition-transform group relative w-full`;
            wrapper.dataset.role = 'play-item';
            wrapper.innerHTML = `
                <div class="w-full aspect-square relative mb-2.5">
                    <img src="${coverUrl}" class="w-full h-full rounded-2xl object-cover shadow-lg">
                    ${isPlaying ? `<div class="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center backdrop-blur-[2px]">${eqIconHtml}</div>` : ''}
                    ${selectionMode ? `<div class="absolute top-2 left-2">${selectionIndicatorHtml(isSelected)}</div>` : ''}
                    <div class="absolute top-2 right-2 flex bg-black/40 rounded-full">${menuBtnHtml}</div>
                </div>
                <h3 class="text-[15px] font-semibold leading-tight line-clamp-1 px-1" data-uitk="textPrimary">${title}</h3>
                <p class="text-[13px] font-medium line-clamp-1 px-1 mt-0.5" data-uitk="textSecondary">${secondLineHtml}</p>`;
        } else {
            wrapper.className = `flex items-center gap-4 px-5 py-3 active:bg-slate-100 transition-colors cursor-pointer w-full group border-b ${isSelected ? 'bg-sky-50' : ''}`;
            wrapper.dataset.uitk = isSelected ? 'dividerBorder' : 'dividerBorder cardHoverBg';
            wrapper.dataset.role = 'play-item';
            wrapper.innerHTML = `
                ${selectionMode ? selectionIndicatorHtml(isSelected) : ''}
                <img src="${coverUrl}" class="w-12 h-12 rounded-lg flex-shrink-0 object-cover shadow-md">
                <div class="flex-grow flex flex-col justify-center overflow-hidden gap-0.5">
                    <div class="flex items-center gap-2"><h3 class="text-[16px] leading-tight font-semibold truncate ${isPlaying ? 'text-sky-600' : ''}" ${isPlaying ? '' : 'data-uitk="textPrimary"'}>${title}</h3>${isPlaying ? eqIconHtml : ''}</div>
                    <p class="text-[13px] truncate font-medium" data-uitk="textSecondary">${secondLineHtml}</p>
                </div>
                <div class="flex">${menuBtnHtml}</div>`;
        }
        attachCoverFallback(wrapper.querySelector('img')); // core/playlist/render.js
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(wrapper, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — MỚI (09/09/2026, hệ UI Theme mở rộng "đổi hết trừ Visualizer") — node dựng ĐỘNG (createElement+innerHTML), KHÔNG tự động qua applyUiThemeToDom(document,...) lúc boot như nội dung tĩnh — phải tự áp NGAY ở đây mỗi khi dựng 1 node mới
        return wrapper;
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
        if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); else btnReturnVisual.classList.add('hidden');
        updateEmptyState(); // core/playlist/render.js
        console.log(`writer: "workflowPlaylistRender.renderPlaylistFull", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms cho ${appState.get('renderOrder').length} item (dựng lại TOÀN BỘ DOM)"`);
    },

    /** Đồng bộ DOM theo `renderOrder` MỚI, tái dùng tối đa node cũ.
     * FIX (Giang chỉ ra "search rồi tắt từ khoá lại rebuild thay vì chỉ ẩn/hiện") — xem docstring
     * đầu file: phân biệt key "lọc tạm" (còn trong `playlistOrder` — CHỈ ẩn) vs key "xoá thật"
     * (không còn — destroy hẳn như cũ). Dời từ core/playlist/render.js::renderPlaylistDiff(). */
    renderPlaylistDiff() {
        const _t0 = performance.now();
        if (playlistContainer.children.length !== appState.get('domNodesByKey').size) {
            this.renderPlaylistFull(); // hàm này TỰ log riêng — không log trùng ở đây
            return;
        }

        const renderKeySet = new Set(appState.get('renderOrder'));
        const playlistOrderSet = new Set(appState.get('playlistOrder')); // MỚI — phân biệt "lọc tạm" vs "xoá thật"

        let _hiddenCount = 0; // MỚI (chẩn đoán) — số node CHỈ ẨN (không destroy) trong lượt này
        let _destroyedCount = 0;
        for (const [key, node] of Array.from(appState.get('domNodesByKey').entries())) {
            if (!renderKeySet.has(key)) {
                if (playlistOrderSet.has(key)) {
                    // Bài vẫn còn thật (đang bị Search/Filter ẩn KHỎI VIEW) -> CHỈ ẨN, GIỮ NGUYÊN
                    // node + cover đã tải trong domNodesByKey — gỡ Search/Filter là hiện lại NGAY.
                    if (!node.classList.contains('hidden')) { node.classList.add('hidden'); _hiddenCount++; }
                } else {
                    // Bài đã xoá THẬT (không còn trong playlistOrder) -> bỏ vĩnh viễn, ĐÚNG hành vi cũ.
                    revokeNodeCoverUrl(node); // core/playlist/render.js
                    node.remove();
                    appState.mutate('domNodesByKey', m => m.delete(key));
                    _destroyedCount++;
                }
            }
        }

        let prevNode = null;
        let _builtCount = 0; // MỚI (chẩn đoán) — đếm số node PHẢI DỰNG MỚI (buildSongNode) trong lượt diff này
        for (const key of appState.get('renderOrder')) {
            let node = appState.get('domNodesByKey').get(key);
            if (!node) {
                node = this.buildSongNode(key);
                _builtCount++;
                appState.mutate('domNodesByKey', m => m.set(key, node));
            } else if (node.classList.contains('hidden')) {
                node.classList.remove('hidden'); // MỚI — bài từng bị ẩn (lọc tạm) giờ khớp lại -> hiện lại NGAY, không build lại
            }
            const expectedNextSibling = prevNode ? prevNode.nextSibling : playlistContainer.firstChild;
            if (expectedNextSibling !== node) {
                playlistContainer.insertBefore(node, expectedNextSibling);
            }
            prevNode = node;
        }

        if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); else btnReturnVisual.classList.add('hidden');
        updateEmptyState(); // core/playlist/render.js
        console.log(`writer: "workflowPlaylistRender.renderPlaylistDiff", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms — dựng mới ${_builtCount}/${appState.get('renderOrder').length} node, ẩn tạm ${_hiddenCount}, xoá hẳn ${_destroyedCount}"`);
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
        if (oldNode.classList.contains('hidden')) newNode.classList.add('hidden');
        revokeNodeCoverUrl(oldNode); // core/playlist/render.js
        oldNode.replaceWith(newNode);
        appState.mutate('domNodesByKey', m => m.set(key, newNode));
    },
};
