/**
 * event/workflow/file-manager-storage.js — Workflow router "fileManagerStorage" (Generic Drawer "Quản lý lưu trữ", mở từ
 * tab Storage của bottom nav, gộp 3 domain Song/Video/Photo):
 *   - Thống kê dung lượng: đọc record 3 loại + tổng giây nghe + estimate quota, core thuần tổng hợp, `renderStorageStats()`
 *     vẽ, rồi đếm-lên các con số.
 *   - "Chọn mục xoá": 3 toggle nguồn độc lập (Router giữ `{song, video, photo}`) + 2 toggle hành động; `executeStorageAction()`
 *     lặp qua từng nguồn đang bật, mỗi nguồn tra STORAGE_SOURCE_BY_TYPE. Chỉ xoá khi bước tải (nếu bật) thành công thật.
 *   - "Dọn file lỗi": modal chọn phạm vi quét -> quét (đọc record + thử giải mã ở đây, core phán định) -> xoá theo loại.
 *   - Settings > Troubleshooting > "Scan & fix video thumbnails": quét thumb thiếu/đen -> chụp lại (`executeRepairBroken()`).
 *   - "Dọn dẹp dữ liệu" (router fileManagerCleanup) không thuộc file này.
 *
 * withLoadingShield()/alertModal()/modalChoice() chỉ đặt ở tầng này.
 *
 * NẠP SAU: core/storage-manager.js, core/about-stats.js, core/file-manager/video.js, core/file-manager/image.js,
 * core/image-load-ui.js, core/dynamic-object-ui.js, core/playlist/loader.js (readAudioDuration), core/media-element-ui.js,
 * core/player-controls.js, core/loading-shield-util.js, core/number-countup.js, components/file-manager-storage.js,
 * event/workflow/generic-drawer-helpers.js. NẠP TRƯỚC: event/router/file-manager-storage.js, event/listener/file-manager-storage.js.
 */
const STORAGE_COUNTUP_TASK = 'storageStatsCountUp';
const STORAGE_COUNTUP_STEPS = 24; // x 35ms mặc định của workflowNumberCountup ≈ 0.85s
const STORAGE_COUNTUP_EASE_POWER = 3; // ease-out cubic như Statistics
const MEDIA_PROBE_TIMEOUT_MS = 8000; // Safari iOS có thể không bắn 'loadedmetadata'/'error' với blob hỏng

/** Phần tử thống kê dung lượng (components/file-manager-storage.js). */
const STORAGE_STAT_SELECTORS = {
    totalBytesEl: '#stat-storage-total-bytes',
    barSongsEl: '#stat-storage-bar-songs',
    barVideosEl: '#stat-storage-bar-videos',
    barPhotosEl: '#stat-storage-bar-photos',
    barOtherEl: '#stat-storage-bar-other',
    freeRowEl: '#stat-storage-free-row',
    freeBytesEl: '#stat-storage-free-bytes',
    countSongsEl: '#stat-storage-count-song',
    countVideosEl: '#stat-storage-count-video',
    countPhotosEl: '#stat-storage-count-photo',
};

/** 5 toggle + nút Thực hiện của "Chọn mục xoá". */
const STORAGE_ACTION_SELECTORS = {
    sourceSongEl: '#toggle-storage-source-song',
    sourceVideoEl: '#toggle-storage-source-video',
    sourcePhotoEl: '#toggle-storage-source-photo',
    downloadEl: '#toggle-storage-download',
    deleteEl: '#toggle-storage-delete',
    executeBtnEl: '#btn-storage-execute',
};

/** Khung kết quả quét: Storage ("Dọn file lỗi") và Troubleshooting (components/settings/troubleshooting.js). */
const STORAGE_SCAN_RESULT_SELECTORS = { resultEl: '#storage-scan-result', summaryEl: '#storage-scan-summary', listEl: '#storage-scan-list', actionBtnEl: '#btn-storage-fix-broken' };
const VIDEO_THUMB_SCAN_RESULT_SELECTORS = { resultEl: '#video-thumb-scan-result', summaryEl: '#video-thumb-scan-summary', listEl: '#video-thumb-scan-list', actionBtnEl: '#btn-video-thumb-fix' };

/** Định dạng con số thống kê theo loại (buildStorageCountupTargets()). */
const STORAGE_STAT_FORMAT_BY_KIND = {
    bytes: (value) => formatBytes(value), // core/about-stats.js
    count: (value) => `${value}`,
    free: (value, quota) => `${formatBytes(value)} / ${formatBytes(quota)}`, // "còn trống / tối đa" — chỉ phần còn trống đếm lên
};

