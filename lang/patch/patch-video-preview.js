/**
 * lang/patch/patch-video-preview.js — i18n cho modal xem Video (core/file-manager/video-ui.js::
 * openVideoPreviewModal(), event/workflow/video-preview.js) — nạp CHỈ ở `index.html` (modal sống
 * ngay trong trang chính, KHÔNG còn trang riêng như `video-editor.html` cũ).
 *
 * MỚI ("Song/Video Unification" v12, gộp Video Editor vào Modal xem Video) — THAY THẾ
 * `patch-video-editor.js` (ĐÃ XOÁ, cùng `video-editor.html`). Modal mới đúng khuôn modal xem Ảnh
 * + CHỈ còn Cắt (1 đoạn duy nhất)/Crop/Rotate/Trích xuất ảnh/Lưu — KHÔNG còn Nhạc/Chữ/nhiều đoạn
 * Video/Volume riêng từng đoạn. Giữ lại NGUYÊN VĂN các key vẫn còn ý nghĩa (compat/crop/rotate/
 * extractFrame/save) từ patch-video-editor.js cũ, bỏ hẳn key của tính năng đã xoá (Nhạc/Chữ/
 * Volume/multi-clip), thêm key MỚI cho dải cắt + tỉ lệ crop mới (1:1/9:19/2:3/3:4/xoay hướng).
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

    // Header.
    'videoPreview.btnSave.title': 'Save',
    'videoPreview.discardConfirm.title': 'Discard changes?',
    'videoPreview.discardConfirm.desc': 'Your edits have not been saved. Leave without saving?',

    // Dải tỉ lệ Crop (luôn mở sẵn phía trên preview).
    'videoPreview.ratio.free': 'Free',
    'videoPreview.ratio.flip.title': 'Swap orientation',

    // Toolbar dưới preview (Xoay/Reset/Trích xuất ảnh).
    'videoPreview.btnRotateLeft.title': 'Rotate left',
    'videoPreview.btnRotateRight.title': 'Rotate right',
    'videoPreview.btnReset.title': 'Reset',
    'videoPreview.btnExtractFrame.title': 'Extract photo',
    'videoPreview.extractFrame.success': 'Photo saved to your library.',
    'videoPreview.extractFrame.failed': 'Could not extract this frame.',

    // Dải phim (filmstrip) + 2 điểm Start/End.
    'videoPreview.filmstrip.loading': 'Loading filmstrip…',

    // Lưu (dropdown).
    'videoPreview.save.overwrite': 'Overwrite',
    'videoPreview.save.asNew': 'Save as new video',
    'videoPreview.save.success': 'Video saved.',
    'videoPreview.save.failed': 'Could not process/save this video.',
};
