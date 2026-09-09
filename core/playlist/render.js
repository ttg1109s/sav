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
 * trong cụm vừa dời (`updateEmptyState`/3 hàm scroll/`applySearchQuery` — nợ kỹ thuật RIÊNG, chưa
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
            const colorCls = onDarkBg ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-700';
            return `<button data-action="menu" data-key="${key}" class="p-2 rounded-full transition-colors z-10 ${colorCls}" title="${t('playlistView.songMenu.title')}">
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

        /**
         * Ver 12 "Multi Media" (plan-v12-multimedia.md mục 4.b1, "Chọn nhiều") — chỉ báo trực quan
         * đã chọn/chưa chọn. KHÔNG phải hit-target riêng (click cả dòng đã đủ để toggle, xem router
         * 'playlist.item.playClick' — VirtualMachineState rẽ theo selectionMode) — chỉ vẽ.
         *
         * GHI CHÚ (ngoại lệ có chủ đích, không phải sơ suất): buildSongNode() là hàm core DI SẢN
         * (trước ver 12), đã tự appState.get() nhiều field khác (currentKey, isGridView...) theo
         * đúng quy ước CŨ ở service/state.js — mở rộng thêm 2 field mới (selectionMode/
         * selectedMediaKeys) theo ĐÚNG pattern đã có sẵn của chính hàm này, KHÔNG tính là "viết mới
         * theo Rule 2" (core-function-conventions.md — rule đó nhắm hàm MỚI hoặc bị viết lại hẳn,
         * không nhắm việc bổ sung tối thiểu vào 1 hàm di sản theo đúng quy ước cũ nó đang dùng).
         * Rewrite hẳn buildSongNode()/renderPlaylistFull()/renderPlaylistDiff() sang nhận tham số
         * theo Rule 2 là 1 refactor lớn hơn nhiều so với phạm vi tính năng "chọn nhiều" — để dành
         * cho đợt dọn nợ kỹ thuật riêng (xem core-legacy-audit.md).
         */
        function selectionIndicatorHtml(isSelected) {
            return `<div class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-sky-500 border-sky-500' : 'bg-black/30 border-white/30'}">${isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</div>`;
        }

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
         * hàm này thay thế. */
        function updatePlayButtonPlayingState() {
            if (!btnPlaylistEmptyPlay) return;
            const currentKey = appState.get('currentKey');
            const isPlaying = currentKey != null && appState.get('displayOrder').includes(currentKey);
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

        /** Ô tìm kiếm thay đổi: CHỈ lọc lại danh sách hiển thị (renderOrder) — KHÔNG đụng hàng đợi phát.
         * SỬA (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ") — `recomputeRenderOrder()`/
         * `renderPlaylistDiff()` ĐÃ DỜI hẳn sang event/workflow/playlist-order.js
         * (`workflowPlaylistOrder`)/event/workflow/playlist-render.js (`workflowPlaylistRender`) —
         * cả 2 đều cần gọi hàm khác (`liveKeys`/`songMatchesQuery`/`sortKeysByMode`/`buildSongNode`,
         * Rule 3a cấm core gọi core). Hàm NÀY (`applySearchQuery`) VẪN nằm trong core/playlist/
         * render.js, tự `appState.get()`/`.set()` sẵn từ trước (nợ kỹ thuật riêng — file này còn
         * `updateEmptyState`/3 hàm scroll tự đọc appState tương tự) — CHƯA relocate cả hàm trong
         * đợt này (phạm vi Giang xác nhận là 2 hàm/cụm cụ thể, không phải toàn bộ render.js). Gọi
         * cả 2 method Workflow từ ĐÂY về hình thức là Core gọi Workflow — KHÔNG bị Rule 3a cấm theo
         * đúng câu chữ (rule đó chỉ nói Core-gọi-Core), nhưng ngược hướng "Core thi hành/Workflow
         * chuẩn bị" (Rule 3b) — ghi nhận là nợ CÒN LẠI, cùng loại với nợ DB-read đã biết của
         * `loader.js`, chỉ dứt điểm được nếu relocate NGUYÊN hàm này sang workflow ở đợt sau. */
        function applySearchQuery(raw) {
            appState.set('searchQuery', normalizeSongName(raw));
            workflowPlaylistOrder.recomputeRenderOrder(); // event/workflow/playlist-order.js (dời từ core/playlist/order.js) — tự đọc searchQuery vừa set ở trên qua appState
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js (dời từ core/playlist/render.js) — FIX kèm theo: chỉ ẨN key bị Search lọc còn tồn tại trong playlistOrder, không rebuild
        }
