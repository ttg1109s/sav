/**
 * event/workflow/subtitle-modal.js — Điều hướng sang Subtitle Editor (subtitle-editor.html), dùng bởi
 * workflowPlaylist (menu 3 chấm mỗi bài). Không có router/listener riêng.
 */
const workflowSubtitleModal = {
    /** Lối vào duy nhất của Subtitle Editor. @param {string} songKey */
    navigateToEditor(songKey) {
        window.location.href = `pages/subtitle-editor.html?song=${encodeSongKeyForUrl(songKey)}`; // service/song-key-cipher.js
    },
};
