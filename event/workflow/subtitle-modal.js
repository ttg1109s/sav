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
 * subtitle-style-settings.js, ĐÃ CÓ SẴN — dùng chung với checkbox trong Settings).
 *
 * SỬA (12/07/2026, audit kiến trúc `/event/`) — `toggleSubtitlesEnabled()` MỚI thêm ở đây: câu
 * "không cần workflow cho việc này nữa" ở bản 10/07 SAI theo quy ước hiện hành (readme/
 * event-bus-flow.md mục 4B, "chuẩn bị state cho Core dù chỉ 1 hàm cũng là Workflow") — router
 * TRƯỚC ĐÂY tự đọc `appState.get('isSubtitlesEnabled')` rồi gọi thẳng core, nay chuyển vào đây.
 *
 * `navigateToEditor()` GIỮ NGUYÊN — vẫn dùng chung bởi `workflowPlaylist.
 * openSubtitleEditorForSongMenu()` (menu 3 chấm mỗi bài hát, miền KHÁC) — xem
 * readme/event-bus-flow.md mục "Tái dùng Workflow giữa các miền khác nhau".
 */
const workflowSubtitleModal = {
    /** Ứng với 'subtitleModal.toggleEnabled.click' — đảo bật/tắt Phụ đề (nút "Sub" ở Control
     * Center). MỚI (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 16):
     * TRƯỚC ĐÂY router tự đọc `appState.get('isSubtitlesEnabled')` rồi gọi thẳng
     * `setSubtitlesEnabled()` — "chuẩn bị state cho Core" tự nó là Workflow (readme/
     * event-bus-flow.md mục 4B), dù chỉ đọc đúng 1 key rồi gọi đúng 1 hàm. `setSubtitlesEnabled()`
     * nhận thẳng boolean, KHÔNG cần `VirtualMachineState` (không chọn giữa 2 hàm khác nhau). */
    toggleSubtitlesEnabled() {
        setSubtitlesEnabled(!appState.get('isSubtitlesEnabled')); // core/subtitle/subtitle-style-settings.js
    },

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
