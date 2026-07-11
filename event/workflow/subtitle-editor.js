/**
 * event/workflow/subtitle-editor.js — Workflow DUY NHẤT của trang `subtitle-editor.html` (KHÔNG
 * nạp ở `index.html`). MỚI HOÀN TOÀN (10/07/2026, phản hồi Giang — chuyển Subtitle Editor từ modal
 * sang trang riêng).
 *
 * Trang này KHÔNG dùng `appState` của app chính (không nạp `service/state.js`) — state RIÊNG sống
 * trong instance object này (giống tinh thần `EventStore` nhưng đơn giản hơn, không cần namespace
 * vì chỉ 1 trang, 1 workflow duy nhất).
 *
 * WaveSurfer.js (CDN, xem subtitle-editor.html) đảm nhiệm CẢ waveform LẪN phát âm thanh — KHÔNG
 * cần `<audio>` riêng, KHÔNG cần Worker decode riêng (đã cân nhắc lại theo phản hồi Giang — dùng
 * thư viện thứ 3 thay vì tự viết, xem plan-subtitle-editor-page.md mục 1.3/1.4). Đúng 1 Region
 * (`this._region`) DUY NHẤT tồn tại suốt vòng đời trang — 2 tay kéo yêu cầu = 2 tay kéo (start/
 * end) của CHÍNH region này (KHÔNG tạo thêm region mới) — mọi tool "theo vùng chọn" đều thao tác
 * lên region đó.
 *
 * TÍNH NĂNG GIỮ NGUYÊN (yêu cầu Giang — không đổi hành vi, chỉ đổi UI xung quanh): Upload .srt,
 * Auto-timing (2 nhịp bấm dựa theo thời điểm phát, KHÔNG dùng region), Thêm dòng (nối sau dòng
 * cuối +2s), Xuất .srt.
 * TÍNH NĂNG MỚI (yêu cầu Giang): Lấy giờ từ vùng chọn (tạo dòng mới từ `this._region`), Phát vùng
 * chọn (`this._region.play()`), nút Lưu tách riêng khỏi "đóng" (trang không tự đóng khi lưu — có
 * nút "←" quay lại riêng, xem `back()`).
 *
 * NẠP SAU: core/subtitle/subtitles.js, core/subtitle/subtitles-ui.js, service/db.js, lang/lang.js,
 * WaveSurfer.js (CDN) + Regions plugin (CDN).
 */
