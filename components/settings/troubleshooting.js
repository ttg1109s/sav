/**
 * components/settings/troubleshooting.js — MỚI (20/09/2026, Giang yêu cầu gộp Debug console + Reset app +
 * "scan check thumb full res video và fix" vào nhóm Troubleshooting). Template tĩnh cho 2 màn trong Setting
 * (Generic Drawer, event/workflow/app-settings.js) — Rule 5d: chỉ trả chuỗi HTML, KHÔNG addEventListener.
 *
 *   1. `renderTroubleshootingBody()` — màn danh sách PHẲNG, 5 hàng NGANG HÀNG (không chia nhóm/tiêu đề).
 *      SỬA (05/10/2026, Giang yêu cầu sắp xếp lại) — 3 màn con lên trên, 2 hàng hành động nguy hiểm xuống CUỐI:
 *        [Debug console >]                — mở màn con (`data-app-settings-nav="debugConsole"`)
 *        [Scan & fix video thumbnails >]  — mở màn con (`data-app-settings-nav="videoThumb"`)
 *        [Performance HUD >]              — mở màn con (`data-app-settings-nav="perfHud"`, MỚI 05/10/2026 — trước đó
 *                                           là 1 card công tắc nằm thẳng trong danh sách)
 *        [Restore default settings]       — bấm là hỏi xác nhận (`data-troubleshooting-action`)
 *        [Clear app cache]                — bấm là hỏi xác nhận (`data-troubleshooting-action`)
 *      "Restart app" KHÔNG ở đây — icon header Playlist (components/playlist-view.js, id "setting-restart-app").
 *      Wire: core/app-settings-ui.js::wireAppSettingsTroubleshooting().
 *
 *   2. `renderVideoThumbRepairBody()` — màn "Scan & fix video thumbnails": CHỈ phần kiểm tra + sửa thumb
 *      (cover/full-res) của Video, DỜI từ logic quét của Storage. KHÔNG phải "Scan & clean broken files" của
 *      Storage — khối đó (quét Song/Video/Photo hỏng thật, xoá) GIỮ NGUYÊN ở panel Storage. Id riêng
 *      `*video-thumb*` (không dùng lại id `storage-scan-*` của Storage để 2 luồng không lẫn state).
 *      Wire: core/app-settings-ui.js::wireAppSettingsVideoThumb(). Xử lý: event/workflow/file-manager-storage.js
 *      (`executeScanVideoThumbs()`/`executeRepairBroken()`), router 'fileManagerStorage' (case
 *      'fileManagerStorage.videoThumb.*').
 *
 *   3. `renderPerfHudSettingsBody(cfg)` — MỚI (05/10/2026) — màn con "Performance HUD": [Hiển thị (công tắc)] +
 *      [Kiểu: Strip / Chi tiết] + [Chiều: Ngang / Dọc — CHỈ hiện khi Kiểu = Strip]. Wire:
 *      core/app-settings-ui.js::wireAppSettingsPerfHud() -> router 'perfHud' (event/workflow/perf-hud.js).
 */

/** 1 hàng ĐIỀU HƯỚNG (mở màn con) — cùng khuôn card với renderAppSettingsRowList()
 * (components/settings/app-settings-main.js). */
function _renderTroubleshootingNavRow(key, iconPath, labelHtml, hintHtml) {
    return `
        <button type="button" data-app-settings-nav="${key}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3" data-uitk="cardBg cardBorder cardHoverBg">
            <div class="flex items-center gap-3 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" data-uitk="accentTextSoft" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" /></svg>
                <div class="min-w-0">
                    <div class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${labelHtml}</div>
                    <div class="text-xs mt-0.5" data-uitk="textSecondary">${hintHtml}</div>
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" data-uitk="textMutedIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `;
}

/** 1 hàng HÀNH ĐỘNG (bấm là chạy luôn nhánh xác nhận, không mở màn con) — icon đỏ, không có chevron. */
function _renderTroubleshootingActionRow(action, iconPath, labelHtml, hintHtml) {
    return `
        <button type="button" data-troubleshooting-action="${action}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center gap-3" data-uitk="cardBg cardBorder cardHoverBg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" data-uitk="destructiveText" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" /></svg>
            <div class="min-w-0">
                <div class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${labelHtml}</div>
                <div class="text-xs mt-0.5" data-uitk="textSecondary">${hintHtml}</div>
            </div>
        </button>
    `;
}

/** SỬA (05/10/2026, Giang yêu cầu) — Performance HUD thành màn con; Restore default settings + Clear app cache xuống cuối. */
function renderTroubleshootingBody() {
    return `
        ${_renderTroubleshootingNavRow('debugConsole', 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', t('settingsMisc.debugConsole.title'), t('appSettings.troubleshooting.debugConsole.hint'))}
        ${_renderTroubleshootingNavRow('videoThumb', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', t('appSettings.troubleshooting.videoThumb.label'), t('appSettings.troubleshooting.videoThumb.hint'))}
        ${_renderTroubleshootingNavRow('perfHud', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', t('appSettings.troubleshooting.perfHud.label'), t('appSettings.troubleshooting.perfHud.hint'))}
        ${_renderTroubleshootingActionRow('restoreDefaults', 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', t('appSettings.resetApp.restoreDefaults.label'), t('appSettings.resetApp.restoreDefaults.hint'))}
        ${_renderTroubleshootingActionRow('clearCache', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', t('appSettings.resetApp.clearCache.label'), t('appSettings.resetApp.clearCache.hint'))}
    `;
}


