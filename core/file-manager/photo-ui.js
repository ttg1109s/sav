/**
 * core/file-manager/photo-ui.js — Vẽ UI Photo: modal xem ảnh full-screen (View/Zoom/Edit đã GỘP
 * làm 1, không còn dropdown "...") + UI cho Edit mode (grid tool phẳng trong Generic Drawer, không
 * còn nhóm header). Picker chọn 1 ảnh dùng chung (cover bài hát/nền Theme) đã DỜI sang
 * core/media-picker-drawer-helper.js::openMediaPickerDrawerUi() — không còn ở file này. Grid ảnh
 * chính (Photo Source trong Playlist) dùng event/workflow/photo-gallery-window.js (fjGallery +
 * IntersectionObserver) — không đụng tới file này.
 *
 * NẠP SAU: lang/lang.js (t()), core/generic-drawer.js, service/z-index.js.
 */

/**
 * Modal xem ảnh full-screen — dựng cụm DOM MỚI (Rule 5a: DOM mới tự tạo bằng `createElement` được
 * phép tự `addEventListener`, miễn callback CHỈ bắn `eventBus.send()`, gom cuối hàm — xem khuôn ở
 * cuối hàm này). GỘP View/Zoom/Edit làm 1 THẬT SỰ (bỏ dropdown "...", KHÔNG có khái niệm "mode" nào
 * cần pause/resume) — `<img>` và canvasWrap (Edit mode) đều nằm trong `mediaWrap`, Panzoom gắn lên
 * `mediaWrap` (không gắn thẳng `<img>`), nên pan/zoom chạy LIÊN TỤC suốt vòng đời modal, không bị
 * ảnh hưởng bởi việc ẩn/hiện `<img>` hay canvasWrap bên trong. Header LUÔN hiện 2 icon cố định
 * (Save/Edit) thay vì ẩn sau menu, Core không cần biết đang ở "mode" nào để quyết định hiện gì
 * (Rule 2). Workflow (event/workflow/file-manager-photo.js) đọc `_activeImageKey` (instance field
 * lưu sẵn lúc mở modal) thay vì nhận qua closure tham số.
 * @param {{key: string, blob: Blob, filename: string}} image
 * @returns {{close: () => void, imgEl: HTMLImageElement, mediaWrap: HTMLElement, canvasWrap: HTMLElement, baseCanvas: HTMLCanvasElement, renderCanvas: HTMLCanvasElement, interactCanvas: HTMLCanvasElement, toolsBtn: HTMLElement}}
 */
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

    // ---- Khung canvas cho Edit mode (base/render/interact) — MỚI (31/07/2026), ẩn mặc định, chỉ
    // hiện khi vào Edit mode (workflowImageEdit.enterEditMode() dựng nội dung + gỡ 'hidden').
    // Đúng khuôn prototype "Lumina Pro" Giang cung cấp: base = pixel gốc sau thao tác vĩnh viễn,
    // render = kết quả filter hiện tại (không phá base, cho phép chỉnh lại), interact = overlay
    // tương tác (khung crop/nét vẽ nháp — CHƯA dùng ở bản đầu, chỉ mục "Điều chỉnh").
    const canvasWrap = document.createElement('div');
    canvasWrap.id = 'image-edit-canvas-wrap';
    canvasWrap.className = 'hidden absolute inset-0 flex items-center justify-center';
    const baseCanvas = document.createElement('canvas');
    baseCanvas.id = 'image-edit-base-canvas';
    baseCanvas.className = 'absolute max-w-full max-h-full';
    const renderCanvas = document.createElement('canvas');
    renderCanvas.id = 'image-edit-render-canvas';
    renderCanvas.className = 'absolute max-w-full max-h-full';
    const interactCanvas = document.createElement('canvas');
    interactCanvas.id = 'image-edit-interact-canvas';
    // FIX (bug có từ trước — Crop không kéo được góc/khung, Vẽ/Tách nền không thao tác được trên
    // di động) — thiếu `touch-action: none`, mặc định kế thừa `touch-action: manipulation` từ
    // `body` (assets/css/base.css) — trình duyệt tự giành cử chỉ kéo ngón tay thành pan/scroll gốc
    // TRƯỚC KHI JS kịp nhận đủ `pointermove`, nên kéo tay trên canvas này gần như vô tác dụng. Cùng
    // pattern đã áp dụng đúng ở `.video-preview-trim-handle` (assets/css/video-preview.css).
    interactCanvas.className = 'absolute max-w-full max-h-full touch-none';
    canvasWrap.append(baseCanvas, renderCanvas, interactCanvas);
    mediaWrap.appendChild(canvasWrap);

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
    // tỉ lệ") — hiện SONG SONG với contextBar lúc tool Crop đang mở (KHÁC drawControlsPopup/
    // magicPopup, vốn LOẠI TRỪ NHAU với contextBar vì đều đặt `bottom-0` full-width — popup này
    // dùng CHUNG khung nhỏ hơn, đặt NGAY TRÊN contextBar thay vì đè full-width đáy màn hình, do
    // Crop CẦN contextBar Huỷ/Áp dụng HIỂN THỊ ĐỒNG THỜI, không thể ẩn header/hiện popup thay thế
    // như Vẽ/Tách nền). Core delegation (Rule 5a) — 1 listener duy nhất, đọc `data-crop-ratio`.
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

    // ---- Popup dung sai màu (tool Tách nền) — MỚI (31/07/2026), ẩn mặc định.
    const magicPopup = document.createElement('div');
    magicPopup.id = 'image-edit-magic-popup';
    magicPopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    magicPopup.innerHTML = `
        <div class="flex justify-between text-xs text-white/70 mb-2">
            <span>${t('fileManager.photo.image.editMagicTolerance')}</span>
            <span id="image-edit-magic-value" class="font-mono">30</span>
        </div>
        <input type="range" id="image-edit-magic-slider" min="1" max="150" value="30" class="w-full">
        <p class="text-[11px] text-center text-white/50 mt-2">${t('fileManager.photo.image.editMagicHint')}</p>
    `;
    overlay.appendChild(magicPopup);

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
    // point nào khác gọi tới. 2 nút còn lại LUÔN hiện (không còn `hidden` chờ Workflow gỡ) — KHÔNG
    // có khái niệm "mode" nào cần bật lên mới thấy nút hay phải thoát mới đóng được (View/Zoom/Edit
    // chạy đồng thời, xem event/workflow/file-manager-photo.js): `saveBtn` mở dropdown 2 lựa chọn
    // (Ghi đè/Lưu mới, Workflow tự build — dropdown CẦN biết có đang có gì để lưu hay không, dữ
    // liệu đó Core không được tự đọc, Rule 2), `toolsBtn` (icon bút chì) mở Generic Drawer lưới tool
    // Edit — Router (`imageEdit`) tự đọc `workflowImageEdit.isEditModeActive()` để biết mở lần đầu
    // hay mở lại lưới (Rule 1: nơi gọi chọn hàm, nút không tự đổi nghĩa).
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
        const imageIsLandscape = img.naturalWidth >= img.naturalHeight;
        const screenIsLandscape = window.innerWidth >= window.innerHeight;
        img.style.objectFit = (imageIsLandscape === screenIsLandscape) ? 'cover' : 'contain';
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

    // SỬA (31/07/2026, Giang chỉ ra "Nhóm B không có ngoại lệ nào trong tài liệu") — pointer
    // Crop/Vẽ/Tách nền (`interactCanvas`) + kéo Text (`floatingText`) + 2 slider (Điều chỉnh/dung
    // sai Tách nền) TRƯỚC ĐÂY bị Workflow tự `addEventListener`/`removeEventListener` theo vòng đời
    // từng sub-tool — SAI Rule 5a y hệt 5 nút phía trên, KHÔNG có ngoại lệ nào miễn cho tần suất
    // event cao (Rule 4 chỉ miễn `console.log`, không miễn `addEventListener`/`eventBus`). Wire
    // ĐÚNG 1 LẦN ở đây, callback tính sẵn toạ độ/giá trị rồi CHỈ `eventBus.send()` — Router
    // (`imageEdit`) tự đọc `getActiveSubTool()` mỗi lần nhận để quyết định chạy gì (kể cả KHÔNG
    // chạy gì nếu đang 'none'/tool không liên quan — an toàn, hàm rẻ).
    const computeInteractPos = (clientX, clientY) => {
        const rect = interactCanvas.getBoundingClientRect();
        const scale = interactCanvas.width / (rect.width || interactCanvas.width || 1); // guard chia 0 hiếm (canvas chưa layout xong)
        return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
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
    const magicSliderEl = magicPopup.querySelector('#image-edit-magic-slider');
    magicSliderEl.addEventListener('input', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.magic.slider.input', payload: { value: parseInt(e.target.value, 10) } }));

    // `mediaWrap` luôn được trả về — Panzoom (Zoom, luôn bật SUỐT vòng đời modal, xem
    // workflowFileManagerPhoto._initZoom()) gắn lên ĐÂY, KHÔNG gắn thẳng `<img>` — pan/zoom nhờ vậy
    // áp dụng như nhau cho CẢ xem ảnh thường LẪN Edit mode, không cần huỷ/tạo lại session khi
    // `enterEditMode()` ẩn `imgEl`/hiện `canvasWrap` (KHÔNG có khái niệm "mode" nào cần pause/resume
    // Zoom — session Panzoom chạy liên tục, KHÔNG bị đụng tới cho tới khi đóng hẳn modal).
    // `interactCanvas` PHẢI truyền vào `exclude` của Panzoom (xem `_initZoom()`) — nếu không, chạm
    // kéo Crop/Vẽ/Tách nền trên đó sẽ bị Panzoom giành mất thành cử chỉ pan.
    return {
        close: closeModal, imgEl: img, mediaWrap, canvasWrap, baseCanvas, renderCanvas, interactCanvas, toolsBtn,
        header,
        adjustPopup, adjustLabelEl: adjustPopup.querySelector('#image-edit-adjust-label'),
        adjustValueEl: adjustPopup.querySelector('#image-edit-adjust-value'),
        adjustSliderEl,
        adjustDoneBtn: adjustPopup.querySelector('#image-edit-adjust-done'),
        contextBar, contextCancelBtn: contextBar.querySelector('#image-edit-context-cancel'),
        contextTitleEl: contextBar.querySelector('#image-edit-context-title'),
        contextApplyBtn: contextBar.querySelector('#image-edit-context-apply'),
        cropRatioPopup,
        floatingText,
        drawControlsPopup, drawBrushBtn: drawControlsPopup.querySelector('#image-edit-draw-brush'),
        drawEraserBtn: drawControlsPopup.querySelector('#image-edit-draw-eraser'),
        drawColorEl: drawControlsPopup.querySelector('#image-edit-draw-color'),
        drawSizeEl: drawControlsPopup.querySelector('#image-edit-draw-size'),
        magicPopup, magicValueEl: magicPopup.querySelector('#image-edit-magic-value'),
        magicSliderEl,
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

/** Wire delegated click trên `genericDrawerBody` cho tile lưới tool Edit mode (`[data-edit-tool]`)
 * — gọi ĐÚNG 1 lần/phiên Edit mode (`enterEditMode()`), KHÔNG gọi lại mỗi lần
 * `openPhotoEditToolGridDrawerUi()` mở lại lưới (listener cũ không tự mất theo `innerHTML`, gắn lại
 * sẽ chồng chất — xem cách dùng ở `event/workflow/image-edit.js::_wireEditToolGridDelegation()`).
 * Cùng lý do "PHẢI tự wire/gỡ theo vòng đời" như `openMediaPickerDrawerUi()` (core/media-picker-
 * drawer-helper.js).
 * @returns {() => void} hàm gỡ — Workflow tự lưu, gọi lúc thoát Edit mode.
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

