/**
 * event/workflow/file-manager-storage.js — MỚI (29/07/2026, yêu cầu Giang). "THẰNG THỰC THI CUỐI"
 * của router "fileManagerStorage" — THAY HẲN event/workflow/file-manager-song.js đã xoá.
 *
 * Panel "Quản lý lưu trữ" (storageDrawer.title) giờ gộp CẢ 3 domain (Song/Video/Photo) — KHÔNG
 * còn là "panel Song & Video kèm thống kê" như trước:
 *   - Thống kê dung lượng: `computeStats()`/`computeVideoStats()`/`computeImageStats()` (3 core
 *     khác nhau, chạy song song) -> `renderStorageStats()` (core/storage-manager.js, ĐÃ viết lại
 *     nhận đủ 3 stats).
 *   - "Chọn mục xoá": 3 toggle nguồn ĐỘC LẬP (song/video/photo, không loại trừ nhau) THAY
 *     `<select>` phạm vi cũ — router (event/router/file-manager-storage.js) giữ closure
 *     `{song,video,photo}` (KHÔNG còn 1 enum 'song'|'video'|'both'). Vì đây là tổ hợp
 *     BOOLEAN ĐỘC LẬP (2^3 khả năng, KHÔNG phải 1 giá trị enum hữu hạn để VirtualMachineState so
 *     khớp), Router KHÔNG dùng VMState ở bước thực thi — gọi THẲNG 1 method DUY NHẤT
 *     (`executeStorageAction()`), method đó tự LẶP qua từng nguồn đang bật, gọi core tương ứng —
 *     ĐÚNG tinh thần Workflow "orchestrate nhiều bước", cùng khuôn `executeStorageActionBoth()` cũ
 *     (đã tự xử lý 2 domain tuần tự trong 1 method, không cần VMState nội bộ) — chỉ tổng quát hoá
 *     từ "2 domain cố định" lên "N domain bất kỳ trong tập 3".
 *   - "Dọn file lỗi" DÙNG CHUNG đúng 3 toggle nguồn trên để biết quét kho nào.
 *   - "Dọn dẹp dữ liệu" (registry fileManagerCleanup) KHÔNG thuộc file/router này — chỉ ĐỔI NƠI
 *     listener wiring (xem event/listener/file-manager-storage.js), router/workflow/core cleanup
 *     GIỮ NGUYÊN 100%.
 *
 * QUY TẮC: giống hệt event/workflow/playlist.js — chuỗi gọi hàm core thuần, withLoadingShield()/
 * alertModal()/modalChoice() CHỈ đặt ở tầng này.
 *
 * NẠP SAU: core/storage-manager.js, core/about-stats.js, core/file-manager/video.js, core/file-
 * manager/image.js, core/generic-drawer.js, event/workflow/
 * generic-drawer-helpers.js, event/workflow/app-panel-nav.js.
 * NẠP TRƯỚC: event/router/file-manager-storage.js, event/listener/file-manager-storage.js.
 *
 * SỬA (đợt tái cấu trúc bottom nav App Panel, phản hồi Giang — "Storage mở trực tiếp") — panel
 * "Quản lý lưu trữ" KHÔNG còn PUSH vào `#drawer-settings` cũ (đã xoá hẳn) — giờ mở THẲNG qua
 * core/generic-drawer.js (singleton chung, cùng khuôn Folder browser, event/workflow/
 * file-manager-folder-browser.js). Mọi `genericDrawerBody.querySelector(...)` đổi cơ giới
 * sang `genericDrawerBody.querySelector(...)` — Storage KHÔNG có sub-panel lồng bên trong (khác
 * Photo), nên KHÔNG có xung đột singleton nào cần xử lý thêm.
 */
// SỬA (đợt tái cấu trúc bottom nav App Panel) — `fileManagerStoragePanelEl` KHÔNG còn ý nghĩa
// (Storage giờ dùng `genericDrawerBody`, phần tử TĨNH luôn tồn tại) — dùng
// `genericDrawerPanel.classList.contains('hidden')` để biết đang mở/đóng, xem các guard bên dưới.

