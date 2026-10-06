/**
 * event/workflow/video-frame-capture.js — Workflow DÙNG CHUNG: chụp khung hình hiện tại của 1 `<video>` thành ẢNH MỚI
 * trong thư viện Photo. TÁCH (06/10/2026, tách trình sửa video thành trang riêng video-editor.html) NGUYÊN VẸN từ
 * event/workflow/video-player.js::captureCurrentFrame() — nút Capture ở Control Center (index.html) và nút Chụp của
 * trình sửa video (video-editor.html) cùng gọi `captureToPhoto(videoEl)`.
 *
 * NẠP SAU: core/video-player-capture.js, core/upload-validation.js, core/file-manager/image.js, service/db.js
 * (resolveImageKey), core/modal-choice-ui.js (alertModal), event/workflow/photo-duration.js, lang/lang.js.
 */
const workflowVideoFrameCapture = {
    /** @param {HTMLVideoElement} videoEl - nguồn khung hình (đã có metadata). */
    async captureToPhoto(videoEl) {
        if (!videoEl || !videoEl.videoWidth) { await alertModal(t('videoPlayer.captureFrame.failed')); return; } // guard — chưa có khung hình
        const sourceCanvas = captureVideoFrameToCanvas(videoEl); // core/video-player-capture.js
        const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob) { await alertModal(t('videoPlayer.captureFrame.failed')); return; }
        // MỚI (06/10/2026, Giang chốt "media do app tự tạo chặn 500MB") — cùng giới hạn upload (core/upload-validation.js).
        const sizeCheck = validateMediaFileSize(blob); // core/upload-validation.js
        if (!sizeCheck.valid) { await alertModal(tFormat('common.validate.generatedNotSaved', { reason: sizeCheck.reason })); return; }
        const thumbBlob = await buildExtractedPhotoThumbnail(sourceCanvas, 0.2); // core/video-player-capture.js
        const filename = `${buildExtractedPhotoFilename()}.jpg`; // core/video-player-capture.js
        const duration = await workflowPhotoDuration.compute(blob, sourceCanvas.width, sourceCanvas.height); // event/workflow/photo-duration.js
        const imageKey = await resolveImageKey(filename); // service/db.js — SỬA 06/10/2026: key resolve ở Workflow (Rule 3)
        await saveImage(imageKey, blob, filename, thumbBlob, sourceCanvas.width, sourceCanvas.height, duration); // core/file-manager/image.js
        await alertModal(t('videoPlayer.captureFrame.success'));
    },
};
