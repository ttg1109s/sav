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
 *
 * KHÔNG dùng ES module (`self.importScripts()`, không phải `import`) — khớp quy ước "không ES
 * module" của project, Worker script cổ điển vẫn dùng importScripts() bình thường dù project chạy
 * qua file://.
 */
let accessHandle = null;
let writeOffset = 0;
let zipWriter = null;
let doneEntries = 0;

/** "Writable" tối giản GIẢ LẬP đúng 2 method zip.js's ZipWriter thực sự gọi (getWriter().write()/
 * .close()) — ghi thẳng qua accessHandle ĐỒNG BỘ (createSyncAccessHandle() vốn là API đồng bộ,
 * không cần bọc lại thành WritableStream chuẩn — zip.js chỉ cần đúng hình dạng này, không kiểm tra
 * instanceof WritableStream thật). */
function makeSyncHandleWritable() {
    return {
        getWriter() {
            return {
                async write(chunk) {
                    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                    accessHandle.write(bytes, { at: writeOffset });
                    writeOffset += bytes.byteLength;
                },
                async close() {
                    accessHandle.flush();
                },
                releaseLock() {},
            };
        },
    };
}

self.onmessage = async (e) => {
    const msg = e.data;
    try {
        if (msg.type === 'init') {
            self.importScripts(msg.zipJsUrl);
            const root = await navigator.storage.getDirectory();
            const dirHandle = await root.getDirectoryHandle(msg.tmpDirName, { create: true });
            const fileHandle = await dirHandle.getFileHandle(msg.tmpFileName, { create: true });
            accessHandle = await fileHandle.createSyncAccessHandle();
            accessHandle.truncate(0); // phòng thủ — đảm bảo file rỗng nếu lỡ tái dùng tên cũ (hiếm, tên file có timestamp+random)
            writeOffset = 0;
            doneEntries = 0;
            zipWriter = new zip.ZipWriter(makeSyncHandleWritable(), { bufferedWrite: true });
            self.postMessage({ type: 'ready' });
            return;
        }
        if (msg.type === 'entry') {
            await zipWriter.add(msg.filename, new zip.BlobReader(msg.blob));
            doneEntries++;
            self.postMessage({ type: 'entry-done', done: doneEntries });
            return;
        }
        if (msg.type === 'finish') {
            await zipWriter.close();
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