function renderVideoThumbRepairBody() {
    return `
        <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
            <button id="btn-video-thumb-scan" class="flex justify-between items-center p-4 w-full text-left" data-uitk="cardHoverBg">
                <div>
                    <div class="text-sm font-medium">${t('appSettings.troubleshooting.videoThumb.label')}</div>
                    <div class="text-xs mt-0.5" data-uitk="textSecondary">${t('appSettings.troubleshooting.videoThumb.hint')}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" data-uitk="cautionText" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
            </button>
            <div id="video-thumb-scan-result" class="hidden p-4 flex flex-col gap-3 border-t" data-uitk="dividerBorder">
                <p id="video-thumb-scan-summary" class="text-sm" data-uitk="textPrimary"></p>
                <div id="video-thumb-scan-list" class="flex flex-col gap-1.5 max-h-48 overflow-y-auto text-xs" data-uitk="textSecondary"></div>
                <div class="flex gap-3 mt-1">
                    <button id="btn-video-thumb-fix" class="flex-1 py-2.5 rounded-xl text-sm font-semibold" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('appSettings.troubleshooting.videoThumb.btnFix')}</button>
                    <button id="btn-video-thumb-dismiss" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText">${t('storageDrawer.btnDismissScan')}</button>
                </div>
            </div>
        </div>
    `;
}

/** 1 hàng chọn dạng nút đoạn (segmented) — nút đang chọn tô nền chính (cùng khuôn nút Ngang/Dọc bản trước).
 * @param {string} labelHtml @param {string} dataAttr - tên data-* gắn trên từng nút
 * @param {Array<{value:string, label:string, icon:string}>} options @param {string} current @param {boolean} withDivider */
function _renderPerfHudSegmentRow(labelHtml, dataAttr, options, current, withDivider) {
    const buttonsHtml = options.map((opt) => `
                <button type="button" ${dataAttr}="${opt.value}" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5" data-uitk="${opt.value === current ? 'btnPrimaryBg textOnAccent' : 'btnNeutralBg btnNeutralText'}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${opt.icon}" /></svg>
                    <span>${opt.label}</span>
                </button>`).join('');
    return `
            <div class="flex justify-between items-center gap-3 p-4${withDivider ? ' border-t' : ''}" data-uitk="dividerBorder">
                <span class="text-sm font-medium">${labelHtml}</span>
                <div class="flex gap-2 shrink-0">${buttonsHtml}
                </div>
            </div>`;
}

/** MỚI (05/10/2026, Giang yêu cầu) — màn con Performance HUD. Thứ tự trong card: công tắc trước, 2 hàng chọn sau.
 * Hàng Chiều CHỈ có khi Kiểu = strip (kiểu chi tiết không có chiều). Workflow vẽ lại màn mỗi lần đổi Kiểu/Chiều.
 * @param {{enabled:boolean, style:string, orientation:string}} cfg - domain AppConfig 'perfHud' (core/config.js) */
function renderPerfHudSettingsBody(cfg) {
    const STYLE_OPTIONS = [
        { value: 'strip', label: t('appSettings.troubleshooting.perfHud.style.strip'), icon: 'M4 9h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zm5 0v6m5-6v6' },
        { value: 'detail', label: t('appSettings.troubleshooting.perfHud.style.detail'), icon: 'M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zM4 10h16M8 14h5m-5 3h3' },
    ];
    const ORIENTATION_OPTIONS = [
        { value: 'horizontal', label: t('appSettings.troubleshooting.perfHud.horizontal'), icon: 'M4 12h16M4 12l3-3m-3 3l3 3m13-3l-3-3m3 3l-3 3' },
        { value: 'vertical', label: t('appSettings.troubleshooting.perfHud.vertical'), icon: 'M12 4v16M12 4l-3 3m3-3l3 3m-3 13l-3-3m3 3l3-3' },
    ];
    const orientationRowHtml = cfg.style === 'strip'
        ? _renderPerfHudSegmentRow(t('appSettings.troubleshooting.perfHud.orientation'), 'data-perf-hud-orientation', ORIENTATION_OPTIONS, cfg.orientation, true)
        : '';
    return `
        <div>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                <div class="flex justify-between items-center gap-3 p-4">
                    <div class="min-w-0">
                        <div class="text-sm font-medium">${t('appSettings.troubleshooting.perfHud.enabled')}</div>
                        <div class="text-xs mt-0.5" data-uitk="textSecondary">${t('appSettings.troubleshooting.perfHud.hint')}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-perf-hud-enabled" class="sr-only peer" ${cfg.enabled ? 'checked' : ''}>
                        <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" data-uitk="toggleTrackOff toggleTrackOn"></div>
                    </label>
                </div>
                ${_renderPerfHudSegmentRow(t('appSettings.troubleshooting.perfHud.style'), 'data-perf-hud-style', STYLE_OPTIONS, cfg.style, true)}
                ${orientationRowHtml}
            </div>
            <p class="text-xs mt-2 ml-2" data-uitk="textSecondary">${t('appSettings.troubleshooting.perfHud.footnote')}</p>
        </div>
    `;
}
