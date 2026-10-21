/**
 * core/streaming-zip.js — các bước thi hành để ghi .zip STREAM thẳng vào 1 file tạm OPFS (Origin Private File System)
 * thay vì dựng cả khối Blob trong RAM: zip video vài GB tốn RAM như zip vài trăm MB (1 entry/1 chunk tại 1 thời điểm).
 * Điều phối (thử Path A rồi Path B, hạn giờ, chống treo, heartbeat log): event/workflow/streaming-zip.js.
 *
 * Thư viện zip.js (@zip.js/zip.js, BSD-3-Clause) bản "no-worker" — global `zip.*`, nạp qua thẻ `<script>` tĩnh ở
 * index.html (Workflow nạp động dự phòng). Phải `zip.configure({ useWebWorkers: false })`: mặc định zip.js tự dựng Worker
 * nội bộ mà bản no-worker không có -> treo vô hạn ngay entry đầu.
 *
 * 2 cách ghi OPFS:
 *   A. `createWritable()` — main thread, WritableStream thật (Safari chỉ có ở bản rất mới).
 *   B. `createSyncAccessHandle()` — bắt buộc trong dedicated Worker (core/workers/opfs-zip-worker.js), giao từng entry
 *      một qua postMessage (không giữ nhiều Blob lớn cùng lúc ở 2 phía). Safari từ 16.4.
 *
 * Chưa kiểm chứng trên iOS thật với video vài trăm MB–vài GB: postMessage(Blob) có tránh copy byte không, thời gian/CPU
 * nén trong Worker.
 *
 * NẠP SAU: không phụ thuộc file core nào (chỉ API trình duyệt + global `zip`).
 */

const ZIP_JS_CDN_URL = 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.62/dist/zip-no-worker.min.js';
const OPFS_ZIP_TEMP_DIR = 'sav-zip-tmp'; // file .zip đang ghi / chờ tải; dọn CẢ thư mục trừ file đang dùng (workflowStreamingZip.sweepTemp())
const OPFS_ZIP_WORKER_URL = 'core/workers/opfs-zip-worker.js';

/** Trình duyệt có OPFS không (chỉ soi API, không gọi). @returns {boolean} */
function isStreamingZipAvailable() {
    return typeof navigator !== 'undefined' && !!(navigator.storage && typeof navigator.storage.getDirectory === 'function');
}

/** zip.js đã nạp chưa. @returns {boolean} */
function isZipJsLoaded() {
    return typeof zip !== 'undefined';
}

/** Tắt Worker nội bộ của zip.js (xem đầu file). Gọi lại vô hại. */
function configureZipJs() {
    if (typeof zip === 'undefined' || typeof zip.configure !== 'function') return;
    zip.configure({ useWebWorkers: false });
}

/** Mở (tạo nếu chưa có) thư mục tạm zip trong OPFS. @returns {Promise<FileSystemDirectoryHandle>} */
async function openZipTempDir() {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_ZIP_TEMP_DIR, { create: true });
}

/** Tạo 1 file tạm tên mới (không tái dùng tên cũ — file Path A bỏ dở có thể còn bị khoá ghi).
 * @param {FileSystemDirectoryHandle} dirHandle @returns {Promise<{name: string, handle: FileSystemFileHandle}>} */
