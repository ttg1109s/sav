/**
 * Component: Video Preview — khung HTML tĩnh (Rule 5d). Toàn bộ text hiển thị để RỖNG, gán qua
 * DOM API ở core-ui (service/component-dynamic.js::instantiateComponent()).
 *
 * VIẾT LẠI (26/09/2026, Giang — "cải tổ editor video theo hướng Story Facebook", chốt: GIỮ tỉ lệ
 * gốc, chỉ đổi UI/UX, làm KHUNG UI trước) — bố cục 2 TRẠNG THÁI, điều khiển bằng
 * `data-tool` trên `#video-preview-overlay` (Workflow đặt, CSS assets/css/video-preview.css đọc):
 *
 * 1) `data-tool="none"` (xem/sửa nhanh, kiểu Story): video TRÀN MÀN HÌNH, mọi nút NỔI trên video
 *    trong `#video-preview-float-ui` (`pointer-events:none`, chỉ nút con bắt chạm — tap vào video
 *    vẫn tới `<video>` để play/pause): X góc trên trái, RAIL DỌC góc trên phải (Cắt / Cắt khung /
 *    Xoay / Lật / Âm thanh / Đặt lại + nút mũi tên mở rộng hiện nhãn chữ bên trái icon, đúng kiểu
 *    Facebook), nút Lưu góc dưới phải. Dải phim KHÔNG hiện ở trạng thái này.
 * 2) `data-tool="trim"|"crop"` (đang dùng 1 công cụ): quay về mô hình 3 VÙNG KHÔNG ĐÈ (flex-col) đã
 *    chốt 05/08/2026 — hàng trên `#video-preview-tool-topbar` (Huỷ | tên công cụ | Xong), video co
 *    lại ở giữa, hàng dưới `#video-preview-tool-bottom` (dải phim khi Cắt, dải tỉ lệ + Lật khi Cắt
 *    khung). LÝ DO không cho nút nổi đè lên video lúc dùng công cụ: đúng vấn đề Giang chỉ ra đợt 4
 *    (canvas Crop/dải cắt cần ranh giới thật, không chồng lấn) — chỉ trạng thái xem thuần mới nổi đè.
 *
 * `#video-preview-crop-layer` vẫn là con thật của `#video-preview-media-wrap` (như đợt 4), hiện
 * bằng CSS khi `data-tool="crop"` (không còn class `is-visible`).
 * `#video-preview-play-indicator` — biểu tượng Play giữa màn hình khi đang dừng (overlay có class
 * `is-playing` thì ẩn), chỉ hiển thị, `pointer-events:none`.
 */
const TPL_VIDEO_PREVIEW = `
    <div id="video-preview-overlay" class="video-preview-overlay fixed inset-0 bg-black hidden flex flex-col" data-tool="none">
        <div id="video-preview-tool-topbar" class="video-preview-tool-topbar">
            <button id="video-preview-tool-cancel-btn" type="button" class="video-preview-topbar-btn"></button>
            <span id="video-preview-tool-title" class="video-preview-topbar-title"></span>
            <button id="video-preview-tool-done-btn" type="button" class="video-preview-topbar-btn is-primary"></button>
        </div>

        <div id="video-preview-media-wrap" class="relative flex-1 min-h-0 overflow-hidden bg-black">
            <img id="video-preview-poster" class="absolute inset-0 w-full h-full object-contain" alt="">
            <video id="video-preview-video" class="absolute inset-0 w-full h-full object-contain hidden" playsinline preload="auto"></video>

            <div id="video-preview-play-indicator" class="video-preview-play-indicator">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z"/></svg>
            </div>

            <div id="video-preview-crop-layer" class="video-preview-crop-layer">
                <canvas id="video-preview-crop-canvas" class="touch-none"></canvas>
            </div>

            <div id="video-preview-float-ui" class="video-preview-float-ui">
                <button id="video-preview-close-btn" type="button" class="video-preview-float-close">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>

                <div id="video-preview-rail" class="video-preview-rail">
                    <button id="video-preview-trim-tool-btn" type="button" class="video-preview-rail-item">
                        <span id="video-preview-trim-tool-label" class="video-preview-rail-label"></span>
                        <span class="video-preview-rail-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="6" cy="6" r="2.6" stroke-width="2"/><circle cx="6" cy="18" r="2.6" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.2 7.5L20 17M8.2 16.5L20 7M13 12h.01"/></svg></span>
                    </button>
                    <button id="video-preview-crop-tool-btn" type="button" class="video-preview-rail-item">
                        <span id="video-preview-crop-tool-label" class="video-preview-rail-label"></span>
                        <span class="video-preview-rail-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/></svg></span>
                    </button>
                    <button id="video-preview-rotate-btn" type="button" class="video-preview-rail-item">
                        <span id="video-preview-rotate-label" class="video-preview-rail-label"></span>
                        <span class="video-preview-rail-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4a8 8 0 018 8a8 8 0 01-8 8a8 8 0 01-8-8"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1.5 9.5L4 12l3.5-1.5"/></svg></span>
                    </button>
                    <button id="video-preview-flip-btn" type="button" class="video-preview-rail-item">
                        <span id="video-preview-flip-label" class="video-preview-rail-label"></span>
                        <span class="video-preview-rail-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8L4 12l4 4M16 8l4 4-4 4"/></svg></span>
                    </button>
                    <button id="video-preview-mute-btn" type="button" class="video-preview-rail-item">
                        <span id="video-preview-mute-label" class="video-preview-rail-label"></span>
                        <span class="video-preview-rail-icon">
                            <svg class="video-preview-icon-sound-on" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>
                            <svg class="video-preview-icon-sound-off" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5L6 9H3v6h3l5 4V5zM16 9.5l5 5M21 9.5l-5 5"/></svg>
                        </span>
                    </button>
                    <button id="video-preview-reset-btn" type="button" class="video-preview-rail-item">
                        <span id="video-preview-reset-label" class="video-preview-rail-label"></span>
                        <span class="video-preview-rail-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4"/></svg></span>
                    </button>
                    <button id="video-preview-rail-expand-btn" type="button" class="video-preview-rail-item video-preview-rail-expand">
                        <span class="video-preview-rail-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 9l6 6 6-6"/></svg></span>
                    </button>
                </div>

                <button id="video-preview-save-btn" type="button" class="video-preview-float-save"></button>
            </div>
        </div>

        <div id="video-preview-tool-bottom" class="video-preview-tool-bottom">
            <div id="video-preview-trim-panel" class="video-preview-trim-panel">
                <div class="video-preview-trim-info">
                    <span id="video-preview-current-time-label">00:00</span>
                    <span id="video-preview-trim-length-label" class="video-preview-trim-length"></span>
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

            <div id="video-preview-crop-panel" class="video-preview-crop-panel">
                <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="0"></button>
                <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="1"></button>
                <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="2"></button>
                <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="3"></button>
                <button type="button" class="video-preview-tool-btn video-preview-ratio-btn" data-ratio-idx="4"></button>
                <button id="video-preview-ratio-flip" type="button" class="video-preview-tool-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="video-preview-tool-btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8L4 12l4 4M16 8l4 4-4 4"/></svg>
                </button>
            </div>
        </div>
    </div>
`;
