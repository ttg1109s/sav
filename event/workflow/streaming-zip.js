/**
 * event/workflow/streaming-zip.js — Workflow "streamingZip": nén 1 nhóm file thành 1 .zip ghi thẳng vào file tạm OPFS
 * (các bước thi hành + giải thích Path A/B: core/streaming-zip.js). Gọi từ workflowZipDownload._compressEntries().
 *
 *   - Path A (`createWritable()`, main thread) trước; lỗi/treo thì dọn file dở và sang Path B (Worker
 *     core/workers/opfs-zip-worker.js, `createSyncAccessHandle()`) với TÊN FILE MỚI (file Path A có thể còn bị khoá ghi).
 *   - Bước "bắt tay" (nạp zip.js, createWritable, Worker 'ready', close, abort, xoá file dở) có hạn giờ — API không hỗ trợ
 *     đúng cách có thể treo im lặng thay vì lỗi. Nén từng entry KHÔNG hạn tổng thời gian (file lớn nén lâu là bình thường)
 *     mà chống treo theo tiến triển: quá ENTRY_STALL ms không có byte nào mới -> lỗi.
 *   - Heartbeat log mỗi giây cho Debug Console; Worker có console riêng nên tự gửi 'heartbeat', ở đây relay ra console.
 *   - Cả 2 Path hỏng -> ném lỗi, nơi gọi báo người dùng.
 *   - Thư mục tạm: file đang ghi / đang chờ tải nằm trong `_inUseNames` (nơi tải trả lại qua `release()`). `sweepTemp()`
 *     xoá mọi thứ còn lại — rảnh hẳn thì xoá CẢ thư mục (đệ quy, cuốn luôn file nháp ẩn của Path A bỏ dở). Gọi lúc giao file
 *     xong, lúc nén lỗi, lúc boot và ở nút "Dọn dẹp dữ liệu".
 *
 * NẠP SAU: core/streaming-zip.js, core/dynamic-object-ui.js (loadScriptFile/removeScriptElement/listenEventStream),
 * event/workflow/timeout.js, service/task-manager.js.
 */
const ZIP_JS_LOAD_TIMEOUT_MS = 10000;
const ZIP_WRITABLE_TIMEOUT_MS = 10000;
const ZIP_ENTRY_STALL_TIMEOUT_MS = 20000; // cũng là hạn của zipWriter.close()
const ZIP_CLEANUP_TIMEOUT_MS = 3000; // xoá file dở / abort writable — chính chúng có thể đang bị khoá
const ZIP_WORKER_READY_TIMEOUT_MS = 15000; // đủ để Worker importScripts() zip.js qua mạng
const ZIP_HEARTBEAT_MS = 1000;
const ZIP_TEMP_SWEEP_TIMEOUT_MS = 10000; // dọn thư mục tạm — không để nơi gọi (modal Done, nút dọn) treo theo OPFS

/** zip.js chưa có (thẻ `<script>` tĩnh lỗi mạng lúc boot) -> nạp động, có hạn giờ. */
const ZIP_JS_LOAD_BY_LOADED = {
    true: () => Promise.resolve(),
    false: () => workflowTimeout.race(loadScriptFile(ZIP_JS_CDN_URL, ZIP_JS_CDN_URL), ZIP_JS_LOAD_TIMEOUT_MS, 'Nạp thư viện zip.js') // core/dynamic-object-ui.js
        .then((result) => ZIP_JS_SCRIPT_RESULT_BY_LOADED[result.loaded](result.el)),
};

const ZIP_JS_SCRIPT_RESULT_BY_LOADED = {
    true: () => undefined,
    false: (el) => {
        removeScriptElement(el); // core/dynamic-object-ui.js — lần sau nạp lại từ đầu
        throw new Error('Không tải được thư viện zip.js (kiểm tra kết nối mạng tới CDN).');
    },
};

