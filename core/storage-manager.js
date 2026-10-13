/**
 * core/storage-manager.js — Quản lý lưu trữ (panel Storage, 3 domain Song/Video/Photo): vẽ thanh dung lượng, tính phần
 * "Khác"/"còn trống", chia + nén zip, quét/xoá file lỗi, vẽ kết quả quét. Không shield/modal/addEventListener — Workflow
 * (event/workflow/file-manager-storage.js, event/workflow/zip-download.js) gọi và bọc; phần tử DOM nhận qua tham số.
 *
 * NẠP SAU: service/db.js, core/about-stats.js, core/streaming-zip.js, core/playlist/loader.js (readAudioDuration),
 * core/file-manager/{video,image}.js.
 */

        /**
         * Vẽ thanh chia đoạn 3 màu (Song/Video/Photo, + "Khác") và số lượng từng loại.
         * @param {{totalSongs: number, totalBytes: number}} songStats - core/about-stats.js::summarizeSongLibrary()
         * @param {{totalVideos: number, totalBytes: number}} videoStats - core/file-manager/video.js::summarizeVideoLibrary()
         * @param {{totalImages: number, totalBytes: number}} photoStats - core/file-manager/image.js::summarizeImageLibrary()
         * @param {{totalBytesEl: HTMLElement, barSongsEl: HTMLElement, barVideosEl: HTMLElement,
         *          barPhotosEl: HTMLElement, countSongsEl: HTMLElement,
         *          countVideosEl: HTMLElement, countPhotosEl: HTMLElement}} els
         *          + `barOtherEl`, `freeRowEl`, `freeBytesEl` (đoạn "Khác" + dòng "còn trống", components/file-manager-storage.js).
         *          Workflow querySelector sẵn rồi truyền vào.
         * @param {{otherBytes: number, freeBytes: number, quota: number}|null} [originBreakdown] - computeOriginStorageBreakdown();
         *          `null` = không có estimate -> thanh theo tỉ lệ giữa 3 media, ẩn dòng "còn trống".
         * @param {{totalBytesText: string, freeText: string}} texts - chuỗi dung lượng Workflow định dạng sẵn (formatBytes()).
         */
        function renderStorageStats(songStats, videoStats, photoStats, els, originBreakdown, texts) {
            const { totalBytesEl, barSongsEl, barVideosEl, barPhotosEl, barOtherEl, freeRowEl, freeBytesEl, countSongsEl, countVideosEl, countPhotosEl } = els;
            if (!totalBytesEl) return; // guard: panel "Quản lý lưu trữ" đang đóng
            totalBytesEl.textContent = texts.totalBytesText;

            // Đoạn có bytes > 0 luôn được độ rộng tối thiểu nhìn thấy được (Photo thường nhỏ hơn Song/Video rất nhiều, theo
            // tỉ lệ thuần sẽ < 1px); phần "vay" rút tỉ lệ thuận từ các đoạn lớn — tổng vẫn 100%. Closure lồng (Rule 3c).
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

            // Có estimate: thêm "Khác" + "còn trống" vào phép chia (thang đo = quota; "còn trống" là phần track còn lại, không
            // vẽ div riêng). Không có thì 2 giá trị này = 0 -> chia theo tỉ lệ giữa 3 media.
            const otherBytes = originBreakdown ? originBreakdown.otherBytes : 0;
            const freeBytes = originBreakdown ? originBreakdown.freeBytes : 0;
            const [songPct, videoPct, photoPct, otherPct] = computeBarPercents([
                songStats.totalBytes, videoStats.totalBytes, photoStats.totalBytes, otherBytes, freeBytes
            ]);
            // `dataset.bytes` (số byte thật) trên từng đoạn — bấm vào đoạn thì Workflow đọc lại để hiện
            // (event/workflow/file-manager-storage.js::showSegmentBytes()).
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

        /**
         * Tách usage của origin thành "Khác" (usage trừ tổng media) + "còn trống" (quota trừ phần đã dùng). Estimate có thể
         * thấp hơn tổng media đếm từ DB -> kẹp về 0, lấy max(usage, media) làm "đã dùng".
         * @param {number} mediaBytes - tổng byte Song + Video + Photo
         * @param {{usage: number, quota: number}|null} estimate - navigator.storage.estimate() (Workflow đọc)
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
         * Từ `records` (Workflow đọc 1 transaction, thẳng hàng `keys`) dựng danh sách file cần nén: bỏ key không còn / thiếu
         * Blob, đặt tên chống trùng (hậu tố " (n)"). Workflow (event/workflow/zip-download.js::collectEntries()) lấy Blob cuối
         * (Song gắn lại tag ID3).
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

        /**
         * Chia `entries` thành các nhóm liên tiếp (giữ thứ tự), tổng mỗi nhóm <= `maxBytes`; 1 entry tự nó lớn hơn `maxBytes`
         * (file nạp trước khi có giới hạn upload) đứng riêng 1 nhóm. Workflow nén từng nhóm bằng `_compressZipEntries()`.
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

        /** Nén `entries` thành 1 Blob .zip qua `buildZipStreamingToOpfs()` (core/streaming-zip.js — ghi tăng dần vào OPFS,
         * không giới hạn RAM) — đường nén zip duy nhất trong app; không hỗ trợ OPFS / lỗi thì ném ra, nơi gọi tự báo.
         * Gắn `_zipDurationMs` (thuộc tính JS tự đặt) lên Blob — promptDownloadReady() (core/id3-export.js) hiện "thời gian xử
         * lý".
         * @param {Array<{filename:string, blob:Blob}>} entries
         * @param {(done:number,total:number,percent:number|null) => void} [onProgress]
         * @returns {Promise<Blob>}
         */
        async function _compressZipEntries(entries, onProgress) {
            if (!isStreamingZipAvailable()) { // core/streaming-zip.js
                throw new Error(t('common.storage.zipNotSupported'));
            }
            const startedAt = Date.now();
            console.log(`[storage-manager] Bắt đầu nén zip (${entries.length} file) lúc ${new Date(startedAt).toLocaleTimeString()}.`);
            const blob = await buildZipStreamingToOpfs(entries, onProgress); // core/streaming-zip.js — lỗi ném thẳng ra ngoài
            const durationMs = Date.now() - startedAt;
            console.log(`[storage-manager] Nén zip xong lúc ${new Date().toLocaleTimeString()} — mất ${(durationMs / 1000).toFixed(1)}s.`);
            blob._zipDurationMs = durationMs;
            return blob;
        }

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
         * Quét toàn bộ thư viện Song tìm record lỗi — trả kết quả thuần.
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

        /** Pure — tách kết quả quét lỗi theo loại media (`mediaType` gắn sẵn lúc quét). @returns {{song: Array, video: Array, photo: Array}} */
        function groupBrokenResultsByType(scanResults) {
            return {
                song: scanResults.filter((r) => r.mediaType === 'song'),
                video: scanResults.filter((r) => r.mediaType === 'video'),
                photo: scanResults.filter((r) => r.mediaType === 'photo'),
            };
        }

        /** Pure — key media hỏng sẽ bị xoá (bỏ `skipKey` = media đang phát), cùng quy tắc deleteCorruptedMediaRecords(). */
        function pickDeletableBrokenKeys(scanResults, skipKey) {
            return scanResults.map((r) => r.key).filter((key) => key !== skipKey);
        }

        /**
         * Xoá các media lỗi (3 store/transaction mỗi key), bỏ qua `skipKey` (media đang phát — Photo truyền null).
         * @param {'song'|'video'|'photo'} type
         * @param {Array<{key:string}>} scanResults
         * @param {string|null} skipKey
         * @returns {Promise<string[]>} key đã xoá thật — Workflow tự loại khỏi Playlist.
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
         * Bản Video của isRecordCorrupted(): nạp blob vào `<video>` ẩn tạm, 'loadedmetadata' vs 'error' (timeout 8s cho Safari
         * iOS). Blob chính hỏng -> `fixable: false` (xoá cả record). Blob đọc được nhưng thiếu `thumbBlob`/`thumbFullBlob` ->
         * `fixable: true` (Workflow `executeRepairBroken()` tạo lại thumb), 2 lý do gộp 1 chuỗi.
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
                // Chỉ cần metadata; muted + playsInline để iOS không coi thẻ tạm là media có tiếng (không đụng audio session).
                tempVideo.preload = 'metadata';
                tempVideo.muted = true;
                tempVideo.playsInline = true;
                let released = false;
                const onMeta = () => {
                    safetyTimeout.kill(); cleanup();
                    // Blob chính đọc được: thiếu thumb vẫn tính "lỗi cần sửa".
                    const missingReasons = [];
                    if (!record.thumbBlob) missingReasons.push(t('common.storage.scanReasonMissingThumbCover'));
                    if (!record.thumbFullBlob) missingReasons.push(t('common.storage.scanReasonMissingThumbFull'));
                    if (missingReasons.length > 0) { safeResolve({ corrupted: true, fixable: true, reason: missingReasons.join(', ') }); return; }
                    safeResolve({ corrupted: false });
                };
                const onError = () => { safetyTimeout.kill(); cleanup(); safeResolve({ corrupted: true, fixable: false, reason: t('common.storage.scanReasonNoDecode') }); };
                // Giải phóng hẳn thẻ <video> tạm (không để N player mồ côi): pause -> bỏ src -> load() -> revoke. Cờ `released`
                // chặn chạy 2 lần (load() rỗng có thể bắn lại 'error').
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
         * Bản Video của scanAllSongsForCorruption(), kèm `fixable` cho Workflow rẽ xoá/sửa. Item đã "Giữ lại" lúc phát lỗi
         * (confirmedBrokenKeys) luôn `fixable: false`.
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
                // filename/reason (có thể chứa mime đọc từ file) không đáng tin -> escapeHtml().
                listEl.innerHTML = results.map(r => `<div class="truncate"><span class="text-amber-400">●</span> ${escapeHtml(r.filename)} — ${escapeHtml(r.reason)}</div>`).join('');
                deleteBtnEl.classList.remove('hidden');
            }
        }

        // ===================== Photo =====================

        /** Bản Photo của `isVideoRecordCorrupted()` — thử decode ảnh qua `Image()` ẩn tạm. */
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
                // Bỏ src để nhả bitmap đã decode ngay (quét cả thư viện ảnh full-res); gỡ listener trước (bỏ src có thể bắn 'error').
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

        /** Bản Photo của `scanAllVideosForCorruption()`. */
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

