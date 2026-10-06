/**
 * event/workflow/zip-download.js — Workflow "zipDownload" (MỚI 06/10/2026, Giang yêu cầu: "khi zip file lớn hơn
 * 500MB thì chia thành nhóm rồi zip, khi xong hiển thị các file zip lẻ ở modal download, tuân thủ theme key").
 *
 * VÌ SAO: trong PWA iOS chỉ navigator.share() lưu được file ra ngoài, và share đọc nguyên file vào RAM — Giang đo
 * (share-size-test.html) 600MB vẫn ổn, chốt mỗi file/phần tối đa 500MB (MEDIA_FILE_MAX_BYTES, core/upload-
 * validation.js — cũng là giới hạn upload). Mỗi phần là 1 zip HOÀN CHỈNH (giải nén riêng được trong app Tệp).
 *
 * DÙNG CHUNG cho MỌI luồng zip: Storage Management + Folder Download (event/workflow/file-manager-storage.js::
 * zipAndDownloadOrFallback()) và Xuất ZIP ở chế độ Chọn (event/workflow/playlist.js::exportSelected*Zip()).
 *   1. `compressInParts(entries, zipFileName)` — gọi BÊN TRONG withLoadingShield() của nơi gọi: chia nhóm (core
 *      groupZipEntriesBySize()), nén từng nhóm vào OPFS (core _compressZipEntries()), tự cập nhật chữ tiến độ.
 *   2. `deliver(parts)` — gọi SAU khi shield đóng: 1 phần -> modal cũ promptDownloadReady() (y nguyên hành vi trước
 *      đây); nhiều phần -> modal danh sách (components/zip-download-parts.js + core/zip-download-ui.js), mỗi phần
 *      1 nút Tải xuống riêng (mỗi lượt share cần 1 lần chạm thật). Đóng modal xong tự dọn mọi file zip tạm OPFS.
 *      Resolve `true` chỉ khi MỌI phần đã tải — Storage Management dựa vào đó để không xoá dữ liệu khi chưa tải đủ.
 *
 * Trạng thái modal nhiều phần (`_parts`, `_bodyEl`, `_downloaded`, `_busyIndex`, `_resolveParts`) chỉ sống trong
 * lúc modal mở — cùng cách event/workflow/recorder.js giữ trạng thái modal nghe lại.
 *
 * MỞ RỘNG (06/10/2026, dọn nợ Rule 1/3 — Giang yêu cầu) — cụm này giờ lo MỌI lượt tải file ra ngoài, không riêng zip:
 *   - `deliverFile(blob, filename)` — THAY core `triggerDownload()`: chọn đường Service Worker / Share / <a download>
 *     bằng object map, gọi core thi hành từng đường (core/large-file-download.js, core/id3-export.js).
 *   - `promptSingle(blob, filename)` — THAY core `promptDownloadReady()`: modal "Sẵn sàng tải xuống" 1 file, nút đi qua
 *     eventBus ('zipDownload.single.click' / '.cancel') -> `downloadSingle()` / `cancelSingle()`.
 *   - `collectEntries(type, keys)` — THAY core `collectAll*ZipEntries()`/`_collectZipEntries()` (core tự đọc DB): đọc
 *     record 1 transaction, core thuần `planZipEntries()` đặt tên chống trùng, Song gắn lại tag qua `buildTaggedBlob()`.
 *   Tên cụm 'zipDownload' giữ nguyên (lịch sử) — nghĩa thực tế là "tải xuống".
 *
 * NẠP SAU: core/upload-validation.js (MEDIA_FILE_MAX_BYTES — đọc NGAY lúc nạp), core/storage-manager.js,
 * core/id3-export.js, core/streaming-zip.js, core/about-stats.js, core/modal-choice-ui.js, core/zip-download-ui.js,
 * components/zip-download-parts.js. NẠP TRƯỚC: event/router/zip-download.js.
 */

const ZIP_PART_MAX_BYTES = MEDIA_FILE_MAX_BYTES; // core/upload-validation.js — 500MB, Giang chốt 06/10/2026

