/**
 * Component: màn hình Settings > Visualizer Screen > Player > Video (hoặc Photo) — 2 kind gần như
 * ĐỐI XỨNG nhau (chỉ khác field config đọc/ghi + Photo bỏ vai trò Motion `reactBeat` — không có
 * audio để "react" theo), nên dùng CHUNG đúng 1 hàm render
 * `renderPlayerDisplayBody(kind, cfg, motionPresetOptions)` thay vì viết 2 lần.
 *
 * 2 nhóm card:
 *   1. Resolution — 1 select 3 lựa chọn (PLAYER_RESOLUTION_MODES, core/player-display-settings.js).
 *   2. Motion — 3-4 select ĐỘC LẬP tuỳ kind (PLAYER_MOTION_SLOTS lọc theo `kinds`, core/player-
 *      display-settings.js::getPlayerMotionSlotsForKind() — Photo bỏ `reactBeat`), option dựng từ
 *      `motionPresetOptions` (preset ĐÃ đăng ký cho consumer 'player', xem core/motion-
 *      presets.js::getPresetsSubscribedToConsumer()) — CÙNG danh sách cho MỌI select (Giang chốt
 *      "transition/showing chỉ lấy các motion trong danh sách này").
 *
 * GIAI ĐOẠN 1 (Giang chốt "CHƯA code cơ chế hoạt động") — màn này CHỈ đọc/ghi lựa chọn, KHÔNG có
 * preview/áp dụng sống nào lên Video/Photo đang phát thật.
 *
 * Logic: event/workflow/app-settings.js (_renderPlayerDetail()) + event/workflow/player-display-
 * settings.js (workflowPlayerDisplaySettings). Wiring: core/app-settings-ui.js
 * ::wireAppSettingsPlayerDetail() (Rule 5a).
 * NẠP SAU: core/player-display-settings.js (PLAYER_RESOLUTION_MODES/PLAYER_MOTION_SLOTS),
 * core/modal-choice-ui.js (escapeHtml()).
 */

/** Đổ `<option>` cho 1 select Motion — LUÔN kèm 1 option "Không" (value=''), + preset đã đăng ký
 * cho consumer 'player'. `currentId` không nằm trong danh sách (preset vừa bị huỷ đăng ký/xoá) ->
 * chọn "Không" tự nhiên, CÙNG quy ước `_renderMotionPresetOptions()` của VBG (event/workflow/
 * visual-bg-common.js).
 * @param {{id:string,name:string}[]} motionPresetOptions @param {string|null} currentId @returns {string} */
function _buildPlayerMotionSelectOptionsHtml(motionPresetOptions, currentId) {
    const noneOption = `<option value="" ${currentId ? '' : 'selected'}>${t('playerDisplaySettings.motion.none')}</option>`;
    const itemsHtml = motionPresetOptions.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === currentId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    return noneOption + itemsHtml;
}

/** @param {'video'|'photo'} kind @param {object} cfg - appConfigPlayerDisplay.getAll()
 * @param {{id:string,name:string}[]} motionPresetOptions - preset đã đăng ký cho consumer 'player'
 * @returns {string} */
function renderPlayerDisplayBody(kind, cfg, motionPresetOptions) {
    const resolutionField = resolvePlayerResolutionField(kind); // core/player-display-settings.js
    const resolutionOptionsHtml = PLAYER_RESOLUTION_MODES.map((m) => `<option value="${m.value}" ${cfg[resolutionField] === m.value ? 'selected' : ''}>${t(m.labelKey)}</option>`).join('');

    const motionSlots = getPlayerMotionSlotsForKind(kind); // core/player-display-settings.js — Photo lọc bỏ 'reactBeat'
    const motionRowsHtml = motionSlots.map((s, i) => {
        const field = resolvePlayerMotionPresetField(kind, s.slot); // core/player-display-settings.js
        const isLast = i === motionSlots.length - 1;
        return `
            <div class="flex justify-between items-center p-4 ${isLast ? '' : 'border-b'}" data-uitk="${isLast ? '' : 'dividerBorder '}cardHoverBg">
                <span class="text-sm font-medium">${t(s.labelKey)}</span>
                <select id="setting-player-${kind}-motion-${s.slot}" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                    ${_buildPlayerMotionSelectOptionsHtml(motionPresetOptions, cfg[field])}
                </select>
            </div>
        `;
    }).join('');

    return `
        <div>
            <h3 class="text-xs font-bold text-sky-600 uppercase tracking-widest mb-2 ml-2">${t('playerDisplaySettings.resolution.groupTitle')}</h3>
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
            <h3 class="text-xs font-bold text-sky-600 uppercase tracking-widest mb-2 ml-2">${t('playerDisplaySettings.motion.groupTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                ${motionRowsHtml}
            </div>
        </div>
    `;
}
