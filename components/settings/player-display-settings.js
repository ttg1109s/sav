/**
 * Component: màn hình Settings > Visualizer Screen > Player > Video (hoặc Photo) — 2 kind gần như
 * ĐỐI XỨNG nhau (chỉ khác field config đọc/ghi + Video gộp Point Move+React Beat làm 1 slot
 * `showing` duy nhất, trong khi Photo giữ `pointMove` riêng — Photo không có audio để "react" theo
 * nên không có gì để gộp cùng), nên dùng CHUNG đúng 1 hàm render
 * `renderPlayerDisplayBody(kind, cfg, motionPresets)` thay vì viết 2 lần.
 *
 * 2 nhóm card:
 *   1. Resolution — 1 select 4 lựa chọn (PLAYER_RESOLUTION_MODES, core/player-display-settings.js
 *      — 'cover' MỚI thêm, mặc định).
 *   2. Motion — 3 HÀNG ĐỘC LẬP mỗi kind (PLAYER_MOTION_SLOTS lọc theo `kinds`, core/player-
 *      display-settings.js::getPlayerMotionSlotsForKind() — Video: transitionNext/transitionPrev/
 *      showing; Photo: transitionNext/transitionPrev/pointMove). SỬA (24/09/2026, Giang yêu cầu —
 *      xoá cơ chế đăng ký Motion vào nơi tiêu thụ) — KHÔNG còn select lọc theo preset đã đăng ký cho
 *      consumer 'player': mỗi hàng hiện TÊN preset đang gắn (hoặc "None") + mũi tên, tap -> mở THẲNG
 *      danh sách Motion ở chế độ CHỌN (workflowMotionPresets.openPicker(), qua
 *      workflowPlayerDisplaySettings.openMotionSlotPicker()) — chọn trong TOÀN BỘ preset.
 *
 *   3. Zoom — MỚI (29/09/2026, Giang): 3 dòng CHỈ ĐỌC (mức zoom, Pan X, Pan Y "so với gốc" — % tâm khung đang nhìn
 *      lệch khỏi tâm video/ảnh, core/player-zoom.js::describePlayerZoomForSettings()) + nút reset nhanh về gốc.
 *      Zoom/pan chỉnh bằng cử chỉ ở Zoom mode (kính lúp Control Center), KHÔNG chỉnh ở đây.
 *
 * GIAI ĐOẠN 1 (đăng ký + hiển thị/lưu list) ĐÃ XONG cho MỌI select. GIAI ĐOẠN 2 (cơ chế hoạt động
 * THẬT) — Resolution (core/player-display-apply.js) VÀ React Beat của Video (đọc từ
 * `videoShowingPresetId`, event/workflow/player-display-settings.js) ĐÃ XONG; Transition Next/Prev
 * (cả 2 kind) VÀ Point Move (Photo riêng + phần Point Move của preset gắn ở 'showing' của Video)
 * VẪN CHƯA. Màn hình NÀY tự nó KHÔNG hiện preview sống gì cả — chỉ đọc/ghi lựa chọn, hiệu ứng thấy
 * được lúc THẬT SỰ đang ở Video/Photo Player mode (ngoài Settings).
 *
 * Logic: event/workflow/app-settings.js (_renderPlayerDetail()) + event/workflow/player-display-
 * settings.js (workflowPlayerDisplaySettings). Wiring: core/app-settings-ui.js
 * ::wireAppSettingsPlayerDetail() (Rule 5a).
 * NẠP SAU: core/player-display-settings.js (PLAYER_RESOLUTION_MODES/PLAYER_MOTION_SLOTS),
 * core/modal-choice-ui.js (escapeHtml()), core/motion-presets.js (findMotionPresetById()).
 */

/** MỚI (24/09/2026) — THAY `_buildPlayerMotionSelectOptionsHtml()` (select cũ) — tên hiển thị của preset
 * đang gắn cho 1 vai trò: tên preset, hoặc "None" nếu chưa gắn / id trỏ tới preset đã bị xoá (CÙNG quy
 * ước runtime — event/workflow/player-display-settings.js coi id không tồn tại là "chưa gắn").
 * @param {object[]} motionPresets @param {string|null} currentId @returns {string} */
function _resolvePlayerMotionSlotName(motionPresets, currentId) {
    const preset = findMotionPresetById(motionPresets, currentId); // core/motion-presets.js
    return preset ? preset.name : t('playerDisplaySettings.motion.none');
}

