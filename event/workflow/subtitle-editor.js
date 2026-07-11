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
    _lineRangeStopHandler: null, // MỚI (yêu cầu Giang) — handler 'timeupdate' đang canh dừng phát 1 dòng, null nếu không có dòng nào đang phát preview
    _isShiftSelectionMode: false, // MỚI (yêu cầu Giang, tool "Shift") — đang ở chế độ chọn dòng để dịch giờ hàng loạt hay không
    _shiftSelectedIds: new Set(), // MỚI (yêu cầu Giang, tool "Shift") — tập id các dòng đang được chọn

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

    /** MỚI (yêu cầu Giang, mục 3) — chép TOÀN BỘ log hiện có vào clipboard, để Giang dán ra chỗ
     * khác (Notes, gửi lại cho Claude...) thay vì phải tự gõ/chụp màn hình từng dòng lỗi. */
    copyDebugLogToClipboard() {
        const lines = window.__sedLog || [];
        const text = lines.length
            ? lines.map((line) => `[${line.time}] [${line.level}] ${line.msg}`).join('\n')
            : t('subtitleEditor.debugLogEmpty');
        // navigator.clipboard cần secure context (HTTPS — đúng trường hợp GitHub Pages) NHƯNG vài
        // WebView cũ/lạ vẫn có thể thiếu hẳn API này hoặc reject quyền — fallback execCommand
        // ('copy') qua textarea tạm, đúng tinh thần "không tin native API luôn có sẵn" đã áp dụng
        // cho input[type=file].click() ở nơi khác trong app.
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch((err) => {
                console.warn('[subtitle-editor] navigator.clipboard.writeText() thất bại, dùng fallback:', err);
                this._copyTextViaFallback(text);
            });
        } else {
            this._copyTextViaFallback(text);
        }
    },

    _copyTextViaFallback(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { document.execCommand('copy'); } catch (err) { console.error('[subtitle-editor] Copy fallback (execCommand) thất bại:', err); }
        document.body.removeChild(ta);
    },

    // ============================== Danh sách dòng sub ==============================

    _renderLines() {
        renderSubtitleLines(linesContainerEl, this._subtitles, { // core/subtitle/subtitles-ui.js
            onTextCommit: (id, text) => this._commitLineText(id, text),
            onRemove: (id) => this._removeLine(id),
            onPlayRange: (startStr, endStr) => this.playLineRange(startStr, endStr), // MỚI (yêu cầu Giang)
            onOpenTimePicker: (id, kind, seconds) => this.openTimePickerModal(id, kind, seconds), // MỚI (yêu cầu Giang, mục 4)
            onToggleSelect: (id) => this.toggleLineSelection(id), // MỚI (yêu cầu Giang, tool "Shift")
        }, { active: this._isShiftSelectionMode, selectedIds: this._shiftSelectedIds });
        subEmptyStateEl.classList.toggle('hidden', this._subtitles.length > 0);
    },

    /** SỬA (yêu cầu Giang, mục 4 — bỏ nút ✓ "vô dụng") — THAY _applyLine() cũ (cần bấm ✓ riêng):
     * text giờ auto-commit ngay khi rời ô (blur, xem core/subtitle/subtitles-ui.js) — không còn
     * khái niệm "gõ xong nhưng quên bấm Áp dụng" nữa. */
    _commitLineText(id, text) {
        this._subtitles = computeUpdatedSubtitles(this._subtitles, id, { text }); // core
        this._renderLines();
    },

    /** SỬA (yêu cầu Giang, mục 4) — giờ start/end giờ đổi qua modal "bánh xe cuộn số"
     * (openTimePickerModal() bên dưới), gọi hàm này lúc bấm "Xong" trong modal đó — commit NGAY,
     * không còn ô gõ tay + nút ✓ riêng để "áp dụng" nữa. */
    _applyLineTime(id, kind, seconds) {
        this._subtitles = computeUpdatedSubtitles(this._subtitles, id, { [kind]: seconds }); // core
        this._subtitles = sortSubtitlesByStart(this._subtitles); // core — giờ đổi có thể đổi thứ tự
        this._renderLines();
    },

    _removeLine(id) {
        this._subtitles = computeRemovedSubtitles(this._subtitles, id); // core
        this._renderLines();
    },

    /** MỚI (yêu cầu Giang, mục 4) — modal "bánh xe cuộn số" chọn giờ start/end 1 dòng, THAY ô gõ
     * tay trực tiếp (dễ gõ sai định dạng "HH:MM:SS,mmm", không có bàn phím số chuyên dụng trên
     * nhiều thiết bị). 4 cột cuộn dọc dùng CSS scroll-snap THUẦN (không cần JS vật lý cuộn/
     * animation nào — trình duyệt tự "hút" về đúng vị trí sau khi lướt tay, xem assets/css/
     * style.css::.time-picker-col) — Giờ/Phút/Giây/phần trăm-mili-giây (bước 100ms, đủ dùng cho
     * canh tay — muốn chính xác hơn vẫn kéo tay cầm trên waveform, xem setRegionStartToCurrentTime
     * ()/setRegionEndToCurrentTime() cho 1 cách chốt mốc CHÍNH XÁC hơn nữa dựa theo lúc đang nghe).
     * @param {string} subId @param {'start'|'end'} kind @param {number} currentSeconds
     */
    openTimePickerModal(subId, kind, currentSeconds) {
        const ITEM_H = 44; // px — PHẢI khớp đúng h-11 (44px) của mỗi số trong subtitle-editor.html/CSS bên dưới
        const totalMs = Math.max(0, Math.round(currentSeconds * 1000));
        const initHH = Math.floor(totalMs / 3600000) % 24;
        const initMM = Math.floor(totalMs / 60000) % 60;
        const initSS = Math.floor(totalMs / 1000) % 60;
        const initTenth = Math.floor((totalMs % 1000) / 100);

        function buildColumn(count, initIndex) {
            const col = document.createElement('div');
            col.className = 'time-picker-col flex-1 h-[132px] overflow-y-scroll snap-y snap-mandatory';
            col.style.scrollSnapStop = 'always';
            const topSpacer = document.createElement('div'); topSpacer.style.height = ITEM_H + 'px'; col.appendChild(topSpacer);
            const items = [];
            for (let i = 0; i < count; i++) {
                const item = document.createElement('div');
                item.className = 'h-11 flex items-center justify-center snap-center text-lg font-mono text-white';
                item.textContent = String(i).padStart(2, '0');
                col.appendChild(item);
                items.push(item);
            }
            const bottomSpacer = document.createElement('div'); bottomSpacer.style.height = ITEM_H + 'px'; col.appendChild(bottomSpacer);
            items.forEach((item, i) => item.addEventListener('click', () => col.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })));
            col.scrollTop = initIndex * ITEM_H; // vị trí ban đầu NGAY LẬP TỨC (không animation) trước khi modal kịp hiện ra
            return col;
        }

        const hhCol = buildColumn(24, initHH);
        const mmCol = buildColumn(60, initMM);
        const ssCol = buildColumn(60, initSS);
        const tenthCol = buildColumn(10, initTenth);

        const overlay = document.createElement('div');
        overlay.id = 'time-picker-modal-overlay';
        overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

        const card = document.createElement('div');
        card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-base font-bold text-white';
        titleEl.textContent = kind === 'start' ? t('subtitleEditor.timePicker.titleStart') : t('subtitleEditor.timePicker.titleEnd');
        card.appendChild(titleEl);

        const wheelWrap = document.createElement('div');
        wheelWrap.className = 'relative flex gap-1';
        const highlightBand = document.createElement('div');
        highlightBand.className = 'absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 bg-white/10 rounded-lg pointer-events-none border-y border-white/20';
        wheelWrap.appendChild(highlightBand);
        [hhCol, mmCol, ssCol, tenthCol].forEach((col) => wheelWrap.appendChild(col));
        card.appendChild(wheelWrap);

        const labelRow = document.createElement('div');
        labelRow.className = 'flex gap-1 text-[10px] text-slate-500 text-center';
        ['HH', 'MM', 'SS', 'x100ms'].forEach((label) => {
            const span = document.createElement('span'); span.className = 'flex-1'; span.textContent = label; labelRow.appendChild(span);
        });
        card.appendChild(labelRow);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'flex gap-3 mt-1';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
        cancelBtn.textContent = t('common.cancel');
        buttonRow.appendChild(cancelBtn);
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition-colors';
        confirmBtn.textContent = t('common.ok');
        buttonRow.appendChild(confirmBtn);
        card.appendChild(buttonRow);

        overlay.appendChild(card);

        // --- addEventListener: gom cuối hàm (Rule 5a) ---
        function closeModal() { overlay.remove(); }
        cancelBtn.addEventListener('click', closeModal);
        confirmBtn.addEventListener('click', () => {
            const hh = Math.round(hhCol.scrollTop / ITEM_H);
            const mm = Math.round(mmCol.scrollTop / ITEM_H);
            const ss = Math.round(ssCol.scrollTop / ITEM_H);
            const tenth = Math.round(tenthCol.scrollTop / ITEM_H);
            const seconds = hh * 3600 + mm * 60 + ss + tenth * 0.1;
            closeModal();
            this._applyLineTime(subId, kind, seconds);
        });

        document.body.appendChild(overlay);
    },

    // ============================== Toolbar: giữ nguyên tính năng cũ ==============================

    /** Auto-timing — 2 nhịp bấm dựa theo THỜI ĐIỂM PHÁT (KHÔNG dùng region) — GIỮ NGUYÊN hành vi cũ.
     * FIX (yêu cầu Giang, tương thích hệ mới):
     * (A) Thiếu guard `this._wavesurfer` — trước đây gọi thẳng `getCurrentTime()`, waveform lỗi/
     *     chưa nạp xong (`this._wavesurfer` null) sẽ crash ngay. Mọi tool MỚI khác đã có guard này,
     *     Auto-timing (tool CŨ, giữ nguyên hành vi) bị bỏ sót — thêm lại cho ĐỒNG BỘ.
     * (B) Trước đây toggle thẳng `bg-red-500`/`bg-rose-600` LÊN CHÍNH `<button>` — hợp lý khi nút
     *     còn có `<div>` con tô màu riêng, nhưng nút tool đã đổi sang "icon trần, không nền" (yêu
     *     cầu Giang, xem sav12-handoff-plan mới nhất) — hậu quả: 1 khối nền đỏ HÌNH CHỮ NHẬT không
     *     bo góc đè lên icon+label lúc ghi, và tệ hơn, `_resetAutoTiming()` add lại `bg-rose-600`
     *     nên SAU LẦN DÙNG ĐẦU TIÊN nút dính nền hồng VĨNH VIỄN (không nhánh nào gỡ). Bỏ HẲN việc
     *     đổi màu nền nút — icon tự đổi (idle <-> pulsing dot đỏ) đã đủ báo hiệu "đang ghi", ĐÚNG
     *     tinh thần "icon trần" mới, không cần thêm nền.
     * (C) Bắt đầu ghi = 1 hành động phát lại HOÀN TOÀN ĐỘC LẬP — dọn sẵn `_lineRangeStopHandler`
     *     còn sót từ 1 lượt bấm ▶ dòng nào đó bị ngắt giữa chừng (chưa chạm mốc `end` của nó) —
     *     nếu không dọn, lúc đang ghi Auto-timing mà playback tình cờ chạy ngang qua đúng mốc `end`
     *     cũ đó, listener cũ sẽ tự pause() im lặng, ngắt ngang buổi ghi mà không rõ vì sao. */
    handleAutoTimingClick() {
        if (!this._wavesurfer) return; // (A)
        if (this._autoSubStartTime === null) {
            this._clearLineRangeStopHandler(); // (C)
            this._autoSubStartTime = this._wavesurfer.getCurrentTime();
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

    /** "▶ Phát vùng chọn" — WaveSurfer Region tự lo phát đúng [start,end] rồi dừng, không cần tự
     * viết timer. FIX (yêu cầu Giang, mục 1.C) — dọn handler cũ trước, cùng lý do togglePlayPause(). */
    playSelection() {
        if (!this._region) return;
        this._clearLineRangeStopHandler();
        this._region.play();
    },

    /** MỚI (yêu cầu Giang) — "Split": mở modal hỏi số dòng (x) muốn chia this._region hiện tại
     * thành. KHÔNG dùng modalChoice() có sẵn (core/modal-choice.js) vì modal đó chỉ hỗ trợ CHỌN 1
     * trong N nút có sẵn, không có ô nhập số — dựng modal RIÊNG ở đây nhưng giữ CÙNG khuôn hình
     * (overlay/card/nút) để đồng bộ giao diện với modalChoice()/alertModal(). Cần this._region tồn
     * tại (luôn có sau khi waveform decode xong, xem _initWaveform()) — nếu waveform lỗi/chưa nạp
     * xong (this._region null), im lặng không mở gì (giống playSelection()/createLineFromSelection()). */
    openSplitModal() {
        if (!this._region) return;

        const overlay = document.createElement('div');
        overlay.id = 'split-modal-overlay';
        overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

        const card = document.createElement('div');
        card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-base font-bold text-white';
        titleEl.textContent = t('subtitleEditor.split.title');
        card.appendChild(titleEl);

        const descEl = document.createElement('p');
        descEl.className = 'text-sm text-slate-300 leading-relaxed';
        descEl.textContent = tFormat('subtitleEditor.split.desc', { start: secToStr(this._region.start), end: secToStr(this._region.end) }); // core secToStr
        card.appendChild(descEl);

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '2';
        countInput.max = '50';
        countInput.value = '2';
        countInput.inputMode = 'numeric';
        countInput.className = 'w-full text-center text-lg font-mono bg-black/40 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-sky-500 text-white';
        card.appendChild(countInput);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'flex gap-3 mt-1';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
        cancelBtn.textContent = t('common.cancel');
        buttonRow.appendChild(cancelBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors';
        confirmBtn.textContent = t('subtitleEditor.split.confirm');
        buttonRow.appendChild(confirmBtn);

        card.appendChild(buttonRow);
        overlay.appendChild(card);

        // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ gọi tham số/hàm workflow khác qua this ---
        function closeModal() { overlay.remove(); }
        cancelBtn.addEventListener('click', closeModal);
        confirmBtn.addEventListener('click', () => {
            const count = parseInt(countInput.value, 10);
            closeModal();
            if (!Number.isFinite(count) || count < 2) return; // số không hợp lệ -> bỏ qua im lặng
            this._splitRegionIntoLines(count);
        });

        document.body.appendChild(overlay);
    },

    /** Chia ĐỀU this._region hiện tại thành `count` dòng phụ đề LIỀN NHAU (dòng sau nối đúng mốc
     * dòng trước, không hở/không đè) — text để RỖNG, placeholder có sẵn của textarea tự hiện (xem
     * core/subtitle/subtitles-ui.js), Giang tự gõ lời vào từng dòng sau khi chia. Dòng CUỐI lấy
     * ĐÚNG this._region.end (không tính bằng cộng dồn perLine) để né sai số cộng dồn số thực. */
    _splitRegionIntoLines(count) {
        if (!this._region) return;
        const totalStart = this._region.start;
        const totalEnd = this._region.end;
        const perLine = (totalEnd - totalStart) / count;
        const newLines = [];
        for (let i = 0; i < count; i++) {
            const start = totalStart + perLine * i;
            const end = i === count - 1 ? totalEnd : totalStart + perLine * (i + 1);
            newLines.push(createSubtitleLine('', start, end)); // core — text rỗng, placeholder tự hiện
        }
        this._subtitles = sortSubtitlesByStart([...this._subtitles, ...newLines]); // core
        this._renderLines();
    },

    /** MỚI (11/07/2026, mục 2) — Play/Pause CHUẨN của waveform tại vị trí con trỏ hiện tại, KHÁC
     * "Phát vùng chọn" ở trên (nút đó luôn phát đúng this._region). Icon tự đổi qua sự kiện
     * 'play'/'pause' đăng ký ở _initWaveform(), không tự lật class ở đây.
     * FIX (yêu cầu Giang, mục 1.C) — dọn `_lineRangeStopHandler` còn sót TRƯỚC KHI toggle play/
     * pause thủ công — người dùng bấm nút play/pause CHÍNH nghĩa là đang chủ động điều khiển phát
     * lại, không còn liên quan gì tới 1 lượt nghe thử ▶ dòng dở dang trước đó nữa. */
    togglePlayPause() {
        if (!this._wavesurfer) return;
        this._clearLineRangeStopHandler();
        this._wavesurfer.playPause();
    },

    /** MỚI (yêu cầu Giang) — nút ▶ mỗi dòng phụ đề: phát ĐÚNG [start, end] của dòng đó rồi tự
     * dừng lại (KHÔNG chạy tiếp qua dòng sau). Nhận startStr/endStr thô "HH:MM:SS,mmm" (đọc trực
     * tiếp từ 2 ô giờ đang hiển thị NGAY LÚC BẤM, xem core/subtitle/subtitles-ui.js) — CÙNG PATTERN
     * _applyLine() tự strToSec() ở phía Workflow, core UI không tự parse giờ. */
    playLineRange(startStr, endStr) {
        if (!this._wavesurfer) return;
        const start = strToSec(startStr); // core
        const end = strToSec(endStr); // core
        if (end <= start) return; // giờ dòng không hợp lệ (end <= start) -> không phát gì, tránh phát ngược/vô hạn
        this._playRangeAndStop(start, end);
    },

    /** Lõi DÙNG CHUNG cho mọi chỗ cần "phát đúng [start,end] rồi tự dừng" (hiện dùng cho nút ▶ mỗi
     * dòng phụ đề). Gắn LƯỚI AN TOÀN qua sự kiện 'timeupdate' tự pause() khi currentTime >= end —
     * KHÔNG chỉ tin tưởng tham số (start,end) của wavesurfer.play() tự dừng đúng 100% (vài phiên
     * bản/bản dựng WaveSurfer.js từng có báo cáo không dừng đúng khi dùng backend mặc định dựa
     * trên thẻ <audio>, xem GitHub issue #3011/#348 của katspaugh/wavesurfer.js) — luôn gỡ handler
     * CŨ trước khi gắn MỚI, tránh chồng nhiều listener nếu bấm ▶ dòng khác trong lúc dòng trước còn
     * đang phát dở. */
    _playRangeAndStop(start, end) {
        this._clearLineRangeStopHandler();
        this._lineRangeStopHandler = (currentTime) => {
            if (currentTime >= end) {
                this._wavesurfer.pause();
                this._clearLineRangeStopHandler();
            }
        };
        this._wavesurfer.on('timeupdate', this._lineRangeStopHandler);
        this._wavesurfer.play(start, end); // (start,end) nếu wavesurfer tự dừng đúng thì lưới an toàn ở trên coi như dự phòng, không xung đột
    },

    /** MỚI (yêu cầu Giang, mục 1.C) — gỡ sạch listener 'timeupdate' đang canh dừng 1 lượt nghe thử
     * ▶ dòng (nếu có) — gọi TRƯỚC MỌI hành động phát lại độc lập khác (play/pause thủ công, phát
     * vùng chọn, bắt đầu ghi Auto-timing) để tránh nó tự pause() nhầm về sau nếu playback tình cờ
     * chạy ngang qua đúng mốc `end` cũ của nó. An toàn gọi nhiều lần (no-op nếu không có gì để gỡ). */
    _clearLineRangeStopHandler() {
        if (this._lineRangeStopHandler) {
            this._wavesurfer.un('timeupdate', this._lineRangeStopHandler);
            this._lineRangeStopHandler = null;
        }
    },

    /** MỚI (yêu cầu Giang, mục 2) — đặt this._region.start/end = vị trí phát HIỆN TẠI
     * (getCurrentTime()) — cách "chốt mốc" thay thế kéo tay cầm: tua/nghe tới đúng chỗ rồi bấm là
     * xong, không cần kéo chính xác bằng ngón tay trên waveform nhỏ. Chặn nếu mốc mới làm region
     * rỗng/ngược (start phải luôn < end). */
    setRegionStartToCurrentTime() {
        if (!this._region || !this._wavesurfer) return;
        const current = this._wavesurfer.getCurrentTime();
        if (current >= this._region.end) return;
        this._region.setOptions({ start: current });
        this._updateRegionTimeDisplay();
    },

    setRegionEndToCurrentTime() {
        if (!this._region || !this._wavesurfer) return;
        const current = this._wavesurfer.getCurrentTime();
        if (current <= this._region.start) return;
        this._region.setOptions({ end: current });
        this._updateRegionTimeDisplay();
    },

    // ============================== Toolbar: MỚI — tool "Shift" (yêu cầu Giang, mục 5) ==============================

    /** Bấm nút "Shift" trên thanh công cụ — bật/tắt "chế độ chọn dòng" để dịch giờ hàng loạt.
     * Thoát chế độ (tắt) LUÔN xoá sạch lựa chọn cũ — vào lại là chọn từ đầu, tránh nhầm lẫn "còn
     * sót chọn từ lần trước". */
    toggleShiftSelectionMode() {
        this._isShiftSelectionMode = !this._isShiftSelectionMode;
        if (!this._isShiftSelectionMode) this._shiftSelectedIds = new Set();
        this._renderLines();
        this._renderShiftBar();
    },

    /** Bấm NGUYÊN 1 card lúc đang ở chế độ chọn dòng — thêm/bớt khỏi tập đang chọn. */
    toggleLineSelection(id) {
        if (this._shiftSelectedIds.has(id)) this._shiftSelectedIds.delete(id);
        else this._shiftSelectedIds.add(id);
        this._renderLines();
        this._renderShiftBar();
    },

    /** Cập nhật thanh "N dòng đã chọn — Huỷ/Tiếp tục" phía trên thanh công cụ (subtitle-editor.html
     * #shift-selection-bar) — hiện/ẩn theo `_isShiftSelectionMode`, disable "Tiếp tục" nếu chưa
     * chọn dòng nào (chọn 0 dòng thì không có gì để dịch giờ). */
    _renderShiftBar() {
        shiftSelectionBarEl.classList.toggle('hidden', !this._isShiftSelectionMode);
        shiftSelectionCountEl.textContent = tFormat('subtitleEditor.shift.selectedCount', { n: this._shiftSelectedIds.size });
        const hasSelection = this._shiftSelectedIds.size > 0;
        btnShiftContinue.disabled = !hasSelection;
        btnShiftContinue.classList.toggle('opacity-40', !hasSelection);
    },

    /** Mở modal nhập số giây dịch (+/-) + chọn áp dụng cho start/end/cả 2 — dựng RIÊNG (không dùng
     * modalChoice() — cần ô số + 3 lựa chọn không phải dạng "chọn 1 trong N nút đơn thuần"), giữ
     * CÙNG khuôn hình overlay/card như openSplitModal()/openTimePickerModal() cho đồng bộ. */
    openShiftModal() {
        if (this._shiftSelectedIds.size === 0) return;

        const overlay = document.createElement('div');
        overlay.id = 'shift-modal-overlay';
        overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

        const card = document.createElement('div');
        card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-base font-bold text-white';
        titleEl.textContent = t('subtitleEditor.shift.modalTitle');
        card.appendChild(titleEl);

        const descEl = document.createElement('p');
        descEl.className = 'text-sm text-slate-300';
        descEl.textContent = tFormat('subtitleEditor.shift.modalDesc', { n: this._shiftSelectedIds.size });
        card.appendChild(descEl);

        const amountLabel = document.createElement('label');
        amountLabel.className = 'text-[11px] font-semibold text-slate-400 uppercase tracking-wide';
        amountLabel.textContent = t('subtitleEditor.shift.amountLabel');
        card.appendChild(amountLabel);

        // input number CHO PHÉP gõ dấu trừ trực tiếp (dịch lùi) — không cần nút +/- riêng.
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.step = '0.1';
        amountInput.value = '0';
        amountInput.inputMode = 'decimal';
        amountInput.className = 'w-full text-center text-lg font-mono bg-black/40 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-sky-500 text-white';
        card.appendChild(amountInput);

        const targetLabel = document.createElement('label');
        targetLabel.className = 'text-[11px] font-semibold text-slate-400 uppercase tracking-wide';
        targetLabel.textContent = t('subtitleEditor.shift.targetLabel');
        card.appendChild(targetLabel);

        const targetRow = document.createElement('div');
        targetRow.className = 'flex w-full p-1 rounded-xl bg-black/30 border border-white/10 gap-1';
        let selectedTarget = 'both';
        const targets = [
            { key: 'both', label: t('subtitleEditor.shift.targetBoth') },
            { key: 'start', label: t('subtitleEditor.shift.targetStart') },
            { key: 'end', label: t('subtitleEditor.shift.targetEnd') },
        ];
        const targetButtons = targets.map(({ key, label }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.target = key;
            btn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ' + (key === selectedTarget ? 'bg-white/10 text-white shadow' : 'text-slate-400');
            btn.textContent = label;
            targetRow.appendChild(btn);
            return btn;
        });
        card.appendChild(targetRow);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'flex gap-3 mt-1';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
        cancelBtn.textContent = t('common.cancel');
        buttonRow.appendChild(cancelBtn);
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-bold transition-colors';
        confirmBtn.textContent = t('subtitleEditor.shift.applyBtn');
        buttonRow.appendChild(confirmBtn);
        card.appendChild(buttonRow);

        overlay.appendChild(card);

        // --- addEventListener: gom cuối hàm (Rule 5a) ---
        function closeModal() { overlay.remove(); }
        cancelBtn.addEventListener('click', closeModal);
        targetButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedTarget = btn.dataset.target;
                targetButtons.forEach((b) => {
                    const active = b.dataset.target === selectedTarget;
                    b.classList.toggle('bg-white/10', active);
                    b.classList.toggle('text-white', active);
                    b.classList.toggle('shadow', active);
                    b.classList.toggle('text-slate-400', !active);
                });
            });
        });
        confirmBtn.addEventListener('click', () => {
            const amount = parseFloat(amountInput.value);
            closeModal();
            if (!Number.isFinite(amount) || amount === 0) return; // 0/không hợp lệ -> không làm gì
            this._applyShift(amount, selectedTarget);
        });

        document.body.appendChild(overlay);
    },

    /** Cộng `amountSec` (có thể âm) vào start/end/cả 2 của MỌI dòng đang chọn qua
     * shiftSubtitleTimes() (core, THUẦN) rồi thoát hẳn chế độ chọn dòng. */
    _applyShift(amountSec, target) {
        this._subtitles = shiftSubtitleTimes(this._subtitles, this._shiftSelectedIds, amountSec, target); // core
        this._subtitles = sortSubtitlesByStart(this._subtitles); // core — giờ đổi có thể đổi thứ tự
        this._isShiftSelectionMode = false;
        this._shiftSelectedIds = new Set();
        this._renderLines();
        this._renderShiftBar();
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
