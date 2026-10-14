/**
 * event/workflow/settings-misc.js — router "settingsMisc" (Debug console + appRecovery: Restart / Restore default settings /
 * Clear cache). Modal xác nhận (modalChoice/alertModal) ở tầng này; alertModal() không gọi bên trong withLoadingShield().
 */
/** MỌI key meta (IndexedDB) chứa CÀI ĐẶT, bị xoá hẳn ở Restore default settings
 * (confirmRestoreDefaults()). Thêm 1 domain cài đặt mới có persist qua meta -> PHẢI thêm key vào đây.
 * CỐ Ý KHÔNG có: folderIndex/deletedFolderIds (thư viện), songStats/totalListenSeconds (thống kê),
 * *Migrated (cờ migrate 1 lần), clearingInProgress (cờ tác vụ). */
const RESTORE_DEFAULTS_META_KEYS = [
    'configBackup', // bản backup vizConfig — PHẢI xoá, không loadConfig() sẽ phục hồi lại cấu hình cũ từ đây
    'visualBgConfig',
    'eqPresets',
    'motionPresets',
    'playlistFilterPresets', 'playlistFilterActivePresetId', 'playlistFilterAppliedConfig', 'playlistFilterAppliesToFolder',
    'playlistConfig', 'playerConfig', 'playerDisplayConfig', 'uiThemeConfig', 'paginationConfig',
    'recorderConfig', // Ghi âm (chế độ thu / Sync / Count-in / chất lượng), event/workflow/recorder.js
    'perfHudConfig', // Performance HUD (bật/tắt, kiểu, chiều, vị trí), event/workflow/perf-hud.js
    'activePlayListFolder', // thư mục đang áp cho từng Nguồn -> về "Tất cả"
];

/** MỌI key localStorage chứa CÀI ĐẶT (cùng lý do trên). V20 = key cũ loadConfig() còn đọc fallback. */
const RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS = ['visualMasterConfigV21', 'visualMasterConfigV20', 'uiThemeName', 'uiThemeBoot'];