/** Mỗi nguồn của "Chọn mục xoá": lấy key để zip, tên file zip, cách xoá sạch. */
const STORAGE_SOURCE_BY_TYPE = {
    song: { listKeys: () => getAllSongKeys(), zipNameKey: 'fileManager.song.storageAction.zipNameSong', clear: () => workflowFileManagerStorage._clearSongLibrary() },
    video: { listKeys: () => getAllVideoKeys(), zipNameKey: 'fileManager.song.storageAction.zipNameVideo', clear: () => workflowFileManagerStorage._clearVideoLibrary() },
    photo: { listKeys: () => getAllImageKeys(), zipNameKey: 'storageDrawer.zipNamePhoto', clear: () => workflowFileManagerStorage._clearPhotoLibrary() },
};

/** Tải xuống trước khi xoá (toggle "Tải xuống trước"); tắt thì coi như 'ok'. */
const STORAGE_DOWNLOAD_BY_ENABLED = {
    true: (mediaType, source) => workflowFileManagerStorage._downloadZipFor(mediaType, source.listKeys, t(source.zipNameKey)),
    false: () => Promise.resolve({ status: 'ok' }),
};

const STORAGE_CLEAR_BY_ALLOWED = {
    true: (source) => source.clear(),
    false: () => Promise.resolve(),
};

/** Câu tổng kết sau khi chạy (resolveStorageActionReport()). */
const STORAGE_REPORT_MESSAGE_BY_KIND = {
    zipError: (report) => tFormat('fileManager.song.storageAction.zipErrorSkippedDelete', { message: escapeHtml(report.zipErrorMessage) }), // core/modal-choice-ui.js
    notAllDownloaded: () => t('fileManager.song.storageAction.notAllDownloadedSkippedDelete'),
    downloadAndDelete: (report, scope) => tFormat('fileManager.song.storageAction.doneDownloadAndDelete', { scope }),
    downloadOnly: () => t('fileManager.song.storageAction.doneDownloadOnly'),
    deleteOnly: (report, scope) => tFormat('fileManager.song.storageAction.doneDeleteOnly', { scope }),
};

/** Bài đang phát lúc xoá thư viện Song: dừng + gỡ nguồn (gỡ nguồn khi không có bài sẽ bắn 'error' giả). */
const CURRENT_SONG_STOP_BY_ACTIVE = {
    true: () => {
        pauseMediaElement(audioPlayer); // core/media-element-ui.js
        setMediaElementSource(audioPlayer, '');
        appState.set('currentKey', null);
    },
    false: () => {},
};

const VIDEO_PLAYER_EXIT_BY_ACTIVE = {
    true: () => workflowVideoPlayer.exitVideoPlayerMode(), // event/workflow/video-player.js
    false: () => Promise.resolve(),
};

/** Playlist đang duyệt đúng nguồn vừa xoá sạch -> rỗng hoá ngay (không để danh sách hiện item đã xoá). */
const BROWSING_PLAYLIST_CLEAR_BY_MATCH = {
    true: () => workflowFileManagerStorage._clearBrowsingPlaylist(),
    false: () => {},
};

/** Quét file lỗi theo loại: đọc key/record (service/db.js) + cách thử giải mã. */
const MEDIA_SCAN_BY_TYPE = {
    song: { listKeys: () => getAllSongKeys(), readRecord: (key) => getSongRecord(key), check: (record) => workflowFileManagerStorage._checkSongRecord(record) },
    video: { listKeys: () => getAllVideoKeys(), readRecord: (key) => getVideoRecord(key), check: (record) => workflowFileManagerStorage._checkVideoRecord(record) },
    photo: { listKeys: () => getAllImageKeys(), readRecord: (key) => getImageRecord(key), check: (record) => workflowFileManagerStorage._checkImageRecord(record) },
};

/** Item đã "Giữ lại" lúc phát lỗi (confirmedBrokenKeys) luôn báo, không thử lại. */
const SCAN_VERDICT_BY_KEPT = {
    true: () => Promise.resolve(buildKeptBrokenVerdict()), // core/storage-manager.js
    false: (scan, record) => scan.check(record),
};

/** Ảnh thumb giải mã được -> đo khung bằng đúng hàm lúc upload (cùng ngưỡng đen). */
const THUMB_PROBE_BY_DECODED = {
    true: (img) => classifyThumbProbe(workflowPlaylist._probeVideoFrame(img)), // core/storage-manager.js + event/workflow/playlist.js
    false: () => 'undecodable',
};

/** Xoá file lỗi theo loại: bỏ qua media đang phát (Photo không có), gỡ khỏi danh sách hiển thị sau khi xoá. */
const BROKEN_DELETE_BY_TYPE = {
    song: { skipKey: (currentKey) => currentKey, afterDelete: (keys) => keys.forEach((key) => workflowPlaylistOrder.removeKeyFromDisplay(key)) }, // event/workflow/playlist-order.js
    video: { skipKey: (currentKey) => currentKey, afterDelete: (keys) => keys.forEach((key) => workflowPlaylistOrder.removeKeyFromDisplay(key)) },
    photo: { skipKey: () => null, afterDelete: () => {} },
};

