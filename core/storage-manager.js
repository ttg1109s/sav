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
         *          MỚI (06/10/2026) — thêm `barOtherEl`, `freeRowEl`, `freeBytesEl` (đoạn "Khác" +
         *          dòng "còn trống" của thanh, xem components/file-manager-storage.js).
         * @param {{otherBytes: number, freeBytes: number, quota: number}|null} [originBreakdown] -
         *          MỚI (06/10/2026) — kết quả `computeOriginStorageBreakdown()` (ngay dưới), Workflow
         *          tính sẵn rồi truyền vào (Rule 3 — hàm này KHÔNG tự gọi core đó). `null` = không có
         *          estimate -> thanh vẽ như cũ (tỉ lệ giữa 3 media), ẩn dòng "còn trống".
         * @param {{totalBytesText: string, freeText: string}} texts - SỬA (06/10/2026, dọn nợ Rule 3a) — chuỗi dung lượng
         *          Workflow định dạng sẵn (formatBytes(), core/about-stats.js) — hàm này không gọi core khác nữa.
         */
        function renderStorageStats(songStats, videoStats, photoStats, els, originBreakdown, texts) {
            const { totalBytesEl, barSongsEl, barVideosEl, barPhotosEl, barOtherEl, freeRowEl, freeBytesEl, countSongsEl, countVideosEl, countPhotosEl } = els;
            if (!totalBytesEl) return; // guard: panel "Quản lý lưu trữ" đang đóng
            totalBytesEl.textContent = texts.totalBytesText;

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

            // SỬA (06/10/2026) — có estimate thì đưa THÊM "Khác" + "còn trống" vào phép chia: tổng =
            // quota của app, thanh thành thang đo theo quota (phần "còn trống" KHÔNG vẽ div riêng —
            // chính là phần track còn lại; % của nó chỉ dùng để tính, bỏ qua). Không có estimate thì 2
            // giá trị này = 0 -> phép chia y hệt cách cũ (tỉ lệ giữa 3 media).
            const otherBytes = originBreakdown ? originBreakdown.otherBytes : 0;
            const freeBytes = originBreakdown ? originBreakdown.freeBytes : 0;
            const [songPct, videoPct, photoPct, otherPct] = computeBarPercents([
                songStats.totalBytes, videoStats.totalBytes, photoStats.totalBytes, otherBytes, freeBytes
            ]);
            // MỚI (29/07/2026, yêu cầu Giang mục 2 — "thêm phần số dung lượng khi ấn vào mỗi phần
            // của thanh") — gắn `dataset.bytes` (số byte THẬT, KHÔNG phải %) vào từng đoạn — đọc lại
            // lúc người dùng ấn vào (event/listener/file-manager-storage.js -> event/workflow/
            // file-manager-storage.js::showSegmentBytes()) để hiện đúng số byte của ĐÚNG đoạn đó,
            // không cần tính lại/đọc lại DB lúc bấm.
            if (barSongsEl) { barSongsEl.style.width = `${songPct}%`; barSongsEl.dataset.bytes = String(songStats.totalBytes); }
            if (barVideosEl) { barVideosEl.style.width = `${videoPct}%`; barVideosEl.dataset.bytes = String(videoStats.totalBytes); }
            if (barPhotosEl) { barPhotosEl.style.width = `${photoPct}%`; barPhotosEl.dataset.bytes = String(photoStats.totalBytes); }
            if (barOtherEl) { barOtherEl.style.width = `${otherPct}%`; barOtherEl.dataset.bytes = String(otherBytes); }
            if (freeRowEl) freeRowEl.classList.toggle('hidden', !originBreakdown);
            if (freeBytesEl && originBreakdown) freeBytesEl.textContent = texts.freeText;
            if (countSongsEl) countSongsEl.textContent = `${songStats.totalSongs}`;
            if (countVideosEl) countVideosEl.textContent = `${videoStats.totalVideos}`;
            if (countPhotosEl) countPhotosEl.textContent = `${photoStats.totalImages}`;
        }

        // DỜI (06/10/2026, dọn nợ Rule 3b) — `estimateOriginStorage()` (core tự ĐỌC navigator.storage.estimate()) sang
        // event/workflow/file-manager-storage.js::_estimateOriginStorage().

        /**
         * MỚI (06/10/2026) — THUẦN tính toán: tách usage của origin thành "Khác" (usage trừ tổng
         * media) + "còn trống" (quota trừ phần đã dùng). Estimate có thể THẤP hơn tổng media đếm từ
         * DB (ước tính/làm tròn của trình duyệt) — kẹp về 0 để không ra số âm, và lấy max(usage,
         * media) làm "đã dùng" để phần còn trống không bị thổi phồng.
         * @param {number} mediaBytes - tổng byte Song + Video + Photo
         * @param {{usage: number, quota: number}|null} estimate - `estimateOriginStorage()`
         * @returns {{otherBytes: number, freeBytes: number, quota: number}|null}
         */
        function computeOriginStorageBreakdown(mediaBytes, estimate) {
            if (!estimate) return null;
            const usedBytes = Math.max(estimate.usage, mediaBytes);
            return {
                otherBytes: Math.max(0, estimate.usage - mediaBytes),
                freeBytes: Math.max(0, estimate.quota - usedBytes),
                quota: estimate.quota,
            };
        }

        // ===================== Giải phóng bộ nhớ =====================

        /**
         * THAY (06/10/2026, dọn nợ Rule 3b — Giang yêu cầu) `_collectZipEntries()` (core tự gọi hàm đọc record truyền vào +
         * tự gắn tag): giờ CHỈ còn phần THUẦN — từ `records` (Workflow đã đọc 1 transaction, thẳng hàng `keys`) dựng danh sách
         * file cần nén, bỏ key không còn tồn tại / thiếu Blob, đặt tên chống trùng (thêm hậu tố " (n)"). Workflow
         * (event/workflow/zip-download.js::collectEntries()) tự lấy Blob cuối (Song gắn lại tag ID3).
         * @param {string[]} keys
         * @param {Array<object|undefined>} records - thẳng hàng `keys`
         * @param {string} defaultExt - đuôi mặc định nếu record thiếu filename (vd ".mp3")
         * @returns {Array<{filename: string, record: object}>}
         */
        function planZipEntries(keys, records, defaultExt) {
            const usedNames = new Map(); // filename -> số lần đã dùng, để chống trùng tên trong zip
            const plan = [];
            keys.forEach((key, index) => {
                const record = records[index];
                if (!record || !record.blob) return;
                let name = record.filename || `${key}${defaultExt}`;
                if (usedNames.has(name)) {
                    const count = usedNames.get(name) + 1; usedNames.set(name, count);
                    const dot = name.lastIndexOf('.');
                    name = dot > -1 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
                } else { usedNames.set(name, 0); }
                plan.push({ filename: name, record });
            });
            return plan;
        }

        /** Nén `entries` (đã gom sẵn qua `workflowZipDownload.collectEntries()`) thành 1 Blob .zip — DÙNG CHUNG bởi
         * cả 3 hàm buildAllXZipBlob() ngay dưới. Dùng `buildZipStreamingToOpfs()` (core/
         * streaming-zip.js — thư viện zip.js, ghi TĂNG DẦN vào OPFS, không giới hạn dung lượng RAM)
         * — đây là ĐƯỜNG DUY NHẤT để nén zip trong app.
         *
         * XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") — nhánh dự phòng
         * `new JSZip()...generateAsync({type:'blob'})` (dựng liền 1 khối Blob trong RAM, chạy khi
         * `isStreamingZipAvailable()` false/`buildZipStreamingToOpfs()` lỗi) đã bỏ hẳn — trình duyệt
         * không hỗ trợ OPFS (rất cũ, không còn theo Baseline hiện tại) hoặc streaming lỗi thì ném lỗi
         * thẳng ra ngoài, KHÔNG còn lưới an toàn nào để rơi về nữa. Nơi gọi
         * (`zipAndDownloadOrFallback()`, event/workflow/file-manager-storage.js; 3 hàm export zip ở
         * event/workflow/playlist.js) đã có sẵn try/catch báo lỗi rõ ràng cho người dùng.
         *
         * MỚI (10/09/2026, Giang yêu cầu) — log thời điểm BẮT ĐẦU/KẾT THÚC toàn bộ bước nén. Đính
         * kèm `_zipDurationMs` (thuộc tính JS tuỳ biến, KHÔNG phải attribute chuẩn nào) lên chính
         * Blob trả về — nơi gọi cuối cùng (`promptDownloadReady()`, core/id3-export.js) đọc lại để
         * hiện "thời gian xử lý" trong modal "File đã sẵn sàng", không cần đo lại/truyền riêng qua
         * nhiều tầng workflow.
         * @param {Array<{filename:string, blob:Blob}>} entries
         * @param {(done:number,total:number,percent:number|null) => void} [onProgress]
         * @returns {Promise<Blob>}
         */
        /**
         * MỚI (06/10/2026, Giang yêu cầu "zip lớn hơn 500MB thì chia thành nhóm rồi zip") — THUẦN tính toán:
         * chia `entries` thành các nhóm liên tiếp (GIỮ thứ tự gốc), tổng dung lượng mỗi nhóm <= `maxBytes`.
         * 1 entry tự nó đã lớn hơn `maxBytes` (file cũ nạp trước khi có giới hạn upload) đứng riêng 1 nhóm.
         * Không có entry nào -> mảng rỗng. Workflow nén TỪNG nhóm bằng `_compressZipEntries()` ngay dưới.
         * @param {Array<{filename:string, blob:Blob}>} entries
         * @param {number} maxBytes
         * @returns {Array<Array<{filename:string, blob:Blob}>>}
         */
        function groupZipEntriesBySize(entries, maxBytes) {
            const groups = [];
            let current = [];
            let currentBytes = 0;
            for (const entry of entries) {
                const size = entry.blob.size;
                // nhóm đang dở mà thêm entry này sẽ vượt ngưỡng -> chốt nhóm, mở nhóm mới
                if (current.length > 0 && currentBytes + size > maxBytes) {
                    groups.push(current);
                    current = [];
                    currentBytes = 0;
                }
                current.push(entry);
                currentBytes += size;
            }
            if (current.length > 0) groups.push(current);
            return groups;
        }

        async function _compressZipEntries(entries, onProgress) {
            if (!isStreamingZipAvailable()) { // core/streaming-zip.js
                throw new Error(t('common.storage.zipNotSupported'));
            }
            const startedAt = Date.now();
            console.log(`[storage-manager] Bắt đầu nén zip (${entries.length} file) lúc ${new Date(startedAt).toLocaleTimeString()}.`);
            const blob = await buildZipStreamingToOpfs(entries, onProgress); // core/streaming-zip.js — lỗi ném thẳng ra ngoài, nơi gọi tự bắt (KHÔNG còn JSZip để rơi về)
            const durationMs = Date.now() - startedAt;
            console.log(`[storage-manager] Nén zip xong lúc ${new Date().toLocaleTimeString()} — mất ${(durationMs / 1000).toFixed(1)}s.`);
            blob._zipDurationMs = durationMs;
            return blob;
        }

        // XOÁ (06/10/2026, dọn nợ Rule 3b) — `collectAllSongsZipEntries()`/`collectAllVideosZipEntries()`/`collectAllPhotosZipEntries()`
        // (core tự đọc DB): Workflow gọi `workflowZipDownload.collectEntries(type, keys)` (event/workflow/zip-download.js).

        /**
         * Cờ RAM (sống trong phiên hiện tại, KHÔNG bền qua reload) — true SUỐT lúc
         * clearAllStoredData() đang chạy. STATE — xem service/state.js.
         */

        // DỜI (24/09/2026, dọn nợ "Core gọi Workflow") — `clearAllStoredData()` (tự appState + gọi workflowPlaylistOrder/
        // workflowPlaylistRender + core khác) sang event/workflow/file-manager-storage.js::
        // `workflowFileManagerStorage.clearAllStoredData()`, thân giữ nguyên (chỉ đổi phần "về Playlist").


        // XOÁ (06/10/2026, plan-media-db-split.md) — `clearAllVideosData()`: Workflow gọi thẳng `clearAllMediaOfType('video')`
        // (service/db.js — xoá 3 store trong 1 transaction, thay vòng deleteVideoRecord() từng key).

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
         * GỘP (06/10/2026, plan-media-db-split.md) — THAY 3 hàm `deleteCorruptedSongs()`/`deleteCorruptedVideos()`/
         * `deleteCorruptedPhotos()` (cùng 1 quy trình, chỉ khác store — đổi sang `deleteMediaRecord(type, key)` xoá 3 store
         * trong 1 transaction). Bỏ qua `skipKey` (media đang phát — Photo truyền null). TRẢ VỀ danh sách key đã xoá,
         * Workflow tự loại khỏi Playlist. Bổ sung log ghi state (Rule 4) mà bản cũ thiếu.
         * @param {'song'|'video'|'photo'} type
         * @param {Array<{key:string}>} scanResults
         * @param {string|null} skipKey
         * @returns {Promise<string[]>} key đã xoá thật.
         */
        async function deleteCorruptedMediaRecords(type, scanResults, skipKey) {
            const deletedKeys = [];
            for (const { key } of scanResults) {
                if (key === skipKey) continue;
                await deleteMediaRecord(type, key); // service/db.js
                appState.mutate('confirmedBrokenKeys', s => s.delete(key));
                console.log(`writer: "deleteCorruptedMediaRecords", page: "confirmedBrokenKeys", content: "-${key}"`);
                deletedKeys.push(key);
            }
            return deletedKeys;
        }

        /**
         * MỚI (ver12 "Song/Video Unification", mục 6b, phản hồi Giang 28/07/2026 — "quét lỗi vẫn
         * chưa theo scope") — bản Video của isRecordCorrupted() ngay trên. Viết RIÊNG (Rule 3 cấm
         * gọi lại hàm scan của Song) — nạp blob vào <video> ẩn tạm, dựa 'error' vs 'loadedmetadata'
         * (ĐÚNG như plan mục 6b chỉ định), CÙNG khuôn `readAudioDuration()` (core/playlist/
         * loader.js, bản Song — timeout an toàn 8s cho Safari iOS).
         * SỬA (18/09/2026, Giang yêu cầu "thiếu thumb cover, thumb full res -> cũng là lỗi thật —
         * nhưng xử lý tuỳ theo trường hợp chứ không nhất định phải xoá") — thêm field `fixable`
         * vào kết quả: `false` (mặc định, giữ NGUYÊN 3 lý do cũ — blob rỗng/không tạo được object
         * URL/không decode được) nghĩa là blob CHÍNH hỏng, phải xoá cả record (KHÔNG có gì "sửa"
         * được từ chính video đó); `true` (case MỚI, chỉ xét SAU khi blob chính đã xác nhận đọc
         * được — `loadedmetadata` bắn) nghĩa là chỉ THIẾU `thumbBlob`/`thumbFullBlob`, video vẫn
         * phát bình thường — Workflow (`executeRepairBroken()`, event/workflow/
         * file-manager-storage.js) tạo lại thumb thay vì xoá. 2 lý do MỚI gộp chung 1 chuỗi (có thể
         * thiếu CẢ HAI cùng lúc) thay vì tách 2 kết quả riêng cho 1 video — người dùng chỉ cần biết
         * "video này cần sửa thumb", không cần phân biệt thiếu loại nào khi xem danh sách quét.
         * @param {Object} record
         * @returns {Promise<{corrupted: boolean, fixable?: boolean, reason?: string}>}
         */
        function isVideoRecordCorrupted(record) {
            if (!record || !record.blob) return Promise.resolve({ corrupted: true, fixable: false, reason: t('common.storage.scanReasonBrokenBlob') });
            return new Promise((resolve) => {
                let settled = false;
                const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
                let tempUrl;
                try { tempUrl = URL.createObjectURL(record.blob); }
                catch (err) { return safeResolve({ corrupted: true, fixable: false, reason: t('common.storage.scanReasonBrokenBlob') }); }
                const tempVideo = document.createElement('video');
                // SỬA (07/10/2026, lỗi "scan xong vào lại bài đang phát bị khựng") — chỉ cần metadata, không buffer/decode
                // khung hình; muted + playsInline để iOS không coi thẻ tạm là media có tiếng (không đụng audio session).
                tempVideo.preload = 'metadata';
                tempVideo.muted = true;
                tempVideo.playsInline = true;
                let released = false;
                const onMeta = () => {
                    safetyTimeout.kill(); cleanup();
                    // MỚI — blob chính đọc được: kiểm thêm 2 field thumb, KHÔNG chặn phát nhưng vẫn
                    // tính "lỗi cần sửa" (đúng yêu cầu Giang, khác hẳn coi là bình thường như trước).
                    const missingReasons = [];
                    if (!record.thumbBlob) missingReasons.push(t('common.storage.scanReasonMissingThumbCover'));
                    if (!record.thumbFullBlob) missingReasons.push(t('common.storage.scanReasonMissingThumbFull'));
                    if (missingReasons.length > 0) { safeResolve({ corrupted: true, fixable: true, reason: missingReasons.join(', ') }); return; }
                    safeResolve({ corrupted: false });
                };
                const onError = () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, fixable: false, reason: t('common.storage.scanReasonNoDecode') }); };
                // SỬA (07/10/2026) — giải phóng HẲN thẻ <video> tạm (trước đây chỉ revoke URL, element vẫn giữ media player +
                // phiên giải mã video tới khi GC dọn — quét N video = N player mồ côi). Thứ tự chuẩn: pause -> bỏ src -> load()
                // -> revoke. Cờ `released` chặn chạy 2 lần (load() rỗng có thể bắn lại 'error' trên vài engine).
                const cleanup = () => {
                    if (released) return;
                    released = true;
                    tempVideo.removeEventListener('loadedmetadata', onMeta);
                    tempVideo.removeEventListener('error', onError);
                    try { tempVideo.pause(); } catch (e) {}
                    tempVideo.removeAttribute('src');
                    try { tempVideo.load(); } catch (e) {}
                    try { URL.revokeObjectURL(tempUrl); } catch (e) {}
                };
                const safetyTimeout = taskManager.once(() => { cleanup(); safeResolve({ corrupted: true, fixable: false, reason: t('common.storage.scanReasonNoDecode') }); }, 8000);
                tempVideo.addEventListener('loadedmetadata', onMeta);
                tempVideo.addEventListener('error', onError);
                try { tempVideo.src = tempUrl; }
                catch (err) { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, fixable: false, reason: t('common.storage.scanReasonBrokenBlob') }); }
            });
        }

        /**
         * Bản Video của scanAllSongsForCorruption() ngay trên — NGHIỆP VỤ THUẦN, không tự render
         * UI/gán biến toàn cục. SỬA (18/09/2026) — truyền tiếp `fixable` từ isVideoRecordCorrupted()
         * ra kết quả (Router/`executeFixBroken` cần field này để rẽ nhánh xoá/sửa). Item "kept from
         * error" (đã confirmedBrokenKeys, người dùng từng chọn "Giữ lại" lúc phát lỗi) luôn
         * `fixable: false` — đó là quyết định thủ công cũ, không liên quan gì thumb, KHÔNG tự ý
         * gộp vào nhánh "sửa".
         * @param {(current:number, total:number) => void} [onScanProgress]
         * @returns {Promise<Array<{key:string, filename:string, reason:string, fixable:boolean}>>}
         */
        async function scanAllVideosForCorruption(onScanProgress) {
            const keys = await getAllVideoKeys();
            const results = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (onScanProgress) onScanProgress(i + 1, keys.length);
                const record = await getVideoRecord(key);
                if (appState.get('confirmedBrokenKeys').has(key)) {
                    results.push({ key, filename: record ? record.filename : key, reason: t('common.storage.scanReasonKeptFromError'), fixable: false });
                    continue;
                }
                const check = await isVideoRecordCorrupted(record);
                if (check.corrupted) {
                    results.push({ key, filename: record ? record.filename : key, reason: check.reason, fixable: !!check.fixable });
                }
            }
            return results;
        }

        // GỘP (06/10/2026) — `deleteCorruptedVideos()` vào `deleteCorruptedMediaRecords('video', ...)` (phía trên).

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


        // XOÁ (06/10/2026, plan-media-db-split.md) — `clearAllPhotosData()`: Workflow gọi thẳng `clearAllMediaOfType('photo')`.

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
                let released = false;
                const onLoad = () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: false }); };
                const onError = () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonNoDecode') }); };
                // SỬA (07/10/2026, lỗi "scan xong vào lại bài đang phát bị khựng") — bỏ src để nhả bitmap full-res đã
                // decode ngay (trước đây ảnh decode xong vẫn nằm trong bộ nhớ tới khi GC dọn — quét cả thư viện ảnh
                // full-res = dồn áp lực bộ nhớ). Gỡ listener TRƯỚC khi bỏ src (bỏ src có thể bắn 'error' trên vài engine).
                const cleanup = () => {
                    if (released) return;
                    released = true;
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                    img.removeAttribute('src');
                    try { URL.revokeObjectURL(tempUrl); } catch (e) {}
                };
                const safetyTimeout = taskManager.once(() => { cleanup(); safeResolve({ corrupted: true, reason: t('common.storage.scanReasonNoDecode') }); }, 8000);
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
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

        // GỘP (06/10/2026) — `deleteCorruptedPhotos()` vào `deleteCorruptedMediaRecords('photo', ...)` (đầu file).
// (Document — ĐÃ XOÁ, loại bỏ Document Reader khỏi app: buildAllDocumentsZipBlob/clearAllDocumentsData/isDocumentRecordCorrupted/scanAllDocumentsForCorruption/deleteCorruptedDocuments bỏ hẳn cùng tính năng.)
