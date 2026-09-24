/**
 * playlist/loader.js — Nạp file mới (file picker) + quét nhanh store `songs` lúc khởi động.
 *
 * Sửa lỗi v6 (mục 2 + 6): SAU MỖI lần thêm bài, LUÔN gọi recomputeRenderOrder() rồi
 * renderPlaylistDiff() nên DANH SÁCH HIỂN THỊ được sắp xếp lại NGAY (kể cả đang phát), thay vì
 * phải chờ Next/Prev chạm biên. Việc nối-vào-cuối HÀNG ĐỢI PHÁT (applyNewSongsToDisplayOrder)
 * vẫn giữ nguyên — hai việc tách bạch, không ràng buộc nhau.
 */

        /**
         * Đọc duration 1 file qua thẻ Audio() tạm — CHỈ dùng lúc nạp file mới & quét sâu ở Quản lý
         * dung lượng (KHÔNG dùng lúc khởi động/quét nhanh). Có timeout an toàn cho Safari iOS.
         */
        function readAudioDuration(file) {
            return new Promise((resolve) => {
                let settled = false;
                const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
                let tempUrl;
                try { tempUrl = URL.createObjectURL(file); }
                catch (err) { console.error('[playlist] Không tạo được object URL để đọc duration:', err); return safeResolve(0); }
                const tempAudio = new Audio();
                const cleanup = () => { try { URL.revokeObjectURL(tempUrl); } catch (e) {} };
                const safetyTimeout = taskManager.once(() => { cleanup(); safeResolve(0); }, 8000);
                tempAudio.addEventListener('loadedmetadata', () => { safetyTimeout.kill(); const d = tempAudio.duration; cleanup(); safeResolve(isFinite(d) ? d : 0); });
                tempAudio.addEventListener('error', () => { safetyTimeout.kill(); cleanup(); safeResolve(0); });
                try { tempAudio.src = tempUrl; }
                catch (err) { safetyTimeout.kill(); cleanup(); safeResolve(0); }
            });
        }

        // DỜI (24/09/2026, dọn nợ "Core gọi Workflow") — `handleAudioFiles()` (shield + modal + tự appState + gọi
        // workflowPlaylistOrder/workflowPlaylistRender — thực chất là Workflow đặt ở core) sang event/workflow/
        // playlist.js::`workflowPlaylist.uploadSongs()`, thân giữ nguyên — đứng cạnh uploadVideos()/uploadPhotos().

        // FIX (ver 8 refine #2 — lỗi "chọn file/thư mục xong không nạp được gì, không báo lỗi"):
        // `e.target.files` là 1 FileList SỐNG (live reference) gắn trực tiếp với chính <input>.
        // Một số trình duyệt/WebView (đặc biệt qua `file://`, hoặc Android WebView cũ) làm RỖNG
        // luôn FileList đó NGAY khi `input.value` bị set lại — vì đây là CÙNG 1 object, không phải
        // bản sao, hành vi "reset value" ở các engine không chuẩn có thể dọn sạch nội dung FileList
        // luôn (kể cả đồng bộ, trước khi Array.from() bên trong handleAudioFiles() kịp đọc). Hậu
        // quả: handleAudioFiles() nhận về 1 danh sách rỗng -> `allFiles.length === 0` -> return im
        // lặng (xem dòng `if (allFiles.length === 0) return;` ở trên) — KHÔNG throw lỗi gì, KHÔNG
        // alert gì, người dùng chỉ thấy "chọn xong, không có gì xảy ra".
        // SỬA: chốt danh sách file ra 1 Array THẬT (Array.from) NGAY khi vào listener, TRƯỚC khi
        // đụng tới `e.target.value` — Array.from tạo bản sao độc lập, không còn bị ảnh hưởng bởi
        // bất kỳ thay đổi nào lên input sau đó.
        //
        // MIGRATE (kiến trúc /event/): việc "chốt FileList ra Array NGAY + reset input.value"
        // PHẢI làm trong listener thật (event/listener/playlist.js) — đây là hành vi gắn chặt với
        // chính sự kiện DOM 'change' (timing nhạy cảm như comment trên giải thích), không thể dời
        // vào core/router/workflow vì khi đó FileList có thể đã bị trình duyệt làm rỗng. Listener
        // gửi ĐÚNG Array đã chốt qua payload — router/handleAudioFiles() không cần biết gì về
        // input/FileList, chỉ nhận 1 Array file thuần.

        // ===================== Menu nhỏ cho nút "Thêm nhạc": Chọn file / Chọn cả thư mục =====================
        // Dùng CHUNG #song-action-overlay (đã có sẵn ở core/dom-refs.js, biến `songActionOverlay`
        // — KHÔNG tự tạo biến riêng `songActionOverlayForUpload` nữa, tránh 2 nguồn tham chiếu
        // cho cùng 1 phần tử DOM) để đóng khi bấm ra ngoài — tại 1 thời điểm chỉ 1 trong 2 menu
        // (#song-action-menu / #upload-action-menu) hiện, không xung đột. Cùng công thức định vị
        // "rect.bottom + 6, lật lên nếu tràn đáy màn hình" như openSongActionMenu() để 2 menu có
        // cảm giác nhất quán.
        //
        // FIX (ver 8 refine): 2 mục trong menu giờ là <label> bọc input thật (xem playlist-view.js)
        // — click tự nhiên lên label đã trigger input qua hành vi HTML chuẩn, KHÔNG cần gọi
        // fileInput.click()/folderInput.click() bằng JS nữa (cách cũ "treo" trên một số nền tảng,
        // xem comment ở playlist-view.js).
        // SỬA (FIX 28/07/2026, "bỏ dropdown Video, input luôn") — #video-upload-menu ĐÃ XOÁ (chỉ
        // còn Song dùng menu này) — dòng đóng `videoUploadMenu` đã bỏ.
        function closeUploadActionMenu() {
            uploadActionMenu.classList.add('hidden');
            songActionOverlay.classList.add('hidden');
        }

        /** Mở menu "Thêm nhạc" (Chọn file / Chọn cả thư mục) — core thuần, thuần UI tính vị trí. */
        function openUploadActionMenu() {
            const rect = btnUploadAudio.getBoundingClientRect();
            const menuWidth = 208;
            let left = rect.right - menuWidth;
            if (left < 8) left = 8;
            let top = rect.bottom + 8;
            const viewportH = window.innerHeight || 800;
            if (top + 110 > viewportH) top = rect.top - 110 - 8;
            uploadActionMenu.style.left = `${left}px`;
            uploadActionMenu.style.top = `${top}px`;
            uploadActionMenu.classList.remove('hidden');
            songActionOverlay.classList.remove('hidden');
        }

        // openVideoUploadMenu() (ver12 "Song/Video Unification", Batch 6, mục 7) ĐÃ XOÁ (FIX
        // 28/07/2026, "bỏ dropdown Video, input luôn") — #btn-upload-video giờ LÀ <label> bọc thẳng
        // input ở header (components/playlist-view.js), mở file picker NATIVE, không qua hàm này
        // nữa. [KHÔI PHỤC 29/07/2026] — khối <label> đó bị thiếu ở 1 lần đóng gói trước, đã chèn
        // lại đúng vị trí + nối lại toggle ẩn/hiện với #btn-upload-audio (switchSource(),
        // event/workflow/playlist.js).

        /**
         * Đóng menu sau khi bấm vào 1 trong 2 label — dùng taskManager.once(...,10) để KHÔNG ẩn
         * menu (classList.add('hidden')) NGAY trong cùng tick của sự kiện click: nếu ẩn ngay lập
         * tức, một số trình duyệt có thể chưa kịp xử lý xong việc click vào label kích hoạt input
         * bên trong nó (input đã bị display:none trước khi hộp thoại kịp mở) — đẩy việc đóng menu
         * ra sau 1 tick đảm bảo hộp thoại file picker đã được yêu cầu mở trước khi DOM bị ẩn.
         * @param {EventTarget} target - e.target gốc của click, để kiểm tra có trúng <label> không
         */
        function handleUploadMenuLabelClick(target) {
            if (target.closest('label')) taskManager.once(closeUploadActionMenu, 10);
        }

        // DỜI (24/09/2026) — `handleFilePickerChange()` (core gọi core handleAudioFiles) sang event/workflow/
        // playlist.js::`workflowPlaylist.handleSongFilePickerChange()`, thân giữ nguyên.

        // DỜI (24/09/2026) — `handleFolderPickerChange()` sang event/workflow/playlist.js::
        // `workflowPlaylist.handleSongFolderPickerChange()`, thân giữ nguyên.

        /**
         * ===================== Bảng cấu hình Adapter — MỚI (07/09/2026, gộp buildVideoPlaylistCache()/
         * buildPhotoPlaylistCache() cũ, Giang yêu cầu "thêm media sau này chỉ cần gửi type + shape,
         * không nhân bản hàm") =====================
         * THUẦN DỮ LIỆU (string/number/mảng tên field) — TUYỆT ĐỐI KHÔNG chứa function reference nào
         * (tránh lách Rule 3 "core cấm gọi core" qua đường vòng "gọi hàm khác qua tham số/cấu hình").
         * `buildAdaptedPlaylistCache()` ngay dưới đọc bảng này để quyết định GIÁ TRỊ fallback dùng
         * trong CÙNG 1 công thức — đây KHÔNG phải rẽ nhánh TIẾN TRÌNH theo Rule 1 (không có ≥2 kịch
         * bản/thuật toán khác nhau, chỉ 1 thuật toán DUY NHẤT được tham số hoá bằng dữ liệu).
         * - `coverFromOwnBlob` (boolean): cover fallback khi thiếu `thumbBlob` — `true` = dùng CHÍNH
         *   `record.blob` (Photo — "ảnh cover -> thumb của ảnh", hết thumb thì dùng ảnh gốc); `false`
         *   = không fallback, để `null` (Video — giữ NGUYÊN hành vi cũ).
         * - `durationFallback` (number): `record.duration || durationFallback`. Video giữ `0`
         *   (record Video LUÔN có `duration` thật từ lúc upload — `_extractVideoThumbAndMeta()`,
         *   event/workflow/playlist.js — `0` chỉ phòng record hỏng hiếm gặp, KHÔNG đổi hành vi thực
         *   tế). Photo giữ nguyên `5` (khớp `DURATION_MIN_SEC`, event/workflow/file-manager-photo.js
         *   — KHÔNG import hằng số đó vào đây, Core không phụ thuộc ngược Workflow; đổi
         *   `DURATION_MIN_SEC` thì sửa CẢ literal `5` này theo cho khớp).
         * - `extraFields` (string[]): tên field PHỤ copy thẳng từ `record` (fallback `0` nếu thiếu) —
         *   Photo có `width`/`height` (ảnh GỐC, KHÔNG có ở Song/Video — buildSongNode() đọc 2 field
         *   này thay `duration` khi `mediaType==='photo'` để hiện "WxH"); Video không có field phụ
         *   nào ngoài shape chung.
         * - `logLabel` (string): nhãn hiện trong `console.log` (thay cho tên hàm cũ dùng làm nhãn).
         *
         * MUỐN THÊM 1 loại media MỚI (miễn nó dùng CHUNG được cơ chế đọc DB "list toàn bộ key rồi
         * fetch từng record" — xem `workflowPlaylistScope.listMediaRecords()`/`MEDIA_DB_ACCESSOR`,
         * event/workflow/playlist-scope.js): chỉ cần thêm 1 entry vào bảng này (+ 1 entry vào
         * `MEDIA_DB_ACCESSOR` trỏ tới `{getAllKeys, getRecord}` của store đó, service/db.js) —
         * KHÔNG cần viết thêm 1 hàm `buildXPlaylistCache()`/`listX()` mới. Song KHÔNG dùng bảng này
         * (tag/cover đã có sẵn THẬT, không synthesize — xem `buildSongPlaylistCache()` ngay dưới).
         */
        const MEDIA_ADAPTER_SHAPE = {
            video: { coverFromOwnBlob: false, durationFallback: 0, extraFields: [], logLabel: 'Video' },
            photo: { coverFromOwnBlob: true, durationFallback: 5, extraFields: ['width', 'height'], logLabel: 'Photo' },
        };

        /**
         * ===================== Ver 12 "Song/Video Unification" — Batch 1 (mục 1, Adapter); GỘP
         * 07/09/2026 (xem `MEDIA_ADAPTER_SHAPE` ngay trên) =====================
         * Chuẩn hoá 1 mảng record Video/Photo (đọc từ store `videos`/`images`) thành ĐÚNG shape mà
         * `playlistCache` đang dùng cho Song — nhờ vậy `recomputeRenderOrder()`/
         * `recomputeDisplayOrder()`/`songMatchesQuery()`/`core/playlist/render.js` chạy NGUYÊN VẸN,
         * không cần biết gì về nguồn Video/Photo (xem plan-v12-song-video-unification.md mục 1).
         * Trước 07/09/2026 đây là 2 hàm riêng gần như GIỐNG HỆT nhau (`buildVideoPlaylistCache()`/
         * `buildPhotoPlaylistCache()`) — chỉ khác vài GIÁ TRỊ (fallback cover/duration, có field phụ
         * hay không), không khác THUẬT TOÁN, nên gộp thành 1 hàm + bảng cấu hình `MEDIA_ADAPTER_SHAPE`.
         *
         * Rule 2 — nhận `records` qua THAM SỐ (KHÔNG tự đọc DB ở đây — Rule 3 siết 03/08/2026 CẤM
         * Core tự gọi `service/db.js` để ĐỌC). Nơi gọi (Workflow — `event/workflow/playlist-scope.js::
         * loadPlaylistCacheForSource()`) tự `await this.listMediaRecords(mediaType)` TRƯỚC (đọc DB
         * qua `MEDIA_DB_ACCESSOR`, CÙNG file) rồi truyền kết quả vào đây.
         *
         * [SỬA — Giang chốt "dùng chung hết" 4 kiểu sort (az/za/newest/oldest) cho mọi Nguồn]
         * `songNameIndex` CŨNG populate cho Video/Photo — dùng `title` (customName hoặc filename bỏ
         * đuôi) làm "tên" để so az/za — CLEAR + rebuild lại TOÀN BỘ mỗi lần gọi hàm này, cùng cách
         * `playlistCache` đang làm (source đổi = thay hẳn toàn bộ danh sách, không cộng dồn).
         *
         * Rule 4 ngoại lệ (cùng lý do hot-path 60fps ở core-function-conventions.md — bulk-populate
         * 1 LƯỢT có thể hàng trăm/nghìn item, log MỖI vòng lặp gây spam console mà không thêm giá
         * trị truy vết) — chỉ log 1 lần TRƯỚC vòng lặp (clear) + 1 lần SAU vòng lặp (tổng số đã nạp),
         * không log riêng từng `mutate()` bên trong `for`.
         *
         * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, duration?:number, filename:string, customName?:string|null, album?:string|null, addedAt:number}>} records
         * @param {'video'|'photo'} mediaType
         * @returns {string[]} danh sách key hợp lệ (có blob gốc) vừa nạp vào playlistCache, theo ĐÚNG thứ tự records truyền vào (chưa sort — nơi gọi tự sortKeysByMode() sau).
         */
        function buildAdaptedPlaylistCache(records, mediaType) {
            const shape = MEDIA_ADAPTER_SHAPE[mediaType];
            appState.mutate('playlistCache', m => m.clear());
            appState.mutate('songNameIndex', m => m.clear());
            console.log(`writer: "buildAdaptedPlaylistCache", page: "playlistCache", content: "clear toàn bộ trước khi nạp ${shape.logLabel}"`);

            const validKeys = [];
            for (const record of records) {
                if (!record.blob) continue; // guard — record hỏng/thiếu blob gốc, bỏ qua (giống isQuickValidMime() của Song)
                validKeys.push(record.key);
                // MỚI (Batch 5, mục 6c) ưu tiên customName; SỬA (phản hồi Giang 28/07) bỏ đuôi mở
                // rộng khi rơi về filename gốc — CÙNG công thức cho cả Video/Photo (Photo: SỬA, Giang
                // yêu cầu Photo tích hợp duration như Song/Video, thêm rename qua tab "Sửa" — TRƯỚC
                // ĐÂY title LUÔN là filename, giờ ưu tiên customName giống Video).
                const title = record.customName || stripFileExtension(record.filename);
                const entry = {
                    filename: record.filename,
                    tag: { title, artist: '', album: record.album || '' }, // Adapter shape — artist LUÔN rỗng cho Photo, có giá trị thật cho Video nếu record.album có; SỬA (Giang yêu cầu — field Album) — đọc record.album thay vì hard-code rỗng, search/filter (order.js/filter.js) đã đọc field này SẴN
                    cover: record.thumbBlob || (shape.coverFromOwnBlob ? record.blob : null), // Blob THÔ — giống HỆT Song (record.cover) — buildSongNode() (core/playlist/render.js, dùng CHUNG, KHÔNG đụng) tự URL.createObjectURL(cached.cover) lúc render + tự revoke qua node._coverObjectUrl. KHÔNG được tự tạo URL ở đây (trước đây làm sai chỗ này -> render gọi createObjectURL() LẦN 2 trên 1 string, ném TypeError).
                    duration: record.duration || shape.durationFallback,
                    addedAt: record.addedAt,
                    mediaType,
                    size: record.blob.size || 0, // MỚI (mục 1e) — cùng lý do Song, xem comment ở buildSongPlaylistCache()
                };
                for (const field of shape.extraFields) entry[field] = record[field] || 0; // MỚI — field phụ theo type (vd width/height của Photo — modal Chi tiết, core/playlist/actions.js::openSongEditModal())
                appState.mutate('playlistCache', m => m.set(record.key, entry));
                appState.mutate('songNameIndex', m => m.set(record.key, normalizeSongName(title)));
            }
            console.log(`writer: "buildAdaptedPlaylistCache", page: "playlistCache", content: "đã nạp ${validKeys.length} ${shape.logLabel}"`);
            return validKeys;
        }

        /**
         * ===================== "Validate" — MỚI (07/09/2026, hợp nhất bước "List" cho cả 3 Nguồn qua
         * `workflowPlaylistScope.listMediaRecords()`, event/workflow/playlist-scope.js) =====================
         * CHỈ Song cần bước Validate RIÊNG (Video/Photo không cần — guard duy nhất `!record.blob` đã
         * nằm sẵn trong `buildAdaptedPlaylistCache()` ngay trên). Lọc bỏ record hỏng/không hợp lệ —
         * Y HỆT 3 điều kiện `continue` trong `scanValidSongsFromDB()` cũ (hàm đó ĐÃ XOÁ 07/09/2026
         * cùng đợt — cùng `initPlaylistFromDB()`, không còn nơi nào gọi tới sau khi app-boot.js
         * cũng chuyển hẳn sang gọi `loadPlaylistCacheForSource()`, xem event/workflow/app-boot.js):
         * - đã đánh dấu hỏng (`confirmedBrokenKeys`, xác nhận thủ công qua modal báo lỗi phát nhạc)
         * - thiếu `blob` (file gốc) hoặc `tag` (metadata ID3 đọc lúc upload)
         * - MIME không hợp lệ (`isQuickValidMime()`, service/db.js — utility thuần, không phải đọc
         *   DB, được phép gọi từ Core)
         *
         * Rule 2 — nhận `confirmedBrokenKeys` qua THAM SỐ (Workflow tự `appState.get()` trước).
         * @param {Array<{key:string, blob?:Blob, tag?:object}>} records
         * @param {Set<string>} confirmedBrokenKeys
         * @returns {Array} records hợp lệ, GIỮ NGUYÊN thứ tự records truyền vào
         */
        function filterValidSongRecords(records, confirmedBrokenKeys) {
            return records.filter((record) =>
                !confirmedBrokenKeys.has(record.key) &&
                record.blob &&
                record.tag &&
                isQuickValidMime(record.blob.type)
            );
        }

        /**
         * "Adapt" — CHỈ Song. KHÁC `buildAdaptedPlaylistCache()` (Video/Photo): Song record đã có
         * `tag` (title/artist/album THẬT, đọc ID3 lúc upload qua jsmediatags) VÀ `cover` (Blob ảnh
         * bìa nhúng trong file, nếu có) — dùng THẲNG, KHÔNG synthesize từ filename như Video/Photo
         * (2 nguồn đó không có ID3, phải tự bịa `tag.title` từ tên file). Vì khác NHAU về CHÍNH
         * NGUỒN DỮ LIỆU field `tag`/`cover` (không phải khác giá trị fallback), không nhét được vào
         * chung `MEDIA_ADAPTER_SHAPE`/`buildAdaptedPlaylistCache()` — giữ hàm riêng, ĐÚNG Rule 1
         * (khác thuật toán thật, không phải khác tham số hoá được bằng dữ liệu).
         * SỬA (Giang báo bug "Xoá Song không hoạt động") — TRƯỚC ĐÂY cố tình KHÔNG set `mediaType`
         * cho Song (lý do gốc: buildSongNode() rẽ UI qua `cached.mediaType === 'video'`/`'photo'`,
         * Song là nhánh else nên "không cần đánh dấu" — ĐÚNG cho KIỂU SO SÁNH ĐÓ, undefined !==
         * 'video' vẫn rơi đúng nhánh else). NHƯNG `deleteMediaFromActionMenu()` (event/workflow/
         * playlist.js) lại dùng `mediaType` làm KEY tra bảng (`MEDIA_DELETE_ACCESSOR[mediaType]`) —
         * kiểu dùng này CẦN giá trị THẬT là chuỗi 'song', `undefined` tra bảng ra `undefined`, phá
         * huỷ (`{getRecord,deleteRecord} = undefined` ném lỗi ngay, âm thầm vì nằm trong async
         * callback của withLoadingShield không ai bắt) — ĐÚNG lý do "Xoá bài hát không phản ứng gì"
         * trong khi Xoá Video/Photo vẫn bình thường (2 loại đó luôn có `mediaType` thật). Set thẳng
         * `mediaType: 'song'` ở đây — AN TOÀN 100% với mọi chỗ đang so `=== 'video'`/`=== 'photo'`
         * (đã rà toàn bộ project, không chỗ nào check kiểu `typeof cached.mediaType === 'undefined'`
         * để phân biệt Song) — chỉ thêm dữ liệu, không đổi ý nghĩa bất kỳ so sánh nào đang có.
         *
         * Rule 4 ngoại lệ (cùng lý do hot-path — xem `buildAdaptedPlaylistCache()` ngay trên).
         * @param {Array<{key:string, blob:Blob, tag:object, cover?:Blob, duration:number, filename:string, addedAt:number}>} records - ĐÃ qua `filterValidSongRecords()`
         * @returns {string[]} danh sách key vừa nạp vào playlistCache, ĐÚNG thứ tự records truyền vào (chưa sort — nơi gọi tự sortKeysByMode() sau).
         */
        function buildSongPlaylistCache(records) {
            appState.mutate('playlistCache', m => m.clear());
            appState.mutate('songNameIndex', m => m.clear());
            console.log(`writer: "buildSongPlaylistCache", page: "playlistCache", content: "clear toàn bộ trước khi nạp Song"`);

            const validKeys = [];
            for (const record of records) {
                validKeys.push(record.key);
                appState.mutate('playlistCache', m => m.set(record.key, {
                    filename: record.filename,
                    tag: record.tag, // dùng THẲNG — khác Video/Photo (synthesize), xem docstring
                    cover: record.cover,
                    duration: record.duration,
                    addedAt: record.addedAt,
                    size: record.blob.size || 0, // MỚI (mục 1e) — cùng lý do buildAdaptedPlaylistCache()
                    mediaType: 'song', // MỚI (FIX bug "Xoá Song không hoạt động") — xem docstring hàm này ngay trên
                }));
                appState.mutate('songNameIndex', m => m.set(record.key, normalizeSongName(record.tag.title)));
            }
            console.log(`writer: "buildSongPlaylistCache", page: "playlistCache", content: "đã nạp ${validKeys.length} bài hát"`);
            return validKeys;
        }
