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
    },

    /** Vẽ lại thống kê dung lượng (Song + Video) + reset UI quét lỗi — gọi lúc mở panel. SỬA
     * (Batch 5, "Song/Video Unification" mục 6e) — phần vẽ danh sách folder (phân trang, tạo mới)
     * ĐÃ XOÁ khỏi hàm này, chuyển hẳn sang event/workflow/file-manager-folder-browser.js. */
    async refreshSongTab() {
        if (!fileManagerSongPanelEl) return; // panel đã đóng — an toàn bỏ qua

        // MỚI (Batch 5, mục 6a) — Workflow tự gọi computeStats()/computeVideoStats() (2 core khác
        // nhau, chạy song song) RỒI truyền kết quả vào render — renderStorageStats()/
        // renderVideoStorageStats() giờ THUẦN nhận tham số, không tự gọi core nào (Rule 2/3, tự
        // sửa cùng lúc phát hiện core-gọi-core cũ ở renderStorageStats()).
        const [songStats, videoStats] = await Promise.all([computeStats(), computeVideoStats()]); // core/about-stats.js, core/file-manager/video.js
        renderStorageStats( // core có sẵn (core/storage-manager.js)
            songStats,
            fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
            fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes')
        );
        renderVideoStorageStats( // core có sẵn (core/storage-manager.js)
            videoStats,
            fileManagerSongPanelEl.querySelector('#stat-storage-total-videos'),
            fileManagerSongPanelEl.querySelector('#stat-storage-total-video-bytes')
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
     * @param {{scanResults: Array, currentKey: string|null}} payload
     */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;

        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            await deleteCorruptedSongs(scanResults, currentKey);
            if (fileManagerSongPanelEl) {
                resetScanResultUI(
                    fileManagerSongPanelEl.querySelector('#storage-scan-result'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-list')
                );
                renderStorageStats(
                    await computeStats(), // core/about-stats.js — Workflow tự gọi trước, truyền vào (Rule 2/3)
                    fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
                    fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes')
                );
            }
        });

        await alertModal(t('common.storage.deleteBrokenDone'));
    },

    /** Ứng với msg.type = 'fileManagerSong.downloadThenClear.click'. */
    askDownloadThenClear(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.storage.downloadThenClearConfirm'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.storage.downloadThenClearConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.downloadThenClearTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerSong.downloadThenClear.confirm'. */
    async executeDownloadThenClear() {
        let result;
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            result = await downloadAllSongsThenClear((pct) => {
                loadingText.textContent = tFormat('common.storage.zippingProgress', { percent: pct });
            });
        });

        // MỚI (03/07/2026, đợt 5, điểm 3) — xoá sạch thư viện thì MỌI folder cũng phải rỗng theo
        // + bỏ scope nếu đang áp dụng 1 folder (không còn ý nghĩa gì để giữ).
        await clearAllFolderSongData(); // core/file-manager/folder.js
        if (appState.get('activePlayListFolder')) {
            await workflowPlaylistScope.persistScopeChoice(null);
        }
        await this.refreshSongTab(); // vẽ lại danh sách folder (rỗng hết, hết badge active) nếu Song panel đang mở

        if (result.status === 'noSongs') {
            await alertModal(t('common.storage.noSongsToDownload'));
        } else if (result.status === 'zipError') {
            await alertModal(tFormat('common.storage.zipBuildError', { message: escapeHtml(result.message) }));
        } else {
            await alertModal(t('common.storage.downloadThenClearDone'));
        }
    },

    /** Ứng với msg.type = 'fileManagerSong.clearNoDownload.click'. */
    askClearNoDownload(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.storage.clearNoDownloadConfirm'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.storage.clearNoDownloadConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.clearNoDownloadTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerSong.clearNoDownload.confirm'. */
    async executeClearNoDownload() {
        await withLoadingShield(t('common.storage.deletingData'), async () => {
            await clearAllSongsNoDownload();
        });

        await clearAllFolderSongData(); // core/file-manager/folder.js
        if (appState.get('activePlayListFolder')) {
            await workflowPlaylistScope.persistScopeChoice(null);
        }
        await this.refreshSongTab();

        await alertModal(t('common.storage.clearNoDownloadDone'));
    },

    /** Ứng với msg.type = 'fileManagerSong.scanBroken.click'.
     * @param {{onScanComplete: (results: Array) => void}} payload
     */
    async executeScanBroken(payload) {
        const { onScanComplete } = payload;
        let results;
        await withLoadingShield(t('common.storage.scanning'), async () => {
            results = await scanAllSongsForCorruption((current, total) => {
                loadingText.textContent = tFormat('common.storage.scanningProgress', { n: current, total });
            });
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
