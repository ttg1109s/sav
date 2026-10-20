/**
 * core/playlist/render.js — phần tính + ghi DOM của danh sách Playlist (hàm lá, nhận đủ qua tham số): dữ liệu hiển thị 1
 * node, kế hoạch diff, ảnh bìa, nút Phát, lớp "đang nạp", trạng thái rỗng, cuộn, chiều cao ước lượng item. Dựng/diff danh
 * sách theo `renderOrder` là việc của event/workflow/playlist-render.js (`workflowPlaylistRender`); markup node ở
 * components/playlist-view.js, thao tác node ở core/playlist/node-ui.js.
 */

        /**
         * Dữ liệu hiển thị 1 node Playlist (Song/Video/Photo dùng chung). "Đang phát" phải khớp cả key lẫn LOẠI media đang
         * phát với Nguồn đang xem (Song/Video/Photo sinh key cùng kiểu slug tên file nên trùng key giữa 3 Nguồn là có thật).
         * @param {string} key @param {object|undefined} cached - mục playlistCache (thiếu -> hiện key, không bìa)
         * @param {string|null} currentKey @param {'song'|'video'|'photo'} playingMediaType @param {'song'|'video'|'photo'} activeMediaSource
         * @param {boolean} isMediaPaused - phần tử media của loại này đang dừng
         * @returns {{key: string, title: string, artist: string, duration: number, hasRealCover: boolean, isPlaying: boolean, isActuallyPlaying: boolean}}
         */
        function computeSongNodeView(key, cached, currentKey, playingMediaType, activeMediaSource, isMediaPaused) {
            const isPlaying = key === currentKey && playingMediaType === activeMediaSource;
            return {
                key,
                title: cached ? cached.tag.title : key,
                artist: cached ? cached.tag.artist : '',
                duration: cached ? cached.duration : 0,
                hasRealCover: !!(cached && cached.cover),
                isPlaying,
                isActuallyPlaying: isPlaying && !isMediaPaused,
            };
        }

        /**
         * Kế hoạch diff tại chỗ theo `renderOrder` mới: node không còn hiển thị mà bài vẫn còn (`playlistOrder` — bị Search/
         * Filter lọc tạm) -> chỉ ẩn, giữ node + ảnh bìa đã tải; bài đã xoá thật -> bỏ hẳn (giữ lại là rò object URL bìa).
         * @param {Map<string, HTMLElement>} domNodesByKey @param {string[]} renderOrder @param {string[]} playlistOrder
         * @returns {{hide: Array<[string, HTMLElement]>, destroy: Array<[string, HTMLElement]>, buildCount: number}} buildCount = số key cần dựng node mới
         */
        function planPlaylistDiff(domNodesByKey, renderOrder, playlistOrder) {
            const renderKeySet = new Set(renderOrder);
            const playlistOrderSet = new Set(playlistOrder);
            const hide = [];
            const destroy = [];
            domNodesByKey.forEach((node, key) => {
                if (renderKeySet.has(key)) return; // còn hiển thị
                const bucket = playlistOrderSet.has(key) ? hide : destroy;
                bucket.push([key, node]);
            });
            const buildCount = renderOrder.filter((key) => !domNodesByKey.has(key)).length;
            return { hide, destroy, buildCount };
        }

        /** Thời gian 1 lượt dựng/tính (log chẩn đoán), làm tròn ms. @param {number} startMs @param {number} nowMs @returns {number} */
        function computePlaylistElapsedMs(startMs, nowMs) {
            return Math.round(nowMs - startMs);
        }

        /**
         * Ảnh bìa trong node Playlist / #record-art tải lỗi (Blob ID3 hỏng, đọc nhầm định dạng, ảnh upload hỏng) -> báo bus,
         * Router gọi applyDefaultCover(). Gắn bằng `addEventListener` sau khi tạo `<img>`, không dùng `onerror="..."` inline
         * (DEFAULT_VINYL là data URI dài, dễ vỡ chuỗi HTML). `once`: ảnh mặc định không bao giờ lỗi.
         */
        function attachCoverFallback(imgEl) {
            imgEl.addEventListener('error', () => eventBus.send({ router: 'playlist', type: 'playlist.cover.error', payload: { img: imgEl } }), { once: true });
        }

        /** Ảnh bìa lỗi -> về đĩa than mặc định. @param {HTMLImageElement} imgEl */
        function applyDefaultCover(imgEl) {
            if (imgEl.src === DEFAULT_VINYL) return; // guard — đã là ảnh mặc định
            imgEl.src = DEFAULT_VINYL;
        }

        /**
         * Thu hồi object URL ảnh bìa của node (thuộc tính JS `_coverObjectUrl`) — gọi ở mọi nơi 1 node bị loại khỏi
         * domNodesByKey (xoá khỏi danh sách, hoặc dựng lại tại chỗ), tránh rò bộ nhớ khi danh sách render lại nhiều lần.
         */
        function revokeNodeCoverUrl(node) {
            if (!node || !node._coverObjectUrl) return; // guard — node chưa từng có bìa thật
            revokeBlobUrl(node._coverObjectUrl);
            node._coverObjectUrl = null;
        }

        /**
         * Gắn ảnh bìa thật cho node đang "chờ bìa" (`data-cover-pending="true"`, <img> chưa có src) — Workflow tạo URL khi
         * node lại gần khung nhìn (workflowPlaylistRender._attachNodeCover()); URL do revokeNodeCoverUrl() thu hồi.
         * @param {HTMLElement} node @param {string} url
         */
        function setNodeCoverUrl(node, url) {
            node._coverObjectUrl = url;
            node.dataset.coverPending = 'false';
            const img = node.querySelector('img');
            if (img) img.src = url;
        }

        /**
         * Trạng thái "Đang phát" của #btn-playlist-empty-play (nhãn + nhấp nháy + `dataset.playing` để CSS/debug soi). Workflow
         * tính `isPlaying` (workflowPlaylistRender.syncPlayButtonPlayingState() — isPlayingMediaListed()) ở mọi mốc
         * renderOrder/currentKey có thể đổi.
         * @param {boolean} isPlaying - media đang phát có thuộc danh sách của Nguồn đang xem không
         */
        function updatePlayButtonPlayingState(isPlaying) {
            if (!btnPlaylistEmptyPlay) return;
            btnPlaylistEmptyPlay.classList.toggle('animate-pulse', isPlaying);
            btnPlaylistEmptyPlay.dataset.playing = String(isPlaying);
            if (btnPlaylistEmptyPlayLabel) btnPlaylistEmptyPlayLabel.textContent = isPlaying ? t('playlistView.btnPlaying') : t('playlistView.btnPlay');
        }

        /** Ẩn khối "chưa có bài" (vd lúc bắt đầu nạp file mới). */
        function hidePlaylistEmpty() {
            playlistEmpty.classList.add('hidden');
        }

        /** Hiện lớp "đang nạp danh sách" (phủ vùng list). total để hiển thị "x / y bài". */
        function showPlaylistLoading(done, total) {
            const el = document.getElementById('playlist-loading-list');
            if (!el) return;
            playlistEmpty.classList.add('hidden');
            const se = document.getElementById('playlist-search-empty'); if (se) se.classList.add('hidden');
            const txt = document.getElementById('playlist-loading-text');
            if (txt) txt.textContent = total ? tFormat('playlistView.loading.withCount', { done, total }) : t('playlistView.loading.generic');
            el.classList.remove('hidden');
            void el.offsetWidth; // ép reflow trước khi tăng opacity để transition fade-in chạy
            el.style.opacity = '1';
        }
        function updatePlaylistLoading(done, total) {
            const txt = document.getElementById('playlist-loading-text');
            if (txt) txt.textContent = total ? tFormat('playlistView.loading.withCount', { done, total }) : t('playlistView.loading.generic');
        }
        // Ẩn lớp "đang nạp": mờ dần rồi ẩn hẳn — Workflow hẹn giờ giữa 2 bước (workflowPlaylistRender.hidePlaylistLoading()).
        /** Bắt đầu mờ dần lớp "đang nạp danh sách" (transition-opacity duration-300). */
        function fadeOutPlaylistLoading() {
            const el = document.getElementById('playlist-loading-list');
            if (!el) return; // guard
            el.style.opacity = '0';
        }
        /** Ẩn hẳn lớp "đang nạp danh sách" (gọi sau khi mờ dần xong). */
        function concealPlaylistLoading() {
            const el = document.getElementById('playlist-loading-list');
            if (!el) return; // guard
            el.classList.add('hidden');
        }

        /**
         * Trạng thái rỗng theo số đếm Workflow truyền vào (workflowPlaylistRender.syncEmptyState()): thư viện rỗng -> "chưa
         * có bài"; có bài nhưng lọc ra 0 -> "không có kết quả"; còn lại ẩn cả hai. Chữ đổi theo Nguồn (bảng tra giá trị).
         * @param {number} totalCount - số bài hợp lệ của Nguồn/Scope @param {number} renderCount - số bài đang hiển thị
         * @param {'song'|'video'|'photo'} mediaSource
         */
        function applyPlaylistEmptyState(totalCount, renderCount, mediaSource) {
            const EMPTY_TEXT_KEY = { song: 'playlistView.empty.noSongs', video: 'playlistView.empty.noVideos', photo: 'playlistView.empty.noPhotos' };
            const SEARCH_EMPTY_TEXT_KEY = { song: 'playlistView.empty.noSearchResults', video: 'playlistView.empty.noSearchResultsVideo', photo: 'playlistView.empty.noSearchResultsPhoto' };
            const isLibraryEmpty = totalCount === 0;
            const isSearchEmpty = !isLibraryEmpty && renderCount === 0;
            const searchEmptyEl = document.getElementById('playlist-search-empty');
            const emptyTextEl = playlistEmpty.querySelector('p');
            if (emptyTextEl) emptyTextEl.textContent = t(EMPTY_TEXT_KEY[mediaSource] || EMPTY_TEXT_KEY.song);
            playlistEmpty.classList.toggle('hidden', !isLibraryEmpty);
            if (!searchEmptyEl) return; // guard — khối "không có kết quả" chưa mount
            const searchTextEl = searchEmptyEl.querySelector('p');
            if (searchTextEl) searchTextEl.textContent = t(SEARCH_EMPTY_TEXT_KEY[mediaSource] || SEARCH_EMPTY_TEXT_KEY.song);
            searchEmptyEl.classList.toggle('hidden', !isSearchEmpty);
        }

        // Cuộn danh sách: gán thẳng scrollTop (không animation). Điều phối (cuộn tới bài đang phát / bài vừa sửa phụ đề):
        // event/workflow/playlist-render.js.

        /** scrollTop đưa `node` vào giữa khung cuộn Playlist (cha của #playlist-container, kẹp trong [0, maxScroll]) + đã ở
         * đúng chỗ chưa (lệch < 1px). Chỉ đo hộp của 2 phần tử, không đụng phần ruột item đang bị content-visibility bỏ qua.
         * @param {HTMLElement} container - #playlist-container @param {HTMLElement} node @returns {{top: number, isSettled: boolean}} */
        function computePlaylistCenterScroll(container, node) {
            const scrollEl = container.parentElement;
            const containerRect = scrollEl.getBoundingClientRect();
            const nodeRect = node.getBoundingClientRect();
            const nodeOffsetTop = (nodeRect.top - containerRect.top) + scrollEl.scrollTop;
            const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
            const top = Math.max(0, Math.min(maxScroll, nodeOffsetTop - (scrollEl.clientHeight / 2) + (nodeRect.height / 2)));
            return { top, isSettled: Math.abs(top - scrollEl.scrollTop) < 1 };
        }
        /** Đặt scrollTop của khung cuộn Playlist. @param {HTMLElement} container - #playlist-container */
        function setPlaylistScrollTop(container, top) {
            container.parentElement.scrollTop = top;
        }

        /** Về đầu danh sách ngay — đổi Nguồn dựng lại toàn bộ nội dung, scrollTop cũ không còn nghĩa. */
        function resetPlaylistScrollTop() {
            playlistContainer.parentElement.scrollTop = 0;
        }

        /**
         * Đo chiều cao vùng nội dung (content-box) của 1 node item — làm `contain-intrinsic-block-size` cho item đang bị
         * `content-visibility: auto` bỏ qua render (assets/css/layout-nav.css). Tạm ép `content-visibility: visible` +
         * `transform: none` (`active:scale-[0.98]` làm hộp co lại) rồi trả inline style cũ ngay.
         * @param {HTMLElement|null} node @returns {number} px (0 nếu không đo được — node null/đang `display:none`)
         */
        function measurePlaylistItemBlockSize(node) {
            if (!node) return 0; // guard
            const prevContentVisibility = node.style.contentVisibility;
            const prevTransform = node.style.transform;
            node.style.contentVisibility = 'visible';
            node.style.transform = 'none';
            const cs = getComputedStyle(node);
            const borderBoxHeight = node.getBoundingClientRect().height;
            const contentHeight = borderBoxHeight
                - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
                - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
            node.style.contentVisibility = prevContentVisibility;
            node.style.transform = prevTransform;
            return borderBoxHeight > 0 ? contentHeight : 0; // display:none -> 0, nơi gọi tự guard
        }

        /** Ghi biến CSS `--playlist-item-block-size` lên #playlist-container. Giữ số lẻ (tile Grid `aspect-square` thường cao
         * lẻ px) — làm tròn sẽ lệch tích luỹ, cuộn tới bài đang phát trượt khỏi tâm.
         * @param {HTMLElement} containerEl @param {number} px */
        function applyPlaylistItemBlockSize(containerEl, px) {
            if (!containerEl) return; // guard
            containerEl.style.setProperty('--playlist-item-block-size', `${px}px`);
        }

        /** LOẠI media đang phát, suy từ 2 cờ player mode (không cờ nào bật = Song). Song/Video/Photo sinh key cùng kiểu slug
         * tên file nên trùng key giữa 3 Nguồn là có thật — chỉ so `currentKey` là chưa đủ.
         * @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode @returns {'song'|'video'|'photo'} */
        function resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode) {
            return isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
        }

        /** Media đang phát có nằm trong danh sách đang hiển thị không: khớp key VÀ khớp loại media đang phát với Nguồn đang xem.
         * @param {string|null} currentKey @param {'song'|'video'|'photo'} playingMediaType
         * @param {'song'|'video'|'photo'} activeMediaSource @param {string[]} renderOrder @returns {boolean} */
        function isPlayingMediaListed(currentKey, playingMediaType, activeMediaSource, renderOrder) {
            if (currentKey == null) return false; // guard — chưa phát gì
            return playingMediaType === activeMediaSource && renderOrder.includes(currentKey);
        }
