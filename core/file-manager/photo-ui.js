/**
 * core/file-manager/photo-ui.js — Vẽ UI Photo: modal xem ảnh full-screen — DUY NHẤT 1 mặt canvas
 * dùng chung cho xem/zoom/pan/edit, KHÔNG có khái niệm "mode" nào tách biệt (bỏ dropdown "...") —
 * xem docstring `openImagePreviewModal()` dưới. UI công cụ Edit (grid tool phẳng trong Generic
 * Drawer, không còn nhóm header) vẽ/chỉnh TRỰC TIẾP lên chính canvas đang xem. Picker chọn 1 ảnh
 * dùng chung (cover bài hát/nền Theme) đã DỜI sang core/media-picker-drawer-helper.js::
 * openMediaPickerDrawerUi() — không còn ở file này. Grid ảnh chính (Photo Source trong Playlist)
 * dùng event/workflow/photo-gallery-window.js (fjGallery + IntersectionObserver) — không đụng tới
 * file này.
 *
 * NẠP SAU: lang/lang.js (t()), core/generic-drawer.js, service/z-index.js.
 */

/**
 * Modal xem ảnh full-screen — dựng cụm DOM MỚI (Rule 5a: DOM mới tự tạo bằng `createElement` được
 * phép tự `addEventListener`, miễn callback CHỈ bắn `eventBus.send()`, gom cuối hàm — xem khuôn ở
 * cuối hàm này).
 *
 * DUY NHẤT 1 mặt hiển thị cho CẢ xem/zoom/pan/edit — KHÔNG có "mode" nào để vào/thoát. `canvasWrap`
 * LUÔN hiện sẵn từ đầu (không còn `hidden`/gỡ `hidden` theo bất kỳ sự kiện nào) — Panzoom gắn lên
 * `mediaWrap` (bọc chung `<img>` + `canvasWrap`), chạy LIÊN TỤC suốt vòng đời modal. `<img>`
 * (objectUrl) chỉ là ảnh xem TẠM lúc canvas chưa kịp decode (tải tức thời, tránh màn hình trống) —
 * canvas vẽ ĐÈ LÊN tự nhiên, KHÔNG có dòng code nào chủ động ẩn/hiện qua lại giữa 2 thứ này. Icon
 * Edit (bút chì) trên header CHỈ mở bảng công cụ (Generic Drawer) — không "vào" gì cả, công cụ
 * chọn xong vẽ/chỉnh THẲNG lên canvas đang xem đó (xem event/workflow/image-edit.js).
 * @param {{key: string, blob: Blob, filename: string}} image
 * @returns {{close: () => void, imgEl: HTMLImageElement, mediaWrap: HTMLElement, canvasWrap: HTMLElement, baseCanvas: HTMLCanvasElement, renderCanvas: HTMLCanvasElement, interactCanvas: HTMLCanvasElement, toolsBtn: HTMLElement}}
 */
/** So sánh hướng ảnh với hướng màn hình — DÙNG CHUNG cho cả `<img>` (object-fit, gọi lúc 'load')
 * LẪN cụm canvas Edit mode (`syncEditCanvasDisplaySize()` dưới). TRƯỚC ĐÂY 2 nơi tính RIÊNG —
 * canvas không hề gọi, mặc định coi như luôn 'contain' — ảnh CÙNG hướng màn hình (case phổ biến
 * nhất: ảnh dọc xem trên máy dọc) đang hiện 'cover' (phủ kín ngang màn hình) ĐỘT NGỘT co hẹp lại
 * còn 'contain' (hẹp hơn, viền 2 bên) ngay lúc vào Edit mode — ĐÚNG hiệu ứng "ảnh co lại theo
 * chiều ngang" Giang báo, vì canvas không hỗ trợ tự đổi theo `<img>`.
 * @param {number} naturalW @param {number} naturalH @returns {'cover'|'contain'}
 */
function computeCoverOrContain(naturalW, naturalH) {
    const imageIsLandscape = naturalW >= naturalH;
    const screenIsLandscape = window.innerWidth >= window.innerHeight;
    return (imageIsLandscape === screenIsLandscape) ? 'cover' : 'contain';
}

/** Đồng bộ `object-fit` của cụm 4 canvas Edit mode (base/render/layer/interact) với `<img>` —
 * PHẢI gọi lại mỗi lần kích thước THẬT của ảnh đổi (`baseCanvas.width/height`): lúc vừa decode
 * xong (event/workflow/image-edit.js::ensureEditSessionReady()) VÀ lúc Áp dụng Crop xong (ảnh đổi
 * kích thước/tỉ lệ, applyCropTool()) — dùng chung 4 canvas (đều CÙNG kích thước THẬT, xếp chồng
 * khít lên nhau, chỉ khác nội dung).
 * @param {{baseCanvas: HTMLCanvasElement, renderCanvas: HTMLCanvasElement, layerCanvas: HTMLCanvasElement, interactCanvas: HTMLCanvasElement}} handle
 */
