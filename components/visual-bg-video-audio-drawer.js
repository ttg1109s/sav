/**
 * Component: sub-panel "Âm thanh Video" của Visual Background — MỚI (08/08/2026, phản hồi Giang:
 * "thêm sub panel control audio video khi chọn chế độ source list video cho từng video, tick chọn/
 * tắt audio, tick vào phần volume để nhập % audio").
 *
 * CÙNG khuôn `visual-bg-gradient-drawer.js`: push/pop qua Settings Stack (core/settings-panel-
 * stack-ui.js). SỬA (05/10/2026) — nhận SẴN HTML danh sách hàng (1 hàng/video trong `source.list`,
 * `workflowVisualBg.buildVideoAudioListHtml()` dựng sau khi đọc DB lấy tên video) thay vì khung rỗng vẽ sau
 * — Generic Drawer đo đúng chiều cao ngay lúc gắn, không co xuống rồi giãn lên.
 *
 * Áp dụng CẢ single lẫn list (Giang chốt) — single chỉ hiện đúng 1 hàng.
 * Logic: event/workflow/visual-bg.js (workflowVisualBg). Listener/router: cụm "visualBg" (DÙNG
 * CHUNG cluster, không tách riêng — cùng cách gradient drawer không có listener/router riêng).
 */
/** @param {string} listHtml - HTML các hàng (hoặc dòng "trống") */
function renderVisualBgVideoAudioPanelBody(listHtml) {
    return `
                <div>
                    <p class="text-xs mb-3 ml-2" data-uitk="textSecondary" data-i18n="visualBgSettingsDrawer.videoAudio.hint">${t('visualBgSettingsDrawer.videoAudio.hint')}</p>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div id="visual-bg-video-audio-list" class="flex flex-col">${listHtml}</div>
                    </div>
                </div>
`;
}

/**
 * MỚI (07/10/2026, rà soát SVG mục A — dời khỏi Workflow) — icon loa của 1 hàng Video audio: loa có sóng (bật) / loa gạch
 * chéo (tắt), màu theo theme key `stateUitk` (Workflow chọn). Dùng chung lúc vẽ hàng lần đầu lẫn lúc đổi đúng 1 nút sau toggle.
 * @param {boolean} enabled @param {string} stateUitk @returns {string}
 */
function renderVisualBgVideoAudioIconHtml(enabled, stateUitk) {
    return iconSvg(enabled ? 'speaker-wave' : 'speaker-off', 'h-4 w-4', `data-uitk="${stateUitk}"`);
}

/**
 * MỚI (07/10/2026, dời khỏi workflowVisualBg._buildVideoAudioRowsHtml()) — danh sách: tên video | icon loa (bật/tắt ngay) |
 * "x%" (mở modal chỉnh mức). Mỗi hàng đã được Workflow tính sẵn trạng thái.
 * @param {{key:string, name:string, enabled:boolean, volumePercent:number, stateUitk:string}[]} rows @returns {string}
 */
function renderVisualBgVideoAudioRowsHtml(rows) {
    if (rows.length === 0) return `<div class="p-4 text-sm text-center" data-uitk="textSecondary">${t('visualBgSettingsDrawer.videoAudio.empty')}</div>`;
    return rows.map(({ key, name, enabled, volumePercent, stateUitk }) => `
        <div class="p-4 last:border-b-0 flex items-center gap-2 border-b" data-uitk="dividerBorder">
            <span class="text-sm font-medium truncate min-w-0 flex-1">${escapeHtml(name)}</span>
            <button type="button" data-visual-bg-video-audio-toggle="${escapeHtml(key)}" class="shrink-0 p-2 transition-colors">${renderVisualBgVideoAudioIconHtml(enabled, stateUitk)}</button>
            <button type="button" data-visual-bg-video-audio-open-volume="${escapeHtml(key)}" class="shrink-0 px-1 py-2 transition-colors"><span data-visual-bg-video-audio-volume-display="${escapeHtml(key)}" class="text-xs font-mono tabular-nums" data-uitk="${stateUitk}">${volumePercent}%</span></button>
        </div>`).join('');
}
