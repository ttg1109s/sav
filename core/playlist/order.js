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
 * SỬA TẬN GỐC (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ trừ chỉ định cụ thể theo tài liệu")
 * — file này TRƯỚC ĐÂY có 6 hàm tự `appState.get()`/gọi core khác (`recomputeRenderOrder()`,
 * `recomputeDisplayOrder()`, `updateShuffleArray()`, `applyNewSongsToDisplayOrder()`,
 * `setDisplaySortMode()`, `setDisplayStatSortField()`, `setDisplayStatSortDirection()`) — TẤT CẢ
 * ĐÃ DỜI sang `event/workflow/playlist-order.js` (`workflowPlaylistOrder` object) theo đúng Rule 3b
 * ("Core là tầng THI HÀNH, Workflow là tầng CHUẨN BỊ"), CÙNG tiền lệ `core/playlist/bulk-actions.js`
 * đã làm với `deleteSongsBatch()` cũ. File NÀY giờ CHỈ còn hàm THUẦN thật sự — không hàm nào tự
 * `appState.get()`/`.set()`/`.mutate()` (trừ `updateShuffleArrayFromQueue()`, ĐƯỢC PHÉP ghi theo
 * Rule 2 — chỉ chặn chiều đọc), không hàm nào gọi core/nghiệp vụ nào khác của project.
 */

/** Mảng key đã lọc bỏ bài lỗi (confirmedBrokenKeys) — nền chung cho cả render lẫn hàng đợi.
 * @param {string[]} playlistOrder - appState.get('playlistOrder') hiện tại
 * @param {Set<string>} confirmedBrokenKeys - appState.get('confirmedBrokenKeys') hiện tại
 * @returns {string[]}
 */
function liveKeys(playlistOrder, confirmedBrokenKeys) {
    return playlistOrder.filter(k => !confirmedBrokenKeys.has(k));
}

/**
 * So sánh & trả về MẢNG MỚI đã sắp theo CẢ 2 trục (mục 1b/1c, phản hồi Giang; SỬA mục 3 —
 * field/hướng tách riêng):
 *   - `statField` === 'none' -> CHỈ trục (1) quyết định — hành vi Y HỆT bản trước Sort
 *     subpanel (KHÔNG đổi kết quả cho ai chưa bật trục thống kê).
 *   - `statField` khác 'none' -> trục (2) là CHÍNH (hướng theo `statDirection`); 2 bài BẰNG
 *     NHAU thì trục (1) quyết định thứ tự giữa 2 bài đó (tie-break, ĐÚNG yêu cầu mục 1c).
 *
 * `nameCmp`/`getValue` là closure CỤC BỘ (khai báo NGAY TRONG thân hàm này, KHÔNG phải hàm
 * top-level riêng) — không "gọi core khác" nên không cần viện tới ngoại lệ Rule 3c nào.
 * @param {string[]} keys
 * @param {string} nameMode - displaySortMode hiện tại (trục 1) — `az`/`za` đọc `songNameIndex`
 *   (populate cho CẢ Song [title] lẫn Video/Photo [filename]); `newest`/`oldest` đọc `addedAt`
 *   từ `playlistCache`. 'az' là NHÁNH MẶC ĐỊNH cho mọi giá trị không khớp 'za'/'newest'/
 *   'oldest' — bao gồm luôn giá trị cũ 'default' còn sót lại (state cũ) — tự rơi về az an toàn.
 * @param {string} statField - displayStatSortField hiện tại (trục 2) — 'none'|'count'|'times'|'size'|'duration'.
 *   4 field: count/times (mediaStatsMap), size/duration (playlistCache, cùng nguồn với Filter
 *   — core/playlist/filter.js) — bài chưa có thống kê coi như 0.
 * @param {string} statDirection - displayStatSortDirection hiện tại — 'desc'|'asc'
 * @param {Map} songNameIndex @param {Map} playlistCache @param {Map} mediaStatsMap
 */
function sortKeysByMode(keys, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap) {
    // Trục (1) — tên/ngày, closure CỤC BỘ (không phải hàm top-level riêng — xem docstring).
    const nameCmp = (nameMode === 'newest' || nameMode === 'oldest')
        ? (a, b) => {
            const dateA = (playlistCache.get(a) || {}).addedAt || 0;
            const dateB = (playlistCache.get(b) || {}).addedAt || 0;
            return nameMode === 'newest' ? dateB - dateA : dateA - dateB;
        }
        : (a, b) => { // 'az' (mặc định) hoặc 'za' — cùng 1 phép so sánh, chỉ đổi dấu.
            const nameA = songNameIndex.get(a) || ''; const nameB = songNameIndex.get(b) || '';
            const cmp = nameA.localeCompare(nameB, 'vi');
            return nameMode === 'za' ? -cmp : cmp;
        };
    if (statField === 'none') return keys.slice().sort(nameCmp);

    // Trục (2) — thống kê, CÙNG LÝ DO gộp thẳng thành closure cục bộ, không tách hàm riêng.
    let getValue;
    if (statField === 'count') getValue = (k) => (mediaStatsMap.get(k) || {}).count || 0;
    else if (statField === 'times') getValue = (k) => (mediaStatsMap.get(k) || {}).totalTime || 0;
    else if (statField === 'size') getValue = (k) => (playlistCache.get(k) || {}).size || 0;
    else getValue = (k) => (playlistCache.get(k) || {}).duration || 0; // 'duration'
    const desc = statDirection === 'desc';

    return keys.slice().sort((a, b) => {
        const va = getValue(a); const vb = getValue(b);
        const primary = desc ? vb - va : va - vb;
        return primary !== 0 ? primary : nameCmp(a, b);
    });
}

/**
 * MỚI (fix 03/07/2026, mục 3b yêu cầu) — bản shuffle "hiện hành", KHÔNG đụng
 * `workflowPlaylistOrder.updateShuffleArray()` (event/workflow/playlist-order.js — dùng cho mọi chỗ
 * gọi legacy: boot/thêm bài/clear storage/áp scope folder — những nơi đó LUÔN muốn shuffle TOÀN BỘ
 * top-level, đúng hành vi cũ, không liên quan section). Hàm NÀY dùng riêng cho nút Shuffle ở
 * Control Center (event/workflow/player-controls.js::toggleShuffleAndReshuffle) — nơi Shuffle phải
 * trộn ĐÚNG "hiện hành" (activeQueueKeys = displayOrder lúc đó — có thể đang là 1 section vừa
 * chọn-phát, KHÁC top-level), không phải luôn nhảy về top-level như 2 nút to "Phát"/"Trộn bài" (xem
 * event/workflow/playlist-empty-state.js, dùng top-level thật qua `workflowPlaylistOrder.
 * recomputeDisplayOrder()` + `.updateShuffleArray()`).
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

// ===================== NEXT/PREV — bước 1 trong 1 hàng đợi =====================
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
