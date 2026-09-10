/**
 * core/streaming-zip.js — MỚI (10/09/2026, Giang yêu cầu "làm đầy đủ, thay cách nén zip cũ ở toàn
 * app" — tìm thư viện khác thay JSZip). Xây dựng file .zip bằng cách STREAM thẳng vào OPFS (Origin
 * Private File System, `navigator.storage.getDirectory()`) thay vì dựng liền 1 khối Blob trong RAM
 * như JSZip cũ (`core/storage-manager.js::buildAllXZipBlob()` — JSZip.generateAsync({type:'blob'})
 * bắt buộc giữ HẾT trong bộ nhớ, gốc bug "zip video >1GB làm crash PWA" đã sửa tạm bằng ngưỡng cảnh
 * báo dung lượng trước đó — file NÀY thay hẳn cách sửa tạm đó bằng cách giải quyết ĐÚNG gốc).
 *
 * THƯ VIỆN: zip.js (@zip-js/zip-js, https://github.com/gildas-lormeau/zip.js, BSD-3-Clause) — nạp
 * qua CDN, bản "no-worker" (KHÔNG ES module — global `zip.*`, giống hệt cách JSZip đang nạp qua
 * CDN, khớp quy ước "không ES module, không build step" của project). Khác JSZip, `zip.ZipWriter`
 * ghi ra ĐƯỢC bất kỳ WritableStream nào — không bắt buộc dựng Blob liền 1 khối — nên ghi TĂNG DẦN
 * vào 1 file OPFS được, bộ nhớ dùng CHỈ BẰNG 1 entry/1 chunk tại 1 thời điểm, KHÔNG phụ thuộc tổng
 * dung lượng archive (zip video vài chục GB cũng chỉ tốn RAM y hệt zip vài trăm MB).
 *
 * 2 CÁCH GHI OPFS (trình duyệt hỗ trợ khác nhau):
 *   A. `FileSystemFileHandle.createWritable()` — API async đơn giản, chạy THẲNG main thread, trả
 *      thẳng 1 WritableStream thật. Chrome/Firefox/Edge hỗ trợ từ lâu; Safari CHỈ hỗ trợ từ 1 bản
 *      khá mới (ghi nhận ở WebKit bug tracker khoảng "Safari 26" — cần Giang tự xác nhận lại trên
 *      thiết bị thật, xem ghi chú "CHƯA KIỂM CHỨNG" cuối file).
 *   B. `FileSystemFileHandle.createSyncAccessHandle()` — hỗ trợ RỘNG hơn nhiều (Safari từ 16.4,
 *      3/2023 — Baseline "widely available" từ 2023) nhưng BẮT BUỘC chạy trong 1 dedicated Web
 *      Worker (main thread gọi thẳng sẽ lỗi) — giao hẳn cho `core/workers/opfs-zip-worker.js`, giao
 *      tiếp qua postMessage() TỪNG entry MỘT (KHÔNG gộp cả mảng gửi 1 lần — tránh giữ nhiều Blob
 *      lớn cùng lúc ở CẢ 2 phía, cùng nguyên tắc "1 file tại 1 thời điểm" đã áp dụng xuyên suốt các
 *      lần sửa trước).
 * Thử A trước (đơn giản, không cần Worker) — lỗi/không hỗ trợ thì rơi xuống B. Cả 2 đều thất bại
 * (OPFS hoàn toàn không tồn tại — browser rất cũ, gần như không còn theo Baseline hiện tại) thì ném
 * lỗi ra ngoài — nơi gọi (`buildAllXZipBlob()`, core/storage-manager.js) tự bắt để rơi về nhánh
 * JSZip cũ làm lưới an toàn cuối cùng, không có browser nào "không tải được gì cả".
 *
 * NẠP SAU: (không phụ thuộc file core nào khác — chỉ cần `t()`, lang/lang.js, cho thông báo lỗi).
 * NẠP TRƯỚC: core/storage-manager.js (gọi `isStreamingZipAvailable()`/`buildZipStreamingToOpfs()`).
 *
 * CHƯA KIỂM CHỨNG THỰC TẾ (Giang cân nhắc trước khi tin tuyệt đối là đã thay JSZip dứt điểm) — toàn
 * bộ luồng này (OPFS + createSyncAccessHandle() trong Worker + zip.js qua CDN + postMessage() từng
 * Blob) CHƯA được chạy thử trên thiết bị Safari/iOS thật với video vài trăm MB–vài GB. Cụ thể các
 * điểm chưa chắc chắn, cần TEST TRÊN THIẾT BỊ THẬT trước khi coi đây đã xong dứt điểm:
 *   - postMessage() 1 Blob dùng structured clone — CHƯA rõ trình duyệt có thật sự tránh copy toàn
 *     bộ byte hay không (khác hẳn ArrayBuffer, transfer được zero-copy qua transfer list).
 *   - zip.js đọc/nén dữ liệu trên chính thread đang chạy nó (Worker, ở nhánh B) — chưa đo thời
 *     gian/CPU thực tế cho video vài GB, có thể cần tinh chỉnh thêm (vd `bufferedWrite`/chunk size).
 *   - Ngưỡng chính xác của "khoảng bản Safari hỗ trợ createWritable()" lấy từ WebKit bug tracker,
 *     có thể lệch so với version thật trên thiết bị Giang test — code tự thử/tự rơi xuống B nên
 *     KHÔNG cần biết chính xác ngưỡng để hoạt động đúng, nhưng đáng theo dõi qua console.warn().
 */

