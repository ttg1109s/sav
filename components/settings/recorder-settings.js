/**
 * Component: màn Settings > System > Ghi âm (MỚI 01/10/2026; DỜI 05/10/2026 từ Visualizer Screen > Player, Giang yêu cầu).
 * VIẾT LẠI (07/10/2026, Giang — cải tiến Ghi âm, tên tính năng theo các app karaoke/thu âm phổ biến):
 *   - Recording mode (select): Speaker (chỉ mic — nhạc từ loa + giọng) / Headphones (nhạc gốc + mic).
 *   - Count-in (select): Tắt / 3 / 5 giây đếm ngược trước khi nhạc + ghi cùng bắt đầu.
 *   - Recording quality (select): bitrate bản ghi.
 *   - CHỈ ở Headphones: Sync (slider, trước là "Bù trễ giọng") + Latency calibration (nút Đo).
 *   - Toggle "Khử tiếng vọng" (echoCancellation) ĐÃ BỎ — mic luôn thu thô (core/recorder.js::buildRecorderMicConstraints()).
 * Thứ tự trong card: select -> slider -> nút (cùng tinh thần "toggle > select > slider" Giang chốt cho Custom Effect).
 * Domain AppConfig 'recorder' (core/config.js), lưu bền meta.recorderConfig (event/workflow/recorder.js).
 * Wire: core/app-settings-ui.js::wireAppSettingsRecorder() -> router 'appSettings'. Hằng số (RECORDER_*) ở core/recorder.js —
 * chỉ đọc lúc render (sau khi mọi file đã nạp).
 */

/** 1 dòng select: nhãn + info + <select>. @param {string} id @param {string} labelKey @param {string} infoKey
 * @param {{value: (string|number), labelKey: string}[]} options @param {(string|number)} current */
function _renderRecorderSelectRow(id, labelKey, infoKey, options, current) {
    const opts = options.map((o) => `<option value="${o.value}" ${String(o.value) === String(current) ? 'selected' : ''}>${t(o.labelKey)}</option>`).join('');
    return `
        <div class="flex justify-between items-center gap-3 p-4 border-b" data-uitk="dividerBorder">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-medium">${t(labelKey)}</span>
                ${infoIconHtml(t(infoKey))}
            </div>
            <select id="${id}" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right shrink-0" data-uitk="inputBg inputBorder inputText">${opts}</select>
        </div>
    `;
}

/** Sync + Latency calibration — chỉ chế độ Headphones (Speaker: nhạc và giọng cùng tới mic, không có gì để căn). */
function _renderRecorderSyncRows(cfg) {
    return `
        <div class="flex flex-col p-4 border-b" data-uitk="dividerBorder">
            <div class="flex justify-between items-center mb-3">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="text-sm font-medium">${t('recorderSettings.sync.label')}</span>
                    ${infoIconHtml(t('recorderSettings.sync.info'))}
                </div>
                <span id="setting-recorder-latency-value" class="text-xs font-mono" data-uitk="accentText">${cfg.latencyMs} ms</span>
            </div>
            <input type="range" id="setting-recorder-latency" min="${RECORDER_LATENCY_MIN_MS}" max="${RECORDER_LATENCY_MAX_MS}" step="${RECORDER_LATENCY_STEP_MS}" value="${cfg.latencyMs}" class="ce-slider">
        </div>
        <div class="flex justify-between items-center gap-3 p-4" data-uitk="dividerBorder">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-medium">${t('recorderSettings.calibration.label')}</span>
                ${infoIconHtml(t('recorderSettings.calibration.info'))}
            </div>
            <button type="button" id="setting-recorder-calibrate" class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('recorderSettings.calibration.button')}</button>
        </div>
    `;
}

function renderRecorderSettingsBody(cfg) {
    const isHeadphones = cfg.mode === 'headphones';
    return `
        <div>
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText">${t('recorderSettings.groupTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                ${_renderRecorderSelectRow('setting-recorder-mode', 'recorderSettings.mode.label', 'recorderSettings.mode.info', RECORDER_MODES.map((m) => ({ value: m, labelKey: `recorderSettings.mode.${m}` })), cfg.mode)}
                ${_renderRecorderSelectRow('setting-recorder-count-in', 'recorderSettings.countIn.label', 'recorderSettings.countIn.info', RECORDER_COUNT_IN_OPTIONS.map((sec) => ({ value: sec, labelKey: `recorderSettings.countIn.${sec}` })), cfg.countInSec)}
                ${_renderRecorderSelectRow('setting-recorder-quality', 'recorderSettings.quality.label', 'recorderSettings.quality.info', Object.keys(RECORDER_QUALITY_BITRATE).map((q) => ({ value: q, labelKey: `recorderSettings.quality.${q}` })), cfg.quality)}
                ${isHeadphones ? _renderRecorderSyncRows(cfg) : ''}
            </div>
            <p class="text-xs mt-2 ml-2" data-uitk="textSecondary">${t(isHeadphones ? 'recorderSettings.hint.headphones' : 'recorderSettings.hint.speaker')}</p>
            <p class="text-xs mt-1 ml-2" data-uitk="textSecondary">${t('recorderSettings.hint')}</p>
        </div>
    `;
}
