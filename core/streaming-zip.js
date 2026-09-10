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
 * lỗi ra ngoài — nơi gọi (`_compressZipEntries()`, core/storage-manager.js) tự bắt và báo lỗi rõ
 * ràng cho người dùng. XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") — KHÔNG còn nhánh
 * JSZip nào để rơi về nữa, zip.js/OPFS giờ là đường DUY NHẤT trong toàn app.
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
 * dùng đường streaming OPFS hay không — dùng ở core/storage-manager.js (`_compressZipEntries()`) để
 * quyết định nén được hay ném lỗi (KHÔNG còn nhánh JSZip nào để rơi về — 10/09/2026, Giang yêu cầu
 * "loại bỏ toàn bộ JSZip").
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
 *
 * SỬA (10/09/2026, Giang xác nhận qua log — TÌM RA GỐC BỆNH THẬT của toàn bộ chuỗi "treo vô thời
 * hạn" đã điều tra suốt các lần sửa trước) — zip.js mặc định `useWebWorkers: true` (tài liệu chính
 * thức `configure()`), tức TỰ ĐỘNG cố spin lên 1 Web Worker RIÊNG CỦA CHÍNH NÓ để nén, trừ khi được
 * cấu hình tắt rõ ràng. Bản CDN đang nạp (`zip-no-worker.min.js`) KHÔNG có code lo Worker nội bộ đó
 * (đúng như tên gọi) — nhưng code TRƯỚC ĐÂY chưa từng gọi `zip.configure({useWebWorkers:false})`
 * lần nào, nên zip.js vẫn ÂM THẦM cố dùng đường Worker nội bộ (không có), treo VÔ THỜI HẠN ngay từ
 * bước đầu tiên — không throw, không timeout tự nhiên. Điều này giải thích ĐÚNG NGUYÊN VĂN mọi triệu
 * chứng đã log qua nhiều lần sửa trước (treo giống hệt bất kể Path A/B của APP — 2 Worker khác hẳn
 * nhau, Worker app không liên quan gì Worker nội bộ zip.js; bất kể nén/không nén — level:0 vẫn qua
 * đúng nhánh cố dùng Worker; bất kể BlobReader hay Uint8ArrayReader — đều treo TRƯỚC KHI kịp đọc byte
 * nào; bất kể Song/Video/Photo) — TOÀN BỘ các giả thuyết trước (WritableStream Safari 26,
 * CompressionStream, cách đọc Blob từ IndexedDB) đều SAI, chỉ là hệ quả gián tiếp của việc cùng đứng
 * chờ 1 Worker nội bộ không bao giờ tồn tại. Gọi `zip.configure({useWebWorkers:false})` NGAY sau khi
 * zip.js sẵn sàng — CHỈ 1 LẦN cho suốt vòng đời app (nhờ `_zipJsLoadPromise` đã memo hoá sẵn).
 * @returns {Promise<void>}
 */
let _zipJsLoadPromise = null;
function _ensureZipJsLoaded() {
    if (_zipJsLoadPromise) return _zipJsLoadPromise;
    const ready = typeof zip !== 'undefined'
        ? Promise.resolve()
        : _withTimeout(new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = ZIP_JS_CDN_URL;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Không tải được thư viện zip.js (kiểm tra kết nối mạng tới CDN).'));
            document.head.appendChild(script);
        }), 10000, 'Nạp thư viện zip.js');
    _zipJsLoadPromise = ready.then(() => {
        if (typeof zip !== 'undefined' && typeof zip.configure === 'function') {
            zip.configure({ useWebWorkers: false });
        }
    });
    return _zipJsLoadPromise;
}

