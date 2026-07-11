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
 */

        function songActionMenuButtonHtml(key) {
            // FIX (11/07/2026, phản hồi Giang — "thiếu dấu ba chấm như trước đây mỗi song item"):
            // ĐÃ RÀ SOÁT — file này KHÔNG bị đụng ở bất kỳ đợt sửa Subtitle Editor nào gần đây, HTML
            // sinh ra vẫn y hệt cũ. Nghi vấn nhiều khả năng nhất: 3 chấm màu `text-slate-400` (xám)
            // KHÔNG có nền riêng, dễ chìm mất trên ảnh nền bìa sáng/nhiều chi tiết phía sau (đúng
            // như ảnh Giang gửi — nền là ảnh chụp người, rất sáng) — dù đây là suy đoán, chưa chắc
            // đúng NGUYÊN NHÂN gốc. Thêm nền tròn mờ CỐ ĐỊNH phía sau icon để LUÔN thấy được bất kể
            // nền phía sau là gì — không có rủi ro nếu suy đoán sai, chỉ tăng độ tương phản.
            return `<button data-action="menu" data-key="${key}" class="p-2 rounded-full bg-black/30 text-slate-200 hover:text-white hover:bg-black/50 transition-colors z-10" title="${t('playlistView.songMenu.title')}">
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
         * selectedSongKeys) theo ĐÚNG pattern đã có sẵn của chính hàm này, KHÔNG tính là "viết mới
         * theo Rule 2" (core-function-conventions.md — rule đó nhắm hàm MỚI hoặc bị viết lại hẳn,
         * không nhắm việc bổ sung tối thiểu vào 1 hàm di sản theo đúng quy ước cũ nó đang dùng).
         * Rewrite hẳn buildSongNode()/renderPlaylistFull()/renderPlaylistDiff() sang nhận tham số
         * theo Rule 2 là 1 refactor lớn hơn nhiều so với phạm vi tính năng "chọn nhiều" — để dành
         * cho đợt dọn nợ kỹ thuật riêng (xem core-legacy-audit.md).
         */
        function selectionIndicatorHtml(isSelected) {
            return `<div class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-sky-500 border-sky-500' : 'bg-black/30 border-white/30'}">${isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</div>`;
        }

        function buildSongNode(key) {
            const cached = appState.get('playlistCache').get(key);
            const title = cached ? cached.tag.title : key;
            const artist = cached ? cached.tag.artist : '';
            // Chỉ Blob cover (record.cover) mới cần tạo + theo dõi object URL để revoke sau; ảnh
            // DEFAULT_VINYL là data: URI tĩnh, không phải object URL — node._coverObjectUrl giữ
            // null cho trường hợp này để revokeNodeCoverUrl() không vô tình revoke nhầm data: URI.
            const hasRealCover = !!(cached && cached.cover);
            const coverUrl = hasRealCover ? URL.createObjectURL(cached.cover) : DEFAULT_VINYL;

            const isPlaying = (key === appState.get('currentKey')); const isActuallyPlaying = isPlaying && !audioPlayer.paused;
            const eqIconHtml = isActuallyPlaying ? `<div class="flex items-end gap-[2px] h-3 w-3"><div class="w-[3px] bg-sky-400 eq-1"></div><div class="w-[3px] bg-sky-400 eq-2"></div><div class="w-[3px] bg-sky-400 eq-3"></div></div>` : (isPlaying ? `<div class="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_5px_rgba(14,165,233,0.8)]"></div>` : '');
            const selectionMode = appState.get('selectionMode');
            const isSelected = selectionMode && appState.get('selectedSongKeys').has(key);
            const menuBtnHtml = selectionMode ? '' : songActionMenuButtonHtml(key); // ẩn menu 3 chấm khi đang chọn nhiều, tránh 2 mục tiêu bấm cạnh tranh nhau

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
                        <div class="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full">${menuBtnHtml}</div>
                    </div>
                    <h3 class="text-white text-[15px] font-semibold leading-tight line-clamp-1 px-1">${title}</h3>
                    <p class="text-slate-400 text-[13px] font-medium line-clamp-1 px-1 mt-0.5">${artist}</p>`;
            } else {
                wrapper.className = `flex items-center gap-4 px-5 py-3 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer w-full group border-b border-white/5 ${isSelected ? 'bg-sky-500/10' : ''}`;
                wrapper.dataset.role = 'play-item';
                wrapper.innerHTML = `
                    ${selectionMode ? selectionIndicatorHtml(isSelected) : ''}
                    <img src="${coverUrl}" class="w-12 h-12 rounded-lg flex-shrink-0 object-cover shadow-md">
                    <div class="flex-grow flex flex-col justify-center overflow-hidden gap-0.5">
                        <div class="flex items-center gap-2"><h3 class="text-[16px] leading-tight font-semibold truncate ${isPlaying ? 'text-sky-300' : 'text-slate-100'}">${title}</h3>${isPlaying ? eqIconHtml : ''}</div>
                        <p class="text-[13px] text-slate-400 truncate font-medium">${artist}</p>
                    </div>
                    <div class="flex opacity-0 group-hover:opacity-100 transition-opacity">${menuBtnHtml}</div>`;
            }
            attachCoverFallback(wrapper.querySelector('img'));
            return wrapper;
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

        /** Cập nhật trạng thái rỗng/không-kết-quả thuần từ dữ liệu (không liên quan hàng đợi phát). */
        function updateEmptyState() {
            const totalSongs = liveKeys().length;
            const emptyEl = playlistEmpty;
            const searchEmptyEl = document.getElementById('playlist-search-empty');
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

        function renderPlaylistFull() {
            // Revoke TOÀN BỘ object URL cover của các node cũ TRƯỚC khi xoá — renderPlaylistFull
            // dựng lại từ đầu (layout grid/list đổi, hoặc lệch số lượng node), mọi node cũ chắc
            // chắn bị bỏ, không có ngoại lệ nào cần giữ lại.
            appState.get('domNodesByKey').forEach(revokeNodeCoverUrl);
            playlistContainer.innerHTML = '';
            appState.mutate('domNodesByKey', m => m.clear());
            appState.get('renderOrder').forEach((key) => {
                const node = buildSongNode(key);
                appState.mutate('domNodesByKey', m => m.set(key, node));
                playlistContainer.appendChild(node);
            });
            if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); else btnReturnVisual.classList.add('hidden');
            updateEmptyState();
        }

        function renderPlaylistDiff() {
            if (playlistContainer.children.length !== appState.get('domNodesByKey').size) {
                renderPlaylistFull();
                return;
            }

            const renderKeySet = new Set(appState.get('renderOrder'));

            for (const [key, node] of Array.from(appState.get('domNodesByKey').entries())) {
                if (!renderKeySet.has(key)) {
                    revokeNodeCoverUrl(node); // bài đã bị lọc khỏi danh sách hiển thị (xoá/tìm kiếm) -> node này bỏ vĩnh viễn
                    node.remove();
                    appState.mutate('domNodesByKey', m => m.delete(key));
                }
            }

            let prevNode = null;
            for (const key of appState.get('renderOrder')) {
                let node = appState.get('domNodesByKey').get(key);
                if (!node) {
                    node = buildSongNode(key);
                    appState.mutate('domNodesByKey', m => m.set(key, node));
                }
                const expectedNextSibling = prevNode ? prevNode.nextSibling : playlistContainer.firstChild;
                if (expectedNextSibling !== node) {
                    playlistContainer.insertBefore(node, expectedNextSibling);
                }
                prevNode = node;
            }

            if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); else btnReturnVisual.classList.add('hidden');
            updateEmptyState();
        }

        function refreshSongNode(key) {
            const oldNode = appState.get('domNodesByKey').get(key);
            if (!oldNode) return;
            const newNode = buildSongNode(key);
            revokeNodeCoverUrl(oldNode); // node cũ bị thay hẳn bằng node mới (cover mới tạo riêng ở buildSongNode trên) -> revoke URL cũ ngay
            oldNode.replaceWith(newNode);
            appState.mutate('domNodesByKey', m => m.set(key, newNode));
        }

        /** Ô tìm kiếm thay đổi: CHỈ lọc lại danh sách hiển thị (renderOrder) — KHÔNG đụng hàng đợi phát. */
        function applySearchQuery(raw) {
            appState.set('searchQuery', normalizeSongName(raw));
            recomputeRenderOrder();
            renderPlaylistDiff();
        }
