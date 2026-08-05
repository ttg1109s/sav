/**
 * service/state/video-preview.js — Package STATE domain "video-preview" — modal xem/sửa Video.
 * Đăng ký cùng account 'player' qua service/state/record/index.js (registry('all')). PHẢI nạp SAU
 * service/state.js.
 *
 * `_cropSession`/`_zoomPanSession` kiểu 'any' — object nội bộ của core/media-transform.js, KHÔNG
 * phải dữ liệu nghiệp vụ thuần.
 *
 * `videoPreviewCropVisible` — Crop là TOGGLE độc lập, chạy song song Cut (không loại trừ nhau,
 * KHÔNG có khái niệm "toolMode" duy nhất). Bật → hiện dải tỉ lệ + khung crop đè lên video, tạm
 * dừng phát. Tắt (qua Áp dụng/Huỷ ở modalChoice) → về lại Cut thuần.
 *
 * KHÔNG có field lưu vị trí phát hiện tại — `videoEl.currentTime` là nguồn thật duy nhất, Workflow
 * đọc trực tiếp từ payload 'videoPreview.video.timeUpdate' (tần suất cao, không phù hợp appState).
 *
 * SỬA (05/08/2026, đợt 5, phản hồi Giang mục 1 — "loại bỏ toàn bộ tính năng undo/redo") — bỏ hẳn
 * `videoPreviewHistorySession` (session core/edit-history.js — file đó giờ KHÔNG còn ai dùng, RÁC,
 * đề nghị Giang tự xoá). Thêm `videoPreviewFlipH` (mục 4 — nút Lật ngang mới trên toolbar).
 */
AppState.definePackage('video-preview', {
    schema: {
        videoPreviewVideoKey: 'nullable-string',   // key IndexedDB của video đang mở, null khi modal đóng
        videoPreviewRecord: 'any',                 // record đầy đủ (blob/thumbBlob/filename/...) từ service/db.js
        videoPreviewNativeW: 'number',              // độ phân giải THẬT của video (px)
        videoPreviewNativeH: 'number',
        videoPreviewSourceDuration: 'number',       // tổng thời lượng file gốc (giây)
        videoPreviewCutStart: 'number',             // giây, điểm Start đang chọn trên dải phim
        videoPreviewCutEnd: 'number',               // giây, điểm End đang chọn trên dải phim
        videoPreviewRotateDeg: 'number',            // 0/90/180/270
        videoPreviewFlipH: 'boolean',               // lật ngang (mục 4, phản hồi Giang 05/08/2026)
        videoPreviewHasUnsavedChanges: 'boolean',
        videoPreviewFilmstripFrames: 'array',       // [{timestamp, blob}] từ buildCutFilmstripFrames()
        videoPreviewCropSession: 'any',             // session core/media-transform.js, null khi đóng
        videoPreviewActiveDrag: 'nullable-string',  // 'start' | 'end' | 'seek' | null — đang kéo/tua gì trên dải phim
        videoPreviewCropVisible: 'boolean',         // Crop toggle đang bật hay không
        videoPreviewZoomPanSession: 'any',          // session core/media-transform.js, null khi đóng
        videoPreviewIsPlaying: 'boolean',           // đang phát hay đang pause (tap màn hình để đảo)
    },
    buildDefaults() {
        return {
            videoPreviewVideoKey: null,
            videoPreviewRecord: null,
            videoPreviewNativeW: 0,
            videoPreviewNativeH: 0,
            videoPreviewSourceDuration: 0,
            videoPreviewCutStart: 0,
            videoPreviewCutEnd: 0,
            videoPreviewRotateDeg: 0,
            videoPreviewFlipH: false,
            videoPreviewHasUnsavedChanges: false,
            videoPreviewFilmstripFrames: [],
            videoPreviewCropSession: null,
            videoPreviewActiveDrag: null,
            videoPreviewCropVisible: false,
            videoPreviewZoomPanSession: null,
            videoPreviewIsPlaying: false,
        };
    },
});
