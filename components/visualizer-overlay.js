/**
 * Component: Visualizer UI Overlay (lớp giao diện đè lên canvas khi đang phát nhạc: stats, subtitle, các nút điều khiển nhanh)
 * Biến này chứa chuỗi HTML, được main.js chèn vào DOM lúc khởi động.
 *
 * Ver 8 refine: dải dọc 6 nút ở góc phải (Quay lại/Đổi hiệu ứng/Phụ đề/Cài đặt/Trộn bài/Lặp lại)
 * THAY BẰNG 1 nút "Control Center" nhỏ ở góc trái (#btn-open-control-center, mũi tên xuống) —
 * bấm vào mở panel #visualizer-control-center chứa GRID 5 icon (Đổi hiệu ứng/Phụ đề/Cài đặt/
 * Trộn bài/Lặp lại), mỗi ô có icon + nhãn chữ. #btn-back-playlist (Quay lại Danh sách) TÁCH
 * RIÊNG, vẫn cố định góc phải trên như cũ vì là thao tác dùng rất thường xuyên — không nằm trong
 * panel ẩn/hiện. Mọi #id nút bên trong grid GIỮ NGUYÊN (#btn-cycle-mode, #btn-subtitle,
 * #btn-settings, #btn-shuffle, #btn-repeat) nên toàn bộ listener ở player-controls.js/
 * equalizer-settings.js không cần sửa gì — chỉ JS mới ở đây là mở/đóng panel (xem
 * state-and-video-bg.js).
 *
 * Ver 8 refine (lần 2): panel đổi từ "trượt từ trên xuống full chiều rộng" thành "PHÓNG RA TỪ
 * TRUNG TÂM" (scale từ vị trí nút mở, đúng kiểu Control Center iOS thật) + nền đổi từ
 * .drawer-glass (đen đậm) sang .glass-control-center (kính mờ TRONG SUỐT hơn nhiều — xem
 * css/styles.css).
 *
 * Ver 8 refine (lần 3): panel rộng GẦN BẰNG TOÀN MÀN HÌNH (neo cả 2 mép trái/phải, KHÔNG còn
 * cố định 220px lệch trái) — grid 5 icon nằm đều trên 1 hàng ngang duy nhất.
 *
 * Ver 10 refine (bổ sung): grid đổi 5 -> 6 ICON, thêm "Thống kê" (#btn-toggle-stats-panel) — toggle
 * ẩn/hiện dải BPM/Pitch/Energy (#stats-panel, đè ở trên cùng visualizer) cho người dùng muốn xem
 * visual "sạch" không bị dải số liệu che mất 1 phần màn hình. Xem logic đầy đủ ở
 * js/core/stats-panel-toggle.js — TẠM DỪNG tính DOM text (statBpm/statNote/statEnergy.textContent)
 * khi ẩn, KHÔNG tạm dừng toàn bộ updateStatsDashboard() (audio-analysis.js) vì hàm đó còn tính
 * rubikPitchAvg/currentCalculatedBpm dùng bởi visual Rubik — chỉ bỏ qua phần ghi DOM, giữ nguyên
 * phần tính toán logic.
 *
 * FIX (03/07/2026, mục 1 yêu cầu) — #stats-panel (BPM/Pitch/Energy) TRƯỚC ĐÂY là 1 khung
 * `.glass-panel` ĐỘC LẬP, `w-full`, đứng NGOÀI/TRÊN khối `.flex-grow.relative` (chiếm hẳn 1 hàng
 * riêng, đẩy phần còn lại của visualizer xuống + có nền/viền riêng). XOÁ HẲN khung độc lập đó —
 * 3 ô số liệu giờ là 1 CỤM CON nằm CÙNG 1 hàng ngang DUY NHẤT (`#visualizer-top-bar`) với 2 nút
 * `#btn-open-control-center` (trái) / `#btn-back-playlist` (phải), cùng `top-4`, không còn chiếm
 * thêm chiều cao/nền riêng. `#stats-panel` vẫn giữ NGUYÊN id (chỉ đổi class bao ngoài) — nút ẩn/
 * hiện (`toggleStatsPanelVisibility()`, core/stats-panel-toggle.js) chỉ `classList.toggle('hidden')`
 * qua id, KHÔNG phụ thuộc vị trí/cấu trúc DOM cha, nên KHÔNG cần đổi gì ở file đó. Mất nền kính mờ
 * nâng đỡ chữ số liệu -> thêm `.sub-text-glow` (class có sẵn, dùng cho phụ đề) để chữ vẫn đọc rõ
 * trên mọi nền visual/video/ảnh.
 */
