/**
 * Component: Video Preview — khung HTML tĩnh (Rule 5d). Toàn bộ text hiển thị để RỖNG, gán qua
 * DOM API ở core-ui (service/component-dynamic.js::instantiateComponent()).
 *
 * SỬA (04/08/2026, phản hồi Giang test thật):
 *  1. `<video>`/`<img>`/`<canvas>` KHÔNG còn `position:absolute` bên trong cha `flex` — absolute
 *     bị loại khỏi flow nên `items-center`/`justify-center` của cha KHÔNG có tác dụng (lý do video
 *     lệch trái + crop-canvas không thẳng hàng với video, dẫn tới chạm không trúng). `<video>`/
 *     `<img>` dùng `object-contain` (tự canh giữa, không cần flex cha). `<canvas>` được
 *     Workflow đo/đặt CSS width/height/left/top TRỎ THẲNG theo hộp video thật lúc vào Crop
 *     (`_syncCropCanvasBox()`, event/workflow/video-preview.js) — không dựa vào CSS tự canh nữa.
 *  2. Toolbar giờ có 2 nhóm HOÁN ĐỔI ngay trong CÙNG hàng (không tách thanh riêng đè lên canvas
 *     nữa): `#video-preview-tools-group` (mặc định) và `#video-preview-ratio-group` (hiện khi bật
 *     Crop) — dùng chung 1 style nút `.video-preview-tool-btn`.
 *  3. Icon Rotate đổi hẳn sang khung vuông + mũi tên góc (khác hẳn Undo/Redo, tránh nhầm).
 *  4. Track dải phim tách `#video-preview-filmstrip-frames` (overflow:hidden riêng, chỉ bo góc ảnh
 *     nền) khỏi `#video-preview-filmstrip-track` (KHÔNG overflow:hidden nữa) — 2 tay cầm ở đúng
 *     0%/100% không còn bị cắt mất nửa.
 */
const TPL_VIDEO_PREVIEW = `
    <div id="video-preview-overlay" class="fixed inset-0 bg-black flex flex-col hidden">
        <div id="video-preview-header" class="relative z-20 flex items-center justify-between px-3 pt-4 pb-3 gap-2 shrink-0 bg-black">
            <button id="video-preview-close-btn" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:scale-90 transition text-white shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            <div id="video-preview-toolbar" class="flex items-center gap-1 overflow-x-auto flex-1 justify-center">
                <button id="video-preview-crop-toggle-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 2v4H2v2h4v10a2 2 0 002 2h10v4h2v-4h4v-2h-4V8a2 2 0 00-2-2H8V2H6zm2 6h8v8H8V8z"/></svg>
                </button>

                <div id="video-preview-tools-group" class="video-preview-tools-group">
                    <button id="video-preview-extract-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z"/></svg>
                    </button>
                    <button id="video-preview-undo-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7L3 11l4 4M3 11h12a5 5 0 000-10"/></svg>
                    </button>
                    <button id="video-preview-redo-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 7l4 4-4 4M21 11H9a5 5 0 010-10"/></svg>
                    </button>
                    <button id="video-preview-reset-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4"/></svg>
                    </button>
                    <button id="video-preview-rotate-left-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="6" y="6" width="11" height="11" rx="1.5" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 10V6.5a2 2 0 012-2H10"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4.2l2.3 2.3-2.3 2.3"/></svg>
                    </button>
                    <button id="video-preview-rotate-right-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="7" y="6" width="11" height="11" rx="1.5" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 10V6.5a2 2 0 00-2-2H14"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 4.2l-2.3 2.3 2.3 2.3"/></svg>
                    </button>
                </div>

                <div id="video-preview-ratio-group" class="video-preview-ratio-group">
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="0"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="1"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="2"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="3"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="4"></button>
                    <button id="video-preview-ratio-flip" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/></svg>
                    </button>
                </div>
            </div>

            <button id="video-preview-save-btn" type="button" class="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold shadow active:scale-95 transition shrink-0"></button>
        </div>

        <div id="video-preview-media-wrap" class="relative flex-1 min-h-0 overflow-hidden bg-black">
            <div id="video-preview-media-layer" class="absolute inset-0">
                <img id="video-preview-poster" class="w-full h-full object-contain" alt="">
                <video id="video-preview-video" class="w-full h-full object-contain hidden" muted playsinline preload="auto"></video>
            </div>
            <div id="video-preview-crop-layer" class="video-preview-crop-layer">
                <canvas id="video-preview-crop-canvas" class="touch-none"></canvas>
            </div>
        </div>

        <div id="video-preview-filmstrip-wrap" class="relative z-20 px-4 pt-2 pb-3 shrink-0 bg-black">
            <div class="flex items-center gap-3 mb-1.5">
                <span id="video-preview-current-time-label" class="text-[11px] font-mono text-slate-400 w-10 shrink-0">00:00</span>
            </div>
            <div id="video-preview-filmstrip-track" class="video-preview-filmstrip-track">
                <div id="video-preview-filmstrip-frames" class="video-preview-filmstrip-frames"></div>
                <div id="video-preview-dim-left" class="video-preview-filmstrip-dim" style="left:0"></div>
                <div id="video-preview-dim-right" class="video-preview-filmstrip-dim" style="right:0"></div>
                <div id="video-preview-range-border" class="video-preview-filmstrip-range-border"></div>
                <div id="video-preview-start-handle" class="video-preview-trim-handle"></div>
                <div id="video-preview-end-handle" class="video-preview-trim-handle"></div>
                <div id="video-preview-playhead" class="video-preview-playhead"></div>
            </div>
        </div>
    </div>
`;
