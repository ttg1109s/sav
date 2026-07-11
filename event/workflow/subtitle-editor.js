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

        try {
            const url = URL.createObjectURL(blob);
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
            });

            this._wavesurfer.load(url);
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
        history.back();
    },
};
