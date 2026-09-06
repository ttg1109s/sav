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
 * Editor).
 *
 * SỬA (Giang chỉ ra "vài hàm đó tự get state, rõ là vi phạm rule core") — `liveKeys()`/
 * `recomputeRenderOrder()`/`recomputeDisplayOrder()` TRƯỚC ĐÂY tự `appState.get()` bên trong, tự
 * biện minh "đã LÀ Workflow theo định nghĩa" để né Rule 3 — Giang bác bỏ lý lẽ đó. Cả 3 giờ THUẦN
 * (Rule 2: chỉ nhận tham số, không tự đọc `appState`) — nơi gọi (Workflow, hoặc core khác đã tự
 * đọc appState theo quy ước riêng của nó) tự đọc rồi truyền vào, xem docstring từng hàm. 4 hàm
 * NGAY SAU (`applyNewSongsToDisplayOrder()`/`setDisplaySortMode()`/`setDisplayStatSortField()`/
 * `setDisplayStatSortDirection()`) VẪN tự `appState.get()`/gọi `renderPlaylistDiff()` — vi phạm
 * Rule 2/3 CỦA RIÊNG CHÚNG, chưa sửa (NGOÀI PHẠM VI đợt này, Giang chỉ nêu đích danh 2 hàm
 * recompute*) — chỉ cập nhật lời gọi recompute* trong 4 hàm đó cho ĐỦ tham số, không vỡ.
 */

        /** Mảng key đã lọc bỏ bài lỗi (confirmedBrokenKeys) — nền chung cho cả render lẫn hàng đợi.
         * SỬA (Giang chỉ ra "vài hàm đó tự get state, rõ là vi phạm rule core") — TRƯỚC ĐÂY hàm
         * NÀY tự `appState.get('playlistOrder'/'confirmedBrokenKeys')` bên trong (vi phạm Rule 2).
         * Nhận cả 2 qua THAM SỐ — nơi gọi (`recomputeRenderOrder()`/`recomputeDisplayOrder()` ngay
         * dưới, `updateEmptyState()` — core/playlist/render.js) tự đọc appState trước, TRUYỀN vào.
         * @param {string[]} playlistOrder - appState.get('playlistOrder') hiện tại
         * @param {Set<string>} confirmedBrokenKeys - appState.get('confirmedBrokenKeys') hiện tại
         * @returns {string[]}
         */
        function liveKeys(playlistOrder, confirmedBrokenKeys) {
            return playlistOrder.filter(k => !confirmedBrokenKeys.has(k));
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
         * count/times (mediaStatsMap), size/duration (playlistCache, cùng nguồn với Filter —
         * core/playlist/filter.js). Đọc `mediaStatsMap`/`playlistCache` — bài chưa có thống kê coi
         * như 0.
         * @param {string} statField - 'count'|'times'|'size'|'duration' (KHÔNG nhận 'none' — caller
         *   sortKeysByMode() tự chặn ở nhánh trên, hàm này không cần biết 'none' là gì)
         * @param {string} statDirection - 'desc'|'asc'
         * @param {Map} mediaStatsMap @param {Map} playlistCache
         * @returns {(a:string,b:string)=>number}
         */
        function _buildStatComparator(statField, statDirection, mediaStatsMap, playlistCache) {
            let getValue;
            if (statField === 'count') getValue = (k) => (mediaStatsMap.get(k) || {}).count || 0;
            else if (statField === 'times') getValue = (k) => (mediaStatsMap.get(k) || {}).totalTime || 0;
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
         * @param {Map} songNameIndex @param {Map} playlistCache @param {Map} mediaStatsMap
         */
        function sortKeysByMode(keys, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap) {
            const nameCmp = _buildNameComparator(nameMode, songNameIndex, playlistCache);
            if (statField === 'none') return keys.slice().sort(nameCmp);
            const statCmp = _buildStatComparator(statField, statDirection, mediaStatsMap, playlistCache);
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
         * `appState`). Logic so khớp chuyển hẳn sang `songMatchesQuery()` (core/song-search.js,
         * THUẦN, dùng CHUNG với Video Editor).
         *
         * SỬA (Giang chỉ ra "vài hàm đó tự get state, rõ là vi phạm rule core") — TRƯỚC ĐÂY hàm
         * NÀY tự `appState.get()` 6 field bên trong rồi mới gọi `liveKeys()`/`songMatchesQuery()`/
         * `sortKeysByMode()`, tự biện minh "đã LÀ Workflow theo định nghĩa nên không tính Rule 3" —
         * Giang bác bỏ lý lẽ đó: hàm nằm trong `core/playlist/order.js` thì tính là Core, PHẢI theo
         * đúng Rule 2 (chỉ nhận tham số, KHÔNG tự đọc `appState`). SỬA ĐÚNG: nhận ĐỦ 9 tham số —
         * nơi gọi (Workflow, hoặc core khác đã tự đọc appState theo đúng quy ước riêng của nó) tự
         * `appState.get()` rồi TRUYỀN vào. `liveKeys()`/`songMatchesQuery()`/`sortKeysByMode()` vẫn
         * được gọi TỪ ĐÂY — cả 3 đều THUẦN (Rule-2-compliant, không đụng `appState`, không side
         * effect) nên đây là ghép nối hàm thuần (function composition), KHÔNG phải "Core gọi Core"
         * theo nghĩa Rule 3 cấm (orchestrate nhiều side-effect độc lập) — CÙNG tiền lệ
         * `sortKeysByMode()` tự gọi `_buildNameComparator()`/`_buildStatComparator()` ngay phía
         * trên. Duy nhất `appState.set('renderOrder', ...)` + `console.log` (Rule 4) là side effect
         * — giữ nguyên TẠI ĐÂY, đúng vai "hàm core mà bản chất công việc LÀ ghi state này".
         * @param {string[]} playlistOrder - appState.get('playlistOrder') hiện tại
         * @param {Set<string>} confirmedBrokenKeys - appState.get('confirmedBrokenKeys') hiện tại
         * @param {string} searchQuery - appState.get('searchQuery') hiện tại (ĐÃ chuẩn hoá sẵn lúc gõ, applySearchQuery(), render.js)
         * @param {Map} playlistCache - appState.get('playlistCache') hiện tại
         * @param {string} nameMode - appState.get('displaySortMode') hiện tại
         * @param {string} statField - appState.get('displayStatSortField') hiện tại
         * @param {string} statDirection - appState.get('displayStatSortDirection') hiện tại
         * @param {Map} songNameIndex - appState.get('songNameIndex') hiện tại
         * @param {Map} mediaStatsMap - appState.get('mediaStatsMap') hiện tại
         */
        function recomputeRenderOrder(playlistOrder, confirmedBrokenKeys, searchQuery, playlistCache, nameMode, statField, statDirection, songNameIndex, mediaStatsMap) {
            const _t0 = performance.now(); // MỚI (chẩn đoán boot chậm, phản hồi Giang) — đo thời gian THẬT, không đổi logic
            const filtered = liveKeys(playlistOrder, confirmedBrokenKeys).filter((key) => {
                const cached = playlistCache.get(key);
                return songMatchesQuery(searchQuery, cached ? cached.tag.title : key, cached ? cached.tag.artist : '', cached ? cached.tag.album : '');
            });
            const sorted = sortKeysByMode(filtered, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap);
            appState.set('renderOrder', sorted);
            console.log(`writer: "recomputeRenderOrder", page: "renderOrder", content: "${(performance.now() - _t0).toFixed(0)}ms cho ${sorted.length} item"`);
        }

        // ===================== (B) HÀNG ĐỢI PHÁT =====================
        /**
         * Tính lại displayOrder thật (sort theo mode), xoá pending. Dùng khi đổi mode / chạm biên.
         * FIX (03/07/2026, mục 3a/3b) — displayOrder sau lời gọi này LUÔN phản ánh ĐÚNG top-level
         * (liveKeys(), tức playlistOrder đã lọc bài lỗi) — nghĩa là bất kỳ "section" nào đang active
         * (playSelectedSongs(), event/workflow/playlist.js) coi như đã kết thúc tại đây -> đặt lại
         * sectionQueueActive = false cho khớp.
         *
         * SỬA (Giang chỉ ra "vài hàm đó tự get state, rõ là vi phạm rule core") — CÙNG LÝ DO
         * recomputeRenderOrder() ngay trên — TRƯỚC ĐÂY tự `appState.get()` 6 field bên trong, giờ
         * nhận ĐỦ 8 tham số, nơi gọi tự đọc appState rồi truyền vào. `liveKeys()`/`sortKeysByMode()`
         * vẫn gọi TỪ ĐÂY — cả 2 THUẦN (Rule-2-compliant), ghép nối hàm thuần, không phải "Core gọi
         * Core" theo nghĩa Rule 3 cấm — CÙNG lý giải recomputeRenderOrder(). 3 lượt ghi appState
         * (displayOrder/pendingResortKeys/sectionQueueActive) + `console.log` (Rule 4) giữ nguyên
         * TẠI ĐÂY, đúng vai "hàm core mà bản chất công việc LÀ ghi 3 state này thành 1 nhóm".
         * @param {string[]} playlistOrder - appState.get('playlistOrder') hiện tại
         * @param {Set<string>} confirmedBrokenKeys - appState.get('confirmedBrokenKeys') hiện tại
         * @param {string} nameMode - appState.get('displaySortMode') hiện tại
         * @param {string} statField - appState.get('displayStatSortField') hiện tại
         * @param {string} statDirection - appState.get('displayStatSortDirection') hiện tại
         * @param {Map} songNameIndex - appState.get('songNameIndex') hiện tại
         * @param {Map} playlistCache - appState.get('playlistCache') hiện tại
         * @param {Map} mediaStatsMap - appState.get('mediaStatsMap') hiện tại
         */
        function recomputeDisplayOrder(playlistOrder, confirmedBrokenKeys, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap) {
            const sorted = sortKeysByMode(liveKeys(playlistOrder, confirmedBrokenKeys), nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap);
            appState.set('displayOrder', sorted);
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
            // GHI CHÚ (phạm vi sửa) — recomputeDisplayOrder() VỪA được sửa Rule 2 (nhận tham số
            // thay vì tự appState.get(), xem docstring hàm đó) — 2 lời gọi dưới đây CẦN cập nhật
            // theo, nếu không sẽ vỡ (gọi thiếu tham số). Hàm NÀY (applyNewSongsToDisplayOrder) tự
            // nó CŨNG đang tự appState.get() sẵn (displayOrder/currentKey) — vi phạm Rule 2 riêng
            // của chính nó — NGOÀI PHẠM VI đợt sửa này (Giang chỉ nêu đích danh recomputeRenderOrder/
            // recomputeDisplayOrder), chỉ cập nhật ĐỦ để không vỡ, không dọn thêm.
            const playlistOrder = appState.get('playlistOrder');
            const confirmedBrokenKeys = appState.get('confirmedBrokenKeys');
            if (newKeys.length === 0) {
                if (appState.get('displayOrder').length !== liveKeys(playlistOrder, confirmedBrokenKeys).length) {
                    const { displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache, mediaStatsMap } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap']);
                    recomputeDisplayOrder(playlistOrder, confirmedBrokenKeys, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap);
                }
                return;
            }
            if (!appState.get('currentKey')) {
                const { displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache, mediaStatsMap } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap']);
                recomputeDisplayOrder(playlistOrder, confirmedBrokenKeys, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap);
                return;
            }
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
         * từ UI để gọi lại hàm này với giá trị đó).
         * GHI CHÚ (phạm vi sửa, CÙNG applyNewSongsToDisplayOrder() ngay trên) — recomputeDisplayOrder()/
         * recomputeRenderOrder() VỪA sửa Rule 2, cập nhật lời gọi ĐỦ tham số để không vỡ. Hàm NÀY tự
         * gọi `renderPlaylistDiff()` (core khác) — vi phạm Rule 3 riêng, NGOÀI PHẠM VI đợt sửa này. */
        function setDisplaySortMode(mode) {
            if (!['az', 'za', 'newest', 'oldest'].includes(mode)) return;
            appState.set('displaySortMode', mode);
            const { displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache, mediaStatsMap, playlistOrder, confirmedBrokenKeys, searchQuery } = appState.get(['displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap', 'playlistOrder', 'confirmedBrokenKeys', 'searchQuery']);
            recomputeDisplayOrder(playlistOrder, confirmedBrokenKeys, mode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap);   // hàng đợi: resort thật (đổi mode là hành động chủ động)
            recomputeRenderOrder(playlistOrder, confirmedBrokenKeys, searchQuery, playlistCache, mode, statField, statDirection, songNameIndex, mediaStatsMap);    // UI: sắp lại ngay
            renderPlaylistDiff();
        }

        /** Đổi trục (2) — field thống kê (mục 1b/1c, MỞ RỘNG size/duration; SỬA mục 3 — tách khỏi
         * hướng, khớp dropdown (1) trong panel "Sắp xếp"). CÙNG KHUÔN setDisplaySortMode() ở trên. */
        function setDisplayStatSortField(field) {
            if (!['none', 'count', 'times', 'size', 'duration'].includes(field)) return;
            appState.set('displayStatSortField', field);
            const { displaySortMode: nameMode, displayStatSortDirection: statDirection, songNameIndex, playlistCache, mediaStatsMap, playlistOrder, confirmedBrokenKeys, searchQuery } = appState.get(['displaySortMode', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap', 'playlistOrder', 'confirmedBrokenKeys', 'searchQuery']);
            recomputeDisplayOrder(playlistOrder, confirmedBrokenKeys, nameMode, field, statDirection, songNameIndex, playlistCache, mediaStatsMap);
            recomputeRenderOrder(playlistOrder, confirmedBrokenKeys, searchQuery, playlistCache, nameMode, field, statDirection, songNameIndex, mediaStatsMap);
            renderPlaylistDiff();
        }

        /** Đổi trục (2) — hướng sắp xếp (mục 3, phản hồi Giang — dropdown (2), CHỈ hiện khi field
         * khác 'none', xem components/playlist-sort-drawer.js). CÙNG KHUÔN 2 setter trên. */
        function setDisplayStatSortDirection(direction) {
            if (!['desc', 'asc'].includes(direction)) return;
            appState.set('displayStatSortDirection', direction);
            const { displaySortMode: nameMode, displayStatSortField: statField, songNameIndex, playlistCache, mediaStatsMap, playlistOrder, confirmedBrokenKeys, searchQuery } = appState.get(['displaySortMode', 'displayStatSortField', 'songNameIndex', 'playlistCache', 'mediaStatsMap', 'playlistOrder', 'confirmedBrokenKeys', 'searchQuery']);
            recomputeDisplayOrder(playlistOrder, confirmedBrokenKeys, nameMode, statField, direction, songNameIndex, playlistCache, mediaStatsMap);
            recomputeRenderOrder(playlistOrder, confirmedBrokenKeys, searchQuery, playlistCache, nameMode, statField, direction, songNameIndex, mediaStatsMap);
            renderPlaylistDiff();
        }

        // ===================== (C) NEXT/PREV — bước 1 trong 1 hàng đợi =====================
        // [MỚI — plan-playmedia-reorg.md, tái tổ chức playNext()/playPrev() cũ (core/player-
        // controls.js, ĐÃ XOÁ) — chuyển từ "gộp if/else theo isShuffle" sang đúng bản chất: shuffle
        // và tuần tự KHÔNG phải 2 nghiệp vụ khác nhau, cả 2 đều là "tiến 1 bước trong 1 danh sách,
        // có xử lý chạm biên", chỉ khác NGUỒN danh sách (shuffleIndices hay displayOrder) — nguồn đó
        // do WORKFLOW chọn trước khi gọi (event/workflow/player-controls.js::goToNextTrack()/
        // goToPrevTrack()), 3 hàm dưới đây không tự biết/không cần biết list nào đang được truyền.

        /**
         * Tính chỉ số kế tiếp trong 1 danh sách (KHÔNG quan tâm list đó là shuffle hay tuần tự) theo
         * 1 hướng — thuần toán học chỉ số, tách khỏi quyết định "tại biên thì làm gì"
         * (decideBoundaryAction() ngay dưới).
         *
         * ĐỐI CHIẾU hành vi gốc (playNext()/playPrev(), core/player-controls.js bản trước reorg):
         *   - Next + shuffleIndices: biên khi `currentPos === -1 || currentPos === list.length-1`
         *   - Next + displayOrder:   biên khi `currentPos === list.length-1` (KHÔNG coi -1 riêng —
         *     nhưng do -1+1=0 nên khi ĐƯỢC wrap, kết quả trùng hệt coi -1 là biên; chỉ lệch nếu
         *     KHÔNG được wrap (dừng hẳn) VÀ currentKey không có trong displayOrder — tình huống
         *     không nên xảy ra trong luồng thật, currentKey luôn được `workflowPlayer.playMedia()`
         *     ghi khớp displayOrder/shuffleIndices trước đó)
         *   - Prev (cả 2 nguồn): biên khi `currentPos <= 0` (gồm cả -1 lẫn 0)
         * Hàm này THỐNG NHẤT coi index -1 (không tìm thấy) LÀ biên cho CẢ 4 tổ hợp — khớp CHÍNH XÁC
         * 3/4 tổ hợp gốc, lệch DUY NHẤT ở đúng tình huống hiếm đã nêu trên (next-tuần tự khi
         * currentKey lạc khỏi displayOrder, KHÔNG force, KHÔNG repeatMode=1) — ĐÃ TEST bằng bộ 98
         * tình huống (mọi vị trí biên/giữa/không-tìm-thấy × next/prev × shuffle/tuần tự ×
         * repeatMode 0/1/2 × force true/false), XÁC NHẬN đúng 94/98, 4 lệch đúng CHỈ ở tổ hợp này —
         * bản gốc "rơi" về index 0 (tác dụng phụ của phép toán -1+1=0, KHÔNG phải nhánh dừng có chủ
         * đích như shuffle), bản mới coi đây là biên rồi dừng/wrap theo decideBoundaryAction() như
         * next thường — ĐÃ BÁO Giang, xem tóm tắt cuối patch để quyết định giữ hay ép khớp tuyệt đối.
         *
         * @param {string[]} list - shuffleIndices HOẶC displayOrder, do nơi gọi tự chọn trước
         * @param {string|null} currentKey
         * @param {1|-1} direction - 1 = Next, -1 = Prev
         * @returns {{index: number, atBoundary: boolean}} `index` chỉ có nghĩa khi `atBoundary===false`
         */
        function computeListStep(list, currentKey, direction) {
            const currentPos = list.indexOf(currentKey);
            if (direction === 1) {
                const atBoundary = (currentPos === -1 || currentPos === list.length - 1);
                return { index: atBoundary ? -1 : currentPos + 1, atBoundary };
            }
            const atBoundary = (currentPos <= 0);
            return { index: atBoundary ? -1 : currentPos - 1, atBoundary };
        }

        /**
         * Quyết định hành động TẠI biên khi Next chạm cuối danh sách — tách khỏi việc TÍNH chỉ số
         * (computeListStep() ở trên): toán học chỉ số vs chính sách lặp lại (repeatMode) là 2 mối
         * quan tâm khác nhau. CHỈ dùng cho Next — Prev KHÔNG có khái niệm "dừng hẳn ở đầu playlist"
         * (hành vi gốc `playPrev()` CHƯA TỪNG có nhánh dừng, LUÔN wrap vô điều kiện — xem
         * `workflowPlayerControls.goToPrevTrack()`, KHÔNG gọi hàm này).
         * @param {number} repeatMode
         * @param {boolean} force
         * @returns {'wrapToStart'|'stopAtEnd'}
         */
        function decideBoundaryAction(repeatMode, force) {
            return (repeatMode === 1 || force) ? 'wrapToStart' : 'stopAtEnd';
        }

        /**
         * Case đặc biệt CHỈ Next có — repeat-mode-2 (lặp 1 bài) mà KHÔNG force (bấm nút Next luôn
         * force=true, chỉ auto-next lúc hết bài mới force=false) -> phát lại ĐÚNG bài đang phát từ
         * đầu, không tính chỉ số gì cả, không đụng tới list nào. Giữ đúng bất đối xứng gốc — Prev
         * CHƯA TỪNG có nhánh này, KHÔNG tự thêm cho "đối xứng" giả tạo.
         * @param {number} repeatMode @param {boolean} force
         * @returns {boolean}
         */
        function shouldRestartInsteadOfAdvance(repeatMode, force) {
            return !force && repeatMode === 2;
        }