/** @param {'video'|'photo'} kind @param {object} cfg - appConfigPlayerDisplay.getAll()
 * @param {object[]} motionPresets - TOÀN BỘ `appState.motionPresets` (chỉ để tra tên preset đang gắn)
 * @returns {string} */
/** MỚI (29/09/2026) — định dạng % pan có dấu (+/−), 1 chữ số thập phân; -0 -> 0. @param {number} value @returns {string} */
function _formatPlayerZoomPanPercent(value) {
    const rounded = Math.round(value * 10) / 10;
    const safe = Object.is(rounded, -0) ? 0 : rounded;
    return `${safe > 0 ? '+' : ''}${safe.toFixed(1)}%`;
}

function renderPlayerDisplayBody(kind, cfg, motionPresets) {
    const resolutionField = resolvePlayerResolutionField(kind); // core/player-display-settings.js
    const resolutionOptionsHtml = PLAYER_RESOLUTION_MODES.map((m) => `<option value="${m.value}" ${cfg[resolutionField] === m.value ? 'selected' : ''}>${t(m.labelKey)}</option>`).join('');

    const motionSlots = getPlayerMotionSlotsForKind(kind); // core/player-display-settings.js — mỗi kind chỉ lấy đúng slot của mình (Video: showing; Photo: pointMove)
    const motionRowsHtml = motionSlots.map((s, i) => {
        const field = resolvePlayerMotionPresetField(kind, s.slot); // core/player-display-settings.js
        const isLast = i === motionSlots.length - 1;
        return `
            <button type="button" data-player-motion-slot="${s.slot}" class="flex justify-between items-center gap-3 p-4 w-full text-left ${isLast ? '' : 'border-b'}" data-uitk="${isLast ? '' : 'dividerBorder '}cardHoverBg">
                <span class="text-sm font-medium shrink-0">${t(s.labelKey)}</span>
                <span class="flex items-center gap-1 min-w-0">
                    <span class="text-xs truncate" data-uitk="textSecondary">${escapeHtml(_resolvePlayerMotionSlotName(motionPresets, cfg[field]))}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" data-uitk="textMutedIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </span>
            </button>
        `;
    }).join('');

    const zoomInfo = describePlayerZoomForSettings(sanitizePlayerZoom(cfg[resolvePlayerZoomField(kind)])); // core/player-zoom.js + core/player-display-settings.js
    const zoomRowsHtml = [
        { labelKey: 'playerDisplaySettings.zoom.scale', value: `${zoomInfo.scale.toFixed(2)}×` },
        { labelKey: 'playerDisplaySettings.zoom.panX', value: _formatPlayerZoomPanPercent(zoomInfo.panXPercent) },
        { labelKey: 'playerDisplaySettings.zoom.panY', value: _formatPlayerZoomPanPercent(zoomInfo.panYPercent) },
    ].map((row) => `
        <div class="flex justify-between items-center gap-3 p-4 border-b" data-uitk="dividerBorder">
            <span class="text-sm font-medium">${t(row.labelKey)}</span>
            <span class="text-xs tabular-nums" data-uitk="textSecondary">${row.value}</span>
        </div>
    `).join('');

    return `
        <div>
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText">${t('playerDisplaySettings.resolution.groupTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                <div class="flex justify-between items-center p-4" data-uitk="cardHoverBg">
                    <span class="text-sm font-medium">${t('playerDisplaySettings.resolution.label')}</span>
                    <select id="setting-player-${kind}-resolution" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                        ${resolutionOptionsHtml}
                    </select>
                </div>
            </div>
        </div>

        <div class="mt-6">
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText">${t('playerDisplaySettings.motion.groupTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                ${motionRowsHtml}
            </div>
        </div>

        <div class="mt-6">
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText">${t('playerDisplaySettings.zoom.groupTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                ${zoomRowsHtml}
                <button type="button" id="setting-player-${kind}-zoom-reset" class="w-full p-4 text-sm font-medium text-center" data-uitk="cardHoverBg accentText">${t('playerDisplaySettings.zoom.reset')}</button>
            </div>
            <p class="text-xs mt-2 ml-2" data-uitk="textSecondary">${t('playerDisplaySettings.zoom.hint')}</p>
        </div>
    `;
}
