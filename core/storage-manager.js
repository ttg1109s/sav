/**
 * Quản lý dung lượng (mục 5) — CORE THUẦN (đã tách khỏi mọi addEventListener/confirm/alertModal/
 * withLoadingShield theo kiến trúc /event/ — xem event/workflow/storage.js để biết nơi các hàm ở
 * đây được GỌI và bọc shield/modal xung quanh).
 *
 * QUY TẮC CỦA FILE NÀY (tầng "core"):
 *   - Mọi hàm chỉ nhận tham số, trả kết quả (hoặc throw lỗi đọc/viết dữ liệu thật) — KHÔNG biết
 *     gì về shield, modal, hay UI ngoài việc cập nhật đúng 1 vài phần tử DOM hiển thị THUẦN DỮ
 *     LIỆU (renderStorageStats, renderScanResultUI, resetScanResultUI) vốn đã thuộc về "hiển thị
 *     kết quả tính toán", không phải hành vi tương tác.
 *   - KHÔNG còn addEventListener nào trong file này — toàn bộ đã chuyển sang event/listener/.
 *   - KHÔNG còn confirm()/alertModal()/withLoadingShield() nào gọi trực tiếp ở đây — các hàm xử
 *     lý nghiệp vụ (downloadAllSongsThenClear, clearAllSongsNoDownload, scanAllSongsForCorruption,
 *     deleteCorruptedSongs) trả kết quả CÓ CỜ rõ ràng để workflow tự quyết định hiện modal gì.
 *
 * Batch D5 (Settings restructure, 06/07/2026) — panel Song giờ push/pop động (core/settings-
 * panel-stack.js), 6 dom-refs tĩnh cũ (statStorageTotalSongs/Bytes, storageScanResult/Summary/
 * List, btnDeleteBroken) ĐÃ XOÁ khỏi core/dom-refs.js — `renderStorageStats`/`resetScanResultUI`/
 * `renderScanResultUI` giờ nhận phần tử qua tham số. `downloadAllSongsThenClear()`/
 * `clearAllSongsNoDownload()` BỎ HẲN lệnh gọi `renderStorageStats()` nội bộ (core-gọi-core, Rule
 * 3) — vốn dĩ ĐÃ THỪA từ trước (event/workflow/file-manager-song.js luôn gọi lại
 * `this.refreshSongTab()` — cũng tự vẽ lại stats — ngay sau 2 hàm này, nên bỏ dòng thừa không đổi
 * hành vi quan sát được, chỉ dọn sạch 1 lần gọi trùng).
 *
 * PHẢI nạp SAU: db.js (CRUD, isQuickValidMime), about-stats.js (computeStats/formatBytes),
 * id3-export.js (triggerDownload), playlist.js (readAudioDuration, playlistOrder,
 * renderPlaylistDiff, removeKeyFromDisplay, songNameIndex, playlistCache, confirmedBrokenKeys),
 * core/file-manager/video.js (computeVideoStats() — MỚI, Batch 5, dùng bởi
 * renderVideoStorageStats()).
 *
 * MỚI (29/07/2026, yêu cầu Giang — panel "Quản lý lưu trữ" MỚI, THAY panel "Song & Video" cũ) —
 * `renderStorageStats()` giờ nhận ĐỦ 3 domain (Song/Video/Photo) — THÊM phụ thuộc:
 * core/file-manager/image.js (getAllImageKeys/getImageRecord/deleteImageRecord). Xem
 * event/workflow/file-manager-storage.js (workflow MỚI, THAY event/workflow/file-manager-song.js
 * đã xoá) để biết nơi các hàm Photo mới được gọi.
 */

        /**
         * VIẾT LẠI (29/07/2026, yêu cầu Giang — panel "Quản lý lưu trữ" MỚI, mục 2a/2b) — panel
         * Song & Video cũ ĐÃ XOÁ (xem event/workflow/file-manager-storage.js, panel MỚI DÙNG
         * CHUNG cho CẢ 3 domain) — hàm này giờ nhận ĐỦ 3 stats (Song/Video/Photo), vẽ 1
         * thanh chia đoạn 3 màu (THAY 2 màu cũ) + ghi số lượng vào LIST 3 hàng (nhãn trái - số
         * lượng phải, THAY hẳn 2 "vòng tròn" cũ, mục 2b) — KHÔNG còn circle nào.
         * @param {{totalSongs: number, totalBytes: number}} songStats - core/about-stats.js::computeStats()
         * @param {{totalVideos: number, totalBytes: number}} videoStats - core/file-manager/video.js::computeVideoStats()
         * @param {{totalImages: number, totalBytes: number}} photoStats - core/file-manager/image.js::computeImageStats()
         * @param {{totalBytesEl: HTMLElement, barSongsEl: HTMLElement, barVideosEl: HTMLElement,
         *          barPhotosEl: HTMLElement, countSongsEl: HTMLElement,
         *          countVideosEl: HTMLElement, countPhotosEl: HTMLElement}} els
         *          toàn bộ phần tử DOM cần cập nhật, querySelector sẵn ở Workflow rồi truyền vào
         *          (Rule 2/3 — Core không tự đọc DOM ngoài tham số).
         */
        function renderStorageStats(songStats, videoStats, photoStats, els) {
            const { totalBytesEl, barSongsEl, barVideosEl, barPhotosEl, countSongsEl, countVideosEl, countPhotosEl } = els;
            if (!totalBytesEl) return; // guard: panel "Quản lý lưu trữ" đang đóng
            const totalBytes = songStats.totalBytes + videoStats.totalBytes + photoStats.totalBytes;
            totalBytesEl.textContent = formatBytes(totalBytes);

            // FIX (29/07/2026, Giang phát hiện qua ảnh chụp màn hình — "Photo có 7 ảnh nhưng không
            // thấy chỉ báo dung lượng") — công thức % THUẦN theo tỉ lệ (bản cũ) khiến đoạn nào có
            // bytes RẤT NHỎ so với tổng (Photo thường nhỏ hơn Song/Video rất nhiều lần)
            // render ra chưa tới 1px — về mặt hình ảnh coi như "biến mất" dù dữ liệu đếm số lượng
            // (countPhotosEl...) vẫn đúng (2 phép tính hoàn toàn tách biệt — số lượng không liên
            // quan gì tới % độ rộng thanh). Closure THUẦN ngay dưới (Rule 3: nested bên trong hàm
            // này, KHÔNG tính là "gọi core khác") đảm bảo MỌI đoạn có bytes > 0 LUÔN được 1 độ rộng
            // % TỐI THIỂU nhìn thấy được (giống cách Settings -> Storage của iOS/Android xử lý danh
            // mục nhỏ cạnh danh mục khổng lồ) — phần "vay" thêm để đủ mức tối thiểu đó được RÚT BỚT
            // TỈ LỆ THUẬN từ (các) đoạn còn lại (đủ lớn, không cần bump) — tổng luôn giữ nguyên
            // 100%, KHÔNG đổi ý nghĩa số liệu, chỉ đổi cách QUY ĐỔI ra độ rộng hiển thị.
            const MIN_VISIBLE_PERCENT = 2;
            function computeBarPercents(byteValues) {
                const total = byteValues.reduce((a, b) => a + b, 0);
                if (total <= 0) return byteValues.map(() => 0); // KHÔNG chia 0/0 ra NaN — mọi đoạn 0%
                const raw = byteValues.map((v) => (v / total) * 100);
                const isBoosted = raw.map((p, i) => byteValues[i] > 0 && p < MIN_VISIBLE_PERCENT);
                const boostedTotal = raw.reduce((sum, p, i) => sum + (isBoosted[i] ? MIN_VISIBLE_PERCENT : 0), 0);
                const unboostedRawTotal = raw.reduce((sum, p, i) => sum + (isBoosted[i] ? 0 : p), 0);
                if (boostedTotal === 0 || unboostedRawTotal <= 0) return raw; // không đoạn nào cần bump, hoặc không còn chỗ để rút (cực hiếm)
                const shrinkFactor = Math.max(0, (100 - boostedTotal) / unboostedRawTotal);
                return raw.map((p, i) => (isBoosted[i] ? MIN_VISIBLE_PERCENT : p * shrinkFactor));
            }

            const [songPct, videoPct, photoPct] = computeBarPercents([
                songStats.totalBytes, videoStats.totalBytes, photoStats.totalBytes
            ]);
            // MỚI (29/07/2026, yêu cầu Giang mục 2 — "thêm phần số dung lượng khi ấn vào mỗi phần
            // của thanh") — gắn `dataset.bytes` (số byte THẬT, KHÔNG phải %) vào từng đoạn — đọc lại
            // lúc người dùng ấn vào (event/listener/file-manager-storage.js -> event/workflow/
            // file-manager-storage.js::showSegmentBytes()) để hiện đúng số byte của ĐÚNG đoạn đó,
            // không cần tính lại/đọc lại DB lúc bấm.
            if (barSongsEl) { barSongsEl.style.width = `${songPct}%`; barSongsEl.dataset.bytes = String(songStats.totalBytes); }
            if (barVideosEl) { barVideosEl.style.width = `${videoPct}%`; barVideosEl.dataset.bytes = String(videoStats.totalBytes); }
            if (barPhotosEl) { barPhotosEl.style.width = `${photoPct}%`; barPhotosEl.dataset.bytes = String(photoStats.totalBytes); }
            if (countSongsEl) countSongsEl.textContent = `${songStats.totalSongs}`;
            if (countVideosEl) countVideosEl.textContent = `${videoStats.totalVideos}`;
            if (countPhotosEl) countPhotosEl.textContent = `${photoStats.totalImages}`;
        }

        // ===================== Giải phóng bộ nhớ =====================

        /** Ngưỡng an toàn (byte) cho nhánh JSZip DI SẢN (chỉ còn chạy khi OPFS hoàn toàn không tồn
         * tại — xem `isStreamingZipAvailable()`, core/streaming-zip.js) — MỚI (10/09/2026, Giang
         * báo bug "zip video >1GB làm crash PWA, bị cưỡng chế reload").
         *
         * SỬA (10/09/2026, Giang yêu cầu "làm đầy đủ, thay JSZip toàn app") — TRƯỚC ĐÂY ngưỡng này
         * áp dụng cho MỌI trình duyệt (JSZip là đường DUY NHẤT). Giờ `_compressZipEntries()` (ngay
         * dưới) ưu tiên `buildZipStreamingToOpfs()` (core/streaming-zip.js — thư viện zip.js, ghi
         * TĂNG DẦN vào OPFS, KHÔNG giới hạn dung lượng RAM nào cả, bất kể archive lớn cỡ nào) — chỉ
         * khi OPFS hoàn toàn không hỗ trợ (browser rất cũ, gần như không còn theo Baseline hiện tại)
         * mới rơi về JSZip cũ, và CHỈ lúc đó ngưỡng này mới còn ý nghĩa: `JSZip.generateAsync({type:
         * 'blob'})` phải dựng NGUYÊN file .zip cuối cùng liền 1 khối trong RAM (cộng thêm bản đọc
         * tạm của từng blob đầu vào lúc nén) — với Video, tổng dung lượng vài trăm MB tới hơn 1GB là
         * bình thường, vượt xa giới hạn bộ nhớ 1 tab/PWA -> OS tự kill tiến trình, PWA "crash" rồi
         * bị hệ thống tự reload lại. Ngưỡng chọn 500MB (dè dặt, còn margin cho các bản sao tạm JSZip
         * cần trong lúc nén, thường gấp 2-3 lần dữ liệu gốc) — vượt ngưỡng này ở nhánh JSZip, nơi
         * gọi (`workflowFileManagerStorage.zipAndDownloadOrFallback()`, event/workflow/
         * file-manager-storage.js) hỏi người dùng chuyển sang tải RIÊNG TỪNG FILE (xem
         * `collectRecordsForKeys()`/`promptDownloadReadyMulti()`, core/id3-export.js) thay vì gộp 1
         * file .zip — tải riêng không có bước "dựng liền 1 khối" nên không dính giới hạn này. */
        const ZIP_MEMORY_SAFE_LIMIT_BYTES = 500 * 1024 * 1024;

        /** Cộng dồn dung lượng THẬT (`record.blob.size` — chỉ đọc metadata, KHÔNG đọc nội dung
         * blob nên rẻ) của 1 danh sách key — DÙNG CHUNG cho cả 3 domain (Song/Video/Photo), gọi
         * TRƯỚC buildAllXZipBlob() để quyết định có an toàn nén trong RAM hay không (xem
         * ZIP_MEMORY_SAFE_LIMIT_BYTES ngay trên).
         * @param {string[]} keys
         * @param {(key:string) => Promise<object|undefined>} getRecordFn - getSongRecord/getVideoRecord/getImageRecord (service/db.js)
         * @returns {Promise<number>} tổng byte
         */
        async function estimateTotalBytesForKeys(keys, getRecordFn) {
            let total = 0;
            for (const key of keys) {
                const record = await getRecordFn(key);
                if (record && record.blob) total += record.blob.size;
            }
            return total;
        }

        /**
         * SỬA (10/09/2026, Giang báo "tải từng file vẫn ép Quick Look mỗi lần, rất bất tiện") — THAY
         * hẳn `downloadRecordsIndividually()` cũ (tự lặp `triggerDownload()` — tức lặp `<a
         * download>` — cho từng file, KHÔNG bao giờ mở được Share Sheet thật vì user-activation chỉ
         * còn hạn cho lượt gọi ĐẦU TIÊN, mọi lượt sau chắc chắn rơi về `<a download>` = Quick Look
         * lặp lại N lần). Hàm NÀY giờ CHỈ lo phần "đọc DB, gom `{blob, filename}` vào 1 mảng" (THUẦN
         * — không tải/không gọi triggerDownload() gì cả) — phần "tải" đẩy hẳn sang
         * `promptDownloadReadyMulti()` (core/id3-export.js): 1 nút bấm DUY NHẤT, 1 lượt
         * `navigator.share({files:[...]})` DUY NHẤT cho TẤT CẢ (Web Share API lv2 nhận cả MẢNG
         * nhiều file — mở 1 Share Sheet DUY NHẤT "Lưu N ảnh/video", KHÔNG lặp share() nhiều lần
         * (mỗi lượt share() tiêu user-activation, gọi lặp chắc chắn thất bại từ lần 2). Giữ N Blob
         * cùng lúc ở mảng trả về KHÔNG hẳn tốn RAM tương ứng — Blob đọc từ IndexedDB thường chỉ là
         * "tay cầm" trỏ vào kho lưu trữ riêng của trình duyệt (hay ở đĩa), khác hẳn JSZip (bắt buộc
         * đọc `.arrayBuffer()` từng file để nén/nối — nạp THẬT vào RAM) — nhưng ĐÂY LÀ SUY LUẬN THEO
         * ĐẶC TẢ, CHƯA kiểm chứng thực tế trên thiết bị Safari/iOS thật với file lớn, xem ghi chú
         * "CHƯA KIỂM CHỨNG" ở docstring `promptDownloadReadyMulti()`.
         * @param {string[]} keys
         * @param {(key:string) => Promise<object|undefined>} getRecordFn
         * @param {(done:number,total:number) => void} [onProgress]
         * @returns {Promise<Array<{blob:Blob, filename:string}>>}
         */
        async function collectRecordsForKeys(keys, getRecordFn, onProgress) {
            const records = [];
            let done = 0;
            for (const key of keys) {
                const record = await getRecordFn(key);
                if (record && record.blob) records.push({ blob: record.blob, filename: record.filename || key });
                done++;
                if (onProgress) onProgress(done, keys.length);
            }
            return records;
        }

        /** Gom `{filename, blob}` đã khử trùng tên (thêm hậu tố "(n)" nếu trùng) cho 1 danh sách
         * key — DÙNG CHUNG bởi cả 3 hàm buildAllXZipBlob() ngay dưới (TRƯỚC ĐÂY mỗi hàm tự viết
         * lặp lại Y HỆT logic đặt tên này). Tách riêng "đọc DB + đặt tên" khỏi "nén/ghi" để dùng lại
         * được cho CẢ nhánh streaming MỚI (core/streaming-zip.js) LẪN nhánh JSZip di sản bên dưới.
         * @param {string[]} keys
         * @param {(key:string) => Promise<object|undefined>} getRecordFn
         * @param {string} defaultExt - đuôi mặc định nếu record thiếu filename (vd ".mp3"/".mp4")
         * @returns {Promise<Array<{filename:string, blob:Blob}>>}
         */
        async function _collectZipEntries(keys, getRecordFn, defaultExt) {
            const usedNames = new Map(); // filename -> số lần đã dùng, để chống trùng tên trong zip
            const entries = [];
            for (const key of keys) {
                const record = await getRecordFn(key);
                if (!record || !record.blob) continue;
                let name = record.filename || `${key}${defaultExt}`;
                if (usedNames.has(name)) {
                    const count = usedNames.get(name) + 1; usedNames.set(name, count);
                    const dot = name.lastIndexOf('.');
                    name = dot > -1 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
                } else { usedNames.set(name, 0); }
                entries.push({ filename: name, blob: record.blob });
            }
            return entries;
        }

        /** Nén `entries` (đã gom sẵn qua `_collectZipEntries()`) thành 1 Blob .zip — DÙNG CHUNG bởi
         * cả 3 hàm buildAllXZipBlob() ngay dưới. Ưu tiên `buildZipStreamingToOpfs()` (core/
         * streaming-zip.js — thư viện zip.js, ghi TĂNG DẦN vào OPFS, không giới hạn dung lượng RAM,
         * MỚI 10/09/2026 thay JSZip — xem docstring đầy đủ ở file đó) — KHÔNG hỗ trợ/lỗi (OPFS hoàn
         * toàn không tồn tại, browser rất cũ) thì mới rơi về JSZip cũ (dựng liền 1 khối Blob trong
         * RAM — GIỮ LẠI làm lưới an toàn cuối cùng, không có browser nào "không tải được gì cả").
         * @param {Array<{filename:string, blob:Blob}>} entries
         * @param {(done:number,total:number,percent:number|null) => void} [onProgress]
         * @returns {Promise<Blob>}
         */
        async function _compressZipEntries(entries, onProgress) {
            if (isStreamingZipAvailable()) { // core/streaming-zip.js
                try {
                    return await buildZipStreamingToOpfs(entries, onProgress); // core/streaming-zip.js
                } catch (err) {
                    console.warn('[storage-manager] Streaming zip qua OPFS thất bại, rơi về JSZip (dựng liền Blob trong RAM):', err);
                }
            }
            if (typeof JSZip === 'undefined') {
                throw new Error(t('common.storage.zipLibMissing'));
            }
            const legacyZip = new JSZip();
            for (const entry of entries) legacyZip.file(entry.filename, entry.blob);
            return legacyZip.generateAsync({ type: 'blob' }, (meta) => {
                if (onProgress) onProgress(entries.length, entries.length, meta.percent);
            });
        }

        /**
         * Đóng gói toàn bộ blob mp3 GỐC (không gắn tag mới, giữ nguyên file thật) thành 1 file .zip,
         * tên file giữ nguyên filename gốc — trùng tên tự thêm số đếm để không ghi đè lẫn nhau.
         * SỬA (06/09/2026, hợp nhất Folder vào Playlist — "Properties -> Download" cho 1 folder cụ
         * thể) — thêm tham số `keys` TUỲ CHỌN: có truyền thì zip ĐÚNG danh sách đó (không tự
         * `getAllSongKeys()` nữa); không truyền (`undefined`, mọi lời gọi CŨ) thì giữ NGUYÊN hành vi
         * gốc (toàn bộ thư viện) — tương thích ngược 100%, không cần sửa nơi gọi cũ.
         * SỬA (10/09/2026, Giang yêu cầu "làm đầy đủ, thay JSZip toàn app") — thân hàm tách sang 2
         * hàm dùng chung `_collectZipEntries()`/`_compressZipEntries()` ngay trên (KHÔNG đổi hành
         * vi/tham số bên ngoài, vẫn nhận `(keys, onProgress)` trả `Promise<Blob>` y hệt cũ — mọi nơi
         * gọi hàm này KHÔNG cần sửa gì).
         * @param {string[]} [keys]
         */
        async function buildAllSongsZipBlob(keys, onProgress) {
            if (!keys) keys = await getAllSongKeys();
            const entries = await _collectZipEntries(keys, getSongRecord, '.mp3');
            return _compressZipEntries(entries, onProgress);
        }

        /**
         * Cờ RAM (sống trong phiên hiện tại, KHÔNG bền qua reload) — true SUỐT lúc
         * clearAllStoredData() đang chạy. STATE — xem service/state.js.
         */

        /** Xóa TOÀN BỘ dữ liệu app khỏi IndexedDB: cả 2 store songs + meta — dùng chung cho cả 2 nút giải phóng bộ nhớ.
         *
         * AN TOÀN KHI BỊ GIÁN ĐOẠN (đóng tab/crash giữa chừng):
         *   - meta.clearingInProgress = true được ghi NGAY ĐẦU hàm, TRƯỚC khi xoá bất kỳ key nào —
         *     nếu tab bị đóng/crash giữa lúc đang xoá, lần mở app kế tiếp sẽ thấy cờ này còn `true`
         *     (xem event/workflow/app-boot.js, kiểm tra TRƯỚC khi load playlist) và tự GỌI
         *     LẠI ĐÚNG hàm clearAllStoredData() này để dọn tiếp phần còn sót, dưới lớp loading
         *     shield — hàm này AN TOÀN để gọi lại nhiều lần (idempotent): xoá 1 key không tồn tại
         *     qua idbKeyval.del() không lỗi, vòng for chỉ còn lại đúng những key thật sự còn sót.
         *   - meta.clearingInProgress chỉ bị xoá (delMeta) SAU KHI mọi bước xoá đã xong hoàn toàn —
         *     nếu hàm này throw giữa chừng (lỗi IndexedDB...), cờ vẫn còn `true`, lần mở app sau
         *     vẫn tự retry đúng như kịch bản đóng tab.
         */
        async function clearAllStoredData() {
            appState.set('isDestructiveTaskInProgress', true);
            try {
                await setMeta('clearingInProgress', true);

                // [QUYẾT ĐỊNH 1.8] "Xóa hết dữ liệu" CHỈ xóa bài hát (và thống kê nghe riêng từng bài,
                // vì bài hát đã mất). KHÔNG đụng tới ảnh/video nền (bgImage/videoBg) — đó là tài nguyên
                // người dùng thiết lập riêng, không nằm trong "thư viện nhạc".
                const songKeys = await getAllSongKeys();
                for (const key of songKeys) await deleteSongRecord(key);
                await delMeta('totalListenSeconds');
                if (typeof clearAllSongStats === 'function') await clearAllSongStats();

                // Đồng bộ lại toàn bộ state RAM — không reload trang, để người dùng thấy ngay kết quả.
                appState.set('playlistOrder', []); appState.set('displayOrder', []); appState.mutate('playlistCache', m => m.clear()); appState.mutate('songNameIndex', m => m.clear()); appState.mutate('confirmedBrokenKeys', s => s.clear());
                appState.mutate('pendingResortKeys', s => s.clear());
                // SỬA (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ") — recomputeRenderOrder()
                // ĐÃ DỜI hẳn sang event/workflow/playlist-order.js (workflowPlaylistOrder) — CÙNG
                // ghi chú nợ "Core gọi Workflow" như các chỗ khác đã sửa trong đợt này. Giữ NGUYÊN
                // guard phòng thủ (kiểm tra tồn tại trước khi gọi) — CHỈ đổi đối tượng kiểm tra.
                if (typeof workflowPlaylistOrder !== 'undefined') workflowPlaylistOrder.recomputeRenderOrder();
                if (appState.get('currentKey')) { audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null); }
                if (typeof killAllAutoSwitchVisualTasks === 'function') killAllAutoSwitchVisualTasks();
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                if (typeof workflowPlaylistOrder !== 'undefined') workflowPlaylistOrder.updateShuffleArray(); // event/workflow/playlist-order.js (dời từ core/playlist/order.js)
                workflowPlaylistRender.renderPlaylistFull();
                saveConfig();
                if (typeof forceBackToPlaylistUI === 'function') forceBackToPlaylistUI();
                if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa

                await delMeta('clearingInProgress'); // chỉ xoá cờ SAU KHI mọi bước trên đã xong hoàn toàn
            } finally {
                appState.set('isDestructiveTaskInProgress', false);
            }
        }

        /**
         * MỚI (ver12 "Song/Video Unification", Batch 5, mục 6b) — mirror buildAllSongsZipBlob()
         * ngay trên, bản của Video (mỗi domain viết riêng, cùng quy ước "mỗi domain 1 hàm" đã dùng
         * cho renderVideoStorageStats()/computeVideoStats()).
         * SỬA (06/09/2026) — thêm `keys` tuỳ chọn, CÙNG LÝ DO buildAllSongsZipBlob() ngay trên.
         * @param {string[]} [keys]
         */
        async function buildAllVideosZipBlob(keys, onProgress) {
            if (!keys) keys = await getAllVideoKeys(); // service/db.js
            const entries = await _collectZipEntries(keys, getVideoRecord, '.mp4');
            return _compressZipEntries(entries, onProgress);
        }

        /**
         * MỚI (Batch 5, mục 6b) — xoá TOÀN BỘ record Video. CỐ Ý viết ĐƠN GIẢN + THUẦN (Rule 1-4
         * đầy đủ — không appState, không DOM, không gọi core nào khác trong file này) — KHÔNG mirror
         * đầy đủ độ phức tạp của `clearAllStoredData()` (Song) phía trên: hàm đó là code DI SẢN, tự
         * làm rất nhiều việc (appState, DOM, gọi hàm khác, cờ an toàn khi bị gián đoạn giữa chừng) —
         * VI PHẠM Rule 1-4 nhiều chỗ, nhưng KHÔNG bị đụng tới ở batch này (không "đụng phải" theo
         * đúng nghĩa sửa thân hàm) nên GIỮ NGUYÊN, không tự ý sửa lại. Hàm Video MỚI này viết ĐÚNG
         * chuẩn ngay từ đầu — phần đồng bộ RAM/UI (thoát Video Player mode nếu đang bật, rỗng hoá
         * playlistCache nếu đang browse nguồn Video) đẩy hẳn sang Workflow gọi SAU khi hàm này chạy
         * xong (xem event/workflow/file-manager-song.js::_resetVideoRuntimeStateAfterClear()).
         * KHÔNG có cờ an toàn "clearingInProgress" như bản Song (tính năng mới, đơn giản hoá có chủ
         * đích — nếu cần độ an toàn tương đương khi bị gián đoạn giữa chừng, cần yêu cầu riêng).
         * @returns {Promise<void>}
         */
        async function clearAllVideosData() {
            const keys = await getAllVideoKeys(); // service/db.js
            for (const key of keys) await deleteVideoRecord(key); // service/db.js
        }

        /**
         * XOÁ (Batch 5, "Song/Video Unification" mục 6b) — `downloadAllSongsThenClear()`/
         * `clearAllSongsNoDownload()` (2 hàm gộp sẵn "build zip + download + clear", TỪNG là core
         * gọi core — chính hàm `downloadAllSongsThenClear()` tự gọi `buildAllSongsZipBlob()` VÀ
         * `clearAllStoredData()` ngay bên trong nó, vi phạm Rule 3 y hệt kiểu đã sửa ở
         * `addSongsToFolder()`/`renderStorageStats()`) ĐÃ XOÁ HẲN, không còn nơi nào gọi (2 tính
         * năng tách rời cũ đã thay bằng 3 field cấu hình độc lập, mục 6b). Workflow
         * (event/workflow/file-manager-song.js::_downloadZipFor()) giờ tự gọi `buildAllSongsZipBlob()`/
         * `buildAllVideosZipBlob()` RỒI `clearAllStoredData()`/`clearAllVideosData()` TÁCH RỜI,
         * đúng Rule 3 — KHÔNG viết lại 1 hàm gộp core mới để tránh lặp lại đúng lỗi vừa sửa.
         */

        // ===================== Quét & dọn file lỗi =====================

        async function isRecordCorrupted(record) {
            if (!record || !record.blob) return { corrupted: true, reason: t('common.storage.scanReasonBrokenBlob') };
            if (!isQuickValidMime(record.blob.type)) {
                return { corrupted: true, reason: tFormat('common.storage.scanReasonBadMime', { mime: record.blob.type || t('common.storage.scanReasonBadMimeEmpty') }) };
            }
            const duration = await readAudioDuration(record.blob);
            if (!duration || duration <= 0) return { corrupted: true, reason: t('common.storage.scanReasonNoDecode') };
            return { corrupted: false };
        }

        /**
         * NGHIỆP VỤ THUẦN: quét toàn bộ thư viện tìm record lỗi. KHÔNG tự gán biến toàn cục
         * lastScanResults, KHÔNG tự render UI — trả kết quả thuần.
         *
         * @param {(current:number, total:number) => void} [onScanProgress]
         * @returns {Promise<Array<{key:string, filename:string, reason:string}>>}
         */
        async function scanAllSongsForCorruption(onScanProgress) {
            const keys = await getAllSongKeys();
            const results = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (onScanProgress) onScanProgress(i + 1, keys.length);
                const record = await getSongRecord(key);
                if (appState.get('confirmedBrokenKeys').has(key)) {
                    results.push({ key, filename: record ? record.filename : key, reason: t('common.storage.scanReasonKeptFromError') });
                    continue;
                }
                const check = await isRecordCorrupted(record);
                if (check.corrupted) {
                    results.push({ key, filename: record ? record.filename : key, reason: check.reason });
                }
            }
            return results;
        }

        /**
         * NGHIỆP VỤ THUẦN: xoá đúng các record trong scanResults (trừ currentKeyNow đang phát).
         * KHÔNG tự gọi resetScanResultUI()/renderStorageStats() — quyết định thứ tự đó là của workflow.
         *
         * @param {Array<{key:string}>} scanResults
         * @param {string|null} currentKeyNow
         * @returns {Promise<void>}
         */
        async function deleteCorruptedSongs(scanResults, currentKeyNow) {
            for (const { key } of scanResults) {
                if (key === currentKeyNow) continue;
                await deleteSongRecord(key);
                appState.mutate('confirmedBrokenKeys', s => s.delete(key));
                removeKeyFromDisplay(key);
            }
        }

        /**
         * MỚI (ver12 "Song/Video Unification", mục 6b, phản hồi Giang 28/07/2026 — "quét lỗi vẫn
         * chưa theo scope") — bản Video của isRecordCorrupted() ngay trên. Viết RIÊNG (Rule 3 cấm
         * gọi lại hàm scan của Song) — nạp blob vào <video> ẩn tạm, dựa 'error' vs 'loadedmetadata'
         * (ĐÚNG như plan mục 6b chỉ định), CÙNG khuôn `readAudioDuration()` (core/playlist/
         * loader.js, bản Song — timeout an toàn 8s cho Safari iOS).
         * @param {Object} record
         * @returns {Promise<{corrupted: boolean, reason?: string}>}
         */
        function isVideoRecordCorrupted(record) {
            if (!record || !record.blob) return Promise.resolve({ corrupted: true, reason: t('common.storage.scanReasonBrokenBlob') });
            return new Promise((resolve) => {
                let settled = false;
                const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
                let tempUrl;
                try { tempUrl = URL.createObjectURL(record.blob); }
                catch (err) { return safeResolve({ corrupted: true, reason: t('common.storage.scanReasonBrokenBlob') }); }
                const tempVideo = document.createElement('video');
                const cleanup = () => { try { URL.revokeObjectURL(tempUrl); } catch (e) {} };
                const safetyTimeout = taskManager.once(() => { cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonNoDecode') }); }, 8000);
                tempVideo.addEventListener('loadedmetadata', () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: false }); }, { once: true });
                tempVideo.addEventListener('error', () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonNoDecode') }); }, { once: true });
                try { tempVideo.src = tempUrl; }
                catch (err) { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonBrokenBlob') }); }
            });
        }

        /**
         * Bản Video của scanAllSongsForCorruption() ngay trên — NGHIỆP VỤ THUẦN, không tự render
         * UI/gán biến toàn cục.
         * @param {(current:number, total:number) => void} [onScanProgress]
         * @returns {Promise<Array<{key:string, filename:string, reason:string}>>}
         */
        async function scanAllVideosForCorruption(onScanProgress) {
            const keys = await getAllVideoKeys();
            const results = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (onScanProgress) onScanProgress(i + 1, keys.length);
                const record = await getVideoRecord(key);
                if (appState.get('confirmedBrokenKeys').has(key)) {
                    results.push({ key, filename: record ? record.filename : key, reason: t('common.storage.scanReasonKeptFromError') });
                    continue;
                }
                const check = await isVideoRecordCorrupted(record);
                if (check.corrupted) {
                    results.push({ key, filename: record ? record.filename : key, reason: check.reason });
                }
            }
            return results;
        }

        /**
         * Bản Video của deleteCorruptedSongs() ngay trên — KHÁC 1 điểm CÓ CHỦ ĐÍCH: KHÔNG tự gọi
         * `removeKeyFromDisplay()` bên trong (hàm đó ở core/playlist/actions.js — FILE KHÁC, gọi
         * thẳng từ đây sẽ là core gọi core, Rule 3 — bản Song ĐÃ vi phạm y hệt kiểu này từ trước,
         * nhưng không "đụng phải" theo đúng nghĩa sửa thân hàm nên KHÔNG tự ý sửa lại; hàm MỚI này
         * viết ĐÚNG chuẩn ngay từ đầu). Trả về danh sách key ĐÃ xoá — Workflow (event/workflow/
         * file-manager-song.js) tự gọi `removeKeyFromDisplay()` cho TỪNG key sau khi hàm này chạy
         * xong.
         * @param {Array<{key:string}>} scanResults
         * @param {string|null} currentKeyNow
         * @returns {Promise<string[]>} danh sách videoKey đã xoá thật (currentKeyNow bị loại trừ)
         */
        async function deleteCorruptedVideos(scanResults, currentKeyNow) {
            const deletedKeys = [];
            for (const { key } of scanResults) {
                if (key === currentKeyNow) continue;
                await deleteVideoRecord(key);
                appState.mutate('confirmedBrokenKeys', s => s.delete(key));
                deletedKeys.push(key);
            }
            return deletedKeys;
        }

        /** @param {HTMLElement} resultEl @param {HTMLElement} listEl */
        function resetScanResultUI(resultEl, listEl) {
            if (!resultEl) return; // guard: panel đang đóng
            resultEl.classList.add('hidden');
            listEl.innerHTML = '';
        }

        /**
         * @param {Array<{key:string,filename:string,reason:string}>} results
         * @param {HTMLElement} resultEl @param {HTMLElement} summaryEl @param {HTMLElement} listEl @param {HTMLElement} deleteBtnEl
         */
        function renderScanResultUI(results, resultEl, summaryEl, listEl, deleteBtnEl) {
            if (!resultEl) return; // guard: panel đang đóng
            resultEl.classList.remove('hidden');
            if (results.length === 0) {
                summaryEl.textContent = t('common.storage.scanNoneFound');
                listEl.innerHTML = '';
                deleteBtnEl.classList.add('hidden');
            } else {
                summaryEl.textContent = tFormat('common.storage.scanFoundCount', { n: results.length });
                // FIX: r.filename là tên file NGƯỜI DÙNG TỰ ĐẶT (không phải dữ liệu app tự dựng),
                // r.reason có thể chứa mime type đọc thẳng từ file (record.blob.type) — cả 2 đều
                // KHÔNG đáng tin cậy, PHẢI escapeHtml() trước khi nhúng vào innerHTML, cùng nguyên
                // tắc đã áp dụng cho mọi chỗ tương tự ở patch alert->alertModal trước đó.
                listEl.innerHTML = results.map(r => `<div class="truncate"><span class="text-amber-400">●</span> ${escapeHtml(r.filename)} — ${escapeHtml(r.reason)}</div>`).join('');
                deleteBtnEl.classList.remove('hidden');
            }
        }

        // ===================== Photo — MỚI (29/07/2026, yêu cầu Giang mục "checkbox Photo
        // đầy đủ như Song/Video") — mirror ĐẦY ĐỦ bộ hàm zip/xoá tất cả/quét lỗi/xoá lỗi của
        // Video ngay trên, viết RIÊNG bản của Photo (Rule 3 — mỗi domain 1 bộ hàm riêng, không gọi
        // chéo). NẠP THÊM: core/file-manager/image.js (getAllImageKeys/getImageRecord/
        // deleteImageRecord). =====================

        /** Đóng gói TOÀN BỘ ảnh GỐC (blob thật, không phải thumbBlob) thành 1 file .zip. Mirror
         * `buildAllVideosZipBlob()` ngay trên.
         * SỬA (06/09/2026) — thêm `keys` tuỳ chọn, CÙNG LÝ DO buildAllSongsZipBlob() ở trên.
         * @param {string[]} [keys]
         */
        async function buildAllPhotosZipBlob(keys, onProgress) {
            if (!keys) keys = await getAllImageKeys(); // service/db.js
            const entries = await _collectZipEntries(keys, getImageRecord, '.jpg');
            return _compressZipEntries(entries, onProgress);
        }

        /**
         * Xoá TOÀN BỘ ảnh. Viết ĐƠN GIẢN + THUẦN — không appState, không DOM (cùng tinh thần
         * `clearAllVideosData()` ngay trên, KHÔNG mirror độ phức tạp/cờ an toàn của
         * `clearAllStoredData()` bản Song di sản).
         * XOÁ (loại bỏ Album khỏi Photo Panel) — rỗng hoá `imageKeys` của từng album bỏ hẳn cùng
         * tính năng (Album không còn tồn tại trong app).
         * @returns {Promise<void>}
         */
        async function clearAllPhotosData() {
            const keys = await getAllImageKeys(); // service/db.js
            for (const key of keys) await deleteImageRecord(key); // service/db.js
        }

        /** Bản Photo của `isRecordCorrupted()`/`isVideoRecordCorrupted()` — thử decode ảnh qua
         * `Image()` (DOM API cho việc TÍNH TOÁN thuần, KHÔNG phải dựng UI — cùng tiền lệ dùng
         * `<video>` ẩn tạm ở `isVideoRecordCorrupted()` ngay trên). */
        function isImageRecordCorrupted(record) {
            if (!record || !record.blob) return Promise.resolve({ corrupted: true, reason: t('common.storage.scanReasonBrokenBlob') });
            return new Promise((resolve) => {
                let settled = false;
                const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
                let tempUrl;
                try { tempUrl = URL.createObjectURL(record.blob); }
                catch (err) { return safeResolve({ corrupted: true, reason: t('common.storage.scanReasonBrokenBlob') }); }
                const img = new Image();
                const cleanup = () => { try { URL.revokeObjectURL(tempUrl); } catch (e) {} };
                const safetyTimeout = taskManager.once(() => { cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonNoDecode') }); }, 8000);
                img.addEventListener('load', () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: false }); }, { once: true });
                img.addEventListener('error', () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonNoDecode') }); }, { once: true });
                img.src = tempUrl;
            });
        }

        /** Bản Photo của `scanAllVideosForCorruption()` — NGHIỆP VỤ THUẦN, không tự render UI. */
        async function scanAllPhotosForCorruption(onScanProgress) {
            const keys = await getAllImageKeys();
            const results = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (onScanProgress) onScanProgress(i + 1, keys.length);
                const record = await getImageRecord(key);
                if (appState.get('confirmedBrokenKeys').has(key)) {
                    results.push({ key, filename: record ? record.filename : key, reason: t('common.storage.scanReasonKeptFromError') });
                    continue;
                }
                const check = await isImageRecordCorrupted(record);
                if (check.corrupted) {
                    results.push({ key, filename: record ? record.filename : key, reason: check.reason });
                }
            }
            return results;
        }

        /** Bản Photo của `deleteCorruptedVideos()`.
         * XOÁ (loại bỏ Album khỏi Photo Panel) — dọn cascade khỏi mọi album đang chứa ảnh vừa xoá
         * bỏ hẳn cùng tính năng (Album không còn tồn tại trong app).
         * @param {Array<{key:string}>} scanResults
         * @returns {Promise<string[]>} danh sách imageKey đã xoá thật.
         */
        async function deleteCorruptedPhotos(scanResults) {
            const deletedKeys = [];
            for (const { key } of scanResults) {
                await deleteImageRecord(key);
                appState.mutate('confirmedBrokenKeys', s => s.delete(key));
                deletedKeys.push(key);
            }
            return deletedKeys;
        }
// (Document — ĐÃ XOÁ, loại bỏ Document Reader khỏi app: buildAllDocumentsZipBlob/clearAllDocumentsData/isDocumentRecordCorrupted/scanAllDocumentsForCorruption/deleteCorruptedDocuments bỏ hẳn cùng tính năng.)
