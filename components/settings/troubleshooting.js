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
function _renderTroubleshootingNavRow(key, iconName, labelHtml, hintHtml) {
    return `
        <button type="button" data-app-settings-nav="${key}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3" data-uitk="cardBg cardBorder cardHoverBg">
            <div class="flex items-center gap-3 min-w-0">
                ${iconSvg(iconName, 'h-5 w-5 shrink-0', 'data-uitk="accentTextSoft"')}
                <div class="min-w-0">
                    <div class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${labelHtml}</div>
                    <div class="text-xs mt-0.5" data-uitk="textSecondary">${hintHtml}</div>
                </div>
            </div>
            ${iconSvg('chevron-right', 'h-4 w-4 shrink-0', 'data-uitk="textMutedIcon"')}
        </button>
    `;
}

/** 1 hàng HÀNH ĐỘNG (bấm là chạy luôn nhánh xác nhận, không mở màn con) — icon đỏ, không có chevron. */
function _renderTroubleshootingActionRow(action, iconName, labelHtml, hintHtml) {
    return `
        <button type="button" data-troubleshooting-action="${action}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center gap-3" data-uitk="cardBg cardBorder cardHoverBg">
            ${iconSvg(iconName, 'h-5 w-5 shrink-0', 'data-uitk="destructiveText"')}
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
        ${_renderTroubleshootingNavRow('debugConsole', 'terminal', t('settingsMisc.debugConsole.title'), t('appSettings.troubleshooting.debugConsole.hint'))}
        ${_renderTroubleshootingNavRow('videoThumb', 'video-camera', t('appSettings.troubleshooting.videoThumb.label'), t('appSettings.troubleshooting.videoThumb.hint'))}
        ${_renderTroubleshootingNavRow('perfHud', 'chart-bar', t('appSettings.troubleshooting.perfHud.label'), t('appSettings.troubleshooting.perfHud.hint'))}
        ${_renderTroubleshootingActionRow('restoreDefaults', 'reply', t('appSettings.resetApp.restoreDefaults.label'), t('appSettings.resetApp.restoreDefaults.hint'))}
        ${_renderTroubleshootingActionRow('clearCache', 'trash', t('appSettings.resetApp.clearCache.label'), t('appSettings.resetApp.clearCache.hint'))}
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
                ${iconSvg('search', 'h-5 w-5 shrink-0', 'data-uitk="cautionText"')}
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
                    ${iconSvg(opt.icon, 'h-4 w-4')}
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
        { value: 'strip', label: t('appSettings.troubleshooting.perfHud.style.strip'), icon: 'layout-strip' },
        { value: 'detail', label: t('appSettings.troubleshooting.perfHud.style.detail'), icon: 'layout-card' },
    ];
    const ORIENTATION_OPTIONS = [
        { value: 'horizontal', label: t('appSettings.troubleshooting.perfHud.horizontal'), icon: 'arrows-horizontal' },
        { value: 'vertical', label: t('appSettings.troubleshooting.perfHud.vertical'), icon: 'arrows-vertical' },
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
