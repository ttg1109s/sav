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
        // SỬA (06/10/2026, plan-media-db-split.md — Giang duyệt) — tăng lên 6: mỗi loại media tách 3 store riêng
        // (meta / file chính / thumb — xem MEDIA_STORES_BY_TYPE ngay dưới). KHÔNG chuyển dữ liệu cũ (Giang chốt "xoá đi
        // cài lại là xong"): DB v1-v5 lên v6 thì xoá thẳng 3 store media cũ (đang chứa Blob lẫn dữ liệu thường) + key
        // thống kê cũ trong `meta`, xem openDatabase().
        const DB_VERSION = 6;

        /**
         * MỚI (06/10/2026, plan-media-db-split.md mục 2.1) — 3 store cho MỖI loại media, cùng 1 key media (chuỗi
         * slugify(), như trước đây), mỗi media đúng 1 entry mỗi store:
         *   - meta : dữ liệu thường (filename, tag, subtitles, folder, stats, game...) — KHÔNG chứa Blob nào.
         *   - blob : Blob file chính (value là Blob trực tiếp).
         *   - thumb: object chứa MỌI thumb của media đó (THUMB_FIELDS_BY_TYPE) — luôn ghi cả object bằng Blob MỚI.
         * Sửa dữ liệu thường chỉ ghi store meta -> không bao giờ ghi lại Blob đọc từ chính IndexedDB (gốc lỗi
         * "round-trip Blob": URL đang phát chết sau khi sửa info/folder/phụ đề/điểm Game).
         */
        const MEDIA_STORES_BY_TYPE = {
            song: { meta: 'songs', blob: 'song_blobs', thumb: 'song_thumbs' },
            video: { meta: 'videos', blob: 'video_blobs', thumb: 'video_thumbs' },
            photo: { meta: 'images', blob: 'image_blobs', thumb: 'image_thumbs' },
        };
        /** Field thumb của từng loại — nguồn sự thật DUY NHẤT để tách/ghép record. */
        const THUMB_FIELDS_BY_TYPE = {
            song: ['cover'],
            video: ['thumbBlob', 'thumbFullBlob'],
            photo: ['thumbBlob'],
        };
        /** Store media của bản DB v1-v5 (Blob nằm chung record) — xoá khi nâng lên v6. */
        const LEGACY_MEDIA_STORES = ['songs', 'videos', 'images'];
        /** Key thống kê cũ trong store `meta` — xoá khi nâng lên v6 (thống kê giờ nằm trong meta từng media). */
        const LEGACY_META_KEYS = ['songStats', 'gameScores'];

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
                request.onupgradeneeded = (event) => {
                    const db = request.result;
                    // MỚI (06/10/2026, plan-media-db-split.md mục 4) — DB cũ (v1-v5) lên v6: xoá thẳng store media cũ + key
                    // thống kê cũ, KHÔNG chuyển dữ liệu (Giang chốt). DB mới tạo (oldVersion 0) bỏ qua bước này.
                    if (event.oldVersion > 0 && event.oldVersion < 6) {
                        LEGACY_MEDIA_STORES
                            .filter((name) => db.objectStoreNames.contains(name))
                            .forEach((name) => db.deleteObjectStore(name));
                        if (db.objectStoreNames.contains('meta')) {
                            const legacyMeta = request.transaction.objectStore('meta');
                            LEGACY_META_KEYS.forEach((metaKey) => legacyMeta.delete(metaKey));
                        }
                        console.warn(`[db] Nâng DB v${event.oldVersion} -> v6: đã xoá thư viện media cũ (không chuyển dữ liệu — plan-media-db-split.md mục 4).`);
                    }
                    // 9 store media (3 store/loại) — idempotent, cùng khuôn các store khác bên dưới.
                    Object.values(MEDIA_STORES_BY_TYPE).forEach((names) => {
                        Object.values(names)
                            .filter((name) => !db.objectStoreNames.contains(name))
                            .forEach((name) => db.createObjectStore(name));
                    });
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
                    // ('images'/'videos' — giờ tạo ở vòng 9 store media phía trên.)
                    // XOÁ (loại bỏ Album khỏi Photo Panel) — ngừng tạo store 'albums' cho lần cài
                    // đặt mới (xem comment ở khai báo DB_VERSION phía trên).
                    // XOÁ (loại bỏ Document Reader khỏi app) — ngừng tạo store 'documents' cho lần
                    // cài đặt mới (xem comment ở khai báo DB_VERSION phía trên).
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

        /**
         * MỚI (06/10/2026, plan-media-db-split.md mục 3.1) — cùng cơ chế makeStoreAccessor() (tự mở lại connection +
         * retry 1 lần) nhưng mở 1 transaction trên NHIỀU store — callback nhận chính `IDBTransaction`.
         * Lưu ý: transaction IndexedDB tự commit khi gặp await ngoài IDB — mọi việc đọc file/arrayBuffer() phải xong
         * TRƯỚC khi gọi hàm ghi.
         * @param {string[]} storeNames
         */
        function makeMultiStoreAccessor(storeNames) {
            return (txMode, callback) => _getDbReadyPromise().then((db) => {
                try {
                    return callback(db.transaction(storeNames, txMode));
                } catch (err) {
                    if (!isDeadConnectionError(err)) throw err;
                    console.warn(`[db] Connection IndexedDB đã chết lúc mở transaction (store "${storeNames.join(', ')}") — tự mở connection mới và thử lại 1 lần.`, err);
                    _setDbReadyPromise(openDatabase());
                    return _getDbReadyPromise().then((freshDb) => callback(freshDb.transaction(storeNames, txMode)));
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

        // XOÁ (06/10/2026) — setImageRecord()/deleteImageRecord(), xem API media chung cuối file.
        function getImageRecord(imageKey) { return getMediaRecord('photo', imageKey); }
        function getAllImageKeys() { return idbKeyval.keys(imagesStore); }

        // XOÁ (loại bỏ Album khỏi Photo Panel) — CRUD 'albums' (getAlbumRecord/setAlbumRecord/
        // deleteAlbumRecord/getAllAlbumKeys) bỏ hẳn cùng tính năng.

        // XOÁ (loại bỏ Document Reader khỏi app) — CRUD 'documents' (getDocumentRecord/
        // setDocumentRecord/deleteDocumentRecord/getAllDocumentKeys) bỏ hẳn cùng tính năng.

        // MỚI (21/07/2026, module File Manager -> Video) — CRUD thô, cùng khuôn 'images' ở trên.
        // XOÁ (06/10/2026) — setVideoRecord()/deleteVideoRecord(), xem API media chung cuối file.
        function getVideoRecord(videoKey) { return getMediaRecord('video', videoKey); }
        function getAllVideoKeys() { return idbKeyval.keys(videosStore); }

        // ===================== Đọc NHIỀU record trong 1 transaction (MỚI 02/10/2026, Giang duyệt) =====================
        // LÝ DO: trước đây mọi nơi cần nhiều record đều `Promise.all(keys.map(getXRecord))` — MỖI record 1 transaction
        // riêng, tất cả mở CÙNG LÚC. Đo trên trình duyệt (record cùng shape bài hát thật: blob audio + cover): 3000 record
        // đã làm SẬP tiến trình trang, trong khi đọc bằng cursor trong 1 transaction nạp 10000 record ~1,1 s. 2 hàm lõi
        // dưới đây là CƠ CHẾ đọc (data layer, không nghiệp vụ), các hàm theo từng store ở cuối chỉ gắn đúng store.

        // (06/10/2026) — 2 hàm lõi cũ `_readAllStoreRecords()`/`_readStoreRecordsByKeys()` (đọc 1 store) ĐÃ THAY bằng
        // bản đọc 3 store media trong 1 transaction `_readAllMediaRecords()`/`_readMediaRecordsByKeys()` (cuối file),
        // giữ nguyên cách báo tiến trình `onProgress(done, total)`.

        // SỬA (06/10/2026, plan-media-db-split.md mục 3.2) — GIỮ chữ ký + hình dạng kết quả cũ (record đã ghép blob +
        // thumb), nhưng đọc 3 store trong 1 transaction (xem _readAllMediaRecords()/_readMediaRecordsByKeys() cuối file).
        function getAllSongRecords(onProgress) { return _readAllMediaRecords('song', onProgress); }
        function getAllVideoRecords(onProgress) { return _readAllMediaRecords('video', onProgress); }
        function getAllImageRecords(onProgress) { return _readAllMediaRecords('photo', onProgress); }
        function getSongRecordsByKeys(keys, onProgress) { return _readMediaRecordsByKeys('song', keys, onProgress); }
        function getVideoRecordsByKeys(keys, onProgress) { return _readMediaRecordsByKeys('video', keys, onProgress); }
        function getImageRecordsByKeys(keys, onProgress) { return _readMediaRecordsByKeys('photo', keys, onProgress); }


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

        // XOÁ (06/10/2026, plan-media-db-split.md — Giang chốt "xoá hẳn") — setSongRecord()/deleteSongRecord(): ghi/xoá
        // qua API media chung (createMediaRecord/updateMediaMeta/setMediaBlob/setMediaThumbs/deleteMediaRecord, cuối file).
        function getSongRecord(key) { return getMediaRecord('song', key); }
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
        // RAM (xem core/playlist/loader.js) — không cố lưu/khôi phục thứ tự cũ.

        // MIME type hợp lệ cho mp3 — trình duyệt/thiết bị khác nhau có thể báo hơi khác nhau, nên
        // chấp nhận cả audio/mpeg, audio/mp3 (không chuẩn nhưng vẫn gặp), và rỗng (file picker một số
        // hệ điều hành không set type, không tự coi đó là lỗi chỉ vì thiếu type). Định nghĩa Ở ĐÂY
        // (db.js, nạp sớm nhất) để dùng CHUNG giữa playlist.js (quét nhanh lúc khởi động/thêm bài,
        // KHÔNG decode) và storage-manager.js (quét sâu ở Quản lý dung lượng, có decode) — tránh 2
        // nơi định nghĩa "thế nào là hợp lệ" lệch nhau.
        //
        // SỬA (01/10/2026, Ghi âm — lỗi có sẵn phát hiện lúc làm) — TRƯỚC ĐÂY CHỈ nhận MIME mp3, trong khi lúc upload
        // `validateAudioFile()` (core/upload-validation.js) lại nhận cả m4a/aac/wav/ogg/flac/webm -> bài m4a upload
        // xong biến mất sau reload (filterValidSongRecords() loại) và bị "Scan & clean broken files" coi là hỏng. Bản
        // ghi âm lưu theo định dạng OS (iOS: audio/mp4, Chrome: audio/webm) dính đúng lỗi đó. Giờ nhận ĐÚNG tập MIME
        // mà upload nhận (khớp VALID_AUDIO_MIME_TYPES) + bỏ tham số ";codecs=..." trước khi so. Tên hằng giữ nguyên
        // (2 nơi gọi chỉ dùng qua isQuickValidMime()).
        const VALID_MP3_MIME_TYPES = new Set([
            'audio/mpeg', 'audio/mp3', 'audio/mpa', '',
            'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/x-m4a', 'audio/m4a', 'audio/mp4', 'audio/aac',
            'audio/flac', 'audio/x-flac', 'audio/webm',
        ]);
        function isQuickValidMime(mime) {
            return VALID_MP3_MIME_TYPES.has(String(mime || '').split(';')[0].trim().toLowerCase());
        }

        // ===================== API media 3 store (MỚI 06/10/2026, plan-media-db-split.md mục 2-3, Giang duyệt) =====================
        // Lớp truy cập dữ liệu THUẦN — không nghiệp vụ. Mọi chỗ ghi media trong app đi qua các hàm dưới đây;
        // setSongRecord/setVideoRecord/setImageRecord + deleteSongRecord/deleteVideoRecord/deleteImageRecord ĐÃ XOÁ HẲN.

        const _mediaTxByType = {
            song: makeMultiStoreAccessor(Object.values(MEDIA_STORES_BY_TYPE.song)),
            video: makeMultiStoreAccessor(Object.values(MEDIA_STORES_BY_TYPE.video)),
            photo: makeMultiStoreAccessor(Object.values(MEDIA_STORES_BY_TYPE.photo)),
        };
        const _mediaMetaStoreByType = { song: songsStore, video: videosStore, photo: imagesStore };

        /** Ghép 3 phần thành record đúng hình dạng cũ (meta + `blob` + field thumb). Không có meta = media không tồn tại. */
        function _mergeMediaRecord(meta, blob, thumbs) {
            if (!meta) return undefined;
            return { ...meta, blob, ...(thumbs || {}) };
        }

        /** Tách 1 record đầy đủ (hình dạng cũ) thành 3 phần. `thumbs` = null nếu mọi field thumb đều trống. */
        function _splitMediaRecord(type, record) {
            const thumbFields = THUMB_FIELDS_BY_TYPE[type];
            const meta = { ...record };
            delete meta.blob;
            delete meta.key; // phòng khi record tới từ getAll*Records() (đã gộp key)
            const thumbs = {};
            thumbFields.forEach((field) => { thumbs[field] = record[field] || null; delete meta[field]; });
            const hasThumb = thumbFields.some((field) => thumbs[field]);
            return { meta, blob: record.blob, thumbs: hasThumb ? thumbs : null };
        }

        /** Phòng thủ: gạt mọi field Blob (file chính + thumb) khỏi object meta trước khi ghi. */
        function _stripMediaBlobFields(type, meta) {
            const clean = { ...meta };
            delete clean.blob;
            delete clean.key;
            THUMB_FIELDS_BY_TYPE[type].forEach((field) => { delete clean[field]; });
            return clean;
        }

        /** Đợi 1 transaction ghi hoàn tất. */
        function _awaitTx(tx, value) {
            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve(value);
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('Transaction IndexedDB bị huỷ'));
            });
        }

        /** Đọc record đã ghép theo danh sách key trong ĐÚNG 1 transaction (3 store). Kết quả thẳng hàng với `keys`
         * (key không tồn tại -> `undefined`). `onProgress(done, total)` sau mỗi record ghép xong. */
        function _readMediaRecordsByKeys(type, keys, onProgress) {
            if (!keys.length) return Promise.resolve([]); // guard — không mở transaction rỗng
            const report = typeof onProgress === 'function' ? onProgress : () => {};
            const names = MEDIA_STORES_BY_TYPE[type];
            return _mediaTxByType[type]('readonly', (tx) => new Promise((resolve, reject) => {
                const metaStoreObj = tx.objectStore(names.meta);
                const blobStoreObj = tx.objectStore(names.blob);
                const thumbStoreObj = tx.objectStore(names.thumb);
                const results = new Array(keys.length);
                let done = 0;
                keys.forEach((key, index) => {
                    const parts = {};
                    let pending = 3;
                    const finishPart = () => {
                        pending--;
                        if (pending > 0) return;
                        results[index] = _mergeMediaRecord(parts.meta, parts.blob, parts.thumbs);
                        done++;
                        report(done, keys.length);
                        if (done === keys.length) resolve(results);
                    };
                    const readInto = (storeObj, field) => {
                        const request = storeObj.get(key);
                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => { parts[field] = request.result; finishPart(); };
                    };
                    readInto(metaStoreObj, 'meta');
                    readInto(blobStoreObj, 'blob');
                    readInto(thumbStoreObj, 'thumbs');
                });
            }));
        }

        /** Đọc TOÀN BỘ record đã ghép của 1 loại (cursor trên store meta) trong ĐÚNG 1 transaction. Kết quả gộp `key`
         * (`{ key, ...record }`), đúng thứ tự key của store meta — cùng hình dạng bản cũ. */
        function _readAllMediaRecords(type, onProgress) {
            const report = typeof onProgress === 'function' ? onProgress : () => {};
            const names = MEDIA_STORES_BY_TYPE[type];
            return _mediaTxByType[type]('readonly', (tx) => new Promise((resolve, reject) => {
                const metaStoreObj = tx.objectStore(names.meta);
                const blobStoreObj = tx.objectStore(names.blob);
                const thumbStoreObj = tx.objectStore(names.thumb);
                const records = [];
                let pending = 0;
                let cursorDone = false;
                let total = 0;
                let done = 0;
                const maybeResolve = () => { if (cursorDone && pending === 0) resolve(records); };
                const countRequest = metaStoreObj.count();
                countRequest.onerror = () => reject(countRequest.error);
                countRequest.onsuccess = () => {
                    total = countRequest.result;
                    const cursorRequest = metaStoreObj.openCursor();
                    cursorRequest.onerror = () => reject(cursorRequest.error);
                    cursorRequest.onsuccess = () => {
                        const cursor = cursorRequest.result;
                        if (!cursor) { cursorDone = true; maybeResolve(); return; } // hết record
                        const entry = { key: cursor.key, ...cursor.value };
                        records.push(entry);
                        let partsLeft = 2;
                        pending++;
                        const finishPart = () => {
                            partsLeft--;
                            if (partsLeft > 0) return;
                            pending--;
                            done++;
                            report(done, total);
                            maybeResolve();
                        };
                        const blobRequest = blobStoreObj.get(cursor.key);
                        blobRequest.onerror = () => reject(blobRequest.error);
                        blobRequest.onsuccess = () => { entry.blob = blobRequest.result; finishPart(); };
                        const thumbRequest = thumbStoreObj.get(cursor.key);
                        thumbRequest.onerror = () => reject(thumbRequest.error);
                        thumbRequest.onsuccess = () => { Object.assign(entry, thumbRequest.result || {}); finishPart(); };
                        cursor.continue();
                    };
                };
            }));
        }

        // ----- Đọc -----

        /** Record đã ghép (hình dạng cũ) của 1 media — `undefined` nếu không tồn tại.
         * @param {'song'|'video'|'photo'} type @param {string} key */
        function getMediaRecord(type, key) {
            return _readMediaRecordsByKeys(type, [key]).then((results) => results[0]);
        }
        /** CHỈ dữ liệu thường (không mở Blob) — vd nạp thống kê lúc boot. */
        function getMediaMeta(type, key) { return idbKeyval.get(key, _mediaMetaStoreByType[type]); }
        /** CHỈ dữ liệu thường của mọi media 1 loại, gộp `key` (`{ key, ...meta }`). */
        function getAllMediaMeta(type) {
            return _mediaMetaStoreByType[type]('readonly', (store) => new Promise((resolve, reject) => {
                const records = [];
                const cursorRequest = store.openCursor();
                cursorRequest.onerror = () => reject(cursorRequest.error);
                cursorRequest.onsuccess = () => {
                    const cursor = cursorRequest.result;
                    if (!cursor) { resolve(records); return; }
                    records.push({ key: cursor.key, ...cursor.value });
                    cursor.continue();
                };
            }));
        }
        /** Blob file chính của 1 media. */
        function getMediaBlob(type, key) {
            return _mediaTxByType[type]('readonly', (tx) => new Promise((resolve, reject) => {
                const request = tx.objectStore(MEDIA_STORES_BY_TYPE[type].blob).get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            }));
        }
        /** Object thumb của 1 media (`{ cover }` / `{ thumbBlob, thumbFullBlob }` / `{ thumbBlob }`) — `undefined` nếu không có. */
        function getMediaThumbs(type, key) {
            return _mediaTxByType[type]('readonly', (tx) => new Promise((resolve, reject) => {
                const request = tx.objectStore(MEDIA_STORES_BY_TYPE[type].thumb).get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            }));
        }

        // ----- Ghi -----

        /** Tạo mới (hoặc ghi đè trọn) 1 media: tự tách `record` (hình dạng cũ) thành meta / blob / thumb, ghi 3 store
         * trong 1 transaction. Blob trong `record` PHẢI là Blob mới (File người dùng chọn, Blob vừa tạo) — không phải
         * Blob vừa đọc từ IndexedDB.
         * @param {'song'|'video'|'photo'} type @param {string} key @param {object} record
         * @returns {Promise<string>} key */
        function createMediaRecord(type, key, record) {
            const names = MEDIA_STORES_BY_TYPE[type];
            const parts = _splitMediaRecord(type, record);
            return _mediaTxByType[type]('readwrite', (tx) => {
                tx.objectStore(names.meta).put(parts.meta, key);
                tx.objectStore(names.blob).put(parts.blob, key);
                const thumbStoreObj = tx.objectStore(names.thumb);
                const writeThumbsByHasThumb = { true: () => thumbStoreObj.put(parts.thumbs, key), false: () => thumbStoreObj.delete(key) };
                writeThumbsByHasThumb[parts.thumbs !== null]();
                return _awaitTx(tx, key);
            });
        }

        /** Sửa dữ liệu thường của 1 media — đọc + ghi CHỈ store meta trong 1 transaction. `mutate(meta)` PHẢI đồng bộ +
         * thuần (trả về object meta mới); mọi field Blob lọt vào bị gạt bỏ.
         * @returns {Promise<{status: 'ok'|'notFound', meta?: object}>} */
        function updateMediaMeta(type, key, mutate) {
            return updateMediaMetaBatch([{ type, key, mutate }]).then((results) => results[0]);
        }

        /** Sửa dữ liệu thường của NHIỀU media (có thể nhiều loại) trong ĐÚNG 1 transaction — flush thống kê, xoá folder,
         * dọn mồ côi. Kết quả thẳng hàng với `items`.
         * @param {Array<{type: 'song'|'video'|'photo', key: string, mutate: (meta: object) => object}>} items
         * @returns {Promise<Array<{status: 'ok'|'notFound', meta?: object}>>} */
        function updateMediaMetaBatch(items) {
            if (!items.length) return Promise.resolve([]); // guard — không mở transaction rỗng
            const metaStoreNames = [...new Set(items.map((item) => MEDIA_STORES_BY_TYPE[item.type].meta))];
            return makeMultiStoreAccessor(metaStoreNames)('readwrite', (tx) => {
                const results = new Array(items.length);
                items.forEach((item, index) => {
                    const storeObj = tx.objectStore(MEDIA_STORES_BY_TYPE[item.type].meta);
                    const request = storeObj.get(item.key);
                    request.onsuccess = () => {
                        const current = request.result;
                        if (!current) { results[index] = { status: 'notFound' }; return; } // media đã bị xoá (race)
                        const next = _stripMediaBlobFields(item.type, item.mutate({ ...current }));
                        storeObj.put(next, item.key);
                        results[index] = { status: 'ok', meta: next };
                    };
                });
                return _awaitTx(tx, results);
            });
        }

        /** Thay file chính của 1 media (sửa ảnh, thay file video, upload ghi đè). `blob` PHẢI là Blob mới. */
        function setMediaBlob(type, key, blob) {
            return _mediaTxByType[type]('readwrite', (tx) => {
                tx.objectStore(MEDIA_STORES_BY_TYPE[type].blob).put(blob, key);
                return _awaitTx(tx, key);
            });
        }

        /** Thay TOÀN BỘ thumb của 1 media — `thumbs` PHẢI có đủ mọi field THUMB_FIELDS_BY_TYPE[type] (giá trị Blob mới
         * hoặc null); thiếu field là lỗi lập trình (ném ngay, không ghi nửa vời). Mọi field null -> xoá entry thumb.
         * @param {'song'|'video'|'photo'} type @param {string} key @param {object} thumbs */
        function setMediaThumbs(type, key, thumbs) {
            const thumbFields = THUMB_FIELDS_BY_TYPE[type];
            const missing = thumbFields.filter((field) => !(field in thumbs));
            if (missing.length > 0) return Promise.reject(new Error(`[db] setMediaThumbs(${type}) thiếu field: ${missing.join(', ')}`));
            const clean = {};
            thumbFields.forEach((field) => { clean[field] = thumbs[field] || null; });
            const hasThumb = thumbFields.some((field) => clean[field]);
            return _mediaTxByType[type]('readwrite', (tx) => {
                const storeObj = tx.objectStore(MEDIA_STORES_BY_TYPE[type].thumb);
                const writeByHasThumb = { true: () => storeObj.put(clean, key), false: () => storeObj.delete(key) };
                writeByHasThumb[hasThumb]();
                return _awaitTx(tx, key);
            });
        }

        /** Xoá hẳn 1 media khỏi cả 3 store trong 1 transaction. */
        function deleteMediaRecord(type, key) {
            const names = MEDIA_STORES_BY_TYPE[type];
            return _mediaTxByType[type]('readwrite', (tx) => {
                Object.values(names).forEach((name) => tx.objectStore(name).delete(key));
                return _awaitTx(tx, key);
            });
        }

        /** Xoá TOÀN BỘ media của 1 loại (cả 3 store) trong 1 transaction. */
        function clearAllMediaOfType(type) {
            const names = MEDIA_STORES_BY_TYPE[type];
            return _mediaTxByType[type]('readwrite', (tx) => {
                Object.values(names).forEach((name) => tx.objectStore(name).clear());
                return _awaitTx(tx, type);
            });
        }

