/**
 * lang/patch/patch-video-editor.js — i18n cho trang `video-editor.html`. Cùng khuôn
 * `patch-image-edit.js`/`patch-subtitle-editor.js` — nạp ở CẢ `index.html` (bắt buộc, xem docstring
 * `lang/lang.js` — Object.assign() cần ĐỦ mọi biến LANG_PATCH_*) LẪN `video-editor.html`.
 *
 * [v3, 23/07/2026] — bỏ key của bottom-sheet 4 tab cũ (`videoEdit.tab.*`, `videoEdit.panelTitle.*`),
 * bỏ key Split đứng riêng (`videoEdit.split.*`, `videoEdit.btnSplit.title` — nay là "Cắt tại current"
 * trong toolbar theo lựa chọn) và `videoEdit.volSong` (nay Nhạc là NHIỀU clip, âm lượng riêng từng
 * clip — xem `videoEdit.clipVolume.label`). Thêm key cho toolbar icon động + 4 modal mới (Chỉnh/Sửa
 * chữ/Chọn nhạc/Dịch chuyển đoạn).
 */
const LANG_PATCH_VIDEO_EDITOR = {
    'videoEdit.invalidLink': 'This link is invalid or has expired.',
    'videoEdit.videoNotFound': 'Video not found — it may have been deleted.',
    'videoEdit.errorTitle': 'Unable to open',
    'videoEdit.compat.unsupportedBrowser': 'This browser does not support video editing (WebCodecs unavailable).',
    'videoEdit.compat.mediabunnyNotLoaded': 'Video editing library failed to load — check your connection and try again. (Tap the 🐞 button for details.)',
    'videoEdit.compat.noVideoTrack': 'This file has no video track.',
    'videoEdit.compat.codecNotSupported': 'This video format is not supported for editing on this device.',
    'videoEdit.compat.unreadableFile': 'This video file could not be read.',
    'videoEdit.loading': 'Loading video…',
    'videoEdit.btnSave.title': 'Save',
    'videoEdit.discardConfirm.title': 'Discard changes?',
    'videoEdit.discardConfirm.desc': 'Your edits have not been saved. Leave without saving?',

    // Toolbar — mặc định (chưa chọn clip nào).
    'videoEdit.btnCrop.title': 'Crop',
    'videoEdit.btnRotateLeft.title': 'Rotate left',
    'videoEdit.btnRotateRight.title': 'Rotate right',
    'videoEdit.btnAdjust.title': 'Adjust',
    'videoEdit.btnReset.title': 'Reset',
    'videoEdit.btnExtractFrame.title': 'Extract photo',
    'videoEdit.btnAddMusic.title': 'Add music',
    'videoEdit.btnAddText.title': 'Add text',

    // Toolbar — đang chọn 1 clip (chung 3 track + riêng từng track).
    'videoEdit.btnDeselect.title': 'Deselect',
    'videoEdit.btnCutCurrent.title': 'Cut',
    'videoEdit.btnDuplicate.title': 'Duplicate',
    'videoEdit.btnDelete.title': 'Delete',
    'videoEdit.btnMoveEarlier.title': 'Move earlier',
    'videoEdit.btnMoveLater.title': 'Move later',
    'videoEdit.btnShiftSegment.title': 'Adjust music',
    'videoEdit.btnEditText.title': 'Edit text',

    // Modal "Chỉnh" (Filter + Volume gốc, toàn cục).
    'videoEdit.propsModal.title': 'Adjust',
    'videoEdit.volVideo': 'Original audio volume',
    'videoEdit.filterBrightness': 'Brightness',
    'videoEdit.filterContrast': 'Contrast',
    'videoEdit.filterSaturation': 'Saturation',

    // Overlay Crop (Cropper.js).
    'videoEdit.cropOverlay.title': 'Crop video',
    'videoEdit.cropOverlay.cancel': 'Cancel',
    'videoEdit.cropOverlay.confirm': 'Done',
    'videoEdit.ratio.free': 'Free',

    // Trích xuất ảnh.
    'videoEdit.extractFrame.success': 'Photo saved to your library.',
    'videoEdit.extractFrame.failed': 'Could not extract this frame.',

    // Modal chọn Nhạc (thêm clip Nhạc mới).
    'videoEdit.songPicker.title': 'Add music',
    'videoEdit.songSearch.placeholder': 'Search songs…',

    // Modal Sửa chữ (clip Chữ đang chọn).
    'videoEdit.textEdit.title': 'Edit text',
    'videoEdit.text.defaultValue': 'Your text',
    'videoEdit.text.size': 'Size',
    'videoEdit.text.color': 'Color',
    'videoEdit.text.posY': 'Vertical position',

    // Modal "Dịch chuyển tới đoạn" (chọn đoạn nhạc gốc + âm lượng riêng clip nhạc đang chọn).
    'videoEdit.songShift.title': 'Adjust music clip',
    'videoEdit.clipVolume.label': 'Clip volume',

    // Lưu (dropdown).
    'videoEdit.save.overwrite': 'Overwrite',
    'videoEdit.save.asNew': 'Save as new video',
    'videoEdit.save.success': 'Video saved.',
    'videoEdit.save.failed': 'Could not process/save this video.',
};
