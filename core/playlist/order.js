/**
 * playlist/order.js — Thuật toán THỨ TỰ cho cả 2 khái niệm (xem state.js):
 *   - `renderOrder` (UI): sort theo mode + lọc tìm kiếm, cập nhật NGAY mọi lúc.
 *   - `displayOrder` (hàng đợi phát): sort theo mode nhưng có "pending append" lúc đang phát.
 * Cùng dùng chung 1 hàm so sánh tên (sortKeysByMode) để 2 thứ tự nhất quán về quy tắc sắp xếp.
 *
 * Ver 8: lọc tìm kiếm thêm theo `tag.album` (trước đây chỉ title + artist) — gõ tên album vào ô
 * tìm kiếm giờ cũng ra kết quả đúng.
 *
 * [REFACTOR 23/07/2026] `matchesSearch()` (lớp trung gian tự appState.get()) ĐÃ XOÁ — logic so
 * khớp chuyển hẳn sang `songMatchesQuery()` (core/song-search.js, THUẦN, dùng CHUNG với module Video
 * Editor). `recomputeRenderOrder()` bên dưới giờ tự đọc appState rồi gọi thẳng hàm đó (xem comment
 * tại chỗ).
 */

        /** Mảng key đã lọc bỏ bài lỗi (confirmedBrokenKeys) — nền chung cho cả render lẫn hàng đợi. */
        function liveKeys() {
            return appState.get('playlistOrder').filter(k => !appState.get('confirmedBrokenKeys').has(k));
        }

        /**
         * Comparator trục (1) — tên/ngày (`nameMode`: az/za/newest/oldest). TÁCH khỏi
         * `sortKeysByMode()` (đợt Sort subpanel, mục 1b/1c) để dùng lại làm phần "phá thế bằng"
         * (tie-break) khi trục (2) đang bật mà 2 bài có count/times bằng nhau — xem
         * `sortKeysByMode()` bên dưới.
         *
         * [SỬA — Giang chốt "dùng chung hết" 4 kiểu sort (az/za/newest/oldest) cho CẢ Song lẫn
         * Video, KHÔNG tách riêng theo nguồn nữa] `az`/`za` đọc `songNameIndex` — populate cho CẢ
         * Song (title) lẫn Video (filename). `newest`/`oldest` đọc `addedAt` từ `playlistCache`.
         * 'az' là NHÁNH MẶC ĐỊNH cho mọi `nameMode` không khớp 'za'/'newest'/'oldest' — bao gồm
         * luôn giá trị cũ 'default' còn sót lại (state cũ) — tự rơi về az an toàn.
         * @param {string} nameMode @param {Map} songNameIndex @param {Map} playlistCache
         * @returns {(a:string,b:string)=>number}
         */
        function _buildNameComparator(nameMode, songNameIndex, playlistCache) {
            if (nameMode === 'newest' || nameMode === 'oldest') {
                return (a, b) => {
                    const dateA = (playlistCache.get(a) || {}).addedAt || 0;
                    const dateB = (playlistCache.get(b) || {}).addedAt || 0;
                    return nameMode === 'newest' ? dateB - dateA : dateA - dateB;
                };
            }
            // 'az' (mặc định) hoặc 'za' — cùng 1 phép so sánh, chỉ đổi dấu.
            return (a, b) => {
                const nameA = songNameIndex.get(a) || ''; const nameB = songNameIndex.get(b) || '';
                const cmp = nameA.localeCompare(nameB, 'vi');
                return nameMode === 'za' ? -cmp : cmp;
            };
        }

        /**
         * Comparator trục (2) — thống kê, MỞ RỘNG (phản hồi Giang — "bổ sung dung lượng + duration
         * vào stats"), SỬA (mục 3 — tách field/hướng thành 2 tham số riêng thay vì 1 chuỗi gộp
         * kiểu 'countDesc', khớp đúng UI 2 dropdown — components/playlist-sort-drawer.js). 4 field:
         * count/times (songStatsMap), size/duration (playlistCache, cùng nguồn với Filter —
         * core/playlist/filter.js). Đọc `songStatsMap`/`playlistCache` — bài chưa có thống kê coi
         * như 0.
         * @param {string} statField - 'count'|'times'|'size'|'duration' (KHÔNG nhận 'none' — caller
         *   sortKeysByMode() tự chặn ở nhánh trên, hàm này không cần biết 'none' là gì)
         * @param {string} statDirection - 'desc'|'asc'
         * @param {Map} songStatsMap @param {Map} playlistCache
         * @returns {(a:string,b:string)=>number}
         */
        function _buildStatComparator(statField, statDirection, songStatsMap, playlistCache) {
            let getValue;
            if (statField === 'count') getValue = (k) => (songStatsMap.get(k) || {}).count || 0;
            else if (statField === 'times') getValue = (k) => (songStatsMap.get(k) || {}).totalTime || 0;
            else if (statField === 'size') getValue = (k) => (playlistCache.get(k) || {}).size || 0;
            else getValue = (k) => (playlistCache.get(k) || {}).duration || 0; // 'duration'
            const desc = statDirection === 'desc';
            return (a, b) => {
                const va = getValue(a); const vb = getValue(b);
                return desc ? vb - va : va - vb;
            };
        }

        /**
         * So sánh & trả về MẢNG MỚI đã sắp theo CẢ 2 trục (mục 1b/1c, phản hồi Giang; SỬA mục 3 —
         * field/hướng tách riêng):
         *   - `statField` === 'none' -> CHỈ trục (1) quyết định — hành vi Y HỆT bản trước Sort
         *     subpanel (KHÔNG đổi kết quả cho ai chưa bật trục thống kê).
         *   - `statField` khác 'none' -> trục (2) là CHÍNH (hướng theo `statDirection`); 2 bài BẰNG
         *     NHAU thì trục (1) quyết định thứ tự giữa 2 bài đó (tie-break, ĐÚNG yêu cầu mục 1c).
         * @param {string[]} keys
         * @param {string} nameMode - displaySortMode hiện tại (trục 1)
         * @param {string} statField - displayStatSortField hiện tại (trục 2) — 'none'|'count'|'times'|'size'|'duration'
         * @param {string} statDirection - displayStatSortDirection hiện tại — 'desc'|'asc'
         * @param {Map} songNameIndex @param {Map} playlistCache @param {Map} songStatsMap
         */
        function sortKeysByMode(keys, nameMode, statField, statDirection, songNameIndex, playlistCache, songStatsMap) {
            const nameCmp = _buildNameComparator(nameMode, songNameIndex, playlistCache);
            if (statField === 'none') return keys.slice().sort(nameCmp);
            const statCmp = _buildStatComparator(statField, statDirection, songStatsMap, playlistCache);
            return keys.slice().sort((a, b) => {
                const primary = statCmp(a, b);
                return primary !== 0 ? primary : nameCmp(a, b);
            });
        }

        // ===================== (A) DANH SÁCH HIỂN THỊ =====================
        /**
         * Tính lại renderOrder = các bài hợp lệ, lọc theo ô tìm kiếm, sắp theo mode hiện tại.
         * KHÔNG bao giờ phụ thuộc currentKey / pending / hàng đợi phát — UI luôn "đúng như mắt thấy".
         *
         * [REFACTOR 23/07/2026, phản hồi Giang] — bỏ hẳn `matchesSearch()` làm lớp trung gian (hàm
         * đó tự `appState.get()` bên trong, không tái dùng được cho Video Editor — trang không nạp
         * `appState`). Hàm NÀY vốn đã tự đọc/ghi `appState` trực tiếp (`liveKeys()`, `appState.set(
         * 'renderOrder', ...)`) — tức đã LÀ Workflow theo định nghĩa (event-bus-flow.md mục 4B: đọc
         * state để chuẩn bị input cho Core = Workflow), nên gọi thẳng Core thuần `songMatchesQuery()`
         * (core/song-search.js, dùng CHUNG với Video Editor) ở đây KHÔNG vi phạm Rule 3 (Rule 3 chỉ
         * cấm Core gọi Core — đây là Workflow gọi Core).
         */
        function recomputeRenderOrder() {
            const _t0 = performance.now(); // MỚI (chẩn đoán boot chậm, phản hồi Giang) — đo thời gian THẬT, không đổi logic
            const query = appState.get('searchQuery'); // ĐÃ chuẩn hoá sẵn lúc gõ (applySearchQuery(), render.js)
            const cache = appState.get('playlistCache');
            // SỬA (mục 3) — displayStatSortMode (gộp) tách thành displayStatSortField/
            // displayStatSortDirection (2 field riêng, khớp sortKeysByMode() bản mới).
            const { displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, songStatsMap } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'songStatsMap']);
            appState.set('renderOrder', sortKeysByMode(liveKeys().filter((key) => {
                const cached = cache.get(key);
                return songMatchesQuery(query, cached ? cached.tag.title : key, cached ? cached.tag.artist : '', cached ? cached.tag.album : '');
            }), nameMode, statField, statDirection, songNameIndex, cache, songStatsMap));
            console.log(`writer: "recomputeRenderOrder", page: "(chẩn đoán)", content: "${(performance.now() - _t0).toFixed(0)}ms cho ${appState.get('renderOrder').length} item"`);
        }

        // ===================== (B) HÀNG ĐỢI PHÁT =====================
        /**
         * Tính lại displayOrder thật (sort theo mode), xoá pending. Dùng khi đổi mode / chạm biên.
         * FIX (03/07/2026, mục 3a/3b) — displayOrder sau lời gọi này LUÔN phản ánh ĐÚNG top-level
         * (liveKeys(), tức playlistOrder đã lọc bài lỗi) — nghĩa là bất kỳ "section" nào đang active
         * (playSelectedSongs(), event/workflow/playlist.js) coi như đã kết thúc tại đây -> đặt lại
         * sectionQueueActive = false cho khớp. Thêm console.log Rule 4 cho 2 lượt ghi appState CŨ
         * (trước đây chưa có, hàm này chưa từng vi phạm Rule 1/2/3 nên KHÔNG cần đổi gì khác ngoài
         * việc bổ sung log — xem core-function-conventions.md mục 0.5: hàm bị đụng tới phải tuân đủ
         * 4 rule, kể cả phần code cũ không đổi logic).
         */
        function recomputeDisplayOrder() {
            // SỬA (mục 3) — CÙNG LÝ DO recomputeRenderOrder() ngay trên.
            const { displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache: cache, songStatsMap } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'songStatsMap']);
            appState.set('displayOrder', sortKeysByMode(liveKeys(), nameMode, statField, statDirection, songNameIndex, cache, songStatsMap));
            console.log(`writer: "recomputeDisplayOrder", page: "displayOrder", content: "resort lại theo displaySortMode, về top-level"`);
            appState.mutate('pendingResortKeys', s => s.clear());
            console.log(`writer: "recomputeDisplayOrder", page: "pendingResortKeys", content: "clear toàn bộ"`);
            appState.set('sectionQueueActive', false);
            console.log(`writer: "recomputeDisplayOrder", page: "sectionQueueActive", content: "false"`);
        }

        /**
         * Thêm bài MỚI vào hàng đợi phát:
         *   - Không đang phát gì -> resort hàng đợi ngay (mạch phát chưa bắt đầu, sắp lại vô hại).
         *   - Đang phát -> nối vào CUỐI hàng đợi + ghi nhận pending (chỉ resort khi chạm biên),
         *     để không làm gãy thứ tự đang nghe. (Phần này KHÔNG ảnh hưởng renderOrder/UI.)
         *
         * TỐI ƯU (v7): trước đây dùng `displayOrder.includes(k)` NGAY TRONG vòng `for` qua
         * `newKeys` -> O(newKeys.length × displayOrder.length), tức O(n²) khi nạp nhiều file vào
         * playlist đã lớn (vài nghìn bài). Đổi sang tra cứu qua `Set` (O(1)/lần) dựng 1 lần TRƯỚC
         * vòng lặp -> tổng chi phí còn O(newKeys.length + displayOrder.length). Logic kết quả
         * (thứ tự nối vào cuối displayOrder, tập pendingResortKeys) giữ nguyên 100% so với bản cũ.
         */
        function applyNewSongsToDisplayOrder(newKeys) {
            if (newKeys.length === 0) {
                if (appState.get('displayOrder').length !== liveKeys().length) recomputeDisplayOrder();
                return;
            }
            if (!appState.get('currentKey')) { recomputeDisplayOrder(); return; }
            const displaySet = new Set(appState.get('displayOrder')); // tra cứu O(1) thay cho .includes() O(n)
            for (const k of newKeys) {
                if (!displaySet.has(k)) {
                    appState.mutate('displayOrder', arr => arr.push(k));
                    displaySet.add(k);
                }
                appState.mutate('pendingResortKeys', s => s.add(k));
            }
        }

        function updateShuffleArray() {
            appState.set('shuffleIndices', appState.get('playlistOrder').slice());
            if (appState.get('isShuffle')) {
                appState.mutate('shuffleIndices', arr => {
                    for (let i = arr.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [arr[i], arr[j]] = [arr[j], arr[i]];
                    }
                });
            }
        }

        /**
         * MỚI (fix 03/07/2026, mục 3b yêu cầu) — bản shuffle "hiện hành", KHÔNG đụng
         * updateShuffleArray() ở trên (giữ NGUYÊN cho mọi chỗ gọi legacy đã có sẵn — boot/thêm bài/
         * clear storage/áp scope folder — những nơi đó LUÔN muốn shuffle TOÀN BỘ top-level, đúng
         * hành vi cũ, không liên quan section). Hàm NÀY dùng riêng cho nút Shuffle ở Control Center
         * (event/workflow/player-controls.js::toggleShuffleAndReshuffle) — nơi Shuffle phải trộn
         * ĐÚNG "hiện hành" (activeQueueKeys = displayOrder lúc đó — có thể đang là 1 section vừa
         * chọn-phát, KHÁC top-level), không phải luôn nhảy về top-level như 2 nút to "Phát"/"Trộn
         * bài" (xem event/workflow/playlist-empty-state.js, dùng top-level thật qua
         * recomputeDisplayOrder() + hàm updateShuffleArray() cũ ở trên).
         *
         * QUYẾT ĐỊNH KỸ THUẬT — GIỮ TỔNG ĐỘ DÀI shuffleIndices = topLevelKeys.length (activeQueueKeys
         * luôn đứng ĐẦU, remaining nối sau) — KHÔNG rút ngắn còn mỗi activeQueueKeys, để giữ 1 mảng
         * duy nhất vừa phục vụ "hiện hành" vừa phục vụ tràn sang top-level khi cần.
         *
         * [FIX B — 13/07/2026, đã làm thật] `core/player-controls.js::playNext()`/`playPrev()` giờ
         * dùng ĐÚNG `shuffleIndices.length` làm biên (không còn `playlistOrder.length` cố định), VÀ
         * đọc `appState.sectionQueueActive` để tự giới hạn cứng trong đúng `activeQueueKeys.length`
         * đầu mảng khi có 1 section đang hiện hành — Next/Prev không còn tràn sang phần `remaining`
         * nữa. Mảng vẫn giữ NGUYÊN cấu trúc (activeQueueKeys + remaining nối sau) như thiết kế ban
         * đầu của hàm này — phần `remaining` giờ đóng vai trò lưới an toàn (nếu `sectionQueueActive`
         * lỡ lệch pha với `displayOrder` thật) hơn là "vùng sẽ tràn tới" như trước.
         *
         * Rule 1: đơn tuyến — CHỈ tính lại shuffleIndices theo 2 nhóm ưu tiên, không rẽ nhánh tiến
         * trình nào khác.
         * Rule 2: nhận activeQueueKeys/topLevelKeys/shuffleEnabled qua tham số, KHÔNG tự appState.get().
         * @param {string[]} activeQueueKeys - "hiện hành": displayOrder hiện tại (section HOẶC top-level)
         * @param {string[]} topLevelKeys - playlistOrder hiện tại (toàn bộ/theo folder, KHÔNG lọc section)
         * @param {boolean} shuffleEnabled
         */
        function updateShuffleArrayFromQueue(activeQueueKeys, topLevelKeys, shuffleEnabled) {
            const activeSet = new Set(activeQueueKeys);
            const remaining = topLevelKeys.filter(k => !activeSet.has(k));
            appState.set('shuffleIndices', activeQueueKeys.concat(remaining));
            console.log(`writer: "updateShuffleArrayFromQueue", page: "shuffleIndices", content: "${activeQueueKeys.length} bài hiện hành lên đầu + ${remaining.length} bài top-level còn lại"`);

            if (shuffleEnabled) {
                appState.mutate('shuffleIndices', arr => {
                    // Trộn RIÊNG trong phạm vi activeQueueKeys.length đầu tiên...
                    for (let i = activeQueueKeys.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [arr[i], arr[j]] = [arr[j], arr[i]];
                    }
                    // ...rồi trộn RIÊNG phần còn lại (remaining) — KHÔNG trộn lẫn 2 nhóm vào nhau,
                    // tránh 1 bài top-level "chen ngang" vào giữa lúc hiện hành vẫn còn bài chưa nghe.
                    for (let i = arr.length - 1; i > activeQueueKeys.length; i--) {
                        const j = activeQueueKeys.length + Math.floor(Math.random() * (i - activeQueueKeys.length + 1));
                        [arr[i], arr[j]] = [arr[j], arr[i]];
                    }
                });
                console.log(`writer: "updateShuffleArrayFromQueue", page: "shuffleIndices", content: "đã trộn ngẫu nhiên riêng từng nhóm (hiện hành/còn lại)"`);
            }
        }

        /** Đổi kiểu sắp xếp hiển thị — cập nhật CẢ render lẫn hàng đợi phát rồi vẽ lại.
         * [SỬA — Giang chốt "dùng chung hết"] az/za/newest/oldest — DÙNG CHUNG cho cả Song lẫn
         * Video, không còn phân biệt theo nguồn. Bỏ 'default' khỏi danh sách hợp lệ (đã xoá khỏi
         * option list tĩnh, components/settings/playlist-view.js) — giá trị cũ 'default' còn sót
         * trong state lưu trữ của người dùng cũ vẫn được `sortKeysByMode()` tự rơi về az an toàn,
         * chỉ là không set lại được NỮA qua hàm này (không sao, không ai còn chọn được 'default'
         * từ UI để gọi lại hàm này với giá trị đó). */
        function setDisplaySortMode(mode) {
            if (!['az', 'za', 'newest', 'oldest'].includes(mode)) return;
            appState.set('displaySortMode', mode);
            recomputeDisplayOrder();   // hàng đợi: resort thật (đổi mode là hành động chủ động)
            recomputeRenderOrder();    // UI: sắp lại ngay
            renderPlaylistDiff();
        }

        /** Đổi trục (2) — field thống kê (mục 1b/1c, MỞ RỘNG size/duration; SỬA mục 3 — tách khỏi
         * hướng, khớp dropdown (1) trong panel "Sắp xếp"). CÙNG KHUÔN setDisplaySortMode() ở trên. */
        function setDisplayStatSortField(field) {
            if (!['none', 'count', 'times', 'size', 'duration'].includes(field)) return;
            appState.set('displayStatSortField', field);
            recomputeDisplayOrder();
            recomputeRenderOrder();
            renderPlaylistDiff();
        }

        /** Đổi trục (2) — hướng sắp xếp (mục 3, phản hồi Giang — dropdown (2), CHỈ hiện khi field
         * khác 'none', xem components/playlist-sort-drawer.js). CÙNG KHUÔN 2 setter trên. */
        function setDisplayStatSortDirection(direction) {
            if (!['desc', 'asc'].includes(direction)) return;
            appState.set('displayStatSortDirection', direction);
            recomputeDisplayOrder();
            recomputeRenderOrder();
            renderPlaylistDiff();
        }
