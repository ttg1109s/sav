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
 */

        /** [TỰ SỬA 27/07/2026, phản hồi Giang — tự audit lại phát hiện SAI] Trước đây hàm này tự
         * gọi `computeStats()` (1 hàm core KHÁC, `core/about-stats.js`) ngay bên trong — core gọi
         * core, vi phạm Rule 3 (dù không hề nhận ra lúc viết, vì đây là hàm "render" — vẫn PHẢI
         * tuân đủ Rule 1-4, xem core-function-conventions.md Rule 5). Sửa: nhận `stats` (kết quả
         * `computeStats()` ĐÃ TÍNH SẴN) qua tham số — nơi gọi (Workflow, event/workflow/
         * file-manager-song.js) tự gọi `computeStats()` TRƯỚC rồi truyền vào.
         * @param {{totalSongs: number, totalBytes: number}} stats
         * @param {HTMLElement} totalSongsEl @param {HTMLElement} totalBytesEl
         */
        function renderStorageStats(stats, totalSongsEl, totalBytesEl) {
            if (!totalSongsEl) return; // guard: panel Song đang đóng
            totalSongsEl.textContent = `${stats.totalSongs}`;
            totalBytesEl.textContent = formatBytes(stats.totalBytes);
        }

        /**
         * MỚI (ver12 "Song/Video Unification", Batch 5, mục 6a) — mirror renderStorageStats() ngay
         * trên, bản của Video (mediaScope riêng — cùng quy ước "mỗi domain 1 hàm", KHÔNG gộp chung
         * 1 hàm nhận thêm tham số rẽ nhánh theo loại, đúng Rule 1). Nhận `stats` (kết quả
         * `computeVideoStats()`, core/file-manager/video.js) qua tham số — Rule 2/3.
         * @param {{totalVideos: number, totalBytes: number}} stats
         * @param {HTMLElement} totalVideosEl @param {HTMLElement} totalVideoBytesEl
         */
        function renderVideoStorageStats(stats, totalVideosEl, totalVideoBytesEl) {
            if (!totalVideosEl) return; // guard: panel đang đóng
            totalVideosEl.textContent = `${stats.totalVideos}`;
            totalVideoBytesEl.textContent = formatBytes(stats.totalBytes);
        }

        // ===================== Giải phóng bộ nhớ =====================

        /**
         * Đóng gói toàn bộ blob mp3 GỐC (không gắn tag mới, giữ nguyên file thật) thành 1 file .zip,
         * tên file giữ nguyên filename gốc — trùng tên tự thêm số đếm để JSZip không ghi đè lẫn nhau.
         */
        async function buildAllSongsZipBlob(onProgress) {
            if (typeof JSZip === 'undefined') {
                throw new Error(t('common.storage.zipLibMissing'));
            }
            const zip = new JSZip();
            const keys = await getAllSongKeys();
            const usedNames = new Map(); // filename -> số lần đã dùng, để chống trùng tên trong zip
            let done = 0;
            for (const key of keys) {
                const record = await getSongRecord(key);
                if (!record || !record.blob) { done++; continue; }
                let name = record.filename || `${key}.mp3`;
                if (usedNames.has(name)) {
                    const count = usedNames.get(name) + 1; usedNames.set(name, count);
                    const dot = name.lastIndexOf('.');
                    name = dot > -1 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
                } else { usedNames.set(name, 0); }
                zip.file(name, record.blob);
                done++;
                if (onProgress) onProgress(done, keys.length);
            }
            return zip.generateAsync({ type: 'blob' }, (meta) => {
                if (onProgress) onProgress(keys.length, keys.length, meta.percent);
            });
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
         *     (xem initPlaylistFromDB() ở loader.js, kiểm tra TRƯỚC khi load playlist) và tự GỌI
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
                if (typeof recomputeRenderOrder === 'function') recomputeRenderOrder();
                if (appState.get('currentKey')) { audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null); }
                if (typeof killAllAutoSwitchVisualTasks === 'function') killAllAutoSwitchVisualTasks();
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                updateShuffleArray();
                renderPlaylistFull();
                saveConfig();
                if (typeof forceBackToPlaylistUI === 'function') forceBackToPlaylistUI();
                if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa

                await delMeta('clearingInProgress'); // chỉ xoá cờ SAU KHI mọi bước trên đã xong hoàn toàn
            } finally {
                appState.set('isDestructiveTaskInProgress', false);
            }
        }

        /**
         * NGHIỆP VỤ THUẦN: "Tải tất cả rồi xoá" — gộp build zip + download + clearAllStoredData
         * thành 1 hàm core, KHÔNG biết shield/modal là gì. Trả kết quả qua object có `status` rõ
         * ràng, KHÔNG throw cho lỗi build zip (đã thống nhất: core luôn resolve, không reject cho
         * các lỗi nghiệp vụ đã biết trước).
         *
         * @param {(percent:number) => void} [onZipProgress]
         * @returns {Promise<{status:'ok'} | {status:'noSongs'} | {status:'zipError', message:string}>}
         */
        async function downloadAllSongsThenClear(onZipProgress) {
            const keys = await getAllSongKeys();
            if (keys.length === 0) return { status: 'noSongs' };

            let zipBlob;
            try {
                zipBlob = await buildAllSongsZipBlob((done, total, percent) => {
                    const pct = percent != null ? Math.round(percent) : Math.round((done / total) * 100);
                    if (onZipProgress) onZipProgress(pct);
                });
            } catch (err) {
                console.error('[storage-manager] Lỗi đóng gói zip:', err);
                return { status: 'zipError', message: err && err.message ? err.message : String(err) };
            }

            const dateStr = new Date().toISOString().slice(0, 10);
            triggerDownload(zipBlob, `nhac-da-luu-${dateStr}.zip`);

            await clearAllStoredData();
            // (renderStorageStats() nội bộ ĐÃ XOÁ — Batch D5: thừa, workflow luôn gọi lại
            // this.refreshSongTab() ngay sau, tự vẽ lại stats với đúng phần tử panel đang mở.)
            return { status: 'ok' };
        }

        /**
         * NGHIỆP VỤ THUẦN: "Xoá tất cả, không tải" — chỉ gọi clearAllStoredData().
         * @returns {Promise<void>}
         */
        async function clearAllSongsNoDownload() {
            await clearAllStoredData();
            // (renderStorageStats() nội bộ ĐÃ XOÁ — Batch D5: cùng lý do ở downloadAllSongsThenClear().)
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
