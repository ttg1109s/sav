/**
 * event/workflow/settings-misc.js — "THẰNG THỰC THI CUỐI" của router "settingsMisc".
 *
 * [21/09/2026] Nhánh `aboutDrawer` (`openAbout()`) ĐÃ XOÁ — nút mở `#setting-open-about` không còn tồn tại trong UI Settings
 * (carousel mới chỉ có Playlist/System/Visualizer Screen/Troubleshooting) nên `openAbout()`/`renderAboutPanelBody()`
 * không còn ai gọi tới (đã kiểm tra toàn project) — xoá cả cụm.
 *
 * Ver 12 "Multi Media": nhánh `storageDrawer` đã DỜI sang workflowFileManagerSong
 * (event/workflow/file-manager-song.js, plan-v12-multimedia.md mục 3).
 *
 * QUY TẮC:
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — chỉ là 1 CHUỖI GỌI hàm core đã có sẵn.
 *   - withLoadingShield() và alertModal()/modalChoice() ĐẶT Ở TẦNG NÀY — core không biết 2 thứ
 *     này tồn tại.
 *   - alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của withLoadingShield() — luôn gọi SAU
 *     KHI shield đã đóng hẳn.
 */
/** MỚI 23/09/2026 — MỌI key meta (IndexedDB) chứa CÀI ĐẶT, bị xoá hẳn ở Restore default settings
 * (confirmRestoreDefaults()). Thêm 1 domain cài đặt mới có persist qua meta -> PHẢI thêm key vào đây.
 * CỐ Ý KHÔNG có: folderIndex/deletedFolderIds (thư viện), songStats/totalListenSeconds (thống kê),
 * *Migrated (cờ migrate 1 lần), clearingInProgress (cờ tác vụ). */
const RESTORE_DEFAULTS_META_KEYS = [
    'configBackup', // bản backup vizConfig — PHẢI xoá, không loadConfig() sẽ phục hồi lại cấu hình cũ từ đây
    'visualBgConfig',
    'eqPresets',
    'motionPresets', // SỬA 24/09/2026 — 'motionApply' BỎ (cơ chế đăng ký Motion vào nơi tiêu thụ đã xoá, boot tự delMeta key cũ)
    'playlistFilterPresets', 'playlistFilterActivePresetId', 'playlistFilterAppliedConfig', 'playlistFilterAppliesToFolder',
    'playlistConfig', 'playerConfig', 'playerDisplayConfig', 'uiThemeConfig', 'paginationConfig',
    'activePlayListFolder', // thư mục đang áp cho từng Nguồn -> về "Tất cả"
];

/** MỚI 23/09/2026 — MỌI key localStorage chứa CÀI ĐẶT (cùng lý do trên). V20 = key cũ loadConfig() còn đọc fallback. */
const RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS = ['visualMasterConfigV21', 'visualMasterConfigV20', 'uiThemeName', 'uiThemeBoot'];

