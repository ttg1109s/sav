/**
 * playlist/order.js — Thuật toán THỨ TỰ cho cả 2 khái niệm (xem state.js):
 *   - `renderOrder` (UI): sort theo mode + lọc tìm kiếm, cập nhật NGAY mọi lúc.
 *   - `displayOrder` (hàng đợi phát): sort theo mode nhưng có "pending append" lúc đang phát.
 * Cùng dùng chung 1 hàm so sánh tên (sortKeysByMode) để 2 thứ tự nhất quán về quy tắc sắp xếp.
 *
 * Ver 8: matchesSearch() lọc thêm theo `tag.album` (trước đây chỉ title + artist) — gõ tên
 * album vào ô tìm kiếm giờ cũng ra kết quả đúng.
 */

        /** Mảng key đã lọc bỏ bài lỗi (confirmedBrokenKeys) — nền chung cho cả render lẫn hàng đợi. */
        function liveKeys() {
            return appState.get('playlistOrder').filter(k => !appState.get('confirmedBrokenKeys').has(k));
        }

        /** So sánh & trả về MẢNG MỚI đã sắp theo displaySortMode. 'default' giữ nguyên thứ tự thêm. */
        function sortKeysByMode(keys) {
            if (appState.get('displaySortMode') === 'az' || appState.get('displaySortMode') === 'za') {
                return keys.slice().sort((a, b) => {
                    const nameA = appState.get('songNameIndex').get(a) || ''; const nameB = appState.get('songNameIndex').get(b) || '';
                    const cmp = nameA.localeCompare(nameB, 'vi');
                    return appState.get('displaySortMode') === 'az' ? cmp : -cmp;
                });
            }
            return keys.slice(); // 'default'
        }

        function matchesSearch(key) {
            if (!appState.get('searchQuery')) return true;
            const cached = appState.get('playlistCache').get(key);
            const title = normalizeSongName(cached ? cached.tag.title : key);
            const artist = normalizeSongName(cached ? cached.tag.artist : '');
            const album = normalizeSongName(cached ? cached.tag.album : '');
            return title.includes(appState.get('searchQuery')) || artist.includes(appState.get('searchQuery')) || album.includes(appState.get('searchQuery'));
        }

        // ===================== (A) DANH SÁCH HIỂN THỊ =====================
        /**
         * Tính lại renderOrder = các bài hợp lệ, lọc theo ô tìm kiếm, sắp theo mode hiện tại.
         * KHÔNG bao giờ phụ thuộc currentKey / pending / hàng đợi phát — UI luôn "đúng như mắt thấy".
         */
        function recomputeRenderOrder() {
            appState.set('renderOrder', sortKeysByMode(liveKeys().filter(matchesSearch)));
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
            appState.set('displayOrder', sortKeysByMode(liveKeys()));
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
         * QUYẾT ĐỊNH KỸ THUẬT QUAN TRỌNG — GIỮ TỔNG ĐỘ DÀI shuffleIndices = topLevelKeys.length,
         * KHÔNG rút ngắn còn mỗi activeQueueKeys (dù về Ý NGHĨA người dùng chỉ muốn nghe "hiện
         * hành"): core/player-controls.js::playNext()/playPrev() — CODE DI SẢN nợ kỹ thuật NẶNG
         * (16+13 lượt appState.get(), vi phạm Rule 1 else/switch shuffle/không-shuffle, xem
         * core-legacy-audit.md) — đang dùng CỐ ĐỊNH appState.get('playlistOrder').length làm biên
         * "hết mảng" cho NHÁNH shuffle. Nếu shuffleIndices ngắn hơn playlistOrder, currentPos có thể
         * vượt quá độ dài thật của shuffleIndices trước khi chạm điều kiện "hết mảng" đó (vì điều
         * kiện so với playlistOrder.length, không phải shuffleIndices.length thật) -> đọc phải index
         * undefined -> playSong(undefined) lỗi. Đưa activeQueueKeys lên ĐẦU mảng (trộn riêng, không
         * lẫn với phần còn lại), phần CÒN LẠI của top-level nối THEO SAU (cũng trộn riêng) — giữ
         * ĐÚNG mong muốn "Next/Prev liên tiếp xoay vòng trong hiện hành trước" cho tới khi hết, sau
         * đó mới "tràn" sang phần còn lại của top-level, KHÔNG crash, KHÔNG cần đụng playNext/
         * playPrev. Muốn CHẶN HẲN không cho tràn (ranh giới cứng, dừng lại ở cuối hiện hành thay vì
         * tràn) cần refactor playNext/playPrev tách nhánh shuffle riêng (đúng Rule 1) — CHI PHÍ đó
         * lớn hơn nhiều so với fix hiện tại (đúng tinh thần core-function-conventions.md mục 0.5:
         * "tốn công hơn nhiều so với tính năng đang làm -> dừng lại hỏi trước khi sửa") — CHƯA làm,
         * cần Giang chốt trước nếu muốn ranh giới cứng thật.
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

        /** Đổi kiểu sắp xếp hiển thị (default/az/za) — cập nhật CẢ render lẫn hàng đợi phát rồi vẽ lại. */
        function setDisplaySortMode(mode) {
            if (!['default', 'az', 'za'].includes(mode)) return;
            appState.set('displaySortMode', mode);
            recomputeDisplayOrder();   // hàng đợi: resort thật (đổi mode là hành động chủ động)
            recomputeRenderOrder();    // UI: sắp lại ngay
            renderPlaylistDiff();
        }