/** Tin nhắn Worker -> bước đang đợi (`_waitWorkerStep()`): 'ready' (sau init) / 'entry-done' / 'done' (sau finish). */
const ZIP_WORKER_MESSAGE_BY_TYPE = {
    heartbeat: (run, msg) => console.log(`[streaming-zip] ${msg.text}`),
    ready: (run, msg) => workflowStreamingZip._resolveWorkerStep(run, msg),
    'entry-done': (run, msg) => workflowStreamingZip._resolveWorkerStep(run, msg),
    done: (run, msg) => workflowStreamingZip._resolveWorkerStep(run, msg),
    error: (run, msg) => workflowStreamingZip._rejectWorkerStep(run, new Error(msg.message)),
};

// Dọn thư mục tạm: rảnh hẳn -> xoá cả thư mục; còn file đang dùng -> xoá từng mục còn lại.
const ZIP_TEMP_SWEEP_BY_IDLE = {
    true: (dir, stale) => workflowStreamingZip._removeWholeTempDir(dir, stale),
    false: (dir, stale) => workflowStreamingZip._removeTempEntries(dir, stale),
};

const workflowStreamingZip = {
    _zipJsReady: null,
    _stallSeq: 0,
    _inUseNames: new Set(), // file tạm đang ghi / đang chờ người dùng tải — sweepTemp() không đụng
    _activeBuilds: 0, // lượt build() đang chạy (thư mục có thể vừa tạo, chưa kịp có tên file)

    /** Trình duyệt có OPFS không. @returns {boolean} */
    isAvailable() {
        return isStreamingZipAvailable(); // core/streaming-zip.js
    },

    /**
     * Nén `entries` thành 1 .zip trong OPFS. File trả về được giữ trong `_inUseNames` tới khi nơi gọi `release()`; lỗi thì bỏ
     * khỏi nhóm đang dùng (lượt dọn kế tiếp xoá file dở).
     * @param {Array<{filename: string, blob: Blob}>} entries
     * @param {(done: number, total: number, percent: number) => void} onProgress
     * @returns {Promise<File>} File trỏ vào file OPFS, mang `_opfsTempName`
     */
    async build(entries, onProgress) {
        const run = { tempName: null };
        this._activeBuilds++;
        try {
            return await this._buildInto(run, entries, onProgress);
        } catch (err) {
            this._inUseNames.delete(run.tempName);
            throw err;
        } finally {
            this._activeBuilds--;
        }
    },

    async _buildInto(run, entries, onProgress) {
        const dirHandle = await this._withHeartbeat('nạp zip.js + mở OPFS', async () => {
            await this._ensureZipJs();
            return openZipTempDir(); // core/streaming-zip.js
        });
        let temp = await this._createTrackedTemp(dirHandle, run);
        try {
            await this._writeViaMainThread(temp.handle, entries, onProgress);
        } catch (errA) {
            console.warn('[streaming-zip] Path A (createWritable) lỗi/treo, thử qua Worker (createSyncAccessHandle):', errA);
            await this._withHeartbeat('dọn file tạm Path A bỏ dở', () => workflowTimeout
                .race(removeZipTempFile(dirHandle, temp.name), ZIP_CLEANUP_TIMEOUT_MS, 'removeEntry() file tạm Path A')
                .catch(() => { /* đang khoá/đã mất/hết giờ — lượt dọn thư mục sau sẽ xoá */ }));
            this._inUseNames.delete(temp.name);
            temp = await this._createTrackedTemp(dirHandle, run);
            await this._writeViaWorker(temp.name, entries, onProgress);
        }
        return readZipTempFile(temp.handle, temp.name); // core/streaming-zip.js
    },

    /** Tạo file tạm tên mới và đánh dấu đang dùng. */
    async _createTrackedTemp(dirHandle, run) {
        const temp = await createZipTempFile(dirHandle); // core/streaming-zip.js
        this._inUseNames.add(temp.name);
        run.tempName = temp.name;
        return temp;
    },

    /** Nơi tải đã xong với các file (Done / Huỷ / nén lỗi) — bỏ khỏi nhóm đang dùng rồi dọn thư mục tạm.
     * @param {Array<string|undefined>} tempNames - `file._opfsTempName` @returns {Promise<number>} số mục đã xoá */
    release(tempNames) {
        tempNames.forEach((name) => this._inUseNames.delete(name));
        return this.sweepTemp();
    },

    /** Dọn thư mục tạm zip trừ file đang dùng — có hạn giờ, lỗi không ném (boot, nút "Dọn dẹp dữ liệu", sau mỗi lượt tải).
     * @returns {Promise<number>} số mục đã xoá (xoá cả thư mục còn cuốn thêm file nháp ẩn không đếm được) */
    sweepTemp() {
        return workflowTimeout.race(this._sweep(), ZIP_TEMP_SWEEP_TIMEOUT_MS, 'dọn thư mục tạm zip') // event/workflow/timeout.js
            .catch((err) => {
                console.warn('[streaming-zip] Dọn thư mục tạm zip lỗi/hết giờ (lần dọn sau thử lại):', err);
                return 0;
            });
    },

    async _sweep() {
        if (!isStreamingZipAvailable()) return 0; // core/streaming-zip.js
        const dir = await openExistingZipTempDir();
        if (!dir) return 0; // chưa từng tạo
        const names = [];
        for await (const name of dir.keys()) names.push(name);
        const stale = pickStaleZipTempNames(names, this._inUseNames); // core/streaming-zip.js
        const removed = await ZIP_TEMP_SWEEP_BY_IDLE[isZipTempIdle(this._inUseNames.size, this._activeBuilds)](dir, stale);
        console.log(`[streaming-zip] Dọn thư mục tạm zip: xoá ${removed}/${stale.length} mục, giữ ${this._inUseNames.size} file đang dùng.`);
        return removed;
    },

    /** Xoá cả thư mục; có mục đang khoá (vd writable Path A còn treo trong phiên này) thì xoá từng mục còn xoá được. */
    async _removeWholeTempDir(dir, stale) {
        try {
            await removeZipTempDir(); // core/streaming-zip.js
            return stale.length;
        } catch (err) {
            console.warn('[streaming-zip] Không xoá được cả thư mục tạm, xoá từng mục:', err);
            return this._removeTempEntries(dir, stale);
        }
    },

    async _removeTempEntries(dir, names) {
        const results = await Promise.allSettled(names.map((name) => removeZipTempFile(dir, name))); // core/streaming-zip.js
        return countZipTempRemoved(results);
    },

    /** Nạp (nếu cần) + cấu hình zip.js đúng 1 lần; lỗi thì lần sau thử lại. @returns {Promise<void>} */
    _ensureZipJs() {
        if (!this._zipJsReady) {
            this._zipJsReady = ZIP_JS_LOAD_BY_LOADED[isZipJsLoaded()]() // core/streaming-zip.js
                .then(() => configureZipJs())
                .catch((err) => { this._zipJsReady = null; throw err; });
        }
        return this._zipJsReady;
    },

    /** Chạy `fn`, log mỗi giây tới khi xong. */
    async _withHeartbeat(label, fn) {
        const startedAt = Date.now();
        const stop = workflowTimeout.heartbeat(ZIP_HEARTBEAT_MS, () => console.log(formatZipStepHeartbeat(label, startedAt, Date.now()))); // core/streaming-zip.js
        try {
            return await fn();
        } finally {
            stop();
        }
    },

    /** Path A. Lỗi/treo -> huỷ writable (có hạn giờ, lỗi dọn không che lỗi gốc) rồi ném lỗi gốc để build() sang Path B. */
    async _writeViaMainThread(fileHandle, entries, onProgress) {
        const writable = await this._withHeartbeat('Path A createWritable()', () => workflowTimeout.race(openZipTempWritable(fileHandle), ZIP_WRITABLE_TIMEOUT_MS, 'createWritable()')); // core/streaming-zip.js
        const zipWriter = createZipWriter(writable); // core/streaming-zip.js
        try {
            for (let i = 0; i < entries.length; i++) {
                await this._addEntryWithStallGuard(zipWriter, entries[i]);
                onProgress(i + 1, entries.length, computeZipProgressPercent(i + 1, entries.length)); // core/streaming-zip.js
            }
            await this._withHeartbeat('Path A zipWriter.close()', () => workflowTimeout.race(closeZipWriter(zipWriter), ZIP_ENTRY_STALL_TIMEOUT_MS, 'zipWriter.close()'));
        } catch (err) {
            await workflowTimeout.race(abortZipWritable(writable), ZIP_CLEANUP_TIMEOUT_MS, 'writable.abort()').catch(() => { /* dọn thất bại — bỏ qua */ });
            throw err;
        }
    },

    /** Nén 1 entry, lỗi khi quá ZIP_ENTRY_STALL_TIMEOUT_MS không có byte nào mới (đồng hồ chạy từ đầu, mỗi lần zip.js báo
     * tiến triển thì đặt lại). File lớn nén chậm nhưng vẫn tiến triển không bao giờ bị huỷ oan. */
    _addEntryWithStallGuard(zipWriter, entry) {
        const startedAt = Date.now();
        const state = { bytes: 0, total: null, settled: false };
        const stallTask = `zipEntryStall_${this._stallSeq++}`;
        const stopHeartbeat = workflowTimeout.heartbeat(ZIP_HEARTBEAT_MS, () => console.log(formatZipEntryHeartbeat('Path A', entry.filename, startedAt, Date.now(), state.bytes, state.total))); // core/streaming-zip.js
        return new Promise((resolve, reject) => {
            const armStall = () => {
                if (state.settled) return;
                taskManager.once(() => reject(new Error(`Treo khi nén "${entry.filename}" (Path A) — không có tiến triển byte nào trong ${ZIP_ENTRY_STALL_TIMEOUT_MS / 1000}s`)), ZIP_ENTRY_STALL_TIMEOUT_MS, stallTask);
            };
            armStall();
            addZipWriterEntry(zipWriter, entry, (bytes, total) => { state.bytes = bytes; state.total = total; armStall(); }) // core/streaming-zip.js
                .then(resolve, reject);
        }).finally(() => {
            state.settled = true;
            stopHeartbeat();
            taskManager.kill(stallTask);
        });
    },

    /** Path B — "ping-pong" từng entry: gửi 1 lệnh, đợi Worker báo xong mới gửi tiếp. Chỉ bước bắt tay có hạn giờ (Worker
     * tự chống treo từng entry). Kết thúc (kể cả lỗi/hết giờ) luôn terminate Worker — không để Worker treo chạy ngầm. */
    async _writeViaWorker(tmpFileName, entries, onProgress) {
        const worker = createZipWorker(); // core/streaming-zip.js
        const run = { waiter: null };
        const stopMessage = listenEventStream(worker, 'message', (e) => ZIP_WORKER_MESSAGE_BY_TYPE[e.data.type](run, e.data)); // core/dynamic-object-ui.js
        const stopError = listenEventStream(worker, 'error', (e) => this._rejectWorkerStep(run, new Error(describeZipWorkerError(e))));
        try {
            await workflowTimeout.race(this._waitWorkerStep(run, () => postZipWorkerInit(worker, tmpFileName, entries.length)), ZIP_WORKER_READY_TIMEOUT_MS, 'Worker khởi động (createSyncAccessHandle)');
            for (const entry of entries) {
                const msg = await this._waitWorkerStep(run, () => postZipWorkerEntry(worker, entry));
                onProgress(msg.done, entries.length, computeZipProgressPercent(msg.done, entries.length));
            }
            await this._waitWorkerStep(run, () => postZipWorkerFinish(worker));
        } finally {
            stopMessage();
            stopError();
            terminateZipWorker(worker);
        }
    },

    /** Gửi 1 lệnh rồi đợi tin nhắn kết thúc bước đó. @returns {Promise<object>} tin nhắn của Worker */
    _waitWorkerStep(run, send) {
        return new Promise((resolve, reject) => {
            run.waiter = { resolve, reject };
            send();
        });
    },

    _resolveWorkerStep(run, msg) {
        const waiter = run.waiter;
        if (!waiter) return; // không có bước nào đang đợi (tin nhắn trễ)
        run.waiter = null;
        waiter.resolve(msg);
    },

    _rejectWorkerStep(run, err) {
        const waiter = run.waiter;
        if (!waiter) return;
        run.waiter = null;
        waiter.reject(err);
    },
};