function syncEditCanvasDisplaySize(handle) {
    const w = handle.baseCanvas.width, h = handle.baseCanvas.height;
    if (!w || !h) return; // guard: canvas chưa có kích thước thật (hiếm, gọi quá sớm)
    const fitMode = computeCoverOrContain(w, h);
    [handle.baseCanvas, handle.renderCanvas, handle.layerCanvas, handle.interactCanvas].forEach(c => {
        c.style.objectFit = fitMode;
    });
}

function openImagePreviewModal(image) {


    const stale = document.getElementById('image-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(image.blob);

    const overlay = document.createElement('div');
    overlay.id = 'image-preview-overlay';
    overlay.className = 'fixed inset-0 bg-black overflow-hidden';
    overlay.style.zIndex = String(Z_INDEX.IMAGE_PREVIEW); // SỬA 25/07/2026 — trước đây hardcode class Tailwind tĩnh `z-[130]`

    function closeModal() {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        overlay.remove();
    }

    // SỬA (14/07/2026, Giang chỉ ra: "sao ảnh nào cũng crop để full view?" — ĐÚNG, bản trước gán
    // CỨNG `object-fit: cover` cho MỌI ảnh, không tính hướng ảnh so với hướng màn hình). GIẢI THÍCH:
    // "full width + full height" và "không cắt mất ảnh" chỉ cùng đúng khi tỉ lệ ảnh ~ tỉ lệ màn
    // hình (cùng hướng: ảnh ngang trên màn ngang, ảnh dọc trên màn dọc) — cover lúc đó chỉ cắt RẤT
    // ÍT (khớp sẵn). Ảnh NGANG xem trên màn DỌC (hoặc ngược lại) mà ép cover sẽ cắt mất PHẦN LỚN nội
    // dung ảnh — không hợp lý. SỬA: đo `naturalWidth/Height` (ảnh) so `innerWidth/Height` (màn hình)
    // NGAY khi ảnh load xong — CÙNG hướng (cả 2 cùng ngang hoặc cùng dọc) mới dùng cover; LỆCH hướng
    // thì đổi qua contain (hiện trọn ảnh, dư khoảng đen 2 bên do overlay đã bg-black sẵn — KHÔNG mất
    // nội dung ảnh).
    // ---- mediaWrap: bọc CHUNG `<img>` + canvasWrap — Panzoom gắn lên ĐÂY (không gắn thẳng lên
    // `<img>` nữa), pan/zoom nhờ vậy áp dụng cho CẢ 2 như nhau, không cần huỷ/tạo lại session mỗi
    // lần chuyển qua lại giữa xem ảnh thường và Edit mode (KHÔNG có khái niệm "pause/resume Zoom" —
    // xem workflowFileManagerPhoto._initZoom(), gọi ĐÚNG 1 LẦN suốt vòng đời modal).
    const mediaWrap = document.createElement('div');
    mediaWrap.id = 'image-preview-media-wrap';
    mediaWrap.className = 'absolute inset-0';
    overlay.appendChild(mediaWrap);

    const img = document.createElement('img');
    img.alt = image.filename;
    img.className = 'photo-preview-image';
    img.src = objectUrl;
    mediaWrap.appendChild(img);

    // ---- Khung canvas — DUY NHẤT 1 mặt hiển thị cho CẢ xem/zoom/pan/edit (Giang chốt: "1 canvas
    // hình ảnh dùng luôn xem, zoom pan và edit", KHÔNG có khái niệm ẩn/hiện chuyển qua lại với
    // `<img>` nữa). `<img>` (objectUrl) chỉ đóng vai trò ảnh xem TẠM lúc canvas CHƯA kịp decode
    // xong (tải tức thời, không cần đợi) — canvas vẽ ĐÈ LÊN, phủ kín TỰ NHIÊN nhờ cùng kích thước/
    // vị trí (mediaWrap + object-fit đồng bộ, xem syncEditCanvasDisplaySize()), KHÔNG có dòng code
    // nào chủ động ẩn `<img>` hay hiện canvasWrap — canvasWrap LUÔN hiện sẵn từ đầu. Đúng khuôn
    // prototype "Lumina Pro": base = pixel gốc sau thao tác vĩnh viễn, render = kết quả Điều chỉnh
    // hiện tại, layer = Text/Shape (chọn lại/sửa lại được), interact = overlay tương tác (khung
    // crop/nét vẽ nháp/handle kéo) — NGAY TRÊN CÙNG ảnh đang xem/zoom, không phải 1 bản sao riêng.
    const canvasWrap = document.createElement('div');
    canvasWrap.id = 'image-edit-canvas-wrap';
    canvasWrap.className = 'absolute inset-0 flex items-center justify-center';
    const baseCanvas = document.createElement('canvas');
    baseCanvas.id = 'image-edit-base-canvas';
    baseCanvas.className = 'absolute w-full h-full';
    const renderCanvas = document.createElement('canvas');
    renderCanvas.id = 'image-edit-render-canvas';
    renderCanvas.className = 'absolute w-full h-full';
    const layerCanvas = document.createElement('canvas');
    layerCanvas.id = 'image-edit-layer-canvas';
    layerCanvas.className = 'absolute w-full h-full';
    const interactCanvas = document.createElement('canvas');
    interactCanvas.id = 'image-edit-interact-canvas';
    // FIX (bug có từ trước — Crop không kéo được góc/khung, Vẽ/Tách nền không thao tác được trên
    // di động) — thiếu `touch-action: none`, mặc định kế thừa `touch-action: manipulation` từ
    // `body` (assets/css/base.css) — trình duyệt tự giành cử chỉ kéo ngón tay thành pan/scroll gốc
    // TRƯỚC KHI JS kịp nhận đủ `pointermove`, nên kéo tay trên canvas này gần như vô tác dụng. Cùng
    // pattern đã áp dụng đúng ở `.video-preview-trim-handle` (assets/css/video-preview.css).
    // FIX THẬT SỰ (xác nhận bằng log debug thật của Giang — MỌI pointerdown trong modal Edit đều
    // báo `target: image-edit-canvas-wrap`, KHÔNG BAO GIỜ là chính canvas này) — `assets/css/
    // base.css` có rule chọn theo TAG `canvas { ...; pointer-events: none; }` viết cho RIÊNG
    // `#visualizer`/`#webgl-canvas` (2 canvas ĐÓ đúng là không nên chặn click xuyên UI bên dưới) —
    // nhưng vì chọn theo tag thay vì `#id`, rule đó áp lên MỌI thẻ `<canvas>` trong toàn app, kể cả
    // 4 canvas ở đây. `interactCanvas` — nơi DUY NHẤT nhận pointerdown/move/up cho Crop/Vẽ/Shape/
    // Tách nền — vì vậy trong suốt hoàn toàn với chuột/tay, mọi thao tác xuyên thẳng qua nó rơi
    // xuống `canvasWrap` (cha nó, không hề wire listener nào) — giải thích ĐÚNG NGUYÊN VĂN "trigger
    // DOM chưa bao giờ kích hoạt". Thêm `pointer-events-auto` (Tailwind, specificity class > tag
    // nên thắng rule chung) — CHỈ riêng canvas này cần, 3 canvas base/render/layer chỉ hiển thị
    // (giữ nguyên `pointer-events: none` kế thừa, không cần nhận thao tác).
    interactCanvas.className = 'absolute w-full h-full touch-none pointer-events-auto';
    canvasWrap.append(baseCanvas, renderCanvas, layerCanvas, interactCanvas);
    mediaWrap.appendChild(canvasWrap);

    // ---- Popup chọn loại Shape (MỚI, tool Shape) — hiện lúc bấm tile "Shape" trong lưới, TRƯỚC
    // khi shape thật được tạo (chọn xong mới push layer + hiện contextBar để kéo/resize).
    const shapeTypePopup = document.createElement('div');
    shapeTypePopup.id = 'image-edit-shape-type-popup';
    shapeTypePopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    const shapeTypes = [
        { key: 'rect', path: 'M4 5h16v14H4z' },
        { key: 'circle', path: 'M12 4a8 8 0 100 16 8 8 0 000-16z' },
        { key: 'line', path: 'M4 20L20 4' },
        { key: 'arrow', path: 'M4 20L20 4M20 4H10M20 4v10' },
        { key: 'polygon', path: 'M12 3l8 6-3 10H7L4 9z' },
    ];
    shapeTypePopup.innerHTML = `
        <div class="flex justify-center gap-3">
            ${shapeTypes.map(s => `
                <button type="button" data-shape-type="${s.key}" class="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${s.path}"/></svg>
                </button>
            `).join('')}
        </div>
    `;
    overlay.appendChild(shapeTypePopup);

    // ---- Slider popup cho nhóm "Điều chỉnh" (brightness/contrast/...) — MỚI (31/07/2026), ẩn mặc
    // định, Workflow tự hiện lúc chọn 1 tool điều chỉnh từ Generic Drawer grid. Live-preview trực
    // tiếp (không có bước Cancel/Apply riêng như Crop — kéo tới đâu áp tới đó vào renderCanvas,
    // đúng khuôn "Lumina Pro" — đóng popup KHÔNG hoàn tác giá trị vừa chỉnh).
    const adjustPopup = document.createElement('div');
    adjustPopup.id = 'image-edit-adjust-popup';
    adjustPopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    adjustPopup.innerHTML = `
        <div class="flex justify-between items-center mb-3 text-sm">
            <span id="image-edit-adjust-label" class="text-white/90 font-medium"></span>
            <div class="flex items-center gap-2">
                <span id="image-edit-adjust-value" class="text-primary font-mono bg-white/10 px-2 py-0.5 rounded"></span>
                <button id="image-edit-adjust-done" type="button" class="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </button>
            </div>
        </div>
        <input type="range" id="image-edit-adjust-slider" min="-100" max="100" value="0" class="w-full">
    `;
    overlay.appendChild(adjustPopup);

    // ---- Context bar (Huỷ / tiêu đề / Áp dụng) — MỚI (31/07/2026), thay THẾ header lúc đang ở
    // Crop/Vẽ/Text (3 tool CẦN bước xác nhận riêng, khác "Điều chỉnh" live-preview không cần) —
    // Workflow tự ẩn header + hiện contextBar lúc vào 1 trong 3 tool này, đổi lại lúc thoát.
    const contextBar = document.createElement('div');
    contextBar.id = 'image-edit-context-bar';
    contextBar.className = 'hidden photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3';
    contextBar.innerHTML = `
        <button id="image-edit-context-cancel" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <span id="image-edit-context-title" class="text-white text-sm font-semibold tracking-wide"></span>
        <button id="image-edit-context-apply" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-primary hover:bg-blue-500 transition-colors text-white shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </button>
    `;
    overlay.appendChild(contextBar);

    // ---- Popup chọn tỉ lệ Crop — MỚI (bổ sung theo yêu cầu Giang, "crop không có danh sách chọn
    // tỉ lệ") — hiện SONG SONG với contextBar lúc tool Crop đang mở (KHÁC drawControlsPopup, vốn
    // LOẠI TRỪ NHAU với contextBar vì đều đặt `bottom-0` full-width — popup này dùng CHUNG khung nhỏ
    // hơn, đặt NGAY TRÊN contextBar thay vì đè full-width đáy màn hình, do Crop CẦN contextBar Huỷ/
    // Áp dụng HIỂN THỊ ĐỒNG THỜI, không thể ẩn header/hiện popup thay thế như Vẽ). Core delegation
    // (Rule 5a) — 1 listener duy nhất, đọc `data-crop-ratio`.
    const cropRatioPopup = document.createElement('div');
    cropRatioPopup.id = 'image-edit-crop-ratio-popup';
    cropRatioPopup.className = 'hidden absolute top-16 left-0 w-full flex justify-center gap-2 px-4 overflow-x-auto';
    const cropRatios = [
        { key: 'free', labelKey: 'fileManager.photo.image.cropRatioFree' },
        { key: '1:1', labelKey: 'fileManager.photo.image.cropRatioSquare' },
        { key: '4:3', label: '4:3' },
        { key: '3:4', label: '3:4' },
        { key: '16:9', label: '16:9' },
        { key: '9:16', label: '9:16' },
    ];
    cropRatioPopup.innerHTML = cropRatios.map(r => `
        <button type="button" data-crop-ratio="${r.key}" class="shrink-0 px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white text-xs font-medium border border-white/20 transition-colors">${r.label || t(r.labelKey)}</button>
    `).join('');
    overlay.appendChild(cropRatioPopup);

    // ---- Khung gõ chữ nổi (tool Text) — MỚI (31/07/2026), ẩn mặc định, kéo tay di chuyển được.
    const floatingText = document.createElement('div');
    floatingText.id = 'image-edit-floating-text';
    floatingText.contentEditable = 'true';
    floatingText.spellcheck = false;
    floatingText.className = 'hidden absolute z-20 touch-none bg-black/40 border border-dashed border-white text-white font-bold text-3xl px-4 py-2 min-w-[60px] text-center whitespace-pre-wrap break-words rounded-lg shadow-lg';
    floatingText.style.cursor = 'move';
    floatingText.textContent = t('fileManager.photo.image.editTextPlaceholder');
    overlay.appendChild(floatingText);

    // ---- Popup điều khiển Vẽ (Cọ/Tẩy + màu + cỡ nét) — MỚI (31/07/2026), ẩn mặc định.
    const drawControlsPopup = document.createElement('div');
    drawControlsPopup.id = 'image-edit-draw-popup';
    drawControlsPopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    drawControlsPopup.innerHTML = `
        <div class="flex justify-between items-center w-full mb-3">
            <div class="flex gap-4">
                <button id="image-edit-draw-brush" type="button" class="text-primary text-sm font-medium">${t('fileManager.photo.image.editDrawBrush')}</button>
                <button id="image-edit-draw-eraser" type="button" class="text-white/60 text-sm font-medium">${t('fileManager.photo.image.editDrawEraser')}</button>
            </div>
            <input type="color" id="image-edit-draw-color" value="#0A84FF" class="w-7 h-7 rounded-full p-0 border-0 bg-transparent overflow-hidden">
        </div>
        <input type="range" id="image-edit-draw-size" min="1" max="100" value="10" class="w-full">
    `;
    overlay.appendChild(drawControlsPopup);

    // XOÁ (Giang yêu cầu bỏ hẳn tool "Tách nền"/Cutout) — `magicPopup`/`image-edit-magic-slider`/
    // `image-edit-magic-value` (popup chỉnh dung sai màu trước tool này) đã xoá hẳn khỏi đây, cùng
    // lúc với `_startMagicTool()`/`updateMagicSlider()`/`magicPointerDown()` (event/workflow/image-
    // edit.js) + case liên quan (event/router/image-edit.js) + `applyMagicCutout()` (core/photo-
    // editor-engine.js) + 3 key lang (`editToolMagic`/`editMagicTolerance`/`editMagicHint`).

    // ---- Header nổi: X đóng (trái) + Đặt làm nền/Edit (phải, LUÔN hiện, không còn dropdown "...")
    const header = document.createElement('div');
    header.className = 'photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3 gap-2';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    header.appendChild(closeBtn);

    // XOÁ (gộp View/Zoom/Edit làm 1, bỏ dropdown "...") — menuBtn ("...", mở core/dropdown-menu.js)
    // bỏ hẳn. XOÁ (Giang yêu cầu bỏ "Đặt làm nền Playlist") — setPlaylistBgBtn cùng
    // workflowFileManagerPhoto.setAsPlaylistBackground() bỏ hẳn cùng tính năng, không còn entry
    // point nào khác gọi tới. 2 nút còn lại LUÔN hiện — KHÔNG có khái niệm "mode" nào cả (canvas
    // đã sẵn sàng xem/zoom/pan/edit từ lúc mở modal): `saveBtn` mở dropdown 2 lựa chọn (Ghi đè/
    // Lưu mới, Workflow tự build — dropdown CẦN biết có đang có gì để lưu hay không, dữ liệu đó
    // Core không được tự đọc, Rule 2), `toolsBtn` (icon bút chì) CHỈ mở Generic Drawer lưới tool —
    // không "vào" gì cả, không có nhánh nào để Router phải chọn.
    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex items-center gap-2';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    saveBtn.title = t('fileManager.photo.image.saveMenuTitle');
    saveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-4 4m0 0L7 3m4 4V1"/></svg>';
    rightGroup.appendChild(saveBtn);

    const toolsBtn = document.createElement('button');
    toolsBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    toolsBtn.title = t('fileManager.photo.image.editGridTitle');
    toolsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
    rightGroup.appendChild(toolsBtn);
    header.appendChild(rightGroup);
    overlay.appendChild(header);

    document.body.appendChild(overlay);

    // --- addEventListener: gom cuối hàm, sau khi cây DOM đã dựng xong hoàn toàn (Rule 5a) ---
    // `img` 'load' KHÔNG bắn eventBus — đây không phải quyết định nghiệp vụ theo tương tác người
    // dùng (Rule 5a chỉ áp cho đó), chỉ là chỉnh object-fit thuần trình bày dựa trên kích thước ảnh
    // vừa đo được, không ai cần biết/quyết định gì thêm ở Router/Workflow.
    img.addEventListener('load', () => {
        img.style.objectFit = computeCoverOrContain(img.naturalWidth, img.naturalHeight);
    }, { once: true });
    // KHÔNG gọi closeModal()/callback tham số nữa (SAI Rule 5a, xem docstring) — bắn thẳng eventBus.
    // Không còn Block gate nào chặn nút X (xem event/block.js) — không có "mode" nào phải thoát
    // trước khi đóng.
    closeBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.close.click', payload: {} }));
    saveBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.save.click', payload: { anchorEl: saveBtn } }));
    toolsBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.tools.click', payload: {} }));
    // SỬA (31/07/2026, Giang chỉ ra vi phạm Rule 5a mục 5) — 5 nút Edit mode dưới đây TRƯỚC ĐÂY bị
    // `event/workflow/image-edit.js` tự gán LẠI `.onclick` mỗi lần vào/thoát sub-tool khác nhau
    // (rải rác ở 4 hàm `_startXxxTool()` khác nhau, KHÔNG "gom cuối hàm", callback gọi thẳng
    // `this.xxx()` thay vì `eventBus.send()`) — SAI CẢ 2 điều kiện Rule 5a. Giờ wire ĐÚNG 1 LẦN ở
    // đây, msg.type CỐ ĐỊNH bất kể tool nào đang mở — Router (`imageEdit`) tự đọc
    // `workflowImageEdit.getActiveSubTool()` qua VirtualMachineState để chọn hàm Áp dụng đúng (Rule
    // 1: nơi gọi chọn hàm, không phải nút tự đổi nghĩa). `contextCancelBtn`/`adjustDoneBtn` hành vi
    // GIỐNG HỆT bất kể tool nào (`exitSubTool()`/`exitAdjustTool()`), không cần Router phân nhánh.
    contextBar.querySelector('#image-edit-context-cancel').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.subTool.cancel.click', payload: {} }));
    contextBar.querySelector('#image-edit-context-apply').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.subTool.apply.click', payload: {} }));
    adjustPopup.querySelector('#image-edit-adjust-done').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.adjust.done.click', payload: {} }));
    drawControlsPopup.querySelector('#image-edit-draw-brush').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.draw.selectBrush.click', payload: {} }));
    drawControlsPopup.querySelector('#image-edit-draw-eraser').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.draw.selectEraser.click', payload: {} }));
    // Delegation (Rule 5a) — cropRatioPopup có nhiều nút cùng cấu trúc `[data-crop-ratio]`, 1
    // listener duy nhất đọc `dataset.cropRatio` thay vì wire riêng từng nút.
    cropRatioPopup.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-crop-ratio]');
        if (!btn) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.crop.setRatio.click', payload: { ratio: btn.dataset.cropRatio } });
    });
    // Delegation (Rule 5a) — tương tự cropRatioPopup, cho `[data-shape-type]`.
    shapeTypePopup.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-shape-type]');
        if (!btn) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.shapeType.select.click', payload: { shapeType: btn.dataset.shapeType } });
    });

    // SỬA (31/07/2026, Giang chỉ ra "Nhóm B không có ngoại lệ nào trong tài liệu") — pointer
    // Crop/Vẽ/Tách nền (`interactCanvas`) + kéo Text (`floatingText`) + 2 slider (Điều chỉnh/dung
    // sai Tách nền) TRƯỚC ĐÂY bị Workflow tự `addEventListener`/`removeEventListener` theo vòng đời
    // từng sub-tool — SAI Rule 5a y hệt 5 nút phía trên, KHÔNG có ngoại lệ nào miễn cho tần suất
    // event cao (Rule 4 chỉ miễn `console.log`, không miễn `addEventListener`/`eventBus`). Wire
    // ĐÚNG 1 LẦN ở đây, callback tính sẵn toạ độ/giá trị rồi CHỈ `eventBus.send()` — Router
    // (`imageEdit`) tự đọc `getActiveSubTool()` mỗi lần nhận để quyết định chạy gì (kể cả KHÔNG
    // chạy gì nếu đang 'none'/tool không liên quan — an toàn, hàm rẻ).
    // FIX (bug có từ trước, Giang báo "sửa rất nhiều lần vẫn không giữ/kéo được khung Crop, không
    // kéo được góc") — CÔNG THỨC CŨ coi `rect` (hộp CSS `w-full h-full` của canvas) là vùng ẢNH THẬT
    // SỰ đang hiển thị, rồi quy đổi thẳng 1 tỉ lệ `canvas.width / rect.width` — ĐÚNG CHỈ KHI ảnh phủ
    // KHÍT hộp không dư khoảng trống nào. Nhưng `object-fit` (đặt ở `syncEditCanvasDisplaySize()`,
    // 'cover' HOẶC 'contain' tuỳ hướng ảnh so màn hình, xem `computeCoverOrContain()`) khiến vùng ẢNH
    // THẬT hiển thị bên trong `rect` KHÔNG khớp `rect` — 'contain' để lại viền đen 2 bên (ảnh THU
    // NHỎ, chừa khoảng trống), 'cover' phóng to ảnh TRÀN ra ngoài rồi cắt bớt (ảnh THẬT hiển thị LỚN
    // HƠN `rect`) — cả 2 trường hợp `rect` đều LỆCH khỏi vùng ảnh thật, CÀNG lệch hướng ảnh/màn hình
    // càng khác nhau (ảnh ngang xem màn dọc: viền đen trên/dưới có thể chiếm phần LỚN `rect.height`)
    // — mọi toạ độ chạm tính theo công thức cũ vì vậy SAI cả biên độ lẫn có thể LỆCH TỚI MỨC rơi ra
    // ngoài `[0, canvas.width/height]` hẳn — hit-test 4 handle góc/khung Crop (core/media-
    // transform.js::cropSessionPointerDown()) trật lất, "giữ kéo" KHÔNG BAO GIỜ trúng `activeHandle`
    // nào nên coi như không phản hồi. Từng "sửa" trước đây (thêm `touch-action:none`) ĐÚNG nhưng
    // CHƯA ĐỦ — chỉ giải quyết việc trình duyệt giành cử chỉ, không giải quyết toạ độ tính sai.
    // SỬA: tính lại ĐÚNG vùng ảnh thật hiển thị bên trong `rect` theo CHÍNH `object-fit` đang áp
    // dụng (đọc `interactCanvas.style.objectFit`, luôn đồng bộ với 3 canvas kia qua
    // `syncEditCanvasDisplaySize()`) — `displayScale` = tỉ lệ CSS-px/canvas-px THẬT (nhỏ nhất cho
    // 'contain' — ảnh co vừa khít, khoảng dư 2 bên; lớn nhất cho 'cover' — ảnh phóng tràn, cắt bớt 2
    // bên) — từ đó suy `offsetX`/`offsetY` (khoảng lệch tâm giữa `rect` và vùng ảnh thật, ÂM cho
    // 'cover' vì ảnh tràn RA NGOÀI `rect`, DƯƠNG cho 'contain' vì ảnh THỤT VÀO trong `rect`) — TRỪ
    // khoảng lệch này TRƯỚC khi quy đổi toạ độ mới ra đúng hệ canvas-pixel. `_editScale()`
    // (event/workflow/image-edit.js) tính RIÊNG cùng công thức (Rule 3a, core không gọi core khác —
    // xem docstring hàm đó) cho các con số THUẦN KÍCH THƯỚC (bán kính chạm, ngưỡng kéo tối thiểu...).
    const computeInteractPos = (clientX, clientY) => {
        const rect = interactCanvas.getBoundingClientRect();
        const cw = interactCanvas.width, ch = interactCanvas.height;
        if (!cw || !ch || !rect.width || !rect.height) return { x: clientX - rect.left, y: clientY - rect.top }; // guard hiếm (canvas chưa layout/decode xong)
        const fitMode = interactCanvas.style.objectFit || 'cover';
        const displayScale = fitMode === 'contain'
            ? Math.min(rect.width / cw, rect.height / ch)
            : Math.max(rect.width / cw, rect.height / ch);
        const offsetX = (rect.width - cw * displayScale) / 2, offsetY = (rect.height - ch * displayScale) / 2;
        return { x: (clientX - rect.left - offsetX) / displayScale, y: (clientY - rect.top - offsetY) / displayScale };
    };
    interactCanvas.addEventListener('pointerdown', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerDown', payload: computeInteractPos(e.clientX, e.clientY) }));
    interactCanvas.addEventListener('pointermove', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerMove', payload: computeInteractPos(e.clientX, e.clientY) }));
    interactCanvas.addEventListener('pointerup', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerUp', payload: {} }));
    interactCanvas.addEventListener('pointerleave', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerUp', payload: {} })); // trượt ra ngoài canvas lúc đang kéo = coi như nhả tay, cùng msg.type

    // `floatingText.pointerdown` wire Ở ĐÂY (phần tử ĐỘNG, tạo mới mỗi lần mở modal — đúng chỗ).
    // `document.pointermove`/`pointerup` theo dõi TIẾP quá trình kéo KHÔNG được wire ở đây — `document`
    // KHÔNG phải phần tử động của modal này (không tự mất khi modal đóng), wire lại mỗi lần mở modal
    // sẽ CHỒNG CHẤT listener qua nhiều lần mở/đóng — 2 listener đó wire ĐÚNG 1 LẦN DUY NHẤT ở
    // event/listener/image-edit.js (DOM tĩnh thật sự, đúng tầng Listener — xem file đó).
    floatingText.addEventListener('pointerdown', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.floatingText.pointerDown', payload: {} }));

    const adjustSliderEl = adjustPopup.querySelector('#image-edit-adjust-slider');
    adjustSliderEl.addEventListener('input', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.adjust.slider.input', payload: { value: parseInt(e.target.value, 10) } }));

    // `mediaWrap` luôn được trả về — Panzoom (Zoom, luôn bật SUỐT vòng đời modal, xem
    // workflowFileManagerPhoto._initZoom()) gắn lên ĐÂY, KHÔNG gắn thẳng `<img>` — canvas vẽ ĐÈ lên
    // `<img>` ngay khi decode xong (KHÔNG có toggle ẩn/hiện nào), Panzoom không hề bị đụng tới.
    // `interactCanvas` PHẢI truyền vào `exclude` của Panzoom (xem `_initZoom()`) — nếu không, chạm
    // kéo Crop/Vẽ trên đó sẽ bị Panzoom giành mất thành cử chỉ pan.
    return {
        close: closeModal, imgEl: img, mediaWrap, canvasWrap, baseCanvas, renderCanvas, layerCanvas, interactCanvas, toolsBtn,
        header,
        adjustPopup, adjustLabelEl: adjustPopup.querySelector('#image-edit-adjust-label'),
        adjustValueEl: adjustPopup.querySelector('#image-edit-adjust-value'),
        adjustSliderEl,
        adjustDoneBtn: adjustPopup.querySelector('#image-edit-adjust-done'),
        contextBar, contextCancelBtn: contextBar.querySelector('#image-edit-context-cancel'),
        contextTitleEl: contextBar.querySelector('#image-edit-context-title'),
        contextApplyBtn: contextBar.querySelector('#image-edit-context-apply'),
        cropRatioPopup,
        shapeTypePopup,
        floatingText,
        drawControlsPopup, drawBrushBtn: drawControlsPopup.querySelector('#image-edit-draw-brush'),
        drawEraserBtn: drawControlsPopup.querySelector('#image-edit-draw-eraser'),
        drawColorEl: drawControlsPopup.querySelector('#image-edit-draw-color'),
        drawSizeEl: drawControlsPopup.querySelector('#image-edit-draw-size'),
    };
}

// ===================== "Nhóm A" (31/07/2026, Giang chỉ ra) =====================
// `event/workflow/image-edit.js` TRƯỚC ĐÂY tự `addEventListener` cho DOM ĐỘNG (Generic Drawer bởi
// `openGenericDrawer()`) — SAI: Rule 5a cấp quyền `addEventListener` cho DOM động là quyền của
// CORE (hàm dựng ra cụm DOM đó), không phải Workflow — vấn đề là NƠI ĐẶT lệnh `addEventListener`,
// không phải nội dung callback. 2 hàm dưới đây dời TOÀN BỘ phần wire sang đây — Workflow giờ CHỈ
// còn gọi các hàm này NGAY SAU `openGenericDrawer()` (Workflow gọi Core, không tự cầm DOM API).
// Hàm mở Generic Drawer picker ảnh/video (khác Edit tool grid dưới đây) đã DỜI sang
// core/media-picker-drawer-helper.js::openMediaPickerDrawerUi() — dùng chung nhiều domain, không
// thuộc riêng miền Photo nữa.

/** Mở Generic Drawer lưới tool Edit mode — dựng headerHtml + gọi `openGenericDrawer()` + wire NGAY
 * closeBtn, TẤT CẢ Ở ĐÂY (Rule 5a).
 * @param {string} title @param {string} bodyHtml
 */
function openPhotoEditToolGridDrawerUi(title, bodyHtml) {
    openGenericDrawer({ // core/generic-drawer.js
        height: 'auto', maxHeight: '70vh',
        zIndex: Z_INDEX.IMAGE_ACTION_MENU_DRAWER, // service/z-index.js (131) — TRÊN modal xem ảnh (130)
        headerHtml: `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `,
        bodyHtml,
        bodyClass: 'overflow-y-auto',
    });
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.toolGrid.close.click', payload: {} }));
}

/** Wire delegated click trên `genericDrawerBody` cho tile lưới tool (`[data-edit-tool]`) — gọi
 * ĐÚNG 1 lần/phiên xem ảnh (`ensureEditSessionReady()`), KHÔNG gọi lại mỗi lần
 * `openPhotoEditToolGridDrawerUi()` mở lại lưới (listener cũ không tự mất theo `innerHTML`, gắn lại
 * sẽ chồng chất — xem cách dùng ở `event/workflow/image-edit.js::_wireEditToolGridDelegation()`).
 * Cùng lý do "PHẢI tự wire/gỡ theo vòng đời" như `openMediaPickerDrawerUi()` (core/media-picker-
 * drawer-helper.js).
 * @returns {() => void} hàm gỡ — Workflow tự lưu, gọi lúc đóng hẳn modal.
 */
function wirePhotoEditToolGridDelegation() {
    const handler = (e) => {
        const tile = e.target.closest('[data-edit-tool]');
        if (!tile) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.toolGrid.tile.click', payload: { tool: tile.dataset.editTool } });
    };
    genericDrawerBody.addEventListener('click', handler);
    return () => genericDrawerBody.removeEventListener('click', handler);
}

// XOÁ (Giang chỉ ra `workflowElementStyleEditor` — event/workflow/element-style-editor.js — vốn đã
// là công cụ CHUNG dùng bởi Subtitle Styling, không cần tự chế Generic Drawer riêng cho Photo layer
// Text/Shape nữa) — `openPhotoLayerStyleDrawerUi()`/`wireLayerStyleDrawerDelegation()` đã xoá hẳn,
// `openLayerStyleEditor()` (event/workflow/image-edit.js) giờ gọi thẳng
// `workflowElementStyleEditor.open()`. 0 lời gọi nào khác còn tới 2 hàm này (tự audit xác nhận).

