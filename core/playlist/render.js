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

        function songActionMenuButtonHtml(key, onDarkBg) {
            // FIX (11/07/2026, phản hồi Giang — "thiếu dấu ba chấm như trước đây mỗi song item"):
            // NGUYÊN NHÂN THẬT (đợt trước đoán SAI là do màu/nền — Giang xác nhận không liên quan):
            // 2 chỗ GỌI hàm này (dòng ~104/118 bên dưới) bọc nút trong
            // `opacity-0 group-hover:opacity-100` — CHỈ hiện khi HOVER CHUỘT THẬT. Cảm ứng KHÔNG
            // CÓ hover thật — trước đây WebKit "giả lập" hover khi chạm (đúng bug "hover kẹt" đã
            // sửa ở index.html qua `tailwind.config.future.hoverOnlyWhenSupported`), nên NÚT NÀY
            // TỪNG hiện ra được là NHỜ chính cái bug đó — sửa xong bug hover kẹt (đúng), tác dụng
            // phụ là nút này mất luôn khả năng hiện trên cảm ứng (chưa từng có cách hiện HỢP LỆ).
            // Đã xoá `opacity-0 group-hover:opacity-100` ở 2 nơi gọi — LUÔN hiện, không phụ thuộc
            // hover.
            // SỬA (09/09/2026, Giang yêu cầu "bỏ vòng tròn bao quanh, sửa màu") — bỏ hẳn nền tròn mờ
            // riêng của CHÍNH nút này (`rounded-full bg-black/30`) — Grid view vẫn có vòng tròn
            // riêng BỌC NGOÀI (`bg-black/40`, event/workflow/playlist-render.js dòng ~79, KHÔNG phải
            // ở đây) nên vẫn đủ tương phản trên ảnh bìa bất kỳ. Màu icon giờ tách theo `onDarkBg`
            // (tham số MỚI — nơi gọi tự truyền `appState.get('isGridView')`): List view (false) nút
            // nằm trực tiếp trên nền sáng -> icon tối; Grid view (true) nút nằm trong vòng tròn tối
            // ở trên -> icon vẫn phải sáng.
            const colorCls = onDarkBg ? 'text-white/70 hover:text-white' : ''; // trên nền tối cố định (vòng tròn đen đè ảnh bìa) — không theo theme
            const themeKeyAttr = onDarkBg ? '' : ' data-uitk="iconBtnMuted"'; // SỬA 21/09/2026 — nền theo theme: màu icon/hover là key theme, không còn text-slate-400/700 cứng
            return `<button data-action="menu" data-key="${key}" class="p-2 rounded-full transition-colors z-10 ${colorCls}"${themeKeyAttr} title="${t('playlistView.songMenu.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>
            </button>`;
        }

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
            imgEl.addEventListener('error', function onCoverError() {
                this.removeEventListener('error', onCoverError);
                if (this.src !== DEFAULT_VINYL) this.src = DEFAULT_VINYL;
            });
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
            if (node && node._coverObjectUrl) { try { URL.revokeObjectURL(node._coverObjectUrl); } catch (e) {} node._coverObjectUrl = null; }
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
         * @param {string|null} currentKey
         * @param {string[]} displayOrder
         */
        function updatePlayButtonPlayingState(currentKey, displayOrder) {
            if (!btnPlaylistEmptyPlay) return;
            const isPlaying = currentKey != null && displayOrder.includes(currentKey);
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
            updatePlaylistLoading(done, total);
            el.classList.remove('hidden');
            // ép reflow trước khi tăng opacity để transition fade-in chạy mượt
            void el.offsetWidth;
            el.style.opacity = '1';
        }
        function updatePlaylistLoading(done, total) {
            const txt = document.getElementById('playlist-loading-text');
            if (txt) txt.textContent = total ? tFormat('playlistView.loading.withCount', { done, total }) : t('playlistView.loading.generic');
        }
        function hidePlaylistLoading() {
            const el = document.getElementById('playlist-loading-list');
            if (!el || el.classList.contains('hidden')) return;
            el.style.opacity = '0';
            taskManager.once(() => el.classList.add('hidden'), 320); // khớp transition-opacity duration-300
        }

        /** Cập nhật trạng thái rỗng/không-kết-quả thuần từ dữ liệu (không liên quan hàng đợi phát).
         * SỬA — `liveKeys()` (core/playlist/order.js) VỪA sửa Rule 2 (nhận tham số thay vì tự
         * appState.get()), cập nhật lời gọi ĐỦ tham số để không vỡ. */
        function updateEmptyState() {
            const totalSongs = liveKeys(appState.get('playlistOrder'), appState.get('confirmedBrokenKeys')).length;
            const emptyEl = playlistEmpty;
            const searchEmptyEl = document.getElementById('playlist-search-empty');
            // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — 2 chuỗi rỗng/không-
            // kết-quả trước đây LUÔN nói "song" kể cả khi đang browse Nguồn Video — đổi chữ theo
            // `activeMediaSource` mỗi lần hàm này chạy (rẻ, chỉ 2 dòng textContent).
            // MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh 'photo' vào cùng cơ chế.
            const mediaSource = appState.get('activeMediaSource');
            const emptyTextEl = emptyEl.querySelector('p');
            if (emptyTextEl) emptyTextEl.textContent = t(mediaSource === 'video' ? 'playlistView.empty.noVideos' : mediaSource === 'photo' ? 'playlistView.empty.noPhotos' : 'playlistView.empty.noSongs');
            if (searchEmptyEl) {
                const searchTextEl = searchEmptyEl.querySelector('p');
                if (searchTextEl) searchTextEl.textContent = t(mediaSource === 'video' ? 'playlistView.empty.noSearchResultsVideo' : mediaSource === 'photo' ? 'playlistView.empty.noSearchResultsPhoto' : 'playlistView.empty.noSearchResults');
            }
            // Khi đã có dữ liệu thật để dựng list (renderOrder > 0) thì lớp "đang nạp" không còn cần
            // -> fade out (an toàn nếu nó đang hiện; no-op nếu đã ẩn).
            if (appState.get('renderOrder').length > 0) hidePlaylistLoading();
            if (totalSongs === 0) {
                emptyEl.classList.remove('hidden');
                if (searchEmptyEl) searchEmptyEl.classList.add('hidden');
            } else if (appState.get('renderOrder').length === 0) {
                emptyEl.classList.add('hidden');
                if (searchEmptyEl) searchEmptyEl.classList.remove('hidden');
            } else {
                emptyEl.classList.add('hidden');
                if (searchEmptyEl) searchEmptyEl.classList.add('hidden');
            }
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
        function scrollToSongIfPending() {
            const isEditingSubtitle = localStorage.getItem('sav_editingSubtitle') === 'true';
            if (!isEditingSubtitle) return; // cờ false (hoặc chưa từng có) -> không làm gì cả, đúng yêu cầu Giang
            const key = localStorage.getItem('sav_scrollToSongKey');
            localStorage.setItem('sav_editingSubtitle', 'false'); // đặt lại false NGAY — chỉ dùng 1 lần
            localStorage.removeItem('sav_scrollToSongKey'); // xoá hẳn key bài hát
            if (!key) return;
            requestAnimationFrame(() => {
                const node = appState.get('domNodesByKey').get(key);
                if (!node || !node.isConnected) return; // không tìm thấy (bài có thể đang ở scope/folder khác lúc quay lại) -> bỏ qua im lặng
                node.scrollIntoView({ behavior: 'smooth', block: 'center' }); // CHỈ cuộn — KHÔNG thêm viền sáng/nháy gì (yêu cầu Giang)
            });
        }

        /** MỚI (fix/tính năng, phản hồi Giang 29/07/2026, "scroll tức thì trước khi ra vào
         * playlist ngay tại vị trí song/video là current") — cuộn TỨC THÌ (KHÔNG animation, khác
         * scrollToSongIfPending() ngay trên — hàm đó CỐ Ý smooth vì dùng lúc quay về từ trang
         * KHÁC hẳn, subtitle-editor.html) tới đúng dòng của `currentKey`, gọi từ CẢ 2 hướng
         * chuyển màn Playlist<->Visualizer (switchToVisualizer()/forceBackToPlaylistUI(), core/
         * player-controls.js) — LUÔN gọi lúc Playlist đang bị `transform` dịch ra ngoài khung nhìn
         * (class 'playlist-hidden', KHÔNG phải display:none — vẫn scroll được bình thường dù đang
         * lệch khỏi khung nhìn), nên cuộn xong TRƯỚC khi slide-in/slide-out kịp lộ ra, đúng nghĩa
         * "tức thì" — không phải cuộn nhanh, mà là đã ở ĐÚNG vị trí từ trước khi người dùng kịp
         * thấy. KHÔNG truyền `behavior` (mặc định 'auto' — cuộn ngay, không animation, khác hẳn
         * 'smooth' phía trên).
         * Guard 3 lớp (giống hệt scrollToSongIfPending()): `currentKey` rỗng (chưa phát gì) ->
         * bỏ qua; key không có trong `domNodesByKey` (đang khác scope/folder/kết quả tìm kiếm) ->
         * bỏ qua êm; node có nhưng KHÔNG còn gắn DOM thật (isConnected=false, hiếm, lệch nhịp
         * render) -> bỏ qua. */
        function scrollToCurrentKeyInstant() {
            const key = appState.get('currentKey');
            if (!key) return;
            const node = appState.get('domNodesByKey').get(key);
            if (!node || !node.isConnected) return;
            node.scrollIntoView({ block: 'center' });
        }

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
        function scrollToCurrentKeyAnimated() {
            if (appStack.classList.contains('playlist-hidden')) return; // đang ở Visualizer -> không cuộn gì cả
            const key = appState.get('currentKey');
            if (!key) return;
            const node = appState.get('domNodesByKey').get(key);
            if (!node || !node.isConnected) return;

            const scrollEl = playlistContainer.parentElement; // div bọc ngoài "overflow-y-auto" thật sự cuộn (components/playlist-view.js) — #playlist-container chỉ chứa nội dung, không tự cuộn
            const containerRect = scrollEl.getBoundingClientRect();
            const nodeRect = node.getBoundingClientRect();
            const nodeOffsetTop = (nodeRect.top - containerRect.top) + scrollEl.scrollTop;
            const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
            const targetScrollTop = Math.max(0, Math.min(maxScroll, nodeOffsetTop - (scrollEl.clientHeight / 2) + (nodeRect.height / 2)));

            const startScrollTop = scrollEl.scrollTop;
            const distance = targetScrollTop - startScrollTop;
            if (Math.abs(distance) < 1) return; // đã sẵn đúng vị trí -> khỏi animate

            const PX_PER_MS = 2.2; // tốc độ cuộn cố định -> thời lượng tự tỉ lệ theo khoảng cách thật, KHÔNG hard-code 1 mốc chung cho mọi độ dài playlist
            const duration = Math.max(200, Math.min(800, Math.abs(distance) / PX_PER_MS));
            const startTime = performance.now();
            function step(now) {
                const t = Math.min(1, (now - startTime) / duration);
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out-quad
                scrollEl.scrollTop = startScrollTop + distance * eased;
                if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
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

        /** MỚI (02/10/2026, Giang chốt quy tắc A — cuộn khi đổi từ khoá Search / đổi Nguồn) — media ĐANG PHÁT có nằm trong
         * danh sách đang hiển thị không. KHÔNG chỉ so `currentKey` trong `renderOrder`: Song/Video/Photo sinh key theo CÙNG
         * kiểu slug tên file (trùng key giữa 3 Nguồn là có thật — xem switchSource(), event/workflow/playlist.js), nên còn
         * phải khớp LOẠI media đang phát với Nguồn đang xem (đang phát video thì 1 ảnh trùng tên trong Nguồn Photo KHÔNG
         * được coi là current). Loại đang phát suy từ 2 cờ player mode (chọn GIÁ TRỊ, không rẽ tiến trình).
         * Hàm THUẦN — nhận đủ qua tham số, trả boolean thật.
         * @param {string|null} currentKey @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode
         * @param {'song'|'video'|'photo'} activeMediaSource @param {string[]} renderOrder @returns {boolean} */
        function isPlayingMediaListed(currentKey, isVideoPlayerMode, isPhotoPlayerMode, activeMediaSource, renderOrder) {
            if (currentKey == null) return false; // guard — chưa phát gì
            const playingMediaType = isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
            return playingMediaType === activeMediaSource && renderOrder.includes(currentKey);
        }
