/**
 * Component: màn Settings > System > Ghi âm (MỚI 01/10/2026; DỜI 05/10/2026 từ Visualizer Screen > Player, Giang yêu cầu). 2 dòng, toggle
 * trước slider: Khử tiếng vọng (echoCancellation, mặc định bật) + Bù trễ giọng (latencyMs, 0-500ms, bước 10).
 * Domain AppConfig 'recorder' (core/config.js), lưu bền meta.recorderConfig (event/workflow/recorder.js).
 * Wire: core/app-settings-ui.js::wireAppSettingsRecorder() -> router 'appSettings'.
 * Hằng số slider (RECORDER_LATENCY_*) ở core/recorder.js — chỉ đọc lúc render (sau khi mọi file đã nạp).
 */
function renderRecorderSettingsBody(cfg) {
    return `
        <div>
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText">${t('recorderSettings.groupTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                <div class="flex justify-between items-center gap-3 p-4 border-b" data-uitk="dividerBorder">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-sm font-medium">${t('recorderSettings.echoCancellation.label')}</span>
                        ${infoIconHtml(t('recorderSettings.echoCancellation.info'))}
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-recorder-echo-cancellation" class="sr-only peer" ${cfg.echoCancellation ? 'checked' : ''}>
                        <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" data-uitk="toggleTrackOff toggleTrackOn"></div>
                    </label>
                </div>
                <div class="flex flex-col p-4">
                    <div class="flex justify-between items-center mb-3">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="text-sm font-medium">${t('recorderSettings.latency.label')}</span>
                            ${infoIconHtml(t('recorderSettings.latency.info'))}
                        </div>
                        <span id="setting-recorder-latency-value" class="text-xs font-mono" data-uitk="accentText">${cfg.latencyMs} ms</span>
                    </div>
                    <input type="range" id="setting-recorder-latency" min="${RECORDER_LATENCY_MIN_MS}" max="${RECORDER_LATENCY_MAX_MS}" step="${RECORDER_LATENCY_STEP_MS}" value="${cfg.latencyMs}" class="ce-slider">
                </div>
            </div>
            <p class="text-xs mt-2 ml-2" data-uitk="textSecondary">${t('recorderSettings.hint')}</p>
        </div>
    `;
}
