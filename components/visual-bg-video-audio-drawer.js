/**
 * Component: sub-panel "Âm thanh Video" của Visual Background — MỚI (08/08/2026, phản hồi Giang:
 * "thêm sub panel control audio video khi chọn chế độ source list video cho từng video, tick chọn/
 * tắt audio, tick vào phần volume để nhập % audio").
 *
 * CÙNG khuôn `visual-bg-gradient-drawer.js`: push/pop qua Settings Stack (core/settings-panel-
 * stack-ui.js), template này chỉ dựng KHUNG rỗng — danh sách hàng (1 hàng/video trong
 * `source.list`) vẽ ĐỘNG bởi `workflowVisualBg._renderVideoAudioRows()` (cần đọc DB lấy tên video,
 * không dựng được tại thời điểm build template thuần).
 *
 * Áp dụng CẢ single lẫn list (Giang chốt) — single chỉ hiện đúng 1 hàng.
 * Logic: event/workflow/visual-bg.js (workflowVisualBg). Listener/router: cụm "visualBg" (DÙNG
 * CHUNG cluster, không tách riêng — cùng cách gradient drawer không có listener/router riêng).
 */
function renderVisualBgVideoAudioPanelBody() {
    return `
                <div>
                    <p class="text-xs text-slate-400 mb-3 ml-2" data-i18n="visualBgSettingsDrawer.videoAudio.hint">${t('visualBgSettingsDrawer.videoAudio.hint')}</p>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div id="visual-bg-video-audio-list" class="flex flex-col"></div>
                    </div>
                </div>
`;
}