/** Chữ tiến độ trong loading shield — 1 phần giữ NGUYÊN chữ cũ, nhiều phần ghi thêm "phần i/n". */
const ZIP_PROGRESS_TEXT_BY_SINGLE = {
    true: (partNumber, partCount, percent) => tFormat('common.storage.zippingProgress', { percent }),
    false: (partNumber, partCount, percent) => tFormat('common.storage.zippingPartProgress', { part: partNumber, total: partCount, percent }),
};

/** Tên file từng phần — 1 phần giữ NGUYÊN tên gốc, nhiều phần thêm hậu tố "-part{i}of{n}" trước đuôi. */
const ZIP_PART_FILENAME_BY_SINGLE = {
    true: (zipFileName) => zipFileName,
    false: (zipFileName, partNumber, partCount) => {
        const dot = zipFileName.lastIndexOf('.');
        const stem = dot > 0 ? zipFileName.slice(0, dot) : zipFileName;
        const ext = dot > 0 ? zipFileName.slice(dot) : '.zip';
        return `${stem}-part${partNumber}of${partCount}${ext}`;
    },
};

/** Câu tóm tắt modal nhiều phần — kèm thời gian xử lý nếu đo được. */
const ZIP_PARTS_SUMMARY_BY_HAS_DURATION = {
    true: (vars, durationMs) => tFormat('common.export.partsBodyWithDuration', { ...vars, duration: _formatProcessingDuration(durationMs) }), // core/id3-export.js
    false: (vars) => tFormat('common.export.partsBody', vars),
};

/** Đường giao file cho hệ điều hành — chọn trong deliverFile(). Share hỏng (không phải huỷ) và Service Worker lỗi đều rơi về
 * <a download> (lưới cuối, như bản core cũ). */
const FILE_DELIVERY_BY_ROUTE = {
    serviceWorker: (blob, filename) => triggerLargeFileDownloadViaServiceWorker(blob, filename) // core/large-file-download.js
        .then(() => true, (err) => {
            console.warn('[zip-download] Tải qua Service Worker lỗi, rơi về <a download>:', err);
            return workflowZipDownload._deliverViaAnchor(blob, filename);
        }),
    share: (blob, filename, file) => shareFileViaSystem(file) // core/id3-export.js
        .then((result) => SHARE_RESULT_TO_DELIVERED[result](blob, filename)),
    anchor: (blob, filename) => Promise.resolve(workflowZipDownload._deliverViaAnchor(blob, filename)),
};

/** Kết quả Share Sheet -> đã giao file chưa. Người dùng tự huỷ = KHÔNG rơi về <a download> (họ chỉ đổi ý). */
const SHARE_RESULT_TO_DELIVERED = {
    shared: () => true,
    aborted: () => false,
    failed: (blob, filename) => workflowZipDownload._deliverViaAnchor(blob, filename),
};

/** Nguồn record + đuôi mặc định + cách lấy Blob cho zip theo loại media. Song gắn lại tag ID3 (core/id3-export.js). */
const ZIP_ENTRY_SOURCE_BY_TYPE = {
    song: { readRecords: (keys) => getSongRecordsByKeys(keys), defaultExt: '.mp3', resolveBlob: (record) => buildTaggedBlob(record) },
    video: { readRecords: (keys) => getVideoRecordsByKeys(keys), defaultExt: '.mp4', resolveBlob: (record) => Promise.resolve(record.blob) },
    photo: { readRecords: (keys) => getImageRecordsByKeys(keys), defaultExt: '.jpg', resolveBlob: (record) => Promise.resolve(record.blob) },
};

