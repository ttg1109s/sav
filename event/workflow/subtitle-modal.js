/**
 * event/workflow/subtitle-modal.js — Workflow cụm "subtitleModal", giờ CHỈ còn 1 việc: nút
 * "Sub" ở Control Center (`#btn-subtitle`) mở Subtitle Editor (TRANG RIÊNG, `subtitle-editor.html`)
 * cho bài đang phát — KHÔNG còn modal nào ở trang chính nữa.
 *
 * VIẾT LẠI HOÀN TOÀN (10/07/2026, Subtitle Editor chuyển sang trang riêng — phản hồi Giang). Toàn
 * bộ logic soạn phụ đề (danh sách dòng, waveform, SRT...) ĐÃ CHUYỂN sang cụm "subtitleEditor"
 * (event/{workflow,router,listener}/subtitle-editor.js), CHỈ nạp bởi `subtitle-editor.html`, KHÔNG
 * còn nạp ở `index.html` nữa — xem `core/subtitle/subtitles.js`/`subtitles-ui.js` (viết lại,
 * chuyển theo sang trang mới).
 *
 * `core/subtitle/subtitle-display.js` (hiển thị phụ đề TRÊN MÀN HÌNH lúc phát nhạc, đọc
 * `appState.get('subtitles')`) và `components/settings/subtitle-style.js` (toggle nhanh Bật/Tắt
 * trong Cài đặt) GIỮ NGUYÊN 100% — không liên quan gì tới việc SOẠN nội dung, đã phân định rõ từ
 * trước (xem docstring cũ, nay xoá vì file cũ không còn).
 */
const workflowSubtitleModal = {
    /** Ứng với msg.type = 'subtitleModal.openEditor.click'. */
    openEditor() {
        const currentKey = appState.get('currentKey');
        if (!currentKey) {
            alertModal(t('subtitleModal.noSongPlaying'));
            return;
        }
        this.navigateToEditor(currentKey);
    },

    /**
     * Điều hướng sang Subtitle Editor cho 1 `songKey` bất kỳ — DÙNG CHUNG bởi CẢ
     * `workflowPlaylist.openSubtitleEditorForSongMenu()` (miền "playlist", menu 3 chấm mỗi bài
     * hát) LẪN `openEditor()` ở trên (miền "subtitleModal", nút Sub ở Control Center) — 2 router
     * KHÁC MIỀN nhau (2 nguồn listener khác nhau) nhưng CÙNG 1 logic điều hướng — xem
     * readme/event-bus-flow.md mục "Tái dùng Workflow giữa các miền khác nhau".
     * @param {string} songKey
     */
    navigateToEditor(songKey) {
        window.location.href = `subtitle-editor.html?song=${encodeSongKeyForUrl(songKey)}`; // service/db.js
    },
};
