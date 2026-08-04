/**
 * Component: Video Preview — khung HTML tĩnh cho modal xem/sửa Video (Rule 5d,
 * readme/core-function-conventions.md). Toàn bộ text hiển thị (Save, nhãn tỉ lệ) để RỖNG, gán qua
 * DOM API ở core-ui sau khi instantiate (service/component-dynamic.js::instantiateComponent()) —
 * KHÔNG bake `t()`/dữ liệu người dùng vào chuỗi này. Không addEventListener (Rule 5a wiring thuộc
 * core/file-manager/video-ui.js).
 *
 * 3 lớp, KHÔNG chồng lấn thao tác (dù đè hình ảnh lên nhau):
 *  1. Media (video/poster) — nền, phủ kín #video-preview-media-wrap.
 *  2. Crop (canvas + dải tỉ lệ) — đè lên Media, ẩn mặc định (`.is-visible` bật khi Crop toggle bật).
 *     Dải tỉ lệ NẰM ĐÈ (absolute) trên canvas, KHÔNG chiếm layout riêng — tránh lệch tâm crop-canvas
 *     so với video khi bật/tắt dải tỉ lệ.
 *  3. Header (trên) + dải cắt/filmstrip (dưới) — diện tích CỐ ĐỊNH riêng, luôn hiện, không chồng
 *     lên vùng Media/Crop nên không tranh chấp thao tác dù z-index cao hơn.
 */
const TPL_VIDEO_PREVIEW = `
    <div id="video-preview-overlay" class="fixed inset-0 bg-black flex flex-col hidden">
        <div id="video-preview-header" class="relative z-20 flex items-center justify-between px-3 pt-4 pb-3 gap-2 shrink-0 bg-black">
            <button id="video-preview-close-btn" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:scale-90 transition text-white shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div id="video-preview-toolbar" class="flex items-center gap-1 overflow-x-auto">
                <button id="video-preview-crop-toggle-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 2v4H2v2h4v10a2 2 0 002 2h10v4h2v-4h4v-2h-4V8a2 2 0 00-2-2H8V2H6zm2 6h8v8H8V8z"/></svg>
                </button>
                <button id="video-preview-extract-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z"/></svg>
                </button>
                <button id="video-preview-undo-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4"/></svg>
                </button>
                <button id="video-preview-redo-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v1m15-6l-4-4m4 4l-4 4"/></svg>
                </button>
                <button id="video-preview-reset-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4"/></svg>
                </button>
                <button id="video-preview-rotate-left-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h11a6 6 0 010 12h-2"/></svg>
                </button>
                <button id="video-preview-rotate-right-btn" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l6-6m0 0l-6-6m6 6H10a6 6 0 000 12h2"/></svg>
                </button>
            </div>
            <button id="video-preview-save-btn" type="button" class="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold shadow active:scale-95 transition shrink-0"></button>
        </div>

        <div id="video-preview-media-wrap" class="relative flex-1 min-h-0 overflow-hidden bg-black">
            <div id="video-preview-media-layer" class="absolute inset-0 flex items-center justify-center">
                <img id="video-preview-poster" class="absolute max-w-full max-h-full" alt="">
                <video id="video-preview-video" class="absolute max-w-full max-h-full hidden" muted playsinline preload="auto"></video>
            </div>
            <div id="video-preview-crop-layer" class="video-preview-crop-layer">
                <canvas id="video-preview-crop-canvas" class="absolute max-w-full max-h-full touch-none"></canvas>
                <div id="video-preview-ratio-row" class="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 py-2 overflow-x-auto bg-black/60">
                    <button type="button" class="video-preview-ratio-btn" data-ratio-idx="0"></button>
                    <button type="button" class="video-preview-ratio-btn" data-ratio-idx="1"></button>
                    <button type="button" class="video-preview-ratio-btn" data-ratio-idx="2"></button>
                    <button type="button" class="video-preview-ratio-btn" data-ratio-idx="3"></button>
                    <button type="button" class="video-preview-ratio-btn" data-ratio-idx="4"></button>
                    <button id="video-preview-ratio-flip" type="button" class="video-preview-ratio-btn shrink-0 w-8 h-8 flex items-center justify-center p-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/></svg>
                    </button>
                </div>
            </div>
        </div>

        <div id="video-preview-filmstrip-wrap" class="relative z-20 px-4 pt-2 pb-4 shrink-0 bg-black">
            <div class="flex items-center gap-3 mb-2">
                <span id="video-preview-current-time-label" class="text-[11px] font-mono text-slate-400 w-10 shrink-0">00:00</span>
            </div>
            <div id="video-preview-filmstrip-track" class="video-preview-filmstrip-track">
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
