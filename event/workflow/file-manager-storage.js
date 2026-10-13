/**
 * event/workflow/file-manager-storage.js — "THẰNG THỰC THI CUỐI" của router "fileManagerStorage" (Generic Drawer "Quản
 * lý lưu trữ" — storageDrawer.title, mở từ tab Storage của bottom nav, gộp CẢ 3 domain Song/Video/Photo):
 *   - Thống kê dung lượng: Workflow đọc record 3 loại + tổng giây nghe + estimate quota, core thuần tổng hợp, rồi
 *     `renderStorageStats()` (core/storage-manager.js) vẽ.
 *   - "Chọn mục xoá": 3 toggle nguồn ĐỘC LẬP (song/video/photo) — router (event/router/file-manager-storage.js) giữ
 *     closure `{song,video,photo}`. Là tổ hợp BOOLEAN ĐỘC LẬP (2^3 khả năng, không phải 1 enum hữu hạn để
 *     VirtualMachineState so khớp) nên Router gọi THẲNG 1 method (`executeStorageAction()`), method đó tự LẶP qua từng
 *     nguồn đang bật.
 *   - "Dọn file lỗi": modal riêng chọn loại quét (askScanBrokenScope()), quét -> sửa/xoá theo từng lô.
 *   - "Dọn dẹp dữ liệu" (registry fileManagerCleanup) KHÔNG thuộc file/router này.
 * Storage dùng `genericDrawerBody` (TĨNH, luôn tồn tại); `genericDrawerPanel.classList.contains('hidden')` cho biết đang
 * mở/đóng (xem các guard bên dưới). Không có sub-panel lồng bên trong.
 *
 * QUY TẮC: chuỗi gọi hàm core thuần, withLoadingShield()/alertModal()/modalChoice() CHỈ đặt ở tầng này.
 *
 * NẠP SAU: core/storage-manager.js, core/about-stats.js, core/file-manager/video.js, core/file-manager/image.js,
 * core/image-load-ui.js, core/generic-drawer.js, event/workflow/generic-drawer-helpers.js, event/workflow/app-panel-nav.js.
 * NẠP TRƯỚC: event/router/file-manager-storage.js, event/listener/file-manager-storage.js.
 */
/** Đếm-lên các con số thống kê dung lượng
 * (tổng byte + số Song/Video/Photo) mỗi lần `refreshTab()` vẽ lại, dùng CHUNG core `computeCountupValue()` (core/number-countup.js)
 * + vòng lặp `workflowNumberCountup.run()` (event/workflow/number-countup.js) — cùng cơ chế Game/Statistics. Ease-out cubic như Statistics. */
const STORAGE_COUNTUP_TASK = 'storageStatsCountUp';
const STORAGE_COUNTUP_STEPS = 24; // x 35ms mặc định của workflowNumberCountup ≈ 0.85s
const STORAGE_COUNTUP_EASE_POWER = 3;