const workflowSettingsMisc = {

    _debugConsolePageIndex: 0, // MỚI 23/09/2026 — trang đang xem của Debug console (nơi 'debugConsole' của Pagination), core tự kẹp
    _debugConsolePanelEl: null, // panel Debug Console đang mở (pushSettingsPanel() dựng mới mỗi lần) — clearDebugConsoleLog() cần vẽ lại danh sách

    /**
     * MỚI (18/07/2026, Giang yêu cầu — "mục mới Settings > Misc, vào hiện console log"). SỬA
     * (đợt tái cấu trúc bottom nav + phân phối lại Settings, phản hồi Giang — "Troubleshooting =
     * debug console panel setting") — KHÔNG còn `pushSettingsPanel()`, bodyHtml do event/workflow/
     * app-settings.js cung cấp SẴN qua `navigateTo()` — hàm này chỉ còn vẽ danh sách log + wire 2
     * nút vào `genericDrawerBody` (core/generic-drawer.js, LUÔN có sẵn).
     */
    async openDebugConsole() {
        const panelEl = genericDrawerBody;
        this._debugConsolePanelEl = panelEl;
        this._debugConsolePageIndex = 0; // MỚI 23/09/2026 — mở lại luôn về trang 1 (= log mới nhất khi đang phân trang)
        this._renderDebugConsoleList(panelEl);
        wireDebugConsolePanelActions(panelEl); // core/settings-misc-ui.js
    },

    /** Ứng với 'settingsMisc.debugConsole.forceOpen' — MỚI (10/09/2026, Giang yêu cầu — "lối tắt
     * cưỡng chế mở Debug Console ngay cả khi đang bị #loading-shield che", phục vụ debug lúc app bị
     * kẹt/treo giữa chừng 1 tác vụ, không đợi tác vụ đó xong mới xem được log). Nút kích hoạt
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
     * Settings bình thường. Đóng bằng `workflowGenericDrawerHelpers.closeFully()` — CHỈ đóng Generic
     * Drawer, KHÔNG đụng gì tới shield/tác vụ đang chạy dở bên dưới (2 lớp hoàn toàn độc lập).
     */
    forceOpenDebugConsole() {
        workflowGenericDrawerHelpers.open({ // event/workflow/generic-drawer-helpers.js — SỬA 24/09/2026: lối mở DUY NHẤT (áp theme + dọn hẹn giờ)
            height: 'auto',
            maxHeight: '85vh',
            zIndex: Z_INDEX.LOADING_SHIELD + 10, // service/z-index.js
            headerHtml: `
                <div class="flex justify-between items-center px-5 pb-3" data-uitk="headerBorder">
                    <h3 class="text-base font-bold" data-uitk="headerTitle">${t('settingsMisc.debugConsole.title')}</h3>
                    <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            `,
            bodyHtml: `<div class="p-4" data-uitk="textPrimary">${renderDebugConsolePanelBody()}</div>`, // components/debug-console-drawer.js
            bodyClass: 'overflow-y-auto',
        });
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => workflowGenericDrawerHelpers.closeFully()); // event/workflow/generic-drawer-helpers.js
        this.openDebugConsole(); // vẽ danh sách log + wire nút Copy/Xoá — TÁI DÙNG nguyên logic có sẵn ngay trên
    },

    /** Chuỗi 1 dòng log khi Copy (cả "Copy all" lẫn Copy từng dòng — CÙNG 1 định dạng, dán ra đọc y hệt). */
    _formatDebugConsoleEntry(entry) {
        return `[${new Date(entry.time).toLocaleTimeString()}] ${entry.level.toUpperCase()}: ${entry.text}`;
    },

    /** Ứng với `settingsMisc.debugConsole.copy.click` (nút Copy all, wire 1 lần ở core/settings-misc-
     * ui.js). Public — Router gọi trực tiếp. */
    async copyDebugConsoleLog() {
        const logs = getDebugConsoleLogs(); // core/debug-console.js
        const text = logs.map((l) => this._formatDebugConsoleEntry(l)).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            alertModal(t('settingsMisc.debugConsole.copiedMsg'));
        } catch (e) {
            alertModal(t('settingsMisc.debugConsole.copyFailedMsg'));
        }
    },

    /** Ứng với `settingsMisc.debugConsole.clear.click` (nút Clear all). Public — Router gọi trực tiếp. */
    clearDebugConsoleLog() {
        clearDebugConsoleLogs(); // core/debug-console.js
        this._debugConsolePageIndex = 0;
        if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl);
    },

    /** MỚI (20/09/2026) — ứng với `settingsMisc.debugConsole.item.click` payload.action === 'copy':
     * Copy ĐÚNG 1 dòng. KHÔNG dùng alertModal (mỗi lần copy 1 dòng mà bật 1 modal thì quá nặng) — đổi
     * icon nút sang dấu tick ~1s rồi trả lại icon gốc (báo nhẹ, không chặn thao tác).
     * @param {number} id @param {HTMLElement} btnEl - nút Copy vừa bấm */
    async copyDebugConsoleItem(id, btnEl) {
        const entry = getDebugConsoleLogs().find((l) => l.id === id); // core/debug-console.js
        if (!entry) return;
        try {
            await navigator.clipboard.writeText(this._formatDebugConsoleEntry(entry));
        } catch (e) {
            alertModal(t('settingsMisc.debugConsole.copyFailedMsg'));
            return;
        }
        setDebugConsoleCopyIcon(btnEl, renderDebugConsoleCopyIconHtml(true)); // core/settings-misc-ui.js + components/debug-console-drawer.js
        taskManager.once(() => setDebugConsoleCopyIcon(btnEl, renderDebugConsoleCopyIconHtml(false)), 1000, `debugConsoleCopyFlash_${id}`);
    },

    /** MỚI (20/09/2026) — ứng với `settingsMisc.debugConsole.item.click` payload.action === 'remove':
     * Xoá ĐÚNG 1 dòng rồi vẽ lại danh sách, GIỮ NGUYÊN vị trí cuộn (không nhảy xuống cuối như lúc mở).
     * @param {number} id */
    removeDebugConsoleItem(id) {
        removeDebugConsoleLog(id); // core/debug-console.js
        if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl, true);
    },

    /** Vẽ lại danh sách log vào `#debug-console-list` bên trong `panelEl` — gọi lúc mở panel, sau
     * "Clear all" (danh sách rỗng lại), sau khi xoá 1 dòng, và lúc đổi trang. HTML item do
     * components/debug-console-drawer.js::renderDebugConsoleListHtml() dựng (đã escapeHtml nội dung log);
     * item vẽ SAU khi Generic Drawer đã áp theme nên phải áp lại `data-uitk` (core/ui-theme/apply-ui.js).
     *
     * SỬA 23/09/2026 — nơi 'debugConsole' của Settings > System > Pagination:
     *   - TẮT (mặc định): y hệt cũ — toàn bộ log cũ -> mới, tự cuộn xuống dòng MỚI NHẤT (`keepScroll`
     *     = true thì giữ vị trí cuộn, dùng khi xoá 1 dòng giữa danh sách).
     *   - BẬT: log MỚI NHẤT lên ĐẦU (trang 1 = mới nhất — cách duy nhất để mọi kiểu phân trang, kể cả
     *     'loadMore' cộng dồn từ đầu, đều mở ra thấy log mới trước), cuộn về đầu danh sách; xoá 1 dòng vẫn
     *     giữ vị trí cuộn. Thanh phân trang vẽ vào `#debug-console-pagination` (delegate đã wire 1 lần ở
     *     core/settings-misc-ui.js::wireDebugConsolePanelActions()).
     * @param {HTMLElement} panelEl @param {boolean} [keepScroll]
     */
    _renderDebugConsoleList(panelEl, keepScroll) {
        const listEl = panelEl.querySelector('#debug-console-list');
        if (!listEl) return;
        const paginationEl = panelEl.querySelector('#debug-console-pagination');
        const prevScrollTop = listEl.scrollTop;
        const isPaginated = workflowPagination.getPlaceSettings('debugConsole').enabled; // event/workflow/pagination.js
        const logs = getDebugConsoleLogs(); // core/debug-console.js — bản sao, đảo được thoải mái
        const view = workflowPagination.computePlaceView('debugConsole', isPaginated ? logs.reverse() : logs, this._debugConsolePageIndex);
        this._debugConsolePageIndex = view.pageIndex; // giá trị đã kẹp (vd vừa xoá hết dòng của trang cuối)
        listEl.innerHTML = renderDebugConsoleListHtml(view.pageItems); // components/debug-console-drawer.js
        applyUiThemeToDom(listEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        if (paginationEl) {
            paginationEl.innerHTML = workflowPagination.buildControlsHtml(view);
            applyUiThemeToDom(paginationEl, _activeUiThemeKeyList);
        }
        listEl.scrollTop = keepScroll ? prevScrollTop : (isPaginated ? 0 : listEl.scrollHeight);
    },

    /** MỚI 23/09/2026 — ứng với 'settingsMisc.debugConsole.page.change' (thanh phân trang Debug console).
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

    /** Ứng với msg.type = 'settingsMisc.restoreDefaults.confirm'.
     * SỬA (23/09/2026, Giang: "Đã là Restore default setting -> thì mọi thứ phải reset hết về gốc, không có
     * ngoại lệ và vùng cấm") — TRƯỚC ĐÂY chỉ reset 3 thứ (vizConfig, visualBgConfig, 5 preset EQ gốc — preset
     * người dùng tự tạo được GIỮ), bỏ sót Theme, Player, Pagination, Motion, Filter, cấu hình Playlist/Player,
     * thư mục đang áp... Giờ = "y hệt lúc mới cài" về mặt CÀI ĐẶT:
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

        const folders = await listFolders(); // core/file-manager/folder.js — CẢ 3 loại
        await Promise.all(folders.map((record) => resetFolderRecordSettings(record))); // core/file-manager/folder.js
        await Promise.all(RESTORE_DEFAULTS_META_KEYS.map((key) => delMeta(key))); // service/db.js
        for (const key of RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS) {
            try { localStorage.removeItem(key); } catch (e) { console.warn(`[restoreDefaults] Không xoá được localStorage['${key}']:`, e); }
        }
        console.log(`writer: "confirmRestoreDefaults", page: "meta+localStorage", content: "xoá ${RESTORE_DEFAULTS_META_KEYS.length} meta + ${RESTORE_DEFAULTS_LOCAL_STORAGE_KEYS.length} localStorage, reset ${folders.length} folder"`);
        location.reload();
    },

    /** MỚI (14/07/2026, Giang yêu cầu — "nút xoá cache js/css cho page") — ứng với msg.type =
     * 'settingsMisc.clearCache.click'. */
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
