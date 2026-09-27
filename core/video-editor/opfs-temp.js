/**
 * core/video-editor/opfs-temp.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI (Phase 1
 * editor video kiểu Story, 26/09/2026). File tạm trong OPFS (Origin Private File System) làm ĐÍCH GHI
 * cho `processVideo()` (core/video-editor/webcodecs-engine.js) — video xuất ra được ghi tuần tự thẳng
 * xuống đĩa thay vì gom cả file trong RAM (lý do: video full-res dài làm Safari reload tab).
 *
 * CHỈ dùng Path A của core/streaming-zip.js (`createWritable()`, main thread) — KHÔNG làm lại Path B
 * (Worker + createSyncAccessHandle): máy không có `createWritable()` (Safari cũ) thì trả null,
 * Workflow tự rơi về ghi RAM (BufferTarget) — vẫn chạy đúng, chỉ tốn RAM hơn. Thư mục tạm dọn sạch
 * mỗi lần bắt đầu xuất và ngay sau khi lưu xong (kể cả lỗi) — không để rác tích luỹ.
 *
 * Rule 3 — không gọi core nào khác của project. Rule 2 — không đọc `appState`.
 */
const VIDEO_EDIT_OPFS_DIR = 'sav-video-edit-tmp';

/** Chạy promise với giới hạn thời gian — `createWritable()` trên vài bản Safari có thể treo thay vì
 * ném lỗi (tiền lệ core/streaming-zip.js). Hàm con (Rule 3c). */
function _withTimeoutVideoEditTemp(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('[opfs-temp] timeout')), ms);
        promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
}

/**
 * Mở 1 file tạm mới để ghi.
 * @param {string} fileName
 * @returns {Promise<{fileName:string, fileHandle:FileSystemFileHandle, writable:FileSystemWritableFileStream}|null>} null = máy không hỗ trợ/lỗi, dùng RAM.
 */
async function openVideoEditTempTarget(fileName) {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') return null;
    try {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle(VIDEO_EDIT_OPFS_DIR, { create: true });
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        if (typeof fileHandle.createWritable !== 'function') return null;
        const writable = await _withTimeoutVideoEditTemp(fileHandle.createWritable(), 10000);
        console.log(`[openVideoEditTempTarget] mở file tạm OPFS "${fileName}" để ghi video xuất`);
        return { fileName, fileHandle, writable };
    } catch (err) {
        console.warn('[openVideoEditTempTarget] không mở được file tạm OPFS, dùng RAM:', err);
        return null;
    }
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
