/**
 * lang/patch/patch-subtitle-editor.js — i18n cho trang `subtitle-editor.html` (MỚI, 10/07/2026).
 * KHÁC `patch-subtitle-settings.js` (toggle Bật/Tắt phụ đề trong Cài đặt, KHÔNG đổi).
 */
const LANG_PATCH_SUBTITLE_EDITOR = {
    'subtitleEditor.invalidLink': 'This link is invalid or has expired.',
    'subtitleEditor.songNotFound': 'Song not found — it may have been deleted.',
    'subtitleEditor.errorTitle': 'Unable to open',
    'subtitleEditor.saved': 'Subtitles saved.',
    'subtitleEditor.waveformError': 'Unable to load the waveform. You can still add/edit lines using the tools below (timing tools that need the waveform selection won\'t work).',
    'subtitleEditor.btnBack': 'Back',
    'subtitleEditor.btnSave': 'Save',
    'subtitleEditor.autoTiming.defaultText': 'New subtitle',
    'subtitleEditor.newLine.defaultText': 'New subtitle',
    'subtitleEditor.line.placeholder': 'Subtitle text...',
    'subtitleEditor.line.btnApply': 'Apply changes',
    'subtitleEditor.line.btnRemove': 'Remove line',
    // MỚI (yêu cầu Giang) — nút ▶ mỗi dòng, phát đúng [start,end] của dòng đó rồi dừng.
    'subtitleEditor.line.btnPlayRange': 'Play this line',
    'subtitleEditor.listEmpty': 'No subtitles yet. Use the tools below to add some.',
    'subtitleEditor.btnUpload.title': 'Upload .srt',
    'subtitleEditor.btnAutoTiming.title': 'Auto timing',
    'subtitleEditor.btnAddSub.title': 'Add line',
    'subtitleEditor.btnCreateFromSelection.title': 'From selection',
    // MỚI (yêu cầu Giang) — tool "Split": chia vùng chọn hiện tại thành x dòng đều nhau.
    'subtitleEditor.btnSplit.title': 'Split',
    'subtitleEditor.split.title': 'Split into lines',
    'subtitleEditor.split.desc': 'Divide the current selection ({start} → {end}) into equal lines. New lines are added empty (placeholder text) — fill them in afterward.',
    'subtitleEditor.split.confirm': 'Split',
    'subtitleEditor.btnPlaySelection.title': 'Play selection',
    'subtitleEditor.btnExportSrt': 'Export .srt',
    // MỚI (11/07/2026, yêu cầu Giang, mục 2) — nút cảnh báo góc trái trên khung waveform, mở bảng
    // xem console.log/warn/error trực tiếp trên màn hình (không cần devtools).
    'subtitleEditor.btnDebugLog.title': 'View debug log',
    'subtitleEditor.debugLogEmpty': 'No log entries yet.',
    // MỚI (11/07/2026, yêu cầu Giang) — 2 nút mũi tên cuộn thanh công cụ (KHÔNG có nền riêng, chỉ
    // đổi màu icon — xem subtitle-editor.html #btn-toolbar-scroll-left/right).
    'subtitleEditor.btnToolbarScrollLeft.title': 'Scroll tools left',
    'subtitleEditor.btnToolbarScrollRight.title': 'Scroll tools right',
};
