/**
 * event/workflow/subtitle-editor.js — Workflow DUY NHẤT của trang `subtitle-editor.html` (KHÔNG
 * nạp ở `index.html`, chạy như 1 trang độc lập).
 *
 * Trang này TRƯỚC ĐÂY không dùng `appState` — SỬA 25/07/2026 (đợt tái cấu trúc state, lượt 2):
 * trang này giờ CÓ nạp `service/state.js`, 20 field state sống trong `appState` (package
 * 'subtitle-editor', xem `service/state/subtitle-editor.js` +
 * `service/state/record/subtitle-editor.js`) — CÙNG hạ tầng schema/registry() như mọi trang khác
 * (lượt 1 từng nhét 20 field này vào EventStore — SAI ranh giới, EventStore chỉ dành cho "state
 * context" nhỏ giữa 2 message, không phải state nghiệp vụ toàn trang). Mọi method đọc/ghi qua
 * `appState.get('_xxx')`/`appState.set('_xxx', value)` trực tiếp. Mọi timer/interval đều qua
 * `taskManager` (`service/task-manager.js`, có nạp ở trang này) — không dùng
 * `setTimeout`/`setInterval` thô, xem `readme/task-manager-conventions.md`.
 *
 * WaveSurfer.js (CDN) đảm nhiệm CẢ waveform LẪN phát âm thanh — không cần `<audio>`/Worker decode
 * riêng. Đúng 1 Region (`_region`) DUY NHẤT tồn tại suốt vòng đời trang — mọi tool "theo vùng
 * chọn" đều thao tác lên chính region đó (không tạo region mới).
 *
 * Tính năng: Upload .srt, Auto-timing (2 nhịp bấm theo thời điểm phát), Thêm dòng, Xuất .srt, Lấy
 * giờ từ vùng chọn, Phát vùng chọn, Split, Cut MP3, Shift giờ hàng loạt. Nút Lưu tách riêng khỏi
 * "đóng" (trang không tự đóng khi lưu — nút "←" quay lại riêng, xem `back()`).
 *
 * NẠP SAU: core/subtitle/subtitles.js, core/subtitle/subtitles-ui.js, core/time-picker-modal.js
 * (MỚI 18/07/2026 — openTimePickerModal() dùng chung, xem docstring hàm cùng tên trong file này),
 * service/db.js, lang/lang.js, WaveSurfer.js (CDN) + Regions plugin (CDN).
 */