/** Đua 1 Promise với thời hạn — SỬA (10/09/2026, Giang báo bug "treo ở màn Packing zip file") —
 * PHÒNG THỦ THÊM cho các bước "bắt đầu/bắt tay" (createWritable()/Worker báo 'ready') — nếu API
 * KHÔNG hỗ trợ đúng cách nhưng KHÔNG throw ngay (treo im lặng thay vì reject) thì vẫn có lối thoát
 * để rơi xuống Path kế tiếp, thay vì treo UI vĩnh viễn không có cách nào tự phục hồi. CHỈ áp
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
 * gọi (`_compressZipEntries()`, core/storage-manager.js) tự bắt và báo lỗi rõ ràng cho người dùng
 * (KHÔNG còn JSZip để rơi về — 10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip").
 *
 * SỬA (10/09/2026, Giang báo bug "treo vô thời hạn ở màn Packing zip file (0%)") — `_writeViaMainThread()`
 * tự huỷ giữa chừng qua `_addEntryWithStallGuard()` nếu 1 entry hoàn toàn KHÔNG có tiến triển byte
 * nào — lỗi đó ném ra tới ĐÂY, rơi xuống Path B (Worker). Path A bỏ dở CÓ THỂ vẫn giữ khoá ghi trên
 * file OPFS đang dùng (huỷ giữa chừng, không có cách chắc chắn giải phóng khoá đó từ ngoài) — nên
 * Path B (VÀ file trả về cuối cùng) dùng 1 TÊN FILE MỚI, KHÔNG tái dùng tên đã cấp cho Path A.
 *
 * SỬA (10/09/2026, Giang xác nhận qua log — TÌM RA + SỬA GỐC BỆNH THẬT: zip.js mặc định
 * `useWebWorkers: true`, xem docstring đầy đủ ở `_ensureZipJsLoaded()`) — trong lúc điều tra đã từng
 * thử qua nhiều giả thuyết SAI (WritableStream Safari 26, CompressionStream — có đợt chen thêm 1
 * nhánh "Path A'" thử `level:0` để kiểm chứng — ĐÃ BỎ vì không còn cần thiết, gốc bệnh thật không
 * liên quan gì tới nén/không nén). Giờ về lại ĐÚNG 2 nhánh gốc: Path A (nén bình thường,
 * `createWritable()`) rồi Path B (Worker, `createSyncAccessHandle()`) nếu Path A lỗi/treo.
 * @param {Array<{filename:string, blob:Blob}>} entries
 * @param {(done:number,total:number,percent:number|null) => void} [onProgress]
 * @returns {Promise<File>} - 1 File (là Blob) trỏ vào file OPFS vừa ghi, có thêm thuộc tính JS tuỳ
 *   biến `_opfsTempName` (tên file tạm, KHÔNG phải attribute HTML/chuẩn nào) để nơi gọi tự dọn được
 *   qua `cleanupStreamingZipTemp()` sau khi đã tải/share xong, không cần tự nhớ tên riêng.
 */
