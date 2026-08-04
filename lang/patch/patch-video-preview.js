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

    // Toggle Crop — bấm lại khi đang bật (mục "Crop toggle độc lập", phản hồi Giang).
    'videoPreview.cropExit.title': 'Crop',
    'videoPreview.cropExit.desc': 'Apply this crop, discard it, or keep editing?',
    'videoPreview.cropExit.apply': 'Apply',
    'videoPreview.cropExit.discard': 'Discard',
    'videoPreview.cropExit.cancel': 'Keep editing',

    'videoPreview.extractFrame.success': 'Photo saved to your library.',
    'videoPreview.extractFrame.failed': 'Could not extract this frame.',

    'videoPreview.save.overwrite': 'Overwrite',
    'videoPreview.save.asNew': 'Save as new video',
    'videoPreview.save.success': 'Video saved.',
    'videoPreview.save.failed': 'Could not process/save this video.',
};
