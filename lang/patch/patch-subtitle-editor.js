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
    // MỚI (yêu cầu Giang) — nút tải lại KHÔNG dùng cache + modal xác nhận.
    'subtitleEditor.btnReload.title': 'Reload (no cache)',
    'subtitleEditor.reloadConfirm.title': 'Reload without cache?',
    'subtitleEditor.reloadConfirm.desc': 'Any edits not yet saved (tap "Save" first) will be lost. Reload anyway?',
    'subtitleEditor.reloadConfirm.confirmBtn': 'Reload',
    'subtitleEditor.btnSave': 'Save',
    'subtitleEditor.autoTiming.defaultText': 'New subtitle',
    'subtitleEditor.newLine.defaultText': 'New subtitle',
    'subtitleEditor.line.placeholder': 'Subtitle text...',
    // KHÔI PHỤC (yêu cầu Giang, mục 3 — "khôi phục lại nút apply") — nút ✓ Áp dụng quay lại, giờ
    // gắn với "chế độ sửa" (bấm vào dòng để sửa) thay vì luôn-sửa-được như bản trước.
    'subtitleEditor.line.btnApply': 'Apply',
    'subtitleEditor.line.btnCancelEdit': 'Cancel edit',
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
    // MỚI (yêu cầu Giang, mục 1) — tool "Cut MP3": cắt vùng chọn thành file .mp3 thật.
    'subtitleEditor.btnCutMp3.title': 'Cut MP3',
    'subtitleEditor.cutMp3.resultTitle': 'Clip ready',
    'subtitleEditor.cutMp3.resultDesc': 'Cut {start} → {end}. What would you like to do with it?',
    'subtitleEditor.cutMp3.download': 'Download',
    'subtitleEditor.cutMp3.insert': 'Add to library',
    'subtitleEditor.cutMp3.newSongTitle': '{title} (cut)',
    'subtitleEditor.cutMp3.inserted': 'Added to your library as a new song.',
    'subtitleEditor.cutMp3.error': 'Could not cut this clip. Please try a shorter selection.',
    'subtitleEditor.btnPlaySelection.title': 'Play selection',
    'subtitleEditor.btnExportSrt': 'Export .srt',
    // MỚI (11/07/2026, yêu cầu Giang, mục 2) — nút cảnh báo góc trái trên khung waveform, mở bảng
    // xem console.log/warn/error trực tiếp trên màn hình (không cần devtools).
    'subtitleEditor.btnDebugLog.title': 'View debug log',
    'subtitleEditor.debugLogEmpty': 'No log entries yet.',
    // MỚI (yêu cầu Giang, mục 3) — nút Copy all + đóng NGAY TRONG bảng debug log.
    'subtitleEditor.debugCopyAll': 'Copy all',
    'subtitleEditor.debugClose.title': 'Close',
    // MỚI (11/07/2026, yêu cầu Giang) — 2 nút mũi tên cuộn thanh công cụ (KHÔNG có nền riêng, chỉ
    // đổi màu icon — xem subtitle-editor.html #btn-toolbar-scroll-left/right).
    'subtitleEditor.btnToolbarScrollLeft.title': 'Scroll tools left',
    'subtitleEditor.btnToolbarScrollRight.title': 'Scroll tools right',
    // MỚI (yêu cầu Giang, mục 2) — 2 nút chốt start/end vùng chọn = vị trí phát hiện tại.
    'subtitleEditor.btnRegionSetStart.title': 'Set start to current time',
    'subtitleEditor.btnRegionSetEnd.title': 'Set end to current time',
    // MỚI (yêu cầu Giang, mục 4) — modal "bánh xe cuộn số" chọn giờ start/end 1 dòng.
    'subtitleEditor.timePicker.titleStart': 'Set start time',
    'subtitleEditor.timePicker.titleEnd': 'Set end time',
    // MỚI (yêu cầu Giang, mục 7 — "thông minh hoá") — hiện rõ khoảng giờ hợp lệ + cảnh báo khi
    // đang cuộn ra ngoài khoảng đó.
    'subtitleEditor.timePicker.rangeHint': 'Valid range: {min} → {max}',
    // XOÁ (yêu cầu Giang, mục 3) — 'subtitleEditor.timePicker.outOfRange' không còn dùng, thay
    // cảnh báo động bằng chặn cuộn thật (rubber-band snap-back), xem openTimePickerModal().
    // MỚI (yêu cầu Giang, mục 5) — tool "Shift": chọn dòng rồi dịch giờ hàng loạt.
    'subtitleEditor.btnShift.title': 'Shift',
    'subtitleEditor.shift.selectedCount': '{n} selected',
    'subtitleEditor.shift.continueBtn': 'Continue',
    'subtitleEditor.shift.modalTitle': 'Shift time',
    'subtitleEditor.shift.modalDesc': 'Shift the timing of {n} selected line(s).',
    'subtitleEditor.shift.amountLabel': 'Shift amount (seconds, use − for earlier)',
    'subtitleEditor.shift.targetLabel': 'Apply to',
    'subtitleEditor.shift.targetBoth': 'Start & end',
    'subtitleEditor.shift.targetStart': 'Start only',
    'subtitleEditor.shift.targetEnd': 'End only',
    'subtitleEditor.shift.applyBtn': 'Apply',
};
