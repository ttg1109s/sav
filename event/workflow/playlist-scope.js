/**
 * event/workflow/playlist-scope.js — "THẰNG THỰC THI CUỐI" cho scoping Playlist theo folder.
 *
 * SỬA LẠI 06/09/2026 (Giang chốt "bỏ hỏi reload, áp sống luôn" + "mỗi Nguồn tự nhớ folder riêng")
 * — thay thế HẲN mô hình cũ (03/07/2026, đợt 3/4: tách "lưu ý định" khỏi "áp dụng thật", mọi nơi
 * NGOÀI boot chỉ lưu rồi hỏi tải lại trang qua `askReloadToApplyNow()`):
 *   - `persistScopeChoice(folderId, mediaType)` — cập nhật ĐÚNG field `mediaType` trong object
 *     `appState.activePlayListFolder` (`{song,video,photo}`, xem service/state/file-manager.js) +
 *     lưu bền `meta` — vẫn KHÔNG tự đụng `playlistOrder`/DOM, đó là việc của 2 hàm dưới.
 *   - `applyFolderScope(folderId, mediaType)`/`applyAllSongsScope(mediaType)` — áp THẬT vào
 *     `playlistOrder`/DOM. TRƯỚC ĐÂY chỉ gọi được lúc boot; giờ gọi được BẤT KỲ LÚC NÀO scope đổi
 *     (tap folder, toggle, gỡ hết item, xoá folder, ĐỔI SANG 1 Nguồn khác — xem
 *     event/workflow/playlist.js::switchToSongSource()/switchToVideoSource()/switchToPhotoSource(),
 *     mỗi hàm tự đọc `activePlayListFolder[Nguồn đó]` rồi áp lại folder đã nhớ, hoặc "Tất cả bài"
 *     nếu chưa từng scope) — không còn cần reload để thấy kết quả.
 *   - Đánh đổi CHỦ Ý (Giang xác nhận): áp sống KHÔNG dừng 1 bài đang phát NẰM NGOÀI scope mới — bài
 *     đó chỉ biến mất khỏi danh sách hiển thị, tự phát hết bình thường — ĐÚNG cùng hành vi vốn đã
 *     có sẵn khi đổi Nguồn Playlist (switchToSongSource() v.v. cũng không dừng bài đang phát), nay
 *     dùng CHUNG 1 chủ trương cho cả 2 tình huống, không phải hành vi mới phát sinh riêng.
 *   - `askReloadToApplyNow(bodyText)` — GIỮ NGUYÊN, KHÔNG xoá: vẫn đang được
 *     `event/workflow/playlist.js::applyFilterChanges()` dùng (Playlist Filter, tính năng KHÁC,
 *     không thuộc phạm vi sửa đợt này) — chỉ THÔI dùng ở các chỗ scope-theo-folder (Folder Browser
 *     Read, xem event/workflow/file-manager-folder-browser.js).
 *
 * `clearScope()` (bản cũ) ĐÃ XOÁ — không còn nơi nào gọi tới sau khi deleteActiveFolderById()
 * chuyển sang persistScopeChoice(null) + askReloadToApplyNow() (xem
 * event/workflow/file-manager-song.js).
 *
 * NẠP SAU: core/playlist/scope.js (loadAllSongs/loadSongsFromFolder), service/db.js (setMeta,
 * getAllSongKeys/getAllVideoKeys/getAllImageKeys, getSongRecord/getVideoRecord/getImageRecord —
 * dùng bởi `MEDIA_DB_ACCESSOR`/`listMediaRecords()` MỚI, xem docstring ngay dưới),
 * event/workflow/playlist-order.js (workflowPlaylistOrder.updateShuffleArray/recomputeDisplayOrder/
 * recomputeRenderOrder — dời từ core/playlist/order.js), core/playlist/render.js
 * (renderPlaylistDiff/updateEmptyState), core/modal-choice-ui.js (modalChoice),
 * core/file-manager/folder.js (getExcludedSongKeysFromFolders() — MỚI, Batch 4, dùng bởi
 * applyAllSongsScope()), core/playlist/filter.js (applyPlaylistFilter() — MỚI, mục 1d),
 * core/playlist/loader.js (buildAdaptedPlaylistCache/filterValidSongRecords/buildSongPlaylistCache —
 * dùng bởi loadPlaylistCacheForSource() MỚI, xem docstring ngay dưới).
 *
 * MỚI (07/09/2026, Giang chỉ ra "chuyển Nguồn qua lại đang nạp Tất cả rồi mới lọc theo folder,
 * không giống app boot") — `loadPlaylistCacheForSource(mediaSource, onProgress)` là "workflow
 * chuẩn" DÙNG CHUNG cho app boot (event/workflow/app-boot.js) VÀ 3 hàm switchToXSource()
 * (event/workflow/playlist.js): CHỈ nạp lại `playlistCache`/`songNameIndex` cho ĐÚNG
 * `mediaSource` — KHÔNG đụng `playlistOrder`, KHÔNG render gì cả. Nơi gọi PHẢI tự gọi
 * `applyFolderScope()`/`applyAllSongsScope()` NGAY SAU (đọc `activePlayListFolder[mediaSource]` để
 * quyết định) — đó mới là bước DUY NHẤT tính `playlistOrder` (Scope + Filter) + render, ĐÚNG thứ
 * tự "hỏi Scope nào trước, xong mới render" Giang chốt, thay cho pattern SAI trước đây ở
 * switchToXSource() (nạp TOÀN BỘ + Filter + render 1 lần, RỒI Scope lại + Filter + render LẦN
 * NỮA — vừa tốn công gấp đôi, vừa có 1 nhịp hiện SAI "Tất cả" trước khi nhảy về đúng folder).
 * `loadSongsFromFolder()`/`loadAllSongs()` (core/playlist/scope.js) + `getExcludedSongKeysFromFolders()`
 * (core/file-manager/folder.js) đều O(n) sẵn (Set/Map lookup, không lồng vòng lặp) — nối
 * `loadPlaylistCacheForSource()` (1 lượt đọc DB O(n)) với `applyFolderScope()`/`applyAllSongsScope()`
 * (1 lượt tính playlistOrder O(n) + render 1 lần) cho tổng CẢ QUY TRÌNH đúng O(n), không còn 2 lượt
 * O(n) nối tiếp như bản cũ.
 *
 * MỚI TIẾP (07/09/2026, Giang dẫn dắt qua nhiều vòng hỏi-đáp tới thiết kế CUỐI CÙNG này — "gộp mà
 * vẫn đảm bảo logic, thêm media sau này chỉ cần gửi type + config, tách hẳn get record ra khỏi
 * scan, dùng VMState theo type CHỈ khi có bước phụ riêng") — pipeline giờ tách 3 bước RÕ RỆT:
 *
 *   1. **List** (`listMediaRecords(mediaType, onProgress)`, ngay dưới) — đọc TOÀN BỘ key rồi
 *      fetch từng record qua `service/db.js`, gộp CHUNG cho CẢ BA loại bằng registry
 *      `MEDIA_DB_ACCESSOR` (THUẦN function reference tới `service/db.js`, KHÔNG phải core khác —
 *      xem giải thích Rule 3 ngay dưới). Đây CHÍNH LÀ chỗ trước đây Video/Photo tự gọi
 *      `listVideos()`/`listImages()` (core/file-manager/video.js/image.js — 2 hàm đó VẪN GIỮ
 *      NGUYÊN, còn dùng ở nơi khác: event/workflow/visual-bg-video.js, visual-bg-photo.js,
 *      file-manager-photo.js) và Song tự loop `getSongRecord()` NGAY TRONG
 *      `scanValidSongsFromDB()` (core/playlist/loader.js — hàm đó ĐÃ XOÁ, cùng
 *      `initPlaylistFromDB()`, xem lý do ở cuối docstring này) — 3 nơi gần như GIỐNG HỆT nhau
 *      (loop key -> fetch record -> gom mảng), giờ chỉ còn 1 bản DUY NHẤT.
 *
 *      Đặt `listMediaRecords()` ở TẦNG WORKFLOW (KHÔNG phải Core) vì nó gọi thẳng
 *      `service/db.js` để ĐỌC (`getAllXKeys`/`getXRecord`) — Rule 3 (siết 03/08/2026) CẤM TUYỆT ĐỐI
 *      Core tự làm việc này ("Function có tự gọi service/db.js để ĐỌC? → CẤM TUYỆT ĐỐI... Workflow
 *      tự đọc rồi truyền tham số xuống", readme/core-function-conventions.md) — Workflow thì được
 *      phép, đây chính xác là tầng "CHUẨN BỊ dữ liệu rồi truyền xuống Core" (Rule 3b).
 *
 *   2. **Validate** — CHỈ Song cần (lọc `confirmedBrokenKeys`/MIME/thiếu tag — nghiệp vụ THẬT SỰ
 *      khác, không phải khác giá trị cấu hình). `loadPlaylistCacheForSource()` dùng ĐÚNG 1 nhánh
 *      VMState theo `mediaSource === 'song'` để CÓ chạy bước này hay KHÔNG — guard clause chọn có
 *      chạy thêm 1 bước phụ hay bỏ qua, KHÔNG phải rẽ nhánh ≥2 tiến trình khác nhau cho CÙNG 1 việc
 *      (Rule 1 phân biệt rõ 2 trường hợp này) — Video/Photo đơn giản KHÔNG có bước phụ nào để chạy.
 *
 *   3. **Adapt** — `buildAdaptedPlaylistCache(records, mediaType)` (Video/Photo, dùng
 *      `MEDIA_ADAPTER_SHAPE`) hoặc `buildSongPlaylistCache(records)` (Song riêng — tag/cover đã có
 *      sẵn THẬT từ ID3, không synthesize như Video/Photo, xem docstring 2 hàm này ở
 *      core/playlist/loader.js) — VẪN tách hàm theo type ở bước NÀY vì đây mới là chỗ khác THUẬT
 *      TOÁN thật (nguồn field `tag`/`cover` khác nhau), không phải khác giá trị tham số hoá được.
 *
 * SỬA TIẾP (07/09/2026, Giang: "làm luôn đi chứ" — dứt điểm nợ kỹ thuật ghi ở đây trước đó) —
 * `initPlaylistFromDB()` (nhánh Song lúc app boot, core/playlist/loader.js) ĐÃ XOÁ HẲN cùng
 * `scanValidSongsFromDB()`: 2 việc CHỈ boot mới cần (hồi phục "Clear All bị gián đoạn" qua cờ
 * `clearingInProgress` + tối ưu "0 bài thì hiện luôn, không nháy loading") tách RA thành code
 * Workflow riêng NGAY TẠI `app-boot.js` (Rule 3 cho phép Workflow tự đọc DB) — CẢ BA Nguồn (Song/
 * Video/Photo) giờ ĐỀU gọi `loadPlaylistCacheForSource()` rồi để khối Scope chung SAU ĐÓ render
 * ĐÚNG 1 LẦN, không còn double-render nào sót lại lúc boot.
 */
