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
     * MỚI (18/07/2026, Giang yêu cầu — "mục mới Settings > Misc, vào hiện console log") — ứng với
     * msg.type = 'settingsMisc.debugConsole.open'. Push panel + vẽ danh sách log THẬT (đọc
     * `getDebugConsoleLogs()`, core/debug-console.js) + wire 2 nút Copy/Xoá.
     */
    async openDebugConsole() {
        const panelEl = pushSettingsPanel({ title: t('settingsMisc.debugConsole.title'), bodyHtml: renderDebugConsolePanelBody() });
        this._renderDebugConsoleList(panelEl);

        const copyBtn = panelEl.querySelector('#btn-debug-console-copy');
        const clearBtn = panelEl.querySelector('#btn-debug-console-clear');

        if (copyBtn) copyBtn.addEventListener('click', async () => {
            const logs = getDebugConsoleLogs(); // core
            const text = logs.map((l) => `[${new Date(l.time).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.text}`).join('\n');
            try {
                await navigator.clipboard.writeText(text);
                alertModal(t('settingsMisc.debugConsole.copiedMsg'));
            } catch (e) {
                alertModal(t('settingsMisc.debugConsole.copyFailedMsg'));
            }
        });

        if (clearBtn) clearBtn.addEventListener('click', () => {
            clearDebugConsoleLogs(); // core
            this._renderDebugConsoleList(panelEl);
        });
    },

    /** Vẽ lại TOÀN BỘ danh sách log vào `#debug-console-list` bên trong `panelEl` — gọi lúc mở
     * panel LẪN sau khi bấm "Xoá" (danh sách rỗng lại). Tự cuộn xuống dòng MỚI NHẤT sau khi vẽ.
     * `escapeHtml()` (core/modal-choice.js) BẮT BUỘC — nội dung log có thể chứa bất kỳ ký tự nào
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
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
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
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.appRecovery.restoreDefaultsConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.restoreDefaultsTitle') }
        );
    },

    /** MỚI (14/07/2026, Giang yêu cầu — "nút xoá cache js/css cho page") — ứng với msg.type =
     * 'settingsMisc.clearCache.click'. */
    askClearCache(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.appRecovery.clearCacheBody'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.appRecovery.clearCacheConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.appRecovery.clearCacheTitle') }
        );
    }
};
