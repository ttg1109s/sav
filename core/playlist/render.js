/**
 * playlist/render.js — Vẽ DANH SÁCH HIỂN THỊ (renderOrder) ra DOM theo kiểu diff (chỉ đụng node
 * cần đổi). Toàn bộ render đọc `renderOrder` (UI) — KHÔNG đọc `displayOrder` (hàng đợi phát).
 *
 * Trạng thái rỗng (#playlist-empty / #playlist-search-empty) được tính thuần từ dữ liệu:
 *   - Không có bài nào hợp lệ        -> hiện "Chưa có bài hát nào".
 *   - Có bài nhưng tìm kiếm 0 kết quả -> hiện "Không tìm thấy bài hát phù hợp".
 *   - Còn lại                         -> ẩn cả hai.
 * (Sửa lỗi v6: trước đây #playlist-empty không bao giờ được tự ẩn khi đã có bài, nên hiện đè
 *  lên cả danh sách.)
 *
 * SỬA TẬN GỐC (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ") — `buildSongNode()`/
 * `renderPlaylistFull()`/`renderPlaylistDiff()`/`refreshSongNode()` TRƯỚC ĐÂY ở file này, tự
 * `appState.get()` VÀ gọi lẫn nhau (Rule 3a: `buildSongNode()` trả về giá trị có Ý NGHĨA NGHIỆP
 * VỤ RIÊNG — không đủ điều kiện Rule 3c để làm closure lồng) — CẢ 4 ĐÃ DỜI sang event/workflow/
 * playlist-render.js (`workflowPlaylistRender`), CÙNG đợt dời order.js -> playlist-order.js. File
 * NÀY giờ CHỈ còn hàm THUẦN/tiện ích nhỏ + nhóm tự đọc `appState` nhưng KHÔNG gọi chéo hàm nào
 * trong cụm vừa dời (`updateEmptyState`/3 hàm scroll — nợ kỹ thuật RIÊNG, chưa
 * relocate đợt này, xem docstring từng hàm).
 */

        // DỜI (07/10/2026, rà soát SVG — Rule 5d) — `songActionMenuButtonHtml(key, onDarkBg)` (chỉ là template HTML nút 3 chấm)
        // sang components/playlist-view.js::renderSongActionMenuButtonHtml(), thân + toàn bộ ghi chú lịch sử giữ nguyên.

        /**
         * Ver 8 refine (mục 4 — lỗi ảnh cover không hiển thị): GẮN onerror NGAY SAU khi tạo
         * `<img>` cover trong DOM, KHÔNG nhúng onerror="..." dạng inline-attribute trong chuỗi
         * HTML — tránh hoàn toàn rủi ro escaping (DEFAULT_VINYL là data URI dài, lỡ chứa ký tự
         * đặc biệt nào sẽ vỡ chuỗi HTML). `<img>` chỉ "vỡ" (hiện icon ảnh hỏng trình duyệt) khi
         * Blob cover KHÔNG decode được làm ảnh thật — có thể xảy ra do: file gốc có cover ID3 bị
         * lỗi/cắt cụt, jsmediatags đọc nhầm định dạng ảnh (ví dụ gắn nhãn JPEG nhưng dữ liệu thật
         * là PNG hoặc ngược lại), hoặc người dùng tự upload 1 ảnh hỏng qua tab "Ảnh bìa". Khi đó,
         * `onerror` tự thay `src` về DEFAULT_VINYL (ảnh vinyl mặc định) — y hệt hành vi "không có
         * cover" — và gỡ chính `onerror` đó (`this.onerror = null`) để tránh loop vô hạn nếu
         * DEFAULT_VINYL (vốn là data URI, không bao giờ lỗi) vẫn lỡ bị lỗi vì lý do khác.
         */
        function attachCoverFallback(imgEl) {
            // SỬA (02/10/2026, xử lý nợ 02/10/2026 — Rule 5a) — callback trước đây TỰ đổi `src` (không qua bus). Giờ CHỈ bắn
            // 'playlist.cover.error' (router gọi applyDefaultCover() ngay dưới); `once` thay cho tự removeEventListener.
            imgEl.addEventListener('error', () => eventBus.send({ router: 'playlist', type: 'playlist.cover.error', payload: { img: imgEl } }), { once: true });
        }

        /** MỚI (02/10/2026, tách từ callback cũ của attachCoverFallback()) — ảnh bìa lỗi -> về đĩa than mặc định. Hàm LÁ.
         * @param {HTMLImageElement} imgEl */
        function applyDefaultCover(imgEl) {
            if (imgEl.src === DEFAULT_VINYL) return; // guard — đã là ảnh mặc định
            imgEl.src = DEFAULT_VINYL;
        }

        /**
         * Ver 8 refine (mục 4): theo dõi object URL của ảnh cover NGAY TRÊN node (thuộc tính JS
         * tuỳ biến `_coverObjectUrl`, không phải attribute DOM) để revoke đúng lúc node bị bỏ —
         * trước đây buildSongNode() tạo URL mới mỗi lần gọi mà KHÔNG BAO GIỜ revoke URL cũ, rò bộ
         * nhớ tích lũy dần khi danh sách render lại nhiều lần (đổi bài/thêm bài/sort lại đều có
         * thể gọi lại buildSongNode cho 1 key). revokeNodeCoverUrl() được gọi ở mọi nơi 1 node bị
         * loại khỏi domNodesByKey (xoá bài khỏi danh sách, hoặc refreshSongNode thay node cũ).
         */
        function revokeNodeCoverUrl(node) {
            // SỬA (02/10/2026, rà Rule 3b) — thu hồi qua `revokeBlobUrl()` (service/blob-url.js — API dọn tài nguyên Core ĐƯỢC
            // gọi) thay vì gọi thẳng URL.revokeObjectURL; điều kiện gộp viết lại thành guard.
            if (!node || !node._coverObjectUrl) return; // guard — node chưa từng có bìa thật
            revokeBlobUrl(node._coverObjectUrl);
            node._coverObjectUrl = null;
        }

        /** MỚI (02/10/2026, tối ưu 10000 item — Giang duyệt) — gắn ảnh bìa THẬT cho 1 node mà buildSongNode() đã dựng ở trạng
         * thái "chờ bìa" (`data-cover-pending="true"`, <img> chưa có src). Đo trên 10000 item: tạo object URL cho TẤT CẢ
         * bìa lúc dựng chiếm ~70% thời gian dựng -> giờ chỉ tạo khi node lại gần khung nhìn hoặc được dựng lại tại chỗ.
         * SỬA (02/10/2026, rà Rule 3b) — bản đầu tự gọi `createBlobUrl()` (TẠO tài nguyên = việc CHUẨN BỊ, cấm Core): giờ
         * Workflow tạo URL (workflowPlaylistRender._attachNodeCover()) rồi truyền xuống; hàm này chỉ GHI lên node nhận vào.
         * URL vẫn do revokeNodeCoverUrl() ngay trên thu hồi khi node bị bỏ. Hàm LÁ.
         * @param {HTMLElement} node @param {string} url */
        function setNodeCoverUrl(node, url) {
            node._coverObjectUrl = url;
            node.dataset.coverPending = 'false';
            const img = node.querySelector('img');
            if (img) img.src = url;
        }

        /** MỚI (02/10/2026, rà event-bus-flow.md mục 7 — tách từ buildSongNode() của Workflow) — 2 bố cục node Playlist
         * (Grid/List) trước đây là 1 if/else trong Workflow. Mỗi hàm dựng ĐÚNG 1 bố cục lên `wrapper` nhận vào (className +
         * data-role + innerHTML) — HTML GIỮ NGUYÊN từng ký tự, Workflow chọn hàm bằng object map. Ternary bên trong chỉ
         * là trình bày (có/không icon đang phát). Hàm THUẦN.
         * @param {HTMLElement} wrapper
         * @param {{coverSrcAttr:string, isPlaying:boolean, eqIconHtml:string, menuBtnHtml:string, title:string, secondLineHtml:string}} view */
        function fillGridSongNode(wrapper, view) {
            wrapper.className = `flex flex-col cursor-pointer active:scale-[0.98] transition-transform group relative w-full`;
            wrapper.dataset.role = 'play-item';
            wrapper.innerHTML = `
                <div class="w-full aspect-square relative mb-2.5">
                    <img ${view.coverSrcAttr} loading="lazy" decoding="async" class="w-full h-full rounded-2xl object-cover shadow-lg">
                    ${view.isPlaying ? `<div class="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center backdrop-blur-[2px]">${view.eqIconHtml}</div>` : ''}
                    <div class="absolute top-2 right-2 flex bg-black/40 rounded-full">${view.menuBtnHtml}</div>
                </div>
                <h3 class="text-[15px] font-semibold leading-tight line-clamp-1 px-1" data-uitk="textPrimary">${view.title}</h3>
                <p class="text-[13px] font-medium line-clamp-1 px-1 mt-0.5" data-uitk="textSecondary">${view.secondLineHtml}</p>`;
        }

        /** Bố cục List — xem docstring fillGridSongNode() ngay trên.
         * `data-uitk="cardHoverBg rowPressBg"` (SỬA 21/09/2026 — trước đây `active:bg-slate-100`/`bg-sky-50` class cứng;
         * nhấn giữ = rowPressBg, rê chuột = cardHoverBg); nền hàng ĐANG CHỌN không đặt ở đây (tint `selectionTintBg` do
         * showSelectionIndicator() thêm/gỡ).
         * @param {HTMLElement} wrapper @param {object} view - cùng shape fillGridSongNode() */
        function fillListSongNode(wrapper, view) {
            wrapper.className = `flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer w-full group`;
            wrapper.dataset.uitk = 'cardHoverBg rowPressBg';
            wrapper.dataset.role = 'play-item';
            wrapper.innerHTML = `
                <img ${view.coverSrcAttr} loading="lazy" decoding="async" class="w-12 h-12 rounded-lg flex-shrink-0 object-cover shadow-md">
                <div class="flex-grow flex flex-col justify-center overflow-hidden gap-0.5">
                    <div class="flex items-center gap-2"><h3 class="text-[16px] leading-tight font-semibold truncate" data-uitk="${view.isPlaying ? 'accentText' : 'textPrimary'}">${view.title}</h3>${view.isPlaying ? view.eqIconHtml : ''}</div>
                    <p class="text-[13px] truncate font-medium" data-uitk="textSecondary">${view.secondLineHtml}</p>
                </div>
                <div class="flex">${view.menuBtnHtml}</div>`;
        }

        // XOÁ (24/09/2026, rà soát refresh DOM) — `selectionIndicatorHtml()` (vòng tròn chọn vẽ INLINE lúc dựng
        // node, không có `data-role`) bỏ hẳn: chỉ báo chọn giờ ĐÚNG 1 đường duy nhất `showSelectionIndicator()`/
        // `hideSelectionIndicator()` (core/playlist/selection.js), Workflow áp lên node vừa dựng — xem
        // event/workflow/playlist-render.js::_applySelectionLayer().

        /** MỚI (09/09/2026, Giang yêu cầu "gộp nút icon visualizer riêng vào nút Phát to") — đồng bộ
         * trạng thái "Đang phát" của #btn-playlist-empty-play: có `currentKey` VÀ vẫn còn nằm trong
         * `displayOrder` hiện hành (nghĩa là playlist/scope/tìm kiếm CHƯA đổi khỏi lúc phát bài đó)
         * -> nút chuyển nhãn "Đang phát" + nhấp nháy (`animate-pulse`). Hàm này CHỈ lo phần NHÌN
         * THẤY (nhãn/nhấp nháy/`dataset.playing` — dataset giữ lại để CSS/debug soi trạng thái,
         * không còn ai đọc lại để RẼ NHÁNH nữa) — router (event/router/playlist-empty-state.js) từ
         * SỬA 09/09/2026 (Giang báo bug "hiện Phát nhưng bấm vẫn vào Visualizer" — cache
         * dataset.playing lệch nếu lỡ sót 1 đường gọi lại hàm này) đã đổi sang TỰ TÍNH LẠI trực
         * tiếp từ currentKey/displayOrder bằng ĐÚNG công thức bên dưới, không đọc dataset của hàm
         * này nữa — 2 nơi tính cùng 1 công thức nên luôn khớp nhau tự nhiên, không cần đồng bộ tay.
         * Gọi lại ở MỌI mốc renderOrder/currentKey có thể đổi (renderPlaylistFull/renderPlaylistDiff
         * ngay trong file này, + workflowPlayer.playMedia() lúc đổi bài — event/workflow/player.js)
         * — TRƯỚC ĐÂY 3 chỗ đó tự show/hide riêng nút #btn-return-visual (đã bỏ), giờ gọi CHUNG 1
         * hàm này thay thế.
         *
         * FIX (10/09/2026, Giang chỉ ra đúng — "Core sao lại tự đọc appState, không dùng tham số?")
         * — hàm này nằm ở core/playlist/render.js (tầng Core) nhưng TRƯỚC ĐÂY tự
         * `appState.get('currentKey')`/`appState.get('displayOrder')` bên trong, VI PHẠM Rule 2
         * (core-function-conventions.md — Core cấm tự đọc appState, CHỈ tầng Workflow được đọc rồi
         * TRUYỀN xuống qua tham số). Giờ nhận cả 2 qua tham số — 5 nơi gọi (renderPlaylistFull/
         * renderPlaylistDiff ngay dưới, event/workflow/player.js, video-player.js, photo-player.js)
         * tự `appState.get()` rồi truyền vào, đúng vai Workflow "chuẩn bị dữ liệu cho Core thi
         * hành". KHÔNG đổi 1 dòng LOGIC bên trong — chỉ đổi nguồn lấy 2 giá trị từ tự đọc sang nhận
         * tham số.
         * @param {boolean} isPlaying - media đang phát có thuộc hàng đợi phát của Nguồn đang xem không
         */
        function updatePlayButtonPlayingState(isPlaying) {
            // SỬA (02/10/2026, Giang báo "Đang phát" sai khi key trùng giữa các Nguồn) — trước đây tự tính
            // `currentKey != null && displayOrder.includes(currentKey)` (chỉ so key: đang phát video mà sang Nguồn Photo,
            // ảnh trùng tên file làm nút báo "Đang phát"). Công thức đúng (khớp cả LOẠI media) giờ tính ở Workflow
            // (workflowPlaylistRender.syncPlayButtonPlayingState()) qua isPlayingMediaListed() — hàm này chỉ còn VẼ.
            if (!btnPlaylistEmptyPlay) return;
            btnPlaylistEmptyPlay.classList.toggle('animate-pulse', isPlaying);
            btnPlaylistEmptyPlay.dataset.playing = String(isPlaying);
            if (btnPlaylistEmptyPlayLabel) btnPlaylistEmptyPlayLabel.textContent = isPlaying ? t('playlistView.btnPlaying') : t('playlistView.btnPlay');
        }

        /** Hiện lớp "đang nạp danh sách" (phủ vùng list). total để hiển thị "x / y bài". */
        function showPlaylistLoading(done, total) {
            const el = document.getElementById('playlist-loading-list');
            if (!el) return;
            playlistEmpty.classList.add('hidden');
            const se = document.getElementById('playlist-search-empty'); if (se) se.classList.add('hidden');
            // SỬA (02/10/2026, rà Rule 3a) — trước đây gọi updatePlaylistLoading() (core gọi core) — đặt chữ ngay tại đây.
            const txt = document.getElementById('playlist-loading-text');
            if (txt) txt.textContent = total ? tFormat('playlistView.loading.withCount', { done, total }) : t('playlistView.loading.generic');
            el.classList.remove('hidden');
            // ép reflow trước khi tăng opacity để transition fade-in chạy mượt
            void el.offsetWidth;
            el.style.opacity = '1';
        }
        function updatePlaylistLoading(done, total) {
            const txt = document.getElementById('playlist-loading-text');
            if (txt) txt.textContent = total ? tFormat('playlistView.loading.withCount', { done, total }) : t('playlistView.loading.generic');
        }
        // SỬA (02/10/2026, rà Rule 3 — taskManager cấm trong Core) — `hidePlaylistLoading()` (mờ dần + taskManager.once()
        // ẩn hẳn sau 320ms) tách thành 2 hàm lá dưới; Workflow (workflowPlaylistRender.hidePlaylistLoading()) tự hẹn giờ.
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

        /** Cập nhật trạng thái rỗng/không-kết-quả thuần từ dữ liệu (không liên quan hàng đợi phát).
         * SỬA (02/10/2026, rà Rule 1/2/3a) — trước đây `updateEmptyState()` tự appState.get() (Rule 2), gọi liveKeys() +
         * hidePlaylistLoading() (core gọi core, Rule 3a) và rẽ if/else 3 nhánh (Rule 1). Giờ Workflow
         * (workflowPlaylistRender.syncEmptyState()) đếm sẵn rồi truyền vào; 3 trạng thái cũ viết lại thành 2 boolean
         * hiện/ẩn — kết quả hiển thị y hệt: thư viện rỗng -> hiện "chưa có bài"; có bài nhưng lọc ra 0 -> hiện "không có
         * kết quả"; còn lại ẩn cả hai. Chữ đổi theo Nguồn qua bảng tra GIÁ TRỊ (không rẽ tiến trình).
         * @param {number} totalCount - số bài hợp lệ của Nguồn/Scope @param {number} renderCount - số bài đang hiển thị
         * @param {'song'|'video'|'photo'} mediaSource */
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

        /** SỬA (yêu cầu Giang) — cuộn tới ĐÚNG bài hát vừa sửa phụ đề xong (quay lại từ
         * subtitle-editor.html qua `location.href`, KHÔNG còn `history.back()` — xem
         * event/workflow/subtitle-editor.js::back()) — đọc CỜ RÕ RÀNG `sav_editingSubtitle` +
         * key riêng `sav_scrollToSongKey`, CẢ HAI lưu qua `localStorage` (KHÔNG phải sessionStorage
         * nữa). Cờ `false`/chưa từng có -> KHÔNG làm gì cả; cờ `true` -> cuộn tới đúng bài (tra
         * THẲNG qua `domNodesByKey`, Map bền vững `workflowPlaylistRender.renderPlaylistDiff()`
         * (event/workflow/playlist-render.js) đang dùng, LUÔN khớp đúng node THẬT đang hiển thị —
         * không tự dò lại DOM bằng querySelector), KHÔNG kèm hiệu ứng nháy/chớp UI gì cả (yêu cầu
         * Giang — chỉ cuộn mượt, không viền sáng tạm thời như bản trước) — rồi đặt cờ về `false` +
         * xoá hẳn key bài hát NGAY, chỉ dùng ĐÚNG 1 lần.
         * Gọi từ core/visualizer/draw-visualizer.js, NGAY SAU initPlaylistFromDB() + khôi phục
         * activePlayListFolder (đảm bảo scope/danh sách đã ở trạng thái CUỐI CÙNG trước khi cuộn —
         * cuộn sớm hơn có thể nhắm nhầm lúc danh sách còn đang lọc lại theo folder). */
        // DỜI (02/10/2026, rà Rule 2/3b) — `scrollToSongIfPending()` (tự đọc localStorage + appState, tự hẹn
        // requestAnimationFrame) sang event/workflow/playlist-render.js::scrollToSongIfPending(); phần cuộn còn lại ở đây:
        // XOÁ (02/10/2026, Giang: "loại bỏ animation, gán giá trị scroll thẳng") — `scrollPlaylistNodeIntoView()`
        // (scrollIntoView smooth/auto): nơi gọi duy nhất `_scrollToKeyNode()` đã thay bằng
        // workflowPlaylistRender._scrollToKeyInstant() (computePlaylistCenterScrollTop() + setPlaylistScrollTop() dưới).

        // XOÁ (02/10/2026, xử lý nợ 02/10/2026) — `scrollToCurrentKeyInstant()` (tự appState.get(), Rule 2): nơi gọi cuối cùng
        // (core/player-controls.js::switchToVisualizer()) đã dời sang Workflow, mọi nơi dùng
        // workflowPlaylistRender.scrollToCurrentInstant() (event/workflow/playlist-render.js).

        /** MỚI (phản hồi Giang 29/07/2026, mục 2 — "next/prev... phải scroll tới nhưng có hiệu
         * ứng cuộn, thời gian tính theo độ dài playlist chứ không hard-code") — cuộn CÓ ANIMATION,
         * dùng lúc Playlist ĐANG HIỂN THỊ SẴN ngay lúc Next/Prev đổi bài (nhảy tức thì lúc đang
         * nhìn thẳng vào danh sách sẽ giật mắt — khác hẳn scrollToCurrentKeyInstant() ở trên, hàm
         * đó CỐ Ý tức thì vì luôn chạy lúc Playlist còn đang ẩn/dịch ra ngoài khung nhìn).
         * KHÔNG dùng `node.scrollIntoView({behavior:'smooth'})` — browser tự quyết định thời
         * lượng animation, KHÔNG tỉ lệ theo khoảng cách thật cần cuộn (playlist càng dài/vị trí
         * bài đang phát càng xa vị trí cuộn hiện tại thì càng thấy "bay" nhanh giật cục hoặc
         * "lết" chậm bất nhất, tuỳ browser). Tự đo khoảng cách thật (scrollTop đích - scrollTop
         * hiện tại) rồi suy ra thời lượng TỈ LỆ THUẬN khoảng cách đó (tốc độ cuộn px/ms CỐ ĐỊNH —
         * playlist dài/cuộn xa chạy lâu hơn tương ứng, playlist ngắn/cuộn gần chạy nhanh hơn tương
         * ứng, cảm giác tốc độ luôn nhất quán bất kể độ dài danh sách), clamp lại 2 đầu (200ms-
         * 800ms) để không quá giật (quá ngắn) hay quá ì (quá dài) ở 2 thái cực.
         * CHỈ chạy khi Playlist ĐANG hiển thị (`#app-stack` KHÔNG có class 'playlist-hidden') —
         * đang ở Visualizer thì không có gì để cuộn NGAY, xem scrollToCurrentKeyInstant() lo lúc
         * quay lại. Gọi từ core/playlist/actions.js (Song) + event/router/video-player.js (Video),
         * ĐÚNG nhánh switchScreen===false (Next/Prev, KHÔNG phải bấm tay 1 dòng trong Playlist —
         * bấm tay đã switchToVisualizer() luôn, không cần cuộn gì thêm). */
        // DỜI (02/10/2026, rà Rule 2) — `scrollToCurrentKeyAnimated()` (tự appState.get() currentKey/domNodesByKey, đọc
        // class `playlist-hidden`) sang event/workflow/playlist-render.js::scrollToCurrentAnimated(); 3 phần THUẦN ở đây
        // (số học GIỮ NGUYÊN từng hệ số: tốc độ 2,2 px/ms, clamp 200-800ms, ease-in-out-quad):
        // SỬA (02/10/2026, Giang: "loại bỏ animation, gán giá trị scroll thẳng") — `computePlaylistCenterScrollPlan()`
        // (trả start/distance/duration cho animation) -> `computePlaylistCenterScrollTop()` chỉ trả scrollTop đích;
        // XOÁ `easeInOutQuad()` (hết nơi dùng). Phép tính vị trí GIỮ NGUYÊN.
        /** Tính scrollTop đưa `node` vào giữa khung `scrollEl` (kẹp trong [0, maxScroll]). Hàm THUẦN (chỉ đo hộp của 2
         * phần tử nhận vào — không đụng phần ruột item đang bị content-visibility bỏ qua).
         * @param {HTMLElement} scrollEl @param {HTMLElement} node @returns {number} */
        function computePlaylistCenterScrollTop(scrollEl, node) {
            const containerRect = scrollEl.getBoundingClientRect();
            const nodeRect = node.getBoundingClientRect();
            const nodeOffsetTop = (nodeRect.top - containerRect.top) + scrollEl.scrollTop;
            const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
            return Math.max(0, Math.min(maxScroll, nodeOffsetTop - (scrollEl.clientHeight / 2) + (nodeRect.height / 2)));
        }
        /** Đặt scrollTop của khung cuộn. Hàm LÁ. */
        function setPlaylistScrollTop(scrollEl, top) {
            scrollEl.scrollTop = top;
        }

        /** MỚI (29/07/2026, yêu cầu Giang mục 2 — "đổi song <-> video playlist thì scroll = 0
         * ngay") — đổi Nguồn (switchSource(), event/workflow/
         * playlist.js) dựng lại TOÀN BỘ danh sách khác hẳn nhau (renderPlaylistDiff() với
         * `renderOrder` hoàn toàn mới) — `scrollTop` CŨ (từ danh sách trước đó) không còn ý nghĩa
         * gì với danh sách MỚI, giữ nguyên trông như "cuộn dở/lệch" ngay khi vừa đổi Nguồn. Đây là
         * đổi TOÀN BỘ nội dung (không phải nhảy tới 1 bài cụ thể), nên về thẳng 0 TỨC THÌ (không
         * animation, không cần offset/tính toán gì) — KHÔNG dùng chung 2 hàm cuộn-tới-current ở
         * trên (2 hàm đó phục vụ mục đích khác: nhắm tới ĐÚNG 1 dòng `currentKey`). */
        function resetPlaylistScrollTop() {
            playlistContainer.parentElement.scrollTop = 0;
        }

        // DỜI (02/10/2026, Giang chốt quy tắc cuộn khi đổi từ khoá) — `applySearchQuery()` (core tự appState.get()/set()
        // + gọi 2 Workflow — nợ Rule 2/3b đã ghi nhận) dời hẳn sang event/workflow/playlist-order.js
        // (`workflowPlaylistOrder.applySearchQuery()`), kèm bước cuộn mới theo quy tắc A (xem `isPlayingMediaListed()` dưới).

        /** MỚI (02/10/2026, Giang chốt phương án A — `content-visibility: auto` cho item Playlist, assets/css/layout-nav.css)
         * — đo chiều cao VÙNG NỘI DUNG (content-box: trừ padding + border) của 1 node item, để làm
         * `contain-intrinsic-block-size` cho mọi item đang bị trình duyệt bỏ qua render (ngoài khung nhìn). Phải là
         * content-box vì `contain-intrinsic-*` là kích thước NỘI DUNG — padding/border trình duyệt tự cộng thêm.
         * Tạm ép `content-visibility: visible` (node có thể đang bị bỏ qua -> cao bằng giá trị ước lượng, không phải thật)
         * + `transform: none` (`active:scale-[0.98]` lúc đang nhấn làm getBoundingClientRect co lại) rồi trả lại inline
         * style cũ NGAY — 1 lượt layout cưỡng bức, không để lại dấu vết gì trên node.
         * Hàm THUẦN: nhận node qua tham số, trả số px (0 nếu không đo được — node null/đang `display:none`).
         * @param {HTMLElement|null} node @returns {number} */
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

        /** MỚI (02/10/2026) — ghi biến CSS `--playlist-item-block-size` lên #playlist-container (assets/css/layout-nav.css
         * đọc làm `contain-intrinsic-block-size`). Giữ số lẻ (tile Grid `aspect-square` thường cao lẻ px) — làm tròn sẽ lệch
         * tích luỹ theo số item phía trên, làm scroll-to-current trượt khỏi đúng tâm. Hàm THUẦN.
         * @param {HTMLElement} containerEl @param {number} px */
        function applyPlaylistItemBlockSize(containerEl, px) {
            if (!containerEl) return; // guard
            containerEl.style.setProperty('--playlist-item-block-size', `${px}px`);
        }

        /** MỚI (02/10/2026) — LOẠI media đang phát, suy từ 2 cờ player mode (`isVideoPlayerMode`/`isPhotoPlayerMode`; không
         * cờ nào bật = Song). Chọn GIÁ TRỊ, không rẽ tiến trình. Dùng để so với Nguồn đang xem: Song/Video/Photo sinh key
         * theo CÙNG kiểu slug tên file nên trùng key giữa 3 Nguồn là có thật — chỉ so `currentKey` là chưa đủ (xem
         * switchSource(), event/workflow/playlist.js). Hàm THUẦN.
         * @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode @returns {'song'|'video'|'photo'} */
        function resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode) {
            return isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
        }

        /** MỚI (02/10/2026, Giang chốt quy tắc A — cuộn khi đổi từ khoá Search / đổi Nguồn / đổi folder Scope) — media ĐANG
         * PHÁT có nằm trong danh sách đang hiển thị không: khớp key VÀ khớp loại media đang phát (`resolvePlayingMediaType()`,
         * nơi gọi tự tính trước) với Nguồn đang xem. Hàm THUẦN — nhận đủ qua tham số, trả boolean thật.
         * @param {string|null} currentKey @param {'song'|'video'|'photo'} playingMediaType
         * @param {'song'|'video'|'photo'} activeMediaSource @param {string[]} renderOrder @returns {boolean} */
        function isPlayingMediaListed(currentKey, playingMediaType, activeMediaSource, renderOrder) {
            if (currentKey == null) return false; // guard — chưa phát gì
            return playingMediaType === activeMediaSource && renderOrder.includes(currentKey);
        }
