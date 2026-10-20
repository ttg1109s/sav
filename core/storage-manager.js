/**
 * core/storage-manager.js — Quản lý lưu trữ (panel Storage, 3 domain Song/Video/Photo): vẽ thanh dung lượng + đếm-lên,
 * tính phần "Khác"/"còn trống", chọn nguồn/hành động, chia nhóm + đặt tên zip, phán định file lỗi từ kết quả thử giải mã
 * (Workflow thử), xoá file lỗi, vẽ kết quả quét. Không đọc DB/appState, không shield/modal/timer/sự kiện — Workflow
 * (event/workflow/file-manager-storage.js, event/workflow/zip-download.js) đọc dữ liệu, thử giải mã, gọi và bọc; phần tử
 * DOM nhận qua tham số.
 *
 * NẠP SAU: service/db.js (isQuickValidMime, deleteMediaRecord), lang/lang.js (t/tFormat).
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
            // `dataset.bytes` (số byte thật) trên từng đoạn — bấm vào đoạn thì Listener gửi kèm để hiện (showSegmentBytes()).
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

        /** Tổng byte 3 loại media. @returns {number} */
        function sumStorageMediaBytes(songStats, videoStats, photoStats) {
            return songStats.totalBytes + videoStats.totalBytes + photoStats.totalBytes;
        }

        /** "còn trống / tối đa" để định dạng — không có estimate thì 0 (dòng đó đang ẩn).
         * @param {{freeBytes: number, quota: number}|null} originBreakdown @returns {{freeBytes: number, quota: number}} */
        function pickStorageFreeFigures(originBreakdown) {
            return originBreakdown ? { freeBytes: originBreakdown.freeBytes, quota: originBreakdown.quota } : { freeBytes: 0, quota: 0 };
        }

        /**
         * Các con số đếm-lên của panel: tổng dung lượng, số Song/Video/Photo, "còn trống" (chỉ khi có estimate). `kind` chọn
         * cách định dạng ở Workflow ('bytes' | 'count' | 'free'). Phần tử thiếu (panel đóng) bị bỏ.
         * @returns {Array<{el: HTMLElement, finalValue: number, kind: string}>}
         */
        function buildStorageCountupTargets(els, songStats, videoStats, photoStats, originBreakdown) {
            return [
                { el: els.totalBytesEl, finalValue: songStats.totalBytes + videoStats.totalBytes + photoStats.totalBytes, kind: 'bytes' },
                { el: els.countSongsEl, finalValue: songStats.totalSongs, kind: 'count' },
                { el: els.countVideosEl, finalValue: videoStats.totalVideos, kind: 'count' },
                { el: els.countPhotosEl, finalValue: photoStats.totalImages, kind: 'count' },
                { el: originBreakdown ? els.freeBytesEl : null, finalValue: originBreakdown ? originBreakdown.freeBytes : 0, kind: 'free' },
            ].filter((target) => target.el);
        }

        /** Ghi 1 khung đếm-lên. @param {HTMLElement[]} els @param {string[]} texts - thẳng hàng `els` */
        function setStorageCountupTexts(els, texts) {
            els.forEach((el, i) => { el.textContent = texts[i]; });
        }

        // ===================== Chọn mục xoá =====================

        /** Thứ tự + nhãn 3 nguồn. */
        const STORAGE_SOURCE_TYPES = ['song', 'video', 'photo'];
        const STORAGE_SOURCE_LABEL_KEY = { song: 'storageDrawer.legendSongs', video: 'storageDrawer.legendVideos', photo: 'storageDrawer.legendPhotos' };

        /** Nguồn đang bật, theo thứ tự cố định. @param {{song:boolean, video:boolean, photo:boolean}} sources @returns {string[]} */
        function pickEnabledStorageSources(sources) {
            return STORAGE_SOURCE_TYPES.filter((type) => sources[type]);
        }

        /** Nhãn các nguồn đang bật (vd "Songs, Photos"); không nguồn nào -> ''. */
        function buildStorageSourceLabel(sources) {
            return STORAGE_SOURCE_TYPES.filter((type) => sources[type]).map((type) => t(STORAGE_SOURCE_LABEL_KEY[type])).join(', ');
        }

        /** Nút Thực hiện bấm được khi có ít nhất 1 nguồn VÀ 1 hành động. @returns {boolean} */
        function canRunStorageAction(sources, downloadEnabled, deleteEnabled) {
            return (sources.song || sources.video || sources.photo) && (downloadEnabled || deleteEnabled);
        }

        /**
         * Đồng bộ 3 toggle nguồn + 2 toggle hành động + trạng thái nút Thực hiện (phần tử thiếu -> bỏ qua).
         * @param {{sourceSongEl, sourceVideoEl, sourcePhotoEl, downloadEl, deleteEl, executeBtnEl}} els
         */
        function syncStorageActionUI(els, sources, downloadEnabled, deleteEnabled, canExecute) {
            const checks = [
                [els.sourceSongEl, sources.song], [els.sourceVideoEl, sources.video], [els.sourcePhotoEl, sources.photo],
                [els.downloadEl, downloadEnabled], [els.deleteEl, deleteEnabled],
            ];
            checks.forEach(([el, checked]) => { if (el) el.checked = checked; });
            if (els.executeBtnEl) els.executeBtnEl.disabled = !canExecute;
        }

        /** Câu hỏi xác nhận + nhãn nút theo tổ hợp 2 hành động. @returns {{bodyKey: string, btnKey: string}} */
        function resolveStorageActionConfirmKeys(downloadEnabled, deleteEnabled) {
            const bodyKey = downloadEnabled && deleteEnabled ? 'fileManager.song.storageAction.confirmDownloadAndDelete'
                : downloadEnabled ? 'fileManager.song.storageAction.confirmDownloadOnly'
                : 'fileManager.song.storageAction.confirmDeleteOnly';
            const btnKey = deleteEnabled ? 'fileManager.song.storageAction.confirmBtnDelete' : 'fileManager.song.storageAction.confirmBtnDownload';
            return { bodyKey, btnKey };
        }

        /** Chỉ xoá dữ liệu khi được bật VÀ bước tải (nếu có) thành công thật — mọi trạng thái khác giữ dữ liệu.
         * @param {boolean} deleteEnabled @param {string} downloadStatus @returns {boolean} */
        function shouldClearStorageSource(deleteEnabled, downloadStatus) {
            return deleteEnabled && downloadStatus === 'ok';
        }

        /**
         * Loại báo cáo tổng kết sau khi chạy: 'zipError' (có nguồn lỗi zip -> đã bỏ xoá nguồn đó) | 'notAllDownloaded' (tải +
         * xoá nhưng có nguồn chưa tải đủ -> không xoá) | 'downloadAndDelete' | 'downloadOnly' | 'deleteOnly'.
         * @param {Array<{status: string, message?: string}>} results
         * @returns {{kind: string, zipErrorMessage: string}}
         */
        function resolveStorageActionReport(downloadEnabled, deleteEnabled, results) {
            const zipError = results.find((r) => r && r.status === 'zipError');
            const notAllDownloaded = results.some((r) => r && r.status === 'cancelled');
            const kind = downloadEnabled && zipError ? 'zipError'
                : downloadEnabled && deleteEnabled && notAllDownloaded ? 'notAllDownloaded'
                : downloadEnabled && deleteEnabled ? 'downloadAndDelete'
                : downloadEnabled ? 'downloadOnly'
                : 'deleteOnly';
            return { kind, zipErrorMessage: zipError ? zipError.message : '' };
        }

        // ===================== Giải phóng bộ nhớ — zip =====================

        /** Tên file .zip kèm ngày (YYYY-MM-DD). @param {string} prefix @param {Date} now @returns {string} */
        function buildDatedZipFileName(prefix, now) {
            return `${prefix}-${now.toISOString().slice(0, 10)}.zip`;
        }

        /** Thông báo lỗi đóng gói. @returns {string} */
        function describeZipError(err) {
            return err && err.message ? err.message : String(err);
        }

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
         * (file nạp trước khi có giới hạn upload) đứng riêng 1 nhóm. Workflow nén từng nhóm (workflowZipDownload._compressEntries()).
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

        /** Tên phần thứ `partNumber`/`partCount`: hậu tố "-part{i}of{n}" trước đuôi (không có đuôi -> '.zip'). @returns {string} */
        function buildZipPartFilename(zipFileName, partNumber, partCount) {
            const dot = zipFileName.lastIndexOf('.');
            const stem = dot > 0 ? zipFileName.slice(0, dot) : zipFileName;
            const ext = dot > 0 ? zipFileName.slice(dot) : '.zip';
            return `${stem}-part${partNumber}of${partCount}${ext}`;
        }

        /** Gắn thời gian nén (thuộc tính JS tự đặt) lên File zip — modal tải xuống hiện "thời gian xử lý". */
        function markZipDuration(file, startedAtMs, finishedAtMs) {
            file._zipDurationMs = finishedAtMs - startedAtMs;
        }

        /** Tổng dung lượng + tổng thời gian nén các phần. @returns {{totalBytes: number, totalDurationMs: number}} */
        function summarizeZipParts(parts) {
            return {
                totalBytes: parts.reduce((sum, part) => sum + part.blob.size, 0),
                totalDurationMs: parts.reduce((sum, part) => sum + (part.blob._zipDurationMs || 0), 0),
            };
        }

        /** @returns {string} */
        function formatZipDurationLog(startedAtMs, finishedAtMs) {
            return `[zip-download] Nén zip xong — mất ${((finishedAtMs - startedAtMs) / 1000).toFixed(1)}s.`;
        }

        /** @returns {string} */
        function formatZipPartsDoneLog(partCount, maxBytes, zipFileName) {
            return `[zip-download] Nén xong ${partCount} phần (tối đa ${(maxBytes / (1024 * 1024)).toFixed(0)}MB/phần) cho "${zipFileName}".`;
        }

        // ===================== Quét & dọn file lỗi =====================
        // Workflow đọc record + thử giải mã (audio duration / <video> metadata / img.decode); các hàm dưới chỉ phán định.

        /** Item đã được "Giữ lại" lúc phát lỗi (confirmedBrokenKeys) — luôn báo, không cần thử lại. */
        function buildKeptBrokenVerdict() {
            return { corrupted: true, fixable: false, reason: t('common.storage.scanReasonKeptFromError') };
        }

        /** Record thiếu blob -> lỗi; còn blob -> null (cần thử giải mã). */
        function precheckMediaRecordBlob(record) {
            return record && record.blob ? null : { corrupted: true, fixable: false, reason: t('common.storage.scanReasonBrokenBlob') };
        }

        /** Song: thêm kiểm tra mime trước khi giải mã. @returns {object|null} null = cần đọc duration */
        function precheckSongRecord(record) {
            if (!record || !record.blob) return { corrupted: true, fixable: false, reason: t('common.storage.scanReasonBrokenBlob') };
            if (isQuickValidMime(record.blob.type)) return null; // service/db.js
            return { corrupted: true, fixable: false, reason: tFormat('common.storage.scanReasonBadMime', { mime: record.blob.type || t('common.storage.scanReasonBadMimeEmpty') }) };
        }

        /** Song: đọc được duration > 0 = lành. @param {number} duration */
        function judgeSongDuration(duration) {
            return duration > 0 ? { corrupted: false } : { corrupted: true, fixable: false, reason: t('common.storage.scanReasonNoDecode') };
        }

        const VIDEO_PROBE_FAIL_REASON_KEY = { brokenBlob: 'common.storage.scanReasonBrokenBlob', undecodable: 'common.storage.scanReasonNoDecode' };

        /**
         * Video: blob chính không nạp được metadata -> lỗi không sửa được (xoá cả record). Nạp được nhưng thiếu
         * thumbBlob/thumbFullBlob -> `fixable: true` (Workflow tạo lại thumb, executeRepairBroken()), 2 lý do gộp 1 chuỗi.
         * @param {object} record @param {'loaded'|'undecodable'|'brokenBlob'} probe
         */
        function judgeVideoProbe(record, probe) {
            if (probe !== 'loaded') return { corrupted: true, fixable: false, reason: t(VIDEO_PROBE_FAIL_REASON_KEY[probe]) };
            const missingReasons = [
                record.thumbBlob ? null : t('common.storage.scanReasonMissingThumbCover'),
                record.thumbFullBlob ? null : t('common.storage.scanReasonMissingThumbFull'),
            ].filter(Boolean);
            return missingReasons.length > 0 ? { corrupted: true, fixable: true, reason: missingReasons.join(', ') } : { corrupted: false };
        }

        /** Photo: giải mã được = lành. @param {boolean} decoded */
        function judgeImageDecode(decoded) {
            return decoded ? { corrupted: false } : { corrupted: true, fixable: false, reason: t('common.storage.scanReasonNoDecode') };
        }

        /** Gom 1 item vào kết quả quét nếu lỗi. @param {Array} results - sửa tại chỗ */
        function appendScanResult(results, key, record, verdict, mediaType) {
            if (!verdict.corrupted) return;
            results.push({ key, filename: record ? record.filename : key, reason: verdict.reason, fixable: !!verdict.fixable, mediaType });
        }

        /** Kết quả "file lỗi" ở Storage: chỉ phần không sửa được (thumb thiếu/đen thuộc màn Troubleshooting). */
        function pickUnfixableScanResults(results) {
            return results.filter((r) => !r.fixable);
        }

        /** Kết quả "thumb video" ở Troubleshooting: chỉ phần sửa được. */
        function pickFixableScanResults(results) {
            return results.filter((r) => r.fixable);
        }

        /** Tập key đã có trong kết quả quét. @returns {Set<string>} */
        function collectScanResultKeys(results) {
            return new Set(results.map((r) => r.key));
        }

        /** Video cần đo pixel thumb full-res: có blob + thumbFullBlob và chưa được xác nhận đen thật (`thumbFullBlack`). */
        function needsVideoThumbProbe(record) {
            return !!(record && record.blob && record.thumbFullBlob && record.thumbFullBlack !== true);
        }

        /** Kết quả đo khung (workflowVideoThumbExtract.probeFrame()) -> 'ok' | 'black' | 'undecodable'. */
        function classifyThumbProbe(probe) {
            if (!probe.drawn) return 'undecodable';
            return probe.isBlack ? 'black' : 'ok';
        }

        const THUMB_VERDICT_REASON_KEY = { black: 'common.storage.scanReasonBlackThumbFull', undecodable: 'common.storage.scanReasonUndecodableThumbFull' };

        /** Thumb full-res đen/không giải mã được -> item `fixable: true`; 'ok' -> null. */
        function buildThumbScanItem(key, record, verdict) {
            const reasonKey = THUMB_VERDICT_REASON_KEY[verdict];
            if (!reasonKey) return null;
            return { key, filename: record.filename || key, reason: t(reasonKey), fixable: true, mediaType: 'video' };
        }

        /** Tách kết quả quét theo loại media. @returns {{song: Array, video: Array, photo: Array}} */
        function groupBrokenResultsByType(scanResults) {
            return {
                song: scanResults.filter((r) => r.mediaType === 'song'),
                video: scanResults.filter((r) => r.mediaType === 'video'),
                photo: scanResults.filter((r) => r.mediaType === 'photo'),
            };
        }

        /** Key media hỏng sẽ bị xoá (bỏ `skipKey` = media đang phát), cùng quy tắc deleteCorruptedMediaRecords(). */
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

        /** Modal xác nhận sửa/xoá theo lô: chỉ có phần không sửa được -> xoá; chỉ phần sửa được -> sửa; cả 2 -> sửa + xoá
         * (vẫn màu destructive vì có xoá thật). @returns {{bodyText: string, titleKey: string, btnKey: string, destructive: boolean}} */
        function resolveFixBrokenModal(scanResults) {
            const fixableCount = scanResults.filter((r) => r.fixable).length;
            const brokenCount = scanResults.length - fixableCount;
            if (fixableCount === 0) {
                return { bodyText: tFormat('common.storage.deleteBrokenConfirm', { n: brokenCount }), titleKey: 'common.storage.deleteBrokenTitle', btnKey: 'common.storage.deleteBrokenConfirmBtn', destructive: true };
            }
            if (brokenCount === 0) {
                return { bodyText: tFormat('common.storage.fixBrokenConfirmOnlyFixable', { n: fixableCount }), titleKey: 'common.storage.fixBrokenTitle', btnKey: 'common.storage.fixBrokenConfirmBtn', destructive: false };
            }
            return { bodyText: tFormat('common.storage.fixBrokenConfirmBoth', { broken: brokenCount, fixable: fixableCount }), titleKey: 'common.storage.fixBrokenTitle', btnKey: 'common.storage.fixBrokenConfirmBtn', destructive: true };
        }

        /** Câu báo sau khi sửa thumb. @returns {string} */
        function formatRepairReport(fixedCount, failedCount) {
            return failedCount > 0
                ? tFormat('common.storage.repairSomeFailed', { fixed: fixedCount, failed: failedCount })
                : tFormat('common.storage.repairDone', { n: fixedCount });
        }

        /** Dropdown "phạm vi quét" -> 3 nguồn. @param {'all'|'song'|'video'|'photo'} scope */
        function scanScopeToSources(scope) {
            const all = scope === 'all';
            return { song: all || scope === 'song', video: all || scope === 'video', photo: all || scope === 'photo' };
        }

        /** `<select>` phạm vi quét trong modal vừa mở (giữ ref: modal đóng là gỡ khỏi DOM nhưng `.value` vẫn đọc được). */
        function findScanScopeSelect() {
            return document.getElementById('modal-scan-scope');
        }

        /** @param {HTMLSelectElement|null} selectEl @returns {string} */
        function readScanScopeValue(selectEl) {
            return selectEl ? selectEl.value : 'all';
        }

        /** @param {HTMLElement} resultEl @param {HTMLElement} listEl */
        function resetScanResultUI(resultEl, listEl) {
            if (!resultEl) return; // guard: panel đang đóng
            resultEl.classList.add('hidden');
            listEl.innerHTML = '';
        }

        /** Câu tóm tắt kết quả quét. @returns {string} */
        function formatScanResultSummary(count) {
            return count === 0 ? t('common.storage.scanNoneFound') : tFormat('common.storage.scanFoundCount', { n: count });
        }

        /**
         * Hiện khung kết quả quét. @param {{resultEl, summaryEl, listEl, actionBtnEl}} els
         * @param {string} summaryText @param {string} listHtml - components/file-manager-storage.js::renderStorageScanResultListHtml()
         * @param {boolean} hasResults - ẩn nút sửa/xoá khi không có gì
         */
        function showScanResultUI(els, summaryText, listHtml, hasResults) {
            if (!els.resultEl) return; // guard: panel đang đóng
            els.resultEl.classList.remove('hidden');
            els.summaryEl.textContent = summaryText;
            els.listEl.innerHTML = listHtml;
            els.actionBtnEl.classList.toggle('hidden', !hasResults);
        }
