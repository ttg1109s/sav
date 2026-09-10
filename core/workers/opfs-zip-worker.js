/**
 * core/workers/opfs-zip-worker.js — MỚI (10/09/2026, cùng đợt core/streaming-zip.js). Worker RIÊNG
 * cho "Path B" (`FileSystemFileHandle.createSyncAccessHandle()`) — API này BẮT BUỘC chạy trong 1
 * dedicated Web Worker (main thread gọi thẳng sẽ lỗi ngay), dùng khi Safari chưa hỗ trợ
 * `createWritable()` (Path A, xem docstring core/streaming-zip.js).
 *
 * GIAO THỨC (postMessage, "ping-pong" TỪNG entry một — xem core/streaming-zip.js::_writeViaWorker()):
 *   Main -> Worker: {type:'init', tmpDirName, tmpFileName, zipJsUrl, totalEntries}
 *   Worker -> Main: {type:'ready'}                              (đã mở xong file OPFS + zip.js)
 *   Main -> Worker: {type:'entry', filename, blob}               (từng file MỘT)
 *   Worker -> Main: {type:'entry-done', done}                    (đã nén+ghi xong entry đó)
 *   Main -> Worker: {type:'finish'}                              (hết entry, đóng zip)
 *   Worker -> Main: {type:'done'}                                (đã ghi xong, file OPFS sẵn sàng)
 *   Worker -> Main: {type:'error', message}                      (lỗi ở BẤT KỲ bước nào ở trên)
 *   Worker -> Main: {type:'heartbeat', text}                     (MỚI 10/09/2026 — log tiến độ mỗi
 *     giây trong lúc init/entry/finish đang chạy — main thread relay qua console.log() để Debug
 *     Console, core/debug-console.js, thấy được; xem docstring _addEntryWithStallGuard() ngay dưới)
 *
 * KHÔNG dùng ES module (`self.importScripts()`, không phải `import`) — khớp quy ước "không ES
 * module" của project, Worker script cổ điển vẫn dùng importScripts() bình thường dù project chạy
 * qua file://.
 */
let accessHandle = null;
let writeOffset = 0;
let zipWriter = null;
let doneEntries = 0;

/** Ngưỡng "treo thật" cho nén 1 entry (giống hệt lý do/giá trị `ENTRY_STALL_TIMEOUT_MS`,
 * core/streaming-zip.js::_addEntryWithStallGuard() — Worker là script RIÊNG, thread RIÊNG, không
 * gọi được hàm từ file đó nên viết LẠI bản tương đương ở đây) — SỬA (10/09/2026, Giang báo bug
 * "hơn 1 phút vẫn không thoát loading shield") — Path A (main thread) đã có stall-guard, đúng như kỳ
 * vọng tự rơi xuống Path B sau 20s treo, NHƯNG Path B (file NÀY) trước đây KHÔNG có bảo vệ nào ở bước
 * nén từng entry — nếu gốc treo KHÔNG phải riêng `WritableStream` của Path A (vd do chính zip.js
 * dùng `CompressionStream` gốc bị treo trên bản Safari 26 này, ẢNH HƯỞNG CẢ 2 Path vì dùng chung 1
 * logic nén) thì Path B treo tiếp VÔ THỜI HẠN, không có lối thoát nào — đúng triệu chứng "hơn 1
 * phút". Giờ Path B CŨNG có stall-guard y hệt Path A — treo thật (đo qua `onprogress` của zip.js,
 * KHÔNG phải tổng thời gian nén — file lớn nén chậm nhưng vẫn tiến triển sẽ KHÔNG bị huỷ oan) thì
 * `postMessage({type:'error'})` về main thread, `_writeViaWorker()` reject, CẢ 2 Path đã thất bại ->
 * `_compressZipEntries()` (core/storage-manager.js) tự rơi về JSZip cũ (KHÔNG dùng CompressionStream,
 * tránh đúng gốc nghi vấn). */
const ENTRY_STALL_TIMEOUT_MS = 20000;

