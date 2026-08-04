/**
 * service/blob-url.js — hạ tầng dùng chung (Rule 3b mở rộng, readme/core-function-conventions.md),
 * cùng vai trò `slugify()` (service/db.js) — tạo 1 chuỗi định danh (URL) cho Blob, thuần cơ chế,
 * không quyết định nghiệp vụ. Nơi có Blob (thường là Workflow, sau khi đọc record từ DB) gọi
 * `createBlobUrl()` rồi TRUYỀN url xuống Core-ui làm tham số — Core-ui chỉ NHẬN url, không tự tạo.
 */

/** @param {Blob} blob @returns {string} object URL. */
function createBlobUrl(blob) {
    return URL.createObjectURL(blob);
}

/** @param {string} url */
function revokeBlobUrl(url) {
    try { URL.revokeObjectURL(url); } catch (e) {}
}
