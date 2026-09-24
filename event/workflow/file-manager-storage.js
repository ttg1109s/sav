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

/** MỚI (21/09/2026, Giang yêu cầu "number ở storage cũng cần animation number") — đếm-lên các con số thống kê dung lượng
 * (tổng byte + số Song/Video/Photo) mỗi lần `refreshTab()` vẽ lại, dùng CHUNG core `computeCountupValue()` (core/number-countup.js)
 * + vòng lặp `workflowNumberCountup.run()` (event/workflow/number-countup.js) — cùng cơ chế Game/Statistics. Ease-out cubic như Statistics. */
const STORAGE_COUNTUP_TASK = 'storageStatsCountUp';
const STORAGE_COUNTUP_STEPS = 24; // x 35ms mặc định của workflowNumberCountup ≈ 0.85s
const STORAGE_COUNTUP_EASE_POWER = 3;

const workflowFileManagerStorage = {

    /** DỜI (24/09/2026, dọn nợ "Core gọi Workflow") từ core/storage-manager.js::clearAllStoredData() — thân GIỮ NGUYÊN, chỉ đổi bước "về Playlist" sang `workflowPlayerControls.returnToPlaylistUI()`.
     * Xóa TOÀN BỘ dữ liệu app khỏi IndexedDB: cả 2 store songs + meta — dùng chung cho cả 2 nút giải phóng bộ nhớ.
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
            workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js (thay core forceBackToPlaylistUI(), 24/09/2026)
            if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa

            await delMeta('clearingInProgress'); // chỉ xoá cờ SAU KHI mọi bước trên đã xong hoàn toàn
        } finally {
            appState.set('isDestructiveTaskInProgress', false);
        }
    },


    /** Ứng với 'fileManagerStorage.openPanel.click'. Mở Generic Drawer "Quản lý lưu trữ" — cùng
     * khuôn `workflowFileManagerFolderBrowser._renderList()` (header title + nút X). */
    async openPanel() {
        workflowGenericDrawerHelpers.open({ // event/workflow/generic-drawer-helpers.js — SỬA 24/09/2026: lối mở DUY NHẤT
            height: 'auto', // MỚI (phản hồi Giang mục 2) — tự co theo nội dung, xem core/generic-drawer.js
            maxHeight: '85vh',
            headerHtml: `
                <div class="flex justify-between items-center px-5 pb-3" data-uitk="headerBorder">
                    <h3 class="text-base font-bold" data-uitk="headerTitle">${t('storageDrawer.title')}</h3>
                    <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}">
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
            // sheet). SỬA LÚC ĐÓ: bọc `.app-settings-scope` — mượn kỹ thuật event/workflow/
            // app-settings.js đã dùng cho CHÍNH bug này ở Settings (đè toàn bộ class tối kể trên sang
            // sáng qua CSS `!important`, KHÔNG cần viết lại template). `p-4` DỜI vào wrapper này (khỏi
            // bodyClass) — ĐÚNG quy ước Settings (bodyClass CHỈ còn overflow-y-auto, không tự có
            // padding).
            // SỬA TIẾP (09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — `.app-settings-scope`
            // (CSS đè màu) ĐÃ XOÁ HẲN — renderFileManagerStorageManagementPanelBody() giờ tự viết
            // TRỰC TIẾP bằng bảng màu sáng (xem docstring components/file-manager-storage.js), không
            // còn 1 class tối nào cần đè. Wrapper chỉ còn `text-slate-900` (màu chữ mặc định kế thừa
            // xuống) + `p-4`, không còn ý nghĩa "scope đè màu" nào nữa.
            bodyHtml: `<div class="p-4" data-uitk="textPrimary">${renderFileManagerStorageManagementPanelBody()}</div>`, // SỬA 21/09/2026 — màu chữ mặc định theo theme (trước đây text-slate-900 cứng)
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
        taskManager.kill(STORAGE_COUNTUP_TASK); // dừng đếm-lên nếu panel đóng giữa chừng
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
        const statEls = {
            totalBytesEl: genericDrawerBody.querySelector('#stat-storage-total-bytes'),
            barSongsEl: genericDrawerBody.querySelector('#stat-storage-bar-songs'),
            barVideosEl: genericDrawerBody.querySelector('#stat-storage-bar-videos'),
            barPhotosEl: genericDrawerBody.querySelector('#stat-storage-bar-photos'),
            countSongsEl: genericDrawerBody.querySelector('#stat-storage-count-song'),
            countVideosEl: genericDrawerBody.querySelector('#stat-storage-count-video'),
            countPhotosEl: genericDrawerBody.querySelector('#stat-storage-count-photo'),
        };
        renderStorageStats(songStats, videoStats, photoStats, statEls); // core/storage-manager.js — ghi SỐ CUỐI + độ rộng thanh (thanh tự animate bằng CSS transition)
        this._startStorageCountup(statEls, songStats, videoStats, photoStats); // đếm-lên các con số từ 0 tới số vừa ghi
        resetScanResultUI( // core/storage-manager.js
            genericDrawerBody.querySelector('#storage-scan-result'),
            genericDrawerBody.querySelector('#storage-scan-list')
        );
    },

    /** MỚI (21/09/2026) — đếm-lên 4 con số (tổng dung lượng + số Song/Video/Photo) từ 0 tới số `renderStorageStats()` vừa ghi: ép về
     * khung 0 NGAY (đồng bộ, không nháy số cuối trước khi đếm) rồi chạy `workflowNumberCountup.run()`; giá trị mỗi khung do
     * `computeCountupValue()` (core), định dạng byte dùng `formatBytes()` (core/about-stats.js — chính hàm đã dùng lúc ghi số cuối, nên khung cuối
     * khớp từng ký tự). Gọi lại `refreshTab()` (vd sau khi xoá xong) tự huỷ lượt cũ (`run()` kill trùng tên). */
    _startStorageCountup(els, songStats, videoStats, photoStats) {
        const asInteger = (value) => `${value}`;
        const targets = [
            { el: els.totalBytesEl, finalValue: songStats.totalBytes + videoStats.totalBytes + photoStats.totalBytes, format: formatBytes }, // core/about-stats.js
            { el: els.countSongsEl, finalValue: songStats.totalSongs, format: asInteger },
            { el: els.countVideosEl, finalValue: videoStats.totalVideos, format: asInteger },
            { el: els.countPhotosEl, finalValue: photoStats.totalImages, format: asInteger },
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
                { label: t(deleteEnabled ? 'fileManager.song.storageAction.confirmBtnDelete' : 'fileManager.song.storageAction.confirmBtnDownload'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: onConfirmSend }
            ],
            { title: t('fileManager.song.storageAction.confirmTitle') }
        );
    },

    /** DÙNG CHUNG bởi Song/Video/Photo — build zip (nếu có gì để đóng gói) rồi tải xuống ngay.
     * SỬA (06/09/2026, hợp nhất Folder vào Playlist — buildAllSongsZipBlob()/buildAllVideosZipBlob()/
     * buildAllPhotosZipBlob() thêm tham số `keys` tuỳ chọn, xem core/storage-manager.js) — truyền
     * THẲNG `keys` vừa lấy được ở dòng dưới vào `buildZipFn`, tránh gọi `getKeysFn()` LẦN 2 một cách
     * ngầm bên trong `buildZipFn` (trước đây `buildZipFn` tự gọi `getAllSongKeys()` v.v. riêng).
     *
     * XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") — tham số `getRecordFn` bỏ hẳn, chỉ
     * dùng cho nhánh "ước lượng dung lượng + tải riêng từng file" (dự phòng JSZip) đã xoá ở
     * `zipAndDownloadOrFallback()` ngay dưới, xem docstring hàm đó.
     * @param {() => Promise<string[]>} getKeysFn
     * @param {(keys: string[], onProgress: function) => Promise<Blob>} buildZipFn
     * @param {string} zipNamePrefix - đã dịch sẵn qua t(), dùng làm tên file
     * @returns {Promise<{status: 'ok'|'noItems'|'zipError', message?: string}>}
     */
    async _downloadZipFor(getKeysFn, buildZipFn, zipNamePrefix) {
        const keys = await getKeysFn();
        if (keys.length === 0) return { status: 'noItems' }; // guard: không có gì để đóng gói

        const dateStr = new Date().toISOString().slice(0, 10);
        return this.zipAndDownloadOrFallback(keys, buildZipFn, `${zipNamePrefix}-${dateStr}.zip`);
    },

    /**
     * MỚI (10/09/2026, Giang báo bug "zip video >1GB làm crash PWA, bị cưỡng chế reload") — DÙNG
     * CHUNG bởi `_downloadZipFor()` ngay trên (Storage Management) VÀ `_downloadFolderZip()`
     * (event/workflow/file-manager-folder-browser.js — "Folder Properties -> Download").
     *
     * XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") — TRƯỚC ĐÂY, khi streaming OPFS hoàn
     * toàn không khả dụng (`isStreamingZipAvailable()` false, browser rất cũ), hàm này ước lượng
     * dung lượng rồi hỏi người dùng chuyển sang tải RIÊNG TỪNG FILE làm lưới an toàn cho nhánh JSZip
     * dự phòng (dựng liền 1 khối trong RAM). JSZip đã bỏ hẳn khỏi app — KHÔNG còn nhánh nào để cần
     * lưới an toàn đó nữa, nên bỏ luôn bước ước lượng/hỏi này: streaming không khả dụng thì
     * `buildZipFn()` bên dưới tự ném lỗi, rơi thẳng vào nhánh `catch` báo `zipError`, KHÔNG cần
     * "thiết kế luồng riêng" cho trường hợp không tải được (theo đúng ý Giang).
     *
     * DỌN FILE TẠM OPFS: khi `zipBlob` build ra là 1 File streaming (có `_opfsTempName`, xem
     * `buildZipStreamingToOpfs()`, core/streaming-zip.js), gọi `cleanupStreamingZipTemp()` NGAY SAU
     * khi `promptDownloadReady()` đóng (đã tải/share xong hoặc người dùng Huỷ) — không để rác tích
     * lại trong OPFS qua nhiều lượt dùng.
     * @param {string[]} keys
     * @param {(keys:string[], onProgress:function) => Promise<Blob>} buildZipFn
     * @param {string} zipFileName - tên file .zip ĐẦY ĐỦ (đã gồm ".zip")
     * @returns {Promise<{status:'ok'|'zipError', message?:string}>}
     */
    async zipAndDownloadOrFallback(keys, buildZipFn, zipFileName) {
        let zipBlob;
        try {
            await withLoadingShield(t('common.storage.zippingStart'), async () => {
                zipBlob = await buildZipFn(keys, (done, total, percent) => {
                    const pct = percent != null ? Math.round(percent) : Math.round((done / total) * 100);
                    loadingText.textContent = tFormat('common.storage.zippingProgress', { percent: pct });
                });
            });
        } catch (err) {
            console.error('[file-manager-storage] Lỗi đóng gói zip:', err);
            return { status: 'zipError', message: err && err.message ? err.message : String(err) };
        }
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — KHÔNG
        // triggerDownload() thẳng ngay đây nữa (user-activation của lượt bấm gốc gần như chắc chắn
        // đã hết hạn sau khi chờ tính dung lượng + build zip xong) — giao cho promptDownloadReady()
        // (core/id3-export.js), nút "Tải xuống" bên trong modal đó mới thật sự gọi
        // triggerDownload() với activation MỚI/còn nguyên.
        await promptDownloadReady(zipBlob, zipFileName); // core/id3-export.js
        if (zipBlob._opfsTempName) await cleanupStreamingZipTemp(zipBlob._opfsTempName); // core/streaming-zip.js — dọn file tạm OPFS SAU khi modal đã đóng (tải/share xong hoặc Huỷ), tránh tích rác
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
            // SỬA (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ") — updateShuffleArray()/
            // recomputeDisplayOrder()/recomputeRenderOrder() ĐÃ DỜI hẳn sang event/workflow/
            // playlist-order.js (workflowPlaylistOrder) — gọi trực tiếp, tự đọc playlistOrder=[]
            // vừa set ở trên qua appState, không cần truyền tham số nữa.
            workflowPlaylistOrder.updateShuffleArray(); workflowPlaylistOrder.recomputeDisplayOrder(); workflowPlaylistOrder.recomputeRenderOrder(); workflowPlaylistRender.renderPlaylistDiff(); updateEmptyState(); // 3 method đầu + renderPlaylistDiff() ở event/workflow/playlist-order.js + playlist-render.js (dời từ core/playlist/order.js + render.js), updateEmptyState() vẫn core (core/playlist/render.js)
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
            // SỬA — CÙNG LÝ DO _resetVideoRuntimeStateAfterClear() ngay trên.
            workflowPlaylistOrder.updateShuffleArray(); workflowPlaylistOrder.recomputeDisplayOrder(); workflowPlaylistOrder.recomputeRenderOrder(); workflowPlaylistRender.renderPlaylistDiff(); updateEmptyState(); // 3 method đầu + renderPlaylistDiff() ở event/workflow/playlist-order.js + playlist-render.js (dời từ core/playlist/order.js + render.js), updateEmptyState() vẫn core (core/playlist/render.js)
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
        // FIX (10/09/2026, Giang báo bug "zip video >1GB làm crash PWA") — điều kiện xoá dữ liệu
        // TRƯỚC ĐÂY chỉ chặn khi `status === 'zipError'`, KHÔNG chặn `status === 'cancelled'` (trạng
        // thái MỚI, xem `zipAndDownloadOrFallback()`) — nếu không sửa, người dùng bấm Huỷ ở modal
        // "quá lớn" vẫn bị XOÁ SẠCH dữ liệu dù CHƯA hề có bản sao nào (cực kỳ nguy hiểm, mất dữ liệu
        // thật). Đổi hẳn sang chỉ cho xoá khi `status === 'ok'` (thành công THẬT SỰ, dù bằng zip hay
        // tải riêng từng file) — an toàn với MỌI status mới phát sinh sau này, không cần liệt kê tay
        // từng trạng thái "không phải lỗi".
        if (sourceKey === 'song') {
            const result = downloadEnabled
                ? await this._downloadZipFor(getAllSongKeys, buildAllSongsZipBlob, t('fileManager.song.storageAction.zipNameSong'))
                : { status: 'ok' };
            if (deleteEnabled && result.status === 'ok') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await workflowFileManagerStorage.clearAllStoredData(); }); // SỬA 24/09/2026 — dời từ core/storage-manager.js (Song)
                await clearAllFolderSongData(); // core/file-manager/folder.js
                if (appState.get('activePlayListFolder').song) await workflowPlaylistScope.persistScopeChoice(null, 'song');
            }
            return result;
        }
        if (sourceKey === 'video') {
            const result = downloadEnabled
                ? await this._downloadZipFor(getAllVideoKeys, buildAllVideosZipBlob, t('fileManager.song.storageAction.zipNameVideo'))
                : { status: 'ok' };
            if (deleteEnabled && result.status === 'ok') {
                await withLoadingShield(t('common.storage.deletingData'), async () => { await clearAllVideosData(); }); // core/storage-manager.js
                await this._resetVideoRuntimeStateAfterClear();
            }
            return result;
        }
        if (sourceKey === 'photo') {
            const result = downloadEnabled
                ? await this._downloadZipFor(getAllImageKeys, buildAllPhotosZipBlob, t('storageDrawer.zipNamePhoto'))
                : { status: 'ok' };
            if (deleteEnabled && result.status === 'ok') {
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

    /** Ứng với msg.type = 'fileManagerStorage.fixBroken.click' — ĐỔI TÊN (18/09/2026, cùng lúc
     * gộp tính năng mới) từ `askDeleteBroken()`: trước đây MỌI kết quả quét đều là "lỗi thật, chỉ
     * xoá được" nên chỉ có 1 nội dung modal cố định. Giờ `scanResults` (Video) có thể mang thêm
     * `fixable: true` (thiếu thumb, blob chính vẫn đọc được — xem `isVideoRecordCorrupted()`,
     * core/storage-manager.js) — modal xác nhận đọc trước xem lô có gì, chọn ĐÚNG nội dung/màu nút:
     *   - Chỉ có phần tử `fixable:false` (ca CŨ, Song/Photo LUÔN rơi vào đây — 2 domain đó chưa có
     *     khái niệm "fixable") -> GIỮ NGUYÊN 100% modal xoá cũ (tái dùng đúng 3 lang key cũ).
     *   - Có ÍT NHẤT 1 phần tử `fixable:true` -> đổi hẳn sang modal MỚI (tiêu đề/nút "Sửa file
     *     lỗi"), nội dung tuỳ còn phần `fixable:false` hay không (kết hợp cả xoá+sửa hay chỉ sửa).
     * @param {{scanResults: Array, onConfirmSend: function}} payload
     */
    askFixBroken(payload) {
        const { scanResults, onConfirmSend } = payload;
        const brokenResults = scanResults.filter((r) => !r.fixable);
        const fixableResults = scanResults.filter((r) => r.fixable);
        let bodyText, title, btnLabel, destructive;
        if (fixableResults.length === 0) {
            // Không có gì "sửa" được — Y HỆT hành vi cũ (askDeleteBroken()), không đổi copy nào.
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
     * khi gọi hàm này (xem event/router/file-manager-storage.js) — thân hàm GIỮ NGUYÊN 100% so với
     * `executeDeleteBroken()` cũ (chỉ đổi Ở ĐÂU lọc dữ liệu, không đổi hành vi xoá). `scanResults`
     * vẫn có thể chứa CẢ 3 mediaType (song/video/photo, gắn sẵn ở executeScanBroken()) — tách theo
     * mediaType, xoá ĐÚNG store cho từng phần. Song/Photo LUÔN rơi hết vào đây (chưa có khái niệm
     * `fixable`); Video chỉ còn phần thật sự hỏng blob chính.
     * @param {{scanResults: Array, currentKey: string|null}} payload
     */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;
        if (scanResults.length === 0) return;
        const songResults = scanResults.filter((r) => r.mediaType === 'song');
        const videoResults = scanResults.filter((r) => r.mediaType === 'video');
        const photoResults = scanResults.filter((r) => r.mediaType === 'photo');

        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            if (songResults.length > 0) {
                const deletedSongKeys = await deleteCorruptedSongs(songResults, currentKey); // core/storage-manager.js — SỬA 24/09/2026: trả về key đã xoá
                deletedSongKeys.forEach((key) => workflowPlaylistOrder.removeKeyFromDisplay(key)); // event/workflow/playlist-order.js
            }
            if (videoResults.length > 0) {
                const deletedVideoKeys = await deleteCorruptedVideos(videoResults, currentKey); // core/storage-manager.js
                deletedVideoKeys.forEach((key) => workflowPlaylistOrder.removeKeyFromDisplay(key)); // event/workflow/playlist-order.js (dời từ core 24/09/2026)
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

    /** Ứng với msg.type = 'fileManagerStorage.fixBroken.confirm', NHÁNH SỬA — MỚI (18/09/2026).
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
                    await setVideoThumbnails(key, thumbBlob, thumbFullBlob, thumbFullIsBlack); // core/file-manager/video.js — thumbFullIsBlack: đen THẬT -> scan lần sau bỏ qua (MỚI 19/09/2026)
                    fixedCount++;
                } catch (err) {
                    console.error(`[executeRepairBroken] tạo lại thumbnail thất bại cho video "${key}":`, err);
                    failedCount++;
                }
            }
            if (!genericDrawerPanel.classList.contains('hidden')) {
                resetScanResultUI( // SỬA (20/09/2026) — giờ CHỈ còn dùng bởi màn Troubleshooting > Scan & fix video thumbnails (id `video-thumb-*`)
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
            if (sources.video) {
                // SỬA (20/09/2026, Giang yêu cầu — "chỉ lấy phần scan và fix thumb full res của video sang Troubleshooting,
                // KHÔNG lấy scan & broken của Storage") — Storage CHỈ còn báo video hỏng THẬT (blob chính không đọc/decode
                // được -> `fixable:false`, xoá được); phần thiếu/đen/không decode thumb (`fixable:true`) DỜI SANG
                // Setting > Troubleshooting > "Scan & fix video thumbnails" (`executeScanVideoThumbs()` ngay dưới).
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
                    genericDrawerBody.querySelector('#btn-storage-fix-broken') // ĐỔI TÊN 18/09/2026 từ #btn-storage-delete-broken
                );
            }
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** MỚI (19/09/2026) — lượt quét thứ 2 của Video: thumb full-res ĐÃ CÓ trong record nhưng ĐEN (hoặc
     * không decode được). `isVideoRecordCorrupted()` (core/storage-manager.js) chỉ kiểm tra thumb CÓ
     * TỒN TẠI, không nhìn pixel — chụp lỗi ở bản cũ (khung chưa sẵn sàng -> JPEG đen) vì vậy lọt qua quét.
     * Bỏ qua: video đã có kết quả từ lượt quét core (không chồng 2 lý do cho cùng 1 video), record thiếu
     * blob/thumb (lượt core lo), và record có `thumbFullBlack === true` (đã chụp lại đúng cách vẫn đen =
     * đen THẬT của nội dung — không báo lỗi lặp vô tận sau khi sửa). Kết quả LUÔN `fixable:true` — "sửa"
     * = chụp lại thumb qua `executeRepairBroken()` (cùng pipeline mới lúc upload).
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
        const img = new Image();
        try {
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('thumb không decode được'));
                img.src = url;
            });
            if (img.decode) await img.decode();
            const probe = workflowPlaylist._probeVideoFrame(img); // event/workflow/playlist.js
            if (!probe.drawn) return 'undecodable';
            return probe.isBlack ? 'black' : 'ok';
        } catch (err) {
            return 'undecodable';
        } finally {
            img.onload = null; img.onerror = null;
            img.removeAttribute('src');
            try { URL.revokeObjectURL(url); } catch (e) {}
        }
    },

    /** MỚI (20/09/2026, Giang yêu cầu — chuyển "scan check thumb full res video + fix" từ Storage sang
     * Setting > Troubleshooting) — ứng với msg.type = 'fileManagerStorage.videoThumb.scan.click'. CHỈ quét
     * Video, CHỈ báo phần thumb (`fixable:true`): thiếu thumb cover/full-res (lượt quét core
     * `scanAllVideosForCorruption()`, lọc lại `fixable`) + thumb full-res ĐEN/không decode được
     * (`_scanBlackVideoThumbs()` ngay dưới, dùng lại NGUYÊN). Video hỏng THẬT (blob chính) KHÔNG báo ở đây —
     * đó là việc của "Scan & clean broken files" ở Storage. Sửa = `executeRepairBroken()` (giữ nguyên, chụp
     * lại thumb, không xoá gì). Hiển thị vào khối `#video-thumb-scan-*` của màn Troubleshooting
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
