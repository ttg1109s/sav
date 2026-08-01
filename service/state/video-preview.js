/**
 * service/state/video-preview.js — Package STATE domain "video-preview" — modal xem Video (đúng
 * khuôn modal xem Ảnh, chỉ còn Cắt 1 đoạn/Crop/Rotate/Trích xuất ảnh/Lưu — KHÔNG còn Nhạc/Chữ/
 * nhiều đoạn Video như Video Editor NLE cũ, THAY `service/state/video-editor.js` đã xoá). Modal
 * sống trong `index.html` (KHÔNG còn trang riêng) — package này đăng ký cùng account 'player' qua
 * `service/state/record/index.js` (registry('all')). Xem cơ chế package ở service/state.js. PHẢI
 * nạp SAU service/state.js.
 *
 * `_cropSession` kiểu 'any' — object nội bộ (session core/crop-selector.js), KHÔNG phải dữ liệu
 * nghiệp vụ thuần, cùng tiền lệ `_cropSession` đã dùng ở service/state/video-editor.js cũ (đã
 * xoá). ĐÂY LÀ NGUỒN THẬT DUY NHẤT của vùng crop hiện tại (`session.rect`) — KHÔNG có field
 * "cropFraction đã xác nhận" riêng như Video Editor NLE cũ (crop dải MỞ SẴN, không có bước
 * "Xác nhận" — Giang yêu cầu mục 2b "chỉ cần kéo thả"), quy đổi ra tỉ lệ 0-1 CHỈ lúc Lưu (đọc
 * `getCropSessionRect()` + `videoPreviewNativeW/H`, xem event/workflow/video-preview.js::
 * _buildProcessParams()). Không cần field dọn pointer listener (`_cropPointerCleanup` ở bản cũ) —
 * `cropCanvasEl` wire pointerdown/move/up ĐÚNG 1 LẦN lúc dựng modal (Rule 5a), tự mất theo
 * `overlay.remove()` lúc đóng modal (KHÔNG toggle mở/đóng lặp lại như overlay cũ).
 */
        AppState.definePackage('video-preview', {
            schema: {
                videoPreviewVideoKey: 'nullable-string',   // key IndexedDB của video đang mở, null khi modal đóng
                videoPreviewRecord: 'any',                 // record đầy đủ (blob/filename/addedAt/...) từ service/db.js, null trước khi load xong
                videoPreviewNativeW: 'number',              // độ phân giải THẬT của video (px) — dùng quy đổi crop session -> cropFraction lúc Lưu
                videoPreviewNativeH: 'number',
                videoPreviewSourceDuration: 'number',       // tổng thời lượng file gốc (giây) — biên trên của cutEnd/dải phim
                videoPreviewCutStart: 'number',             // giây, điểm Start đang chọn trên dải phim
                videoPreviewCutEnd: 'number',               // giây, điểm End đang chọn trên dải phim
                videoPreviewScrubTime: 'number',            // giây, vị trí thanh kéo "current" (xem khung hình tại đó)
                videoPreviewRotateDeg: 'number',            // 0/90/180/270
                videoPreviewHasUnsavedChanges: 'boolean',
                videoPreviewFilmstripFrames: 'array',       // [{timestamp, blob}] từ buildCutFilmstripFrames() (core/video-editor/filmstrip.js)
                videoPreviewCropSession: 'any',             // session core/crop-selector.js, null khi modal đóng — NGUỒN THẬT DUY NHẤT của vùng crop
                videoPreviewActiveDrag: 'nullable-string',  // 'trimStart' | 'trimEnd' | 'crop' | null — đang kéo phần tử nào (event/listener/video-preview.js đọc để phân phối pointermove tĩnh)
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
                    videoPreviewScrubTime: 0,
                    videoPreviewRotateDeg: 0,
                    videoPreviewHasUnsavedChanges: false,
                    videoPreviewFilmstripFrames: [],
                    videoPreviewCropSession: null,
                    videoPreviewActiveDrag: null,
                };
            },
        });