const workflowSubtitleEditor = {
    _songKey: null,
    _record: null, // record ĐẦY ĐỦ từ getSongRecord() (tag, blob, subtitles, duration...)
    _subtitles: [], // mảng làm việc — CHƯA CHẮC đã lưu xuống DB (bấm "Lưu" mới ghi thật)
    _autoSubStartTime: null, // đang "ghi" auto-timing hay không (khác null = đang ghi)
    _wavesurfer: null,
    _regionsPlugin: null,
    _region: null, // Region DUY NHẤT, sống suốt vòng đời trang — mọi tool "vùng chọn" thao tác lên nó
    _isDebugPanelOpen: false, // MỚI (11/07/2026) — bảng debug log đang mở hay không
    _debugLogInterval: null, // MỚI (11/07/2026) — id setInterval refresh bảng debug log lúc đang mở

    /** Chạy 1 LẦN lúc trang load xong (xem event/listener/subtitle-editor.js). */
    async init() {
        const encoded = new URLSearchParams(window.location.search).get('song');
        const songKey = encoded ? decodeSongKeyFromUrl(encoded) : null; // service/song-key-cipher.js
        if (!songKey) { this._showFatalError(t('subtitleEditor.invalidLink')); return; }

        const record = await getSongRecord(songKey); // service/db.js
        if (!record) { this._showFatalError(t('subtitleEditor.songNotFound')); return; }

        this._songKey = songKey;
        this._record = record;
        this._subtitles = sortSubtitlesByStart(record.subtitles ? record.subtitles.slice() : []); // core

        editorTitleEl.textContent = record.tag?.title || record.filename || songKey;
        this._renderLines();
        await this._initWaveform(record.blob);
    },

    _showFatalError(message) {
        editorTitleEl.textContent = t('subtitleEditor.errorTitle');
        linesContainerEl.innerHTML = `<p class="text-sm text-slate-400 text-center py-10">${message}</p>`;
    },

    async _initWaveform(blob) {
        // FIX (11/07/2026, phản hồi Giang) — trước đây KHÔNG có try/catch/kiểm tra gì quanh
        // WaveSurfer — nếu CDN chặn/lỗi (`WaveSurfer`/`WaveSurfer.Regions` undefined) hay
        // `load()`/decode thất bại, khung waveform biến mất im lặng, KHÔNG có gì báo cho người
        // dùng biết. Giờ LUÔN hiện `#waveform-frame` (chiều cao cố định, xem subtitle-editor.html)
        // — lỗi ở BẤT KỲ bước nào đều hiện `#waveform-error` NGAY TRONG khung đó, không biến mất.
        if (typeof WaveSurfer === 'undefined' || typeof WaveSurfer.Regions === 'undefined') {
            console.error('[subtitle-editor] WaveSurfer.js không tải được (CDN chặn/lỗi mạng?).');
            this._showWaveformError();
            return;
        }

        // ĐIỀU TRA 11/07/2026 (mục 1, yêu cầu Giang) — record.blob CÓ THỂ rỗng/undefined (bản ghi
        // hỏng, hoặc field bị đổi tên ở đâu đó) — không phải lỗi WaveSurfer, nhưng biểu hiện GIỐNG
        // HỆT lỗi waveform (khung trống/báo lỗi), nên kiểm tra riêng để log rõ đúng nguyên nhân.
        if (!blob) {
            console.error('[subtitle-editor] record.blob rỗng — bản ghi bài hát không có dữ liệu âm thanh.');
            this._showWaveformError();
            return;
        }

        try {
            // FIX MỚI (11/07/2026, điều tra mục 1) — record.blob ở đây LUÔN tới từ 1 lượt
            // getSongRecord() (xem init()), tức ĐÚNG điều kiện cần rematerializeBlob() (xem comment
            // đầy đủ ở service/db.js::rematerializeBlob()) để né lỗi "Blob round-trip qua
            // IndexedDB" đã biết của Chromium — trước đây _initWaveform() dùng THẲNG record.blob,
            // bỏ sót đúng bước này (saveToDatabase() ở dưới ĐÃ áp dụng đúng, nơi đây thì chưa).
            const freshBlob = await rematerializeBlob(blob); // service/db.js
            const url = URL.createObjectURL(freshBlob);
            this._regionsPlugin = WaveSurfer.Regions.create();
            this._wavesurfer = WaveSurfer.create({
                container: waveformContainerEl,
                height: 88,
                waveColor: '#475569',
                progressColor: '#0ea5e9',
                cursorColor: '#f8fafc',
                minPxPerSec: 70, // cuộn ngang — bài dài hơn khung nhìn sẽ tự cuộn được (mục "dải âm thanh cuộn ngang")
                normalize: true,
                plugins: [this._regionsPlugin],
            });

            this._wavesurfer.on('error', (err) => {
                console.error('[subtitle-editor] WaveSurfer lỗi tải/giải mã audio:', err);
                this._showWaveformError();
            });

            this._wavesurfer.on('decode', () => {
                const duration = this._wavesurfer.getDuration();
                this._region = this._regionsPlugin.addRegion({
                    start: 0,
                    end: Math.min(2, duration),
                    color: 'rgba(56, 189, 248, 0.25)',
                    drag: true,
                    resize: true,
                });
                // MỚI (11/07/2026, mục 2) — thanh giờ start/end sống theo ĐÚNG region này suốt
                // vòng đời trang, tự cập nhật mỗi lần kéo tay cầm (không cần đợi 'update-end').
                this._region.on('update', () => this._updateRegionTimeDisplay());
                this._updateRegionTimeDisplay();
            });

            // MỚI (11/07/2026, mục 2) — chỉ hiện thanh Play/Pause + giờ start/end SAU KHI waveform
            // thật sự sẵn sàng (decode xong + đã vẽ xong), tránh hiện điều khiển cho 1 waveform
            // chưa có gì để play/pause.
            this._wavesurfer.on('ready', () => {
                waveformControlsEl.classList.remove('hidden');
                this._updateRegionTimeDisplay();
            });
            this._wavesurfer.on('play', () => {
                iconWaveformPlay.classList.add('hidden');
                iconWaveformPause.classList.remove('hidden');
            });
            this._wavesurfer.on('pause', () => {
                iconWaveformPause.classList.add('hidden');
                iconWaveformPlay.classList.remove('hidden');
            });

            // FIX MỚI (11/07/2026, điều tra mục 1 — NGUYÊN NHÂN CHÍNH nghi vấn) — `load()` trả về
            // 1 Promise; bản cũ gọi "buông tay" (không await, không .catch()). WaveSurfer.js v7 có
            // bug đã biết (dangling/unawaited promise trong Decoder#decode/WaveSurfer#load, GitHub
            // issue #3126, katspaugh/wavesurfer.js) khiến lỗi giải mã audio ("Uncaught (in promise)
            // DOMException: Unable to decode audio data") CÓ THỂ không đi qua sự kiện 'error' phía
            // trên — tức khung waveform vẫn treo/trống mà KHÔNG hiện #waveform-error, lỗi thật chỉ
            // nằm im trong console (mà Giang không xem được trên di động/WebView). Thêm .catch()
            // đảm bảo LUÔN hiện lỗi + log rõ thông điệp thật, dù wavesurfer có bắn 'error' hay
            // không. Đây cũng chính là lý do bảng debug log (mục 2) bắt thêm cả
            // `window.onunhandledrejection` ở subtitle-editor.html — phòng khi lỗi vẫn lọt qua cả
            // 2 lớp trên.
            this._wavesurfer.load(url).catch((err) => {
                console.error('[subtitle-editor] wavesurfer.load() bị reject (lỗi tải/giải mã audio):', err);
                this._showWaveformError();
            });
        } catch (err) {
            console.error('[subtitle-editor] Lỗi khởi tạo WaveSurfer:', err);
            this._showWaveformError();
        }
    },

    /** Hiện thông báo lỗi NGAY TRONG khung waveform cố định (KHÔNG để khung biến mất/trống rỗng) —
     * các tool cần vùng chọn (Lấy giờ từ vùng chọn/Phát vùng) sẽ không hoạt động (this._region vẫn
     * `null`) nhưng Auto-timing/Thêm dòng/Upload/Xuất .srt (không phụ thuộc waveform) vẫn dùng
     * được bình thường. */
    _showWaveformError() {
        waveformErrorEl.classList.remove('hidden');
    },

    /** MỚI (11/07/2026, mục 2) — cập nhật 2 nhãn giờ start/end theo ĐÚNG this._region hiện tại,
     * cùng định dạng "HH:MM:SS,mmm" như ô giờ mỗi dòng phụ đề (secToStr(), core/subtitle/
     * subtitles.js) cho nhất quán. Gọi lại mỗi lần region 'update' (kéo tay cầm) + lúc 'ready'. */
    _updateRegionTimeDisplay() {
        if (!this._region) return;
        waveformRegionStartEl.textContent = secToStr(this._region.start); // core
        waveformRegionEndEl.textContent = secToStr(this._region.end); // core
    },

    /** MỚI (11/07/2026, mục 2) — bật/tắt bảng xem console.log/warn/error + lỗi promise không ai
     * bắt (window.__sedLog, thu từ đầu <head> subtitle-editor.html — xem comment ở đó) NGAY TRÊN
     * MÀN HÌNH, phục vụ điều tra bug waveform trên thiết bị không có devtools. Panel TỰ LÀM MỚI
     * (setInterval 500ms) trong lúc đang mở — dừng hẳn lúc đóng, không có trang này thì không nạp
     * `service/task-manager.js` nên KHÔNG dùng taskManager (không có trên trang này), setInterval
     * thuần là lựa chọn đúng duy nhất ở đây. */
    toggleDebugPanel() {
        this._isDebugPanelOpen = !this._isDebugPanelOpen;
        waveformDebugPanelEl.classList.toggle('hidden', !this._isDebugPanelOpen);
        if (this._isDebugPanelOpen) {
            this._renderDebugLog();
            this._debugLogInterval = setInterval(() => this._renderDebugLog(), 500);
        } else if (this._debugLogInterval) {
            clearInterval(this._debugLogInterval);
            this._debugLogInterval = null;
        }
    },

    /** Vẽ lại toàn bộ window.__sedLog vào #waveform-debug-log — dùng createElement/textContent
     * (KHÔNG innerHTML) vì nội dung log có thể chứa bất kỳ ký tự nào từ message lỗi thật, tự bọc
     * an toàn khỏi HTML injection. */
    _renderDebugLog() {
        const lines = window.__sedLog || [];
        waveformDebugLogEl.replaceChildren();
        if (lines.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-slate-500';
            empty.textContent = t('subtitleEditor.debugLogEmpty');
            waveformDebugLogEl.appendChild(empty);
        } else {
            lines.forEach((line) => {
                const row = document.createElement('div');
                row.className = line.level === 'error' ? 'text-rose-400' : line.level === 'warn' ? 'text-amber-400' : 'text-slate-300';
                row.textContent = `[${line.time}] ${line.msg}`;
                waveformDebugLogEl.appendChild(row);
            });
        }
        waveformDebugPanelEl.scrollTop = waveformDebugPanelEl.scrollHeight;
    },

    // ============================== Danh sách dòng sub ==============================

    _renderLines() {
        renderSubtitleLines(linesContainerEl, this._subtitles, { // core/subtitle/subtitles-ui.js
            onApply: (id, changes) => this._applyLine(id, changes),
            onRemove: (id) => this._removeLine(id),
        });
        subEmptyStateEl.classList.toggle('hidden', this._subtitles.length > 0);
    },

    _applyLine(id, changes) {
        this._subtitles = computeUpdatedSubtitles(this._subtitles, id, { // core
            text: changes.text,
            start: strToSec(changes.startStr), // core
            end: strToSec(changes.endStr), // core
        });
        this._subtitles = sortSubtitlesByStart(this._subtitles); // core — giờ đổi có thể đổi thứ tự
        this._renderLines();
    },

    _removeLine(id) {
        this._subtitles = computeRemovedSubtitles(this._subtitles, id); // core
        this._renderLines();
    },

    // ============================== Toolbar: giữ nguyên tính năng cũ ==============================

    /** Auto-timing — 2 nhịp bấm dựa theo THỜI ĐIỂM PHÁT (KHÔNG dùng region) — GIỮ NGUYÊN hành vi cũ. */
    handleAutoTimingClick() {
        if (this._autoSubStartTime === null) {
            this._autoSubStartTime = this._wavesurfer.getCurrentTime();
            btnAutoTiming.classList.remove('bg-rose-600'); btnAutoTiming.classList.add('bg-red-500', 'animate-pulse');
            iconAutoTimingIdle.classList.add('hidden'); iconAutoTimingRecording.classList.remove('hidden');
        } else {
            let startTime = this._autoSubStartTime;
            let endTime = this._wavesurfer.getCurrentTime();
            if (endTime < startTime) { const tmp = startTime; startTime = endTime; endTime = tmp; }
            const newSub = createSubtitleLine(t('subtitleEditor.autoTiming.defaultText'), startTime, endTime); // core
            this._subtitles = sortSubtitlesByStart([...this._subtitles, newSub]); // core
            this._resetAutoTiming();
            this._renderLines();
        }
    },

    _resetAutoTiming() {
        this._autoSubStartTime = null;
        btnAutoTiming.classList.remove('bg-red-500', 'animate-pulse'); btnAutoTiming.classList.add('bg-rose-600');
        iconAutoTimingRecording.classList.add('hidden'); iconAutoTimingIdle.classList.remove('hidden');
    },

    /** "+ Thêm dòng" — nối sau dòng cuối +2s — GIỮ NGUYÊN hành vi cũ (KHÔNG dùng region, xem
     * createLineFromSelection() bên dưới cho tool MỚI dùng region). */
    addNewLine() {
        const last = this._subtitles[this._subtitles.length - 1];
        const startSec = last ? last.end + 0.1 : 0;
        const newSub = createSubtitleLine(t('subtitleEditor.newLine.defaultText'), startSec, startSec + 2); // core
        this._subtitles = [...this._subtitles, newSub]; // đã ở cuối mảng, không cần sort lại
        this._renderLines();
    },

    importSrtFile(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            this._subtitles = sortSubtitlesByStart(parseSRT(evt.target.result)); // core
            this._renderLines();
        };
        reader.readAsText(file);
    },

    async exportSrt() {
        if (this._subtitles.length === 0) { await alertModal(t('common.subtitle.exportEmpty')); return; }
        const srt = buildSRTString(this._subtitles); // core
        const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${this._record.tag?.title || this._songKey}.srt`; a.click();
        URL.revokeObjectURL(url);
    },

    // ============================== Toolbar: MỚI (yêu cầu Giang) ==============================

    /** "Lấy giờ từ vùng chọn" — tạo dòng MỚI từ this._region hiện tại (KHÁC "+ Thêm dòng" — hàm đó
     * vẫn nối sau dòng cuối, hàm này lấy ĐÚNG mốc đang kéo trên waveform). */
    createLineFromSelection() {
        if (!this._region) return;
        const newSub = createSubtitleLine(t('subtitleEditor.newLine.defaultText'), this._region.start, this._region.end); // core
        this._subtitles = sortSubtitlesByStart([...this._subtitles, newSub]); // core
        this._renderLines();
    },

    /** "▶ Phát vùng chọn" — WaveSurfer Region tự lo phát đúng [start,end] rồi dừng, không cần tự viết timer. */
    playSelection() {
        if (this._region) this._region.play();
    },

    /** MỚI (11/07/2026, mục 2) — Play/Pause CHUẨN của waveform tại vị trí con trỏ hiện tại, KHÁC
     * "Phát vùng chọn" ở trên (nút đó luôn phát đúng this._region). Icon tự đổi qua sự kiện
     * 'play'/'pause' đăng ký ở _initWaveform(), không tự lật class ở đây. */
    togglePlayPause() {
        if (this._wavesurfer) this._wavesurfer.playPause();
    },

    // ============================== Lưu / điều hướng ==============================

    /** Nút "Lưu" — ghi xuống IndexedDB NGAY (KHÔNG tự điều hướng đi đâu — tách biệt "lưu" và
     * "rời trang", đúng yêu cầu Giang thêm nút "←" RIÊNG). Cùng fix round-trip blob đã áp dụng ở
     * applySongEditAndSave()/applySubtitlesAndClose() cũ (xem rematerializeBlob(), service/db.js). */
    async saveToDatabase() {
        const record = await getSongRecord(this._songKey); // service/db.js
        if (!record) return;
        record.subtitles = this._subtitles.slice();
        if (record.blob) record.blob = await rematerializeBlob(record.blob); // service/db.js
        await setSongRecord(this._songKey, record); // service/db.js
        await alertModal(t('subtitleEditor.saved'));
    },

    /** Nút "←" — quay lại playlist. `history.back()` hoạt động đúng vì trang được ĐIỀU HƯỚNG tới
     * (window.location.href, KHÔNG mở tab mới — xem workflowPlaylist.openSubtitleEditorForSongMenu()/
     * workflowSubtitleModal.openEditor()), nên lịch sử trình duyệt LUÔN có index.html ngay trước đó. */
    back() {
        if (this._debugLogInterval) clearInterval(this._debugLogInterval); // dọn tay, dù rời trang cũng huỷ JS context
        history.back();
    },
};
