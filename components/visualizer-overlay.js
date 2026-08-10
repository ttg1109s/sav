/**
 * Component: Visualizer UI Overlay — lớp giao diện đè lên canvas khi đang phát nhạc (stats,
 * phụ đề, cử chỉ, Control Center). Biến này chứa chuỗi HTML, main.js chèn vào DOM lúc khởi động.
 *
 * #visualizer-gesture-surface: lớp phủ chạm RIÊNG cho toàn bộ cử chỉ (event/workflow/visualizer-
 * gesture.js) — nằm TRÊN canvas (#visualizer z-index 10) + bgVideoElement (#bg-video z-index 0)
 * nhưng DƯỚI mọi thanh UI thật (top bar z-40, Control Center z-45/46) để không chặn nút bấm.
 *
 * #btn-open-control-center mở panel #visualizer-control-center (grid icon, "PHÓNG RA TỪ TRUNG
 * TÂM" từ đúng vị trí nút bấm — logic mở/đóng ở core/visualizer-control-center.js).
 * #btn-back-playlist tách riêng, luôn cố định (thao tác dùng thường xuyên, không nằm trong panel
 * ẩn/hiện). Cả 2 nút này CÙNG #stats-panel và panel Control Center có thể bị ẩn qua toggle "Ẩn
 * thanh điều khiển" (Settings -> Visualizer -> Cử chỉ & hiển thị) — xem core/visualizer-ui-
 * chrome.js.
 *
 * #btn-toggle-stats-panel ĐÃ DỜI sang Settings (checkbox, Rule 2 compliant) — xem
 * components/gesture-settings-drawer.js + core/stats-panel-toggle.js. 3 giá trị BPM/Pitch/Energy
 * đổi từ 3 màu riêng (xanh lá/vàng/hồng) sang TRẮNG hết (phản hồi Giang).
 *
 * #btn-capture-video-frame MỚI — chụp khung hình `bgVideoElement` đang phát, lưu vào Photo. CHỈ
 * hiện lúc Video Player mode (`.hidden` mặc định, gỡ trong setBgVideoElementForPlayerMode(),
 * core/video-player.js) — xem event/workflow/video-player.js::captureCurrentFrame().
 */