const workflowSettingsMisc = {

    _debugConsolePageIndex: 0, // trang đang xem của Debug console (nơi 'debugConsole' của Pagination), core tự kẹp
    _debugConsolePanelEl: null, // phần tử chứa Debug Console đang mở (genericDrawerBody) — clear/xoá dòng/đổi trang cần vẽ lại danh sách

    /** Debug console (Settings > Troubleshooting, hoặc lối tắt forceOpenDebugConsole()): body khung đã vẽ sẵn
     * (event/workflow/app-settings.js / components/debug-console-drawer.js) — hàm này vẽ danh sách log + wire 2 nút
     * Copy all / Clear all trong `genericDrawerBody`. */
    async openDebugConsole() {
        const panelEl = genericDrawerBody;
        this._debugConsolePanelEl = panelEl;
        this._debugConsolePageIndex = 0; // mở lại luôn về trang 1 (= log mới nhất khi đang phân trang)
        this._renderDebugConsoleList(panelEl);
        wireDebugConsolePanelActions(panelEl); // core/settings-misc-ui.js
    },

    /** Ứng với 'settingsMisc.debugConsole.forceOpen' — lối tắt cưỡng chế mở Debug Console ngay cả khi đang bị
     * #loading-shield che (debug lúc app kẹt/treo giữa chừng 1 tác vụ). Nút kích hoạt
     * (`#btn-loading-shield-debug`) SỐNG NGAY BÊN TRONG chính `#loading-shield` (components/loading-
     * shield.js, z-[200]) nên LUÔN bấm được bất kể tác vụ nào đang chạy dở/treo bên dưới.
     *
     * KHÔNG đi qua `workflowAppSettings.navigateTo()`/`_render()` (luồng Settings > Troubleshooting
     * bình thường) — luồng đó mở Generic Drawer ở z-index MẶC ĐỊNH (128, THẤP HƠN shield 200), mở
     * lúc shield đang hiện sẽ bị chính shield đè kín, không thấy/không bấm được gì. Mở THẲNG qua
     * `openGenericDrawer()` với `zIndex` ĐÈ LÊN TRÊN shield (Z_INDEX.LOADING_SHIELD + 10, service/
     * z-index.js — chừa khoảng cách rộng, không chỉ +1, để chắc chắn overlay (zIndex-1) của Generic
     * Drawer vẫn nằm trên shield bất kể thứ tự DOM), header CHỈ có nút Đóng (KHÔNG có Back — đây là
     * lối tắt độc lập, không thuộc ngăn xếp điều hướng của `workflowAppSettings`), rồi tái dùng
     * NGUYÊN `openDebugConsole()` ngay trên để vẽ danh sách log + wire nút Copy/Xoá, y hệt luồng
     * Settings bình thường. Nút X (header mang `data-debug-force-close`) đi Listener -> Router
     * 'settingsMisc.debugConsole.forceClose.click' -> `workflowGenericDrawerHelpers.closeFully()` — CHỈ đóng Generic
     * Drawer, KHÔNG đụng gì tới shield/tác vụ đang chạy dở bên dưới (2 lớp hoàn toàn độc lập).
     */
    forceOpenDebugConsole() {
        workflowGenericDrawerHelpers.open({ // event/workflow/generic-drawer-helpers.js — lối mở DUY NHẤT (áp theme + dọn hẹn giờ)
            height: 'auto',
            maxHeight: '85vh',
            zIndex: Z_INDEX.LOADING_SHIELD + 10, // service/z-index.js
            headerHtml: buildDrawerHeaderHtml({ title: t('settingsMisc.debugConsole.title'), closeAttrs: 'data-debug-force-close="1"' }), // components/generic-drawer.js
            bodyHtml: renderDebugConsoleForceOpenBody(), // components/debug-console-drawer.js
            bodyClass: 'overflow-y-auto',
        });
        this.openDebugConsole(); // vẽ danh sách log + wire nút Copy/Xoá — TÁI DÙNG nguyên logic có sẵn ngay trên
    },

    /** Ứng với `settingsMisc.debugConsole.copy.click` (nút Copy all). */
    async copyDebugConsoleLog() {
        const text = formatDebugConsoleLogsText(getDebugConsoleLogs()); // core/debug-console.js
        try {
            await navigator.clipboard.writeText(text);
            alertModal(t('settingsMisc.debugConsole.copiedMsg'));
        } catch (e) {
            alertModal(t('settingsMisc.debugConsole.copyFailedMsg'));
        }
    },

    /** Ứng với `settingsMisc.debugConsole.clear.click` (nút Clear all). */
    clearDebugConsoleLog() {
        clearDebugConsoleLogs(); // core/debug-console.js
        this._debugConsolePageIndex = 0;
        if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl);
    },

    /** Ứng với `settingsMisc.debugConsole.item.click` payload.action === 'copy':
     * Copy ĐÚNG 1 dòng. KHÔNG dùng alertModal (mỗi lần copy 1 dòng mà bật 1 modal thì quá nặng) — đổi
     * icon nút sang dấu tick ~1s rồi trả lại icon gốc (báo nhẹ, không chặn thao tác).
     * @param {number} id @param {HTMLElement} btnEl - nút Copy vừa bấm */
    async copyDebugConsoleItem(id, btnEl) {
        const entry = findDebugConsoleLog(getDebugConsoleLogs(), id); // core/debug-console.js
        if (!entry) return;
        try {
            await navigator.clipboard.writeText(formatDebugConsoleLogsText([entry])); // core/debug-console.js
        } catch (e) {
            alertModal(t('settingsMisc.debugConsole.copyFailedMsg'));
            return;
        }
        setDebugConsoleCopyIcon(btnEl, renderDebugConsoleCopyIconHtml(true)); // core/settings-misc-ui.js + components/debug-console-drawer.js
        taskManager.once(() => setDebugConsoleCopyIcon(btnEl, renderDebugConsoleCopyIconHtml(false)), 1000, `debugConsoleCopyFlash_${id}`);
    },

    /** Ứng với `settingsMisc.debugConsole.item.click` payload.action === 'remove':
     * Xoá ĐÚNG 1 dòng rồi vẽ lại danh sách, GIỮ NGUYÊN vị trí cuộn (không nhảy xuống cuối như lúc mở).
     * @param {number} id */
    removeDebugConsoleItem(id) {
        removeDebugConsoleLog(id); // core/debug-console.js
        if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl, true);
    },

    /** Vẽ lại danh sách log + thanh phân trang trong `panelEl` — lúc mở panel, sau Clear all, sau xoá 1 dòng (`keepScroll`), lúc
     * đổi trang. Thứ tự + cách cuộn theo nơi 'debugConsole' của Pagination: computeDebugConsoleListPlan() (core/debug-console.js).
     * @param {HTMLElement} panelEl @param {boolean} [keepScroll] */
    _renderDebugConsoleList(panelEl, keepScroll) {
        const isPaginated = workflowPagination.getPlaceSettings('debugConsole').enabled; // event/workflow/pagination.js
        const plan = computeDebugConsoleListPlan(getDebugConsoleLogs(), isPaginated, keepScroll); // core/debug-console.js
        const view = workflowPagination.computePlaceView('debugConsole', plan.orderedLogs, this._debugConsolePageIndex);
        this._debugConsolePageIndex = view.pageIndex; // giá trị đã kẹp (vd vừa xoá hết dòng của trang cuối)
        const filled = fillDebugConsoleList(panelEl, renderDebugConsoleListHtml(view.pageItems), workflowPagination.buildControlsHtml(view)); // core/settings-misc-ui.js + components/debug-console-drawer.js
        if (!filled) return;
        applyUiThemeToDom(filled.listEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — item vẽ sau khi Drawer đã áp theme
        if (filled.paginationEl) applyUiThemeToDom(filled.paginationEl, _activeUiThemeKeyList);
        scrollDebugConsoleList(filled.listEl, plan.scrollMode, filled.prevScrollTop); // core/settings-misc-ui.js
    },

    /** Ứng với 'settingsMisc.debugConsole.page.change' (thanh phân trang Debug console).
     * @param {number} pageIndex */
    setDebugConsolePage(pageIndex) {
        this._debugConsolePageIndex = pageIndex;
        if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl);
    },

    // ===================== appRecovery =====================

    /** Ứng với msg.type = 'settingsMisc.restartApp.click' — modal xác nhận; OK gửi tiếp message
     *  MỚI qua bus ('settingsMisc.restartApp.confirm'), không gọi tắt thẳng core (đúng mục 2.1). */
    askRestartApp(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.appRecovery.restartBody'),
            [
                { label: t('common.appRecovery.restartConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.restartTitle') }
        );
    },

    /** Ứng với msg.type = 'settingsMisc.restoreDefaults.click'. */
    askRestoreDefaults(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.appRecovery.restoreDefaultsBody'),
            [
                { label: t('common.appRecovery.restoreDefaultsConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.restoreDefaultsTitle') }
        );
    },

    /** Ứng với msg.type = 'settingsMisc.restoreDefaults.confirm'. Quy tắc (Giang chốt): Restore default settings reset
     * MỌI cài đặt về gốc, không ngoại lệ — "y hệt lúc mới cài" về mặt CÀI ĐẶT:
     *   1. XOÁ HẲN mọi bản lưu cài đặt — RESTORE_DEFAULTS_META_KEYS (IndexedDB meta) +
     *      RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS — rồi reload: boot tự seed mặc định cho từng domain đúng như
     *      lần chạy đầu (mọi loader đã xử lý sẵn trường hợp "chưa từng lưu": EQ seed 6 preset gốc, Motion/
     *      Filter về rỗng, Theme về Light...). Xoá thay vì ghi đè từng domain — không phải biết/chép lại
     *      giá trị mặc định của từng nơi ở đây, thêm domain mới chỉ cần thêm key vào danh sách.
     *      => Preset EQ/Motion/Filter NGƯỜI DÙNG TỰ TẠO cũng bị xoá (không còn ngoại lệ).
     *   2. 4 cờ cài đặt của MỌI folder (Exclude / Read-only / Áp dụng filter / Filter riêng) về mặc định —
     *      resetFolderRecordSettings() (core/file-manager/folder.js).
     * KHÔNG đụng (DỮ LIỆU, không phải cài đặt): media đã upload (Song/Video/Photo), thư mục + tên + nội
     * dung, thống kê nghe (songStats/totalListenSeconds), gói ngôn ngữ đã tải lên, cờ migrate 1 lần, trạng
     * thái tạm (resume/subtitle đang sửa).
     * Thứ tự: reset RAM viz/visualBg TRƯỚC (lỡ có saveConfig() nào chạy chen giữa lúc await thì nó ghi
     * lại MẶC ĐỊNH chứ không phải cấu hình cũ) + huỷ lượt backup vizConfig đang hẹn giờ, rồi mới xoá. Đợi
     * MỌI lượt ghi/xoá IndexedDB xong mới reload (reload sớm = mất phần chưa ghi xong). */
    async confirmRestoreDefaults() {
        restoreDefaultVizConfig(); // core/config.js
        restoreDefaultVisualBgConfig(); // core/config.js
        taskManager.kill('configBackupFlush'); // core/config.js hẹn ghi meta.configBackup sau 2s — không để nó ghi lại sau khi đã xoá

        const folders = await workflowFolder.list(); // event/workflow/folder.js — CẢ 3 loại
        await Promise.all(folders.map((record) => resetFolderRecordSettings(record))); // core/file-manager/folder.js
        await Promise.all(RESTORE_DEFAULTS_META_KEYS.map((key) => delMeta(key))); // service/db.js
        for (const key of RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS) {
            try { localStorage.removeItem(key); } catch (e) { console.warn(`[restoreDefaults] Không xoá được localStorage['${key}']:`, e); }
        }
        console.log(`writer: "confirmRestoreDefaults", page: "meta+localStorage", content: "xoá ${RESTORE_DEFAULTS_META_KEYS.length} meta + ${RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS.length} localStorage, reset ${folders.length} folder"`);
        location.reload();
    },

    /** Nút xoá cache js/css của trang — ứng với msg.type = 'settingsMisc.clearCache.click'. */
    askClearCache(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.appRecovery.clearCacheBody'),
            [
                { label: t('common.appRecovery.clearCacheConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.clearCacheTitle') }
        );
    }
};