async function createZipTempFile(dirHandle) {
    const name = `zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
    const handle = await dirHandle.getFileHandle(name, { create: true });
    return { name, handle };
}

/** Xoá 1 mục trong thư mục tạm (đệ quy nếu là thư mục con). @param {FileSystemDirectoryHandle} dirHandle @param {string} name
 * @returns {Promise<void>} */
function removeZipTempFile(dirHandle, name) {
    return dirHandle.removeEntry(name, { recursive: true });
}

/** Path A — mở WritableStream (có thể treo thay vì lỗi trên vài bản Safari; Workflow tự hạn giờ).
 * @param {FileSystemFileHandle} fileHandle @returns {Promise<FileSystemWritableFileStream>} */
function openZipTempWritable(fileHandle) {
    return fileHandle.createWritable();
}

/** @param {FileSystemWritableFileStream} writable @returns {zip.ZipWriter} */
function createZipWriter(writable) {
    return new zip.ZipWriter(writable, { bufferedWrite: true });
}

/** Nén 1 entry (đọc cắt lát qua BlobReader, RAM thấp). `onBytes(progress, total)` mỗi lần zip.js xử lý thêm byte.
 * @param {zip.ZipWriter} zipWriter @param {{filename: string, blob: Blob}} entry @param {(progress: number, total: number) => void} onBytes
 * @returns {Promise<void>} */
function addZipWriterEntry(zipWriter, entry, onBytes) {
    return zipWriter.add(entry.filename, new zip.BlobReader(entry.blob), { onprogress: onBytes }).then(() => undefined);
}

/** Chốt file zip (ghi central directory). @param {zip.ZipWriter} zipWriter @returns {Promise<void>} */
function closeZipWriter(zipWriter) {
    return zipWriter.close().then(() => undefined);
}

/** Huỷ WritableStream đang dở. @param {FileSystemWritableFileStream} writable @returns {Promise<void>} */
function abortZipWritable(writable) {
    return writable.abort();
}

/** Đọc file zip vừa ghi (File trỏ vào OPFS), gắn `_opfsTempName` để nơi gọi trả lại qua workflowStreamingZip.release().
 * @param {FileSystemFileHandle} fileHandle @param {string} name @returns {Promise<File>} */
async function readZipTempFile(fileHandle, name) {
    const file = await fileHandle.getFile();
    file._opfsTempName = name;
    return file;
}

// ===================== Dọn thư mục tạm =====================

/** Thư mục tạm zip nếu đã có (chưa từng tạo -> null). @returns {Promise<FileSystemDirectoryHandle|null>} */
async function openExistingZipTempDir() {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_ZIP_TEMP_DIR, { create: false }).catch(() => null);
}

/** Xoá CẢ thư mục tạm (đệ quy) — cuốn luôn file nháp ẩn của writable bỏ dở (Path A treo trên Safari), thứ `keys()` không
 * liệt kê được nên xoá theo tên không tới. Có mục đang bị khoá thì ném lỗi. @returns {Promise<void>} */
async function removeZipTempDir() {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_ZIP_TEMP_DIR, { recursive: true });
}

/** Thư mục tạm có đang rảnh hẳn không (không file nào đang dùng, không lượt nén nào đang chạy).
 * @param {number} inUseCount @param {number} activeBuilds @returns {boolean} */
function isZipTempIdle(inUseCount, activeBuilds) {
    return inUseCount === 0 && activeBuilds === 0;
}

/** Mục trong thư mục tạm không thuộc nhóm đang dùng. @param {string[]} names @param {Set<string>} inUseNames @returns {string[]} */
function pickStaleZipTempNames(names, inUseNames) {
    return names.filter((name) => !inUseNames.has(name));
}

/** Số lượt xoá thành công. @param {PromiseSettledResult[]} results @returns {number} */
function countZipTempRemoved(results) {
    return results.filter((r) => r.status === 'fulfilled').length;
}

// ===================== Path B — Worker =====================

/** @returns {Worker} */
function createZipWorker() {
    return new Worker(OPFS_ZIP_WORKER_URL);
}

/** @param {Worker} worker @param {string} tmpFileName @param {number} totalEntries */
function postZipWorkerInit(worker, tmpFileName, totalEntries) {
    worker.postMessage({ type: 'init', tmpDirName: OPFS_ZIP_TEMP_DIR, tmpFileName, zipJsUrl: ZIP_JS_CDN_URL, totalEntries });
}

/** @param {Worker} worker @param {{filename: string, blob: Blob}} entry */
function postZipWorkerEntry(worker, entry) {
    worker.postMessage({ type: 'entry', filename: entry.filename, blob: entry.blob });
}

/** @param {Worker} worker */
function postZipWorkerFinish(worker) {
    worker.postMessage({ type: 'finish' });
}

/** @param {Worker} worker */
function terminateZipWorker(worker) {
    worker.terminate();
}

/** Thông báo lỗi từ sự kiện 'error' của Worker. @param {ErrorEvent|undefined} err @returns {string} */
function describeZipWorkerError(err) {
    return err && err.message ? err.message : 'Lỗi Worker OPFS zip không xác định';
}

// ===================== Tiến độ + log =====================

/** % hoàn thành theo số entry. @param {number} done @param {number} total @returns {number} */
function computeZipProgressPercent(done, total) {
    return Math.round((done / total) * 100);
}

/** Dòng log heartbeat của 1 bước đang chờ. @param {string} label @param {number} startedAtMs @param {number} nowMs @returns {string} */
function formatZipStepHeartbeat(label, startedAtMs, nowMs) {
    return `[streaming-zip] ...${Math.round((nowMs - startedAtMs) / 1000)}s ${label}`;
}

/** Dòng log heartbeat lúc nén 1 entry. @param {string} pathLabel @param {string} filename @param {number} startedAtMs
 * @param {number} nowMs @param {number} lastProgress @param {number|null} lastTotal @returns {string} */
function formatZipEntryHeartbeat(pathLabel, filename, startedAtMs, nowMs, lastProgress, lastTotal) {
    const elapsedSec = Math.round((nowMs - startedAtMs) / 1000);
    const byteInfo = lastTotal != null ? `${lastProgress}/${lastTotal} byte` : `${lastProgress} byte`;
    const idleNote = lastProgress === 0 ? ' (CHƯA có tiến triển nào)' : '';
    return `[streaming-zip] ${pathLabel} ...${elapsedSec}s nén "${filename}" — đã xử lý ${byteInfo}${idleNote}`;
}
