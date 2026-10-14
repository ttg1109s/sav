/**
 * event/workflow/photo-duration.js — thời lượng (giây) cho 1 ảnh: đọc file + SHA-256 (Web Crypto) rồi giao core thuần
 * `computePhotoDurationSec()` (core/file-manager/image.js). Dùng chung: upload ảnh (playlist.js), lưu ảnh đã sửa
 * (image-edit.js), chụp khung hình ở Video Editor (video-frame-capture.js).
 *
 * `crypto.subtle` cần secure context (https/localhost; file: chạy được trên Chromium, chưa thử Safari) — thiếu hoặc lỗi
 * thì jitter = 0, không chặn upload.
 *
 * NẠP SAU: core/file-manager/image.js.
 */
const workflowPhotoDuration = {
    /** @param {File|Blob} file - blob ảnh GỐC @param {number} width @param {number} height @returns {Promise<number>} */
    async compute(file, width, height) {
        const digestBuffer = await this._digestOrNull(file);
        return computePhotoDurationSec(file.size, width, height, digestBuffer); // core/file-manager/image.js
    },

    /** @param {File|Blob} file @returns {Promise<ArrayBuffer|null>} */
    async _digestOrNull(file) {
        if (!window.crypto || !window.crypto.subtle) return null;
        try {
            return await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        } catch (err) {
            console.error('[workflowPhotoDuration] crypto.subtle.digest lỗi, bỏ qua jitter:', err);
            return null;
        }
    },
};
