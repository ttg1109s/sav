/**
 * Component: Video Preview — khung HTML tĩnh (Rule 5d). Toàn bộ text hiển thị để RỖNG, gán qua
 * DOM API ở core-ui (service/component-dynamic.js::instantiateComponent()).
 *
 * SỬA (05/08/2026, phản hồi Giang đợt 4 — "chia lại layout không overlap") — BỎ hẳn model đợt 2
 * (header/filmstrip `absolute` NỔI ĐÈ lên video full màn hình). LÝ DO ĐẢO NGƯỢC: model đè lớp khiến
 * `#video-preview-crop-layer` (canvas thao tác Crop) không có ranh giới thật với header/dải cắt —
 * nhưng Giang chỉ ra gốc rễ crop không kéo được KHÔNG PHẢI do chồng lấn (đã kiểm chứng: chọn tỉ lệ
 * co nhỏ nằm hẳn giữa màn hình, cách xa 2 thanh, vẫn không kéo được) — 2 lỗi thật ĐỘC LẬP với layout,
 * xem chi tiết ở đầu `event/workflow/video-preview.js`. Dù vậy việc đè lớp VẪN gây đúng vấn đề mục
 * 1/2 (padding/ranh giới không rõ ràng) nên đảo về model 3 VÙNG THẬT KHÔNG ĐÈ — mỗi vùng chiếm
 * không gian riêng qua `flex flex-col`:
 * - `#video-preview-header`/`#video-preview-filmstrip-wrap`: hàng flex THẬT (không còn `absolute`),
 *   nền đen đặc (không cần gradient mờ dần nữa vì không còn đè lên video).
 * - `#video-preview-media-wrap`: `flex-1 min-h-0 relative` (chiếm phần CÒN LẠI, không phải full màn
 *   hình nữa — video sẽ nhỏ lại đúng bằng khoảng header+dải cắt chiếm, ĐÃ được Giang xác nhận chấp
 *   nhận đánh đổi này, xem trao đổi ngoài code).
 * - `#video-preview-crop-layer` CHUYỂN VÀO BÊN TRONG `#video-preview-media-wrap` (trước là sibling
 *   đứng ngoài, canh khớp video chỉ nhờ trùng `inset:0` tình cờ) — giờ là con thật của đúng vùng
 *   video, `position:absolute inset:0` tính theo ĐÚNG khung chứa của nó (xem `_syncCropCanvasBox()`
 *   viết lại — không còn dựa `videoEl.getBoundingClientRect()` nữa, xem lý do ở đó).
 *
 * SỬA (04/08/2026, phản hồi Giang test thật, đợt 2) + (04/08/2026, đợt 1) — LỊCH SỬ layout trước đó
 * (model đè lớp rồi model chia hàng), đã archive.
 *
 * SỬA (05/08/2026, đợt 3) — `<video>` bỏ `muted` (mục 5, không liên quan autoplay policy — modal này
 * không auto-play). Icon Flip tỉ lệ đổi sang 2 khung ngang/dọc lệch nhau (chuẩn Google Photos/
 * Snapseed, tự thể hiện đang đổi ngang<->dọc, không cần mũi tên).
 *
 * SỬA (05/08/2026, đợt 5, phản hồi Giang):
 * - Bỏ hẳn nút Undo/Redo (mục 1 — Giang: "loại bỏ toàn bộ tính năng undo/redo, giữ nút reset").
 * - `<img>`/`<video>` thêm `absolute inset-0` (mục 2, đúng khuôn `.photo-preview-image`
 *   core/file-manager/photo-ui.js — nơi Panzoom đã chạy ĐÚNG) — trước đó là block tĩnh thường, KHÔNG
 *   pin cứng theo `inset:0`, khác Photo. Xem lý do đầy đủ ở event/workflow/video-preview.js
 *   (`handleMetadataLoaded()` — thời điểm init Panzoom cũng sửa).
 * - Icon Rotate đổi hẳn sang cung tròn cong (chuẩn phổ biến — tìm thấy khi search icon "rotate" trên
 *   mạng: cung tròn + mũi tên, KHÔNG phải khung vuông + mũi tên góc như bản cũ, bản cũ không đủ rõ
 *   nghĩa "xoay" — phản hồi Giang mục 3).
 * - Thêm nút Lật ngang MỚI trong `toolsGroupEl` (mục 4 — Giang: "không có nút lật trái phải trên
 *   toolbar" — KHÁC nút Flip trong `ratioGroupEl`, cái đó chỉ đảo CHIỀU khung Crop, không lật NỘI
 *   DUNG video). Icon: vạch dọc giữa + 2 mũi tên ngược chiều 2 bên — chuẩn phổ biến (Word/Photoshop/
 *   Canva), tìm thấy khi search icon "flip horizontal".
 */
const TPL_VIDEO_PREVIEW = `
    <div id="video-preview-overlay" class="fixed inset-0 bg-black hidden flex flex-col">
        <div id="video-preview-header" class="flex items-center justify-between px-4 pb-3 gap-2 bg-black shrink-0" style="padding-top:calc(0.75rem + env(safe-area-inset-top, 0px))">
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
                    <button id="video-preview-reset-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4"/></svg>
                    </button>
                    <button id="video-preview-flip-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8L4 12l4 4M16 8l4 4-4 4"/></svg>
                    </button>
                    <button id="video-preview-rotate-btn" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4a8 8 0 018 8a8 8 0 01-8 8a8 8 0 01-8-8"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1.5 9.5L4 12l3.5-1.5"/></svg>
                    </button>
                </div>

                <div id="video-preview-ratio-group" class="video-preview-ratio-group">
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="0"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="1"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="2"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="3"></button>
                    <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="4"></button>
                    <button id="video-preview-ratio-flip" type="button" class="video-preview-tool-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="3" width="13" height="8" rx="1.3" stroke-width="2"/><rect x="9" y="9" width="8" height="13" rx="1.3" stroke-width="2"/></svg>
                    </button>
                </div>
            </div>

            <button id="video-preview-save-btn" type="button" class="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold shadow active:scale-95 transition shrink-0"></button>
        </div>

        <div id="video-preview-media-wrap" class="relative flex-1 min-h-0 overflow-hidden bg-black">
            <img id="video-preview-poster" class="absolute inset-0 w-full h-full object-contain" alt="">
            <video id="video-preview-video" class="absolute inset-0 w-full h-full object-contain hidden" playsinline preload="auto"></video>

            <div id="video-preview-crop-layer" class="video-preview-crop-layer">
                <canvas id="video-preview-crop-canvas" class="touch-none"></canvas>
            </div>
        </div>

        <div id="video-preview-filmstrip-wrap" class="px-6 pt-3 bg-black shrink-0" style="padding-bottom:calc(0.75rem + env(safe-area-inset-bottom, 0px))">
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
