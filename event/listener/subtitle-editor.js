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

// Khởi động trang — SAU khi mọi listener/router đã đăng ký xong.
workflowSubtitleEditor.init();
