/**
 * components/settings/troubleshooting.js — MỚI (20/09/2026, Giang yêu cầu gộp Debug console + Reset app +
 * "scan check thumb full res video và fix" vào nhóm Troubleshooting). Template tĩnh cho 2 màn trong Setting
 * (Generic Drawer, event/workflow/app-settings.js) — Rule 5d: chỉ trả chuỗi HTML, KHÔNG addEventListener.
 *
 *   1. `renderTroubleshootingBody()` — màn danh sách PHẲNG, 4 hàng NGANG HÀNG (không chia nhóm/tiêu đề):
 *        [Debug console >]                — mở màn con (`data-app-settings-nav="debugConsole"`)
 *        [Restore default settings]       — bấm là hỏi xác nhận (`data-troubleshooting-action`)
 *        [Clear app cache]                — bấm là hỏi xác nhận (`data-troubleshooting-action`)
 *        [Scan & fix video thumbnails >]  — mở màn con (`data-app-settings-nav="videoThumb"`)
 *      "Restore default settings" và "Clear app cache" là 2 hàng RIÊNG cùng cấp với Debug console (THAY
 *      modalChoice 3 nút "Reset app" cũ). "Restart app" (nút thứ 3 của modal cũ) KHÔNG ở đây — đã chuyển lên
 *      icon header Playlist (components/playlist-view.js, id "setting-restart-app").
 *      Wire: core/app-settings-ui.js::wireAppSettingsTroubleshooting().
 *
 *   2. `renderVideoThumbRepairBody()` — màn "Scan & fix video thumbnails": CHỈ phần kiểm tra + sửa thumb
 *      (cover/full-res) của Video, DỜI từ logic quét của Storage. KHÔNG phải "Scan & clean broken files" của
 *      Storage — khối đó (quét Song/Video/Photo hỏng thật, xoá) GIỮ NGUYÊN ở panel Storage. Id riêng
 *      `*video-thumb*` (không dùng lại id `storage-scan-*` của Storage để 2 luồng không lẫn state).
 *      Wire: core/app-settings-ui.js::wireAppSettingsVideoThumb(). Xử lý: event/workflow/file-manager-storage.js
 *      (`executeScanVideoThumbs()`/`executeRepairBroken()`), router 'fileManagerStorage' (case
 *      'fileManagerStorage.videoThumb.*').
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
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" /></svg>
            <div class="min-w-0">
                <div class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${labelHtml}</div>
                <div class="text-xs mt-0.5" data-uitk="textSecondary">${hintHtml}</div>
            </div>
        </button>
    `;
}

function renderTroubleshootingBody() {
    return `
        ${_renderTroubleshootingNavRow('debugConsole', 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', t('settingsMisc.debugConsole.title'), t('appSettings.troubleshooting.debugConsole.hint'))}
        ${_renderTroubleshootingActionRow('restoreDefaults', 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', t('appSettings.resetApp.restoreDefaults.label'), t('appSettings.resetApp.restoreDefaults.hint'))}
        ${_renderTroubleshootingActionRow('clearCache', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', t('appSettings.resetApp.clearCache.label'), t('appSettings.resetApp.clearCache.hint'))}
        ${_renderTroubleshootingNavRow('videoThumb', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', t('appSettings.troubleshooting.videoThumb.label'), t('appSettings.troubleshooting.videoThumb.hint'))}
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
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
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