const REPAIR_COUNT_KEY_BY_OK = { true: 'fixed', false: 'failed' };

const workflowFileManagerStorage = {

    /**
     * Xoá TOÀN BỘ thư viện Song (3 store + tổng giây nghe) rồi đồng bộ RAM/UI và về Playlist. Không đụng ảnh/video nền.
     * An toàn khi bị gián đoạn: cờ `meta.clearingInProgress` ghi TRƯỚC khi xoá, chỉ gỡ SAU khi xong hết — lần mở app kế tiếp
     * còn thấy cờ thì event/workflow/app-boot.js gọi lại hàm này (idempotent: xoá key không tồn tại không lỗi).
     */
    async clearAllStoredData() {
        appState.set('isDestructiveTaskInProgress', true);
        try {
            await setMeta('clearingInProgress', true);
            await clearAllMediaOfType('song'); // service/db.js — 3 store Song trong 1 transaction
            await delMeta('totalListenSeconds');
            workflowListenStats.forgetType('song'); // event/workflow/listen-stats.js

            const { currentKey, currentObjectURL, currentCoverObjectURL } = appState.get(['currentKey', 'currentObjectURL', 'currentCoverObjectURL']);
            appState.set('playlistOrder', []); appState.set('displayOrder', []); appState.mutate('playlistCache', m => m.clear()); appState.mutate('songNameIndex', m => m.clear()); appState.mutate('confirmedBrokenKeys', s => s.clear());
            appState.mutate('pendingResortKeys', s => s.clear());
            workflowPlaylistOrder.recomputeRenderOrder(); // event/workflow/playlist-order.js
            CURRENT_SONG_STOP_BY_ACTIVE[!!currentKey]();
            workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js
            revokeBlobUrl(currentObjectURL); // service/blob-url.js
            revokeBlobUrl(currentCoverObjectURL);
            appState.set('currentObjectURL', null);
            appState.set('currentCoverObjectURL', null);
            setPlayerTrackLabels(t('bottomPlayer.noSongSelected'), '---'); // core/player-controls.js
            workflowPlaylistOrder.updateShuffleArray();
            workflowPlaylistRender.renderPlaylistFull();
            workflowConfig.save();
            workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js
            setVisualizerActiveFalse(); // core/player-controls.js — returnToPlaylistUI() không tự set cờ này

            await delMeta('clearingInProgress');
        } finally {
            appState.set('isDestructiveTaskInProgress', false);
        }
    },

    /** Ứng với 'fileManagerStorage.openPanel.click'. */
    async openPanel() {
        workflowGenericDrawerHelpers.open({ // event/workflow/generic-drawer-helpers.js
            height: 'auto',
            maxHeight: '85vh',
            // Nút X mang `data-storage-close` -> Listener gửi 'fileManagerStorage.closePanel.click'.
            headerHtml: buildDrawerHeaderHtml({ title: t('storageDrawer.title'), closeAttrs: 'data-storage-close="1"' }), // components/generic-drawer.js
            bodyHtml: renderFileManagerStorageDrawerBody(), // components/file-manager-storage.js
            bodyClass: 'overflow-y-auto',
        });
        workflowAppPanelNav.setActiveTab('storage'); // event/workflow/app-panel-nav.js
        await this.refreshTab();
        // Router vừa reset 3 nguồn + 2 hành động về tắt (an toàn cho thao tác phá dữ liệu).
        this.updateStorageActionUI({ song: false, video: false, photo: false }, false, false);
    },

    /** Ứng với 'fileManagerStorage.closePanel.click' — đóng Drawer, trả bottom nav về Media. */
    closePanel() {
        taskManager.kill(STORAGE_COUNTUP_TASK);
        workflowGenericDrawerHelpers.closeFully();
        workflowAppPanelNav.activateMedia();
    },

    /** Lấy phần tử trong body Drawer theo bảng selector. @returns {Object<string, HTMLElement|null>} */
    _queryDrawerEls(selectors) {
        return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, genericDrawerBody.querySelector(selector)]));
    },

    /**
     * `navigator.storage.estimate()`: dung lượng đang dùng + tối đa của CẢ origin (IndexedDB + OPFS + Cache gộp — Safari không
     * có `usageDetails`; iOS 17+, web app màn hình chính có quota ~60% dung lượng máy). Là ước tính. Không hỗ trợ/lỗi -> null.
     * @returns {Promise<{usage: number, quota: number}|null>}
     */
    async _estimateOriginStorage() {
        if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') return null;
        try {
            const { usage, quota } = await navigator.storage.estimate();
            if (!(quota > 0)) return null;
            return { usage: usage || 0, quota };
        } catch (err) {
            console.warn('[file-manager-storage] navigator.storage.estimate() lỗi — bỏ qua phần quota:', err);
            return null;
        }
    },

    /** Vẽ lại thống kê dung lượng + ẩn kết quả quét — lúc mở panel / sau khi xoá. Panel đóng -> bỏ qua. */
    async refreshTab() {
        if (!appState.get('isGenericDrawerOpen')) return;
        const [songRecords, videoRecords, imageRecords, totalListenSeconds, originEstimate] = await Promise.all([
            getAllSongRecords(), getAllVideoRecords(), getAllImageRecords(), getMeta('totalListenSeconds'), this._estimateOriginStorage(),
        ]); // service/db.js
        const songStats = summarizeSongLibrary(songRecords, totalListenSeconds || 0); // core/about-stats.js
        const videoStats = summarizeVideoLibrary(videoRecords); // core/file-manager/video.js
        const photoStats = summarizeImageLibrary(imageRecords); // core/file-manager/image.js
        const mediaBytes = sumStorageMediaBytes(songStats, videoStats, photoStats); // core/storage-manager.js
        const originBreakdown = computeOriginStorageBreakdown(mediaBytes, originEstimate); // null nếu không có estimate
        const free = pickStorageFreeFigures(originBreakdown);
        const statEls = this._queryDrawerEls(STORAGE_STAT_SELECTORS);
        renderStorageStats(songStats, videoStats, photoStats, statEls, originBreakdown, { // số cuối + độ rộng thanh (CSS tự animate)
            totalBytesText: STORAGE_STAT_FORMAT_BY_KIND.bytes(mediaBytes),
            freeText: STORAGE_STAT_FORMAT_BY_KIND.free(free.freeBytes, free.quota),
        });
        this._startStorageCountup(buildStorageCountupTargets(statEls, songStats, videoStats, photoStats, originBreakdown), free.quota);
        this._hideScanResult(STORAGE_SCAN_RESULT_SELECTORS);
    },

    /** Đếm-lên các con số từ 0 tới số vừa ghi: ép khung 0 ngay (không nháy số cuối) rồi chạy workflowNumberCountup.run();
     * gọi lại tự huỷ lượt cũ (cùng tên task). @param {Array<{el, finalValue, kind}>} targets @param {number} quota */
    _startStorageCountup(targets, quota) {
        if (targets.length === 0) return; // panel đang đóng
        const els = targets.map((target) => target.el);
        const paintFrame = (step, steps) => {
            const texts = targets.map(({ finalValue, kind }) => STORAGE_STAT_FORMAT_BY_KIND[kind](computeCountupValue(finalValue, step, steps, STORAGE_COUNTUP_EASE_POWER, 0), quota)); // core/number-countup.js
            setStorageCountupTexts(els, texts); // core/storage-manager.js
        };
        paintFrame(0, STORAGE_COUNTUP_STEPS);
        workflowNumberCountup.run(STORAGE_COUNTUP_TASK, { steps: STORAGE_COUNTUP_STEPS, onFrame: paintFrame }); // event/workflow/number-countup.js
    },

    /** Ứng với 'fileManagerStorage.storageBarSegment.click' — số byte thật của đoạn vừa ấn (`dataset.bytes`).
     * @param {{bytes: number, legendKey: string}} payload */
    showSegmentBytes(payload) {
        const { bytes, legendKey } = payload;
        alertModal(`${t(legendKey)}: ${formatBytes(bytes)}`);
    },

    // ===================== Chọn mục xoá =====================

    /** Đồng bộ 5 toggle + nút Thực hiện — Router gọi sau mỗi lần đổi. */
    updateStorageActionUI(sources, downloadEnabled, deleteEnabled) {
        if (!appState.get('isGenericDrawerOpen')) return;
        syncStorageActionUI(this._queryDrawerEls(STORAGE_ACTION_SELECTORS), sources, downloadEnabled, deleteEnabled, canRunStorageAction(sources, downloadEnabled, deleteEnabled)); // core/storage-manager.js
    },

    /** Ứng với 'fileManagerStorage.storageExecute.click' — hỏi xác nhận, lời văn theo tổ hợp hành động + nguồn đang bật.
     * @param {{sources: Object, downloadEnabled: boolean, deleteEnabled: boolean, onConfirmSend: function}} payload */
    askExecuteStorageAction(payload) {
        const { sources, downloadEnabled, deleteEnabled, onConfirmSend } = payload;
        if (!canRunStorageAction(sources, downloadEnabled, deleteEnabled)) return; // nút lẽ ra đã disabled
        const keys = resolveStorageActionConfirmKeys(downloadEnabled, deleteEnabled); // core/storage-manager.js
        modalChoice(
            tFormat(keys.bodyKey, { scope: buildStorageSourceLabel(sources) }),
            [{ label: t(keys.btnKey), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: onConfirmSend }],
            { title: t('fileManager.song.storageAction.confirmTitle') }
        );
    },

    /** Lấy toàn bộ key của 1 loại rồi zip + tải. Không có gì -> 'noItems'.
     * @returns {Promise<{status: 'ok'|'noItems'|'zipError'|'cancelled', message?: string}>} */
    async _downloadZipFor(mediaType, listKeys, zipNamePrefix) {
        const keys = await listKeys();
        if (keys.length === 0) return { status: 'noItems' };
        return this.zipAndDownloadOrFallback(mediaType, keys, buildDatedZipFileName(zipNamePrefix, new Date())); // core/storage-manager.js
    },

    /**
     * Zip + tải 1 tập key — dùng chung bởi `_downloadZipFor()` và "Folder Properties -> Download"
     * (event/workflow/file-manager-folder-browser.js). Nén trong shield, giao file SAU khi shield đóng: user activation của
     * lượt bấm gốc đã hết hạn sau khi nén (PWA sẽ mở Quick Look thay vì tải) — modal của deliver() tạo activation mới.
     * 'cancelled' khi CHƯA tải đủ mọi phần — nơi gọi không xoá dữ liệu.
     * @param {'song'|'video'|'photo'} mediaType @param {string[]} keys @param {string} zipFileName - đã gồm ".zip"
     * @returns {Promise<{status:'ok'|'zipError'|'cancelled', message?:string}>}
     */
    async zipAndDownloadOrFallback(mediaType, keys, zipFileName) {
        let zipParts;
        try {
            await withLoadingShield(t('common.storage.zippingStart'), async () => {
                const entries = await workflowZipDownload.collectEntries(mediaType, keys); // event/workflow/zip-download.js
                zipParts = await workflowZipDownload.compressInParts(entries, zipFileName);
            });
        } catch (err) {
            console.error('[file-manager-storage] Lỗi đóng gói zip:', err);
            return { status: 'zipError', message: describeZipError(err) }; // core/storage-manager.js
        }
        const allDownloaded = await workflowZipDownload.deliver(zipParts); // tự dọn file tạm OPFS sau khi modal đóng
        const statusByAllDownloaded = { true: 'ok', false: 'cancelled' };
        return { status: statusByAllDownloaded[allDownloaded] };
    },

    async _clearSongLibrary() {
        await withLoadingShield(t('common.storage.deletingData'), () => this.clearAllStoredData());
        await workflowFolder.clearAllItems(); // event/workflow/folder.js
        await this._resetSongScopeAfterClear();
    },

    /** Đang Scope 1 folder Song -> bỏ Scope (folder đã rỗng). */
    async _resetSongScopeAfterClear() {
        if (!appState.get('activePlayListFolder').song) return;
        await workflowPlaylistScope.persistScopeChoice(null, 'song'); // event/workflow/playlist-scope.js
    },

    async _clearVideoLibrary() {
        await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllMediaOfType('video'); workflowListenStats.forgetType('video'); }); // service/db.js
        const { isVideoPlayerMode, activeMediaSource } = appState.get(['isVideoPlayerMode', 'activeMediaSource']);
        await VIDEO_PLAYER_EXIT_BY_ACTIVE[!!isVideoPlayerMode]();
        BROWSING_PLAYLIST_CLEAR_BY_MATCH[activeMediaSource === 'video']();
    },

    async _clearPhotoLibrary() {
        await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllMediaOfType('photo'); workflowListenStats.forgetType('photo'); });
        BROWSING_PLAYLIST_CLEAR_BY_MATCH[appState.get('activeMediaSource') === 'photo']();
    },

    _clearBrowsingPlaylist() {
        appState.set('playlistOrder', []);
        appState.mutate('playlistCache', (m) => m.clear());
        workflowPlaylistOrder.updateShuffleArray(); workflowPlaylistOrder.recomputeDisplayOrder(); workflowPlaylistOrder.recomputeRenderOrder(); // event/workflow/playlist-order.js
        workflowPlaylistRender.renderPlaylistDiff(); workflowPlaylistRender.syncEmptyState(); // event/workflow/playlist-render.js
    },

    /** "Tải xuống + xoá" (tuỳ 2 toggle) cho 1 nguồn. @returns {Promise<{status: string, message?: string}>} */
    async _runStorageActionForSource(mediaType, downloadEnabled, deleteEnabled) {
        const source = STORAGE_SOURCE_BY_TYPE[mediaType];
        const result = await STORAGE_DOWNLOAD_BY_ENABLED[downloadEnabled](mediaType, source);
        await STORAGE_CLEAR_BY_ALLOWED[shouldClearStorageSource(deleteEnabled, result.status)](source); // core/storage-manager.js
        return result;
    },

    /** Ứng với 'fileManagerStorage.storageExecute.confirm' — chạy tuần tự từng nguồn đang bật, vẽ lại, báo 1 lần. */
    async executeStorageAction(sources, downloadEnabled, deleteEnabled) {
        const results = [];
        for (const mediaType of pickEnabledStorageSources(sources)) { // core/storage-manager.js
            results.push(await this._runStorageActionForSource(mediaType, downloadEnabled, deleteEnabled));
        }
        await this.refreshTab();
        const report = resolveStorageActionReport(downloadEnabled, deleteEnabled, results); // core/storage-manager.js
        alertModal(STORAGE_REPORT_MESSAGE_BY_KIND[report.kind](report, buildStorageSourceLabel(sources)));
    },

    // ===================== Dọn file lỗi =====================

    /** Ứng với 'fileManagerStorage.scanBroken.click' — modal có `<select>` chọn phạm vi quét (tách khỏi 3 toggle nguồn để
     * khỏi nhầm). Nút "Thực hiện" đọc giá trị lúc bấm (modal đã gỡ khỏi DOM nhưng `<select>` vẫn giữ `.value`).
     * @param {{onConfirmSend: (scope: 'all'|'song'|'video'|'photo') => void}} payload */
    askScanBrokenScope(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            renderStorageScanScopeModalBodyHtml(), // components/file-manager-storage.js
            [{ label: t('fileManager.song.storageAction.btnExecute'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnCautionBg btnCautionHoverBg textOnAccent', onClick: () => onConfirmSend(readScanScopeValue(selectEl)) }],
            { title: t('storageDrawer.scanBroken.label') }
        );
        const selectEl = findScanScopeSelect(); // core/storage-manager.js — ngay sau khi modal gắn DOM
    },

    /** Giá trị dropdown phạm vi quét -> 3 nguồn cho executeScanBroken(). @param {string} scope */
    scopeToSources(scope) {
        return scanScopeToSources(scope); // core/storage-manager.js
    },

    /** Ứng với 'fileManagerStorage.fixBroken.click' — modal xác nhận đúng nội dung/màu theo lô (xoá / sửa / cả 2).
     * @param {{scanResults: Array, onConfirmSend: function}} payload */
    askFixBroken(payload) {
        const { scanResults, onConfirmSend } = payload;
        const view = resolveFixBrokenModal(scanResults); // core/storage-manager.js
        const themeKeysByDestructive = { true: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', false: 'btnCautionBg btnCautionHoverBg textOnAccent' };
        modalChoice(
            view.bodyText,
            [{ label: t(view.btnKey), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: themeKeysByDestructive[view.destructive], onClick: onConfirmSend }],
            { title: t(view.titleKey) }
        );
    },

    /** Ứng với 'fileManagerStorage.fixBroken.confirm', nhánh xoá — Router đã lọc chỉ còn `fixable:false`; có thể gồm cả 3
     * loại (`mediaType`), xoá đúng store từng loại. @param {{scanResults: Array, currentKey: string|null}} payload */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;
        if (scanResults.length === 0) return;
        const grouped = groupBrokenResultsByType(scanResults); // core/storage-manager.js
        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            for (const mediaType of Object.keys(BROKEN_DELETE_BY_TYPE)) {
                const results = grouped[mediaType];
                if (results.length === 0) continue;
                const rule = BROKEN_DELETE_BY_TYPE[mediaType];
                rule.afterDelete(await this._deleteBrokenOfType(mediaType, results, rule.skipKey(currentKey)));
            }
            await this.refreshTab(); // tự ẩn khung kết quả quét
        });
        await alertModal(t('common.storage.deleteBrokenDone'));
    },

    /** Gỡ khỏi mọi folder TRƯỚC (không để key "ma" — upload lại cùng tên sẽ nhân đôi trong folder) rồi xoá record.
     * @returns {Promise<string[]>} key đã xoá */
    async _deleteBrokenOfType(mediaType, results, skipKey) {
        await workflowFolder.removeKeysFromAllFolders(mediaType, pickDeletableBrokenKeys(results, skipKey)); // core/storage-manager.js + event/workflow/folder.js
        return deleteCorruptedMediaRecords(mediaType, results, skipKey); // core/storage-manager.js
    },

    /** Ứng với 'fileManagerStorage.fixBroken.confirm' nhánh sửa / 'videoThumb.fix' — Router đã lọc chỉ còn `fixable:true`
     * (luôn là Video). Chụp lại thumb, không xoá gì. @param {Array<{key:string}>} scanResults */
    async executeRepairBroken(scanResults) {
        if (scanResults.length === 0) return;
        const counts = { fixed: 0, failed: 0 };
        await withLoadingShield(t('common.storage.repairing'), async () => {
            for (let i = 0; i < scanResults.length; i++) {
                setLoadingShieldText(tFormat('common.storage.repairingProgress', { n: i + 1, total: scanResults.length })); // core/loading-shield-util.js
                counts[REPAIR_COUNT_KEY_BY_OK[await this._repairVideoThumbs(scanResults[i].key)]]++;
            }
            this._hideScanResult(VIDEO_THUMB_SCAN_RESULT_SELECTORS);
        });
        await alertModal(formatRepairReport(counts.fixed, counts.failed)); // core/storage-manager.js
    },

    /** Chụp lại 2 thumb của 1 video bằng đúng pipeline lúc upload. Blob không đọc được nữa (đổi giữa lúc quét và lúc sửa)
     * -> thất bại, KHÔNG tự xoá (xoá cần xác nhận riêng). @returns {Promise<boolean>} */
    async _repairVideoThumbs(key) {
        const record = await getVideoRecord(key); // service/db.js
        if (precheckMediaRecordBlob(record)) return false; // core/storage-manager.js — thiếu blob
        try {
            const { thumbBlob, thumbFullBlob, thumbFullIsBlack } = await workflowPlaylist.extractVideoThumbAndMeta(record.blob); // event/workflow/playlist.js
            await setVideoThumbnails(key, thumbBlob, thumbFullBlob, thumbFullIsBlack); // core/file-manager/video.js — đen thật thì lần quét sau bỏ qua
            eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'video', key } }); // video đang dùng thì tự làm tươi ảnh
            return true;
        } catch (err) {
            console.error(`[executeRepairBroken] tạo lại thumbnail thất bại cho video "${key}":`, err);
            return false;
        }
    },

    _setScanProgress(current, total) {
        setLoadingShieldText(tFormat('common.storage.scanningProgress', { n: current, total })); // core/loading-shield-util.js
    },

    /** Quét 1 loại media: item "Giữ lại" báo thẳng, còn lại thử giải mã. @returns {Promise<Array>} item lỗi (kèm `mediaType`) */
    async _scanMediaType(mediaType, onScanProgress) {
        const scan = MEDIA_SCAN_BY_TYPE[mediaType];
        const keys = await scan.listKeys();
        const keptKeys = appState.get('confirmedBrokenKeys');
        const results = [];
        for (let i = 0; i < keys.length; i++) {
            onScanProgress(i + 1, keys.length);
            const record = await scan.readRecord(keys[i]);
            const verdict = await SCAN_VERDICT_BY_KEPT[keptKeys.has(keys[i])](scan, record);
            appendScanResult(results, keys[i], record, verdict, mediaType); // core/storage-manager.js
        }
        return results;
    },

    async _checkSongRecord(record) {
        const quick = precheckSongRecord(record); // core/storage-manager.js — thiếu blob / mime sai
        if (quick) return quick;
        return judgeSongDuration(await readAudioDuration(record.blob)); // core/playlist/loader.js
    },

    async _checkVideoRecord(record) {
        const quick = precheckMediaRecordBlob(record);
        if (quick) return quick;
        return judgeVideoProbe(record, await this._probeVideoBlob(record.blob)); // core/storage-manager.js
    },

    async _checkImageRecord(record) {
        const quick = precheckMediaRecordBlob(record);
        if (quick) return quick;
        const url = createBlobUrl(record.blob); // service/blob-url.js
        const img = await decodeImageFromUrl(url); // core/image-load-ui.js
        releaseDecodedImage(img); // nhả bitmap ngay (quét cả thư viện ảnh full-res)
        revokeBlobUrl(url);
        return judgeImageDecode(!!img); // core/storage-manager.js
    },

    /** Nạp blob vào `<video>` tạm, đợi 'loadedmetadata' vs 'error' (tối đa MEDIA_PROBE_TIMEOUT_MS) rồi giải phóng hẳn thẻ
     * tạm (không để N player mồ côi). @returns {Promise<'loaded'|'undecodable'|'brokenBlob'>} */
    async _probeVideoBlob(blob) {
        let url;
        try { url = createBlobUrl(blob); } catch (err) { return 'brokenBlob'; }
        const videoEl = createMetadataProbeVideoElement(); // core/dynamic-object-ui.js
        const errorWait = listenEventOnce(videoEl, 'error');
        const metaWait = loadMediaElementMetadata(videoEl, url);
        const probe = await new Promise((resolve) => {
            const timer = taskManager.once(() => resolve('undecodable'), MEDIA_PROBE_TIMEOUT_MS);
            metaWait.promise.then(() => { timer.kill(); resolve('loaded'); });
            errorWait.promise.then(() => { timer.kill(); resolve('undecodable'); });
        });
        metaWait.cancel();
        errorWait.cancel(); // gỡ trước khi giải phóng (load() rỗng có thể bắn lại 'error')
        releaseMediaElement(videoEl);
        revokeBlobUrl(url);
        return probe;
    },

    /** Hiện kết quả quét vào khung `selectors` (panel đóng -> bỏ qua). */
    _showScanResult(selectors, results) {
        if (!appState.get('isGenericDrawerOpen')) return;
        showScanResultUI(this._queryDrawerEls(selectors), formatScanResultSummary(results.length), renderStorageScanResultListHtml(results), results.length > 0); // core/storage-manager.js + components/file-manager-storage.js
    },

    _hideScanResult(selectors) {
        if (!appState.get('isGenericDrawerOpen')) return;
        const els = this._queryDrawerEls(selectors);
        resetScanResultUI(els.resultEl, els.listEl); // core/storage-manager.js
    },

    /** Ứng với 'fileManagerStorage.scanBroken.confirm' — quét tuần tự từng nguồn đang bật. Storage chỉ báo file hỏng thật
     * (không sửa được); thumb video thiếu/đen thuộc màn Troubleshooting. @param {{sources: Object, onScanComplete: function}} payload */
    async executeScanBroken(payload) {
        const { sources, onScanComplete } = payload;
        let results = [];
        await withLoadingShield(t('common.storage.scanning'), async () => {
            for (const mediaType of pickEnabledStorageSources(sources)) {
                results = results.concat(await this._scanMediaType(mediaType, (current, total) => this._setScanProgress(current, total)));
            }
            results = pickUnfixableScanResults(results); // core/storage-manager.js
            this._showScanResult(STORAGE_SCAN_RESULT_SELECTORS, results);
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** Lượt quét thứ 2 của Video: thumb full-res CÓ nhưng ĐEN/không giải mã được (lượt chính chỉ xét thumb có tồn tại). Bỏ
     * qua video đã có kết quả lượt chính, thiếu blob/thumb, hoặc đã xác nhận đen thật (`thumbFullBlack`). Kết quả luôn
     * `fixable:true`. @returns {Promise<Array>} */
    async _scanBlackVideoThumbs(alreadyFlagged, onScanProgress) {
        const flaggedKeys = collectScanResultKeys(alreadyFlagged); // core/storage-manager.js
        const keys = await getAllVideoKeys(); // service/db.js
        const found = [];
        for (let i = 0; i < keys.length; i++) {
            onScanProgress(i + 1, keys.length);
            if (flaggedKeys.has(keys[i])) continue;
            const record = await getVideoRecord(keys[i]);
            if (!needsVideoThumbProbe(record)) continue; // core/storage-manager.js
            const item = buildThumbScanItem(keys[i], record, await this._classifyThumbBlob(record.thumbFullBlob));
            if (item) found.push(item);
        }
        return found;
    },

    /** Giải mã thumb rồi đo bằng đúng hàm lúc upload; giải phóng ảnh ngay. @returns {Promise<'ok'|'black'|'undecodable'>} */
    async _classifyThumbBlob(blob) {
        const url = createBlobUrl(blob);
        const img = await decodeImageFromUrl(url); // core/image-load-ui.js
        try {
            return THUMB_PROBE_BY_DECODED[!!img](img);
        } catch (err) {
            return 'undecodable';
        } finally {
            releaseDecodedImage(img);
            revokeBlobUrl(url);
        }
    },

    /** Settings > Troubleshooting > "Scan & fix video thumbnails" ('fileManagerStorage.videoThumb.scan.click') — chỉ Video,
     * chỉ phần thumb (`fixable:true`): thiếu thumb + thumb full-res đen/không giải mã được. @param {{onScanComplete: function}} payload */
    async executeScanVideoThumbs(payload) {
        const { onScanComplete } = payload;
        let results = [];
        await withLoadingShield(t('common.storage.scanning'), async () => {
            const onScanProgress = (current, total) => this._setScanProgress(current, total);
            const mainResults = await this._scanMediaType('video', onScanProgress);
            const blackThumbResults = await this._scanBlackVideoThumbs(mainResults, onScanProgress); // bỏ qua mọi video lượt chính đã gắn cờ
            results = pickFixableScanResults(mainResults).concat(blackThumbResults); // core/storage-manager.js
            this._showScanResult(VIDEO_THUMB_SCAN_RESULT_SELECTORS, results);
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** Ứng với 'fileManagerStorage.videoThumb.dismiss.click'. */
    dismissVideoThumbScan() {
        this._hideScanResult(VIDEO_THUMB_SCAN_RESULT_SELECTORS);
    },

    /** Ứng với 'fileManagerStorage.dismissScan.click'. */
    dismissScan() {
        this._hideScanResult(STORAGE_SCAN_RESULT_SELECTORS);
    },
};
