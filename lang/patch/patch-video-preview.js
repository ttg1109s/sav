/**
 * lang/patch/patch-video-preview.js — i18n cho modal xem/sửa Video (core/file-manager/video-ui.js,
 * event/workflow/video-preview.js). Nhãn dải tỉ lệ Crop dùng key CHUNG `cropRatio.*`
 * (lang/patch/patch-common.js), không lặp lại ở đây.
 */
const LANG_PATCH_VIDEO_PREVIEW = {
    'videoPreview.videoNotFound': 'Video not found — it may have been deleted.',
    'videoPreview.errorTitle': 'Unable to open',
    'videoPreview.compat.unsupportedBrowser': 'This browser does not support video editing (WebCodecs unavailable).',
    'videoPreview.compat.mediabunnyNotLoaded': 'Video editing library is missing (assets/vendor/mediabunny.js).',
    // SỬA (26/09/2026) — tách rõ 3 nguyên nhân lúc nạp thư viện offline (event/workflow/video-preview.js::_ensureMediabunnyLoaded()).
    'videoPreview.compat.mediabunnyMissing': 'File assets/vendor/mediabunny.js was not found. Check the folder and the file name (it must end in .js).',
    'videoPreview.compat.mediabunnyWrongBuild': 'assets/vendor/mediabunny.js is the wrong build. Use dist/bundles/mediabunny.cjs (not .mjs, not dist/modules) and rename it to mediabunny.js.',
    'videoPreview.compat.mediabunnyTooOld': 'assets/vendor/mediabunny.js is too old. Version 1.57.0 or newer is required.',
    'videoPreview.compat.noVideoTrack': 'This file has no video track.',
    'videoPreview.compat.codecNotSupported': 'This video format is not supported for editing on this device.',
    'videoPreview.compat.unreadableFile': 'This video file could not be read.',
    // SỬA (Phase 1, 26/09/2026) — 'videoPreview.loading' thay bằng bản có % (Giang: hiện % lúc tải video vào edit/xuất).
    'videoPreview.loadingPercent': 'Loading video… {percent}%',
    'videoPreview.metadataFailed': 'This video could not be loaded for editing.',

    'videoPreview.btnSave.title': 'Save',
    'videoPreview.discardConfirm.title': 'Discard changes?',
    'videoPreview.discardConfirm.desc': 'Your edits have not been saved. Leave without saving?',

    // MỚI (26/09/2026, khung UI kiểu Story) — nhãn rail dọc (hiện khi bấm mũi tên mở rộng) + topbar
    // công cụ. Thay 4 key 'videoPreview.cropExit.*' (modalChoice Áp dụng/Huỷ lúc tắt Crop — đã bỏ).
    'videoPreview.rail.trim': 'Trim',
    'videoPreview.rail.crop': 'Crop',
    'videoPreview.rail.rotate': 'Rotate',
    'videoPreview.rail.flip': 'Flip',
    'videoPreview.rail.reset': 'Reset',
    'videoPreview.tool.trim.title': 'Trim',
    'videoPreview.tool.crop.title': 'Crop',
    'videoPreview.tool.cancel': 'Cancel',
    'videoPreview.tool.done': 'Done',
    // UI lần 2 (26/09/2026, ảnh chụp editor Story FB) — hàng công cụ ngang giữ namespace 'rail.*' (tránh
    // đổi key đã dịch); viên chọn kiểu lưu. (Nút Âm lượng + key 'rail.volume' đã bỏ 27/09/2026.)
    'videoPreview.saveMode.asNew': 'New video',
    'videoPreview.saveMode.overwrite': 'Overwrite',

    // Reset — MỚI (05/08/2026, phản hồi Giang mục 1: "loại bỏ toàn bộ undo/redo, giữ nút reset và
    // cảnh báo modal") — Reset không còn Undo cứu lại nên bắt buộc hỏi trước khi chạy.
    'videoPreview.resetConfirm.title': 'Reset all edits?',
    'videoPreview.resetConfirm.desc': 'This clears trim, crop, rotate, flip and zoom/pan, back to the original. This cannot be undone.',
    'videoPreview.resetConfirm.confirm': 'Reset',

    'videoPreview.save.overwrite': 'Overwrite',
    'videoPreview.save.asNew': 'Save as new video',
    'videoPreview.save.progress': 'Saving video… {percent}%',
    'videoPreview.save.success': 'Video saved.',
    'videoPreview.save.successNoAudio': 'Video saved without sound — this device cannot encode the audio track.',
    'videoPreview.save.unsupported': 'This device cannot encode the edited video.',
    'videoPreview.save.failed': 'Could not process/save this video.',
};