const workflowSubtitleEditor = {
    // SỬA (25/07/2026, đợt tái cấu trúc state) — 20 field state dưới đây KHÔNG còn là property
    // của object literal này nữa — sống thật trong `appState` (package `subtitle-editor`, xem
    // `service/state/subtitle-editor.js` + `service/state/record/subtitle-editor.js`), CÙNG hạ
    // tầng schema/registry() như mọi domain khác của app — KHÔNG dùng EventStore (bản trước đó
    // dùng nhầm EventStore cho state nghiệp vụ toàn trang, đã sửa lại theo đúng ranh giới đã chốt:
    // EventStore chỉ dành cho "state context" nhỏ giữa 2 message, không phải state nghiệp vụ của
    // cả 1 trang). MỌI method bên dưới đọc/ghi qua `appState.get('_xxx')`/`appState.set('_xxx',
    // value)` — giữ nguyên tên field kèm dấu `_` làm key.

    /** Chạy 1 LẦN lúc trang load xong (xem event/listener/subtitle-editor.js). */
    async init() {
        const encoded = new URLSearchParams(window.location.search).get('song');
        const songKey = encoded ? decodeSongKeyFromUrl(encoded) : null; // service/song-key-cipher.js
        if (!songKey) { this._showFatalError(t('subtitleEditor.invalidLink')); return; }

        const record = await getSongRecord(songKey); // service/db.js
        if (!record) { this._showFatalError(t('subtitleEditor.songNotFound')); return; }

        appState.set('_songKey', songKey);
        appState.set('_record', record);
        appState.set('_subtitles', sortSubtitlesByStart(record.subtitles ? record.subtitles.slice() : [])); // core

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
            appState.set('_regionsPlugin', WaveSurfer.Regions.create());
            // Dải mốc thời gian (Timeline plugin) — dùng CHUNG container với waveform chính (không
            // truyền `container` riêng) để 2 vùng luôn cuộn đồng bộ tuyệt đối.
            appState.set('_timelinePlugin', typeof WaveSurfer.Timeline !== 'undefined'
                ? WaveSurfer.Timeline.create({ height: 20 })
                : null);
            if (!appState.get('_timelinePlugin')) console.warn('[subtitle-editor] Dải mốc thời gian (Timeline) không khởi tạo được (CDN chặn/lỗi mạng?) — waveform chính vẫn dùng được bình thường.');
            appState.set('_wavesurfer', WaveSurfer.create({
                container: waveformContainerEl,
                height: 88,
                waveColor: '#475569',
                progressColor: '#0ea5e9',
                cursorColor: '#f8fafc',
                minPxPerSec: appState.get('_zoomLevel'), // biến state để zoomIn()/zoomOut() có gốc theo dõi đúng
                normalize: true,
                // Tự cuộn theo vị trí phát + giữ con trỏ ở giữa khung nhìn — khai rõ ràng, không
                // phụ thuộc mặc định ẩn của thư viện.
                autoScroll: true,
                autoCenter: true,
                plugins: appState.get('_timelinePlugin') ? [appState.get('_regionsPlugin'), appState.get('_timelinePlugin')] : [appState.get('_regionsPlugin')],
            }));

            appState.get('_wavesurfer').on('error', (err) => {
                console.error('[subtitle-editor] WaveSurfer lỗi tải/giải mã audio:', err);
                this._showWaveformError();
            });

            appState.get('_wavesurfer').on('decode', () => {
                const duration = appState.get('_wavesurfer').getDuration();
                appState.set('_region', appState.get('_regionsPlugin').addRegion({
                    start: 0,
                    end: Math.min(2, duration),
                    color: 'rgba(56, 189, 248, 0.25)',
                    drag: true,
                    resize: true,
                }));
                // Nhãn giờ start/end tự cập nhật mỗi lần kéo tay cầm. Nếu đang sửa 1 dòng, đồng bộ
                // ngược region -> giờ pending của dòng đó, cập nhật trực tiếp DOM (không render lại
                // toàn bộ — 'update' bắn rất nhiều lần/giây, render lại sẽ giật/mất focus).
                appState.get('_region').on('update', () => {
                    this._updateRegionTimeDisplay();
                    if (appState.get('_editingLineId') !== null) this._syncPendingFromRegion();
                });
                this._updateRegionTimeDisplay();
            });

            // MỚI (11/07/2026, mục 2) — chỉ hiện thanh Play/Pause + giờ start/end SAU KHI waveform
            // thật sự sẵn sàng (decode xong + đã vẽ xong), tránh hiện điều khiển cho 1 waveform
            // chưa có gì để play/pause.
            appState.get('_wavesurfer').on('ready', () => {
                waveformControlsEl.classList.remove('hidden');
                this._updateRegionTimeDisplay();
                this._primeAudioPlayback(); // THỬ NGHIỆM (13/07/2026, yêu cầu Giang) — xem docstring hàm
            });
            appState.get('_wavesurfer').on('play', () => {
                iconWaveformPlay.classList.add('hidden');
                iconWaveformPause.classList.remove('hidden');
                // Gọi NGAY trong sự kiện 'play' thật (không phải ngay sau lời gọi .play(), lúc đó
                // isPlaying() vẫn có thể còn trả false) — đúng lúc phát THỰC SỰ bắt đầu.
                this._updatePlaybackIcons();
            });
            appState.get('_wavesurfer').on('pause', () => {
                iconWaveformPause.classList.add('hidden');
                iconWaveformPlay.classList.remove('hidden');
                this._updatePlaybackIcons(); // cùng lý do ở trên — đồng bộ NGAY lúc phát THỰC SỰ dừng
            });
            // Giờ vị trí phát hiện tại — luôn bật, chạy suốt lúc đang phát.
            appState.get('_wavesurfer').on('timeupdate', (currentTime) => this._updateCurrentTimeDisplay(currentTime));

            // load() trả về Promise — LUÔN .catch() để không bỏ lỡ lỗi giải mã audio (WaveSurfer.js
            // v7 có bug dangling-promise đã biết, GitHub issue #3126 — lỗi có thể không đi qua sự
            // kiện 'error' phía trên).
            appState.get('_wavesurfer').load(url).catch((err) => {
                console.error('[subtitle-editor] wavesurfer.load() bị reject (lỗi tải/giải mã audio):', err);
                this._showWaveformError();
            });
        } catch (err) {
            console.error('[subtitle-editor] Lỗi khởi tạo WaveSurfer:', err);
            this._showWaveformError();
        }
    },

    /** THỬ NGHIỆM — bắn play() rồi pause() ngay (tắt tiếng lúc làm) lúc waveform 'ready', thử xem
     * việc "chạm" vào thẻ audio sớm có giúp thẻ đó sẵn sàng nhận seek từ lần đầu người dùng thao
     * tác hay không (không chắc chắn dứt điểm — _seekWithRetry() vẫn giữ làm lớp bảo vệ thứ 2).
     * .catch() nuốt lỗi "play() interrupted by pause()" và lỗi chặn autoplay — đều vô hại. */
    _primeAudioPlayback() {
        if (!appState.get('_wavesurfer')) return;
        const wasMuted = (typeof appState.get('_wavesurfer').getMuted === 'function') ? appState.get('_wavesurfer').getMuted() : false;
        appState.get('_wavesurfer').setMuted(true);
        Promise.resolve(appState.get('_wavesurfer').play())
            .catch(() => {})
            .finally(() => {
                if (!appState.get('_wavesurfer')) return;
                appState.get('_wavesurfer').pause();
                appState.get('_wavesurfer').setMuted(wasMuted);
            });
    },

    /** Hiện thông báo lỗi NGAY TRONG khung waveform cố định (KHÔNG để khung biến mất/trống rỗng) —
     * các tool cần vùng chọn (Lấy giờ từ vùng chọn/Phát vùng) sẽ không hoạt động (`_region` vẫn
     * `null`) nhưng Auto-timing/Thêm dòng/Upload/Xuất .srt (không phụ thuộc waveform) vẫn dùng
     * được bình thường. */
    _showWaveformError() {
        waveformErrorEl.classList.remove('hidden');
    },

    /** MỚI (11/07/2026, mục 2) — cập nhật 2 nhãn giờ start/end theo ĐÚNG appState.get('_region') hiện tại,
     * cùng định dạng "HH:MM:SS,mmm" như ô giờ mỗi dòng phụ đề (secToStr(), core/subtitle/
     * subtitles.js) cho nhất quán. Gọi lại mỗi lần region 'update' (kéo tay cầm) + lúc 'ready'. */
    _updateRegionTimeDisplay() {
        if (!appState.get('_region')) return;
        waveformRegionStartEl.textContent = secToStr(appState.get('_region').start); // core
        waveformRegionEndEl.textContent = secToStr(appState.get('_region').end); // core
    },

    /** MỚI (yêu cầu Giang, mục 2) — cập nhật nhãn giờ đang phát HIỆN TẠI (khác giờ start/end vùng
     * chọn ở trên) — gọi liên tục lúc đang phát ('timeupdate') VÀ mỗi lần seek thủ công
     * (seekFromClick() bên dưới). */
    _updateCurrentTimeDisplay(currentTime) {
        if (!waveformCurrentTimeEl) return;
        waveformCurrentTimeEl.textContent = secToStr(currentTime); // core
    },

    /** Tính vị trí seek từ toạ độ click, dùng ĐÚNG API của WaveSurfer (`getScroll()` + tự
     * `options.minPxPerSec`) thay vì tự đoán qua `scrollWidth`/`scrollLeft` của div ngoài (div đó
     * KHÔNG phải phần tử đang cuộn thật — WaveSurfer v7 tự quản lý cuộn ngang riêng trong Shadow
     * DOM của chính nó) — 2 giá trị dùng ở đây luôn đúng bất kể div ngoài có phải phần tử cuộn hay
     * không.
     *
     * WaveSurfer.js có 2 pipeline độc lập: (1) giải mã để vẽ sóng ('decode'/'ready'), và (2) thẻ
     * `<audio>` bên dưới thật sự phát âm thanh — 'ready' xong KHÔNG đảm bảo (2) đã sẵn sàng nhận
     * seek. Seek ngay lúc pipeline (2) còn tải ngầm có thể bị trình duyệt âm thầm bỏ qua — dùng
     * `_seekWithRetry()` (xác minh + tự thử lại) thay vì `setTime()` trần trụi để né lỗi này.
     * @param {number} clickXInViewport vị trí bấm tính từ mép trái khung nhìn thấy (chưa cộng cuộn). */
    seekFromClick(clickXInViewport) {
        if (!appState.get('_wavesurfer')) return;
        const duration = appState.get('_wavesurfer').getDuration();
        if (!duration) return;
        const pxPerSec = appState.get('_wavesurfer').options.minPxPerSec || 1;
        const scrollPx = appState.get('_wavesurfer').getScroll(); // vị trí cuộn thật của chính WaveSurfer, không đoán qua div ngoài
        const absolutePx = scrollPx + clickXInViewport;
        const time = Math.max(0, Math.min(duration, absolutePx / pxPerSec));
        const wasPlaying = appState.get('_wavesurfer').isPlaying();
        this._updateCurrentTimeDisplay(time); // cập nhật hiển thị ngay (lạc quan) — 'timeupdate' sẽ tự sửa lại nếu lượt seek đầu bị lỡ
        this._seekWithRetry(time, 3, () => {
            if (wasPlaying && !appState.get('_wavesurfer').isPlaying()) appState.get('_wavesurfer').play();
        });
    },

    /** Seek tới `time`, xác minh thật (đọc lại getCurrentTime() sau 1 khoảng ngắn) — chưa khớp
     * (lệch > 150ms) thì tự thử lại tối đa `attemptsLeft` lần. Dùng chung cho seekFromClick() và
     * _playRangeAndStop() — cùng 1 lớp bug gốc (xem seekFromClick()), cùng 1 cách né. */
    _seekWithRetry(time, attemptsLeft, onSeeked) {
        if (!appState.get('_wavesurfer')) return;
        appState.get('_wavesurfer').setTime(time);
        taskManager.once(() => {
            if (!appState.get('_wavesurfer')) return;
            const matched = Math.abs(appState.get('_wavesurfer').getCurrentTime() - time) <= 0.15;
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
        if (!appState.get('_wavesurfer')) return;
        appState.set('_zoomLevel', Math.min(500, Math.round(appState.get('_zoomLevel') * 1.5)));
        appState.get('_wavesurfer').zoom(appState.get('_zoomLevel'));
    },

    zoomOut() {
        if (!appState.get('_wavesurfer')) return;
        appState.set('_zoomLevel', Math.max(20, Math.round(appState.get('_zoomLevel') / 1.5)));
        appState.get('_wavesurfer').zoom(appState.get('_zoomLevel'));
    },

    /** Bật/tắt bảng xem console.log/warn/error + lỗi promise không ai bắt (window.__sedLog, thu từ
     * đầu <head> subtitle-editor.html), phục vụ điều tra bug trên thiết bị không có devtools. Panel
     * tự làm mới (task lặp 500ms qua `taskManager`) trong lúc đang mở — dừng hẳn lúc đóng. */
    toggleDebugPanel() {
        appState.set('_isDebugPanelOpen', !appState.get('_isDebugPanelOpen'));
        waveformDebugPanelEl.classList.toggle('hidden', !appState.get('_isDebugPanelOpen'));
        if (appState.get('_isDebugPanelOpen')) {
            this._renderDebugLog();
            taskManager.addNew('subtitleEditorDebugLog', { time: 500, exe: () => this._renderDebugLog(), mode: 'timeout', count: 0 });
            taskManager.operator('subtitleEditorDebugLog', 'enabled');
        } else {
            taskManager.kill('subtitleEditorDebugLog');
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

    /** Luôn sắp xếp lại theo start tăng dần ngay trước khi render (idempotent nếu mảng đã sắp xếp
     * sẵn). Truyền `_lineCardNodesById` (Map bền vững) cho renderSubtitleLines() tự diff thay vì
     * `replaceChildren()` toàn bộ mỗi lần — cùng thuật toán renderPlaylistDiff(). `uiState.mode` có
     * 3 giá trị ('normal'/'selecting'/'editing') — core/subtitle/subtitles-ui.js tự quyết cấu trúc
     * từng card theo mode này. */
    _renderLines() {
        appState.set('_subtitles', sortSubtitlesByStart(appState.get('_subtitles'))); // core
        const mode = appState.get('_editingLineId') !== null ? 'editing' : appState.get('_isShiftSelectionMode') ? 'selecting' : 'normal';
        renderSubtitleLines(linesContainerEl, appState.get('_subtitles'), { // core/subtitle/subtitles-ui.js
            onEnterEdit: (id) => this.enterLineEditMode(id),
            onApplyEdit: (id, text) => this.applyLineEdit(id, text),
            onCancelEdit: () => this.cancelLineEdit(),
            onRemove: (id) => this._removeLine(id),
            onPlayRange: (id, startStr, endStr) => this.playLineRange(id, startStr, endStr),
            onOpenTimePicker: (id, kind, seconds) => this.openTimePickerModal(id, kind, seconds),
            onToggleSelect: (id) => this.toggleLineSelection(id),
        }, {
            mode,
            selectedIds: appState.get('_shiftSelectedIds'),
            editingId: appState.get('_editingLineId'),
            editingPendingStart: appState.get('_editingPendingStart'),
            editingPendingEnd: appState.get('_editingPendingEnd'),
        }, appState.get('_lineCardNodesById'));
        subEmptyStateEl.classList.toggle('hidden', appState.get('_subtitles').length > 0);
    },

    /** Bấm nguyên 1 card (không phải Shift-selecting, không có dòng nào khác đang sửa) -> vào "chế
     * độ sửa" cho đúng dòng đó: cho phép gõ text, hiện nút giờ start/end (mở modal bánh xe) + nút
     * ✓ Áp dụng/✕ Huỷ, và nhảy `_region` theo đúng [start,end] dòng này để có thể kéo tay cầm/
     * chốt mốc {}/nghe trực tiếp trong lúc sửa. Chặn hẳn nếu đã có dòng khác đang sửa, hoặc đang ở
     * chế độ chọn Shift (2 chế độ loại trừ nhau). */
    enterLineEditMode(id) {
        if (appState.get('_editingLineId') !== null) return; // đã có dòng khác đang sửa -> chặn
        if (appState.get('_isShiftSelectionMode')) return; // đang chọn Shift -> chặn (2 chế độ loại trừ nhau)
        const sub = appState.get('_subtitles').find((s) => s.id === id);
        if (!sub) return;
        appState.set('_editingLineId', id);
        appState.set('_editingPendingStart', sub.start);
        appState.set('_editingPendingEnd', sub.end);
        if (appState.get('_region')) appState.get('_region').setOptions({ start: sub.start, end: sub.end }); // nhảy vùng theo dòng
        appState.get('_lineCardNodesById').clear(); // đổi mode -> đổi cấu trúc MỌI card (khoá các dòng khác + hiện input/✓/✕ ở dòng đang sửa)
        this._renderLines();
        appState.set('_editingCardEl', appState.get('_lineCardNodesById').get(id)); // cache để cập nhật trực tiếp lúc kéo region
        this._updateWaveformControlsBlockState();
    },

    /** Bấm ✓ "Áp dụng" lúc đang sửa — commit CẢ text LẪN giờ PENDING (start/end đã đồng bộ qua
     * region/modal, xem _syncPendingFromRegion()/openTimePickerModal()) vào ĐÚNG dòng đang sửa,
     * rồi thoát chế độ sửa. */
    applyLineEdit(id, text) {
        if (appState.get('_editingLineId') !== id) return;
        appState.set('_subtitles', computeUpdatedSubtitles(appState.get('_subtitles'), id, { // core
            text,
            start: appState.get('_editingPendingStart'),
            end: appState.get('_editingPendingEnd'),
        }));
        this._exitLineEditMode();
    },

    /** Bấm ✕ "Huỷ" lúc đang sửa — thoát chế độ sửa, KHÔNG commit gì (mọi thay đổi PENDING mất,
     * dòng giữ nguyên giá trị CŨ trước khi bấm vào sửa). */
    cancelLineEdit() {
        this._exitLineEditMode();
    },

    _exitLineEditMode() {
        appState.set('_editingLineId', null);
        appState.set('_editingPendingStart', null);
        appState.set('_editingPendingEnd', null);
        appState.set('_editingCardEl', null);
        appState.get('_lineCardNodesById').clear(); // đổi mode -> đổi cấu trúc MỌI card, mở khoá lại các dòng khác
        this._renderLines(); // tự sort lại rồi (xem _renderLines()) — giờ vừa Apply có thể đổi thứ tự
        this._updateWaveformControlsBlockState();
    },

    /** Xoá 1 dòng phụ đề — tự dọn TRỰC TIẾP node khỏi cache/DOM ở đây luôn (không chỉ trông chờ
     * renderSubtitleLines() tự dọn qua diff) — phòng hờ mọi trường hợp lạ khác. */
    _removeLine(id) {
        appState.set('_subtitles', computeRemovedSubtitles(appState.get('_subtitles'), id)); // core
        const node = appState.get('_lineCardNodesById').get(id);
        if (node) { node.remove(); appState.get('_lineCardNodesById').delete(id); }
        this._renderLines();
    },

    /** region.on('update') (kéo tay cầm HOẶC bấm {/} — cả 2 đều đi qua region.setOptions(), cùng
     * bắn 'update') gọi hàm này khi đang sửa 1 dòng — đồng bộ ngược giờ region hiện tại vào PENDING
     * của dòng đó, cập nhật hiển thị trực tiếp (không render lại toàn bộ — 'update' bắn liên tục
     * lúc kéo, render lại mỗi lần sẽ giật/mất focus ô text đang gõ). */
    _syncPendingFromRegion() {
        if (!appState.get('_region') || appState.get('_editingLineId') === null) return;
        appState.set('_editingPendingStart', appState.get('_region').start);
        appState.set('_editingPendingEnd', appState.get('_region').end);
        if (appState.get('_editingCardEl')) {
            const startBtn = appState.get('_editingCardEl').querySelector('.sub-line-start-btn');
            const endBtn = appState.get('_editingCardEl').querySelector('.sub-line-end-btn');
            if (startBtn) startBtn.textContent = secToStr(appState.get('_editingPendingStart')); // core
            if (endBtn) endBtn.textContent = secToStr(appState.get('_editingPendingEnd')); // core
        }
    },

    /** Chặn các nút của khung điều khiển waveform lúc đang sửa 1 dòng — TRỪ 2 nút "{"/"}" (set
     * start/end = current, vẫn cần dùng để đồng bộ giờ dòng đang sửa). Play/Pause chung + "[▶]"
     * phát vùng chung + tool "Shift" đều khoá lại lúc này. */
    _updateWaveformControlsBlockState() {
        const blocked = appState.get('_editingLineId') !== null;
        [btnWaveformPlayPause, btnPlayRegionControl, btnShift].forEach((el) => {
            if (!el) return;
            el.classList.toggle('opacity-40', blocked);
            el.classList.toggle('pointer-events-none', blocked);
        });
        // "{" / "}" cố ý không đụng gì — luôn bật.
    },

    /** Modal "bánh xe cuộn số" chọn giờ start/end 1 dòng — CHỈ mở được lúc dòng đó đang ở chế độ
     * sửa (nút start/end chỉ hiện trong chế độ đó). Xác nhận -> cập nhật PENDING + đồng bộ ngược
     * vào `_region`, KHÔNG commit thẳng vào dòng (chờ bấm ✓ Áp dụng).
     *
     * TÁCH RA (18/07/2026, phản hồi Giang — "tách modal đó ra như 1 core thuần chung để tái sử
     * dụng") — cơ chế "bánh xe cuộn số" (scroll-snap, rubber-band, N cột phụ thuộc nhau theo tầng)
     * ĐÃ CHUYỂN HẲN sang `core/time-picker-modal.js::openTimePickerModal()` (DÙNG CHUNG, không
     * riêng gì Subtitle Editor nữa) — hàm NÀY giờ CHỈ còn 1 wrapper mỏng: tự tính min/max/giá trị
     * hiện tại theo SECONDS (giữ NGUYÊN cách tính cũ, KHÔNG đổi 1 chữ), quy đổi sang MILI GIÂY
     * (đơn vị canonical của modal dùng chung — xem docstring core/time-picker-modal.js), gọi modal
     * với `format: 'h-m-s-ms'` (giữ ĐÚNG 4 cột hh/mm/ss/x100ms như bản gốc), rồi convert NGƯỢC kết
     * quả (mili giây) về giây trước khi chạy lại ĐÚNG logic onConfirm cũ (cập nhật PENDING + đồng
     * bộ `_region`) — HÀNH VI ĐẦU RA ĐỐI VỚI NGƯỜI DÙNG GIỮ NGUYÊN 100%, KHÔNG đổi gì cả.
     * @param {string} subId @param {'start'|'end'} kind @param {number} currentSeconds
     */
    openTimePickerModal(subId, kind, currentSeconds) {
        if (!appState.get('_wavesurfer')) return;
        const totalDuration = appState.get('_wavesurfer').getDuration() || 0;
        // Giới hạn THẬT: start bị chặn bởi min(tổng bài hát, end PENDING hiện tại); end bị chặn
        // TRÊN bởi tổng bài hát, chặn DƯỚI bởi start PENDING hiện tại. (GIỮ NGUYÊN cách tính cũ.)
        const minAllowed = kind === 'start' ? 0 : appState.get('_editingPendingStart');
        const maxAllowed = kind === 'start' ? Math.min(totalDuration, appState.get('_editingPendingEnd')) : totalDuration;

        openTimePickerModal({ // core/time-picker-modal.js — DÙNG CHUNG
            title: kind === 'start' ? t('subtitleEditor.timePicker.titleStart') : t('subtitleEditor.timePicker.titleEnd'),
            format: 'h-m-s-ms', // GIỮ NGUYÊN 4 cột hh/mm/ss/x100ms như bản gốc (xem docstring core, 'ms' = x100ms)
            valueMs: Math.max(0, Math.round(currentSeconds * 1000)),
            minMs: Math.round(minAllowed * 1000),
            maxMs: Math.round(maxAllowed * 1000),
            rangeHintText: tFormat('subtitleEditor.timePicker.rangeHint', { min: secToStr(minAllowed), max: secToStr(maxAllowed) }),
            onConfirm: (resultMs) => {
                const seconds = resultMs / 1000;
                if (appState.get('_editingLineId') === subId) {
                    // Đang sửa ĐÚNG dòng này — chỉ cập nhật PENDING + đồng bộ NGƯỢC region (mục 5),
                    // KHÔNG commit thẳng (chờ bấm ✓ Áp dụng, xem applyLineEdit()).
                    if (kind === 'start') appState.set('_editingPendingStart', seconds); else appState.set('_editingPendingEnd', seconds);
                    if (appState.get('_region')) appState.get('_region').setOptions({ [kind]: seconds });
                    this._syncPendingFromRegion();
                }
            },
        });
    },

    // ============================== Toolbar: giữ nguyên tính năng cũ ==============================

    /** Auto-timing — 2 nhịp bấm dựa theo thời điểm phát (không dùng region). Có guard
     * `_wavesurfer` (waveform lỗi/chưa nạp xong thì bỏ qua). Icon tự đổi (idle <-> pulsing dot
     * đỏ) báo hiệu "đang ghi" — không đổi màu nền nút. Bắt đầu ghi luôn dọn sẵn
     * `_lineRangeStopHandler` còn sót từ 1 lượt bấm ▶ dòng nào đó bị ngắt giữa chừng — nếu không
     * dọn, playback tình cờ chạy ngang qua mốc `end` cũ sẽ tự pause() im lặng, ngắt ngang buổi ghi. */
    handleAutoTimingClick() {
        if (!appState.get('_wavesurfer')) return; // (A)
        if (appState.get('_autoSubStartTime') === null) {
            this._clearLineRangeStopHandler(); // (C)
            appState.set('_autoSubStartTime', appState.get('_wavesurfer').getCurrentTime());
            iconAutoTimingIdle.classList.add('hidden'); iconAutoTimingRecording.classList.remove('hidden');
        } else {
            let startTime = appState.get('_autoSubStartTime');
            let endTime = appState.get('_wavesurfer').getCurrentTime();
            if (endTime < startTime) { const tmp = startTime; startTime = endTime; endTime = tmp; }
            const newSub = createSubtitleLine(t('subtitleEditor.autoTiming.defaultText'), startTime, endTime); // core
            appState.set('_subtitles', sortSubtitlesByStart([...appState.get('_subtitles'), newSub])); // core
            this._resetAutoTiming();
            this._renderLines();
        }
    },

    _resetAutoTiming() {
        appState.set('_autoSubStartTime', null);
        iconAutoTimingRecording.classList.add('hidden'); iconAutoTimingIdle.classList.remove('hidden');
    },

    /** "+ Thêm dòng" — nối sau dòng cuối +2s — GIỮ NGUYÊN hành vi cũ (KHÔNG dùng region, xem
     * createLineFromSelection() bên dưới cho tool MỚI dùng region). */
    /** SỬA (yêu cầu Giang) — khoảng cách tối thiểu 1s giữa start dòng MỚI và end dòng CUỐI hiện có
     * (trước đây chỉ +0.1s, quá sát — 2 dòng liền kề gần như dính nhau). */
    addNewLine() {
        const list = appState.get('_subtitles');
        const last = list[list.length - 1];
        const startSec = last ? last.end + 1 : 0;
        const newSub = createSubtitleLine(t('subtitleEditor.newLine.defaultText'), startSec, startSec + 2); // core
        appState.set('_subtitles', [...appState.get('_subtitles'), newSub]); // đã ở cuối mảng, không cần sort lại
        this._renderLines();
        this._scrollLineIntoView(newSub.id); // cuộn tới đúng dòng vừa thêm, khỏi phải tự cuộn tay
    },

    importSrtFile(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            appState.set('_subtitles', sortSubtitlesByStart(parseSRT(evt.target.result))); // core
            this._renderLines();
        };
        reader.readAsText(file);
    },

    async exportSrt() {
        if (appState.get('_subtitles').length === 0) { await alertModal(t('common.subtitle.exportEmpty')); return; }
        const srt = buildSRTString(appState.get('_subtitles')); // core
        const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${appState.get('_record').tag?.title || appState.get('_songKey')}.srt`; a.click();
        URL.revokeObjectURL(url);
    },

    // ============================== Toolbar: MỚI (yêu cầu Giang) ==============================

    /** "Lấy giờ từ vùng chọn" — tạo dòng MỚI từ appState.get('_region') hiện tại (KHÁC "+ Thêm dòng" — hàm đó
     * vẫn nối sau dòng cuối, hàm này lấy ĐÚNG mốc đang kéo trên waveform). */
    createLineFromSelection() {
        if (!appState.get('_region')) return;
        const newSub = createSubtitleLine(t('subtitleEditor.newLine.defaultText'), appState.get('_region').start, appState.get('_region').end); // core
        appState.set('_subtitles', sortSubtitlesByStart([...appState.get('_subtitles'), newSub])); // core
        this._renderLines();
        this._scrollLineIntoView(newSub.id); // cuộn tới đúng dòng vừa thêm, khỏi phải tự cuộn tay
    },

    /** Cuộn danh sách dòng phụ đề tới ĐÚNG 1 dòng theo id — dùng ngay sau khi thêm dòng mới
     * (addNewLine()/createLineFromSelection()) để người dùng khỏi phải tự cuộn tay tìm dòng vừa
     * thêm, đặc biệt khi danh sách dài và dòng mới nằm giữa sau khi sort lại theo start. Gọi SAU
     * _renderLines() (cần node đã dựng xong trong _lineCardNodesById). */
    _scrollLineIntoView(id) {
        const node = appState.get('_lineCardNodesById').get(id);
        if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    /** "▶ Phát vùng chọn" — dùng CHUNG lõi `_togglePlayRange()` (mục 1: nút ▶ mỗi dòng phụ đề CŨNG
     * dùng đúng lõi này — hành vi toggle giống hệt nhau ở mọi nơi). */
    playSelection() {
        if (!appState.get('_region')) return;
        this._togglePlayRange(appState.get('_region').start, appState.get('_region').end, null); // null = "vùng chọn chung", KHÁC 1 dòng cụ thể
    },

    /** "Split": mở modal hỏi số dòng (x) muốn chia appState.get('_region') hiện tại thành. Dựng modal riêng
     * (không dùng modalChoice() vì cần ô nhập số) nhưng giữ cùng khuôn hình overlay/card/nút. Cần
     * `_region` tồn tại — nếu waveform lỗi/chưa nạp xong, im lặng không mở gì. */
    openSplitModal() {
        if (!appState.get('_region')) return;

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
        descEl.textContent = tFormat('subtitleEditor.split.desc', { start: secToStr(appState.get('_region').start), end: secToStr(appState.get('_region').end) }); // core secToStr
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

    /** Chia ĐỀU appState.get('_region') hiện tại thành `count` dòng phụ đề LIỀN NHAU (dòng sau nối đúng mốc
     * dòng trước, không hở/không đè) — text để RỖNG, placeholder có sẵn của textarea tự hiện (xem
     * core/subtitle/subtitles-ui.js), Giang tự gõ lời vào từng dòng sau khi chia. Dòng CUỐI lấy
     * ĐÚNG `_region.end` (không tính bằng cộng dồn perLine) để né sai số cộng dồn số thực. */
    _splitRegionIntoLines(count) {
        if (!appState.get('_region')) return;
        const totalStart = appState.get('_region').start;
        const totalEnd = appState.get('_region').end;
        const perLine = (totalEnd - totalStart) / count;
        const newLines = [];
        for (let i = 0; i < count; i++) {
            const start = totalStart + perLine * i;
            const end = i === count - 1 ? totalEnd : totalStart + perLine * (i + 1);
            newLines.push(createSubtitleLine('', start, end)); // core — text rỗng, placeholder tự hiện
        }
        appState.set('_subtitles', sortSubtitlesByStart([...appState.get('_subtitles'), ...newLines])); // core
        this._renderLines();
    },

    /** Play/Pause CHUẨN của waveform tại vị trí con trỏ hiện tại, KHÁC "Phát vùng chọn" (nút đó
     * luôn phát đúng `_region`). Icon tự đổi qua sự kiện 'play'/'pause' đăng ký ở
     * _initWaveform(). Dọn `_lineRangeStopHandler` còn sót TRƯỚC KHI toggle — bấm nút play/pause
     * chính nghĩa là đang chủ động điều khiển, không còn liên quan 1 lượt nghe thử ▶ dòng dở dang. */
    togglePlayPause() {
        if (!appState.get('_wavesurfer')) return;
        this._clearLineRangeStopHandler();
        // playPause() có thể gọi .play() nội bộ, có thể bị reject nếu va chạm 1 lượt pause() vừa xảy ra.
        const result = appState.get('_wavesurfer').playPause();
        if (result && typeof result.catch === 'function') {
            result.catch((err) => console.warn('[subtitle-editor] playPause() bị reject:', err));
        }
    },

    /** Nút ▶ mỗi dòng phụ đề dùng chung `_togglePlayRange()` với "Phát vùng chọn" — cùng hành vi
     * toggle (bấm lại lúc đang phát đúng dòng này = dừng; bấm sau khi dừng/hết end = luôn phát lại
     * từ đầu dòng). Nếu dòng NÀY đang được sửa (`_editingLineId === id`), luôn ưu tiên đọc
     * `_editingPendingStart/End` (state sống, luôn đúng) thay vì startStr/endStr truyền vào
     * (đóng gói closure lúc dựng card, có thể đã cũ nếu dòng vừa được kéo/sửa sau đó). */
    playLineRange(id, startStr, endStr) {
        if (!appState.get('_wavesurfer')) return;
        let start, end;
        if (appState.get('_editingLineId') === id) {
            start = appState.get('_editingPendingStart');
            end = appState.get('_editingPendingEnd');
        } else {
            start = strToSec(startStr); // core
            end = strToSec(endStr); // core
        }
        if (end <= start) return; // giờ dòng không hợp lệ (end <= start) -> không phát gì, tránh phát ngược/vô hạn
        this._togglePlayRange(start, end, id);
    },

    /** Toggle dùng chung cho mọi nơi cần "phát [start,end] rồi tự dừng, bấm lại lúc đang phát đúng
     * cùng 1 nguồn = dừng, bấm sau khi dừng = luôn phát lại từ đầu": "Phát vùng chọn"/"[▶]" khung
     * điều khiển (`lineId = null`) VÀ ▶ mỗi dòng phụ đề (`lineId = id` dòng đó). */
    _togglePlayRange(start, end, lineId) {
        if (appState.get('_isPlayingRegion') && appState.get('_activePlaybackLineId') === lineId && appState.get('_wavesurfer').isPlaying()) {
            appState.get('_wavesurfer').pause();
            this._clearLineRangeStopHandler(); // tự reset state + icon
            return;
        }
        this._playRangeAndStop(start, end, lineId);
    },

    /** Lõi dùng chung cho mọi chỗ cần "phát đúng [start,end] rồi tự dừng" (▶ mỗi dòng phụ đề,
     * "Phát vùng chọn", nút "[▶]" khung điều khiển). `play(start, end)` của WaveSurfer KHÔNG đảm
     * bảo tự seek tới `start` (chỉ `end` chắc chắn dùng để biết lúc nào dừng) — tự `setTime(start)`
     * tường minh trước, rồi mới `.play()`.
     * @param {number} start @param {number} end @param {string|null} lineId null = "vùng chọn
     *   chung", id = 1 dòng cụ thể — dùng để cập nhật icon đúng nơi. */
    _playRangeAndStop(start, end, lineId = null) {
        this._clearLineRangeStopHandler(); // dọn state CŨ trước (reset _activePlaybackLineId về null)
        appState.set('_isPlayingRegion', true);
        appState.set('_activePlaybackLineId', lineId); // gán SAU khi _clearLineRangeStopHandler() đã reset xong
        appState.set('_lineRangeStopHandler', (currentTime) => {
            if (currentTime >= end) {
                appState.get('_wavesurfer').pause();
                this._clearLineRangeStopHandler();
            }
        });
        appState.get('_wavesurfer').on('timeupdate', appState.get('_lineRangeStopHandler'));
        // Gộp 2 lớp xác minh: (1) _seekWithRetry() đảm bảo seek tới `start` thật sự ăn trước khi
        // phát (cùng gốc bug với seekFromClick()); (2) _startPlaybackWithRetry() đảm bảo .play()
        // thật sự chạy sau đó. Chỉ gọi play() sau khi seek đã xác nhận xong.
        this._seekWithRetry(start, 3, () => this._startPlaybackWithRetry(lineId, start, 3));
    },

    /** Gọi `.play()` — bắt Promise reject VÀ xác minh THẬT (đọc lại `getCurrentTime()` sau 150ms,
     * so với `start` — chỉ đúng khi play() chưa từng chạy được tí nào, không nhầm với "đã chạy
     * xong") — tự thử lại tới `attemptsLeft` lần. Điều kiện dừng thử lại cần CẢ HAI:
     * `this._activePlaybackLineId === lineId` (người dùng chưa đổi ý) VÀ `this._isPlayingRegion`
     * (cờ riêng, về false ngay khi dừng dù vì lý do gì) — chỉ dùng `lineId` không đủ vì `null`
     * vừa là "vùng chọn chung" vừa là giá trị reset sau khi phát xong, dễ nhầm 2 tình huống. */
    _startPlaybackWithRetry(lineId, start, attemptsLeft) {
        if (!appState.get('_wavesurfer')) return;
        let retried = false; // dedupe — .catch() VÀ lưới xác minh setTimeout có thể CÙNG muốn thử lại, chỉ cho phép 1 lần
        const playResult = appState.get('_wavesurfer').play();
        const retryIfStillWanted = (err) => {
            if (retried) return;
            retried = true;
            if (err) console.warn('[subtitle-editor] play() bị reject/chưa thật sự chạy — thử lại:', err);
            if (attemptsLeft <= 0) return;
            taskManager.once(() => {
                const stillWanted = appState.get('_activePlaybackLineId') === lineId && appState.get('_isPlayingRegion'); // vẫn ĐÚNG phiên phát này, chưa bị hành động khác/tự dừng xong "cướp"
                const neverActuallyStarted = appState.get('_wavesurfer') && !appState.get('_wavesurfer').isPlaying() && appState.get('_wavesurfer').getCurrentTime() <= start + 0.05; // CHƯA TỪNG nhích lên khỏi start — không thể nhầm với "đã chạy xong"
                if (stillWanted && neverActuallyStarted) this._startPlaybackWithRetry(lineId, start, attemptsLeft - 1);
            }, 120);
        };
        if (playResult && typeof playResult.catch === 'function') playResult.catch(retryIfStillWanted);
        // Lưới xác minh BỔ SUNG — kể cả khi playResult "resolve" (không reject gì) — vẫn tự kiểm
        // tra THẬT xem đã phát chưa, chưa thì coi như thất bại âm thầm và thử lại.
        taskManager.once(() => {
            const stillWanted = appState.get('_activePlaybackLineId') === lineId && appState.get('_isPlayingRegion');
            const neverActuallyStarted = appState.get('_wavesurfer') && !appState.get('_wavesurfer').isPlaying() && appState.get('_wavesurfer').getCurrentTime() <= start + 0.05;
            if (stillWanted && neverActuallyStarted) retryIfStillWanted(null);
        }, 150);
    },

    /** Gỡ sạch listener 'timeupdate' đang canh dừng 1 lượt nghe thử (nếu có) — gọi trước mọi hành
     * động phát lại độc lập khác. Luôn reset `_isPlayingRegion`/`_activePlaybackLineId` + icon (cả
     * control bar và dòng đang phát nếu có) mỗi khi bị gỡ, bất kể lý do. */
    _clearLineRangeStopHandler() {
        if (appState.get('_lineRangeStopHandler')) {
            appState.get('_wavesurfer').un('timeupdate', appState.get('_lineRangeStopHandler'));
            appState.set('_lineRangeStopHandler', null);
        }
        appState.set('_isPlayingRegion', false);
        this._updatePlaybackIcons(); // cập nhật TRƯỚC KHI xoá _activePlaybackLineId, để còn tìm đúng card mà tắt icon
        appState.set('_activePlaybackLineId', null);
    },

    /** Đổi icon "[▶]"/"[⏸]" ở khung điều khiển (khi đang phát vùng chung, `_activePlaybackLineId
     * === null`) và icon ▶/⏸ của đúng 1 dòng đang phát (qua `_lineCardNodesById`, không render lại
     * toàn bộ). Không dùng sự kiện 'play'/'pause' chung của WaveSurfer — sự kiện đó bắn cho mọi
     * kiểu phát, không phân biệt được "đang phát vùng/dòng bị chặn ở end" khỏi phát chung. */
    _updatePlaybackIcons() {
        const isActive = appState.get('_isPlayingRegion') && appState.get('_wavesurfer') && appState.get('_wavesurfer').isPlaying();
        const isRegionActive = isActive && appState.get('_activePlaybackLineId') === null;
        if (iconPlayRegionPlay && iconPlayRegionPause) {
            iconPlayRegionPlay.classList.toggle('hidden', isRegionActive);
            iconPlayRegionPause.classList.toggle('hidden', !isRegionActive);
        }
        if (appState.get('_activePlaybackLineId') !== null) {
            const card = appState.get('_lineCardNodesById').get(appState.get('_activePlaybackLineId'));
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

    /** Đặt appState.get('_region').start = vị trí phát hiện tại (getCurrentTime()) — "chốt mốc" thay thế kéo
     * tay cầm. Nếu current vẫn < end -> chỉ đổi start. Nếu current >= end (vị trí đang nghe nằm sau
     * end hiện tại) -> hoán đổi thông minh: end cũ thành start mới, current thành end mới — luôn ra
     * 1 region hợp lệ, không bao giờ im lặng từ chối. */
    setRegionStartToCurrentTime() {
        if (!appState.get('_region') || !appState.get('_wavesurfer')) return;
        const current = appState.get('_wavesurfer').getCurrentTime();
        if (current < appState.get('_region').end) {
            appState.get('_region').setOptions({ start: current });
        } else {
            appState.get('_region').setOptions({ start: appState.get('_region').end, end: current });
        }
        this._updateRegionTimeDisplay();
        // Không lệ thuộc vào sự kiện 'update' của region để đồng bộ ngược vào dòng đang sửa (không
        // có gì đảm bảo setOptions() luôn bắn 'update' đồng bộ hệt lúc kéo tay) — gọi trực tiếp.
        this._syncPendingFromRegion();
    },

    /** Đối xứng với setRegionStartToCurrentTime() ở trên — current <= start hiện tại (bấm "chốt
     * end" nhưng vị trí đang nghe lại NẰM TRƯỚC start hiện tại) -> HOÁN ĐỔI: start CŨ thành end
     * MỚI, current thành start MỚI. */
    setRegionEndToCurrentTime() {
        if (!appState.get('_region') || !appState.get('_wavesurfer')) return;
        const current = appState.get('_wavesurfer').getCurrentTime();
        if (current > appState.get('_region').start) {
            appState.get('_region').setOptions({ end: current });
        } else {
            appState.get('_region').setOptions({ start: current, end: appState.get('_region').start });
        }
        this._updateRegionTimeDisplay();
        this._syncPendingFromRegion(); // FIX (yêu cầu Giang, mục 1) — cùng lý do ở trên
    },

    // ============================== Toolbar: MỚI — tool "Cut MP3" (yêu cầu Giang, mục 1) ==============================

    /** Bấm "Cut" — cắt ĐÚNG đoạn appState.get('_region') hiện tại thành 1 file .mp3 thật, xong hiện modal 3
     * lựa chọn (modalChoice() có sẵn, core/modal-choice-ui.js) Huỷ/Tải xuống/Chèn. Tự khoá nút trong
     * lúc mã hoá (đề phòng bấm chồng — mã hoá lamejs chạy đồng bộ, chặn main thread 1 lúc tuỳ độ
     * dài vùng chọn). */
    async cutMp3FromRegion() {
        if (!appState.get('_region') || !appState.get('_wavesurfer')) return;
        if (btnCutMp3.dataset.busy === '1') return;
        btnCutMp3.dataset.busy = '1';
        btnCutMp3.classList.add('opacity-40', 'pointer-events-none');
        try {
            // Nhường 1 khung hình cho trình duyệt VẼ XONG trạng thái "đang xử lý" (mờ nút) TRƯỚC
            // khi bắt đầu việc mã hoá đồng bộ nặng — không làm vậy, nút sẽ trông như "không phản
            // hồi" suốt lúc mã hoá vì main thread bận, không kịp repaint.
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const blob = await this._encodeMp3FromRegion(appState.get('_region').start, appState.get('_region').end);
            this._showCutResultModal(blob);
        } catch (err) {
            console.error('[subtitle-editor] Cắt MP3 thất bại:', err);
            await alertModal(t('subtitleEditor.cutMp3.error')); // core/modal-choice-ui.js
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
        const buffer = appState.get('_wavesurfer').getDecodedData();
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

    /** Modal 3 lựa chọn sau khi cắt xong — TÁI DÙNG modalChoice() có sẵn (core/modal-choice-ui.js,
     * đúng yêu cầu Giang "modal choice") thay vì dựng modal riêng như Split/Shift (ở đây chỉ cần
     * chọn 1 trong 3 nút, không cần input gì thêm — modalChoice() vừa khớp, không cần viết thêm). */
    _showCutResultModal(blob) {
        const startStr = secToStr(appState.get('_region').start); // core
        const endStr = secToStr(appState.get('_region').end); // core
        const baseTitle = appState.get('_record').tag?.title || appState.get('_songKey');
        const fileName = `${baseTitle} [cut ${startStr} - ${endStr}].mp3`.replace(/[:,]/g, '-');

        modalChoice( // core/modal-choice-ui.js
            tFormat('subtitleEditor.cutMp3.resultDesc', { start: startStr, end: endStr }),
            [
                { label: t('subtitleEditor.cutMp3.download'), onClick: () => this._downloadCutBlob(blob, fileName) },
                { label: t('subtitleEditor.cutMp3.insert'), onClick: () => this._insertCutBlobAsNewSong(blob, fileName) },
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

    /** "Chèn" — thêm đoạn vừa cắt vào thư viện như 1 bài hát mới, tách biệt khỏi bài gốc (record
     * riêng, key riêng) — tái dùng resolveSongKey()/setSongRecord() (service/db.js) để key luôn
     * nhất quán. Không cần tự thêm vào playlistOrder — initPlaylistFromDB() coi store `songs` là
     * chân lý duy nhất, tự quét lại khi index.html mở, bài mới sẽ tự xuất hiện. */
    async _insertCutBlobAsNewSong(blob, fileName) {
        const key = await resolveSongKey(fileName); // service/db.js
        const baseTitle = appState.get('_record').tag?.title || appState.get('_songKey');
        const record = {
            filename: fileName,
            blob,
            tag: {
                title: tFormat('subtitleEditor.cutMp3.newSongTitle', { title: baseTitle }),
                artist: appState.get('_record').tag?.artist || '',
                album: appState.get('_record').tag?.album || '',
            },
            cover: appState.get('_record').cover || null,
            subtitles: [],
            duration: appState.get('_region').end - appState.get('_region').start,
            addedAt: Date.now(),
        };
        await setSongRecord(key, record); // service/db.js
        await alertModal(t('subtitleEditor.cutMp3.inserted')); // core/modal-choice-ui.js
    },

    // ============================== Toolbar: MỚI — tool "Shift" (yêu cầu Giang, mục 5) ==============================

    /** Bấm nút "Shift" trên thanh công cụ — bật/tắt "chế độ chọn dòng" để dịch giờ hàng loạt. Thoát
     * chế độ (tắt) luôn xoá sạch lựa chọn cũ. Đổi hẳn cấu trúc của mọi card (có/không ô tròn chọn)
     * nên phải xoá sạch cache, ép dựng lại toàn bộ danh sách. Chặn hẳn nếu đang sửa 1 dòng (2 chế
     * độ loại trừ nhau). */
    toggleShiftSelectionMode() {
        if (appState.get('_editingLineId') !== null) return;
        appState.set('_isShiftSelectionMode', !appState.get('_isShiftSelectionMode'));
        if (!appState.get('_isShiftSelectionMode')) appState.set('_shiftSelectedIds', new Set());
        appState.get('_lineCardNodesById').clear();
        this._renderLines();
        this._renderShiftBar();
    },

    /** Bấm NGUYÊN 1 card lúc đang ở chế độ chọn dòng — thêm/bớt khỏi tập đang chọn.
     * MỚI (yêu cầu Giang, mục 7) — CHỈ card của ĐÚNG dòng vừa bấm cần dựng lại (đổi ô tròn chọn +
     * nền highlight) — các dòng khác giữ nguyên card cũ. */
    toggleLineSelection(id) {
        if (appState.get('_shiftSelectedIds').has(id)) appState.get('_shiftSelectedIds').delete(id);
        else appState.get('_shiftSelectedIds').add(id);
        appState.get('_lineCardNodesById').delete(id);
        this._renderLines();
        this._renderShiftBar();
    },

    /** Cập nhật thanh "N dòng đã chọn — Huỷ/Tiếp tục" phía trên thanh công cụ (subtitle-editor.html
     * #shift-selection-bar) — hiện/ẩn theo `_isShiftSelectionMode`, disable "Tiếp tục" nếu chưa
     * chọn dòng nào (chọn 0 dòng thì không có gì để dịch giờ). */
    _renderShiftBar() {
        shiftSelectionBarEl.classList.toggle('hidden', !appState.get('_isShiftSelectionMode'));
        shiftSelectionCountEl.textContent = tFormat('subtitleEditor.shift.selectedCount', { n: appState.get('_shiftSelectedIds').size });
        const hasSelection = appState.get('_shiftSelectedIds').size > 0;
        btnShiftContinue.disabled = !hasSelection;
        btnShiftContinue.classList.toggle('opacity-40', !hasSelection);
    },

    /** Mở modal nhập số giây dịch (+/-) + chọn áp dụng cho start/end/cả 2 — dựng RIÊNG (không dùng
     * modalChoice() — cần ô số + 3 lựa chọn không phải dạng "chọn 1 trong N nút đơn thuần"), giữ
     * CÙNG khuôn hình overlay/card như openSplitModal()/openTimePickerModal() cho đồng bộ. */
    openShiftModal() {
        if (appState.get('_shiftSelectedIds').size === 0) return;

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
        descEl.textContent = tFormat('subtitleEditor.shift.modalDesc', { n: appState.get('_shiftSelectedIds').size });
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
        appState.set('_subtitles', shiftSubtitleTimes(appState.get('_subtitles'), appState.get('_shiftSelectedIds'), amountSec, target)); // core
        appState.set('_isShiftSelectionMode', false);
        appState.set('_shiftSelectedIds', new Set());
        appState.get('_lineCardNodesById').clear();
        this._renderLines(); // tự sort lại rồi (xem _renderLines())
        this._renderShiftBar();
    },

    // ============================== Lưu / điều hướng ==============================

    /** Nút "Lưu" — ghi xuống IndexedDB NGAY (KHÔNG tự điều hướng đi đâu — tách biệt "lưu" và
     * "rời trang", đúng yêu cầu Giang thêm nút "←" RIÊNG). Cùng fix round-trip blob đã áp dụng ở
     * applySongEditAndSave()/applySubtitlesAndClose() cũ (xem rematerializeBlob(), service/db.js). */
    async saveToDatabase() {
        const record = await getSongRecord(appState.get('_songKey')); // service/db.js
        if (!record) return;
        record.subtitles = appState.get('_subtitles').slice();
        if (record.blob) record.blob = await rematerializeBlob(record.blob); // service/db.js
        await setSongRecord(appState.get('_songKey'), record); // service/db.js
        await alertModal(t('subtitleEditor.saved'));
    },

    /** Nút "←" quay lại playlist: (1) lưu cờ `sav_editingSubtitle` + key bài `sav_scrollToSongKey`
     * vào localStorage để index.html tự cuộn tới đúng bài vừa sửa (xem scrollToSongIfPending(),
     * core/playlist/render.js). (2) Điều hướng bằng `location.href` (KHÔNG dùng `history.back()`,
     * vì bfcache có thể phục vụ lại snapshot cũ mà không chạy lại boot sequence, khiến
     * scrollToSongIfPending() không bao giờ chạy) — `location.href` luôn ép tải trang mới. */
    back() {
        taskManager.kill('subtitleEditorDebugLog'); // dọn tay, dù rời trang cũng huỷ JS context (kill() tự no-op an toàn nếu task không tồn tại/chưa từng chạy)
        if (appState.get('_songKey')) {
            localStorage.setItem('sav_editingSubtitle', 'true');
            localStorage.setItem('sav_scrollToSongKey', appState.get('_songKey'));
        }
        window.location.href = 'index.html';
    },

    /** MỚI (yêu cầu Giang) — nút tải lại KHÔNG dùng cache. Hỏi xác nhận trước (modalChoice() có
     * sẵn, core/modal-choice-ui.js) vì `this._subtitles` là mảng làm việc TRONG BỘ NHỚ — CHƯA CHẮC đã
     * ghi xuống IndexedDB (bấm "Lưu" mới ghi thật, xem saveToDatabase()) — tải lại mà chưa Lưu sẽ
     * MẤT mọi chỉnh sửa dở dang, cần cảnh báo rõ trước khi làm. */
    reloadWithoutCache() {
        modalChoice( // core/modal-choice-ui.js
            t('subtitleEditor.reloadConfirm.desc'),
            [
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

    /** 2 nút mũi tên cuộn thanh công cụ (`#toolbar-scroll-container`). Gọi 2 hàm Core nối tiếp:
     * `getStepScrollTarget()` (tính, thuần) rồi `scrollSliderTo()` (hành động) — Workflow không tự
     * chứa phép tính nghiệp vụ nào. @param {'left'|'right'} direction */
    scrollToolbar(direction) {
        if (!toolbarScrollContainerEl) return;
        const target = getStepScrollTarget(toolbarScrollContainerEl, direction); // core/slider-panel-scroll.js
        scrollSliderTo(toolbarScrollContainerEl, target, true); // core/slider-panel-scroll.js
    },
};
