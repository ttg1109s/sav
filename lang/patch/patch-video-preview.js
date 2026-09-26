/**
 * lang/patch/patch-video-preview.js — i18n cho modal xem/sửa Video (core/file-manager/video-ui.js,
 * event/workflow/video-preview.js). Nhãn dải tỉ lệ Crop dùng key CHUNG `cropRatio.*`
 * (lang/patch/patch-common.js), không lặp lại ở đây.
 */
const LANG_PATCH_VIDEO_PREVIEW = {
    'videoPreview.videoNotFound': 'Video not found — it may have been deleted.',
    'videoPreview.errorTitle': 'Unable to open',
    'videoPreview.compat.unsupportedBrowser': 'This browser does not support video editing (WebCodecs unavailable).',
    'videoPreview.compat.mediabunnyNotLoaded': 'Video editing library failed to load — check your connection and try again.',
    'videoPreview.compat.noVideoTrack': 'This file has no video track.',
    'videoPreview.compat.codecNotSupported': 'This video format is not supported for editing on this device.',
    'videoPreview.compat.unreadableFile': 'This video file could not be read.',
    'videoPreview.loading': 'Loading video…',

    'videoPreview.btnSave.title': 'Save',
    'videoPreview.discardConfirm.title': 'Discard changes?',
    'videoPreview.discardConfirm.desc': 'Your edits have not been saved. Leave without saving?',

    // MỚI (26/09/2026, khung UI kiểu Story) — nhãn rail dọc (hiện khi bấm mũi tên mở rộng) + topbar
    // công cụ. Thay 4 key 'videoPreview.cropExit.*' (modalChoice Áp dụng/Huỷ lúc tắt Crop — đã bỏ).
    'videoPreview.rail.trim': 'Trim',
    'videoPreview.rail.crop': 'Crop',
    'videoPreview.rail.rotate': 'Rotate',
    'videoPreview.rail.flip': 'Flip',
    'videoPreview.rail.mute': 'Mute',
    'videoPreview.rail.unmute': 'Unmute',
    'videoPreview.rail.reset': 'Reset',
    'videoPreview.tool.trim.title': 'Trim',
    'videoPreview.tool.crop.title': 'Crop',
    'videoPreview.tool.cancel': 'Cancel',
    'videoPreview.tool.done': 'Done',

    // Reset — MỚI (05/08/2026, phản hồi Giang mục 1: "loại bỏ toàn bộ undo/redo, giữ nút reset và
    // cảnh báo modal") — Reset không còn Undo cứu lại nên bắt buộc hỏi trước khi chạy.
    'videoPreview.resetConfirm.title': 'Reset all edits?',
    'videoPreview.resetConfirm.desc': 'This clears trim, crop, rotate, flip, zoom/pan and mute, back to the original. This cannot be undone.',
    'videoPreview.resetConfirm.confirm': 'Reset',

    'videoPreview.save.overwrite': 'Overwrite',
    'videoPreview.save.asNew': 'Save as new video',
    'videoPreview.save.success': 'Video saved.',
    'videoPreview.save.failed': 'Could not process/save this video.',
};