const ZIP_JS_CDN_URL = 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.62/dist/zip-no-worker.min.js';
const OPFS_ZIP_TEMP_DIR = 'sav-zip-tmp'; // thư mục tạm riêng trong OPFS — chỉ chứa file .zip vừa ghi xong, chờ người dùng tải/share rồi dọn (cleanupStreamingZipTemp())

/** Kiểm tra NHANH (đồng bộ, chỉ soi sự TỒN TẠI của API — không gọi thật, không async) có khả năng
 * dùng đường streaming OPFS hay không — dùng ở event/workflow/file-manager-storage.js để quyết định
 * có cần hỏi cảnh báo dung lượng (ngưỡng cũ, ZIP_MEMORY_SAFE_LIMIT_BYTES) hay bỏ hẳn bước đó (OPFS
 * sẵn có thì không còn giới hạn dung lượng nào để cảnh báo nữa).
 * @returns {boolean}
 */
function isStreamingZipAvailable() {
    return typeof navigator !== 'undefined' && !!(navigator.storage && typeof navigator.storage.getDirectory === 'function');
}

/** Nạp zip.js qua CDN (bản no-worker, global `zip.*`) ĐÚNG 1 LẦN — tái dùng cho mọi lượt gọi sau,
 * cùng mẫu lazy-load 1 thư viện ngoài lúc thật sự cần (JSZip nạp tĩnh sẵn trong index.html từ
 * trước; zip.js MỚI nên nạp ĐỘNG ở đây thay vì thêm dòng <script> tĩnh, tự chịu trách nhiệm nạp).
 * @returns {Promise<void>}
 */
let _zipJsLoadPromise = null;
function _ensureZipJsLoaded() {
    if (typeof zip !== 'undefined') return Promise.resolve();
    if (_zipJsLoadPromise) return _zipJsLoadPromise;
    _zipJsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = ZIP_JS_CDN_URL;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không tải được thư viện zip.js (kiểm tra kết nối mạng tới CDN).'));
        document.head.appendChild(script);
    });
    return _zipJsLoadPromise;
}

/**
 * Xây dựng .zip STREAM thẳng vào 1 file OPFS tạm — KHÔNG dựng liền 1 khối Blob trong RAM (xem
 * docstring đầu file để biết đầy đủ 2 cách A/B). Ném lỗi ra ngoài nếu CẢ 2 cách đều thất bại — nơi
 * gọi (`buildAllXZipBlob()`, core/storage-manager.js) tự bắt để rơi về JSZip cũ.
 * @param {Array<{filename:string, blob:Blob}>} entries
 * @param {(done:number,total:number,percent:number|null) => void} [onProgress]
 * @returns {Promise<File>} - 1 File (là Blob) trỏ vào file OPFS vừa ghi, có thêm thuộc tính JS tuỳ
 *   biến `_opfsTempName` (tên file tạm, KHÔNG phải attribute HTML/chuẩn nào) để nơi gọi tự dọn được
 *   qua `cleanupStreamingZipTemp()` sau khi đã tải/share xong, không cần tự nhớ tên riêng.
 */