const workflowZipDownload = {
    _single: null,
    _parts: null,
    _bodyEl: null,
    _downloaded: null,
    _busyIndex: null,
    _resolveParts: null,

    /**
     * Chia `entries` thành các nhóm <= 500MB rồi nén TỪNG nhóm thành 1 zip trong OPFS. Gọi BÊN TRONG
     * withLoadingShield() của nơi gọi (tự ghi `loadingText`). Lỗi nén ném thẳng ra ngoài — nơi gọi đã có try/catch.
     * @param {Array<{filename:string, blob:Blob}>} entries
     * @param {string} zipFileName - tên file .zip đầy đủ khi chỉ có 1 phần
     * @returns {Promise<Array<{blob: Blob, filename: string, fileCount: number}>>}
     */
    async compressInParts(entries, zipFileName) {
        const groups = groupZipEntriesBySize(entries, ZIP_PART_MAX_BYTES); // core/storage-manager.js
        const isSingle = groups.length === 1;
        const parts = [];
        for (let i = 0; i < groups.length; i++) {
            const partNumber = i + 1;
            const blob = await _compressZipEntries(groups[i], (done, total, percent) => { // core/storage-manager.js
                const pct = percent != null ? Math.round(percent) : Math.round((done / total) * 100);
                loadingText.textContent = ZIP_PROGRESS_TEXT_BY_SINGLE[isSingle](partNumber, groups.length, pct);
            });
            parts.push({ blob, filename: ZIP_PART_FILENAME_BY_SINGLE[isSingle](zipFileName, partNumber, groups.length), fileCount: groups[i].length });
        }
        console.log(`[zip-download] Nén xong ${parts.length} phần (tối đa ${(ZIP_PART_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB/phần) cho "${zipFileName}".`);
        return parts;
    },

    /**
     * Giao các phần zip cho người dùng tải rồi dọn file tạm OPFS. Gọi SAU khi loading shield đã đóng.
     * @param {Array<{blob: Blob, filename: string, fileCount: number}>} parts
     * @returns {Promise<boolean>} true = mọi phần đã tải
     */
    async deliver(parts) {
        if (parts.length === 0) return true; // không có gì để tải (mọi key đều không còn tồn tại)
        const deliverByCount = {
            true: () => this.promptSingle(parts[0].blob, parts[0].filename), // modal 1 file, giữ nguyên hành vi cũ
            false: () => this._presentParts(parts),
        };
        const allDownloaded = await deliverByCount[parts.length === 1]();
        await Promise.all(parts
            .filter((part) => part.blob._opfsTempName)
            .map((part) => cleanupStreamingZipTemp(part.blob._opfsTempName))); // core/streaming-zip.js
        return allDownloaded;
    },

    /** Mở modal danh sách các phần — resolve khi bấm "Xong" (xem finishParts()).
     * @returns {Promise<boolean>} */
    _presentParts(parts) {
        const totalBytes = parts.reduce((sum, part) => sum + part.blob.size, 0);
        const totalDurationMs = parts.reduce((sum, part) => sum + (part.blob._zipDurationMs || 0), 0);
        const summaryVars = { size: formatBytes(totalBytes), n: parts.length, limit: formatBytes(ZIP_PART_MAX_BYTES) }; // core/about-stats.js
        const summaryText = ZIP_PARTS_SUMMARY_BY_HAS_DURATION[totalDurationMs > 0](summaryVars, totalDurationMs);
        const rows = parts.map((part) => ({
            filenameHtml: escapeHtml(part.filename), // core/modal-choice-ui.js — tên folder do người dùng đặt
            sizeText: formatBytes(part.blob.size), // core/about-stats.js
            countText: tFormat('common.export.partFileCount', { n: part.fileCount }),
        }));

        return new Promise((resolve) => {
            this._parts = parts;
            this._downloaded = new Set();
            this._busyIndex = null;
            this._resolveParts = resolve;
            modalChoice(summaryText, [
                { label: t('common.export.partsBtnDone'), themeKeys: 'btnNeutralBg btnNeutralHoverBg btnNeutralText', onClick: () => eventBus.send({ router: 'zipDownload', type: 'zipDownload.done.click', payload: {} }) },
            ], {
                title: t('common.export.readyTitle'),
                bodyHtml: renderZipPartsBody(rows, this._progressText()), // components/zip-download-parts.js
                showCancel: false,
            }); // core/modal-choice-ui.js — chỉ 1 nút "Xong", không đóng khi bấm ra ngoài
            this._bodyEl = document.getElementById('modal-choice-body');
            wireZipPartsBody(this._bodyEl); // core/zip-download-ui.js
        });
    },

    /** Ứng với 'zipDownload.part.click' — giao đúng 1 phần cho hệ điều hành (share), chạy NGAY trong lượt chạm
     * (eventBus đồng bộ -> còn user activation). Chỉ 1 phần tại 1 thời điểm (Share Sheet không mở chồng được).
     * @param {number} index */
    async downloadPart(index) {
        const part = this._parts && this._parts[index];
        if (!part || this._busyIndex !== null) return; // modal đã đóng / đang giao phần khác
        const rowEl = this._bodyEl.querySelector(`[data-zip-part-row="${index}"]`);
        this._busyIndex = index;
        markZipPartDownloading(rowEl, t('common.export.partDownloading')); // core/zip-download-ui.js
        const ok = await this.deliverFile(part.blob, part.filename).catch(() => false);
        this._busyIndex = null;
        if (!this._parts) return; // modal đã đóng trong lúc chờ (hiếm)
        const resultByOk = {
            true: () => {
                this._downloaded.add(index);
                markZipPartDownloaded(rowEl, t('common.export.partDownloadAgain')); // core/zip-download-ui.js
                setZipPartsProgressText(this._bodyEl.querySelector('#zip-parts-progress'), this._progressText()); // core/zip-download-ui.js
            },
            false: () => {
                const labelByDownloadedBefore = { true: 'common.export.partDownloadAgain', false: 'common.export.readyBtnDownload' };
                markZipPartIdle(rowEl, t(labelByDownloadedBefore[this._downloaded.has(index)])); // core/zip-download-ui.js
            },
        };
        resultByOk[ok === true]();
    },

    /** Ứng với 'zipDownload.done.click' — modalChoice() đã tự đóng; trả kết quả + xoá trạng thái modal. */
    finishParts() {
        const resolve = this._resolveParts;
        if (!resolve) return;
        const allDownloaded = this._downloaded.size === this._parts.length;
        console.log(`[zip-download] Đóng modal nhiều phần — đã tải ${this._downloaded.size}/${this._parts.length} phần.`);
        this._parts = null;
        this._bodyEl = null;
        this._downloaded = null;
        this._busyIndex = null;
        this._resolveParts = null;
        resolve(allDownloaded);
    },

    /**
     * Giao 1 file cho hệ điều hành — THAY core `triggerDownload()` (06/10/2026). PHẢI gọi đồng bộ ngay trong lượt bấm thật
     * (eventBus đồng bộ) — trước bước Share KHÔNG có await nào. Chọn đường:
     *   - file > LARGE_FILE_SKIP_SHARE_BYTES (core/id3-export.js) + Service Worker khả dụng (HTTPS) -> 'serviceWorker';
     *   - file nhỏ hơn + trình duyệt cho share đúng File này -> 'share';
     *   - còn lại -> 'anchor' (<a download>, có thể dính lỗi WebKitBlobResource với file rất lớn qua file://).
     * @param {Blob} blob @param {string} filename
     * @returns {Promise<boolean>} true = đã giao (SW/anchor không có tín hiệu "xong" nên coi như đã giao), false = huỷ Share Sheet
     */
    deliverFile(blob, filename) {
        const isLargeFile = blob.size > LARGE_FILE_SKIP_SHARE_BYTES; // core/id3-export.js
        // File lớn KHÔNG bọc new File() (bản cũ nghi bước này ép sao chép byte) — chỉ cần cho đường Share.
        const file = isLargeFile ? null : new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        const canShare = !!file && !!navigator.canShare && !!navigator.share && navigator.canShare({ files: [file] });
        const route = (isLargeFile && isLargeFileDownloadSupported() && 'serviceWorker') // core/large-file-download.js
            || (canShare && 'share')
            || 'anchor';
        console.log(`[zip-download] Giao "${filename}" (${(blob.size / (1024 * 1024)).toFixed(1)}MB) qua đường "${route}"`);
        return FILE_DELIVERY_BY_ROUTE[route](blob, filename, file);
    },

    /** Lưới cuối: blob URL tạo + thu hồi ở Workflow, core chỉ bấm <a download>. @returns {boolean} */
    _deliverViaAnchor(blob, filename) {
        const url = createBlobUrl(blob); // service/blob-url.js
        clickDownloadAnchor(url, filename); // core/id3-export.js
        revokeBlobUrl(url); // service/blob-url.js
        return true;
    },

    /**
     * Modal "Sẵn sàng tải xuống" cho 1 file — THAY core `promptDownloadReady()` (06/10/2026), giữ nguyên chữ/hành vi: nút
     * "Tải xuống" mới giao file (user activation của ĐÚNG lượt bấm đó), Huỷ thì đóng. Nút đi qua eventBus.
     * @param {Blob} blob @param {string} filename
     * @returns {Promise<boolean>} true = đã tải, false = Huỷ / huỷ Share Sheet / lỗi
     */
    promptSingle(blob, filename) {
        const bodyByHasDuration = {
            true: () => tFormat('common.export.readyBodyWithDuration', { size: formatBytes(blob.size), duration: _formatProcessingDuration(blob._zipDurationMs) }), // core/about-stats.js, core/id3-export.js
            false: () => tFormat('common.export.readyBody', { size: formatBytes(blob.size) }),
        };
        return new Promise((resolve) => {
            this._single = { blob, filename, resolve };
            modalChoice( // core/modal-choice-ui.js
                bodyByHasDuration[blob._zipDurationMs != null](),
                [{ label: t('common.export.readyBtnDownload'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => eventBus.send({ router: 'zipDownload', type: 'zipDownload.single.click', payload: {} }) }],
                { title: t('common.export.readyTitle'), onCancel: () => eventBus.send({ router: 'zipDownload', type: 'zipDownload.single.cancel', payload: {} }) }
            );
        });
    },

    /** Ứng với 'zipDownload.single.click' — modal đã tự đóng; giao file ngay trong lượt bấm. */
    async downloadSingle() {
        const single = this._single;
        if (!single) return; // guard: modal đã xử lý
        this._single = null;
        const ok = await this.deliverFile(single.blob, single.filename).catch(() => false);
        single.resolve(ok === true);
    },

    /** Ứng với 'zipDownload.single.cancel'. */
    cancelSingle() {
        const single = this._single;
        if (!single) return;
        this._single = null;
        single.resolve(false);
    },

    /**
     * Gom `{filename, blob}` sẵn sàng nén cho 1 loại media — THAY core `collectAll*ZipEntries()`/`_collectZipEntries()`
     * (06/10/2026, core tự đọc DB). Đọc record 1 transaction, core thuần `planZipEntries()` đặt tên chống trùng + bỏ key
     * không còn tồn tại; 1 file gắn tag lỗi thì rơi về file gốc (không làm rớt cả lượt).
     * @param {'song'|'video'|'photo'} type @param {string[]} keys
     * @returns {Promise<Array<{filename: string, blob: Blob}>>}
     */
    async collectEntries(type, keys) {
        const source = ZIP_ENTRY_SOURCE_BY_TYPE[type];
        const records = await source.readRecords(keys); // service/db.js
        const plan = planZipEntries(keys, records, source.defaultExt); // core/storage-manager.js
        const entries = [];
        for (const item of plan) {
            const blob = await source.resolveBlob(item.record).catch((e) => {
                console.error(`[zip-download] Lỗi chuẩn bị file "${item.filename}", dùng file gốc thay thế:`, e);
                return item.record.blob;
            });
            entries.push({ filename: item.filename, blob });
        }
        return entries;
    },

    _progressText() {
        return tFormat('common.export.partsProgress', { done: this._downloaded.size, total: this._parts.length });
    },
};