const TPL_VISUALIZER_OVERLAY = `
    <div id="visualizer-ui" class="fixed inset-0 z-30 pointer-events-none fade-enter hidden flex flex-col">
        <div class="flex-grow relative">
            <div id="visualizer-gesture-surface" class="absolute inset-0 z-20 pointer-events-auto"></div>

            <div id="subtitle-display" class="absolute bottom-[20%] w-full px-4 sm:px-10 flex flex-col items-center justify-center pointer-events-none z-[60] hidden">
                <div id="subtitle-frame" class="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center max-w-4xl shadow-2xl flex flex-col items-center gap-1.5">
                    <div id="sub-active-lines" class="flex flex-col items-center gap-1.5"></div>
                </div>
            </div>

            <!-- Hàng trên cùng HỢP NHẤT — Control Center (trái) + BPM/Pitch/Energy (giữa,
                 #stats-panel — toggle ẩn/hiện qua Settings) + Quay lại Danh sách (phải). -->
            <div id="visualizer-top-bar" class="absolute top-4 left-3 right-3 sm:left-6 sm:right-6 z-40 flex items-center justify-between gap-2 pointer-events-none">
                <button id="btn-open-control-center" class="w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors group shadow-lg pointer-events-auto" data-i18n-title="visualizerOverlay.btnControlCenter.title" title="${t('visualizerOverlay.btnControlCenter.title')}">
                    <svg id="icon-control-center-down" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300 group-hover:text-white transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <div id="stats-panel" class="flex-1 min-w-0 flex justify-center items-center gap-4 sm:gap-12 pointer-events-none select-none sub-text-glow">
                    <div class="flex flex-col items-center"><span class="text-slate-300 font-semibold tracking-wider text-[8px] sm:text-[9px] mb-0.5 whitespace-nowrap">EST. BPM</span><span id="stat-bpm" class="font-mono text-white font-bold text-xs sm:text-sm">---</span></div>
                    <div class="flex flex-col items-center"><span class="text-slate-300 font-semibold tracking-wider text-[8px] sm:text-[9px] mb-0.5 whitespace-nowrap">PITCH (YIN)</span><span id="stat-note" class="font-mono text-white font-bold text-xs sm:text-sm">---</span></div>
                    <div class="flex flex-col items-center"><span class="text-slate-300 font-semibold tracking-wider text-[8px] sm:text-[9px] mb-0.5 whitespace-nowrap">ENERGY</span><span id="stat-energy" class="font-mono text-white font-bold text-xs sm:text-sm">0%</span></div>
                </div>

                <button id="btn-back-playlist" class="w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors group shadow-lg pointer-events-auto" data-i18n-title="visualizerOverlay.btnBackPlaylist.title" title="${t('visualizerOverlay.btnBackPlaylist.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg></button>
            </div>

            <!-- Panel "Control Center" — phóng ra từ vị trí nút mở (top-left), kính mờ trong suốt.
                 Neo cả 2 mép trái/phải, grid co giãn full-width. -->
            <div id="control-center-overlay" class="hidden fixed inset-0 z-[45] pointer-events-auto"></div>
            <div id="visualizer-control-center" class="absolute top-16 left-3 right-3 sm:left-6 sm:right-6 glass-control-center rounded-3xl shadow-2xl transform scale-0 opacity-0 transition-all duration-300 ease-out z-[46] pointer-events-auto p-4" style="transform-origin: top left;">
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2 w-full">
                    <button id="btn-cycle-mode" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors relative" data-i18n-title="visualizerOverlay.cycleMode.title" title="${t('visualizerOverlay.cycleMode.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 11a9 9 0 019 9M4 11a9 9 0 019-9m9 9a9 9 0 01-9-9m9 9a9 9 0 01-9 9m-9-9h18" /></svg>
                        <span class="text-[10px] text-white font-medium" data-i18n="visualizerOverlay.cycleMode.label">${t('visualizerOverlay.cycleMode.label')}</span>
                        <span id="mode-badge" class="absolute top-1 right-3 bg-sky-500 text-[9px] font-bold px-1 rounded-full border border-slate-900 shadow-md">1/9</span>
                    </button>
                    <button id="btn-subtitle" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors relative" data-i18n-title="visualizerOverlay.subtitle.title" title="${t('visualizerOverlay.subtitle.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        <span class="text-[10px] text-white font-medium" data-i18n="visualizerOverlay.subtitle.label">${t('visualizerOverlay.subtitle.label')}</span>
                        <span id="sub-toggle-badge" class="hidden absolute top-1 right-3 bg-green-500 text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-slate-900 text-white shadow-md"></span>
                    </button>
                    <button id="btn-shuffle" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors text-white/70" data-i18n-title="visualizerOverlay.shuffle.title" title="${t('visualizerOverlay.shuffle.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        <span class="text-[10px] font-medium" data-i18n="visualizerOverlay.shuffle.label">${t('visualizerOverlay.shuffle.label')}</span>
                    </button>
                    <button id="btn-repeat" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors text-white/70 relative" data-i18n-title="visualizerOverlay.repeat.title" title="${t('visualizerOverlay.repeat.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span class="text-[10px] font-medium" data-i18n="visualizerOverlay.repeat.label">${t('visualizerOverlay.repeat.label')}</span>
                        <span id="repeat-badge" class="hidden absolute top-1 right-3 bg-sky-500 text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-slate-900 text-white">1</span>
                    </button>
                    <button id="btn-open-document-reader" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors text-white/70" data-i18n-title="visualizerOverlay.documentReader.title" title="${t('visualizerOverlay.documentReader.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        <span class="text-[10px] font-medium" data-i18n="visualizerOverlay.documentReader.label">${t('visualizerOverlay.documentReader.label')}</span>
                    </button>
                    <!-- Chỉ hiện lúc Video Player mode — xem setBgVideoElementForPlayerMode(),
                         core/video-player.js. -->
                    <button id="btn-capture-video-frame" data-cc-action class="hidden flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors text-white/70" data-i18n-title="visualizerOverlay.captureFrame.title" title="${t('visualizerOverlay.captureFrame.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span class="text-[10px] font-medium" data-i18n="visualizerOverlay.captureFrame.label">${t('visualizerOverlay.captureFrame.label')}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
