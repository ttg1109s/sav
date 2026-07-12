/**
 * event/listener/subtitle-editor.js — TẤT CẢ listener của trang `subtitle-editor.html`.
 *
 * Trang này KHÔNG có `core/dom-refs.js` riêng (quy mô nhỏ, 1 trang, 1 listener — tạo hẳn 1 file
 * dom-refs riêng cho ~15 phần tử là dư thừa) — khai `const` tham chiếu DOM NGAY ĐẦU file này thay
 * vì tách riêng.
 *
 * NẠP SAU: components DOM tĩnh của subtitle-editor.html đã render, event/bus.js,
 * event/router/subtitle-editor.js, event/workflow/subtitle-editor.js.
 */
const editorTitleEl = document.getElementById('subtitle-editor-title');
const linesContainerEl = document.getElementById('sub-list-container');
const subEmptyStateEl = document.getElementById('sub-empty-state');
const waveformContainerEl = document.getElementById('waveform-container');
const waveformErrorEl = document.getElementById('waveform-error');
const btnAutoTiming = document.getElementById('btn-auto-timing');
const iconAutoTimingIdle = document.getElementById('icon-auto-timing-idle');
const iconAutoTimingRecording = document.getElementById('icon-auto-timing-recording');
const btnAddSub = document.getElementById('btn-add-sub');
const btnExportSrt = document.getElementById('btn-export-srt');
const srtUpload = document.getElementById('srt-upload');
const btnCreateLineFromSelection = document.getElementById('btn-create-line-from-selection');
const btnSplit = document.getElementById('btn-split'); // MỚI (yêu cầu Giang)
const btnCutMp3 = document.getElementById('btn-cut-mp3'); // MỚI (yêu cầu Giang, mục 1)
const btnPlaySelection = document.getElementById('btn-play-selection');
const btnSaveSubtitles = document.getElementById('btn-save-subtitles');
const btnBackToPlaylist = document.getElementById('btn-back-to-playlist');
const btnReloadNoCache = document.getElementById('btn-reload-no-cache'); // MỚI (yêu cầu Giang)

// MỚI (11/07/2026, yêu cầu Giang, mục 2) — Play/Pause + giờ start/end vùng chọn, và nút cảnh báo
// mở bảng debug log (xem subtitle-editor.html, khung #waveform-frame).
const waveformControlsEl = document.getElementById('waveform-controls');
const btnWaveformPlayPause = document.getElementById('btn-waveform-playpause');
const iconWaveformPlay = document.getElementById('icon-waveform-play');
const iconWaveformPause = document.getElementById('icon-waveform-pause');
const waveformCurrentTimeEl = document.getElementById('waveform-current-time'); // MỚI (yêu cầu Giang, mục 2)
const btnPlayRegionControl = document.getElementById('btn-play-region-control'); // MỚI (yêu cầu Giang, mục 8)
const iconPlayRegionPlay = document.getElementById('icon-play-region-play'); // MỚI (yêu cầu Giang, mục 3/4)
const iconPlayRegionPause = document.getElementById('icon-play-region-pause'); // MỚI (yêu cầu Giang, mục 3/4)
const waveformRegionStartEl = document.getElementById('waveform-region-start');
const waveformRegionEndEl = document.getElementById('waveform-region-end');
const btnWaveformDebug = document.getElementById('btn-waveform-debug');
const waveformDebugPanelEl = document.getElementById('waveform-debug-panel');
const waveformDebugLogEl = document.getElementById('waveform-debug-log');
// MỚI (yêu cầu Giang, mục 2) — chốt start/end vùng chọn = vị trí phát hiện tại.
const btnRegionSetStart = document.getElementById('btn-region-set-start');
const btnRegionSetEnd = document.getElementById('btn-region-set-end');
// MỚI (yêu cầu Giang, mục 3) — FIX nút cảnh báo bị bảng debug che khuất: đóng/copy-all giờ nằm HẲN
// TRONG bảng (cùng z-index, luôn bấm được).
const btnDebugCopyAll = document.getElementById('btn-debug-copy-all');
const btnDebugClose = document.getElementById('btn-debug-close');
// MỚI (yêu cầu Giang, mục 5) — tool "Shift".
const btnShift = document.getElementById('btn-shift');
const shiftSelectionBarEl = document.getElementById('shift-selection-bar');
const shiftSelectionCountEl = document.getElementById('shift-selection-count');
const btnShiftCancel = document.getElementById('btn-shift-cancel');
const btnShiftContinue = document.getElementById('btn-shift-continue');