const workflowFileManagerStorage = {

    /** Xóa TOÀN BỘ thư viện Song khỏi IndexedDB (3 store Song + tổng giây nghe) rồi đồng bộ lại RAM/UI và về Playlist.
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
    async clearAllStoredData() {
        appState.set('isDestructiveTaskInProgress', true);
        try {
            await setMeta('clearingInProgress', true);

            // [QUYẾT ĐỊNH 1.8] "Xóa hết dữ liệu" CHỈ xóa bài hát (và thống kê nghe riêng từng bài,
            // vì bài hát đã mất). KHÔNG đụng tới ảnh/video nền (bgImage/videoBg) — đó là tài nguyên
            // người dùng thiết lập riêng, không nằm trong "thư viện nhạc".
            await clearAllMediaOfType('song'); // service/db.js — xoá 3 store Song trong 1 transaction
            await delMeta('totalListenSeconds');
            workflowListenStats.forgetType('song'); // event/workflow/listen-stats.js — thống kê mất cùng record, chỉ dọn RAM loại Song

            // Đồng bộ lại toàn bộ state RAM — không reload trang, để người dùng thấy ngay kết quả.
            appState.set('playlistOrder', []); appState.set('displayOrder', []); appState.mutate('playlistCache', m => m.clear()); appState.mutate('songNameIndex', m => m.clear()); appState.mutate('confirmedBrokenKeys', s => s.clear());
            appState.mutate('pendingResortKeys', s => s.clear());
            if (typeof workflowPlaylistOrder !== 'undefined') workflowPlaylistOrder.recomputeRenderOrder();
            if (appState.get('currentKey')) { audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null); }
            workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js
            if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
            if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
            playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
            if (typeof workflowPlaylistOrder !== 'undefined') workflowPlaylistOrder.updateShuffleArray(); // event/workflow/playlist-order.js
            workflowPlaylistRender.renderPlaylistFull();
            saveConfig();
            workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js
            if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse(); // returnToPlaylistUI() không tự set cờ này

            await delMeta('clearingInProgress'); // chỉ xoá cờ SAU KHI mọi bước trên đã xong hoàn toàn
        } finally {
            appState.set('isDestructiveTaskInProgress', false);
        }
    },


    /** Ứng với 'fileManagerStorage.openPanel.click'. Mở Generic Drawer "Quản lý lưu trữ" — cùng
     * khuôn `workflowFileManagerFolderBrowser._renderList()` (header title + nút X). */
    async openPanel() {
        workflowGenericDrawerHelpers.open({ // event/workflow/generic-drawer-helpers.js — lối mở DUY NHẤT
            height: 'auto', // tự co theo nội dung, xem core/generic-drawer.js
            maxHeight: '85vh',
            // Nút X mang `data-storage-close` — Listener ủy quyền (event/listener/file-manager-storage.js) gửi
            // 'fileManagerStorage.closePanel.click'.
            headerHtml: buildDrawerHeaderHtml({ title: t('storageDrawer.title'), closeAttrs: 'data-storage-close="1"' }), // components/generic-drawer.js
            // `p-4` nằm trong wrapper của body (quy ước Settings: bodyClass chỉ overflow-y-auto, không tự có padding).
            bodyHtml: renderFileManagerStorageDrawerBody(), // components/file-manager-storage.js
            bodyClass: 'overflow-y-auto',
        });

        workflowAppPanelNav.setActiveTab('storage'); // event/workflow/app-panel-nav.js — liên tuyến domain
        await this.refreshTab();
        // Đồng bộ UI về mặc định an toàn (Router vừa reset closure state ở case 'openPanel.click').
        this.updateStorageActionUI({ song: false, video: false, photo: false }, false, false);
    },

    /** Ứng với 'fileManagerStorage.closePanel.click' — đóng Drawer, trả bottom nav về Media. */
    closePanel() {
        taskManager.kill(STORAGE_COUNTUP_TASK); // dừng đếm-lên nếu panel đóng giữa chừng
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        workflowAppPanelNav.activateMedia(); // event/workflow/app-panel-nav.js
    },

    /**
     * Đọc `navigator.storage.estimate()`: dung lượng ĐANG DÙNG + TỐI ĐA của CẢ origin (IndexedDB + OPFS + Cache Storage gộp
     * chung — Safari không có `usageDetails`). Safari hỗ trợ từ iOS 17; web app màn hình chính có quota khoảng 60% dung
     * lượng máy. Số là ƯỚC TÍNH. Không hỗ trợ/lỗi -> `null` (KHÔNG throw).
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

    /** Vẽ lại thống kê dung lượng (3 domain) + reset UI quét lỗi — gọi lúc mở panel/sau khi
     * xoá xong. */
    async refreshTab() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // panel đã đóng — an toàn bỏ qua

        // Workflow ĐỌC toàn bộ dữ liệu (record 3 loại — 1 transaction mỗi loại; tổng giây nghe; estimate quota) rồi core
        // THUẦN tổng hợp (Rule 3b).
        const [songRecords, videoRecords, imageRecords, totalListenSeconds, originEstimate] = await Promise.all([
            getAllSongRecords(), getAllVideoRecords(), getAllImageRecords(), getMeta('totalListenSeconds'), this._estimateOriginStorage(),
        ]); // service/db.js
        const songStats = summarizeSongLibrary(songRecords, totalListenSeconds || 0); // core/about-stats.js
        const videoStats = summarizeVideoLibrary(videoRecords); // core/file-manager/video.js
        const photoStats = summarizeImageLibrary(imageRecords); // core/file-manager/image.js
        const mediaBytes = songStats.totalBytes + videoStats.totalBytes + photoStats.totalBytes;
        const originBreakdown = computeOriginStorageBreakdown(mediaBytes, originEstimate); // core/storage-manager.js — null nếu không có estimate
        const statEls = {
            totalBytesEl: genericDrawerBody.querySelector('#stat-storage-total-bytes'),
            barSongsEl: genericDrawerBody.querySelector('#stat-storage-bar-songs'),
            barVideosEl: genericDrawerBody.querySelector('#stat-storage-bar-videos'),
            barPhotosEl: genericDrawerBody.querySelector('#stat-storage-bar-photos'),
            barOtherEl: genericDrawerBody.querySelector('#stat-storage-bar-other'),
            freeRowEl: genericDrawerBody.querySelector('#stat-storage-free-row'),
            freeBytesEl: genericDrawerBody.querySelector('#stat-storage-free-bytes'),
            countSongsEl: genericDrawerBody.querySelector('#stat-storage-count-song'),
            countVideosEl: genericDrawerBody.querySelector('#stat-storage-count-video'),
            countPhotosEl: genericDrawerBody.querySelector('#stat-storage-count-photo'),
        };
        const storageTexts = { // core/about-stats.js::formatBytes() — định dạng sẵn cho core (Rule 3a)
            totalBytesText: formatBytes(mediaBytes),
            freeText: originBreakdown ? `${formatBytes(originBreakdown.freeBytes)} / ${formatBytes(originBreakdown.quota)}` : '',
        };
        renderStorageStats(songStats, videoStats, photoStats, statEls, originBreakdown, storageTexts); // core/storage-manager.js — ghi SỐ CUỐI + độ rộng thanh (thanh tự animate bằng CSS transition)
        this._startStorageCountup(statEls, songStats, videoStats, photoStats, originBreakdown); // đếm-lên các con số từ 0 tới số vừa ghi
        resetScanResultUI( // core/storage-manager.js
            genericDrawerBody.querySelector('#storage-scan-result'),
            genericDrawerBody.querySelector('#storage-scan-list')
        );
    },

    /** Đếm-lên 4 con số (tổng dung lượng + số Song/Video/Photo) từ 0 tới số `renderStorageStats()` vừa ghi: ép về
     * khung 0 NGAY (đồng bộ, không nháy số cuối trước khi đếm) rồi chạy `workflowNumberCountup.run()`; giá trị mỗi khung do
     * `computeCountupValue()` (core), định dạng byte dùng `formatBytes()` (core/about-stats.js — chính hàm đã dùng lúc ghi số cuối, nên khung cuối
     * khớp từng ký tự). Gọi lại `refreshTab()` (vd sau khi xoá xong) tự huỷ lượt cũ (`run()` kill trùng tên). */
    _startStorageCountup(els, songStats, videoStats, photoStats, originBreakdown) {
        const asInteger = (value) => `${value}`;
        // "còn trống / tối đa": chỉ phần còn trống đếm lên, tối đa giữ nguyên.
        // Không có estimate thì el = null (bị filter bỏ ngay dưới) — dòng đó vốn đang ẩn.
        const freeTarget = originBreakdown
            ? { el: els.freeBytesEl, finalValue: originBreakdown.freeBytes, format: (value) => `${formatBytes(value)} / ${formatBytes(originBreakdown.quota)}` } // core/about-stats.js
            : { el: null };
        const targets = [
            { el: els.totalBytesEl, finalValue: songStats.totalBytes + videoStats.totalBytes + photoStats.totalBytes, format: formatBytes }, // core/about-stats.js
            { el: els.countSongsEl, finalValue: songStats.totalSongs, format: asInteger },
            { el: els.countVideosEl, finalValue: videoStats.totalVideos, format: asInteger },
            { el: els.countPhotosEl, finalValue: photoStats.totalImages, format: asInteger },
            freeTarget,
        ].filter((target) => target.el);
        if (targets.length === 0) return; // panel đang đóng
        const paintFrame = (step, steps) => {
            for (const { el, finalValue, format } of targets) {
                el.textContent = format(computeCountupValue(finalValue, step, steps, STORAGE_COUNTUP_EASE_POWER, 0)); // core/number-countup.js
            }
        };
        paintFrame(0, STORAGE_COUNTUP_STEPS);
        workflowNumberCountup.run(STORAGE_COUNTUP_TASK, { steps: STORAGE_COUNTUP_STEPS, onFrame: paintFrame }); // event/workflow/number-countup.js
    },

    /** Ứng với 'fileManagerStorage.storageBarSegment.click' — hiện `alertModal()` với ĐÚNG số byte của đoạn vừa ấn (đọc
     * từ `dataset.bytes`, gắn sẵn lúc `renderStorageStats()` vẽ lại thanh). `legendKey` là key nhãn của đoạn
     * (`storageDrawer.legend{Songs,Videos,Photos,Other}`).
     * @param {{bytes: number, legendKey: string}} payload
     */
    showSegmentBytes(payload) {
        const { bytes, legendKey } = payload;
        alertModal(`${t(legendKey)}: ${formatBytes(bytes)}`); // formatBytes() — core/about-stats.js
    },

    // ===================== Chọn mục xoá — 3 nguồn độc lập + 2 toggle hành động =================

    /** DOM-patch thuần — đồng bộ 3 toggle nguồn + 2 toggle hành động + disabled/nhãn nút Thực
     * hiện, gọi lại SAU MỖI lần đổi 1 trong 5 field (Router tự gọi).
     * @param {{song:boolean,video:boolean,photo:boolean}} sources
     * @param {boolean} downloadEnabled @param {boolean} deleteEnabled
     */
    updateStorageActionUI(sources, downloadEnabled, deleteEnabled) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // guard
        const setToggle = (selector, checked) => {
            const el = genericDrawerBody.querySelector(selector);
            if (el) el.checked = checked;
        };
        setToggle('#toggle-storage-source-song', sources.song);
        setToggle('#toggle-storage-source-video', sources.video);
        setToggle('#toggle-storage-source-photo', sources.photo);
        setToggle('#toggle-storage-download', downloadEnabled);
        setToggle('#toggle-storage-delete', deleteEnabled);

        const executeBtn = genericDrawerBody.querySelector('#btn-storage-execute');
        if (executeBtn) {
            // Cần ít nhất 1 nguồn (3 checkbox độc lập có thể đều tắt) VÀ ít nhất 1 hành động.
            const anySource = sources.song || sources.video || sources.photo;
            const anyAction = downloadEnabled || deleteEnabled;
            executeBtn.disabled = !(anySource && anyAction);
            executeBtn.textContent = t('fileManager.song.storageAction.btnExecute');
        }
    },

    /** Ghép nhãn các nguồn đang bật thành 1 chuỗi hiển thị (vd "Songs, Photos") — DÙNG CHUNG bởi
     * askExecuteStorageAction()/_reportStorageActionResult().
     * @param {{song:boolean,video:boolean,photo:boolean}} sources
     * @returns {string}
     */
    _buildSourceLabel(sources) {
        const labels = [];
        if (sources.song) labels.push(t('storageDrawer.legendSongs'));
        if (sources.video) labels.push(t('storageDrawer.legendVideos'));
        if (sources.photo) labels.push(t('storageDrawer.legendPhotos'));
        return labels.join(', ');
    },

    /** Ứng với 'fileManagerStorage.storageExecute.click' — hỏi xác nhận trước, lời văn đổi theo
     * đúng tổ hợp downloadEnabled/deleteEnabled + danh sách nguồn đang bật.
     * @param {{sources: Object, downloadEnabled: boolean, deleteEnabled: boolean, onConfirmSend: function}} payload
     */
    askExecuteStorageAction(payload) {
        const { sources, downloadEnabled, deleteEnabled, onConfirmSend } = payload;
        if (!downloadEnabled && !deleteEnabled) return; // guard: nút lẽ ra đã disabled — phòng vệ thêm
        const scopeLabel = this._buildSourceLabel(sources);
        if (!scopeLabel) return; // guard: không nguồn nào được chọn — nút lẽ ra đã disabled

        const bodyKey = downloadEnabled && deleteEnabled ? 'fileManager.song.storageAction.confirmDownloadAndDelete'
            : downloadEnabled ? 'fileManager.song.storageAction.confirmDownloadOnly'
            : 'fileManager.song.storageAction.confirmDeleteOnly';
        modalChoice(
            tFormat(bodyKey, { scope: scopeLabel }),
            [
                { label: t(deleteEnabled ? 'fileManager.song.storageAction.confirmBtnDelete' : 'fileManager.song.storageAction.confirmBtnDownload'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: onConfirmSend }
            ],
            { title: t('fileManager.song.storageAction.confirmTitle') }
        );
    },

    /** DÙNG CHUNG bởi Song/Video/Photo — lấy toàn bộ key của loại media rồi zip + tải xuống (zipAndDownloadOrFallback()).
     * Không có gì để đóng gói -> 'noItems'.
     * @param {'song'|'video'|'photo'} mediaType
     * @param {() => Promise<string[]>} getKeysFn
     * @param {string} zipNamePrefix - đã dịch sẵn qua t(), dùng làm tên file
     * @returns {Promise<{status: 'ok'|'noItems'|'zipError'|'cancelled', message?: string}>}
     */
    async _downloadZipFor(mediaType, getKeysFn, zipNamePrefix) {
        const keys = await getKeysFn();
        if (keys.length === 0) return { status: 'noItems' }; // guard: không có gì để đóng gói

        const dateStr = new Date().toISOString().slice(0, 10);
        return this.zipAndDownloadOrFallback(mediaType, keys, `${zipNamePrefix}-${dateStr}.zip`);
    },

    /**
     * Zip + tải xuống 1 tập key — DÙNG CHUNG bởi `_downloadZipFor()` ngay trên (Storage Management) VÀ
     * `_downloadFolderZip()` (event/workflow/file-manager-folder-browser.js — "Folder Properties -> Download").
     * Gom entries (`workflowZipDownload.collectEntries()`) rồi giao `compressInParts()` + `deliver()`
     * (event/workflow/zip-download.js — zip stream qua OPFS, tự chia nhóm <= 500MB, tự dọn file tạm OPFS). Streaming
     * không khả dụng -> lỗi rơi vào `catch` báo 'zipError'. 'cancelled' khi CHƯA tải đủ mọi phần (bấm Huỷ/Xong sớm, huỷ
     * Share Sheet) — `_runStorageActionForSource()` chỉ xoá dữ liệu khi 'ok', nên không bao giờ xoá khi người dùng chưa
     * thật sự tải về.
     * @param {'song'|'video'|'photo'} mediaType
     * @param {string[]} keys
     * @param {string} zipFileName - tên file .zip ĐẦY ĐỦ (đã gồm ".zip") — có nhiều phần thì thêm hậu tố "-part{i}of{n}"
     * @returns {Promise<{status:'ok'|'zipError'|'cancelled', message?:string}>}
     */
    async zipAndDownloadOrFallback(mediaType, keys, zipFileName) {
        let zipParts;
        try {
            await withLoadingShield(t('common.storage.zippingStart'), async () => {
                const entries = await workflowZipDownload.collectEntries(mediaType, keys); // event/workflow/zip-download.js
                zipParts = await workflowZipDownload.compressInParts(entries, zipFileName); // event/workflow/zip-download.js
            });
        } catch (err) {
            console.error('[file-manager-storage] Lỗi đóng gói zip:', err);
            return { status: 'zipError', message: err && err.message ? err.message : String(err) };
        }
        // Không tải thẳng ở đây: user-activation của lượt bấm gốc đã hết hạn sau khi build zip (PWA sẽ mở Quick Look thay
        // vì tải) — modal của deliver() có nút "Tải xuống" tạo activation MỚI.
        const allDownloaded = await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS sau khi modal đóng
        const statusByAllDownloaded = { true: 'ok', false: 'cancelled' };
        return { status: statusByAllDownloaded[allDownloaded] };
    },

    /** Dọn RAM/UI sau khi xoá sạch Video: thoát Video Player mode nếu đang bật + rỗng hoá playlistCache/playlistOrder
     * nếu Playlist đang browse nguồn Video (không để danh sách hiện video đã xoá). */
    async _resetVideoRuntimeStateAfterClear() {
        if (appState.get('isVideoPlayerMode')) {
            await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js — Workflow gọi Workflow miền khác, tự do
        }
        if (appState.get('activeMediaSource') === 'video') {
            appState.set('playlistOrder', []);
            appState.mutate('playlistCache', (m) => m.clear());
            workflowPlaylistOrder.updateShuffleArray(); workflowPlaylistOrder.recomputeDisplayOrder(); workflowPlaylistOrder.recomputeRenderOrder(); workflowPlaylistRender.renderPlaylistDiff(); workflowPlaylistRender.syncEmptyState(); // event/workflow/playlist-order.js (tự đọc playlistOrder=[] vừa set) + playlist-render.js
        }
    },

    /** Cùng lý do `_resetVideoRuntimeStateAfterClear()` ngay trên — Playlist đang browse Nguồn Photo thì dọn sạch
     * playlistCache/playlistOrder NGAY. Photo không có bước thoát "player mode" ở đây (khác Video).
     */
    async _resetPhotoRuntimeStateAfterClear() {
        if (appState.get('activeMediaSource') === 'photo') {
            appState.set('playlistOrder', []);
            appState.mutate('playlistCache', (m) => m.clear());
            workflowPlaylistOrder.updateShuffleArray(); workflowPlaylistOrder.recomputeDisplayOrder(); workflowPlaylistOrder.recomputeRenderOrder(); workflowPlaylistRender.renderPlaylistDiff(); workflowPlaylistRender.syncEmptyState(); // event/workflow/playlist-order.js + playlist-render.js
        }
    },

    /** Chạy "tải xuống + xoá" (tuỳ 2 toggle) cho ĐÚNG 1 nguồn cụ thể — TÁCH riêng thành hàm con vì
     * mỗi nguồn cần gọi core hoàn toàn khác nhau (Rule 3: core không được gọi core khác — nhưng
     * Workflow thì tự do, hàm này chỉ là 1 bước orchestration nội bộ của executeStorageAction()
     * ngay dưới, KHÔNG phải rẽ nhánh Router/VirtualMachineState — 3 nguồn là tổ hợp BOOLEAN ĐỘC
     * LẬP, không phải 1 enum hữu hạn để so khớp qua VMState, xem docstring đầu file).
     * @param {'song'|'video'|'photo'} sourceKey
     * @param {boolean} downloadEnabled @param {boolean} deleteEnabled
     * @returns {Promise<{status: string, message?: string}>}
     */
    async _runStorageActionForSource(sourceKey, downloadEnabled, deleteEnabled) {
        // Chỉ xoá dữ liệu khi `status === 'ok'` (tải về THẬT SỰ thành công) — mọi status khác ('zipError', 'cancelled'...)
        // đều giữ dữ liệu, tránh mất dữ liệu khi chưa có bản sao.
        if (sourceKey === 'song') {
            const result = downloadEnabled
                ? await this._downloadZipFor('song', getAllSongKeys, t('fileManager.song.storageAction.zipNameSong'))
                : { status: 'ok' };
            if (deleteEnabled && result.status === 'ok') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await workflowFileManagerStorage.clearAllStoredData(); });
                await workflowFolder.clearAllItems(); // event/workflow/folder.js
                if (appState.get('activePlayListFolder').song) await workflowPlaylistScope.persistScopeChoice(null, 'song');
            }
            return result;
        }
        if (sourceKey === 'video') {
            const result = downloadEnabled
                ? await this._downloadZipFor('video', getAllVideoKeys, t('fileManager.song.storageAction.zipNameVideo'))
                : { status: 'ok' };
            if (deleteEnabled && result.status === 'ok') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllMediaOfType('video'); workflowListenStats.forgetType('video'); }); // service/db.js
                await this._resetVideoRuntimeStateAfterClear();
            }
            return result;
        }
        if (sourceKey === 'photo') {
            const result = downloadEnabled
                ? await this._downloadZipFor('photo', getAllImageKeys, t('storageDrawer.zipNamePhoto'))
                : { status: 'ok' };
            if (deleteEnabled && result.status === 'ok') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllMediaOfType('photo'); workflowListenStats.forgetType('photo'); }); // service/db.js
                await this._resetPhotoRuntimeStateAfterClear();
            }
            return result;
        }
        return { status: 'ok' }; // không thể xảy ra (nơi gọi chỉ truyền 3 giá trị hợp lệ) — phòng vệ thuần
    },

    /** Hiện 1 alert TỔNG KẾT, DÙNG CHUNG bất kể bao nhiêu nguồn (1-3) đang được chọn.
     * @param {Object} sources
     * @param {boolean} downloadEnabled @param {boolean} deleteEnabled
     * @param {Array<{status: string, message?: string}>} results
     */
    _reportStorageActionResult(sources, downloadEnabled, deleteEnabled, results) {
        const scopeLabel = this._buildSourceLabel(sources);
        const zipError = results.find((r) => r && r.status === 'zipError');
        if (downloadEnabled && zipError) {
            // Xoá đã bị BỎ QUA cho (các) nguồn lỗi zip (xem _runStorageActionForSource), báo rõ.
            alertModal(tFormat('fileManager.song.storageAction.zipErrorSkippedDelete', { message: escapeHtml(zipError.message) }));
            return;
        }
        // Có nguồn CHƯA tải đủ mọi phần ('cancelled') -> dữ liệu nguồn đó KHÔNG
        // bị xoá (xem _runStorageActionForSource), báo rõ thay vì báo "đã tải + xoá xong".
        const notAllDownloaded = results.some((r) => r && r.status === 'cancelled');
        if (downloadEnabled && deleteEnabled && notAllDownloaded) {
            alertModal(t('fileManager.song.storageAction.notAllDownloadedSkippedDelete'));
            return;
        }
        if (downloadEnabled && deleteEnabled) alertModal(tFormat('fileManager.song.storageAction.doneDownloadAndDelete', { scope: scopeLabel }));
        else if (downloadEnabled) alertModal(t('fileManager.song.storageAction.doneDownloadOnly'));
        else alertModal(tFormat('fileManager.song.storageAction.doneDeleteOnly', { scope: scopeLabel }));
    },

    /** Ứng với 'fileManagerStorage.storageExecute.confirm' — chạy tuần tự cho TỪNG nguồn đang bật
     * (LẶP, không phải VirtualMachineState — xem docstring đầu file), rồi vẽ lại tab + báo kết quả
     * GỘP 1 LẦN.
     * @param {Object} sources @param {boolean} downloadEnabled @param {boolean} deleteEnabled
     */
    async executeStorageAction(sources, downloadEnabled, deleteEnabled) {
        const results = [];
        if (sources.song) results.push(await this._runStorageActionForSource('song', downloadEnabled, deleteEnabled));
        if (sources.video) results.push(await this._runStorageActionForSource('video', downloadEnabled, deleteEnabled));
        if (sources.photo) results.push(await this._runStorageActionForSource('photo', downloadEnabled, deleteEnabled));
        await this.refreshTab();
        this._reportStorageActionResult(sources, downloadEnabled, deleteEnabled, results);
    },

    // ===================== Dọn file lỗi — tự hỏi phạm vi quét qua modal riêng =========================================

    /** Ứng với msg.type = 'fileManagerStorage.scanBroken.click' — mở modalChoice() với 1 `<select>` NHÚNG THẲNG vào phần
     * `text` (modalChoice() gán `innerHTML` — `<select>` là "phrasing content", hợp lệ nằm trong `<p>`) để người dùng tự
     * chọn phạm vi quét, tách biệt khỏi 3 toggle nguồn của "Chọn mục xoá" (tránh nhầm/quên đang bật gì ở đó). Nút "Huỷ"
     * không làm gì; nút "Thực hiện" đọc `select.value` lúc bấm
     * (đọc SAU khi modalChoice() đã đóng + `overlay.remove()` khỏi DOM — vẫn đọc được `.value` bình
     * thường vì gỡ khỏi cây DOM KHÔNG xoá state nội bộ của phần tử `<select>`, chỉ mất kết nối hiển
     * thị) rồi gửi tiếp `onConfirmSend(scope)`.
     * @param {{onConfirmSend: (scope: 'all'|'song'|'video'|'photo') => void}} payload
     */
    askScanBrokenScope(payload) {
        const { onConfirmSend } = payload;
        const bodyHtml = `${t('storageDrawer.scanBroken.modalBody')}
<select id="modal-scan-scope" class="mt-3 w-full rounded-lg px-3 py-2.5 text-sm outline-none" data-uitk="inputBg inputBorder inputText">
    <option value="all">${t('storageDrawer.scanBroken.scopeAll')}</option>
    <option value="song">${t('storageDrawer.legendSongs')}</option>
    <option value="video">${t('storageDrawer.legendVideos')}</option>
    <option value="photo">${t('storageDrawer.legendPhotos')}</option>
</select>`;
        modalChoice(
            bodyHtml,
            [
                { label: t('fileManager.song.storageAction.btnExecute'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnCautionBg btnCautionHoverBg textOnAccent', onClick: () => onConfirmSend(selectEl.value) }
            ],
            { title: t('storageDrawer.scanBroken.label') }
        );
        // Lấy ref NGAY SAU khi modalChoice() đã gắn DOM (đồng bộ, xong trước khi hàm này return) —
        // KHÔNG khai báo trước lời gọi modalChoice() được vì lúc đó <select> CHƯA tồn tại trong
        // DOM. Nút "Thực hiện" ở trên chỉ THỰC SỰ đọc `selectEl.value` lúc người dùng bấm (sau khi
        // dòng này đã chạy xong từ lâu) nên thứ tự khai báo KHÔNG gây lỗi.
        const selectEl = document.getElementById('modal-scan-scope');
    },

    /** Quy đổi 1 giá trị dropdown ('all'|'song'|'video'|'photo') thành object 3 nguồn
     * ĐÚNG shape mà `executeScanBroken()` cần — DÙNG CHUNG được với `executeScanBroken()` không đổi
     * gì (hàm đó vốn đã nhận `sources` dạng object, không quan tâm object đó tới từ 3 checkbox hay
     * 1 dropdown).
     * @param {string} scope
     * @returns {{song:boolean,video:boolean,photo:boolean}}
     */
    _scopeToSources(scope) {
        if (scope === 'all') return { song: true, video: true, photo: true };
        return { song: scope === 'song', video: scope === 'video', photo: scope === 'photo' };
    },

    /** Ứng với msg.type = 'fileManagerStorage.fixBroken.click' — modal xác nhận, đọc trước xem lô có gì để chọn ĐÚNG nội
     * dung/màu nút (`fixable: true` = Video thiếu thumb nhưng blob chính vẫn đọc được, xem `isVideoRecordCorrupted()`):
     *   - Chỉ có phần tử `fixable:false` (Song/Photo luôn rơi vào đây) -> modal xoá.
     *   - Có ÍT NHẤT 1 phần tử `fixable:true` -> modal "Sửa file lỗi", nội dung tuỳ còn phần `fixable:false` hay không
     *     (kết hợp cả xoá+sửa hay chỉ sửa).
     * @param {{scanResults: Array, onConfirmSend: function}} payload
     */
    askFixBroken(payload) {
        const { scanResults, onConfirmSend } = payload;
        const brokenResults = scanResults.filter((r) => !r.fixable);
        const fixableResults = scanResults.filter((r) => r.fixable);
        let bodyText, title, btnLabel, destructive;
        if (fixableResults.length === 0) {
            // Không có gì "sửa" được — modal xoá.
            bodyText = tFormat('common.storage.deleteBrokenConfirm', { n: brokenResults.length });
            title = t('common.storage.deleteBrokenTitle');
            btnLabel = t('common.storage.deleteBrokenConfirmBtn');
            destructive = true;
        } else if (brokenResults.length === 0) {
            bodyText = tFormat('common.storage.fixBrokenConfirmOnlyFixable', { n: fixableResults.length });
            title = t('common.storage.fixBrokenTitle');
            btnLabel = t('common.storage.fixBrokenConfirmBtn');
            destructive = false; // thuần tạo lại thumb, không xoá gì -> KHÔNG cần màu nút "destructive"
        } else {
            bodyText = tFormat('common.storage.fixBrokenConfirmBoth', { broken: brokenResults.length, fixable: fixableResults.length });
            title = t('common.storage.fixBrokenTitle');
            btnLabel = t('common.storage.fixBrokenConfirmBtn');
            destructive = true; // có phần xoá thật trong lô -> vẫn cảnh báo màu destructive
        }
        modalChoice(
            bodyText,
            [
                { label: btnLabel, className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: destructive ? 'btnDestructiveBg btnDestructiveHoverBg textOnAccent' : 'btnCautionBg btnCautionHoverBg textOnAccent', onClick: onConfirmSend }
            ],
            { title }
        );
    },

    /** Ứng với msg.type = 'fileManagerStorage.fixBroken.confirm', NHÁNH XOÁ — Router
     * (`VirtualMachineState.run()`) đã tự lọc `scanResults` chỉ còn phần tử `fixable:false` TRƯỚC
     * khi gọi hàm này (xem event/router/file-manager-storage.js). `scanResults` có thể chứa CẢ 3 mediaType (song/video/photo, gắn sẵn ở executeScanBroken()) — tách theo
     * mediaType, xoá ĐÚNG store cho từng phần. Song/Photo LUÔN rơi hết vào đây (chưa có khái niệm
     * `fixable`); Video chỉ còn phần thật sự hỏng blob chính.
     * @param {{scanResults: Array, currentKey: string|null}} payload
     */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;
        if (scanResults.length === 0) return;
        const { song: songResults, video: videoResults, photo: photoResults } = groupBrokenResultsByType(scanResults); // core/storage-manager.js

        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            if (songResults.length > 0) {
                const deletedSongKeys = await this._deleteBrokenOfType('song', songResults, currentKey);
                deletedSongKeys.forEach((key) => workflowPlaylistOrder.removeKeyFromDisplay(key)); // event/workflow/playlist-order.js
            }
            if (videoResults.length > 0) {
                const deletedVideoKeys = await this._deleteBrokenOfType('video', videoResults, currentKey);
                deletedVideoKeys.forEach((key) => workflowPlaylistOrder.removeKeyFromDisplay(key)); // event/workflow/playlist-order.js
            }
            if (photoResults.length > 0) {
                await this._deleteBrokenOfType('photo', photoResults, null);
            }
            if (!genericDrawerPanel.classList.contains('hidden')) {
                resetScanResultUI(
                    genericDrawerBody.querySelector('#storage-scan-result'),
                    genericDrawerBody.querySelector('#storage-scan-list')
                );
                await this.refreshTab();
            }
        });

        await alertModal(t('common.storage.deleteBrokenDone'));
    },

    /** Xoá các media hỏng của 1 loại (trừ `skipKey` = media đang phát): gỡ khỏi mọi folder TRƯỚC (không để key "ma" trong
     * folder_song — upload lại cùng tên sẽ bị nhân đôi trong folder), rồi xoá record.
     * @returns {Promise<string[]>} key đã xoá */
    async _deleteBrokenOfType(mediaType, results, skipKey) {
        await workflowFolder.removeKeysFromAllFolders(mediaType, pickDeletableBrokenKeys(results, skipKey)); // core/storage-manager.js + event/workflow/folder.js
        return deleteCorruptedMediaRecords(mediaType, results, skipKey); // core/storage-manager.js
    },

    /** Ứng với msg.type = 'fileManagerStorage.fixBroken.confirm', NHÁNH SỬA.
     * Router đã lọc `scanResults` chỉ còn phần tử `fixable:true` (LUÔN là Video — Song/Photo chưa
     * có khái niệm `fixable`, xem `isVideoRecordCorrupted()` core/storage-manager.js) TRƯỚC khi gọi
     * hàm này. KHÔNG xoá record nào — đọc lại `record.blob` (vẫn đọc/phát được, đã xác nhận lúc
     * quét), chụp lại thumb qua `workflowPlaylist.extractVideoThumbAndMeta()` (Workflow gọi
     * Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B — TÁI DÙNG NGUYÊN pipeline capture
     * lúc upload, không viết lại thuật toán), rồi ghi xuống qua `setVideoThumbnails()` (core/
     * file-manager/video.js, CRUD thuần). Nếu NGAY LÚC chụp lại mà `record.blob` hoá ra KHÔNG đọc
     * được nữa (hiếm — dữ liệu đổi khác giữa lúc quét và lúc sửa) -> coi là sửa thất bại cho video
     * đó (KHÔNG tự ý xoá — xoá là hành động cần xác nhận riêng, không phải side-effect ngầm của 1
     * lượt sửa lỗi), gộp vào số đếm `failed` báo cuối, khuyến nghị người dùng tự quét lại.
     * @param {Array<{key:string}>} scanResults
     */
    async executeRepairBroken(scanResults) {
        if (scanResults.length === 0) return;
        let fixedCount = 0;
        let failedCount = 0;
        await withLoadingShield(t('common.storage.repairing'), async () => {
            for (let i = 0; i < scanResults.length; i++) {
                const { key } = scanResults[i];
                loadingText.textContent = tFormat('common.storage.repairingProgress', { n: i + 1, total: scanResults.length });
                const record = await getVideoRecord(key); // service/db.js
                if (!record || !record.blob) { failedCount++; continue; }
                try {
                    const { thumbBlob, thumbFullBlob, thumbFullIsBlack } = await workflowPlaylist.extractVideoThumbAndMeta(record.blob); // event/workflow/playlist.js
                    await setVideoThumbnails(key, thumbBlob, thumbFullBlob, thumbFullIsBlack); // core/file-manager/video.js — thumbFullIsBlack: đen THẬT -> scan lần sau bỏ qua
                    // Báo request trung tâm (plan-media-db-split.md mục 7): video này đang dùng thì tự làm tươi ảnh.
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'video', key } });
                    fixedCount++;
                } catch (err) {
                    console.error(`[executeRepairBroken] tạo lại thumbnail thất bại cho video "${key}":`, err);
                    failedCount++;
                }
            }
            if (!genericDrawerPanel.classList.contains('hidden')) {
                resetScanResultUI( // màn Troubleshooting > Scan & fix video thumbnails (id `video-thumb-*`)
                    genericDrawerBody.querySelector('#video-thumb-scan-result'),
                    genericDrawerBody.querySelector('#video-thumb-scan-list')
                );
            }
        });

        if (failedCount > 0) {
            await alertModal(tFormat('common.storage.repairSomeFailed', { fixed: fixedCount, failed: failedCount }));
        } else {
            await alertModal(tFormat('common.storage.repairDone', { n: fixedCount }));
        }
    },

    /** Ứng với msg.type = 'fileManagerStorage.scanBroken.confirm' — `payload.sources` tới từ dropdown của
     * askScanBrokenScope() (qua `_scopeToSources()`) — quét TUẦN TỰ từng nguồn đang bật (KHÔNG VMState, cùng lý do
     * executeStorageAction() — tổ hợp boolean độc lập, không phải enum). Mỗi kết quả gắn thêm `mediaType` —
     * executeDeleteBroken() cần biết để xoá ĐÚNG store.
     * @param {{sources: Object, onScanComplete: (results: Array) => void}} payload
     */
    async executeScanBroken(payload) {
        const { sources, onScanComplete } = payload;
        let results = [];
        await withLoadingShield(t('common.storage.scanning'), async () => {
            const onScanProgress = (current, total) => {
                loadingText.textContent = tFormat('common.storage.scanningProgress', { n: current, total });
            };
            if (sources.song) results = results.concat((await scanAllSongsForCorruption(onScanProgress)).map((r) => ({ ...r, mediaType: 'song' })));
            if (sources.video) {
                // Storage CHỈ báo video hỏng THẬT (blob chính không đọc/decode được -> `fixable:false`, xoá được); phần
                // thiếu/đen/không decode thumb (`fixable:true`) thuộc Settings > Troubleshooting > "Scan & fix video
                // thumbnails" (`executeScanVideoThumbs()`).
                const videoScanResults = (await scanAllVideosForCorruption(onScanProgress)).filter((r) => !r.fixable); // core/storage-manager.js
                results = results.concat(videoScanResults.map((r) => ({ ...r, mediaType: 'video' })));
            }
            if (sources.photo) results = results.concat((await scanAllPhotosForCorruption(onScanProgress)).map((r) => ({ ...r, mediaType: 'photo' })));

            if (!genericDrawerPanel.classList.contains('hidden')) {
                renderScanResultUI( // core/storage-manager.js
                    results,
                    genericDrawerBody.querySelector('#storage-scan-result'),
                    genericDrawerBody.querySelector('#storage-scan-summary'),
                    genericDrawerBody.querySelector('#storage-scan-list'),
                    genericDrawerBody.querySelector('#btn-storage-fix-broken')
                );
            }
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** Lượt quét thứ 2 của Video: thumb full-res ĐÃ CÓ trong record nhưng ĐEN (hoặc không decode được).
     * `isVideoRecordCorrupted()` (core/storage-manager.js) chỉ kiểm tra thumb CÓ TỒN TẠI, không nhìn pixel — thumb chụp
     * lúc khung chưa sẵn sàng (JPEG đen) vì vậy lọt qua lượt quét đó.
     * Bỏ qua: video đã có kết quả từ lượt quét core (không chồng 2 lý do cho cùng 1 video), record thiếu
     * blob/thumb (lượt core lo), và record có `thumbFullBlack === true` (đã chụp lại đúng cách vẫn đen =
     * đen THẬT của nội dung — không báo lỗi lặp vô tận sau khi sửa). Kết quả LUÔN `fixable:true` — "sửa"
     * = chụp lại thumb qua `executeRepairBroken()` (cùng pipeline lúc upload).
     * @param {Array<{key:string}>} alreadyFlagged - kết quả `scanAllVideosForCorruption()`.
     * @param {(current:number, total:number) => void} [onScanProgress]
     * @returns {Promise<Array<{key:string, filename:string, reason:string, fixable:boolean}>>}
     */
    async _scanBlackVideoThumbs(alreadyFlagged, onScanProgress) {
        const flaggedKeys = new Set(alreadyFlagged.map((r) => r.key));
        const keys = await getAllVideoKeys(); // service/db.js
        const found = [];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (onScanProgress) onScanProgress(i + 1, keys.length);
            if (flaggedKeys.has(key)) continue;
            const record = await getVideoRecord(key); // service/db.js
            if (!record || !record.blob || !record.thumbFullBlob || record.thumbFullBlack === true) continue;
            const verdict = await this._classifyThumbBlob(record.thumbFullBlob);
            if (verdict === 'black') found.push({ key, filename: record.filename || key, reason: t('common.storage.scanReasonBlackThumbFull'), fixable: true });
            else if (verdict === 'undecodable') found.push({ key, filename: record.filename || key, reason: t('common.storage.scanReasonUndecodableThumbFull'), fixable: true });
        }
        return found;
    },

    /** Decode 1 blob ảnh thumb rồi đo bằng ĐÚNG hàm đo lúc upload (`workflowPlaylist._probeVideoFrame()`,
     * cùng ngưỡng đen — Workflow gọi Workflow miền khác, TỰ DO). Ảnh được giải phóng ngay (không giữ
     * decode full-res trong bộ nhớ qua cả lượt quét).
     * @param {Blob} blob
     * @returns {Promise<'ok'|'black'|'undecodable'>} */
    async _classifyThumbBlob(blob) {
        const url = URL.createObjectURL(blob);
        const img = await decodeImageFromUrl(url); // core/image-load-ui.js
        try {
            if (!img) return 'undecodable';
            const probe = workflowPlaylist._probeVideoFrame(img); // event/workflow/playlist.js
            if (!probe.drawn) return 'undecodable';
            return probe.isBlack ? 'black' : 'ok';
        } catch (err) {
            return 'undecodable';
        } finally {
            releaseDecodedImage(img); // core/image-load-ui.js
            try { URL.revokeObjectURL(url); } catch (e) {}
        }
    },

    /** Settings > Troubleshooting > "Scan & fix video thumbnails" — ứng với msg.type =
     * 'fileManagerStorage.videoThumb.scan.click'. CHỈ quét
     * Video, CHỈ báo phần thumb (`fixable:true`): thiếu thumb cover/full-res (lượt quét core
     * `scanAllVideosForCorruption()`, lọc lại `fixable`) + thumb full-res ĐEN/không decode được
     * (`_scanBlackVideoThumbs()`). Video hỏng THẬT (blob chính) KHÔNG báo ở đây — đó là việc của "Scan & clean broken
     * files" ở Storage. Sửa = `executeRepairBroken()` (chụp lại thumb, không xoá gì). Hiển thị vào khối `#video-thumb-scan-*` của màn Troubleshooting
     * (components/settings/troubleshooting.js::renderVideoThumbRepairBody()).
     * @param {{onScanComplete: (results: Array) => void}} payload */
    async executeScanVideoThumbs(payload) {
        const { onScanComplete } = payload;
        let results = [];
        await withLoadingShield(t('common.storage.scanning'), async () => {
            const onScanProgress = (current, total) => {
                loadingText.textContent = tFormat('common.storage.scanningProgress', { n: current, total });
            };
            const coreResults = await scanAllVideosForCorruption(onScanProgress); // core/storage-manager.js
            const missingThumbResults = coreResults.filter((r) => r.fixable);
            const blackThumbResults = await this._scanBlackVideoThumbs(coreResults, onScanProgress); // bỏ qua mọi video đã bị core gắn cờ (kể cả hỏng thật)
            results = missingThumbResults.concat(blackThumbResults).map((r) => ({ ...r, mediaType: 'video' }));
            if (!genericDrawerPanel.classList.contains('hidden')) {
                renderScanResultUI( // core/storage-manager.js
                    results,
                    genericDrawerBody.querySelector('#video-thumb-scan-result'),
                    genericDrawerBody.querySelector('#video-thumb-scan-summary'),
                    genericDrawerBody.querySelector('#video-thumb-scan-list'),
                    genericDrawerBody.querySelector('#btn-video-thumb-fix')
                );
            }
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** Ứng với msg.type = 'fileManagerStorage.videoThumb.dismiss.click'. */
    dismissVideoThumbScan() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        resetScanResultUI(
            genericDrawerBody.querySelector('#video-thumb-scan-result'),
            genericDrawerBody.querySelector('#video-thumb-scan-list')
        );
    },

    /** Ứng với msg.type = 'fileManagerStorage.dismissScan.click'. */
    dismissScan() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        resetScanResultUI(
            genericDrawerBody.querySelector('#storage-scan-result'),
            genericDrawerBody.querySelector('#storage-scan-list')
        );
    }
};