async function buildZipStreamingToOpfs(entries, onProgress) {
    let hbStart = Date.now();
    let hb = setInterval(() => console.log(`[streaming-zip] ...${Math.round((Date.now() - hbStart) / 1000)}s nạp zip.js + mở OPFS`), 1000);
    let root, tmpDirHandle;
    try {
        await _ensureZipJsLoaded();
        root = await navigator.storage.getDirectory();
        tmpDirHandle = await root.getDirectoryHandle(OPFS_ZIP_TEMP_DIR, { create: true });
    } finally {
        clearInterval(hb);
    }

    /** Cấp 1 tên file tạm MỚI + mở handle — DÙNG CHUNG cho Path A/B. */
    async function freshFileHandle() {
        const name = `zip-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
        const handle = await tmpDirHandle.getFileHandle(name, { create: true });
        return { name, handle };
    }

    let { name: tmpFileName, handle: fileHandle } = await freshFileHandle();

    try {
        await _writeViaMainThread(fileHandle, entries, onProgress); // Path A — nén bình thường
    } catch (errA) {
        console.warn('[streaming-zip] Path A (createWritable) lỗi/treo, thử qua Worker (createSyncAccessHandle):', errA);
        // Path A có thể đã bỏ dở GIỮA CHỪNG — dọn thử file tạm cũ (best-effort, bọc timeout ngắn
        // RIÊNG — file này có thể vẫn đang bị chính writable/zipWriter bỏ dở của Path A khoá ghi,
        // removeEntry() trên 1 file đang khoá CÓ THỂ tự nó cũng treo) rồi cấp TÊN MỚI cho Path B,
        // bất kể dọn được hay không.
        hbStart = Date.now();
        hb = setInterval(() => console.log(`[streaming-zip] ...${Math.round((Date.now() - hbStart) / 1000)}s dọn file tạm Path A bỏ dở`), 1000);
        try { await _withTimeout(tmpDirHandle.removeEntry(tmpFileName), 3000, 'removeEntry() file tạm Path A'); } catch (e) { /* đang khoá/đã mất/hết giờ — bỏ qua */ } finally { clearInterval(hb); }
        ({ name: tmpFileName, handle: fileHandle } = await freshFileHandle());
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
 * kể cả từ lúc BẮT ĐẦU (đồng hồ chạy NGAY từ đầu).
 *
 * SỬA (10/09/2026, Giang báo "mở Debug Console lên không thấy log gì") — bắn 1 dòng console.log MỖI
 * GIÂY (`setInterval`) SUỐT lúc entry đang xử lý, xem docstring `ENTRY_STALL_TIMEOUT_MS` để biết lý
 * do đầy đủ.
 *
 * SỬA (10/09/2026, Giang xác nhận qua log — GỐC BỆNH TREO THẬT SỰ là `zip.js` mặc định
 * `useWebWorkers: true`, tự cố spin 1 Worker nội bộ không tồn tại trong bản "no-worker" đang nạp —
 * xem docstring đầy đủ ở `_ensureZipJsLoaded()`, ĐÃ SỬA bằng `zip.configure({useWebWorkers:false})`)
 * — trong lúc điều tra, có đợt đổi tạm sang đọc hẳn `blob.arrayBuffer()` 1 lần + `Uint8ArrayReader`
 * (nghi `zip.BlobReader`/`blob.slice()` là gốc bệnh, SAI — chỉ là hệ quả gián tiếp của cùng đứng chờ
 * Worker nội bộ không tồn tại). Giờ ĐÃ XÁC NHẬN gốc bệnh thật, KHÔI PHỤC LẠI `zip.BlobReader` chuẩn
 * (đọc CẮT LÁT qua `blob.slice()` nội bộ, KHÔNG đọc nguyên khối) — giữ đúng tinh thần RAM thấp ban
 * đầu của toàn bộ thiết kế streaming OPFS (không phụ thuộc kích thước 1 file, an toàn cả với video
 * nhiều GB, khác bản `Uint8ArrayReader` tạm thời vừa rồi).
 * @param {zip.ZipWriter} zipWriter @param {{filename:string, blob:Blob}} entry
 * @param {string} [pathLabel] - nhãn hiển thị trong log (vd "Path A") — phân biệt nhánh nén nào lúc đọc Debug Console.
 * @returns {Promise<void>}
 */
function _addEntryWithStallGuard(zipWriter, entry, pathLabel) {
    pathLabel = pathLabel || 'Path A';
    return new Promise((resolve, reject) => {
        let settled = false;
        let stallTimer;
        let lastProgress = 0;
        let lastTotal = null;
        const startedAt = Date.now();

        const heartbeat = setInterval(() => {
            if (settled) return;
            const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
            const byteInfo = lastTotal != null ? `${lastProgress}/${lastTotal} byte` : `${lastProgress} byte`;
            console.log(`[streaming-zip] ${pathLabel} ...${elapsedSec}s nén "${entry.filename}" — đã xử lý ${byteInfo}${lastProgress === 0 ? ' (CHƯA có tiến triển nào)' : ''}`);
        }, 1000);

        const armStallTimer = () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => {
                if (settled) return;
                settled = true;
                clearInterval(heartbeat);
                reject(new Error(`Treo khi nén "${entry.filename}" (${pathLabel}) — không có tiến triển byte nào trong ${ENTRY_STALL_TIMEOUT_MS / 1000}s`));
            }, ENTRY_STALL_TIMEOUT_MS);
        };
        armStallTimer();
        zipWriter.add(entry.filename, new zip.BlobReader(entry.blob), {
            onprogress: (progress, total) => { // zip.js — có tiến triển byte thật, reset đồng hồ + cập nhật số byte cho heartbeat
                lastProgress = progress; lastTotal = total;
                if (!settled) armStallTimer();
            },
        }).then(() => {
            if (settled) return; // đã reject vì stall từ trước (hiếm, race) — kết quả trễ này bỏ qua
            settled = true;
            clearInterval(heartbeat);
            clearTimeout(stallTimer);
            resolve();
        }).catch((err) => {
            if (settled) return;
            settled = true;
            clearInterval(heartbeat);
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
 * rồi rơi xuống Path B.
 * @param {FileSystemFileHandle} fileHandle @param {Array<{filename:string, blob:Blob}>} entries
 * @param {(done:number,total:number,percent:number|null) => void} [onProgress]
 */
async function _writeViaMainThread(fileHandle, entries, onProgress) {
    const pathLabel = 'Path A';
    // SỬA (10/09/2026, cùng đợt "mở Debug Console không thấy log gì") — heartbeat riêng cho bước
    // bắt tay createWritable() — bước này ĐÃ có `_withTimeout()` 10s nên hiếm khi thật sự cần, nhưng
    // vẫn thêm để Debug Console KHÔNG im lặng ngay cả trong 10s đầu đó.
    let hbStart = Date.now();
    const createWritableHb = setInterval(() => {
        console.log(`[streaming-zip] ${pathLabel} ...${Math.round((Date.now() - hbStart) / 1000)}s createWritable()`);
    }, 1000);
    let writable;
    try {
        writable = await _withTimeout(fileHandle.createWritable(), 10000, 'createWritable()');
    } finally {
        clearInterval(createWritableHb);
    }
    const zipWriter = new zip.ZipWriter(writable, { bufferedWrite: true });
    let done = 0;
    try {
        for (const entry of entries) {
            await _addEntryWithStallGuard(zipWriter, entry, pathLabel);
            done++;
            if (onProgress) onProgress(done, entries.length, Math.round((done / entries.length) * 100));
        }
        // SỬA (10/09/2026, cùng đợt bug "hơn 1 phút vẫn không thoát loading shield") — bước
        // `close()` (chốt file, ghi central directory) TRƯỚC ĐÂY không có timeout, đối xứng đúng lỗ
        // hổng vừa vá ở Worker (core/workers/opfs-zip-worker.js) — nếu mọi entry nén xong nhưng
        // riêng bước đóng file treo thì vẫn lọt lưới stall-guard ở trên. `_withTimeout()` sẵn có
        // (khai báo đầu file) — 20s, cùng ngưỡng `ENTRY_STALL_TIMEOUT_MS`.
        hbStart = Date.now();
        const closeHb = setInterval(() => {
            console.log(`[streaming-zip] ${pathLabel} ...${Math.round((Date.now() - hbStart) / 1000)}s zipWriter.close()`);
        }, 1000);
        try {
            await _withTimeout(zipWriter.close(), ENTRY_STALL_TIMEOUT_MS, 'zipWriter.close()');
        } finally {
            clearInterval(closeHb);
        }
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
 * sau đó (từng entry) KHÔNG có timeout ở tầng NÀY (chính Worker đã tự stall-guard nội bộ, xem core/
 * workers/opfs-zip-worker.js).
 *
 * SỬA (10/09/2026, Giang báo "mở Debug Console không thấy log gì") — Worker chạy trong 1 global
 * scope RIÊNG, có `console` RIÊNG — việc bọc `console.log` của `core/debug-console.js` (chạy ở main
 * thread) KHÔNG hề ảnh hưởng gì tới `console.*` BÊN TRONG Worker, nên MỌI `console.log()` gọi trực
 * tiếp trong core/workers/opfs-zip-worker.js sẽ KHÔNG BAO GIỜ xuất hiện trong Debug Console (dù có
 * thấy trong DevTools thật, lọc đúng context Worker). Worker giờ tự đóng gói log thành
 * `postMessage({type:'heartbeat', text})` thay vì gọi console.log() trực tiếp — Ở ĐÂY (main thread,
 * console ĐÃ bị debug-console.js bọc) mới thật sự gọi `console.log()` để relay, cho Debug Console
 * thấy được log dù đang nén ở Path B. */
function _writeViaWorker(tmpFileName, entries, onProgress) {
    const worker = new Worker('core/workers/opfs-zip-worker.js');
    const ready = new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'heartbeat') { console.log(`[streaming-zip] ${msg.text}`); return; } // relay log Worker -> Debug Console, xem docstring hàm này
            if (msg.type === 'ready') resolve();
            else if (msg.type === 'error') reject(new Error(msg.message));
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
            if (msg.type === 'heartbeat') { console.log(`[streaming-zip] ${msg.text}`); return; } // cùng lý do relay ở trên
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
        // khoát tại đây để không rò rỉ Worker treo mãi trong nền dù luồng chính đã báo lỗi.
        worker.terminate();
    });
}
