/**
 * lang/patch/patch-video-editor.js — i18n cho trang `video-editor.html` (MỚI, Batch 1, module Video
 * Editor). Cùng khuôn `patch-image-edit.js`/`patch-subtitle-editor.js` — nạp ở CẢ `index.html`
 * (bắt buộc, xem docstring `lang/lang.js` — Object.assign() cần ĐỦ mọi biến LANG_PATCH_*) LẪN
 * `video-editor.html` (toàn bộ UI trang thật sự dùng các key này).
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
    'videoEdit.btnCrop.title': 'Crop',
    'videoEdit.btnRotateLeft.title': 'Rotate left',
    'videoEdit.btnRotateRight.title': 'Rotate right',
    'videoEdit.btnReset.title': 'Reset',
    'videoEdit.filterBrightness': 'Brightness',
    'videoEdit.filterContrast': 'Contrast',
    'videoEdit.filterSaturation': 'Saturation',
    'videoEdit.cropBadge.none': 'No crop selected',
    'videoEdit.cropBadge.active': 'Crop: {w}% × {h}%',
    'videoEdit.cropReset.label': 'Clear crop',
    'videoEdit.cropOverlay.title': 'Crop video',
    'videoEdit.cropOverlay.cancel': 'Cancel',
    'videoEdit.cropOverlay.confirm': 'Done',
    'videoEdit.discardConfirm.title': 'Discard changes?',
    'videoEdit.discardConfirm.desc': 'Your edits have not been saved. Leave without saving?',
    // MỚI (Batch 2) — Cut.
    'videoEdit.btnCut.title': 'Cut',
    'videoEdit.cutBadge.none': 'Full length (no cut)',
    'videoEdit.cutBadge.active': 'Cut: {start} – {end}',
    'videoEdit.cutReset.label': 'Clear cut',
    'videoEdit.cutOverlay.title': 'Cut video',
    'videoEdit.cutOverlay.cancel': 'Cancel',
    'videoEdit.cutOverlay.confirm': 'Done',
    // MỚI (Batch 2) — Trích xuất ảnh.
    'videoEdit.btnExtractFrame.title': 'Extract photo',
    'videoEdit.extractFrame.success': 'Photo saved to your library.',
    'videoEdit.extractFrame.failed': 'Could not extract this frame.',

    // ===================== MỚI (v2, 23/07/2026) — khung video.txt =====================
    'videoEdit.loading': 'Loading video…',
    'videoEdit.btnSplit.title': 'Split',
    'videoEdit.btnSave.title': 'Save',

    // 4 tab bottom-sheet.
    'videoEdit.tab.cut': 'Video',
    'videoEdit.tab.audio': 'Music',
    'videoEdit.tab.text': 'Text',
    'videoEdit.tab.properties': 'Adjust',
    'videoEdit.panelTitle.video-editor-panel-cut': 'Video',
    'videoEdit.panelTitle.video-editor-panel-audio': 'Add music',
    'videoEdit.panelTitle.video-editor-panel-text': 'Text',
    'videoEdit.panelTitle.video-editor-panel-properties': 'Adjust',

    // Nhạc chèn.
    'videoEdit.songSearch.placeholder': 'Search songs…',
    'videoEdit.btnRemoveSong.title': 'Remove music',
    'videoEdit.volumeHeading': 'Volume',
    'videoEdit.volVideo': 'Original audio',
    'videoEdit.volSong': 'Music',

    // Text overlay.
    'videoEdit.btnAddText.title': 'Add text overlay',
    'videoEdit.btnRemoveText.title': 'Remove text',
    'videoEdit.text.defaultValue': 'Your text',
    'videoEdit.text.size': 'Size',
    'videoEdit.text.color': 'Color',
    'videoEdit.text.posY': 'Vertical position',

    // Filter (heading mới — 3 label brightness/contrast/saturation đã có ở trên, không lặp lại).
    'videoEdit.filterHeading': 'Color filter',

    // Lưu (dropdown).
    'videoEdit.save.overwrite': 'Overwrite',
    'videoEdit.save.asNew': 'Save as new video',
    'videoEdit.save.success': 'Video saved.',
    'videoEdit.save.failed': 'Could not process/save this video.',

    // Split.
    'videoEdit.split.title': 'Split video',
    'videoEdit.split.inputLabel': 'Seconds per segment (max {max}s)',
    'videoEdit.split.start': 'Split & download .zip',
    'videoEdit.split.invalid': 'Enter a value between 1 and {max} seconds.',
    'videoEdit.split.progress': 'Processing segment {current} / {total}…',
    'videoEdit.split.failed': 'Could not split this video.',
};
