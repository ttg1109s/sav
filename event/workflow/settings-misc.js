/**
 * event/workflow/settings-misc.js — "THẰNG THỰC THI CUỐI" của router "settingsMisc".
 *
 * Batch D1 (Settings restructure, 06/07/2026): `aboutDrawer` GIỜ CẦN workflow (TRƯỚC ĐÂY chỉ 1
 * hàm core/msg.type, router gọi thẳng — nay `openAbout()` là push panel (core UI thuần) + tính
 * thống kê bất đồng bộ + tự querySelector để điền giá trị, nhiều bước > 1 hàm core -> đúng hình
 * dạng Workflow). Nhánh đóng About KHÔNG còn ở đây nữa — dùng CHUNG
 * `settingsStackNav.back.click` cho MỌI panel (xem event/workflow/settings-stack-nav.js), không
 * riêng About — xem router/settings-misc.js đã bỏ case `aboutDrawer.close`.
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
const workflowSettingsMisc = {

    _debugConsolePanelEl: null, // panel Debug Console đang mở (pushSettingsPanel() dựng mới mỗi lần) — clearDebugConsoleLog() cần vẽ lại danh sách

    // ===================== aboutDrawer =====================

    /**
     * Ứng với msg.type = 'settingsMisc.aboutDrawer.open' — push panel About (nền tĩnh, hiện
     * '...' ngay) rồi tính thống kê thật bất đồng bộ, điền vào ĐÚNG panel vừa push (tự
     * `querySelector` bên trong `panelEl` trả về từ `pushSettingsPanel()` — KHÔNG dùng dom-refs.js
     * tĩnh, vì panel này bị `.remove()` mỗi lần đóng, xem core/settings-panel-stack.js).
     */
    async openAbout() {
        const panelEl = pushSettingsPanel({ title: t('aboutDrawer.title'), bodyHtml: renderAboutPanelBody() });
        const statTotalSongsEl = panelEl.querySelector('#stat-about-total-songs');
        const statTotalDurationEl = panelEl.querySelector('#stat-about-total-duration');
        const statListenSecondsEl = panelEl.querySelector('#stat-about-listen-seconds');

        const stats = await computeStats(); // core thuần, giữ nguyên (core/about-stats.js)
        statTotalSongsEl.textContent = `${stats.totalSongs}`;
        statTotalDurationEl.textContent = formatDurationLong(stats.totalDuration);
        statListenSecondsEl.textContent = formatDurationLong(stats.totalListenSeconds);
    },

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
        this._renderDebugConsoleList(panelEl);
        wireDebugConsolePanelActions(panelEl); // core/settings-misc-ui.js
    },

    /** Ứng với `settingsMisc.debugConsole.copy.click` (nút Copy, wire 1 lần ở core/settings-misc-
     * ui.js). Public — Router gọi trực tiếp. */
    async copyDebugConsoleLog() {
        const logs = getDebugConsoleLogs(); // core/debug-console.js
        const text = logs.map((l) => `[${new Date(l.time).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.text}`).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            alertModal(t('settingsMisc.debugConsole.copiedMsg'));
        } catch (e) {
            alertModal(t('settingsMisc.debugConsole.copyFailedMsg'));
        }
    },

    /** Ứng với `settingsMisc.debugConsole.clear.click` (nút Xoá). Public — Router gọi trực tiếp. */
    clearDebugConsoleLog() {
        clearDebugConsoleLogs(); // core/debug-console.js
        if (this._debugConsolePanelEl) this._renderDebugConsoleList(this._debugConsolePanelEl);
    },

    /** Vẽ lại TOÀN BỘ danh sách log vào `#debug-console-list` bên trong `panelEl` — gọi lúc mở
     * panel LẪN sau khi bấm "Xoá" (danh sách rỗng lại). Tự cuộn xuống dòng MỚI NHẤT sau khi vẽ.
     * `escapeHtml()` (core/modal-choice-ui.js) BẮT BUỘC — nội dung log có thể chứa bất kỳ ký tự nào
     * (object dump, tên file người dùng...), gán qua `innerHTML` không escape sẽ vỡ layout/lộ XSS.
     * @param {HTMLElement} panelEl
     */
    _renderDebugConsoleList(panelEl) {
        const listEl = panelEl.querySelector('#debug-console-list');
        if (!listEl) return;
        const logs = getDebugConsoleLogs(); // core
        if (logs.length === 0) {
            listEl.textContent = t('settingsMisc.debugConsole.emptyMsg');
            return;
        }
        listEl.innerHTML = logs.map((l) => {
            const color = l.level === 'error' ? 'text-rose-400' : l.level === 'warn' ? 'text-amber-400' : 'text-slate-300';
            const time = new Date(l.time).toLocaleTimeString();
            return `<div class="${color} mb-1 break-all whitespace-pre-wrap">[${time}] ${escapeHtml(l.text)}</div>`;
        }).join('');
        listEl.scrollTop = listEl.scrollHeight;
    },

    // ===================== appRecovery =====================

    /** Ứng với msg.type = 'settingsMisc.restartApp.click' — modal xác nhận; OK gửi tiếp message
     *  MỚI qua bus ('settingsMisc.restartApp.confirm'), không gọi tắt thẳng core (đúng mục 2.1). */
    askRestartApp(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.appRecovery.restartBody'),
            [
                { label: t('common.appRecovery.restartConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
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
                { label: t('common.appRecovery.restoreDefaultsConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.restoreDefaultsTitle') }
        );
    },

    /** Ứng với msg.type = 'settingsMisc.restoreDefaults.confirm'. THAY executeRestoreDefaults() cũ
     * (core/app-recovery.js, đã XOÁ) — SỬA (12/08/2026, Giang chỉ ra 2a/2b "Reset app default"
     * THỰC RA là yêu cầu RESET, bản trước mình hiểu ngược thành loại trừ) — giờ reset ĐỦ CẢ 3:
     *   1. vizConfig (màu/hiệu ứng/EQ đang chọn/cử chỉ/...) — restoreDefaultVizConfig() (core), như cũ.
     *   2. visualBgConfig (Visual Background: video/ảnh/slideshow nền màn Visualizer) — MỚI, mục 2a
     *      — restoreDefaultVisualBgConfig() (core/config.js) + workflowVisualBg._persist() (Workflow
     *      gọi Workflow tự do, DÙNG LẠI hàm persist có sẵn thay vì chép lại setMeta() ở đây).
     *   3. 5 preset EQ GỐC (KHÔNG khoá) trong meta.eqPresets — khôi phục ĐẦY ĐỦ tên+gains về bản
     *      factory (buildDefaultEqPresets(), core/eq-presets.js) — MỚI, mục 2b. KHÁC nút Reset
     *      RIÊNG từng preset ở Edit EQ header (mục 2c, CHỈ đổi gains, giữ tên đang sửa dở — xem
     *      event/workflow/eq-presets.js::_resetEditToDefault()): reset TOÀN APP restore ĐẦY ĐỦ vì
     *      đây là "về lại y hệt lúc mới cài", không phải sửa dở tay. Preset NGƯỜI DÙNG TỰ TẠO (id
     *      không khớp 6 id cố định, generateEqPresetId() không bao giờ trùng) GIỮ NGUYÊN — reset
     *      app KHÔNG có nghĩa xoá sạch preset người dùng tự tạo, chỉ đưa phần GỐC về lại nguyên bản.
     * Đợi (await Promise.all) CẢ 2 lượt persist bất đồng bộ (visualBgConfig + eqPresets) xong rồi
     * mới reload — reload sớm hơn sẽ mất trắng phần vừa ghi (race, IndexedDB ghi bất đồng bộ). */
    async confirmRestoreDefaults() {
        restoreDefaultVizConfig(); // core/config.js
        restoreDefaultVisualBgConfig(); // core/config.js

        const factoryById = {};
        buildDefaultEqPresets().forEach((p) => { factoryById[p.id] = { ...p }; }); // core/eq-presets.js
        const restoredPresets = appState.get('eqPresets').map((p) => factoryById[p.id] || p);
        appState.set('eqPresets', restoredPresets);

        saveConfig(); // core/config.js — vizConfig, đồng bộ (localStorage)
        await Promise.all([
            workflowVisualBg._persist(), // event/workflow/visual-bg.js
            setMeta('eqPresets', restoredPresets), // service/db.js
        ]);
        location.reload();
    },

    /** MỚI (14/07/2026, Giang yêu cầu — "nút xoá cache js/css cho page") — ứng với msg.type =
     * 'settingsMisc.clearCache.click'. */
    askClearCache(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.appRecovery.clearCacheBody'),
            [
                { label: t('common.appRecovery.clearCacheConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.clearCacheTitle') }
        );
    }
};
