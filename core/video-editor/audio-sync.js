/**
 * core/video-editor/audio-sync.js — Core THUẦN (Rule 1-4 core-function-conventions.md).
 *
 * [v3, 23/07/2026] — Giang đổi hướng: Nhạc/Chữ giờ là clip TỰ DO (vị trí + độ dài riêng trên
 * timeline), KHÔNG còn neo cứng theo đoạn Video active như thiết kế "Story Facebook" trước đó.
 * File này giờ chỉ còn phục vụ modal "Dịch chuyển tới đoạn" — chọn đoạn NÀO của file nhạc gốc được
 * dùng (offset trong bài hát), độc lập với vị trí/độ dài clip đó trên timeline.
 *
 * Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác.
 */

/**
 * Kẹp offset trong bài hát (modal "Dịch chuyển tới đoạn") — không cho kéo lố quá phần còn lại của
 * bài hát so với độ dài clip hiện tại. Nếu clip DÀI HƠN cả bài hát, offset về 0 (bài hát phát hết
 * rồi im lặng phần dư — giới hạn đã biết, chấp nhận được).
 * @param {number} desiredOffset - giây, offset người dùng đang kéo tới.
 * @param {number} clipLength - giây, độ dài HIỆN TẠI của clip nhạc trên timeline.
 * @param {number} songDuration - giây, tổng thời lượng file nhạc gốc.
 * @returns {number} offset đã kẹp trong [0, max(0, songDuration - clipLength)].
 */
function clampSongOffsetDrag(desiredOffset, clipLength, songDuration) {
    const maxOffset = Math.max(0, songDuration - clipLength);
    return Math.max(0, Math.min(desiredOffset, maxOffset));
}