// Registry Workflow (MỚI, 07/09/2026) — map `mediaSource` -> {getAllKeys, getRecord} ở tầng
// service/db.js, dùng bởi `listMediaRecords()` ngay dưới. Thêm 1 loại media MỚI chỉ cần thêm 1
// dòng ở đây (+ 1 entry `MEDIA_ADAPTER_SHAPE`, core/playlist/loader.js, nếu theo Adapter pattern
// như Video/Photo) — KHÔNG cần viết thêm hàm `listX()` nào ở tầng Core.
const MEDIA_DB_ACCESSOR = {
    song: { getAllKeys: getAllSongKeys, getRecord: getSongRecord },
    video: { getAllKeys: getAllVideoKeys, getRecord: getVideoRecord },
    photo: { getAllKeys: getAllImageKeys, getRecord: getImageRecord },
};

const workflowPlaylistScope = {

    /**
     * "Bước 1 — List" — xem docstring đầu file. Đọc TOÀN BỘ key rồi fetch từng record qua
     * `service/db.js` (registry `MEDIA_DB_ACCESSOR` quyết định ĐÚNG cặp hàm theo `mediaType`) —
     * CHUNG cho cả Song/Video/Photo, không phân biệt gì thêm ở đây (KHÔNG validate/adapt — 2 việc
     * đó là bước RIÊNG, xem `loadPlaylistCacheForSource()` ngay dưới).
     * @param {'song'|'video'|'photo'} mediaType
     * @param {(done:number,total:number)=>void} [onProgress]
     * @returns {Promise<Array<object>>} mảng record (đã gộp `key` vào từng object), record hỏng/rỗng đã lọc bỏ
     */
    async listMediaRecords(mediaType, onProgress) {
        const { getAllKeys, getRecord } = MEDIA_DB_ACCESSOR[mediaType];
        const keys = await getAllKeys();
        let done = 0;
        const records = await Promise.all(keys.map(async (key) => {
            const record = await getRecord(key);
            done++;
            if (typeof onProgress === 'function') onProgress(done, keys.length);
            return record ? { key, ...record } : null;
        }));
        return records.filter(Boolean);
    },

    /**
     * "Bước 1+2+3" gộp — xem docstring đầu file cho chi tiết từng bước. CHỈ nạp lại
     * `playlistCache`/`songNameIndex` cho ĐÚNG `mediaSource` (KHÔNG đụng `playlistOrder`/DOM — đó
     * là việc của `applyFolderScope()`/`applyAllSongsScope()` ngay dưới, nơi gọi PHẢI tự gọi 1
     * trong 2 hàm đó NGAY SAU).
     * @param {'song'|'video'|'photo'} mediaSource
     * @param {(done:number,total:number)=>void} [onProgress] - tuỳ chọn, hiện tiến trình "x/y" khi
     *        có (switchToXSource() truyền vào để cập nhật loadingText; app boot KHÔNG truyền).
     */
    async loadPlaylistCacheForSource(mediaSource, onProgress) {
        const records = await this.listMediaRecords(mediaSource, onProgress); // Bước 1 — List, CHUNG cho cả 3
        if (mediaSource === 'song') {
            // Bước 2 — Validate, CHỈ Song cần (guard clause "có bước phụ hay không", KHÔNG phải rẽ
            // nhánh ≥2 tiến trình cho CÙNG 1 việc — xem docstring đầu file).
            const validRecords = filterValidSongRecords(records, appState.get('confirmedBrokenKeys')); // core/playlist/loader.js
            buildSongPlaylistCache(validRecords); // Bước 3 — Adapt riêng Song (core/playlist/loader.js)
        } else {
            buildAdaptedPlaylistCache(records, mediaSource); // Bước 3 — Adapt Video/Photo, dùng MEDIA_ADAPTER_SHAPE (core/playlist/loader.js)
        }
    },

    /**
     * Lưu bền lựa chọn scope mới vào `meta` VÀ cập nhật `appState.activePlayListFolder` (bookkeeping
     * "ý định hiện tại", để badge/nút trong UI phản ánh đúng NGAY) — KHÔNG đụng
     * `playlistOrder`/DOM Playlist thật, đó là việc RIÊNG của `applyFolderScope()`/
     * `applyAllSongsScope()` ngay dưới, gọi NGAY SAU hàm này (SỬA 06/09/2026 — không còn tách rời
     * bằng `askReloadToApplyNow()` nữa, xem docstring đầu file).
     * SỬA (06/09/2026, Giang chốt "mỗi Nguồn tự nhớ folder riêng") — nhận thêm `mediaType`, chỉ
     * patch ĐÚNG field đó trong object `activePlayListFolder`, giữ nguyên 2 field còn lại — đổi
     * Nguồn không còn xoá mất lựa chọn Scope của Nguồn kia.
     * @param {string|null} folderId - null = bỏ scope (về "Tất cả bài")
     * @param {'song'|'video'|'photo'} mediaType - Nguồn ĐANG áp dụng/bỏ scope này — nơi gọi luôn
     *        đã biết chắc chắn đúng Nguồn nào (vd `this._readFolderRecord.type` ở Folder Browser
     *        Read), KHÔNG tự suy ra `activeMediaSource` ngầm bên trong (Rule 2).
     */
    async persistScopeChoice(folderId, mediaType) {
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId ?? null };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "persistScopeChoice", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        await setMeta('activePlayListFolder', next);
        // XOÁ (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") — lời gọi
        // `PlaylistMain.updateActiveFolderUI(...)` (khoá <select> Settings → Playlist) từng ở đây
        // đã bỏ — badge mới (`PlaylistMain.updateActiveFolderBadge()`) được gọi từ
        // `applyFolderScope()`/`applyAllSongsScope()` ngay dưới thay vì ở đây, vì đó mới là nơi
        // phản ánh SCOPE THẬT SỰ đang áp dụng (persistScopeChoice() chỉ lưu Ý ĐỊNH).
    },

    /**
     * Áp scope THẬT vào `playlistOrder`/DOM đang chạy. SỬA (06/09/2026, Giang chốt "bỏ hỏi
     * reload, áp sống luôn") — TRƯỚC ĐÂY chỉ dùng lúc BOOT; giờ gọi được BẤT KỲ LÚC NÀO scope đổi
     * (tap folder, toggle, gỡ hết item khỏi folder đang active, xoá folder, ĐỔI SANG 1 Nguồn khác
     * — xem event/workflow/playlist.js). Xem docstring đầu file cho đánh đổi CHỦ Ý về bài đang
     * phát nằm ngoài scope mới (không dừng, chỉ biến mất khỏi list).
     * SỬA (06/09/2026, per-source) — nhận `mediaType` thay vì tự đọc `appState.activeMediaSource`
     * bên trong: hàm này giờ CŨNG được gọi lúc ĐỔI SANG 1 Nguồn khác, tại thời điểm đó
     * `activeMediaSource` có thể đã đổi xong hay chưa tuỳ thứ tự gọi — dùng tham số tường minh
     * tránh phụ thuộc ngầm vào thứ tự đó (Rule 2).
     * @param {string} folderId
     * @param {'song'|'video'|'photo'} mediaType
     */
    async applyFolderScope(folderId, mediaType) {
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        // MỚI (06/09/2026, hợp nhất Folder vào Playlist, mục 4b — "Read-only", dùng Block gate chặn
        // upload) — đồng bộ `isActiveFolderReadOnly` (1 giá trị phẳng, xem service/state/
        // file-manager.js) NGAY khi 1 folder THẬT SỰ trở thành Scope — hàm này LUÔN chạy đúng lúc
        // `mediaType === activeMediaSource` (bất biến toàn hệ thống: tap tile/badge-X/switch-source
        // đều gọi hàm này cho ĐÚNG Nguồn đang hiển thị), nên không cần so sánh lại.
        const folderRecordForReadOnly = await getFolderRecord(folderId); // core/file-manager/folder.js
        appState.set('isActiveFolderReadOnly', !!(folderRecordForReadOnly && folderRecordForReadOnly.isReadOnly));

        await loadSongsFromFolder(folderId, appState.get('playlistCache'));
        // MỚI (mục 1d, Playlist Filter) — áp filter (nếu có) NGAY SAU khi playlistOrder vừa được
        // Scope tính lại theo folder, TRƯỚC updateShuffleArray()/recompute*Order() — xem docstring
        // đầu core/playlist/filter.js.
        const beforeCount = appState.get('playlistOrder').length; // MỚI (mục 2, log) — số lượng TRƯỚC khi lọc, để so log rõ ràng
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType]);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyFolderScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        updateEmptyState();
        // MỚI (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") — cập nhật badge
        // NGAY sau khi scope đã THẬT SỰ áp xong (không đặt ở persistScopeChoice() — xem docstring
        // hàm đó).
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderBadge();
    },

    /**
     * Áp "Tất cả bài" THẬT vào `playlistOrder`/DOM đang chạy, có lọc Exclude. SỬA (06/09/2026,
     * cùng lý do applyFolderScope() ngay trên) — TRƯỚC ĐÂY chỉ dùng lúc BOOT khi KHÔNG có
     * `activePlayListFolder` đã lưu; giờ CŨNG dùng cho nút X "thoát thư mục" (áp sống). Nhận
     * `mediaType` tường minh (Rule 2, cùng lý do applyFolderScope()) VÀ tự ghi
     * `activePlayListFolder[mediaType] = null` (trước đây hàm này không đụng field đó — chỉ đúng
     * lúc CHỈ được gọi khi vốn dĩ đã null sẵn; giờ còn được gọi để CHỦ ĐỘNG thoát 1 scope đang có,
     * nên phải tự dọn field này cho khớp thực tế, không phụ thuộc persistScopeChoice() đã chạy
     * trước đó hay chưa).
     * @param {'song'|'video'|'photo'} mediaType
     */
    async applyAllSongsScope(mediaType) {
        const current = appState.get('activePlayListFolder');
        if (current[mediaType] != null) {
            const next = { ...current, [mediaType]: null };
            appState.set('activePlayListFolder', next);
            console.log(`writer: "applyAllSongsScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        }
        // MỚI (06/09/2026, cùng lý do applyFolderScope() ngay trên) — không có folder Scope thì
        // chắc chắn không "read-only" gì cả.
        appState.set('isActiveFolderReadOnly', false);
        // FIX (Giang báo — "Exclude của Folder có thể loại nhầm media khác loại nếu key trùng") —
        // getExcludedSongKeysFromFolders() (core/file-manager/folder.js) nhận `mediaType` qua tham
        // số, CHỈ gom Exclude của ĐÚNG loại folder đang browse — dùng THẲNG tham số của chính hàm
        // này (SỬA 06/09/2026, trước đây tự đọc appState.get('activeMediaSource'), cùng lý do
        // applyFolderScope()).
        const excludedKeys = await getExcludedSongKeysFromFolders(mediaType); // core/file-manager/folder.js
        loadAllSongs(appState.get('playlistCache'), excludedKeys); // core/playlist/scope.js
        // MỚI (mục 1d, Playlist Filter) — CÙNG LÝ DO applyFolderScope() ngay trên.
        const beforeCount = appState.get('playlistOrder').length; // MỚI (mục 2, log)
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType]);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyAllSongsScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        updateEmptyState();
        // MỚI (06/09/2026) — CÙNG LÝ DO applyFolderScope() ngay trên.
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderBadge();
    },

    /**
     * Modal DÙNG CHUNG — hỏi "tải lại trang để áp dụng ngay không?". GIỮ NGUYÊN (KHÔNG xoá dù đã
     * bỏ dùng ở scope-theo-folder, 06/09/2026) — vẫn đang phục vụ
     * `event/workflow/playlist.js::applyFilterChanges()` (Playlist Filter, tính năng KHÁC).
     * @param {string} bodyText - nội dung mô tả CỤ THỂ vừa lưu gì (khác nhau tuỳ nơi gọi)
     */
    askReloadToApplyNow(bodyText) {
        modalChoice(
            bodyText,
            [
                { label: t('fileManager.song.folderDetail.reloadBtnNow'), className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors', onClick: () => { window.location.reload(); } }
            ],
            { title: t('fileManager.song.folderDetail.reloadTitle') }
        );
    }
};
