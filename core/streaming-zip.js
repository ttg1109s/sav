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

/** Nạp zip.js — BÌNH THƯỜNG đã có sẵn qua thẻ `<script>` tĩnh trong index.html (cùng chỗ khai báo
 * JSZip) nên hàm này chỉ cần CHECK sự tồn tại; hàm CHỈ thật sự tải động (dự phòng) nếu vì lý do nào
 * đó thẻ tĩnh đó chưa chạy kịp/lỗi mạng lúc boot — bọc `_withTimeout()` (10s) để không treo vô hạn
 * nếu request mạng không bao giờ tự bắn `load`/`error` (hiếm nhưng có thể xảy ra trên mạng chập
 * chờn) — SỬA (10/09/2026, Giang báo bug "treo ở màn Packing zip file", cùng đợt sửa
 * makeSyncHandleWritable() ở core/workers/opfs-zip-worker.js).
 * @returns {Promise<void>}
 */
let _zipJsLoadPromise = null;
function _ensureZipJsLoaded() {
    if (typeof zip !== 'undefined') return Promise.resolve();
    if (_zipJsLoadPromise) return _zipJsLoadPromise;
    const loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = ZIP_JS_CDN_URL;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không tải được thư viện zip.js (kiểm tra kết nối mạng tới CDN).'));
        document.head.appendChild(script);
    });
    _zipJsLoadPromise = _withTimeout(loadPromise, 10000, 'Nạp thư viện zip.js');
    return _zipJsLoadPromise;
}

/** Đua 1 Promise với thời hạn — SỬA (10/09/2026, Giang báo bug "treo ở màn Packing zip file") —
 * PHÒNG THỦ THÊM cho các bước "bắt đầu/bắt tay" (createWritable()/Worker báo 'ready') — nếu API
 * KHÔNG hỗ trợ đúng cách nhưng KHÔNG throw ngay (treo im lặng thay vì reject) thì vẫn có lối thoát
 * để rơi xuống Path kế tiếp/JSZip, thay vì treo UI vĩnh viễn không có cách nào tự phục hồi. CHỈ áp
 * dụng cho bước "bắt tay" (nên gần như tức thời nếu hoạt động đúng) — KHÔNG áp dụng cho việc nén
 * từng entry (file lớn nén lâu là bình thường, không phải treo, không nên bị huỷ giữa chừng).
 */
