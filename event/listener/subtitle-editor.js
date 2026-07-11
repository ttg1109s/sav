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
const btnPlaySelection = document.getElementById('btn-play-selection');
const btnSaveSubtitles = document.getElementById('btn-save-subtitles');
const btnBackToPlaylist = document.getElementById('btn-back-to-playlist');

// MỚI (11/07/2026, yêu cầu Giang, mục 2) — Play/Pause + giờ start/end vùng chọn, và nút cảnh báo
// mở bảng debug log (xem subtitle-editor.html, khung #waveform-frame).
const waveformControlsEl = document.getElementById('waveform-controls');
const btnWaveformPlayPause = document.getElementById('btn-waveform-playpause');
const iconWaveformPlay = document.getElementById('icon-waveform-play');
const iconWaveformPause = document.getElementById('icon-waveform-pause');
const waveformRegionStartEl = document.getElementById('waveform-region-start');
const waveformRegionEndEl = document.getElementById('waveform-region-end');
const btnWaveformDebug = document.getElementById('btn-waveform-debug');
const waveformDebugPanelEl = document.getElementById('waveform-debug-panel');
const waveformDebugLogEl = document.getElementById('waveform-debug-log');

if (btnBackToPlaylist) {
    btnBackToPlaylist.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.back.click', payload: {} });
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

if (btnWaveformDebug) {
    btnWaveformDebug.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleEditor', type: 'subtitleEditor.toggleDebugPanel.click', payload: {} });
    });
}

// Khởi động trang — SAU khi mọi listener/router đã đăng ký xong.
workflowSubtitleEditor.init();
