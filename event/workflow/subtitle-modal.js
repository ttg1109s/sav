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
/**
 * event/workflow/subtitle-modal.js — Workflow cụm "subtitleModal".
 *
 * SỬA (10/07/2026, phản hồi Giang — "nút Sub ở Control Center giờ CHỈ bật/tắt phụ đề, KHÔNG mở gì
 * nữa"): `openEditor()` (từng điều hướng sang Subtitle Editor) ĐÃ XOÁ — nút `#btn-subtitle` giờ
 * TOGGLE THẲNG `isSubtitlesEnabled` qua `setSubtitlesEnabled()` (core/subtitle/
 * subtitle-style-settings.js, ĐÃ CÓ SẴN — dùng chung với checkbox trong Settings), xem router (chỉ
 * cần gọi thẳng core, không cần workflow cho việc này nữa).
 *
 * `navigateToEditor()` GIỮ NGUYÊN — vẫn dùng chung bởi `workflowPlaylist.
 * openSubtitleEditorForSongMenu()` (menu 3 chấm mỗi bài hát, miền KHÁC) — xem
 * readme/event-bus-flow.md mục "Tái dùng Workflow giữa các miền khác nhau".
 */
const workflowSubtitleModal = {
    /**
     * Điều hướng sang Subtitle Editor cho 1 `songKey` bất kỳ — DÙNG CHUNG bởi
     * `workflowPlaylist.openSubtitleEditorForSongMenu()` (miền "playlist", menu 3 chấm mỗi bài
     * hát) — ĐÂY là LỐI VÀO DUY NHẤT còn lại của Subtitle Editor (nút Sub Control Center KHÔNG
     * còn mở nó nữa, xem docstring đầu file).
     * @param {string} songKey
     */
    navigateToEditor(songKey) {
        window.location.href = `subtitle-editor.html?song=${encodeSongKeyForUrl(songKey)}`; // service/song-key-cipher.js
    },
};
