/**
 * event/listener/subtitle-modal.js — TẤT CẢ listener của cụm "subtitleModal".
 *
 * VIẾT LẠI (10/07/2026) — CHỈ còn `btnSubtitle` (mở Subtitle Editor trang riêng cho bài đang
 * phát) — mọi listener khác (modal cũ: đóng modal, danh sách dòng sub, auto-timing, thêm dòng,
 * xuất srt, nhập srt, áp dụng) ĐÃ CHUYỂN sang event/listener/subtitle-editor.js (trang riêng).
 */
if (btnSubtitle) {
    btnSubtitle.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleModal', type: 'subtitleModal.openEditor.click', payload: {} });
    });
}
