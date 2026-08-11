/**
 * event/workflow/subtitle-modal.js — Workflow cụm "subtitleModal", giờ CHỈ còn 1 việc: dùng chung
 * bởi domain khác (`workflowPlaylist`) — KHÔNG còn router/listener riêng (đã xoá, nút "Sub" ở
 * Control Center đã bỏ hẳn — bật/tắt phụ đề dùng checkbox có sẵn trong Settings,
 * `#setting-subtitles-enabled`, components/settings/subtitle-style.js).
 */
const workflowSubtitleModal = {
    /**
     * Điều hướng sang Subtitle Editor cho 1 `songKey` bất kỳ — DÙNG CHUNG bởi
     * `workflowPlaylist.openSubtitleEditorForSongMenu()` (miền "playlist", menu 3 chấm mỗi bài
     * hát) — ĐÂY là LỐI VÀO DUY NHẤT còn lại của Subtitle Editor.
     * @param {string} songKey
     */
    navigateToEditor(songKey) {
        window.location.href = `subtitle-editor.html?song=${encodeSongKeyForUrl(songKey)}`; // service/song-key-cipher.js
    },
};
