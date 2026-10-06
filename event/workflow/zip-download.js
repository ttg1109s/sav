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

const workflowZipDownload = {
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
            true: () => promptDownloadReady(parts[0].blob, parts[0].filename), // core/id3-export.js — modal 1 file cũ, giữ nguyên
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
        const ok = await triggerDownload(part.blob, part.filename).catch(() => false); // core/id3-export.js
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

    _progressText() {
        return tFormat('common.export.partsProgress', { done: this._downloaded.size, total: this._parts.length });
    },
};
