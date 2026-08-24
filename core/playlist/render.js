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
            // NGUYÊN NHÂN THẬT (đợt trước đoán SAI là do màu/nền — Giang xác nhận không liên quan):
            // 2 chỗ GỌI hàm này (dòng ~104/118 bên dưới) bọc nút trong
            // `opacity-0 group-hover:opacity-100` — CHỈ hiện khi HOVER CHUỘT THẬT. Cảm ứng KHÔNG
            // CÓ hover thật — trước đây WebKit "giả lập" hover khi chạm (đúng bug "hover kẹt" đã
            // sửa ở index.html qua `tailwind.config.future.hoverOnlyWhenSupported`), nên NÚT NÀY
            // TỪNG hiện ra được là NHỜ chính cái bug đó — sửa xong bug hover kẹt (đúng), tác dụng
            // phụ là nút này mất luôn khả năng hiện trên cảm ứng (chưa từng có cách hiện HỢP LỆ).
            // Đã xoá `opacity-0 group-hover:opacity-100` ở 2 nơi gọi — LUÔN hiện, không phụ thuộc
            // hover (nền tròn mờ thêm ở đây chỉ là tăng tương phản, không phải fix chính).
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
            // MỚI (phản hồi Giang, mục 8 — "thêm duration tại playlist của cả hai song và video") —
            // `cached.duration` (giây) đã có sẵn cho CẢ Song (core/playlist/loader.js::
            // scanValidSongsFromDB()) lẫn Video (buildVideoPlaylistCache()) — chỉ cần hiển thị,
            // KHÔNG cần đọc thêm gì. Tái dùng NGUYÊN formatTime() (core/playlist/state.js, đã dùng
            // ở tab "Chi tiết") — formatTime(undefined) tự trả "0:00", an toàn khi cached rỗng.
            // SỬA (phản hồi Giang, mục 3 — "duration phải ở row cùng với artist, video ở hàng dưới
            // tên") — bỏ hẳn vị trí RIÊNG (badge góc ảnh ở grid / cột lề phải ở list), GỘP vào
            // đúng dòng thứ 2 (dòng artist) — Song: "Artist · 3:45"; Video: artist rỗng nên dòng
            // này chỉ còn "3:45" (đúng "hàng dưới của tên" Giang yêu cầu, dùng CHUNG 1 dòng, không
            // cần 2 dòng riêng). Dùng CHUNG 1 biến cho cả list lẫn grid (2 nơi có cùng ý nghĩa "dòng
            // phụ dưới tên").
            // MỞ RỘNG (hợp nhất Photo vào Playlist, CHỐT Giang "dùng hẳn UI Song/Video, chỉ thay nội
            // dung") — TRƯỚC ĐÂY Photo không có duration nên dòng phụ này hiện ĐỘ PHÂN GIẢI (width×
            // height) thay vì formatTime(). SỬA (Giang yêu cầu — "thay duration cho w&h") — Photo
            // giờ có `duration` THẬT (tính lúc upload — event/workflow/file-manager-photo.js::
            // computePhotoDuration()), dòng phụ quay lại dùng formatTime() giống hệt Song/Video,
            // KHÔNG còn nhánh riêng nào cho Photo nữa (width/height vẫn giữ trong playlistCache —
            // core/playlist/loader.js — cho modal Chi tiết dùng, chỉ không còn hiện ở dòng này).
            const durationLabel = formatTime(cached ? cached.duration : 0);
            const secondLineHtml = artist
                ? `${artist} <span class="opacity-50">·</span> ${durationLabel}`
                : durationLabel;
            // Chỉ Blob cover (record.cover) mới cần tạo + theo dõi object URL để revoke sau; ảnh
            // DEFAULT_VINYL là data: URI tĩnh, không phải object URL — node._coverObjectUrl giữ
            // null cho trường hợp này để revokeNodeCoverUrl() không vô tình revoke nhầm data: URI.
            // Photo: `cached.cover` LÀ thumbBlob (fallback blob gốc nếu record cũ thiếu thumbBlob) —
            // xem buildPhotoPlaylistCache() — dùng NGUYÊN cơ chế object URL sẵn có, không cần đổi gì.
            const hasRealCover = !!(cached && cached.cover);
            const coverUrl = hasRealCover ? URL.createObjectURL(cached.cover) : DEFAULT_VINYL;

            const isPlaying = (key === appState.get('currentKey'));
            // SỬA (fix bar animation, phản hồi Giang 29/07/2026, "làm nốt") — TRƯỚC ĐÂY hard-code
            // `!audioPlayer.paused`, vô nghĩa với dòng Video (Video Player mode dùng `bgVideoElement`
            // làm nguồn phát THẬT, `audioPlayer` không chạy — xem docstring đầu event/workflow/
            // video-player.js) nên dòng Video LUÔN rơi vào nhánh "đã chọn nhưng coi như đang tạm
            // dừng" (chấm xanh, KHÔNG BAO GIỜ có bar animation) dù đang phát thật. Đọc ĐÚNG element
            // theo `cached.mediaType` — GIỮ NGUYÊN 100% hành vi cũ cho Song (audioPlayer.paused).
            const isActuallyPlaying = isPlaying && !((cached && cached.mediaType === 'video') ? bgVideoElement.paused : audioPlayer.paused);
            const eqIconHtml = isActuallyPlaying ? `<div class="flex items-end gap-[2px] h-3 w-3"><div class="w-[3px] bg-sky-400 eq-1"></div><div class="w-[3px] bg-sky-400 eq-2"></div><div class="w-[3px] bg-sky-400 eq-3"></div></div>` : (isPlaying ? `<div class="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_5px_rgba(14,165,233,0.8)]"></div>` : '');
            const selectionMode = appState.get('selectionMode');
            const isSelected = selectionMode && appState.get('selectedSongKeys').has(key);
            // CHỐT Giang (giữ nguyên nút "..." cho Photo — không ẩn nữa, giờ "Thêm vào thư mục" đã
            // hoạt động thật cho Photo qua Folder type='photo' MỚI, xem core/file-manager/folder.js).
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
                        <div class="absolute top-2 right-2 flex bg-black/40 rounded-full">${menuBtnHtml}</div>
                    </div>
                    <h3 class="text-white text-[15px] font-semibold leading-tight line-clamp-1 px-1">${title}</h3>
                    <p class="text-slate-400 text-[13px] font-medium line-clamp-1 px-1 mt-0.5">${secondLineHtml}</p>`;
            } else {
                wrapper.className = `flex items-center gap-4 px-5 py-3 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer w-full group border-b border-white/5 ${isSelected ? 'bg-sky-500/10' : ''}`;
                wrapper.dataset.role = 'play-item';
                wrapper.innerHTML = `
                    ${selectionMode ? selectionIndicatorHtml(isSelected) : ''}
                    <img src="${coverUrl}" class="w-12 h-12 rounded-lg flex-shrink-0 object-cover shadow-md">
                    <div class="flex-grow flex flex-col justify-center overflow-hidden gap-0.5">
                        <div class="flex items-center gap-2"><h3 class="text-[16px] leading-tight font-semibold truncate ${isPlaying ? 'text-sky-300' : 'text-slate-100'}">${title}</h3>${isPlaying ? eqIconHtml : ''}</div>
                        <p class="text-[13px] text-slate-400 truncate font-medium">${secondLineHtml}</p>
                    </div>
                    <div class="flex">${menuBtnHtml}</div>`;
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

        function renderPlaylistFull() {
            const _t0 = performance.now(); // MỚI (chẩn đoán boot chậm, phản hồi Giang) — đo thời gian THẬT, không đổi logic
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
            console.log(`writer: "renderPlaylistFull", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms cho ${appState.get('renderOrder').length} item (dựng lại TOÀN BỘ DOM)"`);
        }

        function renderPlaylistDiff() {
            const _t0 = performance.now(); // MỚI (chẩn đoán boot chậm, phản hồi Giang) — đo thời gian THẬT, không đổi logic
            if (playlistContainer.children.length !== appState.get('domNodesByKey').size) {
                renderPlaylistFull(); // hàm này TỰ log riêng — không log trùng ở đây
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
            let _builtCount = 0; // MỚI (chẩn đoán) — đếm số node PHẢI DỰNG MỚI (buildSongNode) trong lượt diff này
            for (const key of appState.get('renderOrder')) {
                let node = appState.get('domNodesByKey').get(key);
                if (!node) {
                    node = buildSongNode(key);
                    _builtCount++;
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
            console.log(`writer: "renderPlaylistDiff", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms — dựng mới ${_builtCount}/${appState.get('renderOrder').length} node"`);
        }

        function refreshSongNode(key) {
            const oldNode = appState.get('domNodesByKey').get(key);
            if (!oldNode) return;
            const newNode = buildSongNode(key);
            revokeNodeCoverUrl(oldNode); // node cũ bị thay hẳn bằng node mới (cover mới tạo riêng ở buildSongNode trên) -> revoke URL cũ ngay
            oldNode.replaceWith(newNode);
            appState.mutate('domNodesByKey', m => m.set(key, newNode));
        }

        /** SỬA (yêu cầu Giang) — cuộn tới ĐÚNG bài hát vừa sửa phụ đề xong (quay lại từ
         * subtitle-editor.html qua `location.href`, KHÔNG còn `history.back()` — xem
         * event/workflow/subtitle-editor.js::back()) — đọc CỜ RÕ RÀNG `sav_editingSubtitle` +
         * key riêng `sav_scrollToSongKey`, CẢ HAI lưu qua `localStorage` (KHÔNG phải sessionStorage
         * nữa). Cờ `false`/chưa từng có -> KHÔNG làm gì cả; cờ `true` -> cuộn tới đúng bài (tra
         * THẲNG qua `domNodesByKey`, Map bền vững renderPlaylistDiff() đang dùng, LUÔN khớp đúng
         * node THẬT đang hiển thị — không tự dò lại DOM bằng querySelector), KHÔNG kèm hiệu ứng
         * nháy/chớp UI gì cả (yêu cầu Giang — chỉ cuộn mượt, không viền sáng tạm thời như bản
         * trước) — rồi đặt cờ về `false` + xoá hẳn key bài hát NGAY, chỉ dùng ĐÚNG 1 lần.
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
         * ngay") — đổi Nguồn (switchToVideoSource()/switchToSongSource(), event/workflow/
         * playlist.js) dựng lại TOÀN BỘ danh sách khác hẳn nhau (renderPlaylistDiff() với
         * `renderOrder` hoàn toàn mới) — `scrollTop` CŨ (từ danh sách trước đó) không còn ý nghĩa
         * gì với danh sách MỚI, giữ nguyên trông như "cuộn dở/lệch" ngay khi vừa đổi Nguồn. Đây là
         * đổi TOÀN BỘ nội dung (không phải nhảy tới 1 bài cụ thể), nên về thẳng 0 TỨC THÌ (không
         * animation, không cần offset/tính toán gì) — KHÔNG dùng chung 2 hàm cuộn-tới-current ở
         * trên (2 hàm đó phục vụ mục đích khác: nhắm tới ĐÚNG 1 dòng `currentKey`). */
        function resetPlaylistScrollTop() {
            playlistContainer.parentElement.scrollTop = 0;
        }

        /** Ô tìm kiếm thay đổi: CHỈ lọc lại danh sách hiển thị (renderOrder) — KHÔNG đụng hàng đợi phát. */
        function applySearchQuery(raw) {
            appState.set('searchQuery', normalizeSongName(raw));
            recomputeRenderOrder();
            renderPlaylistDiff();
        }