// MỚI (11/07/2026, yêu cầu Giang) — thanh công cụ cuộn ngang (thay grid-cols-7 cố định cũ, xem
// subtitle-editor.html) + 2 nút mũi tên cuộn qua lại, dùng chung scrollSliderTo()
// (core/slider-panel-scroll.js) với #side-left-container/#settings-stack-body ở index.html.
const toolbarScrollContainerEl = document.getElementById('toolbar-scroll-container');
const btnToolbarScrollLeft = document.getElementById('btn-toolbar-scroll-left');
const btnToolbarScrollRight = document.getElementById('btn-toolbar-scroll-right');

if (btnBackToPlaylist) {
    btnBackToPlaylist.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.back.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang) — tải lại KHÔNG dùng cache.
if (btnReloadNoCache) {
    btnReloadNoCache.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.reloadNoCache.click', payload: {} });
    });
}

if (btnAutoTiming) {
    btnAutoTiming.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.autoTiming.click', payload: {} });
    });
}

if (btnAddSub) {
    btnAddSub.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.addLine.click', payload: {} });
    });
}

if (btnCreateLineFromSelection) {
    btnCreateLineFromSelection.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.createLineFromSelection.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang) — "Split": chia vùng chọn hiện tại thành x dòng đều nhau.
if (btnSplit) {
    btnSplit.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.split.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang, mục 1) — "Cut MP3": cắt vùng chọn hiện tại thành file .mp3 thật.
if (btnCutMp3) {
    btnCutMp3.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.cutMp3.click', payload: {} });
    });
}

if (btnPlaySelection) {
    btnPlaySelection.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.playSelection.click', payload: {} });
    });
}

if (btnExportSrt) {
    btnExportSrt.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.exportSrt.click', payload: {} });
    });
}

if (srtUpload) {
    srtUpload.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.importSrt.change', payload: { file } });
    });
}

if (btnSaveSubtitles) {
    btnSaveSubtitles.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.save.click', payload: {} });
    });
}

// MỚI (11/07/2026, yêu cầu Giang, mục 2) — Play/Pause của waveform (KHÁC "Phát vùng chọn" ở
// thanh công cụ dưới — nút đó luôn phát ĐÚNG this._region, nút này play/pause TOÀN BỘ waveform
// tại vị trí con trỏ hiện tại, theo đúng nghĩa nút play/pause chuẩn của 1 trình phát).
if (btnWaveformPlayPause) {
    btnWaveformPlayPause.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.waveformPlayPause.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang, mục 2/6) — FIX bug ĐÃ XÁC NHẬN của chính WaveSurfer.js v7 (GitHub issue
// #3804, katspaugh/wavesurfer.js: "[Regions] Clicking inside region does not seek", tái hiện từ
// bản 7.8.2 trên Chrome/Edge) — bấm vào PHẦN NẰM TRONG vùng chọn (this._region, hầu như luôn che
// phần lớn waveform) hoàn toàn KHÔNG chuyển vị trí phát, chỉ bấm ra NGOÀI vùng chọn mới ăn — đúng
// nguyên nhân "current không bắt đúng vị trí bấm" (mục 2) VÀ "Auto-timing không bắt đúng current"
// (mục 6, chính là 1 hệ quả của cùng bug này). Tự tính vị trí bấm THẲNG từ toạ độ chuột/chạm (không
// lệ thuộc gì vào cơ chế click-to-seek nội bộ của WaveSurfer đang lỗi ở trên) rồi gọi
// workflowSubtitleEditor.seekTo() — hoạt động ĐÚNG bất kể bấm trong hay ngoài vùng chọn.
// MỚI (yêu cầu Giang, mục 2/6) — FIX bug ĐÃ XÁC NHẬN của chính WaveSurfer.js v7 (GitHub issue
// #3804, katspaugh/wavesurfer.js: "[Regions] Clicking inside region does not seek", tái hiện từ
// bản 7.8.2 trên Chrome/Edge) — bấm vào PHẦN NẰM TRONG vùng chọn (this._region, hầu như luôn che
// phần lớn waveform) hoàn toàn KHÔNG chuyển vị trí phát, chỉ bấm ra NGOÀI vùng chọn mới ăn.
// SỬA (yêu cầu Giang — "nhảy linh tinh rất xa") — bản trước tự tính tỉ lệ (0..1) dựa trên
// `waveformContainerEl.scrollWidth`/`.scrollLeft` — SAI GIẢ ĐỊNH div NGOÀI này là phần tử đang
// cuộn thật (WaveSurfer tự quản lý cuộn RIÊNG trong Shadow DOM của nó, không chắc cùng 1 phần tử).
// Giờ CHỈ đo geometry THÔ ở đây (vị trí bấm tính từ mép trái khung NHÌN THẤY — không tự cộng/đoán
// gì về cuộn) — phần "cuộn bao nhiêu" giao hẳn cho workflowSubtitleEditor.seekFromClick() tự đọc
// qua `this._wavesurfer.getScroll()` (API THẬT của chính thư viện, luôn đúng bất kể div ngoài có
// phải phần tử cuộn hay không).
if (waveformContainerEl) {
    waveformContainerEl.addEventListener('click', (e) => {
        const rect = waveformContainerEl.getBoundingClientRect();
        const clickXInViewport = e.clientX - rect.left;
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.seek.click', payload: { clickXInViewport } });
    });
}

// MỚI (yêu cầu Giang, mục 8) — phát riêng vùng chọn, lối tắt ngay trong khung điều khiển.
if (btnPlayRegionControl) {
    btnPlayRegionControl.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.playSelection.click', payload: {} });
    });
}