function _withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Hết thời gian chờ (${label})`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Xây dựng .zip STREAM thẳng vào 1 file OPFS tạm — KHÔNG dựng liền 1 khối Blob trong RAM (xem
 * docstring đầu file để biết đầy đủ 2 cách A/B). Ném lỗi ra ngoài nếu CẢ 2 cách đều thất bại — nơi
 * gọi (`buildAllXZipBlob()`, core/storage-manager.js) tự bắt để rơi về JSZip cũ.
 *
 * SỬA (10/09/2026, Giang báo bug "treo vô thời hạn ở màn Packing zip file (0%)" — xác nhận xảy ra
 * trên iOS 26/Safari 26 MỚI NHẤT, cờ "File System WritableStream" đã BẬT sẵn — nghĩa là KHÔNG phải
 * do Safari thiếu hỗ trợ `createWritable()` như trước đây, mà nghi do 1 kiểu tương tác lỗi/kẹt giữa
 * zip.js và bản cài WritableStream còn non của Safari 26, CHƯA rõ nguyên nhân sâu) — `_writeViaMainThread()`
 * giờ tự huỷ giữa chừng qua `_addEntryWithStallGuard()` nếu 1 entry hoàn toàn KHÔNG có tiến triển
 * byte nào (không phải "chậm", mà "đứng hình" thật) — lỗi đó ném ra tới ĐÂY, rơi xuống Path B (Worker)
 * giống mọi lỗi Path A khác. Path A bỏ dở CÓ THỂ vẫn giữ khoá ghi trên file OPFS đang dùng (huỷ giữa
 * chừng, không có cách chắc chắn giải phóng khoá đó từ ngoài) — nên Path B (VÀ file trả về cuối
 * cùng) giờ dùng 1 TÊN FILE MỚI, KHÔNG tái dùng tên đã cấp cho Path A, tránh bị chính khoá đó chặn.
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
    let tmpFileName = `zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
    let fileHandle = await tmpDirHandle.getFileHandle(tmpFileName, { create: true });

    try {
        await _writeViaMainThread(fileHandle, entries, onProgress); // Path A
    } catch (errA) {
        console.warn('[streaming-zip] Path A (createWritable) lỗi/treo, thử qua Worker (createSyncAccessHandle):', errA);
        // Path A có thể đã bỏ dở GIỮA CHỪNG (không chỉ lỗi NGAY từ createWritable() như trước) —
        // dọn thử file tạm cũ (best-effort, có thể vẫn đang khoá nếu treo thật, bỏ qua lỗi — không
        // chặn fallback) rồi cấp TÊN MỚI cho Path B, xem docstring hàm này để biết lý do đầy đủ.
        try { await tmpDirHandle.removeEntry(tmpFileName); } catch (e) { /* đang khoá/đã mất — bỏ qua */ }
        tmpFileName = `zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
        fileHandle = await tmpDirHandle.getFileHandle(tmpFileName, { create: true });
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

/** Ngưỡng "treo thật" cho việc nén 1 entry ở Path A — SỬA (10/09/2026, Giang báo bug "treo vô thời
 * hạn ở màn Packing zip file (0%)" trên iOS 26/Safari 26 mới nhất). KHÔNG phải ngưỡng THỜI GIAN NÉN
 * (file lớn nén lâu vẫn bình thường, KHÔNG nên bị huỷ — lý do trước đây vòng lặp nén cố tình không
 * có timeout nào) — mà là ngưỡng THỜI GIAN KHÔNG CÓ TIẾN TRIỂN byte nào, đo qua callback `onprogress`
 * của zip.js (xem `_addEntryWithStallGuard()` ngay dưới). File lớn đang nén chậm nhưng VẪN bắn
 * onprogress đều (dù thưa) sẽ KHÔNG bao giờ bị huỷ oan — chỉ "hoàn toàn không nhúc nhích" trong suốt
 * khoảng này mới bị coi là treo thật. */
const ENTRY_STALL_TIMEOUT_MS = 20000;

/** Nén 1 entry, đua với 1 "đồng hồ báo treo" TỰ RESET mỗi khi zip.js bắn `onprogress` (tiến triển
 * byte THẬT) — CHỈ reject khi trôi quá `ENTRY_STALL_TIMEOUT_MS` mà KHÔNG có bất kỳ tiến triển nào,
 * kể cả từ lúc BẮT ĐẦU (đồng hồ chạy NGAY từ đầu — đúng triệu chứng Giang gặp: kẹt cứng ở 0%, chưa
 * từng bắn onprogress lần nào để có cơ hội reset).
 * @param {zip.ZipWriter} zipWriter @param {{filename:string, blob:Blob}} entry
 * @returns {Promise<void>}
 */
function _addEntryWithStallGuard(zipWriter, entry) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let stallTimer;
        const armStallTimer = () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(`Treo khi nén "${entry.filename}" — không có tiến triển byte nào trong ${ENTRY_STALL_TIMEOUT_MS / 1000}s (nghi Path A/createWritable kẹt)`));
            }, ENTRY_STALL_TIMEOUT_MS);
        };
        armStallTimer();
        zipWriter.add(entry.filename, new zip.BlobReader(entry.blob), {
            onprogress: () => { if (!settled) armStallTimer(); }, // zip.js — có tiến triển byte thật, reset đồng hồ
        }).then(() => {
            if (settled) return; // đã reject vì stall từ trước (hiếm, race) — kết quả trễ này bỏ qua
            settled = true;
            clearTimeout(stallTimer);
            resolve();
        }).catch((err) => {
            if (settled) return;
            settled = true;
            clearTimeout(stallTimer);
            reject(err);
        });
    });
}

/** Path A — `createWritable()`, chạy thẳng main thread, không cần Worker. Ném lỗi nếu Safari chưa
 * hỗ trợ (bắt ở `buildZipStreamingToOpfs()` để rơi xuống Path B) — bước `createWritable()` bọc
 * `_withTimeout()` (10s, xem docstring hàm đó) phòng trường hợp API không hỗ trợ đúng cách nhưng
 * treo thay vì reject ngay.
 * SỬA (10/09/2026, Giang báo bug "treo vô thời hạn ở màn Packing zip file (0%)") — từng entry giờ
 * nén qua `_addEntryWithStallGuard()` (ngay trên) thay vì gọi thẳng `zipWriter.add()` — phát hiện
 * đúng kiểu "treo thật, không nhúc nhích byte nào" thay vì để `for` đứng yên vô thời hạn không có lối
 * thoát nào. Lỗi/stall ném ra ngoài -> `buildZipStreamingToOpfs()` bắt, huỷ writable (best-effort)
 * rồi rơi xuống Path B. */
async function _writeViaMainThread(fileHandle, entries, onProgress) {
    const writable = await _withTimeout(fileHandle.createWritable(), 10000, 'createWritable()');
    const zipWriter = new zip.ZipWriter(writable, { bufferedWrite: true });
    let done = 0;
    try {
        for (const entry of entries) {
            await _addEntryWithStallGuard(zipWriter, entry);
            done++;
            if (onProgress) onProgress(done, entries.length, Math.round((done / entries.length) * 100));
        }
        // SỬA (10/09/2026, cùng đợt bug "hơn 1 phút vẫn không thoát loading shield") — bước
        // `close()` (chốt file, ghi central directory) TRƯỚC ĐÂY không có timeout, đối xứng đúng lỗ
        // hổng vừa vá ở Worker (core/workers/opfs-zip-worker.js) — nếu mọi entry nén xong nhưng
        // riêng bước đóng file treo thì vẫn lọt lưới stall-guard ở trên. `_withTimeout()` sẵn có
        // (khai báo đầu file) — 20s, cùng ngưỡng `ENTRY_STALL_TIMEOUT_MS`.
        await _withTimeout(zipWriter.close(), ENTRY_STALL_TIMEOUT_MS, 'zipWriter.close()');
    } catch (err) {
        // Best-effort huỷ writable đang dở — KHÔNG await vô thời hạn (bản thân writable có thể
        // CHÍNH LÀ nguồn treo), bọc timeout ngắn riêng; lỗi/timeout ở bước dọn này KHÔNG che lỗi
        // gốc (vẫn throw err gốc ra ngoài để buildZipStreamingToOpfs() rơi đúng nhánh Path B).
        try { await _withTimeout(writable.abort(), 3000, 'writable.abort()'); } catch (e2) { /* dọn thất bại — bỏ qua, không chặn fallback */ }
        throw err;
    }
}

/** Path B — giao hẳn cho core/workers/opfs-zip-worker.js (createSyncAccessHandle() BẮT BUỘC chạy
 * trong dedicated Worker, main thread gọi thẳng sẽ lỗi). Giao tiếp qua postMessage() dạng "ping-
 * pong" TỪNG entry một (gửi 1 -> đợi Worker báo xong -> gửi tiếp) — KHÔNG gộp cả mảng gửi 1 lần,
 * tránh giữ nhiều Blob lớn cùng lúc ở CẢ 2 phía. Bước bắt tay đầu ('init' -> đợi 'ready') bọc
 * `_withTimeout()` (15s, đủ thời gian Worker tải zip.js qua importScripts() qua mạng) — CÁC bước
 * sau đó (từng entry) KHÔNG có timeout, vì nén file lớn hợp lệ có thể mất nhiều thời gian, không
 * nên bị huỷ giữa chừng. */
function _writeViaWorker(tmpFileName, entries, onProgress) {
    const worker = new Worker('core/workers/opfs-zip-worker.js');
    const ready = new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            if (e.data.type === 'ready') resolve();
            else if (e.data.type === 'error') reject(new Error(e.data.message));
        };
        worker.onerror = (err) => reject(new Error(err && err.message ? err.message : 'Lỗi Worker OPFS zip không xác định'));
        worker.postMessage({ type: 'init', tmpDirName: OPFS_ZIP_TEMP_DIR, tmpFileName, zipJsUrl: ZIP_JS_CDN_URL, totalEntries: entries.length });
    });

    return _withTimeout(ready, 15000, 'Worker khởi động (createSyncAccessHandle)').then(() => new Promise((resolve, reject) => {
        let idx = 0;
        function sendNextEntry() {
            if (idx >= entries.length) { worker.postMessage({ type: 'finish' }); return; }
            const entry = entries[idx];
            worker.postMessage({ type: 'entry', filename: entry.filename, blob: entry.blob });
        }
        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'entry-done') {
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
        sendNextEntry(); // đã 'ready' từ bước trên — bắt đầu gửi entry đầu tiên NGAY, KHÔNG gửi lại 'init'
    })).finally(() => {
        // Timeout ở bước 'ready' (Promise.race thua) thì Worker vẫn có thể đang chạy ngầm (không có
        // cách huỷ importScripts()/createSyncAccessHandle() đang treo giữa chừng) — terminate() dứt
        // khoát tại đây để không rò rỉ Worker treo mãi trong nền dù luồng chính đã rơi về JSZip.
        worker.terminate();
    });
}