async function buildZipStreamingToOpfs(entries, onProgress) {
    await _ensureZipJsLoaded();
    const root = await navigator.storage.getDirectory();
    const tmpDirHandle = await root.getDirectoryHandle(OPFS_ZIP_TEMP_DIR, { create: true });
    const tmpFileName = `zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
    const fileHandle = await tmpDirHandle.getFileHandle(tmpFileName, { create: true });

    try {
        await _writeViaMainThread(fileHandle, entries, onProgress); // Path A
    } catch (errA) {
        console.warn('[streaming-zip] createWritable() không dùng được (thường do Safari chưa hỗ trợ), thử qua Worker (createSyncAccessHandle):', errA);
        await _writeViaWorker(tmpFileName, entries, onProgress); // Path B
    }

    const file = await fileHandle.getFile();
    file._opfsTempName = tmpFileName;
    return file;
}

/** Dọn 1 file zip tạm trong OPFS sau khi người dùng đã tải/share xong. KHÔNG bắt buộc gọi (OPFS có
 * quota riêng, không lẫn vào bộ nhớ hệ thống như IndexedDB) nhưng nên gọi để không tích rác theo
 * thời gian — an toàn gọi dù file không còn tồn tại (bắt lỗi, bỏ qua im lặng).
 * @param {string} [tmpFileName] - lấy từ `file._opfsTempName` (giá trị `buildZipStreamingToOpfs()` trả về)
 */
async function cleanupStreamingZipTemp(tmpFileName) {
    if (!tmpFileName) return;
    try {
        const root = await navigator.storage.getDirectory();
        const tmpDirHandle = await root.getDirectoryHandle(OPFS_ZIP_TEMP_DIR, { create: false });
        await tmpDirHandle.removeEntry(tmpFileName);
    } catch (err) {
        console.warn('[streaming-zip] Không dọn được file zip tạm trong OPFS (bỏ qua, không nghiêm trọng):', err);
    }
}

/** Path A — `createWritable()`, chạy thẳng main thread, không cần Worker. Ném lỗi nếu Safari chưa
 * hỗ trợ (bắt ở `buildZipStreamingToOpfs()` để rơi xuống Path B). */
async function _writeViaMainThread(fileHandle, entries, onProgress) {
    const writable = await fileHandle.createWritable();
    const zipWriter = new zip.ZipWriter(writable, { bufferedWrite: true });
    let done = 0;
    for (const entry of entries) {
        await zipWriter.add(entry.filename, new zip.BlobReader(entry.blob));
        done++;
        if (onProgress) onProgress(done, entries.length, Math.round((done / entries.length) * 100));
    }
    await zipWriter.close();
}

/** Path B — giao hẳn cho core/workers/opfs-zip-worker.js (createSyncAccessHandle() BẮT BUỘC chạy
 * trong dedicated Worker, main thread gọi thẳng sẽ lỗi). Giao tiếp qua postMessage() dạng "ping-
 * pong" TỪNG entry một (gửi 1 -> đợi Worker báo xong -> gửi tiếp) — KHÔNG gộp cả mảng gửi 1 lần,
 * tránh giữ nhiều Blob lớn cùng lúc ở CẢ 2 phía. */
function _writeViaWorker(tmpFileName, entries, onProgress) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('core/workers/opfs-zip-worker.js');
        let idx = 0;
        function sendNextEntry() {
            if (idx >= entries.length) { worker.postMessage({ type: 'finish' }); return; }
            const entry = entries[idx];
            worker.postMessage({ type: 'entry', filename: entry.filename, blob: entry.blob });
        }
        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'ready') {
                sendNextEntry();
            } else if (msg.type === 'entry-done') {
                idx++;
                if (onProgress) onProgress(msg.done, entries.length, Math.round((msg.done / entries.length) * 100));
                sendNextEntry();
            } else if (msg.type === 'done') {
                worker.terminate();
                resolve();
            } else if (msg.type === 'error') {
                worker.terminate();
                reject(new Error(msg.message));
            }
        };
        worker.onerror = (err) => { worker.terminate(); reject(new Error(err && err.message ? err.message : 'Lỗi Worker OPFS zip không xác định')); };
        worker.postMessage({ type: 'init', tmpDirName: OPFS_ZIP_TEMP_DIR, tmpFileName, zipJsUrl: ZIP_JS_CDN_URL, totalEntries: entries.length });
    });
}
