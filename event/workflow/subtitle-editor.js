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
            onOpenKaraoke: (id) => this.openKaraokeDrawer(id),
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
        const changes = {
            text,
            start: appState.get('_editingPendingStart'),
            end: appState.get('_editingPendingEnd'),
        };
        // MỚI (17/09/2026, yêu cầu Giang mục 4, tính năng karaoke) — sửa text làm SỐ TỪ hoặc NỘI
        // DUNG từ đổi khác `karaoke` đã lưu -> reset về null (rơi về chia đều lúc mở drawer timing
        // lại lần sau, xem openKaraokeDrawer()) — GIỮ NGUYÊN nếu vẫn khớp (vd chỉ sửa giờ start/end,
        // không đụng chữ).
        const current = appState.get('_subtitles').find((s) => s.id === id);
        if (current && current.karaoke && !isKaraokeMatchingText(current.karaoke, text)) changes.karaoke = null; // core
        // SỬA (30/09/2026) — chữ vẫn khớp nhưng giờ start/end đổi -> co/giãn karaoke theo thời lượng MỚI
        // (trước đây giữ nguyên tổng ms cũ -> lệch dòng). Dòng không có karaoke / vừa reset null -> core bỏ qua.
        const updated = computeUpdatedSubtitles(appState.get('_subtitles'), id, changes); // core
        appState.set('_subtitles', fitSubtitlesKaraokeToDuration(updated, new Set([id]))); // core/subtitle/subtitle-karaoke.js
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
            this._scrollLineIntoView(newSub.id); // SỬA (17/09/2026) — thiếu dòng này, khác addNewLine()/createLineFromSelection() (đều có gọi)
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

    /** SỬA (30/09/2026) — nhập .srt THAY TOÀN BỘ danh sách: trước đây nếu đang sửa 1 dòng (hoặc đang
     * chọn Shift) lúc nhập, `_editingLineId` vẫn trỏ tới dòng CŨ đã biến mất -> mọi dòng MỚI dựng ở
     * trạng thái "bị khoá bởi dòng khác đang sửa" (mờ, không bấm được) mà không còn nút ✓/✕ nào để
     * thoát — kẹt cứng tới khi tải lại trang. Giờ thoát sạch 2 chế độ đó trước khi dựng lại. */
    importSrtFile(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            appState.set('_subtitles', sortSubtitlesByStart(parseSRT(evt.target.result))); // core
            appState.set('_editingLineId', null);
            appState.set('_editingPendingStart', null);
            appState.set('_editingPendingEnd', null);
            appState.set('_editingCardEl', null);
            appState.set('_isShiftSelectionMode', false);
            appState.set('_shiftSelectedIds', new Set());
            appState.get('_lineCardNodesById').clear();
            this._renderLines();
            this._renderShiftBar();
            this._updateWaveformControlsBlockState();
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

    // ============================== Karaoke (MỚI, 17/09/2026, yêu cầu Giang) ==============================
    // Nút "kr" mỗi dòng (core/subtitle/subtitles-ui.js::buildLineCard()) -> Generic Drawer (PORT từ
    // index.html, xem subtitle-editor.html) hiện 1 waveform mini CHỈ vùng audio dòng đó + danh sách
    // từ/ms/nút nghe riêng. Kéo mốc chia trên waveform HOẶC gõ số ms trực tiếp đều quy về CÙNG 1 lõi
    // THUẦN redistributeKaraokeBoundary() (core/subtitle/subtitle-karaoke.js) — kiểu Aegisub: chỉnh
    // 1 mốc CHỈ đổi 2 từ liền kề, tổng ms luôn = tổng thời lượng dòng, không cần Apply mới thấy.
    // Bấm "Áp dụng" mới ghi vào field `karaoke` của dòng (mảng cặp [[từ,ms],...], xem
    // core/subtitle/subtitle-karaoke.js) — CHƯA ghi DB thật (như applyLineEdit(), chờ nút "Lưu").

    /** Mở drawer — dòng chưa có chữ (không có từ nào để timing) thì báo lỗi thay vì mở trống. Có
     * `sub.karaoke` sẵn VÀ vẫn khớp text hiện tại (isKaraokeMatchingText()) -> đọc thẳng vào làm
     * việc; ngược lại (chưa timing lần nào, hoặc timing cũ đã lệch sau khi sửa text — xem
     * applyLineEdit()) -> chia đều mặc định.
     * SỬA (30/09/2026): (1) timing đã lưu nhưng tổng ms lệch thời lượng dòng (dữ liệu cũ, trước khi
     * applyLineEdit()/_applyShift() biết co/giãn) -> co/giãn cho khớp ngay lúc mở, không để mốc chia
     * vượt khỏi dòng; (2) dừng mọi phát trên waveform CHÍNH — nghe trong drawer chỉ chạy trên waveform
     * mini, không để 2 nguồn phát chồng nhau. */
    openKaraokeDrawer(id) {
        const found = appState.get('_subtitles').find((s) => s.id === id);
        if (!found) return;
        const sub = fitSubtitlesKaraokeToDuration([found], new Set([id]))[0]; // core — chỉ đọc, không ghi ngược vào _subtitles
        const durationMs = Math.round((sub.end - sub.start) * 1000);
        const words = (Array.isArray(sub.karaoke) && isKaraokeMatchingText(sub.karaoke, sub.text)) // core
            ? karaokeArrayToWorkingWords(sub.karaoke) // core
            : buildDefaultKaraokeWordMs(sub.text, durationMs); // core
        if (words.length === 0) {
            alertModal(t('subtitleEditor.karaoke.noWords')); // core/modal-choice-ui.js
            return;
        }
        this._stopMainPlayback();
        appState.set('_karaokeEditingLineId', id);
        appState.set('_karaokeWords', words);
        appState.set('_karaokeLineStart', sub.start);
        appState.set('_karaokeLineEnd', sub.end);
        this._renderKaraokeDrawer();
    },

    /** MỚI (30/09/2026) — dừng hẳn phát trên waveform CHÍNH (kể cả lượt ▶ dòng/vùng đang canh dừng ở
     * end) — dùng lúc mở drawer karaoke + lúc bấm ▶ 1 từ trong drawer. */
    _stopMainPlayback() {
        const main = appState.get('_wavesurfer');
        if (!main) return;
        this._clearLineRangeStopHandler();
        if (main.isPlaying()) main.pause();
    },

    /** Dựng header+body Generic Drawer từ `_karaokeWords` hiện tại — CHỈ gọi lúc MỞ drawer (dựng lại
     * DOM + tạo lại WaveSurfer mini, quá nặng cho mỗi lần kéo/gõ); kéo/gõ tự vá DOM trực tiếp qua
     * _syncKaraokeWordInputs()/_renderKaraokeRegions(). */
    _renderKaraokeDrawer() {
        const config = {
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: renderKaraokeDrawerHeader(), // components/subtitle-karaoke-drawer.js
            bodyHtml: renderKaraokeDrawerBody(appState.get('_karaokeWords'), this._isKaraokeLineApplied()), // components/subtitle-karaoke-drawer.js
            bodyClass: 'overflow-y-auto',
        };
        if (genericDrawerPanel.classList.contains('hidden')) {
            workflowGenericDrawerHelpers.open(config); // event/workflow/generic-drawer-helpers.js — SỬA 24/09/2026: lối mở/thay DUY NHẤT
        } else {
            workflowGenericDrawerHelpers.update(config); // co/giãn chiều cao
        }
        this._wireKaraokeDrawer();
        this._initKaraokeMiniWaveform();
    },

    /** MỚI (30/09/2026) — dòng đang mở drawer CÓ karaoke đã Áp dụng chưa (quyết định hiện nút "Bỏ áp
     * dụng") — CÙNG điều kiện dấu tích xanh ở nút "kr" (core/subtitle/subtitles-ui.js::buildLineCard()). */
    _isKaraokeLineApplied() {
        const id = appState.get('_karaokeEditingLineId');
        const sub = appState.get('_subtitles').find((s) => s.id === id);
        return !!sub && Array.isArray(sub.karaoke) && sub.karaoke.length > 0;
    },

    /** Generic Drawer KHÔNG biết nội dung là gì (component chỉ trả string) — tự querySelector +
     * addEventListener NGAY SAU khi gán HTML, CÙNG khuôn mọi feature Generic Drawer khác (xem
     * docstring core/generic-drawer.js + event/workflow/eq-presets.js::_wireListView()). */
    _wireKaraokeDrawer() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeKaraokeDrawer());

        const applyBtn = genericDrawerBody.querySelector('#karaoke-drawer-apply');
        if (applyBtn) applyBtn.addEventListener('click', () => this.applyKaraokeDrawer());

        const unapplyBtn = genericDrawerBody.querySelector('#karaoke-drawer-unapply'); // chỉ có khi dòng đang có karaoke
        if (unapplyBtn) unapplyBtn.addEventListener('click', () => this.unapplyKaraokeDrawer());

        // Ô ms gõ tay — nghe 'change' (chỉ chạy lúc rời focus/Enter), KHÔNG 'input' (mỗi phím gõ) —
        // tránh giành giật giá trị/kẹp lại NGAY trong lúc người dùng còn đang gõ dở.
        genericDrawerBody.querySelectorAll('[data-karaoke-word-ms]').forEach((input) => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.karaokeWordMs, 10);
                const newMs = parseInt(e.target.value, 10);
                if (isNaN(index)) return;
                this._onKaraokeWordMsChange(index, newMs);
            });
        });

        genericDrawerBody.querySelectorAll('[data-karaoke-word-play]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.karaokeWordPlay, 10);
                if (!isNaN(index)) this._toggleKaraokeWordPlay(index);
            });
        });

        // MỚI (30/09/2026, lần 3) — thanh trượt cuộn ẢO waveform mini (chỉ hiện với dòng dài, xem _setupKaraokeMiniScroll()).
        const scrollSlider = genericDrawerBody.querySelector('#karaoke-mini-scroll');
        if (scrollSlider) scrollSlider.addEventListener('input', (e) => this._onKaraokeMiniScrollInput(parseInt(e.target.value, 10) || 0));
    },

    /** VIẾT LẠI (30/09/2026, Giang báo "Unable to load the mini waveform" + "play của word chỉ được
     * play ở mini waveform này"; SỬA LẦN 2 cùng ngày: phát từ bằng Web Audio, chỉ bôi xanh vùng phát,
     * chữ nằm TRONG vùng chia từng từ, cuộn ngang cho dòng dài/nhiều từ).
     *
     * NGUYÊN NHÂN LỖI GỐC: bản đầu tạo WaveSurfer mini TẢI + GIẢI MÃ LẠI NGUYÊN CẢ BÀI (lần giải mã thứ
     * 2, song song waveform chính) — nặng, dễ hỏng trên iOS.
     *
     * CÁCH LÀM: waveform mini chỉ chứa ĐÚNG đoạn [start,end] của dòng (trục mini: 0 = start dòng):
     *   1. Nguồn PCM mono (`_getKaraokeSourceAudio()`): giải mã file gốc 1 LẦN/phiên trang ở
     *      KARAOKE_DECODE_SAMPLE_RATE, cache cho mọi dòng; lỗi/bài quá dài -> PCM 8000Hz của waveform chính.
     *   2. Cắt đúng đoạn (`_karaokeSegment`) -> peaks để VẼ (WaveSurfer không tự giải mã gì) + 1 WAV nhỏ
     *      CHỈ để <audio> nội bộ của WaveSurfer có nguồn hợp lệ (không phát qua nó — xem
     *      _toggleKaraokeWordPlay(): phát bằng Web Audio trên CHÍNH đoạn PCM này).
     *   3. Bề rộng: mỗi từ trung bình ≥ KARAOKE_MINI_MIN_WORD_PX — dòng ngắn/ít từ vừa khung, dòng
     *      dài/nhiều từ tự rộng hơn khung -> cuộn ẢO qua thanh trượt bên dưới (SỬA lần 3: KHÔNG cuộn tay
     *      trên sóng nữa — xem _setupKaraokeMiniScroll()); kéo mốc qua núm tròn ngoài khung.
     * Lỗi bất kỳ bước nào -> báo lỗi NGAY TRONG khung, nút ▶ giữ khoá (ô ms vẫn dùng được). */
    async _initKaraokeMiniWaveform() {
        const token = appState.get('_karaokeInitToken') + 1;
        appState.set('_karaokeInitToken', token);
        this._destroyKaraokeMiniWaveform(); // dọn instance CŨ (phòng hờ, dù drawer luôn đóng hẳn trước khi mở dòng khác)
        const containerEl = document.getElementById('karaoke-mini-waveform');
        if (!containerEl || typeof WaveSurfer === 'undefined' || typeof WaveSurfer.Regions === 'undefined') {
            console.error('[subtitle-editor] karaoke mini waveform: thiếu khung hoặc WaveSurfer/Regions (CDN lỗi?).');
            this._showKaraokeWaveformError();
            return;
        }
        try {
            const source = await this._getKaraokeSourceAudio();
            if (appState.get('_karaokeInitToken') !== token) return; // drawer đã đóng/mở dòng khác trong lúc chờ — bỏ lượt dựng cũ
            if (!source) throw new Error('Không có dữ liệu PCM (cả giải mã riêng lẫn getDecodedData() đều không có).');
            const segment = sliceMonoSamples(source.samples, source.sampleRate, appState.get('_karaokeLineStart'), appState.get('_karaokeLineEnd')); // core/audio-segment.js
            if (segment.length === 0) throw new Error('Đoạn audio của dòng rỗng (start/end nằm ngoài bài?).');
            const durationSec = segment.length / source.sampleRate;
            appState.set('_karaokeSegment', { samples: segment, sampleRate: source.sampleRate });
            appState.set('_karaokeSegmentBuffer', null); // AudioBuffer dựng lười lúc bấm ▶ lần đầu (cần AudioContext)

            const viewWidth = containerEl.clientWidth > 0 ? containerEl.clientWidth : 300; // drawer vừa mở có thể chưa kịp layout
            const wordCount = appState.get('_karaokeWords').length;
            // `viewWidth - 1`: dòng vừa khung thì chắc chắn KHÔNG tràn 1px do làm tròn (hiện thanh cuộn thừa).
            const pxPerSec = Math.max(viewWidth - 1, KARAOKE_MINI_MIN_WORD_PX * wordCount) / durationSec;
            appState.set('_karaokeMiniDurationSec', durationSec);
            const peaks = computeMonoPeaks(segment, Math.max(KARAOKE_MINI_PEAK_BUCKETS, Math.ceil(pxPerSec * durationSec * 2))); // core/audio-segment.js
            const url = URL.createObjectURL(new Blob([encodeMonoWavPcm16(segment, source.sampleRate)], { type: 'audio/wav' })); // core/audio-segment.js
            appState.set('_karaokeAudioUrl', url);
            appState.set('_karaokeRegionsPlugin', WaveSurfer.Regions.create());
            const ws = WaveSurfer.create({
                container: containerEl,
                height: KARAOKE_MINI_HEIGHT_PX, // khớp height của #karaoke-mini-waveform (components/subtitle-karaoke-drawer.js)
                waveColor: '#94a3b8',
                progressColor: '#94a3b8', // SỬA — KHÔNG tô tiến trình từ đầu dòng; chỉ bôi xanh ĐÚNG vùng đang phát (region highlight, _tickKaraokeWordProgress())
                cursorWidth: 0,
                normalize: true,
                interact: false, // chạm vào sóng KHÔNG seek — chỉ kéo mốc chia + nút ▶ từng từ
                dragToSeek: false,
                autoScroll: false,
                autoCenter: false,
                minPxPerSec: pxPerSec,
                fillParent: true,
                plugins: [appState.get('_karaokeRegionsPlugin')],
            });
            appState.set('_karaokeWavesurfer', ws);
            ws.on('ready', () => {
                if (appState.get('_karaokeInitToken') !== token) return;
                appState.set('_karaokeMiniReady', true);
                const loadingEl = document.getElementById('karaoke-mini-waveform-loading');
                if (loadingEl) loadingEl.classList.add('hidden');
                this._renderKaraokeRegions();
                this._setupKaraokeMiniScroll();
                this._setKaraokeWordPlayEnabled(true);
            });
            ws.on('scroll', () => this._syncKaraokeMiniScrollUi()); // lưới an toàn — mọi thay đổi cuộn (kể cả do thư viện tự làm) đều kéo thanh trượt + núm theo
            ws.on('error', (err) => {
                console.error('[subtitle-editor] karaoke mini waveform lỗi:', err);
                this._showKaraokeWaveformError();
            });
            // peaks + duration truyền sẵn -> WaveSurfer KHÔNG fetch/giải mã gì.
            ws.load(url, [peaks], durationSec).catch((err) => {
                console.error('[subtitle-editor] karaoke mini waveform load() bị reject:', err);
                this._showKaraokeWaveformError();
            });
        } catch (err) {
            console.error('[subtitle-editor] Lỗi dựng karaoke mini waveform:', err);
            if (appState.get('_karaokeInitToken') === token) this._showKaraokeWaveformError();
        }
    },

    /** Nguồn PCM MONO cho waveform mini — cache 1 LẦN/phiên trang (`_karaokeSourceAudio`), dùng lại cho
     * MỌI dòng. Ưu tiên giải mã riêng file gốc ở KARAOKE_DECODE_SAMPLE_RATE (nghe rõ chữ) — bài dài quá
     * KARAOKE_HIRES_MAX_DURATION_SEC hoặc giải mã lỗi (RAM/iOS) -> lùi về PCM 8000Hz WaveSurfer chính đã
     * giải mã sẵn (getDecodedData()). @returns {Promise<{samples: Float32Array, sampleRate: number}|null>} */
    async _getKaraokeSourceAudio() {
        const cached = appState.get('_karaokeSourceAudio');
        if (cached) return cached;
        const main = appState.get('_wavesurfer');
        const record = appState.get('_record');
        const mainDuration = main ? main.getDuration() : 0;
        let source = null;
        if (record && record.blob && mainDuration > 0 && mainDuration <= KARAOKE_HIRES_MAX_DURATION_SEC) {
            source = await this._decodeKaraokeSourceHiRes(record.blob);
        }
        const fallback = !source && main ? main.getDecodedData() : null;
        if (fallback) {
            console.warn('[subtitle-editor] karaoke: dùng PCM 8000Hz của waveform chính (không giải mã riêng được).');
            source = { samples: mixAudioBufferToMono(fallback), sampleRate: fallback.sampleRate }; // core/audio-segment.js
        }
        if (source) appState.set('_karaokeSourceAudio', source);
        return source;
    },

    /** Giải mã file gốc ở KARAOKE_DECODE_SAMPLE_RATE rồi gộp mono — AudioContext tạm, đóng ngay sau khi
     * xong. Lỗi bất kỳ -> null (nơi gọi tự lùi về PCM của waveform chính). @param {Blob} blob */
    async _decodeKaraokeSourceHiRes(blob) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        let ctx = null;
        try {
            const freshBlob = await rematerializeBlob(blob); // service/db.js — CÙNG lý do _initWaveform() (bug round-trip Blob qua IndexedDB)
            const arrayBuffer = await freshBlob.arrayBuffer();
            try { ctx = new Ctx({ sampleRate: KARAOKE_DECODE_SAMPLE_RATE }); } catch (e) { ctx = new Ctx(); } // WebView cũ không nhận option sampleRate
            const audioBuffer = await new Promise((resolve, reject) => {
                const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject); // dạng callback cho Safari cũ, dạng Promise cho bản mới
                if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject);
            });
            return { samples: mixAudioBufferToMono(audioBuffer), sampleRate: audioBuffer.sampleRate }; // core/audio-segment.js
        } catch (err) {
            console.warn('[subtitle-editor] karaoke: giải mã riêng file gốc thất bại:', err);
            return null;
        } finally {
            if (ctx && typeof ctx.close === 'function') ctx.close().catch(() => {});
        }
    },

    /** Báo lỗi NGAY TRONG khung waveform mini (ẩn lớp "Đang tải"), nút ▶ từng từ giữ khoá. */
    _showKaraokeWaveformError() {
        const el = document.getElementById('karaoke-mini-waveform-error');
        if (el) el.classList.remove('hidden');
        const loadingEl = document.getElementById('karaoke-mini-waveform-loading');
        if (loadingEl) loadingEl.classList.add('hidden');
        this._setKaraokeWordPlayEnabled(false);
    },

    _destroyKaraokeMiniWaveform() {
        this._stopKaraokeWordPlayback();
        appState.set('_karaokeMiniReady', false);
        appState.set('_karaokeLabelRegions', []);
        appState.set('_karaokeMarkerRegions', []);
        appState.set('_karaokeKnobDrag', null);
        if (appState.get('_karaokeWavesurfer')) {
            try { appState.get('_karaokeWavesurfer').destroy(); } catch (e) { /* im lặng — instance có thể đã hỏng sẵn */ }
            appState.set('_karaokeWavesurfer', null);
        }
        appState.set('_karaokeRegionsPlugin', null);
        appState.set('_karaokeSegment', null);
        appState.set('_karaokeSegmentBuffer', null);
        if (appState.get('_karaokeAudioUrl')) {
            URL.revokeObjectURL(appState.get('_karaokeAudioUrl'));
            appState.set('_karaokeAudioUrl', null);
        }
    },

    /** Dựng lại TOÀN BỘ region của waveform mini theo `_karaokeWords` hiện tại (gọi lúc 'ready' + sau khi
     * gõ ô ms) + dựng lại núm kéo mốc. THỨ TỰ quan trọng (dựng sau nằm trên):
     *   1. Vùng TỪ (N region [đầu từ, cuối từ]) — chữ của từ nằm TRONG vùng đó, nền xen kẽ nhạt để phân
     *      biệt từ liền kề. `pointer-events: none`.
     *   2. Vạch mốc chia (N-1 region điểm start===end) — CHỈ HIỂN THỊ (SỬA 30/09/2026 lần 3: không kéo
     *      qua Regions nữa, `pointer-events: none`).
     *   3. Núm kéo (`#karaoke-mini-knobs`, NGOÀI khung sóng) — mỗi mốc 1 núm tròn nhỏ vắt ngang mép dưới
     *      khung, tràn ra ngoài; kéo núm = kéo mốc (pointer events tự viết, _onKaraokeKnobPointer*()).
     *      Vùng chạm 28px (chấm tròn thật chỉ 12px) cho dễ bắt bằng ngón tay.
     * Gắn chữ THẲNG vào element region, KHÔNG qua option `content`: Regions v7 tự "né chồng lấn" mọi
     * `content` (đẩy margin-top) — chữ các từ liền kề sẽ bị đẩy lệch lung tung. Region highlight đang
     * phát (nếu có) KHÔNG bị xoá. */
    _renderKaraokeRegions() {
        const regionsPlugin = appState.get('_karaokeRegionsPlugin');
        if (!regionsPlugin || !appState.get('_karaokeMiniReady')) return;
        appState.get('_karaokeLabelRegions').forEach((r) => r.remove());
        appState.get('_karaokeMarkerRegions').forEach((r) => r.remove());
        const words = appState.get('_karaokeWords');
        const boundaries = computeKaraokeWordBoundariesMs(words); // core

        const labelRegions = words.map((w, i) => {
            const label = document.createElement('div');
            label.textContent = w.word;
            label.style.cssText = 'width:100%;box-sizing:border-box;padding:3px 3px 0;font-size:11px;line-height:13px;font-weight:600;color:#334155;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 3px #fff,0 0 3px #fff;pointer-events:none';
            const region = regionsPlugin.addRegion({
                start: boundaries[i] / 1000,
                end: boundaries[i + 1] / 1000,
                drag: false,
                resize: false,
                color: i % 2 === 0 ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.04)',
            });
            if (region.element) {
                region.element.style.pointerEvents = 'none';
                region.element.appendChild(label);
            }
            return region;
        });

        const markerRegions = [];
        for (let i = 1; i < boundaries.length - 1; i++) {
            const region = regionsPlugin.addRegion({
                start: boundaries[i] / 1000,
                end: boundaries[i] / 1000,
                drag: false,
                resize: false,
                color: 'rgba(245, 158, 11, 0.95)',
            });
            if (region.element) region.element.style.pointerEvents = 'none';
            markerRegions.push(region);
        }
        appState.set('_karaokeLabelRegions', labelRegions);
        appState.set('_karaokeMarkerRegions', markerRegions);

        const knobsEl = document.getElementById('karaoke-mini-knobs');
        if (!knobsEl) return;
        knobsEl.replaceChildren();
        const knobs = markerRegions.map((_, dividerIndex) => {
            const knob = document.createElement('div');
            knob.dataset.karaokeKnob = String(dividerIndex);
            knob.style.cssText = 'position:absolute;left:0;top:0;width:28px;height:28px;margin-left:-14px;margin-top:-14px;display:flex;align-items:center;justify-content:center;touch-action:none;pointer-events:auto;cursor:ew-resize';
            const dot = document.createElement('div');
            dot.style.cssText = 'width:12px;height:12px;box-sizing:border-box;border-radius:9999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .12s ease';
            knob.appendChild(dot);
            knobsEl.appendChild(knob);
            return knob;
        });
        // --- addEventListener: gom cuối (cùng khuôn _wireKaraokeDrawer()) — pointer capture: kéo lệch khỏi núm vẫn theo ---
        knobs.forEach((knob) => {
            const dividerIndex = parseInt(knob.dataset.karaokeKnob, 10);
            knob.addEventListener('pointerdown', (e) => this._onKaraokeKnobPointerDown(dividerIndex, knob, e));
            knob.addEventListener('pointermove', (e) => this._onKaraokeKnobPointerMove(e));
            knob.addEventListener('pointerup', (e) => this._onKaraokeKnobPointerUp(knob, e));
            knob.addEventListener('pointercancel', (e) => this._onKaraokeKnobPointerUp(knob, e));
        });
        this._positionKaraokeKnobs();
    },

    /** Hình học HIỆN TẠI của waveform mini (đọc thẳng từ layout thật của WaveSurfer — đúng cả khi sóng
     * vừa khung lẫn rộng hơn khung): px/giây thật, bề rộng khung nhìn, cuộn tối đa, vị trí cuộn.
     * @returns {{pxPerSec:number, viewWidth:number, maxScroll:number, scroll:number}|null} */
    _getKaraokeMiniGeometry() {
        const ws = appState.get('_karaokeWavesurfer');
        const duration = appState.get('_karaokeMiniDurationSec');
        if (!ws || !(duration > 0) || typeof ws.getWrapper !== 'function') return null;
        const wrapper = ws.getWrapper();
        const scrollEl = wrapper ? wrapper.parentElement : null;
        const totalWidth = wrapper ? wrapper.offsetWidth : 0;
        const viewWidth = scrollEl ? scrollEl.clientWidth : 0;
        if (totalWidth <= 0 || viewWidth <= 0) return null;
        return { pxPerSec: totalWidth / duration, viewWidth, maxScroll: Math.max(0, totalWidth - viewWidth), scroll: ws.getScroll() };
    },

    /** Đặt lại vị trí mọi núm kéo theo mốc chia + vị trí cuộn hiện tại — núm nằm ngoài khung nhìn (đã
     * cuộn qua) thì ẩn. */
    _positionKaraokeKnobs() {
        const knobsEl = document.getElementById('karaoke-mini-knobs');
        const geo = this._getKaraokeMiniGeometry();
        if (!knobsEl || !geo) return;
        const boundaries = computeKaraokeWordBoundariesMs(appState.get('_karaokeWords')); // core
        knobsEl.querySelectorAll('[data-karaoke-knob]').forEach((knob) => {
            const dividerIndex = parseInt(knob.dataset.karaokeKnob, 10);
            const x = (boundaries[dividerIndex + 1] / 1000) * geo.pxPerSec - geo.scroll;
            knob.style.transform = `translate(${x}px, ${KARAOKE_MINI_HEIGHT_PX}px)`; // tâm núm đúng mép DƯỚI khung sóng
            knob.style.display = (x < -1 || x > geo.viewWidth + 1) ? 'none' : 'flex';
        });
    },

    _onKaraokeKnobPointerDown(dividerIndex, knob, e) {
        e.preventDefault();
        e.stopPropagation();
        try { knob.setPointerCapture(e.pointerId); } catch (err) { /* trình duyệt cũ — vẫn kéo được khi ngón tay còn trên núm */ }
        const boundaries = computeKaraokeWordBoundariesMs(appState.get('_karaokeWords')); // core
        appState.set('_karaokeKnobDrag', { dividerIndex, pointerId: e.pointerId, startX: e.clientX, startMs: boundaries[dividerIndex + 1] });
        if (knob.firstChild) knob.firstChild.style.transform = 'scale(1.35)'; // phản hồi "đang cầm"
    },

    /** Kéo núm: độ lệch ngón tay (px) quy ra ms theo px/giây thật của waveform mini, cộng vào mốc lúc bắt
     * đầu kéo (không cộng dồn từng bước — không trôi sai số). */
    _onKaraokeKnobPointerMove(e) {
        const drag = appState.get('_karaokeKnobDrag');
        if (!drag || e.pointerId !== drag.pointerId) return;
        e.preventDefault();
        const geo = this._getKaraokeMiniGeometry();
        if (!geo) return;
        this._applyKaraokeBoundaryDrag(drag.dividerIndex, drag.startMs + ((e.clientX - drag.startX) / geo.pxPerSec) * 1000);
    },

    _onKaraokeKnobPointerUp(knob, e) {
        const drag = appState.get('_karaokeKnobDrag');
        if (!drag || e.pointerId !== drag.pointerId) return;
        appState.set('_karaokeKnobDrag', null);
        if (knob.firstChild) knob.firstChild.style.transform = '';
    },

    /** Mốc chia `dividerIndex` tới `newBoundaryMs` (ms, TƯƠNG ĐỐI trong dòng) — giao
     * redistributeKaraokeBoundary() (core, kẹp không cho 2 mốc vượt nhau) rồi cập nhật TẠI CHỖ: ô ms,
     * vạch mốc, 2 vùng TỪ liền kề, núm (không dựng lại — đang kéo). */
    _applyKaraokeBoundaryDrag(dividerIndex, newBoundaryMs) {
        const words = redistributeKaraokeBoundary(appState.get('_karaokeWords'), dividerIndex, newBoundaryMs); // core
        appState.set('_karaokeWords', words);
        this._syncKaraokeWordInputs();
        const boundaries = computeKaraokeWordBoundariesMs(words); // core
        const markerRegion = appState.get('_karaokeMarkerRegions')[dividerIndex];
        const boundarySec = boundaries[dividerIndex + 1] / 1000;
        if (markerRegion) markerRegion.setOptions({ start: boundarySec, end: boundarySec });
        const labelRegions = appState.get('_karaokeLabelRegions');
        [dividerIndex, dividerIndex + 1].forEach((i) => {
            if (labelRegions[i]) labelRegions[i].setOptions({ start: boundaries[i] / 1000, end: boundaries[i + 1] / 1000 });
        });
        this._positionKaraokeKnobs();
    },

    /** Thanh trượt cuộn ẢO (`#karaoke-mini-scroll`, 0..1000) -> vị trí cuộn của waveform mini. */
    _onKaraokeMiniScrollInput(value) {
        const ws = appState.get('_karaokeWavesurfer');
        const geo = this._getKaraokeMiniGeometry();
        if (!ws || !geo) return;
        ws.setScroll(Math.round((value / 1000) * geo.maxScroll));
        this._syncKaraokeMiniScrollUi();
    },

    /** Đồng bộ thanh trượt + núm theo vị trí cuộn THẬT của waveform mini — gọi sau mọi lần cuộn (thanh
     * trượt, tự cuộn theo từ đang phát) + sự kiện 'scroll' của WaveSurfer (lưới an toàn). */
    _syncKaraokeMiniScrollUi() {
        const geo = this._getKaraokeMiniGeometry();
        const slider = document.getElementById('karaoke-mini-scroll');
        if (geo && slider) slider.value = String(geo.maxScroll > 0 ? Math.round((geo.scroll / geo.maxScroll) * 1000) : 0);
        this._positionKaraokeKnobs();
    },

    /** Lúc waveform mini 'ready': TẮT cuộn tay của WaveSurfer (khung cuộn nội bộ -> overflow-x hidden:
     * vuốt/lăn chuột không cuộn được, `setScroll()` bằng code vẫn chạy) — Giang: "bỏ scroll trên wave
     * form để tránh tranh event kéo mốc", cuộn chỉ qua thanh trượt; hiện thanh trượt nếu sóng rộng hơn
     * khung. */
    _setupKaraokeMiniScroll() {
        const ws = appState.get('_karaokeWavesurfer');
        const wrapper = ws && typeof ws.getWrapper === 'function' ? ws.getWrapper() : null;
        if (wrapper && wrapper.parentElement) wrapper.parentElement.style.overflowX = 'hidden';
        const geo = this._getKaraokeMiniGeometry();
        const row = document.getElementById('karaoke-mini-scroll-row');
        if (row) row.classList.toggle('hidden', !(geo && geo.maxScroll > 1));
        this._syncKaraokeMiniScrollUi();
    },

    /** Ô input ms gõ tay ('change', xem _wireKaraokeDrawer()) — quy đổi qua applyKaraokeWordMsInput()
     * (core, CÙNG lõi redistributeKaraokeBoundary() với kéo tay) rồi dựng lại region + đồng bộ input.
     * Đồng bộ LUÔN cả ô vừa gõ (giá trị có thể đã bị core kẹp); giá trị không phải số -> trả ô về số cũ. */
    _onKaraokeWordMsChange(index, newMs) {
        const words = isNaN(newMs)
            ? appState.get('_karaokeWords')
            : applyKaraokeWordMsInput(appState.get('_karaokeWords'), index, Math.max(KARAOKE_MIN_WORD_MS, newMs)); // core
        appState.set('_karaokeWords', words);
        this._syncKaraokeWordInputs(index);
        this._renderKaraokeRegions();
    },

    /** Ghi lại giá trị ms hiển thị trên MỌI ô input theo `_karaokeWords` hiện tại — bỏ qua ô đang
     * được focus (người dùng có thể đang gõ dở ô KHÁC trong lúc 1 mốc vừa đổi do kéo tay), TRỪ ô
     * `forceIndex` (ô vừa commit 'change' — phải hiện đúng giá trị đã kẹp). @param {number} [forceIndex] */
    _syncKaraokeWordInputs(forceIndex) {
        appState.get('_karaokeWords').forEach((w, i) => {
            const input = genericDrawerBody.querySelector(`[data-karaoke-word-ms="${i}"]`);
            if (input && (i === forceIndex || document.activeElement !== input)) input.value = w.ms;
        });
    },

    /** Nút ▶ từng từ. SỬA LẦN 2 (30/09/2026, Giang báo "play 1 từ -> phát từ khác -> không có tiếng"):
     * bỏ hẳn cách phát qua <audio> WAV của WaveSurfer mini (seek <audio> trên iOS lúc đang dừng/đang
     * tắt tiếng chờ metadata không đáng tin — lượt phát thứ 2 im lặng). Giờ phát bằng Web Audio:
     * AudioBufferSourceNode trên CHÍNH đoạn PCM của dòng (`_karaokeSegment`) — start(0, đầu từ, độ dài từ)
     * chính xác tới từng mẫu, không seek, mỗi lượt 1 node MỚI nên phát bao nhiêu lần/đổi từ liên tục
     * đều có tiếng. Bấm lại đúng từ đang phát = dừng; bấm từ khác = dừng từ cũ, phát từ mới.
     * Tiến trình vẽ bằng region highlight (chỉ bôi xanh [đầu từ, vị trí đang phát]) qua task raf. */
    _toggleKaraokeWordPlay(index) {
        if (!appState.get('_karaokeMiniReady')) return;
        const wasThis = appState.get('_karaokePlayingIndex') === index;
        this._stopKaraokeWordPlayback();
        if (wasThis) return;
        const range = computeKaraokeWordPlayRange(appState.get('_karaokeWords'), 0, index); // core — lineStartSec = 0: trục mini bắt đầu từ start dòng
        if (range.end <= range.start) return;
        this._stopMainPlayback();
        const ctx = this._ensureKaraokeAudioContext(); // PHẢI chạy đồng bộ trong cú bấm (iOS chỉ cho resume() trong user gesture)
        const buffer = ctx ? this._ensureKaraokeSegmentBuffer(ctx) : null;
        if (!ctx || !buffer) return;
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        node.start(0, range.start, range.end - range.start);
        appState.set('_karaokeSourceNode', node);
        appState.set('_karaokePlayingIndex', index);
        appState.set('_karaokePlayStartSec', range.start);
        appState.set('_karaokePlayEndSec', range.end);
        appState.set('_karaokePlayStartCtxTime', ctx.currentTime); // ctx đang suspended (chờ resume) thì currentTime đứng yên -> tiến trình cũng đứng, khớp tiếng
        const regionsPlugin = appState.get('_karaokeRegionsPlugin');
        const highlight = regionsPlugin.addRegion({ start: range.start, end: range.start + 0.001, drag: false, resize: false, color: 'rgba(14, 165, 233, 0.35)' });
        if (highlight.element) highlight.element.style.pointerEvents = 'none';
        appState.set('_karaokeHighlightRegion', highlight);
        this._scrollKaraokeMiniIntoView(range.start);
        taskManager.addNew('karaokeWordProgress', { time: 0, exe: () => this._tickKaraokeWordProgress(), mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator('karaokeWordProgress', 'enabled');
        this._updateKaraokeWordPlayIcons();
    },

    /** AudioContext DÙNG CHUNG cho mọi lượt nghe từ trong phiên trang (tạo 1 lần — iOS giới hạn số
     * AudioContext đồng thời) + đăng ký audioSession 'playback' (Safari/iOS 16.4+ — Web Audio không bị
     * công tắc im lặng tắt tiếng, cùng cách core/audio-engine.js của index.html) + resume() nếu đang
     * suspended. @returns {AudioContext|null} */
    _ensureKaraokeAudioContext() {
        try {
            if (typeof navigator !== 'undefined' && navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
        } catch (e) { console.warn('[subtitle-editor] karaoke: không đăng ký được audioSession (bỏ qua):', e); }
        let ctx = appState.get('_karaokeAudioCtx');
        if (!ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) { console.error('[subtitle-editor] karaoke: trình duyệt không có Web Audio API.'); return null; }
            ctx = new Ctx();
            appState.set('_karaokeAudioCtx', ctx);
        }
        if (ctx.state !== 'running' && typeof ctx.resume === 'function') ctx.resume().catch((err) => console.warn('[subtitle-editor] karaoke: AudioContext.resume() bị từ chối:', err));
        return ctx;
    },

    /** AudioBuffer của đoạn dòng đang mở — dựng lười 1 lần/lượt mở drawer từ `_karaokeSegment`.
     * @param {AudioContext} ctx @returns {AudioBuffer|null} */
    _ensureKaraokeSegmentBuffer(ctx) {
        const cached = appState.get('_karaokeSegmentBuffer');
        if (cached) return cached;
        const segment = appState.get('_karaokeSegment');
        if (!segment) return null;
        try {
            const buffer = ctx.createBuffer(1, segment.samples.length, segment.sampleRate);
            buffer.getChannelData(0).set(segment.samples);
            appState.set('_karaokeSegmentBuffer', buffer);
            return buffer;
        } catch (err) {
            console.error('[subtitle-editor] karaoke: không dựng được AudioBuffer cho đoạn dòng:', err);
            return null;
        }
    },

    /** Task raf trong lúc đang phát 1 từ — kéo dài region highlight tới vị trí đang phát (tính theo đồng
     * hồ AudioContext), giữ vị trí đó trong khung nhìn (dòng dài đang cuộn), tới cuối từ thì dừng. */
    _tickKaraokeWordProgress() {
        const ctx = appState.get('_karaokeAudioCtx');
        const highlight = appState.get('_karaokeHighlightRegion');
        if (!ctx || !highlight || appState.get('_karaokePlayingIndex') === null) { this._stopKaraokeWordPlayback(); return; }
        const start = appState.get('_karaokePlayStartSec');
        const end = appState.get('_karaokePlayEndSec');
        const current = Math.min(end, start + Math.max(0, ctx.currentTime - appState.get('_karaokePlayStartCtxTime')));
        highlight.setOptions({ start, end: Math.max(start + 0.001, current) });
        this._scrollKaraokeMiniIntoView(current);
        if (current >= end) this._stopKaraokeWordPlayback();
    },

    /** Dòng dài (sóng rộng hơn khung) — cuộn waveform mini sao cho mốc `timeSec` nằm trong khung nhìn
     * (còn 20px lề phải); đã thấy thì không cuộn. Dòng vừa khung -> không làm gì. Bấm ▶ 1 từ đang khuất
     * -> waveform nhảy tới đó, thanh trượt cuộn ảo nhảy theo. */
    _scrollKaraokeMiniIntoView(timeSec) {
        const ws = appState.get('_karaokeWavesurfer');
        if (!ws) return;
        const geo = this._getKaraokeMiniGeometry();
        if (!geo || geo.maxScroll <= 0) return;
        const x = timeSec * geo.pxPerSec;
        if (x < geo.scroll || x > geo.scroll + geo.viewWidth - 20) {
            ws.setScroll(Math.min(geo.maxScroll, Math.max(0, x - geo.viewWidth * 0.25)));
            this._syncKaraokeMiniScrollUi(); // thanh trượt + núm nhảy theo
        }
    },

    /** Dừng lượt nghe từ đang chạy (nếu có) — dừng + tháo node, tắt task raf, gỡ highlight, reset state
     * + icon. An toàn gọi nhiều lần. */
    _stopKaraokeWordPlayback() {
        taskManager.kill('karaokeWordProgress'); // service/task-manager.js — no-op nếu không có
        const node = appState.get('_karaokeSourceNode');
        if (node) {
            try { node.stop(); } catch (e) { /* đã tự dừng — bỏ qua */ }
            try { node.disconnect(); } catch (e) { /* bỏ qua */ }
            appState.set('_karaokeSourceNode', null);
        }
        const highlight = appState.get('_karaokeHighlightRegion');
        if (highlight) {
            try { highlight.remove(); } catch (e) { /* waveform mini đã bị huỷ */ }
            appState.set('_karaokeHighlightRegion', null);
        }
        appState.set('_karaokePlayingIndex', null);
        this._updateKaraokeWordPlayIcons();
    },

    /** Đổi icon ▶/⏸ của các nút từ trong drawer theo ĐÚNG từ đang phát. */
    _updateKaraokeWordPlayIcons() {
        const activeIndex = appState.get('_karaokePlayingIndex');
        genericDrawerBody.querySelectorAll('[data-karaoke-word-play]').forEach((btn) => {
            const isThis = activeIndex !== null && String(activeIndex) === btn.dataset.karaokeWordPlay;
            const playIcon = btn.querySelector('.karaoke-word-play-icon');
            const pauseIcon = btn.querySelector('.karaoke-word-pause-icon');
            if (playIcon && pauseIcon) {
                playIcon.classList.toggle('hidden', isThis);
                pauseIcon.classList.toggle('hidden', !isThis);
            }
        });
    },

    /** Mở/khoá các nút ▶ từng từ (dựng sẵn `disabled`, xem components/subtitle-karaoke-drawer.js). */
    _setKaraokeWordPlayEnabled(enabled) {
        genericDrawerBody.querySelectorAll('[data-karaoke-word-play]').forEach((btn) => { btn.disabled = !enabled; });
    },

    /** Nút "Áp dụng" — ghi `_karaokeWords` hiện tại (đã chỉnh qua kéo/gõ) xuống field `karaoke` của
     * ĐÚNG dòng đang mở (workingWordsToKaraokeArray(), core) rồi đóng drawer. KHÔNG tự
     * saveToDatabase() — CÙNG quy ước "Áp dụng" chỉ ghi vào `_subtitles` làm việc, "Lưu" ở toolbar
     * chính mới ghi DB thật (xem docstring saveToDatabase()). */
    applyKaraokeDrawer() {
        const id = appState.get('_karaokeEditingLineId');
        if (id === null) return;
        const karaokeArray = workingWordsToKaraokeArray(appState.get('_karaokeWords')); // core
        appState.set('_subtitles', computeUpdatedSubtitles(appState.get('_subtitles'), id, { karaoke: karaokeArray })); // core
        this._rebuildLineCard(id); // MỚI (30/09/2026) — dựng lại card để hiện dấu tích xanh ở nút "kr"
        this.closeKaraokeDrawer();
    },

    /** MỚI (30/09/2026, yêu cầu Giang) — nút "Bỏ áp dụng": gỡ karaoke khỏi dòng (`karaoke` = null — lần
     * mở sau quay về chia đều), dựng lại card (dấu tích xanh ở nút "kr" biến mất) rồi đóng drawer. CÙNG
     * quy ước Áp dụng: chỉ đổi `_subtitles` làm việc, bấm "Lưu" mới ghi DB. */
    unapplyKaraokeDrawer() {
        const id = appState.get('_karaokeEditingLineId');
        if (id === null) return;
        appState.set('_subtitles', computeUpdatedSubtitles(appState.get('_subtitles'), id, { karaoke: null })); // core
        this._rebuildLineCard(id);
        this.closeKaraokeDrawer();
    },

    /** Xoá card cache của ĐÚNG 1 dòng rồi render lại — renderSubtitleLines() tự dựng card mới cho dòng đó
     * từ dữ liệu mới nhất (card cũ đóng gói `sub` CŨ lúc dựng, không tự đổi), các dòng khác giữ nguyên. */
    _rebuildLineCard(id) {
        const node = appState.get('_lineCardNodesById').get(id);
        if (node) node.remove();
        appState.get('_lineCardNodesById').delete(id);
        this._renderLines();
    },

    /** Đóng drawer karaoke — dọn SẠCH waveform mini (dừng lượt nghe từ đang chạy, destroy, revoke URL) +
     * reset state, dùng CHUNG closeFully() (event/workflow/generic-drawer-helpers.js). Tăng token để
     * lượt dựng waveform mini còn đang await (nếu có) tự bỏ. GIỮ `_karaokeSourceAudio` (cache PCM dùng
     * lại cho dòng khác). */
    closeKaraokeDrawer() {
        appState.set('_karaokeInitToken', appState.get('_karaokeInitToken') + 1);
        appState.set('_karaokeEditingLineId', null);
        appState.set('_karaokeWords', []);
        this._destroyKaraokeMiniWaveform();
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
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
        overlay.className = 'fixed inset-0 z-[130] backdrop-blur-sm flex items-center justify-center px-5';
        overlay.dataset.uitk = 'overlayBg';

        const card = document.createElement('div');
        card.className = 'rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';
        card.dataset.uitk = 'modalCardBg modalCardBorder';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-base';
        titleEl.dataset.uitk = 'modalTitleText';
        titleEl.textContent = t('subtitleEditor.split.title');
        card.appendChild(titleEl);

        const descEl = document.createElement('p');
        descEl.className = 'text-sm leading-relaxed';
        descEl.dataset.uitk = 'modalBodyText';
        descEl.textContent = tFormat('subtitleEditor.split.desc', { start: secToStr(appState.get('_region').start), end: secToStr(appState.get('_region').end) }); // core secToStr
        card.appendChild(descEl);

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '2';
        countInput.max = '50';
        countInput.value = '2';
        countInput.inputMode = 'numeric';
        countInput.className = 'w-full text-center text-lg font-mono rounded-xl px-3 py-2 outline-none';
        countInput.dataset.uitk = 'inputBg inputBorder inputText';
        card.appendChild(countInput);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'flex gap-3 mt-1';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors';
        cancelBtn.dataset.uitk = 'btnNeutralBg btnNeutralHoverBg btnNeutralText';
        cancelBtn.textContent = t('common.cancel');
        buttonRow.appendChild(cancelBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors';
        confirmBtn.dataset.uitk = 'btnPrimaryBg btnPrimaryHoverBg textOnAccent';
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
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(overlay, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
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
        // XOÁ (30/09/2026) — nhánh icon nút ▶ từng từ trong drawer karaoke (id giả '__karaoke_word_<index>')
        // bỏ hẳn: nghe từng từ giờ chạy trên waveform MINI, icon do _updateKaraokeWordPlayIcons() lo.
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
        overlay.className = 'fixed inset-0 z-[130] backdrop-blur-sm flex items-center justify-center px-5';
        overlay.dataset.uitk = 'overlayBg';

        const card = document.createElement('div');
        card.className = 'rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3';
        card.dataset.uitk = 'modalCardBg modalCardBorder';

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-base';
        titleEl.dataset.uitk = 'modalTitleText';
        titleEl.textContent = t('subtitleEditor.shift.modalTitle');
        card.appendChild(titleEl);

        const descEl = document.createElement('p');
        descEl.className = 'text-sm';
        descEl.dataset.uitk = 'modalBodyText';
        descEl.textContent = tFormat('subtitleEditor.shift.modalDesc', { n: appState.get('_shiftSelectedIds').size });
        card.appendChild(descEl);

        const amountLabel = document.createElement('label');
        amountLabel.className = 'text-[11px] font-semibold uppercase tracking-wide';
        amountLabel.dataset.uitk = 'textSecondary';
        amountLabel.textContent = t('subtitleEditor.shift.amountLabel');
        card.appendChild(amountLabel);

        // input number CHO PHÉP gõ dấu trừ trực tiếp (dịch lùi) — không cần nút +/- riêng.
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.step = '0.1';
        amountInput.value = '0';
        amountInput.inputMode = 'decimal';
        amountInput.className = 'w-full text-center text-lg font-mono rounded-xl px-3 py-2 outline-none';
        amountInput.dataset.uitk = 'inputBg inputBorder inputText';
        card.appendChild(amountInput);

        const targetLabel = document.createElement('label');
        targetLabel.className = 'text-[11px] font-semibold uppercase tracking-wide';
        targetLabel.dataset.uitk = 'textSecondary';
        targetLabel.textContent = t('subtitleEditor.shift.targetLabel');
        card.appendChild(targetLabel);

        const targetRow = document.createElement('div');
        targetRow.className = 'flex w-full p-1 rounded-xl gap-1';
        targetRow.dataset.uitk = 'cardBg cardBorder';
        let selectedTarget = 'both';
        const targets = [
            { key: 'both', label: t('subtitleEditor.shift.targetBoth') },
            { key: 'start', label: t('subtitleEditor.shift.targetStart') },
            { key: 'end', label: t('subtitleEditor.shift.targetEnd') },
        ];
        // SỬA (09/09/2026, hệ UI Theme mở rộng) — trạng thái chọn/không chọn của 3 nút này đổi qua
        // classList.toggle() lúc bấm (KHÔNG qua data-uitk tĩnh, vì cần đổi NGAY lúc click, không đợi
        // applyUiThemeToDom() quét lại) — tự tra class active/inactive 1 LẦN qua resolveUiThemeClass()
        // (core/ui-theme/registry.js) nếu hạ tầng đã nạp, fallback hardcode y hệt giá trị Light nếu
        // chưa (trang chưa kịp nạp core/ui-theme/*.js — không nên xảy ra ở cả 2 trang sau đợt này,
        // nhưng giữ fallback cho an toàn tuyệt đối).
        const activeCls = (typeof resolveUiThemeClass === 'function' && typeof _activeUiThemeKeyList !== 'undefined')
            ? `${resolveUiThemeClass(_activeUiThemeKeyList, 'modalCardBg')} ${resolveUiThemeClass(_activeUiThemeKeyList, 'textPrimary')}`
            : 'bg-white text-slate-900';
        const inactiveCls = (typeof resolveUiThemeClass === 'function' && typeof _activeUiThemeKeyList !== 'undefined')
            ? resolveUiThemeClass(_activeUiThemeKeyList, 'textSecondary')
            : 'text-slate-500';
        const targetButtons = targets.map(({ key, label }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.target = key;
            btn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ' + (key === selectedTarget ? `${activeCls} shadow` : inactiveCls);
            btn.textContent = label;
            targetRow.appendChild(btn);
            return btn;
        });
        card.appendChild(targetRow);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'flex gap-3 mt-1';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors';
        cancelBtn.dataset.uitk = 'btnNeutralBg btnNeutralHoverBg btnNeutralText';
        cancelBtn.textContent = t('common.cancel');
        buttonRow.appendChild(cancelBtn);
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors';
        confirmBtn.dataset.uitk = 'btnPrimaryBg btnPrimaryHoverBg textOnAccent'; // SỬA (09/09/2026) — trước đây bg-cyan-600 riêng, giờ hợp nhất về primary chung (sky)
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
                    b.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ' + (active ? `${activeCls} shadow` : inactiveCls);
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
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(overlay, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    },

    /** Cộng `amountSec` (có thể âm) vào start/end/cả 2 của MỌI dòng đang chọn qua
     * shiftSubtitleTimes() (core, THUẦN) rồi thoát hẳn chế độ chọn dòng. */
    /** MỚI (yêu cầu Giang, mục 7) — _applyShift() vừa ĐỔI GIỜ các dòng đã chọn, VỪA thoát hẳn chế
     * độ chọn dòng (đổi CẤU TRÚC của MỌI card, không riêng các dòng bị dịch giờ) — xoá SẠCH cache
     * (không chỉ riêng các id đã chọn) để render lại đúng, cùng lý do toggleShiftSelectionMode(). */
    _applyShift(amountSec, target) {
        const shifted = shiftSubtitleTimes(appState.get('_subtitles'), appState.get('_shiftSelectedIds'), amountSec, target); // core
        // SỬA (30/09/2026) — Shift CHỈ start hoặc CHỈ end đổi thời lượng dòng -> co/giãn karaoke cho khớp
        // (Shift cả 2 giữ nguyên thời lượng -> core tự bỏ qua, không đổi gì).
        appState.set('_subtitles', fitSubtitlesKaraokeToDuration(shifted, appState.get('_shiftSelectedIds'))); // core/subtitle/subtitle-karaoke.js
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
                { label: t('subtitleEditor.reloadConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: () => this._doReloadWithoutCache() },
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
