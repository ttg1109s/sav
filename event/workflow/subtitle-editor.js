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
    _timelinePlugin: null, // MỚI (yêu cầu Giang, mục 1) — dải mốc thời gian
    _zoomLevel: 70, // MỚI (yêu cầu Giang, mục 1) — px/giây hiện tại (khởi tạo = giá trị minPxPerSec cũ), zoomIn()/zoomOut() tự cập nhật
    _region: null, // Region DUY NHẤT, sống suốt vòng đời trang — mọi tool "vùng chọn" thao tác lên nó
    _isDebugPanelOpen: false, // MỚI (11/07/2026) — bảng debug log đang mở hay không
    _debugLogInterval: null, // MỚI (11/07/2026) — id setInterval refresh bảng debug log lúc đang mở
    _lineRangeStopHandler: null, // MỚI (yêu cầu Giang) — handler 'timeupdate' đang canh dừng phát 1 dòng, null nếu không có dòng nào đang phát preview
    _isPlayingRegion: false, // MỚI (yêu cầu Giang, mục 3/4) — đang phát THEO VÙNG/DÒNG (bị chặn tự dừng ở end) hay không — khác phát chung (Play/Pause) không giới hạn
    _activePlaybackLineId: null, // MỚI (yêu cầu Giang, mục 1) — null = đang phát THEO VÙNG CHUNG (this._region), id = đang phát ĐÚNG dòng đó — phân biệt để đổi icon đúng nơi
    _isShiftSelectionMode: false, // MỚI (yêu cầu Giang, tool "Shift") — đang ở chế độ chọn dòng để dịch giờ hàng loạt hay không
    _shiftSelectedIds: new Set(), // MỚI (yêu cầu Giang, tool "Shift") — tập id các dòng đang được chọn
    _lineCardNodesById: new Map(), // MỚI (yêu cầu Giang, mục 7) — Map bền vững subId -> card DOM, giữ NGUYÊN qua các lần render (diff thay vì rebuild toàn bộ, cùng thuật toán renderPlaylistDiff() core/playlist/render.js)
    _editingLineId: null, // MỚI (yêu cầu Giang, mục 3) — id dòng đang ở "chế độ sửa" (null = không dòng nào đang sửa)
    _editingPendingStart: null, // MỚI — giờ start ĐANG SỬA (giây, CHƯA Apply) của dòng _editingLineId
    _editingPendingEnd: null, // MỚI — giờ end ĐANG SỬA (giây, CHƯA Apply)
    _editingCardEl: null, // MỚI — cache tham chiếu DOM card đang sửa, cập nhật TRỰC TIẾP lúc kéo region (mục 5, không qua render lại toàn bộ)

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
            // MỚI (yêu cầu Giang, mục 1) — dải mốc thời gian, plugin CHÍNH THỨC của WaveSurfer —
            // container RIÊNG (#waveform-timeline, không lồng vào #waveform-container) để không co
            // hẹp sóng âm đang có. Tự đồng bộ cuộn/zoom với this._wavesurfer, không cần code thêm.
            this._timelinePlugin = typeof WaveSurfer.Timeline !== 'undefined'
                ? WaveSurfer.Timeline.create({ container: waveformTimelineEl, height: 20 })
                : null;
            if (!this._timelinePlugin) console.warn('[subtitle-editor] WaveSurfer.Timeline không tải được (CDN chặn/lỗi mạng?) — waveform vẫn dùng được, chỉ thiếu dải mốc thời gian.');
            this._wavesurfer = WaveSurfer.create({
                container: waveformContainerEl,
                height: 88,
                waveColor: '#475569',
                progressColor: '#0ea5e9',
                cursorColor: '#f8fafc',
                minPxPerSec: this._zoomLevel, // MỚI (yêu cầu Giang, mục 1) — biến state (thay hằng số 70 cũ) để zoomIn()/zoomOut() có gốc theo dõi đúng
                normalize: true,
                // MỚI (yêu cầu Giang — "thanh cuộn phải tự cuộn theo phần nhạc đang chạy") — 2 field
                // này CÓ SẴN trong WaveSurfer ("Automatically scroll the container to keep the
                // current position in viewport" / "keep the cursor in the center of the waveform
                // during playback") nhưng TRƯỚC ĐÂY chưa khai báo tường minh — phụ thuộc giá trị
                // mặc định của thư viện (không chắc chắn bản build nào cũng bật sẵn). Khai RÕ RÀNG
                // ở đây để LUÔN đúng hành vi mong muốn, không phụ thuộc mặc định ẩn: cuộn theo lúc
                // đang phát VÀ mỗi lần seek thủ công (setTime(), xem seekFromClick()/
                // _playRangeAndStop()) — con trỏ luôn giữ ở GIỮA khung nhìn, không phải tự kéo lại.
                autoScroll: true,
                autoCenter: true,
                plugins: this._timelinePlugin ? [this._regionsPlugin, this._timelinePlugin] : [this._regionsPlugin],
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
                // MỚI (yêu cầu Giang, mục 5) — NẾU đang sửa 1 dòng (this._editingLineId), kéo tay
                // cầm region ĐỒNG BỘ NGƯỢC vào giờ PENDING của dòng đó (region lúc này ĐANG đại
                // diện cho đúng dòng đang sửa, xem enterLineEditMode()) — cập nhật TRỰC TIẾP qua
                // this._editingCardEl (KHÔNG qua render lại toàn bộ — kéo tay cầm bắn 'update' RẤT
                // NHIỀU lần/giây, render lại mỗi lần sẽ giật/mất focus).
                this._region.on('update', () => {
                    this._updateRegionTimeDisplay();
                    if (this._editingLineId !== null) this._syncPendingFromRegion();
                });
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
                // FIX (yêu cầu Giang, mục 2 — icon "Play region"/▶ dòng không hiện lúc đang phát) —
                // TRƯỚC ĐÂY gọi _updatePlaybackIcons() NGAY SAU khi gọi .play() trong
                // _playRangeAndStop() — nhưng TẠI THỜI ĐIỂM đó .play() CHƯA THỰC SỰ bắt đầu phát
                // (isPlaying() vẫn trả false), nên icon luôn tính SAI thành "chưa phát". Giờ gọi
                // NGAY TRONG sự kiện 'play' thật của WaveSurfer — ĐÚNG lúc phát THỰC SỰ bắt đầu,
                // bất kể do hành động nào kích hoạt (Play/Pause chung, "Play region", ▶ dòng nào).
                this._updatePlaybackIcons();
            });
            this._wavesurfer.on('pause', () => {
                iconWaveformPause.classList.add('hidden');
                iconWaveformPlay.classList.remove('hidden');
                this._updatePlaybackIcons(); // cùng lý do ở trên — đồng bộ NGAY lúc phát THỰC SỰ dừng
            });
            // MỚI (yêu cầu Giang, mục 2) — giờ vị trí phát HIỆN TẠI, trước đây hoàn toàn không có
            // gì phản ánh trên UI. Luôn bật (KHÔNG gỡ/gắn lại như _lineRangeStopHandler — đây là
            // hiển thị thuần, không có "hết nhiệm vụ" để tự gỡ), chạy suốt lúc đang phát.
            this._wavesurfer.on('timeupdate', (currentTime) => this._updateCurrentTimeDisplay(currentTime));

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

    /** MỚI (yêu cầu Giang, mục 2) — cập nhật nhãn giờ đang phát HIỆN TẠI (khác giờ start/end vùng
     * chọn ở trên) — gọi liên tục lúc đang phát ('timeupdate') VÀ mỗi lần seek thủ công
     * (seekFromClick() bên dưới). */
    _updateCurrentTimeDisplay(currentTime) {
        if (!waveformCurrentTimeEl) return;
        waveformCurrentTimeEl.textContent = secToStr(currentTime); // core
    },

    /** SỬA (yêu cầu Giang, mục 1/2 — "nhảy linh tinh rất xa") — NGUYÊN NHÂN GỐC tìm được: bản
     * trước tự tính `fraction` dựa trên `waveformContainerEl.scrollWidth`/`.scrollLeft` (div NGOÀI
     * do chính tay dựng) — SAI GIẢ ĐỊNH rằng div đó là phần tử ĐANG CUỘN thật. WaveSurfer.js v7 tự
     * quản lý cuộn ngang RIÊNG bên trong Shadow DOM của chính nó (xem `getScroll()`/`setScroll()`/
     * `setScrollTime()`, tài liệu chính thức), KHÔNG chắc chắn cùng 1 phần tử với div ngoài mình
     * đưa vào `container` — `scrollWidth` đo trên div ngoài có thể chỉ phản ánh đúng bề rộng khung
     * NHÌN THẤY (không phải tổng bề rộng thật của cả waveform, dài hơn nhiều lần với bài dài +
     * `minPxPerSec: 70`) — khiến tỉ lệ tính sai lệch cực lớn, bấm 1 chỗ nhưng nhảy tới vị trí hoàn
     * toàn khác (đúng "nhảy linh tinh rất xa"). Mục 2 ("Play không phát theo thanh current") CÙNG
     * GỐC — vị trí seek vốn đã sai ngay từ bước tính toán, "phát không theo current" chỉ là biểu
     * hiện khác của cùng 1 lỗi.
     * FIX: bỏ HẲN việc tự đoán qua DOM ngoài — dùng ĐÚNG API THẬT của chính WaveSurfer:
     * `getScroll()` (vị trí cuộn THẬT, tính bằng pixel, do chính thư viện quản lý) +
     * `options.minPxPerSec` (số pixel/giây ĐANG DÙNG THẬT, không đoán) — 2 giá trị này LUÔN đúng
     * bất kể div ngoài có thật sự là phần tử cuộn hay không.
     * @param {number} clickXInViewport vị trí bấm TÍNH TỪ MÉP TRÁI khung nhìn thấy (chưa cộng cuộn
     *   — listener chỉ đo geometry thô, phần tính "cuộn bao nhiêu" giao hẳn cho hàm này, đúng chỗ
     *   sở hữu `this._wavesurfer`). */
    /** SỬA (yêu cầu Giang — bug ẩn "bấm waveform để chọn current TRƯỚC KHI bấm play lần nào, rồi
     * mới bấm play thì nhạc phát từ đầu, current/thời gian/region đều không chạy theo") —
     * NGUYÊN NHÂN GỐC nghi vấn: WaveSurfer.js có 2 pipeline HOÀN TOÀN ĐỘC LẬP — (1) giải mã qua Web
     * Audio API để VẼ sóng (sự kiện 'decode'/'ready' chỉ đảm bảo ĐÚNG pipeline này xong), và (2) thẻ
     * `<audio>` bên dưới (backend MediaElement) THẬT SỰ phát âm thanh. 'ready' bắn xong KHÔNG có
     * nghĩa pipeline (2) cũng đã tải đủ để CHO PHÉP seek — nếu người dùng bấm chọn vị trí (seek)
     * NGAY LÚC ĐÓ (chưa từng bấm play lần nào — pipeline (2) có thể vẫn đang tải ngầm), trình duyệt
     * có thể ÂM THẦM BỎ QUA lệnh seek đó (currentTime của thẻ audio chưa "sẵn sàng" nhận giá trị
     * mới) — về sau bấm play chỉ đơn giản phát từ đâu đó KHÔNG PHẢI vị trí vừa chọn (thường là 0).
     * FIX: XÁC MINH + tự thử lại — gọi `_seekWithRetry()` thay vì `setTime()` trần trụi. */
    seekFromClick(clickXInViewport) {
        if (!this._wavesurfer) return;
        const duration = this._wavesurfer.getDuration();
        if (!duration) return;
        const pxPerSec = this._wavesurfer.options.minPxPerSec || 1;
        const scrollPx = this._wavesurfer.getScroll(); // vị trí cuộn THẬT của chính WaveSurfer, không đoán qua div ngoài
        const absolutePx = scrollPx + clickXInViewport;
        const time = Math.max(0, Math.min(duration, absolutePx / pxPerSec));
        const wasPlaying = this._wavesurfer.isPlaying();
        this._updateCurrentTimeDisplay(time); // cập nhật hiển thị NGAY (lạc quan) — 'timeupdate' sẽ tự sửa lại nếu lượt seek đầu bị lỡ, xác minh xong ở dưới
        this._seekWithRetry(time, 3, () => {
            if (wasPlaying && !this._wavesurfer.isPlaying()) this._wavesurfer.play();
        });
    },

    /** MỚI — seek tới `time`, XÁC MINH THẬT (đọc lại getCurrentTime() sau 1 khoảng ngắn, KHÔNG chỉ
     * tin `setTime()` đã "chắc chắn ăn") — chưa khớp (lệch > 150ms) thì tự thử lại, tối đa
     * `attemptsLeft` lần. Gọi `onSeeked()` (nếu có) đúng 1 lần khi ĐÃ xác nhận khớp (hoặc hết lượt
     * thử — vẫn gọi tiếp, thà lệch 1 chút còn hơn im lặng không làm gì). Dùng CHUNG cho
     * seekFromClick() (mục click chọn vị trí) VÀ _playRangeAndStop() (seek-rồi-phát [start,end]) —
     * CÙNG 1 lớp bug gốc, cùng 1 cách né. */
    _seekWithRetry(time, attemptsLeft, onSeeked) {
        if (!this._wavesurfer) return;
        this._wavesurfer.setTime(time);
        setTimeout(() => {
            if (!this._wavesurfer) return;
            const matched = Math.abs(this._wavesurfer.getCurrentTime() - time) <= 0.15;
            if (matched || attemptsLeft <= 0) {
                if (onSeeked) onSeeked();
            } else {
                this._seekWithRetry(time, attemptsLeft - 1, onSeeked);
            }
        }, 80);
    },

    /** MỚI (yêu cầu Giang, mục 1) — zoom in/out waveform qua WaveSurfer.zoom() (API CÓ SẴN, đổi
     * "pixel/giây" đang hiển thị — timeline (nếu tải được) + region + con trỏ TỰ đồng bộ theo,
     * không cần code thêm gì). Nhân/chia 1.5x mỗi lần bấm — kẹp trong [20, 500] px/giây, đủ rộng để
     * từ "cả bài" (zoom out hết cỡ, bài dài vài phút vẫn gói gọn trong khung nhìn) tới "từng chữ"
     * (zoom in hết cỡ, canh mili-giây bằng mắt cũng được). */
    zoomIn() {
        if (!this._wavesurfer) return;
        this._zoomLevel = Math.min(500, Math.round(this._zoomLevel * 1.5));
        this._wavesurfer.zoom(this._zoomLevel);
    },

    zoomOut() {
        if (!this._wavesurfer) return;
        this._zoomLevel = Math.max(20, Math.round(this._zoomLevel / 1.5));
        this._wavesurfer.zoom(this._zoomLevel);
    },

    /** MỚI (11/07/2026, mục 2/6) — bật/tắt bảng xem console.log/warn/error + lỗi promise không ai
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

    /** SỬA (yêu cầu Giang, mục 7) — LUÔN sắp xếp lại theo start TĂNG DẦN ngay TRƯỚC khi render (bảo
     * đảm 1 chỗ DUY NHẤT, không cần nhớ gọi sortSubtitlesByStart() rải rác ở từng hàm mutate —
     * idempotent, sắp xếp mảng đã sắp xếp sẵn gần như miễn phí). Truyền THÊM `_lineCardNodesById`
     * (Map bền vững) cho renderSubtitleLines() tự DIFF thay vì `replaceChildren()` toàn bộ mỗi lần
     * — CÙNG thuật toán renderPlaylistDiff() (core/playlist/render.js).
     * SỬA (yêu cầu Giang, mục 3/4) — `uiState.mode` giờ có 3 giá trị ('normal'/'selecting'/
     * 'editing') thay vì chỉ đúng/sai của riêng "Shift" — core/subtitle/subtitles-ui.js tự quyết
     * cấu trúc từng card theo mode này (bình thường/đang chọn Shift/đang sửa 1 dòng + mọi dòng
     * KHÁC bị khoá). */
    _renderLines() {
        this._subtitles = sortSubtitlesByStart(this._subtitles); // core
        const mode = this._editingLineId !== null ? 'editing' : this._isShiftSelectionMode ? 'selecting' : 'normal';
        renderSubtitleLines(linesContainerEl, this._subtitles, { // core/subtitle/subtitles-ui.js
            onEnterEdit: (id) => this.enterLineEditMode(id), // MỚI (yêu cầu Giang, mục 3)
            onApplyEdit: (id, text) => this.applyLineEdit(id, text), // MỚI — khôi phục nút ✓ (mục 3)
            onCancelEdit: () => this.cancelLineEdit(), // MỚI
            onRemove: (id) => this._removeLine(id),
            onPlayRange: (id, startStr, endStr) => this.playLineRange(id, startStr, endStr), // MỚI (yêu cầu Giang, mục 1) — thêm id để đổi icon đúng dòng
            onOpenTimePicker: (id, kind, seconds) => this.openTimePickerModal(id, kind, seconds),
            onToggleSelect: (id) => this.toggleLineSelection(id),
        }, {
            mode,
            selectedIds: this._shiftSelectedIds,
            editingId: this._editingLineId,
            editingPendingStart: this._editingPendingStart,
            editingPendingEnd: this._editingPendingEnd,
        }, this._lineCardNodesById);
        subEmptyStateEl.classList.toggle('hidden', this._subtitles.length > 0);
    },

    /** MỚI (yêu cầu Giang, mục 3) — bấm NGUYÊN 1 card (KHÔNG phải Shift-selecting, KHÔNG có dòng
     * nào khác đang sửa) -> vào "chế độ sửa" cho ĐÚNG dòng đó: cho phép gõ text, hiện nút giờ
     * start/end (mở modal bánh xe) + nút ✓ Áp dụng/✕ Huỷ, và QUAN TRỌNG — nhảy this._region theo
     * ĐÚNG [start,end] dòng này (mục 3 "vùng region theo nhảy theo line được chọn") để có thể kéo
     * tay cầm/chốt mốc {}/nghe trực tiếp trong lúc sửa (mục 5).
     * MỚI (mục 4) — chặn hẳn: không cho vào chế độ sửa nếu ĐÃ có dòng khác đang sửa (phải Áp dụng/
     * Huỷ dòng đó trước), và chặn nếu đang ở chế độ chọn Shift (2 chế độ loại trừ nhau). */
    enterLineEditMode(id) {
        if (this._editingLineId !== null) return; // đã có dòng khác đang sửa -> chặn
        if (this._isShiftSelectionMode) return; // đang chọn Shift -> chặn (2 chế độ loại trừ nhau)
        const sub = this._subtitles.find((s) => s.id === id);
        if (!sub) return;
        this._editingLineId = id;
        this._editingPendingStart = sub.start;
        this._editingPendingEnd = sub.end;
        if (this._region) this._region.setOptions({ start: sub.start, end: sub.end }); // nhảy vùng theo dòng (mục 3)
        this._lineCardNodesById.clear(); // đổi mode -> đổi cấu trúc MỌI card (khoá các dòng khác + hiện input/✓/✕ ở dòng đang sửa)
        this._renderLines();
        this._editingCardEl = this._lineCardNodesById.get(id); // cache để cập nhật trực tiếp lúc kéo region (mục 5)
        this._updateWaveformControlsBlockState(); // MỚI (mục 4)
    },

    /** Bấm ✓ "Áp dụng" lúc đang sửa — commit CẢ text LẪN giờ PENDING (start/end đã đồng bộ qua
     * region/modal, xem _syncPendingFromRegion()/openTimePickerModal()) vào ĐÚNG dòng đang sửa,
     * rồi thoát chế độ sửa. */
    applyLineEdit(id, text) {
        if (this._editingLineId !== id) return;
        this._subtitles = computeUpdatedSubtitles(this._subtitles, id, { // core
            text,
            start: this._editingPendingStart,
            end: this._editingPendingEnd,
        });
        this._exitLineEditMode();
    },

    /** Bấm ✕ "Huỷ" lúc đang sửa — thoát chế độ sửa, KHÔNG commit gì (mọi thay đổi PENDING mất,
     * dòng giữ nguyên giá trị CŨ trước khi bấm vào sửa). */
    cancelLineEdit() {
        this._exitLineEditMode();
    },

    _exitLineEditMode() {
        this._editingLineId = null;
        this._editingPendingStart = null;
        this._editingPendingEnd = null;
        this._editingCardEl = null;
        this._lineCardNodesById.clear(); // đổi mode -> đổi cấu trúc MỌI card, mở khoá lại các dòng khác
        this._renderLines(); // tự sort lại rồi (xem _renderLines()) — giờ vừa Apply có thể đổi thứ tự
        this._updateWaveformControlsBlockState();
    },

    /** FIX (yêu cầu Giang, mục 3 — "nút X không xoá được") — NGUYÊN NHÂN GỐC tìm được: hàm này BỊ
     * XOÁ MẤT hoàn toàn trong 1 lần viết lại code trước đó (_renderLines() vẫn gọi
     * `this._removeLine(id)` ở callback `onRemove`, nhưng hàm không còn tồn tại) — bấm ✕ ném
     * TypeError ÂM THẦM (không có gì hiển thị lỗi cho Giang thấy, đúng y hệt triệu chứng "không xoá
     * được"). Khôi phục lại đầy đủ.
     * Thêm lưới an toàn: tự xoá TRỰC TIẾP node khỏi cache/DOM ở đây luôn (không chỉ trông chờ
     * renderSubtitleLines() tự dọn qua diff) — phòng hờ mọi trường hợp lạ khác. */
    _removeLine(id) {
        this._subtitles = computeRemovedSubtitles(this._subtitles, id); // core
        const node = this._lineCardNodesById.get(id);
        if (node) { node.remove(); this._lineCardNodesById.delete(id); }
        this._renderLines();
    },

    /** MỚI (yêu cầu Giang, mục 5) — region.on('update') (kéo tay cầm HOẶC bấm {/} — cả 2 đều đi
     * qua region.setOptions(), cùng bắn 'update') gọi hàm này KHI đang sửa 1 dòng — đồng bộ NGƯỢC
     * giờ region hiện tại vào PENDING của dòng đó, cập nhật hiển thị TRỰC TIẾP (không render lại
     * toàn bộ — 'update' bắn liên tục lúc kéo, render lại mỗi lần sẽ giật/mất focus ô text đang gõ). */
    _syncPendingFromRegion() {
        if (!this._region || this._editingLineId === null) return;
        this._editingPendingStart = this._region.start;
        this._editingPendingEnd = this._region.end;
        if (this._editingCardEl) {
            const startBtn = this._editingCardEl.querySelector('.sub-line-start-btn');
            const endBtn = this._editingCardEl.querySelector('.sub-line-end-btn');
            if (startBtn) startBtn.textContent = secToStr(this._editingPendingStart); // core
            if (endBtn) endBtn.textContent = secToStr(this._editingPendingEnd); // core
        }
    },

    /** MỚI (yêu cầu Giang, mục 4) — chặn CÁC NÚT của khung điều khiển waveform lúc đang sửa 1 dòng
     * — TRỪ 2 nút "{"/"}"" (set start/end = current, vẫn cần dùng để đồng bộ giờ dòng đang sửa,
     * mục 5). Play/Pause chung + "[▶]" phát vùng chung + tool "Shift" đều khoá lại lúc này. */
    _updateWaveformControlsBlockState() {
        const blocked = this._editingLineId !== null;
        [btnWaveformPlayPause, btnPlayRegionControl, btnShift].forEach((el) => {
            if (!el) return;
            el.classList.toggle('opacity-40', blocked);
            el.classList.toggle('pointer-events-none', blocked);
        });
        // "{" / "}" CỐ Ý không đụng gì — luôn bật, đúng yêu cầu Giang (mục 4, mục 5).
    },

    /** MỚI (yêu cầu Giang, mục 4) — modal "bánh xe cuộn số" chọn giờ start/end 1 dòng — CHỈ mở
     * được lúc dòng đó đang ở chế độ sửa (nút start/end chỉ hiện trong chế độ đó, xem core/
     * subtitle/subtitles-ui.js). Xác nhận -> cập nhật PENDING + đồng bộ NGƯỢC vào this._region (mục
     * 5), KHÔNG commit thẳng vào dòng (chờ bấm ✓ Áp dụng).
     * SỬA (yêu cầu Giang, mục 3 — "UI hoá là chỉ cuộn được tới giá trị min-max") — BỎ HẲN cách cũ
     * (chỉ cảnh báo + khoá nút "Xong") — giờ CHẶN THẬT việc cuộn ra ngoài [minAllowed,maxAllowed]:
     * cho lướt tự do (giữ nguyên cảm giác cuộn mượt của native scroll), rồi NGAY KHI lướt tay DỪNG
     * HẲN (debounce 120ms), tự "bật lại" (snap) về mép gần nhất nếu đã vượt biên — hiệu ứng
     * "rubber-band" quen thuộc ở mép danh sách trên iOS. 4 wheel (HH/MM/SS/x100ms) PHỤ THUỘC NHAU
     * theo tầng — bound của MM tính theo giá trị HH HIỆN TẠI (đã ổn định), bound của SS tính theo
     * HH+MM, bound của tenths tính theo HH+MM+SS — mỗi khi 1 wheel THÔ hơn ổn định ở giá trị mới,
     * các wheel MỊN HƠN tự kẹp lại theo bound MỚI ngay lập tức (xem reclampFinerThan()).
     * Vẫn CHỐNG TRONG LOGIC (kẹp cứng lần cuối lúc bấm "Xong") — LUÔN đúng dù cơ chế chặn cuộn ở
     * trên có lỡ chưa kịp ổn định hay không.
     * @param {string} subId @param {'start'|'end'} kind @param {number} currentSeconds
     */
    openTimePickerModal(subId, kind, currentSeconds) {
        if (!this._wavesurfer) return;
        const ITEM_H = 44; // px — PHẢI khớp đúng h-11 (44px) của mỗi số trong subtitle-editor.html/CSS bên dưới
        const totalDuration = this._wavesurfer.getDuration() || 0;
        // Giới hạn THẬT: start bị chặn bởi min(tổng bài hát, end PENDING hiện tại); end bị chặn
        // TRÊN bởi tổng bài hát, chặn DƯỚI bởi start PENDING hiện tại.
        const minAllowed = kind === 'start' ? 0 : this._editingPendingStart;
        const maxAllowed = kind === 'start' ? Math.min(totalDuration, this._editingPendingEnd) : totalDuration;

        const totalMs = Math.max(0, Math.round(currentSeconds * 1000));
        // Giá trị HIỆN TẠI của từng wheel (CHỈ cập nhật khi wheel đó "ổn định" — xem onSettle bên
        // dưới) — dùng để tính bound cho các wheel MỊN HƠN theo tầng.
        let currentHH = Math.floor(totalMs / 3600000) % 24;
        let currentMM = Math.floor(totalMs / 60000) % 60;
        let currentSS = Math.floor(totalMs / 1000) % 60;
        const initTenth = Math.floor((totalMs % 1000) / 100); // giữ tên riêng — dùng lại để set vị trí cuộn ban đầu SAU KHI modal đã gắn vào document (xem fix bên dưới)

        /** Tính [min,max] (đơn vị THÔ, ví dụ 0-23 cho HH) hợp lệ cho tầng `level`, dựa trên giá trị
         * ỔN ĐỊNH HIỆN TẠI của các tầng THÔ HƠN — ước lượng theo phần dư còn lại của [minAllowed,
         * maxAllowed] sau khi trừ phần các tầng thô hơn đã đóng góp. */
        function boundsFor(level) {
            const prefixSeconds =
                (level === 'hh' ? 0 : currentHH * 3600) +
                (level === 'hh' || level === 'mm' ? 0 : currentMM * 60) +
                (level === 'hh' || level === 'mm' || level === 'ss' ? 0 : currentSS);
            const unitSeconds = level === 'hh' ? 3600 : level === 'mm' ? 60 : level === 'ss' ? 1 : 0.1;
            const count = level === 'hh' ? 24 : level === 'tenth' ? 10 : 60;
            let min = Math.max(0, Math.floor((minAllowed - prefixSeconds) / unitSeconds + 1e-9));
            let max = Math.min(count - 1, Math.floor((maxAllowed - prefixSeconds) / unitSeconds + 1e-9));
            if (min > max) { min = 0; max = count - 1; } // an toàn — hiếm khi xảy ra (làm tròn biên) -> bỏ giới hạn tầng này, logic lúc "Xác nhận" vẫn kẹp đúng
            return [min, max];
        }

        /** Dựng 1 cột cuộn — `onSettle(index)` gọi SAU KHI lướt tay dừng hẳn VÀ đã tự kẹp về đúng
         * [min,max] (nếu cần) — dùng để các wheel THÔ HƠN... không, dùng để CHÍNH wheel này cập
         * nhật biến current* của nó, cho các wheel MỊN HƠN tính lại bound theo. */
        function buildColumn(count, initIndex, level, onSettle) {
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
            // FIX (yêu cầu Giang, mục 2 — "mở lên luôn là 00:00:00") — KHÔNG set `col.scrollTop`
            // Ở ĐÂY nữa — `col` lúc này CHƯA gắn vào document (chỉ mới `createElement`, chưa
            // `appendChild` vào <body>) — set `scrollTop` trên phần tử CHƯA có layout thật (chưa
            // attach) bị trình duyệt coi như no-op/tự reset về 0, đúng NGUYÊN NHÂN modal luôn mở ra
            // ở 00:00:00 bất kể `currentSeconds` truyền vào là gì. Dời việc này xuống SAU
            // `document.body.appendChild(overlay)` (đã có layout thật) — xem bên dưới.

            let settleTimer = null;
            col.addEventListener('scroll', () => {
                clearTimeout(settleTimer);
                settleTimer = setTimeout(() => {
                    const idx = Math.round(col.scrollTop / ITEM_H);
                    const [min, max] = boundsFor(level);
                    const clamped = Math.max(min, Math.min(max, idx));
                    if (clamped !== idx) col.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' }); // "bật lại" mép gần nhất — rubber-band
                    onSettle(clamped);
                }, 120); // đợi lướt tay DỪNG HẲN rồi mới kẹp — tránh giật lúc đang lướt dở
            });
            return col;
        }

        const hhCol = buildColumn(24, currentHH, 'hh', (v) => { currentHH = v; reclampFinerThan('hh'); });
        const mmCol = buildColumn(60, currentMM, 'mm', (v) => { currentMM = v; reclampFinerThan('mm'); });
        const ssCol = buildColumn(60, currentSS, 'ss', (v) => { currentSS = v; reclampFinerThan('ss'); });
        const tenthCol = buildColumn(10, initTenth, 'tenth', () => {}); // tầng mịn nhất, không có gì phụ thuộc theo sau

        /** Wheel `level` vừa ổn định ở giá trị mới -> MỌI wheel MỊN HƠN cần tự kẹp lại NGAY (bound
         * của chúng vừa đổi theo giá trị mới này). */
        function reclampFinerThan(level) {
            const finerCols = level === 'hh' ? [['mm', mmCol], ['ss', ssCol], ['tenth', tenthCol]]
                : level === 'mm' ? [['ss', ssCol], ['tenth', tenthCol]]
                    : [['tenth', tenthCol]];
            finerCols.forEach(([finerLevel, col]) => {
                const idx = Math.round(col.scrollTop / ITEM_H);
                const [min, max] = boundsFor(finerLevel);
                const clamped = Math.max(min, Math.min(max, idx));
                if (clamped !== idx) col.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
                if (finerLevel === 'mm') currentMM = clamped; else if (finerLevel === 'ss') currentSS = clamped;
            });
        }

        const overlay = document.createElement('div');
        overlay.id = 'time-picker-modal-overlay';
        overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

        const card = document.createElement('div');
        card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-base font-bold text-white';
        titleEl.textContent = kind === 'start' ? t('subtitleEditor.timePicker.titleStart') : t('subtitleEditor.timePicker.titleEnd');
        card.appendChild(titleEl);

        // Hiện rõ khoảng hợp lệ ngay trong modal (thông tin, KHÔNG phải cảnh báo động — việc CHẶN
        // THẬT nằm ở cơ chế cuộn phía trên, xem buildColumn()).
        const rangeHintEl = document.createElement('p');
        rangeHintEl.className = 'text-[11px] text-slate-400 font-mono';
        rangeHintEl.textContent = tFormat('subtitleEditor.timePicker.rangeHint', { min: secToStr(minAllowed), max: secToStr(maxAllowed) });
        card.appendChild(rangeHintEl);

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
            // CHỐNG TRONG LOGIC: kẹp cứng vào [minAllowed, maxAllowed] LẦN CUỐI trước khi dùng —
            // LUÔN đúng dù cơ chế chặn cuộn ở trên có lỡ chưa kịp "ổn định" (debounce 120ms) hay
            // không (vd bấm "Xong" ngay khi vừa lướt xong, chưa đủ 120ms).
            const seconds = Math.max(minAllowed, Math.min(maxAllowed, hh * 3600 + mm * 60 + ss + tenth * 0.1));
            closeModal();
            if (this._editingLineId === subId) {
                // Đang sửa ĐÚNG dòng này — chỉ cập nhật PENDING + đồng bộ NGƯỢC region (mục 5),
                // KHÔNG commit thẳng (chờ bấm ✓ Áp dụng, xem applyLineEdit()).
                if (kind === 'start') this._editingPendingStart = seconds; else this._editingPendingEnd = seconds;
                if (this._region) this._region.setOptions({ [kind]: seconds });
                this._syncPendingFromRegion();
            }
        });

        document.body.appendChild(overlay);

        // FIX (yêu cầu Giang, mục 2 — "mở lên luôn là 00:00:00") — ĐÂY MỚI LÀ LÚC ĐÚNG để set vị
        // trí cuộn ban đầu — 4 cột giờ đã THẬT SỰ nằm trong document (attach xong ở dòng trên), có
        // layout thật, `scrollTop` gán vào lúc này mới có tác dụng (không còn bị trình duyệt âm
        // thầm bỏ qua/reset về 0 như lúc còn là node tách rời, xem comment đầy đủ ở buildColumn()).
        // Gán trực tiếp (không animation) — tránh thấy giật ngay lúc vừa mở modal.
        hhCol.scrollTop = currentHH * ITEM_H;
        mmCol.scrollTop = currentMM * ITEM_H;
        ssCol.scrollTop = currentSS * ITEM_H;
        tenthCol.scrollTop = initTenth * ITEM_H;
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

    /** "▶ Phát vùng chọn" — dùng CHUNG lõi `_togglePlayRange()` (mục 1: nút ▶ mỗi dòng phụ đề CŨNG
     * dùng đúng lõi này — hành vi toggle giống hệt nhau ở mọi nơi). */
    playSelection() {
        if (!this._region) return;
        this._togglePlayRange(this._region.start, this._region.end, null); // null = "vùng chọn chung", KHÁC 1 dòng cụ thể
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
        // FIX (yêu cầu Giang, mục 2) — cùng lý do _playRangeAndStop(): playPause() có thể gọi
        // .play() nội bộ, cũng có thể bị reject nếu va chạm với 1 lượt pause() vừa xảy ra sát đó.
        const result = this._wavesurfer.playPause();
        if (result && typeof result.catch === 'function') {
            result.catch((err) => console.warn('[subtitle-editor] playPause() bị reject:', err));
        }
    },

    /** MỚI (yêu cầu Giang, mục 1 — "phải như thế") — nút ▶ mỗi dòng phụ đề giờ dùng ĐÚNG cùng
     * `_togglePlayRange()` với "Phát vùng chọn"/"[▶]" khung điều khiển — CÙNG hành vi toggle (bấm
     * lại lúc đang phát ĐÚNG dòng này = dừng; bấm sau khi dừng/hết end = LUÔN phát lại từ đầu dòng).
     * Nhận startStr/endStr thô "HH:MM:SS,mmm" (đọc trực tiếp lúc bấm, xem core/subtitle/
     * subtitles-ui.js) + `id` (để phân biệt icon ĐÚNG dòng nào đang phát).
     * FIX (yêu cầu Giang, mục 2 — "vẫn chạy theo region cũ khi sửa lại start/end") — NGUYÊN NHÂN
     * GỐC: card của dòng ĐANG SỬA cập nhật hiển thị start/end PENDING TRỰC TIẾP qua DOM
     * (_syncPendingFromRegion(), KHÔNG render lại toàn bộ — cố ý, để mượt lúc kéo region) — nhưng
     * listener của nút ▶ (gắn 1 LẦN lúc dựng card, core/subtitle/subtitles-ui.js) đóng gói CLOSURE
     * theo giá trị PENDING TẠI THỜI ĐIỂM DỰNG, không tự cập nhật theo các lần kéo/sửa SAU ĐÓ —
     * startStr/endStr truyền vào đây có thể đã CŨ. FIX: nếu dòng NÀY đang được sửa
     * (`this._editingLineId === id`), LUÔN ưu tiên đọc thẳng `this._editingPendingStart/End` (state
     * SỐNG của chính Workflow, luôn đúng) — bỏ qua startStr/endStr được truyền vào (có thể cũ). */
    playLineRange(id, startStr, endStr) {
        if (!this._wavesurfer) return;
        let start, end;
        if (this._editingLineId === id) {
            start = this._editingPendingStart;
            end = this._editingPendingEnd;
        } else {
            start = strToSec(startStr); // core
            end = strToSec(endStr); // core
        }
        if (end <= start) return; // giờ dòng không hợp lệ (end <= start) -> không phát gì, tránh phát ngược/vô hạn
        this._togglePlayRange(start, end, id);
    },

    /** MỚI (yêu cầu Giang, mục 1/3/4) — TOGGLE dùng CHUNG cho MỌI nơi cần "phát [start,end] rồi tự
     * dừng, bấm lại lúc đang phát ĐÚNG cùng 1 nguồn = dừng, bấm sau khi dừng = luôn phát lại từ
     * đầu": "Phát vùng chọn"/"[▶]" khung điều khiển (`lineId = null`) VÀ ▶ mỗi dòng phụ đề
     * (`lineId = id` dòng đó). So `_activePlaybackLineId === lineId` để phân biệt "bấm lại ĐÚNG
     * nguồn đang phát" (dừng) với "bấm nguồn KHÁC trong lúc 1 nguồn khác đang phát" (chuyển sang
     * phát nguồn mới, không chỉ dừng nguồn cũ — _playRangeAndStop() tự dọn nguồn cũ trước). */
    _togglePlayRange(start, end, lineId) {
        if (this._isPlayingRegion && this._activePlaybackLineId === lineId && this._wavesurfer.isPlaying()) {
            this._wavesurfer.pause();
            this._clearLineRangeStopHandler(); // tự reset state + icon
            return;
        }
        this._playRangeAndStop(start, end, lineId);
    },

    /** Lõi DÙNG CHUNG cho mọi chỗ cần "phát đúng [start,end] rồi tự dừng" (▶ mỗi dòng phụ đề,
     * "Phát vùng chọn", nút "[▶]" khung điều khiển).
     * FIX (yêu cầu Giang, mục 4 — "phát không đúng vùng region được chọn") — trước đây gọi thẳng
     * `this._wavesurfer.play(start, end)`, TIN TƯỞNG thư viện tự seek tới `start` trước khi phát —
     * theo tài liệu CHÍNH THỨC của WaveSurfer.js (mọi bản, kể cả v7): "play([start[, end]]) —
     * Starts playback from the CURRENT position. Optional start/end... để set RANGE phát", nghĩa
     * là tham số `start` KHÔNG được đảm bảo tự seek tới — chỉ `end` chắc chắn dùng để biết lúc nào
     * dừng. FIX: tự `setTime(start)` TƯỜNG MINH trước, rồi mới `.play()` (không tham số).
     * @param {number} start @param {number} end @param {string|null} lineId null = "vùng chọn
     *   chung", id = 1 dòng cụ thể — dùng để cập nhật icon ĐÚNG nơi (mục 1). */
    _playRangeAndStop(start, end, lineId = null) {
        this._clearLineRangeStopHandler(); // dọn state CŨ trước (reset _activePlaybackLineId về null)
        this._isPlayingRegion = true;
        this._activePlaybackLineId = lineId; // gán SAU khi _clearLineRangeStopHandler() đã reset xong
        this._lineRangeStopHandler = (currentTime) => {
            if (currentTime >= end) {
                this._wavesurfer.pause();
                this._clearLineRangeStopHandler();
            }
        };
        this._wavesurfer.on('timeupdate', this._lineRangeStopHandler);
        // FIX (yêu cầu Giang — bug ẩn thứ tự thao tác + "phải bấm 2 lần mới phát lại") — GỘP 2 lớp
        // xác minh: (1) `_seekWithRetry()` đảm bảo seek tới `start` THẬT SỰ ăn trước khi phát (cùng
        // gốc bug với seekFromClick() — pipeline vẽ sóng 'ready' xong KHÔNG có nghĩa thẻ <audio>
        // bên dưới đã sẵn sàng nhận seek, đặc biệt lần ĐẦU TIÊN thao tác sau khi trang load xong);
        // (2) `_startPlaybackWithRetry()` đảm bảo `.play()` THẬT SỰ chạy sau đó (va chạm
        // "play() interrupted by pause()", hoặc chưa sẵn sàng phát ngay sau seek). Xâu chuỗi ĐÚNG
        // THỨ TỰ — CHỈ gọi play() sau khi seek đã XÁC NHẬN xong, không còn "seek rồi phát ngay lập
        // tức, hên xui" như bản trước.
        this._seekWithRetry(start, 3, () => this._startPlaybackWithRetry(lineId, start, 3));
    },

    /** Gọi `.play()` — bắt Promise reject (va chạm với pause() vừa gọi) VÀ xác minh lại bằng
     * `isPlaying()` sau 150ms (phòng trường hợp resolve "thành công" nhưng thực ra chưa phát được
     * gì do seek chưa kịp sẵn sàng) — tự thử lại tới `attemptsLeft` lần. Luôn kiểm tra
     * `this._activePlaybackLineId === lineId` trước khi thử lại — nếu người dùng đã tự đổi ý (bấm
     * dừng, hoặc chuyển sang phát nguồn khác) trong lúc đang chờ, KHÔNG ép phát đè lên ý muốn mới. */
    /** Gọi `.play()` — bắt Promise reject (va chạm với pause() vừa gọi) VÀ xác minh THẬT (sau
     * 150ms) xem đã phát chưa — tự thử lại tới `attemptsLeft` lần.
     * FIX (yêu cầu Giang — "bấm lần 2: chạy tới hết cả bài, lần 3 mới lại đúng") — NGUYÊN NHÂN GỐC
     * tìm được: bản trước CHỈ so `this._activePlaybackLineId === lineId` để quyết định "còn nên
     * thử lại không" — nhưng với "Phát vùng chọn"/"[▶]" khung điều khiển, `lineId` LUÔN là `null`
     * (đại diện "đây là vùng chọn chung, không phải 1 dòng cụ thể") — TRÙNG với giá trị `null` mà
     * `_activePlaybackLineId` cũng bị reset về SAU KHI 1 vùng NGẮN đã tự phát xong + tự dừng ĐÚNG
     * ở `end` (hoàn toàn hợp lệ, xem `_clearLineRangeStopHandler()`) — 2 Ý NGHĨA KHÁC NHAU của cùng
     * giá trị `null` bị NHẦM LẪN thành 1: lưới xác minh 150ms tưởng nhầm "chưa phát được" trong khi
     * THỰC RA đã phát xong + dừng đúng từ lâu — kích hoạt 1 lượt `.play()` THỪA, không setTime()
     * lại, KHÔNG có timeupdate handler nào canh dừng nữa (đã bị gỡ khi dừng đúng) -> phát tuột luôn
     * tới hết bài. FIX: thêm ĐIỀU KIỆN THỨ 2 bắt buộc — `this._isPlayingRegion` (cờ RIÊNG, LUÔN về
     * `false` khi dừng — dù dừng vì lý do gì — phân biệt rạch ròi "vẫn đang trong 1 phiên phát được
     * yêu cầu" khỏi "đã xong rồi", không lẫn với ý nghĩa "null = vùng chung" của `lineId` nữa) — VÀ
     * đổi hẳn cách kiểm tra "chưa phát được" từ `!isPlaying()` (mơ hồ — cũng đúng cho "đã phát VÀ
     * dừng xong") sang so `getCurrentTime()` có THẬT SỰ chưa nhích lên khỏi `start` hay không (chỉ
     * đúng khi play() CHƯA TỪNG chạy được tí nào — không thể nhầm với "đã chạy xong", lúc đó
     * currentTime chắc chắn đã tiến xa khỏi start). */
    _startPlaybackWithRetry(lineId, start, attemptsLeft) {
        if (!this._wavesurfer) return;
        let retried = false; // dedupe — .catch() VÀ lưới xác minh setTimeout có thể CÙNG muốn thử lại, chỉ cho phép 1 lần
        const playResult = this._wavesurfer.play();
        const retryIfStillWanted = (err) => {
            if (retried) return;
            retried = true;
            if (err) console.warn('[subtitle-editor] play() bị reject/chưa thật sự chạy — thử lại:', err);
            if (attemptsLeft <= 0) return;
            setTimeout(() => {
                const stillWanted = this._activePlaybackLineId === lineId && this._isPlayingRegion; // vẫn ĐÚNG phiên phát này, chưa bị hành động khác/tự dừng xong "cướp"
                const neverActuallyStarted = this._wavesurfer && !this._wavesurfer.isPlaying() && this._wavesurfer.getCurrentTime() <= start + 0.05; // CHƯA TỪNG nhích lên khỏi start — không thể nhầm với "đã chạy xong"
                if (stillWanted && neverActuallyStarted) this._startPlaybackWithRetry(lineId, start, attemptsLeft - 1);
            }, 120);
        };
        if (playResult && typeof playResult.catch === 'function') playResult.catch(retryIfStillWanted);
        // Lưới xác minh BỔ SUNG — kể cả khi playResult "resolve" (không reject gì) — vẫn tự kiểm
        // tra THẬT xem đã phát chưa, chưa thì coi như thất bại âm thầm và thử lại.
        setTimeout(() => {
            const stillWanted = this._activePlaybackLineId === lineId && this._isPlayingRegion;
            const neverActuallyStarted = this._wavesurfer && !this._wavesurfer.isPlaying() && this._wavesurfer.getCurrentTime() <= start + 0.05;
            if (stillWanted && neverActuallyStarted) retryIfStillWanted(null);
        }, 150);
    },

    /** MỚI (yêu cầu Giang, mục 1.C) — gỡ sạch listener 'timeupdate' đang canh dừng 1 lượt nghe thử
     * (nếu có) — gọi TRƯỚC MỌI hành động phát lại độc lập khác (play/pause thủ công, phát vùng
     * chọn/dòng khác, bắt đầu ghi Auto-timing) để tránh nó tự pause() nhầm về sau. LUÔN reset
     * `_isPlayingRegion`/`_activePlaybackLineId` + icon (control bar VÀ dòng đang phát nếu có) mỗi
     * khi bị gỡ, BẤT KỂ lý do — bảo đảm không nơi nào hiện sai trạng thái "đang phát". */
    _clearLineRangeStopHandler() {
        if (this._lineRangeStopHandler) {
            this._wavesurfer.un('timeupdate', this._lineRangeStopHandler);
            this._lineRangeStopHandler = null;
        }
        this._isPlayingRegion = false;
        this._updatePlaybackIcons(); // cập nhật TRƯỚC KHI xoá _activePlaybackLineId, để còn tìm đúng card mà tắt icon
        this._activePlaybackLineId = null;
    },

    /** MỚI (yêu cầu Giang, mục 1/3/4) — đổi icon "[▶]"/"[⏸]" ở khung điều khiển (KHI đang phát
     * VÙNG CHUNG, `_activePlaybackLineId === null`) VÀ icon ▶/⏸ của ĐÚNG 1 dòng đang phát (nếu có,
     * qua `_lineCardNodesById` — KHÔNG render lại toàn bộ, chỉ đổi class trực tiếp trên node đã
     * cache). KHÔNG dùng sự kiện 'play'/'pause' chung của WaveSurfer — sự kiện đó bắn cho MỌI kiểu
     * phát (kể cả Play/Pause thường không giới hạn), không phân biệt được "đang phát vùng/dòng bị
     * chặn ở end" khỏi phát chung. */
    _updatePlaybackIcons() {
        const isActive = this._isPlayingRegion && this._wavesurfer && this._wavesurfer.isPlaying();
        const isRegionActive = isActive && this._activePlaybackLineId === null;
        if (iconPlayRegionPlay && iconPlayRegionPause) {
            iconPlayRegionPlay.classList.toggle('hidden', isRegionActive);
            iconPlayRegionPause.classList.toggle('hidden', !isRegionActive);
        }
        if (this._activePlaybackLineId !== null) {
            const card = this._lineCardNodesById.get(this._activePlaybackLineId);
            if (card) {
                const playIcon = card.querySelector('.sub-line-play-icon');
                const pauseIcon = card.querySelector('.sub-line-pause-icon');
                if (playIcon && pauseIcon) {
                    playIcon.classList.toggle('hidden', isActive);
                    pauseIcon.classList.toggle('hidden', !isActive);
                }
            }
        }
    },

    /** MỚI (yêu cầu Giang, mục 2) — đặt this._region.start = vị trí phát HIỆN TẠI
     * (getCurrentTime()) — cách "chốt mốc" thay thế kéo tay cầm: tua/nghe tới đúng chỗ rồi bấm là
     * xong, không cần kéo chính xác bằng ngón tay trên waveform nhỏ.
     * SỬA (yêu cầu Giang, mục 5 — thuật toán thông minh hơn) — trước đây current >= end hiện tại
     * thì CHỈ im lặng bỏ qua (region không đổi gì, khó hiểu vì sao bấm không có tác dụng). Giờ:
     * nếu current vẫn < end -> như cũ, chỉ đổi start. Nếu current >= end (bấm "chốt start" nhưng
     * vị trí đang nghe lại NẰM SAU end hiện tại) -> HOÁN ĐỔI thông minh: end CŨ trở thành start MỚI
     * (mốc vẫn còn ý nghĩa, không vứt bỏ), current trở thành end MỚI — luôn ra 1 region hợp lệ,
     * không bao giờ im lặng từ chối. */
    setRegionStartToCurrentTime() {
        if (!this._region || !this._wavesurfer) return;
        const current = this._wavesurfer.getCurrentTime();
        if (current < this._region.end) {
            this._region.setOptions({ start: current });
        } else {
            this._region.setOptions({ start: this._region.end, end: current });
        }
        this._updateRegionTimeDisplay();
        // FIX (yêu cầu Giang, mục 1 — "chưa đồng bộ") — TRƯỚC ĐÂY chỉ dựa vào sự kiện 'update' của
        // region tự bắn (đăng ký ở _initWaveform()) để đồng bộ ngược vào dòng đang sửa — nhưng
        // KHÔNG có tài liệu/bằng chứng nào đảm bảo `region.setOptions()` LUÔN bắn 'update' đồng bộ
        // hệt như lúc kéo tay (GitHub issue #3050 của katspaugh/wavesurfer.js còn ghi nhận
        // setOptions() gọi trong 1 số ngữ cảnh KHÔNG cập nhật đúng UI). Gọi TRỰC TIẾP
        // _syncPendingFromRegion() ở đây, KHÔNG lệ thuộc gì vào việc sự kiện có bắn hay không —
        // luôn đúng bất kể hành vi thật của thư viện.
        this._syncPendingFromRegion();
    },

    /** Đối xứng với setRegionStartToCurrentTime() ở trên — current <= start hiện tại (bấm "chốt
     * end" nhưng vị trí đang nghe lại NẰM TRƯỚC start hiện tại) -> HOÁN ĐỔI: start CŨ thành end
     * MỚI, current thành start MỚI. */
    setRegionEndToCurrentTime() {
        if (!this._region || !this._wavesurfer) return;
        const current = this._wavesurfer.getCurrentTime();
        if (current > this._region.start) {
            this._region.setOptions({ end: current });
        } else {
            this._region.setOptions({ start: current, end: this._region.start });
        }
        this._updateRegionTimeDisplay();
        this._syncPendingFromRegion(); // FIX (yêu cầu Giang, mục 1) — cùng lý do ở trên
    },

    // ============================== Toolbar: MỚI — tool "Cut MP3" (yêu cầu Giang, mục 1) ==============================

    /** Bấm "Cut" — cắt ĐÚNG đoạn this._region hiện tại thành 1 file .mp3 thật, xong hiện modal 3
     * lựa chọn (modalChoice() có sẵn, core/modal-choice.js) Huỷ/Tải xuống/Chèn. Tự khoá nút trong
     * lúc mã hoá (đề phòng bấm chồng — mã hoá lamejs chạy đồng bộ, chặn main thread 1 lúc tuỳ độ
     * dài vùng chọn). */
    async cutMp3FromRegion() {
        if (!this._region || !this._wavesurfer) return;
        if (btnCutMp3.dataset.busy === '1') return;
        btnCutMp3.dataset.busy = '1';
        btnCutMp3.classList.add('opacity-40', 'pointer-events-none');
        try {
            // Nhường 1 khung hình cho trình duyệt VẼ XONG trạng thái "đang xử lý" (mờ nút) TRƯỚC
            // khi bắt đầu việc mã hoá đồng bộ nặng — không làm vậy, nút sẽ trông như "không phản
            // hồi" suốt lúc mã hoá vì main thread bận, không kịp repaint.
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const blob = await this._encodeMp3FromRegion(this._region.start, this._region.end);
            this._showCutResultModal(blob);
        } catch (err) {
            console.error('[subtitle-editor] Cắt MP3 thất bại:', err);
            await alertModal(t('subtitleEditor.cutMp3.error')); // core/modal-choice.js
        } finally {
            btnCutMp3.dataset.busy = '0';
            btnCutMp3.classList.remove('opacity-40', 'pointer-events-none');
        }
    },

    /** Cắt [startSec, endSec] từ AudioBuffer ĐÃ GIẢI MÃ SẴN của chính WaveSurfer
     * (getDecodedData() — cùng nguồn dữ liệu với waveform đang hiển thị, không tự decodeAudioData()
     * lại từ đầu tốn công) rồi mã hoá bằng lamejs (CDN, subtitle-editor.html) -> Blob 'audio/mpeg'.
     * lamejs cần PCM 16-bit int — tự convert từ Float32Array (-1..1) của Web Audio API. Block size
     * 1152 = đúng 1 khung MPEG Layer III chuẩn (xem ví dụ chính thức của lamejs). */
    async _encodeMp3FromRegion(startSec, endSec) {
        const buffer = this._wavesurfer.getDecodedData();
        if (!buffer) throw new Error('getDecodedData() null — chưa có dữ liệu audio đã giải mã.');

        const sampleRate = buffer.sampleRate;
        const startSample = Math.max(0, Math.floor(startSec * sampleRate));
        const endSample = Math.min(buffer.length, Math.ceil(endSec * sampleRate));
        const sliceLength = endSample - startSample;
        if (sliceLength <= 0) throw new Error('Vùng chọn rỗng, không có gì để cắt.');

        const channels = Math.min(buffer.numberOfChannels, 2); // lamejs chỉ hỗ trợ mono/stereo
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128); // 128kbps — đủ dùng cho đoạn cắt ngắn
        const blockSize = 1152;
        const mp3Chunks = [];

        const chanData = [];
        for (let c = 0; c < channels; c++) {
            const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)).subarray(startSample, endSample);
            const int16 = new Int16Array(sliceLength);
            for (let i = 0; i < sliceLength; i++) {
                const s = Math.max(-1, Math.min(1, src[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            chanData.push(int16);
        }

        for (let i = 0; i < sliceLength; i += blockSize) {
            const left = chanData[0].subarray(i, i + blockSize);
            const encoded = channels === 2
                ? mp3encoder.encodeBuffer(left, chanData[1].subarray(i, i + blockSize))
                : mp3encoder.encodeBuffer(left);
            if (encoded.length > 0) mp3Chunks.push(encoded);
        }
        const finalChunk = mp3encoder.flush();
        if (finalChunk.length > 0) mp3Chunks.push(finalChunk);

        return new Blob(mp3Chunks, { type: 'audio/mpeg' });
    },

    /** Modal 3 lựa chọn sau khi cắt xong — TÁI DÙNG modalChoice() có sẵn (core/modal-choice.js,
     * đúng yêu cầu Giang "modal choice") thay vì dựng modal riêng như Split/Shift (ở đây chỉ cần
     * chọn 1 trong 3 nút, không cần input gì thêm — modalChoice() vừa khớp, không cần viết thêm). */
    _showCutResultModal(blob) {
        const startStr = secToStr(this._region.start); // core
        const endStr = secToStr(this._region.end); // core
        const baseTitle = this._record.tag?.title || this._songKey;
        const fileName = `${baseTitle} [cut ${startStr} - ${endStr}].mp3`.replace(/[:,]/g, '-');

        modalChoice( // core/modal-choice.js
            tFormat('subtitleEditor.cutMp3.resultDesc', { start: startStr, end: endStr }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors' },
                { label: t('subtitleEditor.cutMp3.download'), className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-bold transition-colors', onClick: () => this._downloadCutBlob(blob, fileName) },
                { label: t('subtitleEditor.cutMp3.insert'), className: 'flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold transition-colors', onClick: () => this._insertCutBlobAsNewSong(blob, fileName) },
            ],
            { title: t('subtitleEditor.cutMp3.resultTitle') }
        );
    },

    _downloadCutBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
    },

    /** "Chèn" — thêm đoạn vừa cắt vào thư viện NHƯ 1 BÀI HÁT MỚI, HOÀN TOÀN TÁCH BIỆT khỏi bài
     * gốc đang mở (record riêng, key riêng) — tái dùng ĐÚNG resolveSongKey()/setSongRecord()
     * (service/db.js) mà core/playlist/loader.js dùng khi nạp file mới, để key luôn nhất quán với
     * cách app tự đặt tên bài trùng. KHÔNG cần tự thêm vào `playlistOrder` (appState — trang này
     * không nạp service/state.js): initPlaylistFromDB() (core/playlist/loader.js) coi store
     * `songs` là "chân lý duy nhất", tự quét lại TOÀN BỘ key trong store đó mỗi lần index.html mở
     * — bài mới chèn sẽ tự xuất hiện ngay lần quay lại Playlist sau, không cần đụng gì thêm ở đây. */
    async _insertCutBlobAsNewSong(blob, fileName) {
        const key = await resolveSongKey(fileName); // service/db.js
        const baseTitle = this._record.tag?.title || this._songKey;
        const record = {
            filename: fileName,
            blob,
            tag: {
                title: tFormat('subtitleEditor.cutMp3.newSongTitle', { title: baseTitle }),
                artist: this._record.tag?.artist || '',
                album: this._record.tag?.album || '',
            },
            cover: this._record.cover || null,
            subtitles: [],
            duration: this._region.end - this._region.start,
            addedAt: Date.now(),
        };
        await setSongRecord(key, record); // service/db.js
        await alertModal(t('subtitleEditor.cutMp3.inserted')); // core/modal-choice.js
    },

    // ============================== Toolbar: MỚI — tool "Shift" (yêu cầu Giang, mục 5) ==============================

    /** Bấm nút "Shift" trên thanh công cụ — bật/tắt "chế độ chọn dòng" để dịch giờ hàng loạt.
     * Thoát chế độ (tắt) LUÔN xoá sạch lựa chọn cũ — vào lại là chọn từ đầu, tránh nhầm lẫn "còn
     * sót chọn từ lần trước". */
    /** Bấm nút "Shift" trên thanh công cụ — bật/tắt "chế độ chọn dòng" để dịch giờ hàng loạt.
     * Thoát chế độ (tắt) LUÔN xoá sạch lựa chọn cũ — vào lại là chọn từ đầu, tránh nhầm lẫn "còn
     * sót chọn từ lần trước".
     * MỚI (yêu cầu Giang, mục 7) — bật/tắt chế độ chọn đổi hẳn CẤU TRÚC của MỌI card (có/không ô
     * tròn chọn, input/nút disabled khác nhau) — KHÔNG chỉ 1 dòng cụ thể như
     * _commitLineText()/_applyLineTime() cũ (nay đã thay bằng applyLineEdit()/cancelLineEdit(),
     * xem docstring đầu file) — phải xoá SẠCH cache (`clear()`), ép dựng lại card mới
     * cho TOÀN BỘ danh sách, không chỉ xoá riêng lẻ từng id. */
    /** MỚI (yêu cầu Giang, mục 4) — chặn hẳn nếu ĐANG sửa 1 dòng (2 chế độ loại trừ nhau — phải
     * Áp dụng/Huỷ dòng đang sửa trước khi chuyển sang chọn Shift). */
    toggleShiftSelectionMode() {
        if (this._editingLineId !== null) return;
        this._isShiftSelectionMode = !this._isShiftSelectionMode;
        if (!this._isShiftSelectionMode) this._shiftSelectedIds = new Set();
        this._lineCardNodesById.clear();
        this._renderLines();
        this._renderShiftBar();
    },

    /** Bấm NGUYÊN 1 card lúc đang ở chế độ chọn dòng — thêm/bớt khỏi tập đang chọn.
     * MỚI (yêu cầu Giang, mục 7) — CHỈ card của ĐÚNG dòng vừa bấm cần dựng lại (đổi ô tròn chọn +
     * nền highlight) — các dòng khác giữ nguyên card cũ. */
    toggleLineSelection(id) {
        if (this._shiftSelectedIds.has(id)) this._shiftSelectedIds.delete(id);
        else this._shiftSelectedIds.add(id);
        this._lineCardNodesById.delete(id);
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
    /** MỚI (yêu cầu Giang, mục 7) — _applyShift() vừa ĐỔI GIỜ các dòng đã chọn, VỪA thoát hẳn chế
     * độ chọn dòng (đổi CẤU TRÚC của MỌI card, không riêng các dòng bị dịch giờ) — xoá SẠCH cache
     * (không chỉ riêng các id đã chọn) để render lại đúng, cùng lý do toggleShiftSelectionMode(). */
    _applyShift(amountSec, target) {
        this._subtitles = shiftSubtitleTimes(this._subtitles, this._shiftSelectedIds, amountSec, target); // core
        this._isShiftSelectionMode = false;
        this._shiftSelectedIds = new Set();
        this._lineCardNodesById.clear();
        this._renderLines(); // tự sort lại rồi (xem _renderLines())
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

    /** MỚI (yêu cầu Giang) — nút tải lại KHÔNG dùng cache. Hỏi xác nhận trước (modalChoice() có
     * sẵn, core/modal-choice.js) vì `this._subtitles` là mảng làm việc TRONG BỘ NHỚ — CHƯA CHẮC đã
     * ghi xuống IndexedDB (bấm "Lưu" mới ghi thật, xem saveToDatabase()) — tải lại mà chưa Lưu sẽ
     * MẤT mọi chỉnh sửa dở dang, cần cảnh báo rõ trước khi làm. */
    reloadWithoutCache() {
        modalChoice( // core/modal-choice.js
            t('subtitleEditor.reloadConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors' },
                { label: t('subtitleEditor.reloadConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold transition-colors', onClick: () => this._doReloadWithoutCache() },
            ],
            { title: t('subtitleEditor.reloadConfirm.title') }
        );
    },

    /** Thêm query param cache-bust rồi điều hướng tới CHÍNH URL đó (GIỮ NGUYÊN `?song=...` hiện
     * có) — ép trình duyệt coi đây là URL MỚI, tải THẬT từ mạng thay vì phục vụ HTML từ cache đĩa/
     * bộ nhớ. `location.reload(true)` KHÔNG còn đáng tin cậy (Firefox đã bỏ hẳn tham số `force`,
     * Chrome cũng không đảm bảo bỏ qua cache thật sự dù truyền tham số này) — đổi URL qua query
     * param là cách DUY NHẤT hoạt động nhất quán trên mọi trình duyệt/WebView. */
    _doReloadWithoutCache() {
        const url = new URL(window.location.href);
        url.searchParams.set('_r', Date.now().toString());
        window.location.href = url.toString();
    },
};
