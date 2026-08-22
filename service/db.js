/**
 * service/db.js — CHUYỂN từ `service/db.js` (04/07/2026, phản hồi Giang mục 2: đây là DỊCH VỤ HẠ
 * TẦNG dùng chung toàn app — lớp truy cập IndexedDB thuần, không phải NGHIỆP VỤ — nên thuộc nhóm
 * `service/` cùng `state.js`/`task-manager.js`/`operation.js`, không phải `core/`). KHÔNG đổi
 * logic bên trong, chỉ đổi đường dẫn file + đường dẫn `<script>` trong index.html.
 *
 * Lớp truy cập IndexedDB cho toàn bộ app, dựa trên idb-keyval (UMD, nạp qua CDN trong <head>).
 * Quản lý 2 store riêng trong database `musicPlayerDB`:
 *   - `songs`: mỗi record 1 bài hát (xem schema trong PLAN_INDEXEDDB.md mục 1).
 *   - `meta`:  key-value đơn lẻ (playlistOrder, totalListenSeconds, bgImage, videoBg).
 * Tách 2 store riêng để computeStats() (about-stats.js) chỉ cần liệt kê đúng store `songs`,
 * không lẫn key của ảnh/video nền hay playlistOrder.
 *
 * QUAN TRỌNG — KHÔNG dùng 2 lệnh `idbKeyval.createStore(DB_NAME, ...)` độc lập (1 cho mỗi store)
 * như cách làm tưởng chừng hợp lý: mỗi lệnh đó tự gọi `indexedDB.open(DB_NAME)` RIÊNG, không version
 * cụ thể. `onupgradeneeded` chỉ chạy đúng 1 lần khi DB được tạo (version 0 -> 1) — connection nào
 * "thắng" race đó quyết định CHỈ store của lệnh đó được tạo thật. Tuỳ thứ tự tính năng nào được
 * dùng trước (nạp nhạc trước hay đổi ảnh nền trước), người dùng có thể kẹt với DB chỉ có 1 trong 2
 * store ('songs' hoặc 'meta'), gây lỗi `NotFoundError: One of the specified object stores was not
 * found` ngay khi đụng tới store còn thiếu — và vì đây xảy ra ngay ở lần mở DB đầu tiên trên máy đó,
 * lỗi sẽ lặp lại ở MỌI lần sau cho tới khi sửa đúng cách (xoá DB thủ công không phải giải pháp tốt
 * vì mất hết nhạc/ảnh đã lưu).
 *
 * Cách sửa: tự quản lý `indexedDB.open(DB_NAME, DB_VERSION)` ĐÚNG MỘT LẦN, tạo CẢ HAI store trong
 * cùng một `onupgradeneeded` (idempotent — kiểm tra `objectStoreNames.contains` trước khi tạo, để
 * vẫn chạy đúng cho DB cũ chỉ có sẵn 1 trong 2 store, tự bổ sung store còn thiếu mà KHÔNG mất data
 * đã có ở store kia). Sau đó bọc lại thành 2 "store accessor" cùng signature mà idb-keyval cần
 * (`(txMode, callback) => Promise`), để toàn bộ chỗ gọi `idbKeyval.get/set/del/keys(key, songsStore)`
 * ở các file khác (playlist.js, player-controls.js, about-stats.js...) không cần đổi gì.
 *
 * PHẢI nạp SỚM trong index.html (đầu nhóm core/), TRƯỚC playlist.js, player-controls.js,
 * equalizer-settings.js, subtitles.js, about-stats.js, id3-export.js — các file đó gọi
 * hàm helper định nghĩa ở đây.
 *
 * FIX (log 9->10, nguyên nhân gốc rễ THẬT của "không ra tiếng dù vẫn next/prev/cache list bình
 * thường" — phát hiện qua phân tích log unhandled-rejection + xác nhận bằng tài liệu IndexedDB):
 * `dbReadyPromise` (bản trước) là 1 `new Promise(...)` resolve/reject ĐÚNG 1 LẦN trong đời app —
 * mọi `makeStoreAccessor()` sau đó `.then((db) => ...)` lại CHÍNH connection `db` đã cache từ
 * lần resolve đầu tiên đó, vĩnh viễn, không bao giờ mở lại. Trên iOS Safari, khi tab/app bị ẩn đủ
 * lâu, trình duyệt có thể tự ĐÓNG connection IndexedDB đang mở để giải phóng tài nguyên (xem
 * IDBDatabase: 'close' event — MDN; cũng được xác nhận là hành vi thật gặp trên Chromium/WebKit
 * khi switch app rồi quay lại) — đây KHÔNG phải app tự gọi `db.close()`, mà do hệ điều hành/trình
 * duyệt áp đặt từ ngoài, đúng kiểu với việc AudioContext bị chuyển 'interrupted' (đã sửa ở mục 3).
 * Biến `db` trong closure của `makeStoreAccessor` vẫn TỒN TẠI trong RAM (không bị xoá), nhưng MỌI
 * lệnh `db.transaction(...)` gọi trên nó sau khi đã đóng đều THROW `InvalidStateError` — và vì
 * không có cơ chế phát hiện việc này + mở lại connection mới, MỌI truy vấn IndexedDB sau đó
 * (đọc bài hát, đọc/ghi thống kê...) vĩnh viễn thất bại cho tới khi reload trang.
 *
 * Đây giải thích ĐÚNG NGUYÊN VĂN hành vi quan sát được: playlist (đã load vào RAM —
 * `playlistCache`/`songNameIndex` — từ lúc mở app, KHÔNG cần đọc lại IndexedDB) vẫn hiển thị và
 * Next/Prev vẫn "chạy" được (chỉ tính index trong RAM, xem playNext()/playPrev()) — nhưng
 * `playSong()` cần `await getSongRecord(key)` (đọc blob THẬT từ IndexedDB) để có dữ liệu tạo
 * `audioPlayer.src` — lệnh đó throw, hàm `playSong()` dừng đột ngột tại dòng đó, KHÔNG BAO GIỜ
 * chạy tới `audioPlayer.src = ...`/`audioPlayer.play()` — audio element vẫn được tạo bình thường
 * (không crash gì), chỉ là không có dữ liệu thật nào được gán vào để phát, nên hoàn toàn im lặng.
 *
 * Giải pháp — 2 lớp bảo vệ, không phụ thuộc lẫn nhau (đề phòng lớp 1 bị bỏ lỡ):
 *   1. Gắn `db.onclose` ngay khi connection mở thành công — khi trình duyệt tự đóng connection,
 *      lập tức thay `dbReadyPromise` bằng 1 lượt `openDatabase()` MỚI, để lần `.then()` kế tiếp tự
 *      nhận được connection mới, không cần ai gọi gì thêm.
 *   2. PHÒNG TRƯỜNG HỢP `onclose` không bắn kịp/bị bỏ lỡ (đã ghi nhận thực tế là có thể xảy ra —
 *      xem báo cáo Chromium): `makeStoreAccessor()` tự bắt lỗi `db.transaction()` throw vì
 *      connection chết (`InvalidStateError`, hoặc message chứa "closing"/"closed"), TỰ mở 1
 *      connection mới (gọi `openDatabase()` trực tiếp, không chờ `dbReadyPromise` cũ) và RETRY
 *      đúng 1 lần trên connection mới đó trước khi để lỗi propagate ra ngoài — không retry vô hạn
 *      (tránh loop nếu lỗi thật là do dữ liệu/quyền, không phải do connection chết).
 */
        const DB_NAME = 'musicPlayerDB';
        // ver 12 "Multi Media" (plan-v12-multimedia.md mục 2/4): tăng lên 4 để buộc onupgradeneeded
        // chạy lại, tự bổ sung 5 store còn thiếu cho DB cũ (v1/v2/v3) — KHÔNG mất dữ liệu
        // songs/meta/languages đã có. 5 store mới:
        //   - 'folders'     : metadata folder nhạc, key = folderId, value = { id, name }.
        //   - 'folder_song' : mapping folderId -> danh sách bài trong folder, key = folderId,
        //                     value = { list: [songKey|null, ...], empty: number } (tombstone
        //                     null khi gỡ bài khỏi folder, KHÔNG splice — xem plan-v12 mục 4.b1
        //                     "Schema — CHỐT bản đơn giản hoá cuối").
        //   - 'images'      : ảnh người dùng thêm vào File Manager, key = imageKey, value =
        //                     { blob, filename, addedAt }.
        //   - 'albums'      : ĐÃ NGỪNG DÙNG (loại bỏ Album khỏi Photo Panel) — KHÔNG còn tạo mới
        //                     cho lần cài đặt mới (đã bỏ khỏi khối tạo store bên dưới); store cũ
        //                     (nếu người dùng từng có) vẫn còn tồn tại "mồ côi" trong IndexedDB —
        //                     CỐ Ý không xoá cứng qua deleteObjectStore() để tránh mất dữ liệu ngoài
        //                     phạm vi yêu cầu (chỉ gỡ TÍNH NĂNG, không chủ động xoá dữ liệu cũ).
        //   - 'documents'   : ĐÃ NGỪNG DÙNG (loại bỏ Document Reader khỏi app) — KHÔNG còn tạo mới
        //                     cho lần cài đặt mới (đã bỏ khỏi khối tạo store bên dưới); store cũ
        //                     (nếu người dùng từng có) vẫn còn tồn tại "mồ côi" trong IndexedDB —
        //                     CỐ Ý không xoá cứng qua deleteObjectStore() để tránh mất dữ liệu ngoài
        //                     phạm vi yêu cầu (chỉ gỡ TÍNH NĂNG, không chủ động xoá dữ liệu cũ).
        // MỚI (21/07/2026, module File Manager -> Video) — tăng lên 5, thêm 1 store nữa:
        //   - 'videos'      : video người dùng thêm vào File Manager, key = videoKey, value =
        //                     { blob, thumbBlob, width, height, duration, filename, addedAt } —
        //                     CÙNG SCHEMA `images` (xem `thumbBlob`/`width`/`height` ở comment
        //                     store 'images' trên) + thêm `duration` (giây, số thực, đo lúc upload
        //                     — event/workflow/file-manager-video.js).
        // Field `folder: { [folderId]: position }` trên record của store 'songs' KHÔNG cần đổi
        // version DB (IndexedDB không ràng buộc schema trong value của 1 store) — chỉ cần các core
        // function đọc/ghi record 'songs' biết thêm field này khi cần (việc của bước sau, xem
        // plan-v12 mục 5 bước 2-3), KHÔNG thuộc phạm vi hạ tầng DB ở bước này.
        const DB_VERSION = 5;

        // FIX (11/07/2026, phát hiện qua bảng debug log MỚI trên subtitle-editor.html — xem
        // ReferenceError "Can't find variable: appState" + "Cannot access 'songsStore' before
        // initialization") — NGUYÊN NHÂN GỐC của toàn bộ vụ "subtitle editor không nạp được blob"
        // điều tra trước đây: cơ chế cache `dbReadyPromise` (xem comment gốc phía dưới, mục "iOS
        // Safari tự đóng connection") dùng THẲNG `appState.set()/get()` (service/state.js) — file
        // service/db.js NÀY dùng CHUNG cho CẢ index.html (CÓ nạp service/state.js) LẪN
        // subtitle-editor.html (CHỦ Ý KHÔNG nạp service/state.js, xem đầu event/workflow/subtitle-
        // editor.js). Trên trang sau, `appState` không tồn tại -> `appState.set(...)` ở dòng ngay
        // dưới (chạy Ở TOP-LEVEL của file, KHÔNG phải trong callback) ném ReferenceError NGAY LẬP
        // TỨC lúc file này được nạp — cắt đứt hẳn phần CÒN LẠI của file phía sau nó (mọi
        // `const xStore = makeStoreAccessor(...)` KHÔNG BAO GIỜ chạy tới), nên `songsStore` vĩnh
        // viễn kẹt ở trạng thái "khai báo nhưng chưa gán" (temporal dead zone) — bất kỳ hàm nào gọi
        // tới nó sau đó (getSongRecord, setSongRecord...) đều throw "Cannot access 'songsStore'
        // before initialization", đúng y hệt lỗi quan sát được.
        //
        // 2 hàm nhỏ dưới đây THAY THẾ trực tiếp mọi lời gọi appState.set('dbReadyPromise', ...)/
        // appState.get('dbReadyPromise') — dùng appState NẾU CÓ (index.html, giữ NGUYÊN hành vi cũ
        // hệt, không đổi gì), fallback về 1 biến module-scope RIÊNG nếu không có (subtitle-
        // editor.html) — cơ chế "tự mở lại connection khi bị đóng ngoài ý muốn" vẫn hoạt động đúng
        // ở CẢ 2 trang, chỉ khác chỗ lưu tạm.
        let _dbReadyPromiseLocalFallback = null;
        function _setDbReadyPromise(promise) {
            if (typeof appState !== 'undefined') { appState.set('dbReadyPromise', promise); return; }
            _dbReadyPromiseLocalFallback = promise;
        }
        function _getDbReadyPromise() {
            if (typeof appState !== 'undefined') return appState.get('dbReadyPromise');
            return _dbReadyPromiseLocalFallback;
        }

        /** Mở 1 connection IndexedDB mới — tách hàm riêng để có thể gọi lại khi connection cũ chết. */
        function openDatabase() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs');
                    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
                    // 'languages' (lang.js, batch i18n): key = mã ngôn ngữ (vd 'vi', 'fr'), value =
                    // { meta: {code, name}, keys: {...} } đã validate (diff với en default — xem
                    // saveLanguagePack() ở lang.js). 'en' KHÔNG nằm trong store này — nó nằm cứng
                    // trong RAM (const trong lang.js), không qua IndexedDB.
                    if (!db.objectStoreNames.contains('languages')) db.createObjectStore('languages');
                    // ver 12 "Multi Media" (plan-v12-multimedia.md) — 5 store mới, xem comment
                    // đầy đủ ở khai báo DB_VERSION phía trên. Idempotent giống 'languages' ở trên,
                    // để DB cũ (v1-v3) tự bổ sung mà không mất dữ liệu store khác đã có.
                    if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders');
                    if (!db.objectStoreNames.contains('folder_song')) db.createObjectStore('folder_song');
                    if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
                    // XOÁ (loại bỏ Album khỏi Photo Panel) — ngừng tạo store 'albums' cho lần cài
                    // đặt mới (xem comment ở khai báo DB_VERSION phía trên).
                    // XOÁ (loại bỏ Document Reader khỏi app) — ngừng tạo store 'documents' cho lần
                    // cài đặt mới (xem comment ở khai báo DB_VERSION phía trên).
                    if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos'); // MỚI (21/07/2026, module Video)
                };
                request.onsuccess = () => {
                    const db = request.result;
                    // (1) Phát hiện việc trình duyệt tự đóng connection (tab/app bị ẩn lâu trên iOS,
                    // v.v.) — mở sẵn 1 connection MỚI ngay lập tức để lần truy vấn kế tiếp dùng được
                    // luôn, không phải đợi tới khi truy vấn đó thất bại rồi mới biết để mở lại.
                    db.onclose = () => {
                        console.warn('[db] Connection IndexedDB bị đóng ngoài ý muốn (có thể do tab/app vừa bị ẩn lâu) — tự mở lại connection mới.');
                        _setDbReadyPromise(openDatabase());
                    };
                    resolve(db);
                };
                request.onerror = () => reject(request.error);
                request.onblocked = () => console.warn('[db] Mở IndexedDB bị "blocked" — có tab/cửa sổ khác đang giữ kết nối DB phiên bản cũ. Đóng các tab khác của trang này rồi tải lại.');
            });
        }

        _setDbReadyPromise(openDatabase());

        /** true nếu lỗi rõ ràng là do connection IndexedDB đã chết (không phải lỗi dữ liệu/quyền khác). */
        function isDeadConnectionError(err) {
            const name = err && err.name;
            const msg = (err && err.message || '').toLowerCase();
            return name === 'InvalidStateError' || msg.includes('closing') || msg.includes('closed') || msg.includes('connection is closing');
        }

        /**
         * Tạo 1 "store accessor" tương thích đúng signature mà idb-keyval cần
         * ((txMode, callback) => Promise), dùng chung 1 connection DB đã mở sẵn ở trên — thay cho
         * idbKeyval.createStore() (nguồn gốc lỗi race condition ở trên).
         *
         * (2) Lớp bảo vệ thứ hai: nếu db.transaction() throw vì connection đã chết (phòng trường
         * hợp onclose ở openDatabase() không bắn kịp/bị bỏ lỡ), tự mở 1 connection MỚI và retry
         * đúng 1 lần trên đó trước khi để lỗi bay ra ngoài.
         */
        function makeStoreAccessor(storeName) {
            return (txMode, callback) => _getDbReadyPromise().then((db) => {
                try {
                    return callback(db.transaction(storeName, txMode).objectStore(storeName));
                } catch (err) {
                    if (!isDeadConnectionError(err)) throw err; // lỗi khác (không liên quan connection chết) — không retry, để nguyên lỗi gốc
                    console.warn(`[db] Connection IndexedDB đã chết lúc mở transaction (store "${storeName}") — tự mở connection mới và thử lại 1 lần.`, err);
                    _setDbReadyPromise(openDatabase());
                    return _getDbReadyPromise().then((freshDb) => callback(freshDb.transaction(storeName, txMode).objectStore(storeName)));
                }
            });
        }

        const songsStore = makeStoreAccessor('songs');
        const metaStore = makeStoreAccessor('meta');
        const languagesStore = makeStoreAccessor('languages');
        // ver 12 "Multi Media" — accessor cho 5 store mới (xem comment ở DB_VERSION).
        const foldersStore = makeStoreAccessor('folders');
        const folderSongStore = makeStoreAccessor('folder_song');
        const imagesStore = makeStoreAccessor('images');
        // XOÁ (loại bỏ Album khỏi Photo Panel) — ngừng khai báo accessor 'albums' cho lần cài đặt
        // mới (store cũ, nếu có, vẫn còn "mồ côi" trong IndexedDB — xem comment ở DB_VERSION).
        const videosStore = makeStoreAccessor('videos'); // MỚI (21/07/2026, module Video)

        /** CRUD cho store 'languages' — dùng bởi lang.js (saveLanguagePack/applySavedLanguage/
         * deleteLanguagePack). Key luôn là mã ngôn ngữ (vd 'vi'), KHÔNG bao giờ là 'en' (en nằm
         * cứng trong RAM, không qua IndexedDB — xem comment đầu lang.js). */
        function getLanguagePack(code) { return idbKeyval.get(code, languagesStore); }
        function setLanguagePack(code, pack) { return idbKeyval.set(code, pack, languagesStore); }
        function deleteLanguagePack(code) { return idbKeyval.del(code, languagesStore); }
        function getAllLanguageCodes() { return idbKeyval.keys(languagesStore); }

        /** CRUD thô cho 5 store mới ver 12 "Multi Media" (plan-v12-multimedia.md) — chỉ đọc/ghi
         * NGUYÊN VẸN theo key, KHÔNG chứa nghiệp vụ (tạo id, cascade tombstone folder, validate
         * upload...) — nghiệp vụ đó thuộc core function riêng ở bước sau (mục 5 bước 2 trở đi
         * của plan), đúng Rule 1 core-function-conventions.md (đơn tuyến, không gộp nghiệp vụ vào
         * lớp truy cập DB). */
        function getFolderRecord(folderId) { return idbKeyval.get(folderId, foldersStore); }
        function setFolderRecord(folderId, record) { return idbKeyval.set(folderId, record, foldersStore); }
        function deleteFolderRecord(folderId) { return idbKeyval.del(folderId, foldersStore); }
        function getAllFolderKeys() { return idbKeyval.keys(foldersStore); }

        function getFolderSongMap(folderId) { return idbKeyval.get(folderId, folderSongStore); }
        function setFolderSongMap(folderId, map) { return idbKeyval.set(folderId, map, folderSongStore); }
        function deleteFolderSongMap(folderId) { return idbKeyval.del(folderId, folderSongStore); }
        // MỚI (04/07/2026, tính năng dọn rác File Manager) — cần liệt kê ĐÚNG key của CHÍNH store
        // 'folder_song' (khác getAllFolderKeys() — store 'folders') để phát hiện mục mồ côi (map
        // còn sống nhưng 'folders' tương ứng đã bị xoá — xem core/file-manager/cleanup.js).
        function getAllFolderSongKeys() { return idbKeyval.keys(folderSongStore); }

        function getImageRecord(imageKey) { return idbKeyval.get(imageKey, imagesStore); }
        function setImageRecord(imageKey, record) { return idbKeyval.set(imageKey, record, imagesStore); }
        function deleteImageRecord(imageKey) { return idbKeyval.del(imageKey, imagesStore); }
        function getAllImageKeys() { return idbKeyval.keys(imagesStore); }

        // XOÁ (loại bỏ Album khỏi Photo Panel) — CRUD 'albums' (getAlbumRecord/setAlbumRecord/
        // deleteAlbumRecord/getAllAlbumKeys) bỏ hẳn cùng tính năng.

        // XOÁ (loại bỏ Document Reader khỏi app) — CRUD 'documents' (getDocumentRecord/
        // setDocumentRecord/deleteDocumentRecord/getAllDocumentKeys) bỏ hẳn cùng tính năng.

        // MỚI (21/07/2026, module File Manager -> Video) — CRUD thô, cùng khuôn 'images' ở trên.
        function getVideoRecord(videoKey) { return idbKeyval.get(videoKey, videosStore); }
        function setVideoRecord(videoKey, record) { return idbKeyval.set(videoKey, record, videosStore); }
        function deleteVideoRecord(videoKey) { return idbKeyval.del(videoKey, videosStore); }
        function getAllVideoKeys() { return idbKeyval.keys(videosStore); }


        /**
         * slugify: hạ thường, bỏ dấu tiếng Việt, bỏ ký tự đặc biệt, nối bằng "-".
         * Kết quả chỉ gồm [a-z0-9-], dùng trực tiếp làm id HTML / data-key.
         */
        function slugify(filename) {
            const noExt = filename.replace(/\.[^/.]+$/, "");
            return noExt
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu (Unicode combining marks)
                .replace(/đ/g, 'd')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                || 'song';
        }

        /**
         * Resolve key cho 1 file mới nạp, theo thuật toán mục 2 của plan:
         *   - slug chưa tồn tại -> dùng slug làm key.
         *   - slug đã tồn tại, filename TRÙNG -> ghi đè (trả lại đúng slug đó).
         *   - slug đã tồn tại, filename KHÁC -> thêm hậu tố số (slug-2, slug-3, ...).
         */
        async function resolveSongKey(filename) {
            const baseSlug = slugify(filename);
            let candidate = baseSlug;
            let suffix = 2;
            while (true) {
                const existing = await idbKeyval.get(candidate, songsStore);
                if (!existing) return candidate; // slug trống -> dùng luôn
                if (existing.filename === filename) return candidate; // cùng bài -> ghi đè đúng key này
                candidate = `${baseSlug}-${suffix}`; suffix++;
            }
        }

        function getSongRecord(key) { return idbKeyval.get(key, songsStore); }
        function setSongRecord(key, record) { return idbKeyval.set(key, record, songsStore); }
        function deleteSongRecord(key) { return idbKeyval.del(key, songsStore); }
        function getAllSongKeys() { return idbKeyval.keys(songsStore); }

        /**
         * FIX (lỗi decode khi nghe lại 1 bài NGAY SAU KHI sửa info/lưu phụ đề, không cần reload mới
         * hết — phát hiện tại applySongEditAndSave() ở playlist/actions.js, cùng gốc với
         * saveToDatabase() ở event/workflow/subtitle-editor.js, trang riêng):
         *
         * Cả 2 chỗ trên đều theo đúng pattern "đọc nguyên record (gồm cả `blob` audio) qua
         * getSongRecord() -> chỉ sửa field KHÁC (tag/subtitles) -> setSongRecord() ghi LẠI NGUYÊN
         * record đó, gồm cả field `blob`" — dù KHÔNG đổi 1 byte nội dung file nhạc, `blob` ghi xuống
         * vẫn ĐÚNG CHÍNH Blob handle vừa đọc lên (nguồn gốc từ IndexedDB, không phải File gốc từ máy
         * người dùng). Chromium xử lý kiểu "ghi đè lại đúng Blob đã đọc từ chính nó" này không ổn
         * định trong CÙNG 1 phiên/connection: khi Next/Prev hay bấm phát lại bài đó (luồng đầy đủ
         * trong playSong() — getSongRecord() + URL.createObjectURL(record.blob) MỚI), backing file
         * cũ có thể đã bị coi là "đã thay thế" trong khi audioPlayer cần đọc lại đúng backing file
         * đó NGAY trong phiên hiện tại -> lỗi decode. Dữ liệu ĐÃ commit đúng xuống đĩa (mở connection
         * IndexedDB MỚI sau khi reload trang đọc lại hoàn toàn bình thường — đúng triệu chứng quan
         * sát được thực tế: "sửa xong nghe lỗi, reload vào nghe lại bình thường").
         *
         * Né bằng cách "vật chất hoá" lại record.blob thành 1 Blob HOÀN TOÀN MỚI (đọc hẳn bytes vào
         * RAM rồi bọc lại bằng `new Blob(...)`) NGAY TRƯỚC khi setSongRecord() — Blob mới này không
         * còn dính dáng gì tới backing file cũ của IndexedDB, ghi xuống xong đọc lại trong CÙNG phiên
         * vẫn ổn định bình thường.
         *
         * CHỈ gọi hàm này khi `record.blob` THỰC SỰ tới từ 1 lượt getSongRecord() trước đó (round-
         * trip qua IndexedDB) — KHÔNG gọi cho bản ghi MỚI nạp lần đầu (loader.js, record.blob =
         * File gốc từ input chọn file của người dùng, CHƯA từng qua IndexedDB lần nào): không cần
         * thiết, chỉ tốn thời gian đọc nguyên file nhạc vào RAM thêm 1 lần vô ích lúc upload hàng
         * loạt nhiều bài.
         *
         * @param {Blob} blob
         * @returns {Promise<Blob>} Blob mới, cùng nội dung + type, tách hẳn khỏi backing file cũ.
         */
        async function rematerializeBlob(blob) {
            return new Blob([await blob.arrayBuffer()], { type: blob.type });
        }

        function getMeta(key) { return idbKeyval.get(key, metaStore); }
        function setMeta(key, value) { return idbKeyval.set(key, value, metaStore); }
        function delMeta(key) { return idbKeyval.del(key, metaStore); }

        // MỚI (10/07/2026) — encodeSongKeyForUrl()/decodeSongKeyFromUrl() (mã hoá songKey nhét vào
        // `?song=` của subtitle-editor.html) TỪNG SỐNG Ở ĐÂY, ĐÃ TÁCH RIÊNG (phản hồi Giang) sang
        // service/song-key-cipher.js — file db.js này CHỈ còn thuần truy cập IndexedDB, không lẫn
        // tiện ích không liên quan gì tới đọc/ghi DB.

        // KHÔNG còn getPlaylistOrder/setPlaylistOrder: playlist không lưu thứ tự riêng trong
        // store `meta` nữa — store `songs` là chân lý duy nhất. Mỗi lần cần danh sách (khởi động,
        // sau khi thêm/xoá bài), quét lại toàn bộ key qua getAllSongKeys() + lọc hợp lệ ngay trong
        // RAM (xem scanValidSongsFromDB() trong playlist.js) — không cố lưu/khôi phục thứ tự cũ.

        // MIME type hợp lệ cho mp3 — trình duyệt/thiết bị khác nhau có thể báo hơi khác nhau, nên
        // chấp nhận cả audio/mpeg, audio/mp3 (không chuẩn nhưng vẫn gặp), và rỗng (file picker một số
        // hệ điều hành không set type, không tự coi đó là lỗi chỉ vì thiếu type). Định nghĩa Ở ĐÂY
        // (db.js, nạp sớm nhất) để dùng CHUNG giữa playlist.js (quét nhanh lúc khởi động/thêm bài,
        // KHÔNG decode) và storage-manager.js (quét sâu ở Quản lý dung lượng, có decode) — tránh 2
        // nơi định nghĩa "thế nào là hợp lệ" lệch nhau.
        const VALID_MP3_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mpa', '']);
        function isQuickValidMime(mime) {
            return VALID_MP3_MIME_TYPES.has((mime || '').toLowerCase());
        }
