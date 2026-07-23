/**
 * core/video-editor/audio-sync.js — Core THUẦN (Rule 1-4 core-function-conventions.md), MỚI (v2,
 * 23/07/2026). Thay hẳn thiết kế WaveSurfer+Region cũ (Batch 3 draft) — cơ chế "thêm nhạc kiểu Story
 * Facebook" đã chốt với Giang:
 *   - Nhạc LUÔN bắt đầu tại điểm bắt đầu video đang active (KHÔNG có vị trí tự do trên timeline).
 *   - Độ dài khung nhạc = độ dài video đang active, TỐI ĐA bằng đúng giá trị đó.
 *   - Kéo trên track nhạc = đổi OFFSET trong chính file nhạc (đoạn nào của bài hát được dùng),
 *     KHÔNG đổi vị trí trên timeline video.
 *   - Khi tay cầm trim của Video bị kéo -> khung nhạc tự tính lại: điểm bắt đầu (offset trong bài
 *     hát) giữ NGUYÊN, chỉ phần cuối (độ dài) co giãn theo độ dài video mới.
 *
 * Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác.
 */

/**
 * Tính lại khung nhạc sau khi Video bị trim (gọi mỗi lần `cutRange` đổi, NẾU đang có nhạc chèn).
 * @param {number} offsetInSong - giây, điểm bắt đầu HIỆN TẠI trong bài hát (giữ nguyên nếu còn đủ chỗ).
 * @param {number} activeDuration - giây, độ dài video đang active (`computeActiveDuration(cutRange)`).
 * @param {number} songDuration - giây, tổng thời lượng bài hát.
 * @returns {{offsetInSong:number, windowLength:number}} - offsetInSong có thể bị kẹp lùi lại nếu
 *   video dài ra vượt quá phần còn lại của bài hát tính từ offset cũ.
 */
function recalcSongWindowOnVideoTrim(offsetInSong, activeDuration, songDuration) {
    const windowLength = Math.min(Math.max(0, activeDuration), Math.max(0, songDuration));
    const maxOffset = Math.max(0, songDuration - windowLength);
    return { offsetInSong: Math.min(Math.max(0, offsetInSong), maxOffset), windowLength };
}

/**
 * Người dùng tự kéo track nhạc — đổi OFFSET trong bài hát (độ dài windowLength KHÔNG đổi ở đây).
 * @param {number} desiredOffset - giây, offset người dùng đang kéo tới.
 * @param {number} windowLength - giây, độ dài khung nhạc hiện tại (bằng activeDuration).
 * @param {number} songDuration - giây, tổng thời lượng bài hát.
 * @returns {number} offset đã kẹp trong [0, songDuration - windowLength].
 */
function clampSongOffsetDrag(desiredOffset, windowLength, songDuration) {
    const maxOffset = Math.max(0, songDuration - windowLength);
    return Math.max(0, Math.min(desiredOffset, maxOffset));
}
