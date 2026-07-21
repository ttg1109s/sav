/**
 * core/file-manager/video-ui.js — MỚI (21/07/2026), File Manager -> Video. Hàm dựng UI thuần (Rule
 * 5c: file toàn hàm `createElement` -> PHẢI hậu tố `-ui.js`) — KHÔNG thuộc phạm vi 4 rule
 * core-function-conventions.md gốc (Rule 1-4), NHƯNG chịu Rule 5 (addEventListener gom cuối hàm,
 * callback CHỈ gọi tham số nhận từ nơi gọi hoặc bắn eventBus — ở ĐÂY dùng tham số `callbacks`, cùng
 * khuôn `openImagePreviewModal()` core/file-manager/photo-ui.js).
 *
 * Batch 1 (chỉ module Video, CHƯA có picker nền — xem event/workflow/file-manager-video.js) — menu
 * action đơn giản hơn Photo hẳn: KHÔNG có Album nên KHÔNG cần Generic Drawer nhiều lựa chọn, modal
 * xem video chỉ có 2 nút: Đóng (X) và Xoá (thùng rác) — gọi thẳng `callbacks.onDelete` (Workflow tự
 * hỏi xác nhận qua modalChoice() trước khi thực xoá, xem event/workflow/file-manager-video.js).
 *
 * NẠP SAU: core/dom-refs.js (không tham chiếu trực tiếp ở đây, nhưng gom nhóm cho dễ đọc), lang/lang.js (t()).
 */

/**
 * Mở modal xem/phát video full-screen — `<video controls autoplay playsinline>` phủ kín màn hình.
 * @param {{key: string, blob: Blob, filename: string}} video
 * @param {{onDelete: () => void}} callbacks
 * @returns {{close: () => void}}
 */
function openVideoPreviewModal(video, callbacks) {
    const stale = document.getElementById('video-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(video.blob);

    const overlay = document.createElement('div');
    overlay.id = 'video-preview-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black overflow-hidden';

    function closeModal() {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        overlay.remove();
    }

    const videoEl = document.createElement('video');
    videoEl.className = 'video-preview-player';
    videoEl.src = objectUrl;
    videoEl.controls = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    overlay.appendChild(videoEl);

    // ---- Header nổi: X đóng (trái) + thùng rác xoá (phải) — cùng khuôn header modal xem ảnh ----
    const header = document.createElement('div');
    header.className = 'photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3 gap-2';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    header.appendChild(closeBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    deleteBtn.title = t('fileManager.video.btnDelete');
    deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
    header.appendChild(deleteBtn);
    overlay.appendChild(header);

    document.body.appendChild(overlay);

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ gọi tham số nhận từ nơi gọi ---
    closeBtn.addEventListener('click', closeModal);
    deleteBtn.addEventListener('click', callbacks.onDelete);

    return { close: closeModal };
}