const workflowFileManagerStorage = {

    /** Ứng với 'fileManagerStorage.openPanel.click'. Mở Generic Drawer "Quản lý lưu trữ" — cùng
     * khuôn `workflowFileManagerFolderBrowser._renderList()` (header title + nút X). */
    async openPanel() {
        openGenericDrawer({ // core/generic-drawer.js
            height: 'auto', // MỚI (phản hồi Giang mục 2) — tự co theo nội dung, xem core/generic-drawer.js
            maxHeight: '85vh',
            headerHtml: `
                <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                    <h3 class="text-base font-bold text-slate-900">${t('storageDrawer.title')}</h3>
                    <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            `,
            // SỬA (phản hồi Giang mục 2 — "styling lỗi, cụm bị co vào nhau, theo theme setting/custom
            // effect") — GỐC BỆNH: renderFileManagerStorageManagementPanelBody() (components/file-
            // manager-storage.js) viết bằng bảng màu TỐI (text-white/text-slate-300/.glass-modal/
            // border-white/bg-white/[0.03] — vốn dành cho nền TỐI của Visualizer) nhưng Generic
            // Drawer LUÔN nền TRẮNG cố định (loại trừ theme, xem core/generic-drawer.js) — chữ trắng
            // trên nền trắng gần như vô hình, ĐÚNG hiện tượng "các cụm bị co vào nhau"/nhoè trong ảnh
            // Giang gửi (không phải lỗi spacing thật, là lỗi TƯƠNG PHẢN). `.glass-modal` còn có
            // `backdrop-filter: blur(24px)` (thiết kế để làm mờ Visualizer PHÍA SAU) — trên Generic
            // Drawer chỉ còn làm mờ chính nền trắng của panel, không có tác dụng, VÀ tạo 1 stacking
            // context riêng (CSS spec) — nhiều khả năng CHÍNH LÀ nguyên nhân nút X không ấn được
            // (WebKit/iOS có nhiều bug đã biết về backdrop-filter chồng lấn hit-test trong bottom
            // sheet). SỬA: bọc `.app-settings-scope` — ĐÚNG kỹ thuật event/workflow/app-settings.js
            // đã dùng cho CHÍNH bug này ở Settings (xem assets/css/layout-nav.css, "phản hồi Giang
            // mục 3") — đè toàn bộ class tối kể trên sang sáng, khớp CHÍNH XÁC bảng màu Custom
            // Effect/EQ, KHÔNG cần viết CSS mới. `p-4` DỜI vào wrapper này (khỏi bodyClass) — ĐÚNG
            // quy ước Settings (bodyClass CHỈ còn overflow-y-auto, không tự có padding).
            bodyHtml: `<div class="app-settings-scope p-4">${renderFileManagerStorageManagementPanelBody()}</div>`,
            bodyClass: 'overflow-y-auto',
        });
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.closePanel.click', payload: {} }));

        workflowAppPanelNav.setActiveTab('storage'); // event/workflow/app-panel-nav.js — liên tuyến domain
        await this.refreshTab();
        // Đồng bộ UI về mặc định an toàn (Router vừa reset closure state ở case 'openPanel.click').
        this.updateStorageActionUI({ song: false, video: false, photo: false }, false, false);
    },

    /** Ứng với 'fileManagerStorage.closePanel.click' — MỚI (đợt tái cấu trúc bottom nav). */
    closePanel() {
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        workflowAppPanelNav.activateMedia(); // event/workflow/app-panel-nav.js
    },

    /** Vẽ lại thống kê dung lượng (3 domain) + reset UI quét lỗi — gọi lúc mở panel/sau khi
     * xoá xong. */
    async refreshTab() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // panel đã đóng — an toàn bỏ qua

        const [songStats, videoStats, photoStats] = await Promise.all([
            computeStats(), computeVideoStats(), computeImageStats()
        ]); // core/about-stats.js, core/file-manager/video.js, core/file-manager/image.js
        renderStorageStats( // core/storage-manager.js
            songStats, videoStats, photoStats,
            {
                totalBytesEl: genericDrawerBody.querySelector('#stat-storage-total-bytes'),
                barSongsEl: genericDrawerBody.querySelector('#stat-storage-bar-songs'),
                barVideosEl: genericDrawerBody.querySelector('#stat-storage-bar-videos'),
                barPhotosEl: genericDrawerBody.querySelector('#stat-storage-bar-photos'),
                countSongsEl: genericDrawerBody.querySelector('#stat-storage-count-song'),
                countVideosEl: genericDrawerBody.querySelector('#stat-storage-count-video'),
                countPhotosEl: genericDrawerBody.querySelector('#stat-storage-count-photo'),
            }
        );
        resetScanResultUI( // core/storage-manager.js
            genericDrawerBody.querySelector('#storage-scan-result'),
            genericDrawerBody.querySelector('#storage-scan-list')
        );
    },

    /** Ứng với 'fileManagerStorage.storageBarSegment.click' — MỚI (29/07/2026, yêu cầu Giang mục 2
     * — "thêm phần số dung lượng khi ấn vào mỗi phần của thanh dung lượng") — hiện `alertModal()`
     * với ĐÚNG số byte của đoạn vừa ấn (đọc từ `dataset.bytes`, gắn sẵn lúc `renderStorageStats()`
     * vẽ lại thanh — core/storage-manager.js). `legendKey` là 1 trong 3 key
     * `storageDrawer.legend{Songs,Videos,Photos}` (TÁI DÙNG NGUYÊN — không cần label
     * riêng cho việc này).
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
            // MỚI — thêm điều kiện "có ít nhất 1 nguồn được chọn" (select cũ LUÔN có đúng 1 giá trị
            // nên không cần kiểm tra riêng; 3 checkbox độc lập giờ CÓ THỂ đều tắt hết).
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
                { label: t(deleteEnabled ? 'fileManager.song.storageAction.confirmBtnDelete' : 'fileManager.song.storageAction.confirmBtnDownload'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('fileManager.song.storageAction.confirmTitle') }
        );
    },

    /** DÙNG CHUNG bởi Song/Video/Photo — build zip (nếu có gì để đóng gói) rồi tải xuống ngay.
     * @param {() => Promise<string[]>} getKeysFn
     * @param {(onProgress: function) => Promise<Blob>} buildZipFn
     * @param {string} zipNamePrefix - đã dịch sẵn qua t(), dùng làm tên file
     * @returns {Promise<{status: 'ok'|'noItems'|'zipError', message?: string}>}
     */
    async _downloadZipFor(getKeysFn, buildZipFn, zipNamePrefix) {
        const keys = await getKeysFn();
        if (keys.length === 0) return { status: 'noItems' }; // guard: không có gì để đóng gói

        let zipBlob;
        try {
            await withLoadingShield(t('common.storage.zippingStart'), async () => {
                zipBlob = await buildZipFn((done, total, percent) => {
                    const pct = percent != null ? Math.round(percent) : Math.round((done / total) * 100);
                    loadingText.textContent = tFormat('common.storage.zippingProgress', { percent: pct });
                });
            });
        } catch (err) {
            console.error('[file-manager-storage] Lỗi đóng gói zip:', err);
            return { status: 'zipError', message: err && err.message ? err.message : String(err) };
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(zipBlob, `${zipNamePrefix}-${dateStr}.zip`); // core/id3-export.js
        return { status: 'ok' };
    },

    /** Dọn RAM/UI sau khi xoá sạch Video (thoát Video Player mode nếu đang bật + rỗng hoá
     * playlistCache/playlistOrder nếu Playlist đang browse nguồn Video) — GIỮ NGUYÊN 100% từ
     * event/workflow/file-manager-song.js (đã xoá) — xem giải thích đầy đủ ở core/storage-
     * manager.js::clearAllVideosData(). */
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

    /** MỚI (hợp nhất Photo vào Playlist) — cùng lý do `_resetVideoRuntimeStateAfterClear()` ngay
     * trên: Photo giờ CŨNG là 1 Nguồn của Playlist (activeMediaSource='photo') — xoá sạch Photo
     * qua Storage Management trong khi Playlist đang browse ĐÚNG Nguồn đó phải dọn sạch
     * playlistCache/playlistOrder NGAY, không để danh sách hiện ảnh đã xoá. Photo KHÔNG có
     * "player mode" riêng để thoát (khác Video) nên bước đó bỏ qua.
     */
    async _resetPhotoRuntimeStateAfterClear() {
        if (appState.get('activeMediaSource') === 'photo') {
            appState.set('playlistOrder', []);
            appState.mutate('playlistCache', (m) => m.clear());
            updateShuffleArray(); recomputeDisplayOrder(); recomputeRenderOrder(); renderPlaylistDiff(); updateEmptyState(); // core/playlist/*, có sẵn
        }
    },

    /** Chạy "tải xuống + xoá" (tuỳ 2 toggle) cho ĐÚNG 1 nguồn cụ thể — TÁCH riêng thành hàm con vì
     * mỗi nguồn cần gọi core hoàn toàn khác nhau (Rule 3: core không được gọi core khác — nhưng
     * Workflow thì tự do, hàm này chỉ là 1 bước orchestration nội bộ của executeStorageAction()
     * ngay dưới, KHÔNG phải rẽ nhánh Router/VirtualMachineState — 4 nguồn là tổ hợp BOOLEAN ĐỘC
     * LẬP, không phải 1 enum hữu hạn để so khớp qua VMState, xem docstring đầu file).
     * @param {'song'|'video'|'photo'} sourceKey
     * @param {boolean} downloadEnabled @param {boolean} deleteEnabled
     * @returns {Promise<{status: string, message?: string}>}
     */
    async _runStorageActionForSource(sourceKey, downloadEnabled, deleteEnabled) {
        if (sourceKey === 'song') {
            const result = downloadEnabled
                ? await this._downloadZipFor(getAllSongKeys, buildAllSongsZipBlob, t('fileManager.song.storageAction.zipNameSong'))
                : { status: 'ok' };
            if (deleteEnabled && result.status !== 'zipError') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllStoredData(); }); // core/storage-manager.js (Song, GIỮ NGUYÊN 100%)
                await clearAllFolderSongData(); // core/file-manager/folder.js
                if (appState.get('activePlayListFolder')) await workflowPlaylistScope.persistScopeChoice(null);
            }
            return result;
        }
        if (sourceKey === 'video') {
            const result = downloadEnabled
                ? await this._downloadZipFor(getAllVideoKeys, buildAllVideosZipBlob, t('fileManager.song.storageAction.zipNameVideo'))
                : { status: 'ok' };
            if (deleteEnabled && result.status !== 'zipError') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllVideosData(); }); // core/storage-manager.js
                await this._resetVideoRuntimeStateAfterClear();
            }
            return result;
        }
        if (sourceKey === 'photo') {
            const result = downloadEnabled
                ? await this._downloadZipFor(getAllImageKeys, buildAllPhotosZipBlob, t('storageDrawer.zipNamePhoto'))
                : { status: 'ok' };
            if (deleteEnabled && result.status !== 'zipError') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllPhotosData(); }); // core/storage-manager.js
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

    // ===================== Dọn file lỗi — tự hỏi phạm vi quét qua modal riêng (KHÔNG còn dùng
    // chung 4 toggle nguồn của "Delete & Backup" nữa) =========================================

    /** Ứng với msg.type = 'fileManagerStorage.scanBroken.click' — MỚI (29/07/2026, yêu cầu Giang,
     * THAY hẳn cách cũ dùng chung `storageSources` của "Delete & Backup") — mở modalChoice() với 1
     * `<select>` (dropdown) NHÚNG THẲNG vào phần `text` (modalChoice() gán `innerHTML`, xem
     * core/modal-choice-ui.js — `<select>` là "phrasing content", hợp lệ nằm trong `<p>`) để người
     * dùng tự chọn phạm vi quét, tách BIỆT hẳn khỏi lựa chọn nguồn ở "Delete & Backup" (tránh nhầm/
     * quên đang bật gì ở đó). Nút "Huỷ" không làm gì; nút "Thực hiện" đọc `select.value` lúc bấm
     * (đọc SAU khi modalChoice() đã đóng + `overlay.remove()` khỏi DOM — vẫn đọc được `.value` bình
     * thường vì gỡ khỏi cây DOM KHÔNG xoá state nội bộ của phần tử `<select>`, chỉ mất kết nối hiển
     * thị) rồi gửi tiếp `onConfirmSend(scope)`.
     * @param {{onConfirmSend: (scope: 'all'|'song'|'video'|'photo') => void}} payload
     */
    askScanBrokenScope(payload) {
        const { onConfirmSend } = payload;
        const bodyHtml = `${t('storageDrawer.scanBroken.modalBody')}
<select id="modal-scan-scope" class="mt-3 w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none">
    <option value="all">${t('storageDrawer.scanBroken.scopeAll')}</option>
    <option value="song">${t('storageDrawer.legendSongs')}</option>
    <option value="video">${t('storageDrawer.legendVideos')}</option>
    <option value="photo">${t('storageDrawer.legendPhotos')}</option>
</select>`;
        modalChoice(
            bodyHtml,
            [
                { label: t('fileManager.song.storageAction.btnExecute'), className: 'flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-semibold transition-colors', onClick: () => onConfirmSend(selectEl.value) }
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

    /** Ứng với msg.type = 'fileManagerStorage.deleteBroken.click'.
     * @param {{scanResults: Array, onConfirmSend: function}} payload
     */
    askDeleteBroken(payload) {
        const { scanResults, onConfirmSend } = payload;
        modalChoice(
            tFormat('common.storage.deleteBrokenConfirm', { n: scanResults.length }),
            [
                { label: t('common.storage.deleteBrokenConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.deleteBrokenTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerStorage.deleteBroken.confirm' — `scanResults` giờ có thể
     * chứa CẢ 3 mediaType (song/video/photo, gắn sẵn ở executeScanBroken()) — tách theo
     * mediaType, xoá ĐÚNG store cho từng phần. Song/Video GIỮ NGUYÊN `deleteCorruptedSongs()`/
     * `deleteCorruptedVideos()` cũ; Photo dùng 1 hàm MỚI (core/storage-manager.js).
     * @param {{scanResults: Array, currentKey: string|null}} payload
     */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;
        const songResults = scanResults.filter((r) => r.mediaType === 'song');
        const videoResults = scanResults.filter((r) => r.mediaType === 'video');
        const photoResults = scanResults.filter((r) => r.mediaType === 'photo');

        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            if (songResults.length > 0) {
                await deleteCorruptedSongs(songResults, currentKey); // core/storage-manager.js — tự removeKeyFromDisplay() bên trong
            }
            if (videoResults.length > 0) {
                const deletedVideoKeys = await deleteCorruptedVideos(videoResults, currentKey); // core/storage-manager.js
                deletedVideoKeys.forEach((key) => removeKeyFromDisplay(key)); // core/playlist/actions.js
            }
            if (photoResults.length > 0) {
                await deleteCorruptedPhotos(photoResults); // core/storage-manager.js — tự dọn cascade album bên trong
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

    /** Ứng với msg.type = 'fileManagerStorage.scanBroken.click' — đọc `payload.sources` (DÙNG
     * CHUNG đúng 4 toggle của "Chọn mục xoá") — quét TUẦN TỰ từng nguồn đang bật (KHÔNG VMState,
    /** Ứng với msg.type = 'fileManagerStorage.scanBroken.confirm' — đọc `payload.sources` (MỚI,
     * 29/07/2026: giờ tới từ dropdown của askScanBrokenScope() qua Router::_scopeToSources(), KHÔNG
     * còn tới từ `storageSources` của "Delete & Backup" nữa) — quét TUẦN TỰ từng nguồn đang bật
     * (KHÔNG VMState, cùng lý do executeStorageAction() ở trên — tổ hợp boolean độc lập, không phải
     * enum). Mỗi kết quả gắn thêm `mediaType` — executeDeleteBroken() cần biết để xoá ĐÚNG store.
     * Hàm này GIỮ NGUYÊN 100% — chỉ đổi NƠI `sources` tới từ (dropdown thay vì checkbox chia sẻ),
     * bản thân hàm không quan tâm nguồn gốc của tham số.
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
            if (sources.video) results = results.concat((await scanAllVideosForCorruption(onScanProgress)).map((r) => ({ ...r, mediaType: 'video' })));
            if (sources.photo) results = results.concat((await scanAllPhotosForCorruption(onScanProgress)).map((r) => ({ ...r, mediaType: 'photo' })));

            if (!genericDrawerPanel.classList.contains('hidden')) {
                renderScanResultUI( // core/storage-manager.js
                    results,
                    genericDrawerBody.querySelector('#storage-scan-result'),
                    genericDrawerBody.querySelector('#storage-scan-summary'),
                    genericDrawerBody.querySelector('#storage-scan-list'),
                    genericDrawerBody.querySelector('#btn-storage-delete-broken')
                );
            }
        });
        if (onScanComplete) onScanComplete(results);
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
