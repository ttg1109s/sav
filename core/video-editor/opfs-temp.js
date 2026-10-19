/**
 * core/video-editor/opfs-temp.js — file tạm trong OPFS (Origin Private File System) làm đích ghi cho `processVideo()`
 * (core/video-editor/webcodecs-engine.js): video xuất ra ghi tuần tự xuống đĩa thay vì gom cả file trong RAM (video
 * full-res dài làm Safari reload tab).
 *
 * Chỉ dùng `createWritable()` (main thread) — máy không có (Safari cũ) thì Workflow rơi về ghi RAM (BufferTarget), vẫn
 * đúng, chỉ tốn RAM hơn. `createWritable()` có thể treo thay vì lỗi trên vài bản Safari — Workflow tự hạn giờ
 * (event/workflow/video-preview.js::_openTempTarget()). Thư mục tạm dọn sạch mỗi lần bắt đầu xuất và ngay sau khi lưu xong.
 *
 * Không gọi core khác, không đọc appState.
 */
const VIDEO_EDIT_OPFS_DIR = 'sav-video-edit-tmp';

/**
 * Tạo 1 file tạm mới (chưa mở ghi).
 * @param {string} fileName
 * @returns {Promise<{fileName: string, fileHandle: FileSystemFileHandle}|null>} null = máy không hỗ trợ/lỗi, dùng RAM.
 */
async function openVideoEditTempFile(fileName) {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') return null;
    try {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle(VIDEO_EDIT_OPFS_DIR, { create: true });
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        if (typeof fileHandle.createWritable !== 'function') return null;
        return { fileName, fileHandle };
    } catch (err) {
        console.warn('[openVideoEditTempFile] không tạo được file tạm OPFS, dùng RAM:', err);
        return null;
    }
}

/** Mở ghi file tạm. @param {FileSystemFileHandle} fileHandle @returns {Promise<FileSystemWritableFileStream>} */
function openVideoEditTempWritable(fileHandle) {
    return fileHandle.createWritable();
}

/** Đọc lại file tạm đã ghi xong (File đọc từ đĩa, không nạp cả vào RAM).
 * @param {FileSystemFileHandle} fileHandle @returns {Promise<File>} */
async function readVideoEditTempFile(fileHandle) {
    return fileHandle.getFile();
}

/** Xoá cả thư mục tạm (im lặng nếu chưa có/không hỗ trợ). */
async function clearVideoEditTempDir() {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') return;
    try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(VIDEO_EDIT_OPFS_DIR, { recursive: true });
        console.log('[clearVideoEditTempDir] đã dọn thư mục tạm OPFS của editor video');
    } catch (err) {
        // NotFoundError = chưa từng tạo, bình thường
    }
}
