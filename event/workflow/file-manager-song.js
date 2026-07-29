/**
 * event/workflow/file-manager-song.js — "THẰNG THỰC THI CUỐI" của router "fileManagerSong". Panel
 * này giờ tên hiển thị "Song & Video" (ver12 "Song/Video Unification") — CHỈ còn thống kê dung
 * lượng (Song + Video, Batch 5 mục 6a) + quản lý dung lượng + dọn file lỗi (Song, GIỮ NGUYÊN 100%
 * theo nguyên tắc đầu plan "không đụng code Song hiện có"). Quản lý FOLDER (tạo/đổi tên/xoá/xem nội
 * dung/2 toggle Scope-Exclude) ĐÃ CHUYỂN HẲN sang event/workflow/file-manager-folder-browser.js
 * (Generic Drawer List↔Read, Batch 5 mục 6e) — panel này giờ CHỈ còn 1 nút "Duyệt thư mục" mở
 * Drawer đó (xem components/file-manager.js, event/listener/file-manager-song.js delegate).
 *
 * QUY TẮC: giống hệt event/workflow/playlist.js — chuỗi gọi hàm core thuần, withLoadingShield()/
 * alertModal()/modalChoice() CHỈ đặt ở tầng này.
 *
 * === Batch D5 (Settings restructure, 06/07/2026) ===
 * Song (nay "Song & Video") push/pop động (core/settings-panel-stack.js) — 1 CẤP duy nhất (Folder
 * Detail — cấp 2 cũ — không còn tồn tại, xem trên). `renderStorageStats`/`renderVideoStorageStats`
 * (MỚI Batch 5)/`resetScanResultUI`/`renderScanResultUI` (core) nhận phần tử qua tham số — mọi
 * method dưới đây tự `querySelector` bên trong panel rồi truyền vào.
 */
let fileManagerSongPanelEl = null; // panel Song & Video đang mở — null nếu đang đóng