if (btnWaveformDebug) {
    btnWaveformDebug.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.toggleDebugPanel.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang, mục 3) — X + Copy all NGAY TRONG bảng debug (fix bug bị nút cảnh báo ngoài che khuất).
if (btnDebugClose) {
    btnDebugClose.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.toggleDebugPanel.click', payload: {} });
    });
}
if (btnDebugCopyAll) {
    btnDebugCopyAll.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.copyDebugLog.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang, mục 2) — chốt start/end vùng chọn = vị trí phát hiện tại.
if (btnRegionSetStart) {
    btnRegionSetStart.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.regionSetStart.click', payload: {} });
    });
}
if (btnRegionSetEnd) {
    btnRegionSetEnd.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.regionSetEnd.click', payload: {} });
    });
}

// MỚI (yêu cầu Giang, mục 5) — tool "Shift".
if (btnShift) {
    btnShift.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.shift.click', payload: {} });
    });
}
if (btnShiftCancel) {
    btnShiftCancel.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.shift.click', payload: {} }); // toggle — đang bật -> tắt, đúng nghĩa "Huỷ"
    });
}
if (btnShiftContinue) {
    btnShiftContinue.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.shiftContinue.click', payload: {} });
    });
}

// MỚI (11/07/2026, yêu cầu Giang) — 2 nút mũi tên cuộn thanh công cụ. Đây là bookkeeping UI THUẦN
// (chỉ đổi opacity/scroll theo layout thật của #toolbar-scroll-container, KHÔNG đụng gì tới state
// nghiệp vụ của trang — this._subtitles/this._wavesurfer) — viết THẲNG ở đây, KHÔNG qua eventBus/
// Workflow, CÙNG TINH THẦN updateActiveSubtitleLineHighlight() (core/subtitle/subtitles-ui.js): 1
// hàm classList/opacity thuần, không gọi core khác.
function _updateToolbarArrowState() {
    if (!toolbarScrollContainerEl) return;
    const maxScroll = toolbarScrollContainerEl.scrollWidth - toolbarScrollContainerEl.clientWidth;
    if (btnToolbarScrollLeft) btnToolbarScrollLeft.classList.toggle('opacity-30', toolbarScrollContainerEl.scrollLeft <= 4);
    if (btnToolbarScrollRight) btnToolbarScrollRight.classList.toggle('opacity-30', toolbarScrollContainerEl.scrollLeft >= maxScroll - 4);
}

if (btnToolbarScrollLeft && toolbarScrollContainerEl) {
    btnToolbarScrollLeft.addEventListener('click', () => {
        const target = Math.max(0, toolbarScrollContainerEl.scrollLeft - toolbarScrollContainerEl.clientWidth * 0.8);
        scrollSliderTo(toolbarScrollContainerEl, target, true); // core/slider-panel-scroll.js
    });
}
if (btnToolbarScrollRight && toolbarScrollContainerEl) {
    btnToolbarScrollRight.addEventListener('click', () => {
        const maxScroll = toolbarScrollContainerEl.scrollWidth - toolbarScrollContainerEl.clientWidth;
        const target = Math.min(maxScroll, toolbarScrollContainerEl.scrollLeft + toolbarScrollContainerEl.clientWidth * 0.8);
        scrollSliderTo(toolbarScrollContainerEl, target, true); // core/slider-panel-scroll.js
    });
}
if (toolbarScrollContainerEl) {
    toolbarScrollContainerEl.addEventListener('scroll', _updateToolbarArrowState);
    _updateToolbarArrowState(); // trạng thái ban đầu — mờ sẵn mũi tên trái vì đang ở đầu dải, mũi tên phải mờ nếu dải KHÔNG tràn (vừa đủ 7 tool trên màn hình rộng)
}

// Khởi động trang — SAU khi mọi listener/router đã đăng ký xong.
workflowSubtitleEditor.init();
