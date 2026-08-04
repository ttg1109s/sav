/**
 * Component: Video Preview — khung HTML tĩnh (Rule 5d). Toàn bộ text hiển thị để RỖNG, gán qua
 * DOM API ở core-ui (service/component-dynamic.js::instantiateComponent()).
 *
 * SỬA (04/08/2026, phản hồi Giang test thật, ĐỢT 2) — dựng SAI kiến trúc 3 lớp ban đầu: đã dùng
 * `flex flex-col` (header/video/filmstrip CHIA NHAU không gian theo hàng) thay vì ĐÈ LÊN NHAU như
 * yêu cầu gốc ("Video 1, Crop 2, Header + dải cắt 3" — lớp lớn đè lớp nhỏ, KHÔNG lớp nào chiếm
 * riêng 1 vùng) — khiến video bị "khép" giữa header và dải cắt thay vì full màn hình thật. SỬA:
 * `#video-preview-media-wrap` giờ `absolute inset-0` (LUÔN full màn hình, không phụ thuộc header/
 * filmstrip cao bao nhiêu) — `#video-preview-header`/`#video-preview-filmstrip-wrap` cũng
 * `absolute` (nổi ĐÈ lên trên video, có nền gradient mờ dần để chữ/icon còn đọc được), KHÔNG còn
 * đẩy video vào giữa. Track dải cắt: tay cầm Start/End SỬA cao ĐÚNG BẰNG track (trước để tràn
 * -4px/+4px 2 đầu, giờ `top:0;bottom:0` khớp hệt).
 *
 * SỬA (04/08/2026, đợt 1) — xem lịch sử trong `assets/css/style.css` (`.video-preview-crop-layer`,
 * `.video-preview-filmstrip-frames`) + `core/file-manager/video-ui.js`/`event/workflow/
 * video-preview.js` (`_syncCropCanvasBox()`).
 */
const TPL_VIDEO_PREVIEW = `
    <div id="video-preview-overlay" class="fixed inset-0 bg-black hidden">
        <div id="video-preview-media-wrap" class="absolute inset-0 overflow-hidden bg-black">
            <img id="video-preview-poster" class="w-full h-full object-contain" alt="">
            <video id="video-preview-video" class="w-full h-full object-contain hidden" muted playsinline preload="auto"></video>
        </div>

        <div id="video-preview-crop-layer" class="video-preview-crop-layer">
            <canvas id="video-preview-crop-canvas" class="touch-none"></canvas>
        </div>

        <div id="video-preview-header" class="video-preview-overlay-bar video-preview-overlay-bar-top flex items-center justify-between px-3 pt-4 pb-6 gap-2">
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
                    <button id="video-preview-rotate-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="6" y="6" width="11" height="11" rx="1.5" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 10V6.5a2 2 0 00-2-2H14"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 4.2l-2.3 2.3 2.3 2.3"/></svg>
                    </button>
                </div>

                <div id="video-preview-ratio-group" class="video-preview-ratio-group">
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="0"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="1"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="2"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="3"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="4"></button>
                    <button id="video-preview-ratio-flip" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8h13m0 0l-3-3m3 3l-3 3M21 16H8m0 0l3 3m-3-3l3-3"/></svg>
                    </button>
                </div>
            </div>

            <button id="video-preview-save-btn" type="button" class="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold shadow active:scale-95 transition shrink-0"></button>
        </div>

        <div id="video-preview-filmstrip-wrap" class="video-preview-overlay-bar video-preview-overlay-bar-bottom px-4 pt-6 pb-3">
            <div class="flex items-center gap-3 mb-1.5">
                <span id="video-preview-current-time-label" class="text-[11px] font-mono text-slate-300 w-10 shrink-0">00:00</span>
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