const TPL_VISUALIZER_OVERLAY = `
    <div id="visualizer-ui" class="fixed inset-0 z-30 pointer-events-none fade-enter hidden flex flex-col">
        <div class="flex-grow relative">
            <div id="subtitle-display" class="absolute bottom-[20%] w-full px-4 sm:px-10 flex flex-col items-center justify-center pointer-events-none z-[60] hidden">
                <div id="subtitle-frame" class="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center max-w-4xl shadow-2xl flex flex-col items-center gap-1.5">
                    <div id="sub-active-lines" class="flex flex-col items-center gap-1.5"></div>
                </div>
            </div>

            <!-- Hàng trên cùng HỢP NHẤT (fix 03/07/2026, mục 1) — Control Center (trái) + BPM/
                 Pitch/Energy (giữa, #stats-panel — vẫn toggle ẩn/hiện được như cũ) + Quay lại
                 Danh sách (phải), cùng 1 hàng ngang, không còn khung/nền riêng cho số liệu. -->
            <div id="visualizer-top-bar" class="absolute top-4 left-3 right-3 sm:left-6 sm:right-6 z-40 flex items-center justify-between gap-2 pointer-events-none">
                <!-- Nút mở/đóng "Control Center" (ver 8 refine) — mũi tên xuống. Bấm vào mở panel
                     #visualizer-control-center, gập lại khi bấm lần 2 hoặc bấm ra ngoài panel. -->
                <button id="btn-open-control-center" class="w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors group shadow-lg pointer-events-auto" data-i18n-title="visualizerOverlay.btnControlCenter.title" title="${t('visualizerOverlay.btnControlCenter.title')}">
                    <svg id="icon-control-center-down" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300 group-hover:text-white transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <div id="stats-panel" class="flex-1 min-w-0 flex justify-center items-center gap-4 sm:gap-12 pointer-events-none select-none sub-text-glow">
                    <div class="flex flex-col items-center"><span class="text-slate-300 font-semibold tracking-wider text-[8px] sm:text-[9px] mb-0.5 whitespace-nowrap">EST. BPM</span><span id="stat-bpm" class="font-mono text-green-400 font-bold text-xs sm:text-sm">---</span></div>
                    <div class="flex flex-col items-center"><span class="text-slate-300 font-semibold tracking-wider text-[8px] sm:text-[9px] mb-0.5 whitespace-nowrap">PITCH (YIN)</span><span id="stat-note" class="font-mono text-yellow-400 font-bold text-xs sm:text-sm">---</span></div>
                    <div class="flex flex-col items-center"><span class="text-slate-300 font-semibold tracking-wider text-[8px] sm:text-[9px] mb-0.5 whitespace-nowrap">ENERGY</span><span id="stat-energy" class="font-mono text-rose-400 font-bold text-xs sm:text-sm">0%</span></div>
                </div>

                <!-- Nút "Quay lại Danh sách" — thao tác dùng rất thường xuyên, không gộp vào
                     Control Center ẩn/hiện bên dưới. -->
                <button id="btn-back-playlist" class="w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors group shadow-lg pointer-events-auto" data-i18n-title="visualizerOverlay.btnBackPlaylist.title" title="${t('visualizerOverlay.btnBackPlaylist.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg></button>
            </div>

            <!-- Panel "Control Center" — PHÓNG RA TỪ TRUNG TÂM (vị trí nút mở, góc trái trên) kiểu
                 iOS Control Center thật, KHÔNG còn trượt từ trên xuống full chiều rộng (ver 8
                 refine). Cơ chế: scale(0) + opacity 0 ở trạng thái đóng, transform-origin đặt tại
                 góc trên-trái (đúng vị trí nút bấm) -> khi mở, scale(1) tạo cảm giác "nở ra" từ
                 đúng điểm người dùng vừa chạm, không phải trượt cứng theo 1 hướng. Nền đổi sang
                 .glass-control-center — kính mờ TRONG SUỐT hơn nhiều so với .drawer-glass (gần
                 như chỉ làm mờ-đục cảnh phía sau, giống đúng chất liệu Control Center iPhone thật
                 — không phải 1 lớp nền đậm che kín).
                 FIX (ver 8 refine #2 — khung quá hẹp so với màn hình): panel trước đây CHỈ neo
                 mép trái (class left-3 sm:left-6) với grid trong cố định width 220px — trên màn
                 hình rộng (đặc biệt tablet/màn ngang), panel co lại thành 1 ô vuông nhỏ lệch trái,
                 rất mất cân đối so với phần còn lại của visualizer. SỬA: neo CẢ 2 MÉP (left-3
                 right-3 sm:left-6 sm:right-6) để panel rộng GẦN BẰNG TOÀN MÀN HÌNH (trừ margin 2
                 bên), grid trong đổi từ width cố định (3 cột) sang full-width (co giãn theo
                 panel, 5 cột) — đúng số lượng nút thật (Hiệu ứng/Phụ đề/Cài đặt/Trộn bài/Lặp lại),
                 nằm đều trên 1 hàng ngang duy nhất thay vì 3+2 như trước. transform-origin giữ
                 "top left" vì nút mở vẫn ở góc trái — hiệu ứng "nở ra" từ đúng vị trí bấm không
                 đổi. -->
            <div id="control-center-overlay" class="hidden fixed inset-0 z-[45] pointer-events-auto"></div>
            <div id="visualizer-control-center" class="absolute top-16 left-3 right-3 sm:left-6 sm:right-6 glass-control-center rounded-3xl shadow-2xl transform scale-0 opacity-0 transition-all duration-300 ease-out z-[46] pointer-events-auto p-4" style="transform-origin: top left;">
                <div class="grid grid-cols-6 gap-1 sm:gap-2 w-full">
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
                    <button id="btn-settings" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors" data-i18n-title="visualizerOverlay.settings.title" title="${t('visualizerOverlay.settings.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span class="text-[10px] text-white font-medium" data-i18n="visualizerOverlay.settings.label">${t('visualizerOverlay.settings.label')}</span>
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
                    <!-- Toggle ẩn/hiện dải BPM/Pitch/Energy (#stats-panel, mới) — xem
                         js/core/stats-panel-toggle.js. data-cc-action ĐỂ NGUYÊN giống 5 nút trên
                         (đóng Control Center sau khi bấm, xem state-and-video-bg.js) vì đây cũng là
                         1 thao tác "chọn xong rồi đóng panel", không phải toggle cần giữ panel mở
                         để xem ngay hiệu ứng (khác Trộn bài/Lặp lại có badge trạng thái ngay trên
                         icon — icon nút này tự đổi giữa "mắt mở"/"mắt gạch chéo" ĐÚNG LÚC mở lại
                         Control Center lần sau, không cần thấy ngay trong lúc panel đang mở). -->
                    <button id="btn-toggle-stats-panel" data-cc-action class="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/15 transition-colors text-white/70" data-i18n-title="visualizerOverlay.statsToggle.title" title="${t('visualizerOverlay.statsToggle.title')}">
                        <svg id="icon-stats-panel-visible" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <svg id="icon-stats-panel-hidden" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        <span class="text-[10px] font-medium" data-i18n="visualizerOverlay.statsToggle.label">${t('visualizerOverlay.statsToggle.label')}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
