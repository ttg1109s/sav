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
};