const workflowFileManagerSong = {

    /** Ứng với 'fileManagerSong.openPanel.click'. Push panel Song & Video. */
    async openPanel() {
        fileManagerSongPanelEl = pushSettingsPanel({ title: t('fileManager.song.title'), bodyHtml: renderFileManagerSongPanelBody() });
        await this.refreshSongTab();
        // MỚI (Batch 5, mục 6b) — đồng bộ UI 3 field cấu hình Giải phóng bộ nhớ về mặc định an
        // toàn (Router vừa reset closure 3 field này ở case 'openPanel.click', xem event/router/
        // file-manager-song.js).
        this.updateStorageActionUI('song', false, false);
    },

    /** Vẽ lại thống kê dung lượng (Song + Video) + reset UI quét lỗi — gọi lúc mở panel. SỬA
     * (Batch 5, "Song/Video Unification" mục 6e) — phần vẽ danh sách folder (phân trang, tạo mới)
     * ĐÃ XOÁ khỏi hàm này, chuyển hẳn sang event/workflow/file-manager-folder-browser.js. */
    async refreshSongTab() {
        if (!fileManagerSongPanelEl) return; // panel đã đóng — an toàn bỏ qua

        // MỚI (Batch 5, mục 6a) — Workflow tự gọi computeStats()/computeVideoStats() (2 core khác
        // nhau, chạy song song) RỒI truyền kết quả vào render — renderStorageStats() giờ THUẦN
        // nhận tham số, không tự gọi core nào (Rule 2/3, tự sửa cùng lúc phát hiện core-gọi-core cũ
        // ở renderStorageStats()).
        const [songStats, videoStats] = await Promise.all([computeStats(), computeVideoStats()]); // core/about-stats.js, core/file-manager/video.js
        // SỬA (phản hồi Giang, mục 1 — "UI dung lượng như Settings mobile OS") —
        // renderStorageStats()/renderVideoStorageStats() cũ ĐÃ GỘP làm 1 (core/storage-manager.js),
        // nhận CẢ 2 stats CÙNG LÚC (cần cả 2 để tính % thanh chia đoạn) + object els gom hết phần
        // tử DOM liên quan (thay vì truyền rời từng tham số như trước).
        renderStorageStats( // core có sẵn (core/storage-manager.js)
            songStats, videoStats,
            {
                totalBytesEl: fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes'),
                barSongsEl: fileManagerSongPanelEl.querySelector('#stat-storage-bar-songs'),
                barVideosEl: fileManagerSongPanelEl.querySelector('#stat-storage-bar-videos'),
                songBytesEl: fileManagerSongPanelEl.querySelector('#stat-storage-song-bytes'),
                videoBytesEl: fileManagerSongPanelEl.querySelector('#stat-storage-video-bytes'),
                totalSongsEl: fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
                totalVideosEl: fileManagerSongPanelEl.querySelector('#stat-storage-total-videos'),
            }
        );
        resetScanResultUI( // core có sẵn (core/storage-manager.js)
            fileManagerSongPanelEl.querySelector('#storage-scan-result'),
            fileManagerSongPanelEl.querySelector('#storage-scan-list')
        );
    },

    // ===================== Quản lý dung lượng (DỜI từ workflow/settings-misc.js) =====================

    /** Ứng với msg.type = 'fileManagerSong.deleteBroken.click'.
     * @param {{scanResults: Array, onConfirmSend: function}} payload
     */
    askDeleteBroken(payload) {
        const { scanResults, onConfirmSend } = payload;
        modalChoice(
            tFormat('common.storage.deleteBrokenConfirm', { n: scanResults.length }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.storage.deleteBrokenConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.deleteBrokenTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerSong.deleteBroken.confirm'.
     * SỬA (phản hồi Giang 28/07/2026) — `scanResults` giờ CÓ THỂ chứa CẢ Song lẫn Video (scope
     * 'both') — tách theo `mediaType` (gắn sẵn ở executeScanBroken()), xoá ĐÚNG store cho từng
     * phần. Phần Song GIỮ NGUYÊN `deleteCorruptedSongs()` cũ (đã tự `removeKeyFromDisplay()` bên
     * trong, không đụng). Phần Video dùng `deleteCorruptedVideos()` (MỚI, core/storage-manager.js)
     * — hàm đó KHÔNG tự gọi `removeKeyFromDisplay()` (tránh core gọi core khác file, Rule 3) nên
     * Workflow (đây) tự gọi cho TỪNG key trả về.
     * @param {{scanResults: Array, currentKey: string|null}} payload
     */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;
        const songResults = scanResults.filter((r) => r.mediaType !== 'video');
        const videoResults = scanResults.filter((r) => r.mediaType === 'video');

        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            if (songResults.length > 0) {
                await deleteCorruptedSongs(songResults, currentKey); // core/storage-manager.js — tự removeKeyFromDisplay() bên trong (GIỮ NGUYÊN, không đụng)
            }
            if (videoResults.length > 0) {
                const deletedVideoKeys = await deleteCorruptedVideos(videoResults, currentKey); // core/storage-manager.js
                deletedVideoKeys.forEach((key) => removeKeyFromDisplay(key)); // core/playlist/actions.js — Workflow gọi core, không phải core gọi core
            }
            if (fileManagerSongPanelEl) {
                resetScanResultUI(
                    fileManagerSongPanelEl.querySelector('#storage-scan-result'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-list')
                );
                const [songStats, videoStats] = await Promise.all([computeStats(), computeVideoStats()]); // core/about-stats.js, core/file-manager/video.js
                renderStorageStats(
                    songStats, videoStats,
                    {
                        totalBytesEl: fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes'),
                        barSongsEl: fileManagerSongPanelEl.querySelector('#stat-storage-bar-songs'),
                        barVideosEl: fileManagerSongPanelEl.querySelector('#stat-storage-bar-videos'),
                        songBytesEl: fileManagerSongPanelEl.querySelector('#stat-storage-song-bytes'),
                        videoBytesEl: fileManagerSongPanelEl.querySelector('#stat-storage-video-bytes'),
                        totalSongsEl: fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
                        totalVideosEl: fileManagerSongPanelEl.querySelector('#stat-storage-total-videos'),
                    }
                );
            }
        });

        await alertModal(t('common.storage.deleteBrokenDone'));
    },

    // ===================== Giải phóng bộ nhớ — 3 chiều độc lập (Batch 5, mục 6b) =====================
    // THAY 2 tính năng tách rời cũ (askDownloadThenClear/executeDownloadThenClear +
    // askClearNoDownload/executeClearNoDownload) bằng 3 field CẤU HÌNH độc lập, sống ở Router (đóng
    // closure, cùng khuôn videoQuickDeleteMode): downloadEnabled/deleteEnabled (boolean) +
    // mediaScope ('song'|'video'|'both'). Router dùng VirtualMachineState.run() đọc mediaScope, gọi
    // ĐÚNG 1 trong 3 method Song/Video/Both dưới đây (quyết định "loại nào" xảy ra ở Router, đúng
    // yêu cầu mục 6b) — mỗi method nhận thẳng downloadEnabled/deleteEnabled làm THAM SỐ, xử lý tuần
    // tự bằng if bình thường (Workflow không bị Rule 1 — download/delete chỉ là 2 BƯỚC tuần tự
    // trong CÙNG 1 tiến trình "thực hiện", không phải 2 tiến trình cần Router chọn riêng).

    /** DOM-patch thuần — đồng bộ select phạm vi + checked 2 toggle + disabled + nhãn nút Thực
     * hiện, gọi lại SAU MỖI lần đổi 1 trong 3 field (Router tự gọi).
     * SỬA (phản hồi Giang 28/07/2026, "dropdown dạng section option") — 3 nút pill cũ (Song/Video/
     * Cả hai) THAY bằng 1 `<select>` (`#setting-storage-scope`) — chỉ cần gán `.value`, không cần
     * toggle class qua `querySelectorAll('[data-storage-scope]')` như trước nữa. */
    updateStorageActionUI(mediaScope, downloadEnabled, deleteEnabled) {
        if (!fileManagerSongPanelEl) return; // guard
        const scopeSelect = fileManagerSongPanelEl.querySelector('#setting-storage-scope');
        if (scopeSelect) scopeSelect.value = mediaScope;

        const downloadToggle = fileManagerSongPanelEl.querySelector('#toggle-storage-download');
        if (downloadToggle) downloadToggle.checked = downloadEnabled;
        const deleteToggle = fileManagerSongPanelEl.querySelector('#toggle-storage-delete');
        if (deleteToggle) deleteToggle.checked = deleteEnabled;

        const executeBtn = fileManagerSongPanelEl.querySelector('#btn-storage-execute');
        if (executeBtn) {
            const enabled = downloadEnabled || deleteEnabled;
            executeBtn.disabled = !enabled;
            executeBtn.textContent = t('fileManager.song.storageAction.btnExecute');
        }
    },

    /** Ứng với 'fileManagerSong.storageExecute.click' — hỏi xác nhận trước, lời văn đổi theo đúng
     * tổ hợp downloadEnabled/deleteEnabled/mediaScope.
     * @param {{mediaScope: string, downloadEnabled: boolean, deleteEnabled: boolean, onConfirmSend: function}} payload
     */
    askExecuteStorageAction(payload) {
        const { mediaScope, downloadEnabled, deleteEnabled, onConfirmSend } = payload;
        if (!downloadEnabled && !deleteEnabled) return; // guard: nút Thực hiện lẽ ra đã disabled — phòng vệ thêm

        const scopeLabel = t(`fileManager.song.storageAction.scope.${mediaScope}`);
        const bodyKey = downloadEnabled && deleteEnabled ? 'fileManager.song.storageAction.confirmDownloadAndDelete'
            : downloadEnabled ? 'fileManager.song.storageAction.confirmDownloadOnly'
            : 'fileManager.song.storageAction.confirmDeleteOnly';
        modalChoice(
            tFormat(bodyKey, { scope: scopeLabel }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t(deleteEnabled ? 'fileManager.song.storageAction.confirmBtnDelete' : 'fileManager.song.storageAction.confirmBtnDownload'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('fileManager.song.storageAction.confirmTitle') }
        );
    },

    /** DÙNG CHUNG bởi cả 3 method Song/Video/Both — build zip (nếu có gì để đóng gói) rồi tải
     * xuống ngay. Nhận 2 hàm core qua THAM SỐ (Workflow, không bị Rule 2/3) để dùng lại được cho cả
     * 2 domain mà không lặp logic tiến trình.
     * @param {() => Promise<string[]>} getKeysFn - getAllSongKeys hoặc getAllVideoKeys (service/db.js)
     * @param {(onProgress: function) => Promise<Blob>} buildZipFn - buildAllSongsZipBlob/buildAllVideosZipBlob (core/storage-manager.js)
     * @param {string} zipNamePrefix - đã dịch sẵn qua t(), dùng làm tên file
     * @returns {Promise<{status: 'ok'|'noItems'|'zipError', message?: string}>}
     */
    async _downloadZipFor(getKeysFn, buildZipFn, zipNamePrefix) {
        const keys = await getKeysFn();
        if (keys.length === 0) return { status: 'noItems' }; // guard: không có gì để đóng gói — bỏ qua êm, không coi là lỗi

        let zipBlob;
        try {
            await withLoadingShield(t('common.storage.zippingStart'), async () => {
                zipBlob = await buildZipFn((done, total, percent) => {
                    const pct = percent != null ? Math.round(percent) : Math.round((done / total) * 100);
                    loadingText.textContent = tFormat('common.storage.zippingProgress', { percent: pct });
                });
            });
        } catch (err) {
            console.error('[file-manager-song] Lỗi đóng gói zip:', err);
            return { status: 'zipError', message: err && err.message ? err.message : String(err) };
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(zipBlob, `${zipNamePrefix}-${dateStr}.zip`); // core/id3-export.js
        return { status: 'ok' };
    },

    /** MỚI (Batch 5, mục 6b) — dọn RAM/UI sau khi xoá sạch Video (thoát Video Player mode nếu đang
     * bật + rỗng hoá playlistCache/playlistOrder nếu Playlist đang browse nguồn Video). Xem giải
     * thích đầy đủ ở core/storage-manager.js::clearAllVideosData() (vì sao KHÔNG mirror y hệt độ
     * phức tạp của clearAllStoredData() bản Song). */
    async _resetVideoRuntimeStateAfterClear() {
        if (appState.get('isVideoPlayerMode')) {
            await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js — Workflow gọi Workflow miền khác, tự do
        }
        if (appState.get('activeMediaSource') === 'video') {
            appState.set('playlistOrder', []);
            appState.mutate('playlistCache', (m) => m.clear());
            updateShuffleArray(); recomputeDisplayOrder(); recomputeRenderOrder(); renderPlaylistDiff(); updateEmptyState(); // core/playlist/*, có sẵn
        }
    },

    /** Hiện 1 alert TỔNG KẾT, DÙNG CHUNG bởi cả 3 method Song/Video/Both.
     * @param {'song'|'video'|'both'} mediaScope
     * @param {boolean} downloadEnabled @param {boolean} deleteEnabled
     * @param {{status: string, message?: string}} resultA - kết quả download domain đầu (Song, hoặc domain duy nhất)
     * @param {{status: string, message?: string}} [resultB] - kết quả download domain thứ 2 (Video, CHỈ có khi mediaScope='both')
     */
    _reportStorageActionResult(mediaScope, downloadEnabled, deleteEnabled, resultA, resultB) {
        const scopeLabel = t(`fileManager.song.storageAction.scope.${mediaScope}`);
        const zipError = [resultA, resultB].find((r) => r && r.status === 'zipError');
        if (downloadEnabled && zipError) {
            // Xoá đã bị BỎ QUA cho domain lỗi (xem executeStorageAction*), báo rõ để Giang biết vì
            // sao "Xoá khỏi thư viện" (nếu có bật) không chạy trọn vẹn.
            alertModal(tFormat('fileManager.song.storageAction.zipErrorSkippedDelete', { message: escapeHtml(zipError.message) }));
            return;
        }
        if (downloadEnabled && deleteEnabled) alertModal(tFormat('fileManager.song.storageAction.doneDownloadAndDelete', { scope: scopeLabel }));
        else if (downloadEnabled) alertModal(t('fileManager.song.storageAction.doneDownloadOnly'));
        else alertModal(tFormat('fileManager.song.storageAction.doneDeleteOnly', { scope: scopeLabel }));
    },

    /** Ứng với mediaScope='song' (VMState Router chọn). */
    async executeStorageActionSong(downloadEnabled, deleteEnabled) {
        const result = downloadEnabled
            ? await this._downloadZipFor(getAllSongKeys, buildAllSongsZipBlob, t('fileManager.song.storageAction.zipNameSong'))
            : { status: 'ok' };
        if (deleteEnabled && result.status !== 'zipError') {
            await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllStoredData(); }); // core/storage-manager.js (Song, GIỮ NGUYÊN 100%)
            await clearAllFolderSongData(); // core/file-manager/folder.js
            if (appState.get('activePlayListFolder')) await workflowPlaylistScope.persistScopeChoice(null);
        }
        await this.refreshSongTab();
        this._reportStorageActionResult('song', downloadEnabled, deleteEnabled, result);
    },

    /** Ứng với mediaScope='video' (VMState Router chọn). */
    async executeStorageActionVideo(downloadEnabled, deleteEnabled) {
        const result = downloadEnabled
            ? await this._downloadZipFor(getAllVideoKeys, buildAllVideosZipBlob, t('fileManager.song.storageAction.zipNameVideo'))
            : { status: 'ok' };
        if (deleteEnabled && result.status !== 'zipError') {
            await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllVideosData(); }); // core/storage-manager.js
            await this._resetVideoRuntimeStateAfterClear();
        }
        await this.refreshSongTab();
        this._reportStorageActionResult('video', downloadEnabled, deleteEnabled, result);
    },

    /** Ứng với mediaScope='both' (VMState Router chọn). */
    async executeStorageActionBoth(downloadEnabled, deleteEnabled) {
        let songResult = { status: 'ok' }, videoResult = { status: 'ok' };
        if (downloadEnabled) {
            songResult = await this._downloadZipFor(getAllSongKeys, buildAllSongsZipBlob, t('fileManager.song.storageAction.zipNameSong'));
            videoResult = await this._downloadZipFor(getAllVideoKeys, buildAllVideosZipBlob, t('fileManager.song.storageAction.zipNameVideo'));
        }
        if (deleteEnabled) {
            if (songResult.status !== 'zipError') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllStoredData(); });
                await clearAllFolderSongData();
                if (appState.get('activePlayListFolder')) await workflowPlaylistScope.persistScopeChoice(null);
            }
            if (videoResult.status !== 'zipError') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllVideosData(); });
                await this._resetVideoRuntimeStateAfterClear();
            }
        }
        await this.refreshSongTab();
        this._reportStorageActionResult('both', downloadEnabled, deleteEnabled, songResult, videoResult);
    },

    /** Ứng với msg.type = 'fileManagerSong.scanBroken.click'.
     * SỬA (phản hồi Giang 28/07/2026, "quét lỗi vẫn chưa theo scope") — đọc `payload.mediaScope`
     * ('song'|'video'|'both', DÙNG CHUNG với 3 field Giải phóng bộ nhớ mục 6b) — quyết định gọi
     * `scanAllSongsForCorruption()`/`scanAllVideosForCorruption()` (2 core RIÊNG, Rule 3 cấm quét
     * Video qua lại hàm scan Song) nào, hoặc CẢ HAI nối tiếp cho 'both'. Mỗi kết quả gắn thêm
     * `mediaType` — `executeDeleteBroken()` cần biết để xoá ĐÚNG store (Song hay Video).
     * @param {{mediaScope: string, onScanComplete: (results: Array) => void}} payload
     */
    async executeScanBroken(payload) {
        const { mediaScope, onScanComplete } = payload;
        let results;
        await withLoadingShield(t('common.storage.scanning'), async () => {
            const scanSong = async () => (await scanAllSongsForCorruption((current, total) => {
                loadingText.textContent = tFormat('common.storage.scanningProgress', { n: current, total });
            })).map((r) => ({ ...r, mediaType: 'song' }));
            const scanVideo = async () => (await scanAllVideosForCorruption((current, total) => {
                loadingText.textContent = tFormat('common.storage.scanningProgress', { n: current, total });
            })).map((r) => ({ ...r, mediaType: 'video' }));

            if (mediaScope === 'video') results = await scanVideo();
            else if (mediaScope === 'both') results = [...(await scanSong()), ...(await scanVideo())]; // nối tiếp, KHÔNG gộp % tiến trình chung (2 pha riêng, đơn giản + đúng)
            else results = await scanSong(); // mặc định 'song'

            if (fileManagerSongPanelEl) {
                renderScanResultUI(
                    results,
                    fileManagerSongPanelEl.querySelector('#storage-scan-result'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-summary'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-list'),
                    fileManagerSongPanelEl.querySelector('#btn-storage-delete-broken')
                );
            }
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** Ứng với msg.type = 'fileManagerSong.dismissScan.click'. */
    dismissScan() {
        if (!fileManagerSongPanelEl) return;
        resetScanResultUI(
            fileManagerSongPanelEl.querySelector('#storage-scan-result'),
            fileManagerSongPanelEl.querySelector('#storage-scan-list')
        );
    }
};