/** Ngưỡng riêng cho bước `zipWriter.close()` (finish) — bước này KHÔNG xử lý byte theo entry (chỉ
 * ghi central directory, bình thường rất nhanh) nên dùng 1 timeout CỐ ĐỊNH đơn giản, cùng tinh thần
 * timeout "bắt tay" (`_withTimeout()`, core/streaming-zip.js) thay vì cơ chế đo tiến triển như
 * `_addEntryWithStallGuard()`. */
const CLOSE_STALL_TIMEOUT_MS = 20000;

/** Đua 1 Promise với thời hạn cố định — bản LOCAL của `_withTimeout()` (core/streaming-zip.js, thread
 * khác không gọi chéo được). Dùng cho bước `close()`. */
function _raceTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Hết thời gian chờ (${label})`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Nén 1 entry trong Worker, đua với "đồng hồ báo treo" tự reset mỗi khi zip.js bắn `onprogress` —
 * bản LOCAL của `_addEntryWithStallGuard()` (core/streaming-zip.js), xem docstring đầy đủ ở
 * `ENTRY_STALL_TIMEOUT_MS` ngay trên.
 * SỬA (10/09/2026, Giang báo "mở Debug Console không thấy log gì") — bắn heartbeat MỖI GIÂY qua
 * `postMessage({type:'heartbeat'})` (KHÔNG gọi `console.log()` trực tiếp trong Worker — Worker có
 * `console` RIÊNG, việc bọc console.log của core/debug-console.js chạy ở MAIN THREAD không ảnh
 * hưởng gì tới đây, log gọi thẳng ở Worker sẽ KHÔNG BAO GIỜ xuất hiện trong Debug Console — main
 * thread (core/streaming-zip.js::_writeViaWorker()) nhận heartbeat này rồi MỚI thật sự console.log()
 * Ở ĐÓ để relay vào Debug Console).
 * SỬA (10/09/2026, Giang xác nhận qua log — GỐC BỆNH TREO THẬT SỰ là `zip.js` mặc định
 * `useWebWorkers: true`, ĐÃ SỬA ở 'init' bên dưới bằng `zip.configure({useWebWorkers:false})`) —
 * trong lúc điều tra có đợt đổi tạm sang đọc `blob.arrayBuffer()` + `Uint8ArrayReader` (nghi
 * `BlobReader` là gốc bệnh, SAI). Giờ KHÔI PHỤC LẠI `zip.BlobReader` chuẩn (đọc cắt lát, RAM thấp,
 * an toàn cho video lớn). */
function _addEntryWithStallGuard(filename, blob) {
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
            self.postMessage({ type: 'heartbeat', text: `Path B (Worker) ...${elapsedSec}s nén "${filename}" — đã xử lý ${byteInfo}${lastProgress === 0 ? ' (CHƯA có tiến triển nào)' : ''}` });
        }, 1000);

        const armStallTimer = () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => {
                if (settled) return;
                settled = true;
                clearInterval(heartbeat);
                reject(new Error(`Treo khi nén "${filename}" trong Worker — không có tiến triển byte nào trong ${ENTRY_STALL_TIMEOUT_MS / 1000}s`));
            }, ENTRY_STALL_TIMEOUT_MS);
        };
        armStallTimer();
        zipWriter.add(filename, new zip.BlobReader(blob), {
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

/** "Writable" GIẢ LẬP cho `createSyncAccessHandle()` — ghi thẳng qua accessHandle ĐỒNG BỘ.
 * SỬA (10/09/2026, Giang báo bug "treo ở màn Packing zip file") — TRƯỚC ĐÂY trả về 1 object TỰ CHẾ
 * (chỉ có `getWriter()` trả `{write, close, releaseLock}` viết tay) — KHÔNG phải WritableStream
 * chuẩn thật, chỉ "giống hình dạng". zip.js (ZipWriter) nhiều khả năng gọi `.pipeTo()`/kiểm tra tín
 * hiệu backpressure chuẩn (`writer.ready`, giá trị trả về của `write()` theo đúng Streams API) mà
 * object tự chế đó KHÔNG hề implement — 1 await nội bộ của zip.js có thể không bao giờ resolve ->
 * TREO VĨNH VIỄN, không throw, không timeout — đúng triệu chứng "treo ở màn Packing zip file".
 * Giờ dùng ĐÚNG `new WritableStream({...})` (Web Streams API thật, có sẵn trong Worker) — zip.js
 * chắc chắn tương thích đầy đủ (đây chính là loại object ZipWriter được viết ra để nhận). */
function makeSyncHandleWritable() {
    return new WritableStream({
        write(chunk) {
            const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
            accessHandle.write(bytes, { at: writeOffset });
            writeOffset += bytes.byteLength;
        },
        close() {
            accessHandle.flush();
        },
        abort() {
            try { accessHandle.close(); } catch (e) { /* đã lỗi từ trước, bỏ qua lỗi dọn dẹp phụ */ }
        },
    });
}

self.onmessage = async (e) => {
    const msg = e.data;
    try {
        if (msg.type === 'init') {
            const hbStart = Date.now();
            const hb = setInterval(() => self.postMessage({ type: 'heartbeat', text: `Path B (Worker) ...${Math.round((Date.now() - hbStart) / 1000)}s khởi tạo (importScripts + createSyncAccessHandle)` }), 1000);
            try {
                self.importScripts(msg.zipJsUrl);
                // SỬA (10/09/2026, Giang xác nhận qua log — gốc bệnh treo THẬT SỰ: zip.js mặc định
                // `useWebWorkers: true`, tự cố spin 1 Worker RIÊNG CỦA CHÍNH NÓ để nén — bản
                // "no-worker" đang nạp không có code lo việc đó, treo im lặng nếu không tắt rõ ràng.
                // Xem docstring đầy đủ ở core/streaming-zip.js::_ensureZipJsLoaded(). Gọi NGAY sau
                // importScripts(), TRƯỚC khi dựng ZipWriter bất kỳ.
                if (typeof zip !== 'undefined' && typeof zip.configure === 'function') {
                    zip.configure({ useWebWorkers: false });
                }
                const root = await navigator.storage.getDirectory();
                const dirHandle = await root.getDirectoryHandle(msg.tmpDirName, { create: true });
                const fileHandle = await dirHandle.getFileHandle(msg.tmpFileName, { create: true });
                accessHandle = await fileHandle.createSyncAccessHandle();
                accessHandle.truncate(0); // phòng thủ — đảm bảo file rỗng nếu lỡ tái dùng tên cũ (hiếm, tên file có timestamp+random)
                writeOffset = 0;
                doneEntries = 0;
                zipWriter = new zip.ZipWriter(makeSyncHandleWritable(), { bufferedWrite: true });
            } finally {
                clearInterval(hb);
            }
            self.postMessage({ type: 'ready' });
            return;
        }
        if (msg.type === 'entry') {
            await _addEntryWithStallGuard(msg.filename, msg.blob);
            doneEntries++;
            self.postMessage({ type: 'entry-done', done: doneEntries });
            return;
        }
        if (msg.type === 'finish') {
            const hbStart = Date.now();
            const hb = setInterval(() => self.postMessage({ type: 'heartbeat', text: `Path B (Worker) ...${Math.round((Date.now() - hbStart) / 1000)}s zipWriter.close()` }), 1000);
            try {
                await _raceTimeout(zipWriter.close(), CLOSE_STALL_TIMEOUT_MS, 'zipWriter.close()');
            } finally {
                clearInterval(hb);
            }
            accessHandle.flush();
            accessHandle.close();
            self.postMessage({ type: 'done' });
            return;
        }
    } catch (err) {
        try { if (accessHandle) accessHandle.close(); } catch (e2) { /* đã lỗi từ trước, bỏ qua lỗi dọn dẹp phụ */ }
        self.postMessage({ type: 'error', message: (err && err.message) ? err.message : String(err) });
    }
};
