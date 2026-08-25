/**
 * event/workflow/image-edit.js — TÁCH RA từ event/workflow/file-manager-photo.js (31/07/2026, yêu
 * cầu Giang) — toàn bộ "Edit mode" của modal xem ảnh Photo (lưới tool phẳng, Điều chỉnh/Crop/Vẽ/
 * Text/Tách nền, Lưu đè/Lưu mới). Router riêng: event/router/image-edit.js (tên `imageEdit`).
 *
 * Biên giới tách theo TRÁCH NHIỆM, không theo file — `workflowFileManagerPhoto` (miền khác) vẫn giữ
 * vòng đời modal xem ảnh (mở/đóng/Zoom), lộ 2 khe ĐỌC cho workflow này tự lấy lại
 * handle/imageKey lúc `enterEditMode()` (`getActiveImageModalHandle()`/`getActiveImageKey()`) —
 * SNAPSHOT lại thành field RIÊNG của chính workflow này ngay lúc vào Edit mode (không đổi trong
 * suốt phiên Edit), dùng lại y hệt tên cũ cho khỏi phải sửa toàn bộ thân hàm bên dưới. `exitEditMode()`
 * (public, không underscore) được `workflowFileManagerPhoto` gọi ngược lại lúc đóng HẲN modal xem
 * ảnh — Workflow-gọi-Workflow tự do, xem event-bus-flow.md mục 4B "Tái dùng Workflow giữa các miền
 * khác nhau".
 *
 * KHÔNG có khái niệm "mode" nào cần thoát — View/Zoom/Edit tích hợp sẵn, chạy đồng thời THẬT SỰ
 * (bỏ dropdown "..." + state `imagePreviewMode` cũ). Zoom (Panzoom) gắn lên `mediaWrap` (bọc CHUNG
 * `<img>` + canvasWrap, core/file-manager/photo-ui.js) — KHÔNG pause/resume khi vào/ra Edit, ẩn/
 * hiện `<img>`/canvasWrap bên trong không đụng gì tới session Panzoom đang chạy (xem
 * workflowFileManagerPhoto._initZoom()). Bấm icon Edit lần đầu decode ảnh vào canvas + ẩn `<img>`,
 * rồi mở Generic Drawer lưới tool. Đóng Drawer (nút X) CHỈ đóng Drawer — canvas VẪN hiện nguyên,
 * không có bước "quay lại xem ảnh thường" nào cả; bấm lại icon Edit chỉ đơn giản mở lại lưới
 * (`openEditToolGrid()`). Chỉ khi đóng HẲN modal xem ảnh mới thật sự dọn sạch mọi state Edit
 * (`exitEditMode()`).
 *
 * NẠP SAU: event/workflow/file-manager-photo.js, event/workflow/generic-drawer-helpers.js,
 * core/photo-editor-engine.js, core/crop-selector.js, core/generic-drawer.js, service/z-index.js.
 */
const workflowImageEdit = {

    _activeImageModalHandle: null, // snapshot từ workflowFileManagerPhoto.getActiveImageModalHandle() lúc enterEditMode()
    _activeImageKey: null,         // snapshot từ getActiveImageKey() — decode canvas cần lại
    _activeEditParams: null,       // {brightness,contrast,saturation,temperature,tint,sharpen} — null khi không ở Edit mode
    _activeAdjustParam: null,      // key param đang mở slider — null khi popup adjust đang ẩn
    _activeSubTool: 'none',        // 'none'|'crop'|'draw'|'text'|'magic'|'shapePlacement' — KHÁC 'adjust' (live-preview trực tiếp, không có sub-tool mode riêng)
    _editToolGridClickHandler: null, // hàm GỠ trả về từ wirePhotoEditToolGridDelegation() (core/file-manager/photo-ui.js), wire 1 lần/phiên
    _cropSession: null,            // session core/crop-selector.js — dùng CHUNG cho 'crop' VÀ 'shapePlacement' (kéo khung/handle giống hệt nhau về mặt hình học, xem selectShapeType()) — chỉ có nghĩa khi _activeSubTool là 1 trong 2 tool đó
    _drawType: 'brush',            // 'brush'|'eraser'
    _drawSessionActive: false,     // SỬA (31/07/2026, Nhóm B) — THAY biến `isDrawing` closure cũ (đã xoá cùng _wireSubToolPointerEvents()) — true trong lúc đang kéo vẽ 1 nét
    _drawLastPos: null,            // THAY biến `lastPos` closure cũ — điểm cuối cùng đã vẽ, nối tiếp nét kế tiếp
    _textDragging: false,          // SỬA (31/07/2026, Nhóm B) — THAY biến `dragging` closure cũ (đã xoá cùng _wireFloatingTextDrag()) — true trong lúc đang kéo floatingText. Router gọi updateTextDrag()/endTextDrag() TỪ document pointermove/pointerup TOÀN APP (event/listener/image-edit.js) — field này là "cổng" duy nhất quyết định có làm gì hay không

    // ===== Layer (Text/Shape) — MỚI, Giang yêu cầu "text/shape là layer chỉnh sửa lại được" =====
    // KHÁC HẲN Crop/Vẽ/Tách nền (nướng thẳng vào baseCanvas, không hoàn tác được) — layer giữ dạng
    // OBJECT trong suốt phiên Edit, vẽ lại MỖI LẦN đổi lên `layerCanvas` riêng (xem _renderLayers()),
    // chỉ "nướng" thật vào pixel lúc Lưu (_exportEditedBlob() gộp layerCanvas vào ảnh xuất).
    _layers: [],                   // {id, type:'text', text, x, y, fontSizePx, color} | {id, type:'shape', shapeType, x, y, w, h, fillColor, strokeColor, strokeWidth, sides?}
    _layerIdSeq: 0,                // bộ đếm sinh id layer duy nhất trong phiên (Nhân bản cần id KHÁC bản gốc)
    _selectedLayerIndex: -1,       // index trong _layers đang kéo/vừa long-press/đang mở style editor — -1 = không có
    _layerDragStart: null,         // {x, y, layerX, layerY} (toạ độ canvas-pixel) lúc bắt đầu chạm 1 layer — null = không đang tương tác
    _layerDragMoved: false,        // đã kéo đủ xa để coi là "di chuyển" (huỷ hẹn giờ long-press) hay chưa
    _layerLongPressTimer: null,    // setTimeout id chờ 1.5s mở menu Sửa/Xoá/Nhân bản — null = không có hẹn giờ nào đang chờ
    _layerStyleDrawerClickHandler: null, // hàm GỠ trả về từ wireLayerStyleDrawerDelegation() — chỉ có nghĩa lúc style editor đang mở

    /** Cấu hình min/max mỗi param điều chỉnh — sharpen từ 0 (không "âm"), còn lại -100..100. */
    _adjustParamConfig: {
        brightness: { min: -100, max: 100 }, contrast: { min: -100, max: 100 }, saturation: { min: -100, max: 100 },
        temperature: { min: -100, max: 100 }, tint: { min: -100, max: 100 }, sharpen: { min: 0, max: 100 },
    },

    /** @returns {boolean} đang ở Edit mode hay không — khe ĐỌC cho Router (case 'imageEdit.tools.
     * click') chọn `enterEditMode()` (vào lần đầu) hay `openEditToolGrid()` (mở lại lưới, vd sau
     * khi tự đóng Drawer bằng nút X — đóng Drawer KHÔNG thoát Edit, xem docstring
     * `openPhotoEditToolGridDrawerUi()`/case `imageEdit.toolGrid.close.click`) qua VirtualMachineState. */
    isEditModeActive() { return this._activeEditParams !== null; },

    /** Đảm bảo ảnh đã decode vào canvas (`baseCanvas`/`renderCanvas`) — idempotent, gọi được từ CẢ
     * `enterEditMode()` (bấm icon Edit) LẪN `openSaveMenu()` (bấm icon Save mà CHƯA từng mở Edit
     * lần nào — "Lưu mới" lúc đó vẫn hợp lệ, nghĩa là nhân bản ảnh nguyên trạng). KHÔNG đụng tới
     * hiển thị (`imgEl`/`canvasWrap`) — chỉ chuẩn bị dữ liệu, phần hiện canvas là việc RIÊNG của
     * `enterEditMode()`.
     * @returns {Promise<boolean>} false nếu không còn modal/ảnh để decode (guard hiếm)
     */
    async ensureEditSessionReady() {
        if (this._activeEditParams) return true; // đã sẵn sàng từ trước (đang/đã từng edit trong phiên modal này)
        const handle = workflowFileManagerPhoto.getActiveImageModalHandle();
        if (!handle) return false; // guard: modal đã đóng ở đâu đó trước khi tới đây
        this._activeImageModalHandle = handle;
        this._activeImageKey = workflowFileManagerPhoto.getActiveImageKey();

        const record = await getImageRecord(this._activeImageKey); // service/db.js — đọc lại BLOB gốc thật, không dùng lại objectUrl <img>
        if (!record) return false; // guard hiếm: ảnh vừa bị xoá ở tab khác

        const decoded = await decodeImageToCanvas(record.blob); // core/photo-editor-engine.js
        [handle.baseCanvas, handle.renderCanvas, handle.layerCanvas, handle.interactCanvas].forEach(c => {
            c.width = decoded.width; c.height = decoded.height;
        });
        handle.baseCanvas.getContext('2d').drawImage(decoded, 0, 0);
        handle.renderCanvas.getContext('2d').drawImage(decoded, 0, 0);
        syncEditCanvasDisplaySize(handle); // core/file-manager/photo-ui.js — FIX bug "ảnh co lại lúc vào Edit"
        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
        this._layers = []; // MỚI (layer Text/Shape) — reset mỗi lần bắt đầu 1 phiên Edit MỚI (ảnh mới/lần mở modal mới), tránh layer ảnh trước lẫn sang ảnh sau
        return true;
    },

    /** Vào Edit mode (router `imageEdit`, case 'imageEdit.tools.click' khi CHƯA editing) — đảm bảo
     * đã decode (`ensureEditSessionReady()`), ẩn `<img>`/hiện `canvasWrap`, mở Generic Drawer hiện
     * lưới tool phẳng. Zoom (Panzoom, gắn trên `mediaWrap` bọc chung cả 2) KHÔNG bị đụng tới — ẩn/
     * hiện `<img>`/canvasWrap chỉ là hiển thị bên TRONG `mediaWrap`, session Panzoom vẫn chạy y
     * nguyên xuyên suốt. KHÔNG có khái niệm "thoát Edit mode" quay lại xem ảnh thường — đóng Drawer
     * (nút X) CHỈ đóng Drawer, canvas vẫn hiện nguyên (xem case 'imageEdit.toolGrid.close.click');
     * chỉ có đóng HẲN modal xem ảnh mới dọn sạch (`exitEditMode()`, gọi từ `closeImagePreview()`).
     */
    async enterEditMode() {
        const ready = await this.ensureEditSessionReady();
        const handle = this._activeImageModalHandle;
        if (!ready || !handle) return; // guard hiếm: modal đóng/ảnh bị xoá giữa chừng

        handle.imgEl.classList.add('hidden');
        handle.canvasWrap.classList.remove('hidden');
        this._wireEditToolGridDelegation(); // ĐÚNG 1 lần/phiên — xem docstring hàm đó
        this.openEditToolGrid();
    },

    /** Gắn delegated click trên `genericDrawerBody` — CHỈ 1 lần/phiên Edit mode, KHÔNG gắn lại mỗi
     * lần `openEditToolGrid()` mở lại lưới (listener cũ không tự mất theo `innerHTML`, gắn lại sẽ
     * chồng chất). Gỡ lại ở `exitEditMode()` (tự gọi hàm gỡ trả về từ Core).
     * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") — lệnh
     * `addEventListener` thật ĐÃ DỜI sang core/file-manager/photo-ui.js::
     * wirePhotoEditToolGridDelegation() (Rule 5a — quyền của Core), hàm này giờ CHỈ gọi Core rồi
     * giữ lại hàm gỡ trả về.
     */
    _wireEditToolGridDelegation() {
        this._editToolGridClickHandler = wirePhotoEditToolGridDelegation(); // core/file-manager/photo-ui.js
    },

    /** Mở Generic Drawer hiện lưới tool Edit mode (phẳng, không nhóm header). Gọi lại NHIỀU LẦN
     * trong 1 phiên (mỗi lần Huỷ/Áp dụng xong 1 tool, xem `exitSubTool()`, HOẶC bấm lại icon Edit
     * sau khi đã tự đóng Drawer) — chỉ dựng lại header/bodyHtml, KHÔNG wire lại delegated click (đã
     * wire ở `enterEditMode()`); nút X đóng PHẢI wire lại mỗi lần (phần tử MỚI trong headerHtml).
     * Public — Router gọi trực tiếp qua `isEditModeActive()` (case 'imageEdit.tools.click' khi ĐÃ
     * editing).
     * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") — phần
     * dựng Generic Drawer + wire closeBtn ĐÃ DỜI sang core/file-manager/photo-ui.js::
     * openPhotoEditToolGridDrawerUi() (Rule 5a, cùng lý do `_wireEditToolGridDelegation()`).
     */
    openEditToolGrid() {
        if (!this._activeImageModalHandle || !this._activeEditParams) return; // guard: modal đóng/chưa ở Edit mode
        openPhotoEditToolGridDrawerUi(t('fileManager.photo.image.editGridTitle'), this._buildEditToolGridHtml()); // core/file-manager/photo-ui.js
    },

    /** @returns {string} bodyHtml lưới tool — DANH SÁCH PHẲNG (Giang yêu cầu bỏ hết group header
     * "Điều chỉnh"/"Công cụ"/"Vẽ") — 10 tile cùng 1 lưới `grid-cols-5` (2 hàng đều). Lưu đè/Lưu mới
     * KHÔNG còn ở đây — đã tách thành icon Save riêng trên header (xem `openSaveMenu()`).
     * `openEditTool()` phân luồng theo `tool.key`. */
    _buildEditToolGridHtml() {
        const svg = (path) => `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
        const tools = [
            { key: 'brightness', icon: svg('M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M16 12a4 4 0 11-8 0 4 4 0 018 0z'), labelKey: 'fileManager.photo.image.editToolBrightness' },
            { key: 'contrast', icon: svg('M12 21a9 9 0 100-18 9 9 0 000 18zM12 3v18'), labelKey: 'fileManager.photo.image.editToolContrast' },
            { key: 'saturation', icon: svg('M12 2.69l5.66 5.66a8 8 0 11-11.31 0z'), labelKey: 'fileManager.photo.image.editToolSaturation' },
            { key: 'temperature', icon: svg('M10 2a2 2 0 00-2 2v9.17a4 4 0 104 0V4a2 2 0 00-2-2z'), labelKey: 'fileManager.photo.image.editToolTemperature' },
            { key: 'tint', icon: svg('M7 21a4 4 0 01-4-4V5a2 2 0 012-2h10a2 2 0 012 2v3M7 21h10a2 2 0 002-2v-3a4 4 0 00-4-4H9'), labelKey: 'fileManager.photo.image.editToolTint' },
            { key: 'sharpen', icon: svg('M3 20h18L12 4 3 20z'), labelKey: 'fileManager.photo.image.editToolSharpen' },
            { key: 'crop', icon: svg('M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3'), labelKey: 'fileManager.photo.image.editToolCrop' },
            { key: 'text', icon: svg('M4 7V4h16v3M9 20h6M12 4v16'), labelKey: 'fileManager.photo.image.editToolText' },
            { key: 'draw', icon: svg('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'), labelKey: 'fileManager.photo.image.editToolDraw' },
            { key: 'magic', icon: svg('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'), labelKey: 'fileManager.photo.image.editToolMagic' },
            { key: 'shape', icon: svg('M12 3l8 6-3 10H7L4 9z'), labelKey: 'fileManager.photo.image.editToolShape' },
        ];
        return `
            <div class="grid grid-cols-5 gap-2 px-5 py-1">
                ${tools.map(tool => `
                    <button type="button" data-edit-tool="${tool.key}" class="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
                        <span class="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700">${tool.icon}</span>
                        <span class="text-[11px] font-medium text-slate-600 text-center leading-tight">${t(tool.labelKey)}</span>
                    </button>
                `).join('')}
            </div>
        `;
    },

    /** 1 tile trong lưới được bấm (Router, case 'imageEdit.toolGrid.tile.click') — phân luồng theo
     * `toolKey`: 6 tool "Điều chỉnh" -> `openAdjustTool()`, 4 tool còn lại -> hàm khởi động riêng.
     * @param {string} toolKey
     */
    openEditTool(toolKey) {
        const adjustKeys = ['brightness', 'contrast', 'saturation', 'temperature', 'tint', 'sharpen'];
        if (adjustKeys.includes(toolKey)) { this.openAdjustTool(toolKey); return; }
        if (toolKey === 'crop') { this._startCropTool(); return; }
        if (toolKey === 'draw') { this._startDrawTool(); return; }
        if (toolKey === 'text') { this._startTextTool(); return; }
        if (toolKey === 'magic') { this._startMagicTool(); return; }
        if (toolKey === 'shape') { this._startShapeTool(); return; }
    },

    /** Ứng với icon Save cố định trên header modal xem ảnh (core/file-manager/photo-ui.js) — mở
     * dropdown 2 lựa chọn (Ghi đè/Lưu mới, core/dropdown-menu.js). Đảm bảo ảnh đã decode TRƯỚC khi
     * mở dropdown (`ensureEditSessionReady()`) — bấm Save mà CHƯA từng mở Edit lần nào vẫn hợp lệ
     * ("Lưu mới" lúc đó = nhân bản ảnh nguyên trạng, "Ghi đè" = ghi lại y hệt, vô hại). Router gọi
     * trực tiếp (case 'imageEdit.save.click').
     * @param {HTMLElement} anchorEl - icon Save vừa bấm.
     */
    async openSaveMenu(anchorEl) {
        const ready = await this.ensureEditSessionReady();
        if (!ready) return; // guard hiếm: modal đóng/ảnh bị xoá giữa chừng
        const items = [
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-4 4m0 0L7 3m4 4V1"/></svg>', name: t('fileManager.photo.image.btnSaveOverwrite'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.saveOverwrite.click', payload: {} }) },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15"/></svg>', name: t('fileManager.photo.image.btnSaveNew'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.saveAsNew.click', payload: {} }) },
        ];
        openDropdownMenu(anchorEl, items, { zIndex: 132 }); // core/dropdown-menu.js
    },

    /** 1 tile "Điều chỉnh" được bấm — đóng Generic Drawer, hiện popup slider.
     * SỬA (31/07/2026, Giang chỉ ra vi phạm Rule 5a) — `adjustDoneBtn.onclick` KHÔNG còn gán ở đây
     * nữa (từng bị gán LẠI mỗi lần mở tool khác nhau — vi phạm "gom cuối hàm", xem docstring
     * `exitAdjustTool()`) — nút đó giờ wire ĐÚNG 1 LẦN lúc dựng modal (core/file-manager/photo-
     * ui.js), bắn `imageEdit.adjust.done.click` cố định.
     * `adjustSliderEl.oninput` VẪN gọi thẳng `this._renderEditPreview()` (không qua eventBus) —
     * @param {string} paramKey - 'brightness'|'contrast'|'saturation'|'temperature'|'tint'|'sharpen'
     */
    openAdjustTool(paramKey) {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return; // guard: thoát Edit mode ngay giữa lúc tap tile

        workflowGenericDrawerHelpers.closeFully();
        this._activeAdjustParam = paramKey;

        const config = this._adjustParamConfig[paramKey];
        handle.adjustLabelEl.textContent = t(`fileManager.photo.image.editTool${paramKey.charAt(0).toUpperCase()}${paramKey.slice(1)}`);
        handle.adjustSliderEl.min = config.min; handle.adjustSliderEl.max = config.max;
        handle.adjustSliderEl.value = this._activeEditParams[paramKey];
        handle.adjustValueEl.textContent = this._activeEditParams[paramKey];
        handle.adjustPopup.classList.remove('hidden');
    },

    /** Ứng với `imageEdit.adjust.slider.input` (kéo slider popup Điều chỉnh, wire 1 lần ở photo-
     * ui.js — SỬA 31/07/2026, Giang chỉ ra Nhóm B không có ngoại lệ, dời khỏi `.oninput=` gán lại
     * mỗi lần mở tool). Debounce qua `taskManager.once()`. Public — Router gọi trực tiếp.
     * @param {number} value
     */
    updateAdjustSlider(value) {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeAdjustParam) return; // guard: bắn tới lúc không có slider nào đang mở
        this._activeEditParams[this._activeAdjustParam] = value;
        handle.adjustValueEl.textContent = value;
        taskManager.once(() => this._renderEditPreview(), 60, 'photoEditAdjustPreview'); // service/task-manager.js — debounce
    },

    /** Ứng với `imageEdit.adjust.done.click` (nút "xong" ở popup Điều chỉnh, wire 1 lần ở photo-
     * ui.js) — đóng popup, quay lại lưới tool. Public — Router gọi trực tiếp. */
    exitAdjustTool() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeAdjustParam) return; // guard: bấm lúc popup đã ẩn/đã thoát Edit mode
        handle.adjustPopup.classList.add('hidden');
        this._activeAdjustParam = null;
        this.openEditToolGrid();
    },

    /** Tính lại `renderCanvas` từ `baseCanvas` + `_activeEditParams` hiện tại — KHÔNG đụng
     * `baseCanvas` (giữ nguyên pixel gốc, cho chỉnh đi chỉnh lại trước khi Lưu). */
    _renderEditPreview() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return;
        let imageData = applyColorAdjustments(handle.baseCanvas, this._activeEditParams); // core/photo-editor-engine.js
        if (this._activeEditParams.sharpen > 0) imageData = applySharpenFilter(imageData, this._activeEditParams.sharpen); // core/photo-editor-engine.js
        handle.renderCanvas.getContext('2d').putImageData(imageData, 0, 0);
    },

    /** @returns {string} 'none'|'crop'|'draw'|'text'|'magic' — khe ĐỌC cho Router (`imageEdit`)
     * chọn đúng hàm khi bấm `contextApplyBtn` HOẶC khi nhận pointer event trên `interactCanvas`
     * (dùng CHUNG cho cả 4 sub-tool, hành vi khác nhau theo tool đang mở). */
    getActiveSubTool() { return this._activeSubTool; },

    /** Toạ độ CSS hiển thị -> pixel THẬT của canvas — Workflow tự tính lại khi cần (vẽ overlay, bán
     * kính chạm handle...), KHÁC với toạ độ Core đã tính sẵn gửi kèm payload pointer event (2 nơi
     * cần tính, không đáng gộp thành 1 hàm dùng chung xuyên Core/Workflow — Rule 3a không cho Core
     * gọi Core, nên Core tự có bản tính riêng trong chính photo-ui.js). @returns {number} */
    _editScale() {
        const canvas = this._activeImageModalHandle.interactCanvas;
        const rect = canvas.getBoundingClientRect();
        return canvas.width / (rect.width || canvas.width || 1); // guard chia 0 hiếm (canvas chưa layout xong)
    },

    /** Ứng với `imageEdit.subTool.cancel.click` (nút Huỷ ở contextBar, wire 1 lần ở photo-ui.js,
     * DÙNG CHUNG cho cả 4 sub-tool — hành vi GIỐNG HỆT nhau bất kể tool nào đang mở, nên KHÔNG cần
     * Router phân theo `_activeSubTool` như `apply`). Thoát 1 sub-tool VỀ lưới tool — xoá
     * `interactCanvas`, ẩn contextBar/floatingText/popup riêng từng tool, hiện lại header, mở lại
     * Generic Drawer. Public — Router gọi trực tiếp.
     * SỬA (31/07/2026, Giang chỉ ra Nhóm B không có ngoại lệ) — KHÔNG còn gỡ
     * `_subToolPointerCleanup`/`_textDragCleanup` (2 field đó đã XOÁ) — `interactCanvas`/
     * `floatingText`/`document` giờ wire VĨNH VIỄN 1 lần ở photo-ui.js/listener, KHÔNG theo vòng
     * đời sub-tool nữa (Router tự gate theo `_activeSubTool`/`_textDragging`, xem
     * `getActiveSubTool()`/2 case pointer/floatingText ở event/router/image-edit.js). Vẫn phải
     * dừng phiên kéo Text đang dở (nếu có) — set `_textDragging = false`, KHÔNG có DOM listener nào
     * để gỡ cả. */
    exitSubTool() {
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        this._textDragging = false;
        handle.interactCanvas.getContext('2d').clearRect(0, 0, handle.interactCanvas.width, handle.interactCanvas.height);
        handle.contextBar.classList.add('hidden');
        handle.contextApplyBtn.classList.remove('hidden'); // reset — _startMagicTool()/_startShapeTool() (lúc đang chọn loại) tự ẩn nút này
        handle.header.classList.remove('hidden');
        handle.floatingText.classList.add('hidden');
        handle.drawControlsPopup.classList.add('hidden');
        handle.magicPopup.classList.add('hidden');
        handle.cropRatioPopup.classList.add('hidden');
        handle.shapeTypePopup.classList.add('hidden');
        this._activeSubTool = 'none';
        this._cropSession = null;
        this.openEditToolGrid();
    },

    // ===================== Crop =====================
    // Tương tác (khung/handle/kéo tay) ở core/crop-selector.js — DÙNG CHUNG với Video Editor. File
    // này chỉ giữ `_cropSession` + phần "Áp dụng" riêng của Photo (cắt pixel thật ngay).

    /** Vào tool Crop — Photo mặc định KHÔNG khoá tỉ lệ (aspectRatio NaN = Tự do), người dùng tự
     * chọn tỉ lệ qua `cropRatioPopup` (MỚI, `setCropAspectRatio()` dưới đây). Pointer events KHÔNG
     * wire ở đây nữa (Core đã wire vĩnh viễn, xem `cropPointerDown()`/`cropPointerMove()`/
     * `cropPointerUp()` — Router tự gọi khi `getActiveSubTool()==='crop'`). */
    _startCropTool() {
        const handle = this._activeImageModalHandle;
        workflowGenericDrawerHelpers.closeFully(); // FIX (bug có từ trước) — thiếu dòng này khiến Generic Drawer còn mở đè lên contextBar/interactCanvas, tưởng tool "không làm gì" — cùng khuôn openAdjustTool()
        this._activeSubTool = 'crop';
        handle.header.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.remove('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolCrop');
        handle.cropRatioPopup.classList.remove('hidden');

        this._cropSession = initCropSession(handle.baseCanvas.width, handle.baseCanvas.height); // core/crop-selector.js
        this._drawCropOverlay();
    },

    /** Ứng với 1 nút trong `cropRatioPopup` (MỚI, Giang yêu cầu "crop không có danh sách chọn tỉ
     * lệ"). `ratioKey` 'free' -> NaN (core hiểu là Tự do); 'W:H' -> parse thành số W/H — TÁI DÙNG
     * NGUYÊN `setCropSessionAspectRatio()` (core/crop-selector.js, đã có sẵn từ Video Editor, chỉ
     * chưa từng có UI gọi tới cho Photo) — hàm đó tự tính lại `session.rect` CĂN GIỮA theo tỉ lệ
     * mới, không cần Workflow tự làm. Public — Router gọi trực tiếp (case
     * 'imageEdit.crop.setRatio.click').
     * @param {string} ratioKey - 'free'|'1:1'|'4:3'|'3:4'|'16:9'|'9:16'
     */
    setCropAspectRatio(ratioKey) {
        if (!this._cropSession) return; // guard: hiếm, không còn ở tool Crop
        let ratio = NaN;
        if (ratioKey !== 'free') {
            const [wPart, hPart] = ratioKey.split(':').map(Number);
            ratio = wPart / hPart;
        }
        setCropSessionAspectRatio(this._cropSession, ratio); // core/crop-selector.js
        this._drawCropOverlay();
    },

    /** Ứng với `imageEdit.interactCanvas.pointerDown` lúc `getActiveSubTool()` là 'crop' HOẶC
     * 'shapePlacement' (TÁI DÙNG — đặt vị trí/resize 1 shape mới cùng thuật toán kéo khung/handle
     * hệt Crop, xem `selectShapeType()`). Public — Router gọi trực tiếp. @param {{x:number,y:number}} pos */
    cropPointerDown(pos) {
        if (!this._cropSession) return; // guard: hiếm, lệch nhịp giữa Router đọc state và lúc hàm này thật sự chạy
        cropSessionPointerDown(this._cropSession, pos, 30 * this._editScale()); // core/crop-selector.js
    },

    /** Ứng với `imageEdit.interactCanvas.pointerMove` lúc `getActiveSubTool()` là 'crop' HOẶC
     * 'shapePlacement'. Public — Router gọi trực tiếp. @param {{x:number,y:number}} pos */
    cropPointerMove(pos) {
        if (!this._cropSession) return;
        this._moveOrResizeCropSession(pos);
        this._drawCropOverlay();
    },

    /** Ứng với `imageEdit.interactCanvas.pointerUp` lúc `getActiveSubTool()` là 'crop' HOẶC
     * 'shapePlacement'. Public — Router gọi trực tiếp. */
    cropPointerUp() {
        if (!this._cropSession) return;
        cropSessionPointerUp(this._cropSession); // core/crop-selector.js
    },

    /** Đọc `session.activeHandle` rồi chọn ĐÚNG 1 trong 3 hàm tính rect thuần của core/crop-
     * selector.js (move/resize-tự-do/resize-khoá-tỉ-lệ) — việc CHỌN thuộc Workflow (core không tự
     * dispatch giữa các tiến trình). Photo không khoá tỉ lệ (`aspectRatio` luôn NaN) nên nhánh khoá
     * tỉ lệ không bao giờ chạy ở đây — vẫn viết đủ, khớp Video Editor (event/workflow/video-
     * editor.js), tránh lệch code nếu sau này Photo cũng thêm khoá tỉ lệ.
     * @param {{x:number,y:number}} pos
     */
    _moveOrResizeCropSession(pos) {
        const session = this._cropSession;
        if (!session.activeHandle) return;
        const s = session.dragStart;
        const dx = pos.x - s.x, dy = pos.y - s.y;
        const minSize = 50 * this._editScale();

        if (session.activeHandle === 'center') {
            session.rect = moveCropRect({ x: s.rx, y: s.ry, w: s.rw, h: s.rh }, dx, dy, session.sourceWidth, session.sourceHeight); // core/crop-selector.js
            return;
        }
        const flipX = session.activeHandle === 'tl' || session.activeHandle === 'bl';
        const flipY = session.activeHandle === 'tl' || session.activeHandle === 'tr';
        const rect = { x: s.rx, y: s.ry, w: s.rw, h: s.rh };
        session.rect = Number.isNaN(session.aspectRatio)
            ? computeFreeResizedRect(rect, flipX, flipY, dx, dy, minSize, session.sourceWidth, session.sourceHeight) // core/crop-selector.js
            : computeRatioLockedResizedRect(rect, flipX, flipY, dx, session.aspectRatio, minSize, session.sourceWidth, session.sourceHeight); // core/crop-selector.js
    },

    /** Vẽ lại overlay Crop — gọi lại mỗi lần `_cropSession.rect` đổi (kéo tay). */
    _drawCropOverlay() {
        const handle = this._activeImageModalHandle;
        drawCropSessionOverlay(handle.interactCanvas.getContext('2d'), this._cropSession, handle.interactCanvas.width, handle.interactCanvas.height, this._editScale()); // core/crop-selector.js
    },

    /** Áp dụng Crop — cắt từ `renderCanvas` (đã gồm Điều chỉnh hiện tại) -> resize cả 3 canvas ->
     * reset params (đã gộp vào pixel thật). Riêng của Photo (Video Editor không cắt pixel ở bước
     * này, xem docstring đầu core/crop-selector.js). Public — Router gọi qua case
     * 'imageEdit.subTool.apply.click' (phân theo `getActiveSubTool()`). */
    applyCropTool() {
        const handle = this._activeImageModalHandle;
        const rect = getCropSessionRect(this._cropSession); // core/crop-selector.js
        const cropped = cropCanvas(handle.renderCanvas, rect); // core/photo-editor-engine.js
        // FIX (bug — layerCanvas THIẾU trong danh sách resize, layer lệch vị trí/tỉ lệ sau Crop) —
        // layerCanvas PHẢI cùng kích thước base/render/interact LUÔN (4 canvas xếp chồng khít lên
        // nhau, xem core/file-manager/photo-ui.js), quên nó là layer (Text/Shape) sẽ lệch hẳn toạ
        // độ so với ảnh đã crop.
        [handle.baseCanvas, handle.renderCanvas, handle.layerCanvas, handle.interactCanvas].forEach(c => { c.width = rect.w; c.height = rect.h; });
        handle.baseCanvas.getContext('2d').drawImage(cropped, 0, 0);
        handle.renderCanvas.getContext('2d').drawImage(cropped, 0, 0);
        syncEditCanvasDisplaySize(handle); // core/file-manager/photo-ui.js — tỉ lệ ảnh đổi sau Crop, phải tính lại cover/contain
        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
        // MỚI (layer Text/Shape) — Crop dịch GỐC toạ độ (0,0 mới = góc trên-trái vùng vừa cắt) —
        // mọi layer đang có PHẢI dịch NGƯỢC LẠI đúng bấy nhiêu (trừ `rect.x`/`rect.y`) để vẫn hiện
        // ĐÚNG chỗ cũ trên ảnh (layer NẰM NGOÀI vùng crop vẫn giữ nguyên toạ độ đã dịch — tự nằm
        // ngoài canvas mới, trình duyệt tự không vẽ ra phần thừa, không cần lọc/xoá tường minh).
        this._layers.forEach(layer => { layer.x -= rect.x; layer.y -= rect.y; });
        this._renderLayers();
        this._cropSession = null;
        this.exitSubTool();
    },

    // ===================== Vẽ (Cọ/Tẩy) =====================

    /** Vào tool Vẽ — mặc định Cọ, gắn Pointer Events vẽ nét trực tiếp lên `interactCanvas` (nháp,
     * chưa gộp vào base tới khi bấm Áp dụng). Nút Cọ/Tẩy wire 1 lần ở photo-ui.js (xem
     * `selectDrawBrush()`/`selectDrawEraser()`). Pointer events KHÔNG wire ở đây nữa (Core đã wire
     * vĩnh viễn, xem `drawPointerDown()`/`drawPointerMove()`/`drawPointerUp()`). */
    _startDrawTool() {
        const handle = this._activeImageModalHandle;
        workflowGenericDrawerHelpers.closeFully(); // FIX (bug có từ trước) — xem ghi chú _startCropTool()
        this._activeSubTool = 'draw';
        this._drawType = 'brush';
        this._drawSessionActive = false;
        this._drawLastPos = null;
        handle.header.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.remove('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolDraw');
        handle.drawControlsPopup.classList.remove('hidden');
        handle.drawBrushBtn.classList.add('text-primary'); handle.drawBrushBtn.classList.remove('text-white/60');
        handle.drawEraserBtn.classList.add('text-white/60'); handle.drawEraserBtn.classList.remove('text-primary');
    },

    /** Ứng với `imageEdit.interactCanvas.pointerDown` lúc `getActiveSubTool()==='draw'` — bắt đầu 1
     * nét vẽ MỚI. Public — Router gọi trực tiếp. @param {{x:number,y:number}} pos */
    drawPointerDown(pos) {
        this._drawSessionActive = true;
        this._drawLastPos = pos;
        this._drawStroke(this._activeImageModalHandle, pos, pos);
    },

    /** Ứng với `imageEdit.interactCanvas.pointerMove` lúc `getActiveSubTool()==='draw'`. Public —
     * Router gọi trực tiếp (mọi lúc, kể cả KHÔNG đang vẽ — tự guard `_drawSessionActive`, RẺ, an
     * toàn). @param {{x:number,y:number}} pos */
    drawPointerMove(pos) {
        if (!this._drawSessionActive) return;
        this._drawStroke(this._activeImageModalHandle, this._drawLastPos, pos);
        this._drawLastPos = pos;
    },

    /** Ứng với `imageEdit.interactCanvas.pointerUp` lúc `getActiveSubTool()==='draw'` — kết thúc
     * nét vẽ hiện tại. Public — Router gọi trực tiếp. */
    drawPointerUp() {
        this._drawSessionActive = false;
    },

    /** Ứng với `imageEdit.draw.selectBrush.click` (wire 1 lần ở photo-ui.js). Guard theo
     * `_activeSubTool` — nút chỉ HIỆN lúc tool Vẽ đang mở (`drawControlsPopup`), nhưng vẫn tự vệ
     * phòng bấm lọt lúc đang chuyển tool. Public — Router gọi trực tiếp. */
    selectDrawBrush() {
        const handle = this._activeImageModalHandle;
        if (!handle || this._activeSubTool !== 'draw') return;
        this._drawType = 'brush';
        handle.drawBrushBtn.classList.replace('text-white/60', 'text-primary');
        handle.drawEraserBtn.classList.replace('text-primary', 'text-white/60');
    },

    /** Ứng với `imageEdit.draw.selectEraser.click` — xem `selectDrawBrush()`. Public — Router gọi
     * trực tiếp. */
    selectDrawEraser() {
        const handle = this._activeImageModalHandle;
        if (!handle || this._activeSubTool !== 'draw') return;
        this._drawType = 'eraser';
        handle.drawEraserBtn.classList.replace('text-white/60', 'text-primary');
        handle.drawBrushBtn.classList.replace('text-primary', 'text-white/60');
    },

    /** Vẽ 1 đoạn nét lên `interactCanvas` — Cọ = `source-over`, Tẩy = `destination-out` (đục
     * thủng, hiện lại pixel gốc phía dưới lúc "Áp dụng" gộp, xem `applyDrawTool()`). */
    _drawStroke(handle, fromPos, toPos) {
        const ctx = handle.interactCanvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const sizeBase = Math.max(handle.baseCanvas.width, handle.baseCanvas.height) / 1000;
        ctx.lineWidth = parseInt(handle.drawSizeEl.value, 10) * sizeBase;
        if (this._drawType === 'brush') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = handle.drawColorEl.value;
        } else {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        ctx.stroke();
    },

    /** Áp dụng Vẽ — gộp `interactCanvas` (nét nháp) lên `renderCanvas` thành base MỚI, đúng
     * composite operation theo Cọ/Tẩy. Public — Router gọi qua case 'imageEdit.subTool.apply.click'
     * (phân theo `getActiveSubTool()`). */
    applyDrawTool() {
        const handle = this._activeImageModalHandle;
        const compositeOp = this._drawType === 'eraser' ? 'destination-out' : 'source-over';
        const merged = mergeCanvases(handle.renderCanvas, handle.interactCanvas, compositeOp); // core/photo-editor-engine.js
        const baseCtx = handle.baseCanvas.getContext('2d');
        baseCtx.clearRect(0, 0, handle.baseCanvas.width, handle.baseCanvas.height);
        baseCtx.drawImage(merged, 0, 0);
        const renderCtx = handle.renderCanvas.getContext('2d');
        renderCtx.clearRect(0, 0, handle.renderCanvas.width, handle.renderCanvas.height);
        renderCtx.drawImage(merged, 0, 0);
        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
        this.exitSubTool();
    },

    // ===================== Văn bản =====================

    /** Vào tool Text — khung chữ nổi (`floatingText`) hiện giữa màn hình, kéo-thả được (Pointer
     * events KHÔNG wire ở đây nữa — Core wire `floatingText.pointerdown` vĩnh viễn, `document`
     * pointermove/pointerup wire vĩnh viễn ở event/listener/image-edit.js, xem
     * `startTextDrag()`/`updateTextDrag()`/`endTextDrag()`). Nút Huỷ/Áp dụng wire 1 lần ở
     * photo-ui.js. */
    _startTextTool() {
        const handle = this._activeImageModalHandle;
        workflowGenericDrawerHelpers.closeFully(); // FIX (bug có từ trước) — xem ghi chú _startCropTool()
        this._activeSubTool = 'text';
        this._textDragging = false;
        handle.header.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.remove('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolText');

        handle.floatingText.textContent = t('fileManager.photo.image.editTextPlaceholder');
        handle.floatingText.style.color = '#ffffff';
        handle.floatingText.style.left = '50%';
        handle.floatingText.style.top = '50%';
        handle.floatingText.style.transform = 'translate(-50%, -50%)';
        handle.floatingText.classList.remove('hidden');
        handle.floatingText.focus();
        const range = document.createRange(); // chọn sẵn toàn bộ placeholder — gõ là thay ngay
        range.selectNodeContents(handle.floatingText);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    },

    /** Ứng với `imageEdit.floatingText.pointerDown` (chạm vào `floatingText`, wire vĩnh viễn ở
     * photo-ui.js) — bắt đầu phiên kéo. Public — Router gọi trực tiếp. Guard `_activeSubTool` —
     * `floatingText` chỉ HIỆN/hit-test được lúc tool Text đang mở nên hiếm khi cần, vẫn tự vệ. */
    startTextDrag() {
        if (this._activeSubTool !== 'text') return;
        this._textDragging = true;
    },

    /** Ứng với `imageEdit.floatingText.pointerMove` — bắn LIÊN TỤC từ `document` TOÀN APP (event/
     * listener/image-edit.js, KHÔNG chỉ lúc Photo Edit mở) — guard `_textDragging` là "cổng" DUY
     * NHẤT, phần lớn lời gọi return ngay ở đây. Public — Router gọi trực tiếp.
     * @param {number} x @param {number} y */
    updateTextDrag(x, y) {
        if (!this._textDragging) return;
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        handle.floatingText.style.left = x + 'px';
        handle.floatingText.style.top = y + 'px';
        handle.floatingText.style.transform = 'translate(-50%, -50%)';
    },

    /** Ứng với `imageEdit.floatingText.pointerUp` — CÙNG bắn liên tục toàn app như
     * `updateTextDrag()`. Public — Router gọi trực tiếp. */
    endTextDrag() {
        this._textDragging = false;
    },

    /** Áp dụng Text — MỚI (layer) — KHÔNG còn "nướng" vào pixel, TẠO 1 layer text MỚI (giữ dạng
     * object trong `_layers`, chọn lại/sửa lại được sau này qua long-press -> "Sửa" -> style
     * editor, xem docstring đầu file). Bỏ qua nếu rỗng/toàn khoảng trắng. Public — Router gọi qua
     * case 'imageEdit.subTool.apply.click'.
     */
    applyTextTool() {
        const handle = this._activeImageModalHandle;
        const text = handle.floatingText.textContent;
        if (!text || !text.trim()) { this.exitSubTool(); return; }

        const canvasRect = handle.renderCanvas.getBoundingClientRect();
        const textRect = handle.floatingText.getBoundingClientRect();
        const scale = this._editScale();
        const cx = (textRect.left - canvasRect.left + textRect.width / 2) * scale;
        const cy = (textRect.top - canvasRect.top + textRect.height / 2) * scale;
        const fontSizePx = 30 * scale;

        this._layers.push({
            id: ++this._layerIdSeq, type: 'text',
            text, x: cx, y: cy, fontSizePx, color: handle.floatingText.style.color || '#ffffff',
        });
        this._renderLayers();
        this.exitSubTool();
    },

    // ===================== Shape (MỚI, layer) =====================
    // Kéo khung/handle lúc ĐẶT shape mới TÁI DÙNG NGUYÊN core/crop-selector.js (cùng thuật toán
    // hình học với tool Crop — 4 handle góc + di chuyển cả khung — chỉ khác Ở CHỖ Áp dụng: Crop cắt
    // pixel thật, Shape chỉ đồng bộ rect vào layer rồi giữ NGUYÊN dạng object, xem
    // applyShapePlacement() dưới).

    /** Bấm tile "Shape" — hiện popup chọn loại hình (rect/circle/line/arrow/polygon), CHƯA tạo
     * layer nào (chờ chọn xong, xem `selectShapeType()`). `contextBar` hiện CHỈ nút Huỷ (Áp dụng
     * ẩn — chưa có gì để áp dụng lúc này) để có đường lùi lại lưới tool nếu đổi ý không thêm shape. */
    _startShapeTool() {
        const handle = this._activeImageModalHandle;
        workflowGenericDrawerHelpers.closeFully(); // FIX (bug có từ trước) — xem ghi chú _startCropTool()
        this._activeSubTool = 'none'; // CHƯA vào sub-tool thật (chỉ đang chọn loại) — giữ 'none' để interactCanvas pointer vẫn xử lý layer bình thường nếu lỡ chạm ra ngoài popup
        handle.header.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.add('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolShape');
        handle.shapeTypePopup.classList.remove('hidden');
    },

    /** Ứng với 1 nút trong `shapeTypePopup`. Tạo layer shape MỚI ở vị trí/kích thước mặc định
     * (giữa ảnh), vào NGAY chế độ đặt vị trí/kích thước (kéo khung/handle, TÁI DÙNG hệt Crop) —
     * `contextBar` Huỷ/Áp dụng xác nhận đặt xong.
     * @param {string} shapeType - 'rect'|'circle'|'line'|'arrow'|'polygon'
     */
    selectShapeType(shapeType) {
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        const isLinear = shapeType === 'line' || shapeType === 'arrow';
        const cx = handle.baseCanvas.width / 2, cy = handle.baseCanvas.height / 2;
        const w = handle.baseCanvas.width * 0.4, h = isLinear ? handle.baseCanvas.width * 0.4 : handle.baseCanvas.height * 0.3;

        const newLayer = {
            id: ++this._layerIdSeq, type: 'shape', shapeType,
            x: isLinear ? cx - w / 2 : cx - w / 2, y: isLinear ? cy : cy - h / 2,
            w: isLinear ? w : w, h: isLinear ? 0 : h,
            fillColor: (shapeType === 'rect' || shapeType === 'circle') ? 'rgba(10,132,255,0.35)' : null,
            strokeColor: '#0A84FF', strokeWidth: 6, sides: 5,
        };
        this._layers.push(newLayer);
        this._selectedLayerIndex = this._layers.length - 1;
        this._renderLayers();

        handle.shapeTypePopup.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.remove('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolShape');
        this._activeSubTool = 'shapePlacement';

        // TÁI DÙNG NGUYÊN cấu trúc session core/crop-selector.js — `sourceWidth/Height` chỉ dùng để
        // giới hạn biên kéo (moveCropRect()/computeFreeResizedRect()), không liên quan gì tới "cắt
        // ảnh" (đó là hành vi RIÊNG của applyCropTool(), Shape không gọi hàm đó).
        this._cropSession = {
            sourceWidth: handle.baseCanvas.width, sourceHeight: handle.baseCanvas.height,
            rect: { x: newLayer.x, y: newLayer.y, w: newLayer.w || 40, h: newLayer.h || 40 },
            activeHandle: null, dragStart: null, aspectRatio: NaN,
        };
        this._drawCropOverlay(); // vẽ khung + 4 handle kéo, TÁI DÙNG drawCropSessionOverlay()
    },

    /** Áp dụng — đồng bộ rect cuối cùng (đã kéo/resize) NGƯỢC LẠI vào layer, KHÔNG cắt pixel gì cả
     * (khác hẳn applyCropTool()) — layer VẪN giữ dạng object, chọn lại/sửa lại được sau. Public —
     * Router gọi qua case 'imageEdit.subTool.apply.click' khi `getActiveSubTool()==='shapePlacement'`.
     */
    applyShapePlacement() {
        const layer = this._layers[this._selectedLayerIndex];
        if (layer) {
            const rect = getCropSessionRect(this._cropSession); // core/crop-selector.js
            layer.x = rect.x; layer.y = rect.y; layer.w = rect.w; layer.h = rect.h;
        }
        this._cropSession = null;
        this._renderLayers();
        this.exitSubTool();
    },

    // ===================== Layer (Text/Shape) — chọn lại/kéo/menu Sửa-Xoá-Nhân bản =====================
    // Tương tác khi KHÔNG có sub-tool nào mở (_activeSubTool==='none') — Router gọi 3 hàm dưới
    // TRỰC TIẾP từ case 'imageEdit.interactCanvas.pointerDown/Move/Up' (nhánh 'none', xem
    // event/router/image-edit.js).

    /** Chạm xuống — hit-test layer TOPMOST khớp vị trí chạm (layer thêm SAU cùng ưu tiên trước, vì
     * nó nằm TRÊN nếu chồng lấn). Không trúng layer nào -> không làm gì. Trúng -> ghi nhớ vị trí
     * bắt đầu + hẹn giờ 1.5s mở menu Sửa/Xoá/Nhân bản (Giang chốt: "nhấn giữ 1.5s") — bị HUỶ ngay
     * nếu ngón tay di chuyển đủ xa TRƯỚC khi hết giờ (coi là kéo di chuyển layer thay vì long-press,
     * xem `layerPointerMove()`).
     * @param {{x:number,y:number}} pos
     */
    layerPointerDown(pos) {
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        const index = this._hitTestLayers(pos);
        if (index === -1) { this._selectedLayerIndex = -1; return; }

        this._selectedLayerIndex = index;
        this._layerDragMoved = false;
        const layer = this._layers[index];
        this._layerDragStart = { x: pos.x, y: pos.y, layerX: layer.x, layerY: layer.y };
        this._layerLongPressTimer = setTimeout(() => {
            this._layerLongPressTimer = null;
            if (!this._layerDragMoved) this._openLayerActionMenuAt(index, pos);
        }, 1500);
    },

    /** Di chuyển — nếu đã kéo đủ xa (quá ngưỡng nhỏ, tránh hụt tay bị tính nhầm là kéo), huỷ hẹn
     * giờ long-press + cập nhật vị trí layer theo độ lệch. @param {{x:number,y:number}} pos */
    layerPointerMove(pos) {
        if (this._selectedLayerIndex === -1 || !this._layerDragStart) return;
        const dx = pos.x - this._layerDragStart.x, dy = pos.y - this._layerDragStart.y;
        const movedDist = Math.hypot(dx, dy);
        const threshold = 8 * this._editScale(); // ~8 CSS px quy đổi canvas-px
        if (movedDist > threshold) {
            if (this._layerLongPressTimer) { clearTimeout(this._layerLongPressTimer); this._layerLongPressTimer = null; }
            this._layerDragMoved = true;
        }
        if (!this._layerDragMoved) return;
        const layer = this._layers[this._selectedLayerIndex];
        layer.x = this._layerDragStart.layerX + dx;
        layer.y = this._layerDragStart.layerY + dy;
        this._renderLayers();
    },

    /** Nhả tay — dọn hẹn giờ/state, KHÔNG reset `_selectedLayerIndex` về -1 nếu vừa mở menu (menu
     * tự đọc `index` qua closure lúc mở, không phụ thuộc field này nữa) — reset về -1 vô hại trong
     * MỌI trường hợp khác, đơn giản hoá bằng cách LUÔN reset. */
    layerPointerUp() {
        if (this._layerLongPressTimer) { clearTimeout(this._layerLongPressTimer); this._layerLongPressTimer = null; }
        this._layerDragStart = null;
        this._layerDragMoved = false;
    },

    /** Dò layer TOPMOST khớp vị trí chạm — duyệt NGƯỢC (layer thêm sau/nằm trên trước).
     * @param {{x:number,y:number}} pos @returns {number} index trong `_layers`, -1 nếu không trúng gì. */
    _hitTestLayers(pos) {
        const handle = this._activeImageModalHandle;
        for (let i = this._layers.length - 1; i >= 0; i--) {
            const layer = this._layers[i];
            const box = layer.type === 'text'
                ? measureTextLayerBoundingBox(handle.layerCanvas, layer) // core/photo-editor-engine.js
                : measureShapeLayerBoundingBox(layer); // core/photo-editor-engine.js
            if (pos.x >= box.x && pos.x <= box.x + box.w && pos.y >= box.y && pos.y <= box.y + box.h) return i;
        }
        return -1;
    },

    /** Mở dropdown 3 lựa chọn (Sửa/Xoá/Nhân bản) NEO tại vị trí chạm thật trên màn hình — quy đổi
     * NGƯỢC toạ độ canvas-pixel (`pos`) về toạ độ CLIENT (nghịch đảo `computeInteractPos()`, core/
     * file-manager/photo-ui.js) để tạo neo tạm đúng chỗ (`createPointAnchorEl()`, core/dropdown-
     * menu.js).
     * @param {number} index @param {{x:number,y:number}} pos
     */
    _openLayerActionMenuAt(index, pos) {
        const handle = this._activeImageModalHandle;
        const rect = handle.interactCanvas.getBoundingClientRect();
        const scale = rect.width / (handle.interactCanvas.width || 1);
        const clientX = rect.left + pos.x * scale, clientY = rect.top + pos.y * scale;
        const anchorEl = createPointAnchorEl(clientX, clientY); // core/dropdown-menu.js
        const items = [
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>', name: t('fileManager.photo.image.layerMenuEdit'), callback: () => this.openLayerStyleEditor(index) },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>', name: t('fileManager.photo.image.layerMenuDuplicate'), callback: () => this.duplicateLayer(index) },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>', name: t('fileManager.photo.image.layerMenuDelete'), callback: () => this.deleteLayer(index), destructive: true },
        ];
        openDropdownMenu(anchorEl, items, { zIndex: 132 }); // core/dropdown-menu.js
        anchorEl.remove(); // vị trí đã đọc xong ĐỒNG BỘ bên trong openDropdownMenu(), an toàn gỡ ngay
    },

    /** "Xoá" trong menu layer. @param {number} index */
    deleteLayer(index) {
        this._layers.splice(index, 1);
        this._selectedLayerIndex = -1;
        this._renderLayers();
    },

    /** "Nhân bản" trong menu layer — lệch nhẹ (20px canvas) khỏi bản gốc, để thấy rõ đã tạo bản
     * MỚI thay vì đè khít lên bản cũ (khó nhận ra). @param {number} index */
    duplicateLayer(index) {
        const original = this._layers[index];
        const copy = { ...original, id: ++this._layerIdSeq, x: original.x + 20, y: original.y + 20 };
        this._layers.push(copy);
        this._renderLayers();
    },

    /** "Sửa" trong menu layer — mở Generic Drawer style editor (MỚI, Giang yêu cầu). Nội dung
     * bodyHtml khác nhau theo `layer.type` (text: nội dung chữ/cỡ chữ/màu; shape: màu tô/màu viền/
     * độ dày viền). @param {number} index */
    openLayerStyleEditor(index) {
        const layer = this._layers[index];
        if (!layer) return;
        this._selectedLayerIndex = index;
        const title = t(layer.type === 'text' ? 'fileManager.photo.image.layerStyleTitleText' : 'fileManager.photo.image.layerStyleTitleShape');
        openPhotoLayerStyleDrawerUi(title, this._buildLayerStyleDrawerHtml(layer)); // core/file-manager/photo-ui.js
        this._layerStyleDrawerClickHandler = wireLayerStyleDrawerDelegation(); // core/file-manager/photo-ui.js
    },

    /** @param {object} layer @returns {string} bodyHtml style editor, khác nhau theo `layer.type`. */
    _buildLayerStyleDrawerHtml(layer) {
        if (layer.type === 'text') {
            return `
                <div class="px-5 py-4 space-y-5">
                    <textarea data-layer-style-field="text" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900">${escapeHtml(layer.text)}</textarea>
                    <div>
                        <div class="flex justify-between text-xs text-slate-500 mb-1"><span>${t('fileManager.photo.image.layerStyleFontSize')}</span><span>${layer.fontSizePx}</span></div>
                        <input type="range" data-layer-style-field="fontSizePx" min="16" max="160" value="${layer.fontSizePx}" class="w-full">
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500">${t('fileManager.photo.image.layerStyleColor')}</span>
                        <input type="color" data-layer-style-field="color" value="${layer.color}" class="w-9 h-9 rounded-full p-0 border-0 overflow-hidden">
                    </div>
                </div>
            `;
        }
        return `
            <div class="px-5 py-4 space-y-5">
                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" data-layer-style-field="hasFill" ${layer.fillColor ? 'checked' : ''}>
                        ${t('fileManager.photo.image.layerStyleFill')}
                    </label>
                    <input type="color" data-layer-style-field="fillColor" value="${layer.fillColor || '#0A84FF'}" class="w-9 h-9 rounded-full p-0 border-0 overflow-hidden">
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-slate-500">${t('fileManager.photo.image.layerStyleStroke')}</span>
                    <input type="color" data-layer-style-field="strokeColor" value="${layer.strokeColor}" class="w-9 h-9 rounded-full p-0 border-0 overflow-hidden">
                </div>
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1"><span>${t('fileManager.photo.image.layerStyleStrokeWidth')}</span><span>${layer.strokeWidth}</span></div>
                    <input type="range" data-layer-style-field="strokeWidth" min="0" max="40" value="${layer.strokeWidth}" class="w-full">
                </div>
            </div>
        `;
    },

    /** Ứng với `imageEdit.layerStyle.field.input` — cập nhật ĐÚNG 1 field của layer đang mở style
     * editor rồi vẽ lại. `hasFill` (checkbox) đặc biệt: bật -> khôi phục màu tô CŨ nếu có (tránh
     * mất màu đã chọn trước đó khi tắt/bật qua lại), tắt -> `fillColor = null` (không tô).
     * @param {string} field @param {string|undefined} value @param {boolean|undefined} checked
     */
    updateLayerStyleField(field, value, checked) {
        const layer = this._layers[this._selectedLayerIndex];
        if (!layer) return;
        if (field === 'text') layer.text = value;
        else if (field === 'fontSizePx') layer.fontSizePx = parseInt(value, 10);
        else if (field === 'color') layer.color = value;
        else if (field === 'fillColor') { layer.fillColor = value; layer._lastFillColor = value; }
        else if (field === 'hasFill') {
            if (checked) { layer.fillColor = layer._lastFillColor || '#0A84FF'; }
            else { layer._lastFillColor = layer.fillColor || layer._lastFillColor; layer.fillColor = null; }
        }
        else if (field === 'strokeColor') layer.strokeColor = value;
        else if (field === 'strokeWidth') layer.strokeWidth = parseInt(value, 10);
        this._renderLayers();
    },

    /** Đóng style editor (nút X trên Generic Drawer) — gỡ delegation + đóng Drawer + bỏ chọn layer.
     * Public — Router gọi qua case 'imageEdit.layerStyle.close.click'. */
    closeLayerStyleEditor() {
        if (this._layerStyleDrawerClickHandler) { this._layerStyleDrawerClickHandler(); this._layerStyleDrawerClickHandler = null; }
        workflowGenericDrawerHelpers.closeFully();
        this._selectedLayerIndex = -1;
    },

    /** Vẽ lại TOÀN BỘ layer lên `layerCanvas` — gọi lại mỗi lần `_layers` đổi (thêm/xoá/sửa/kéo).
     * Canvas riêng, chỉ chứa layer (nền trong suốt) — nằm TRÊN renderCanvas (Điều chỉnh màu),
     * DƯỚI interactCanvas (overlay tương tác) trong DOM, xem core/file-manager/photo-ui.js. */
    _renderLayers() {
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        const ctx = handle.layerCanvas.getContext('2d');
        ctx.clearRect(0, 0, handle.layerCanvas.width, handle.layerCanvas.height);
        for (const layer of this._layers) {
            if (layer.type === 'text') {
                drawTextOnCanvas(handle.layerCanvas, layer.text, layer.x, layer.y, layer.fontSizePx, layer.color); // core/photo-editor-engine.js
            } else {
                drawShapeOnCanvas(handle.layerCanvas, layer); // core/photo-editor-engine.js
            }
        }
    },

    // ===================== Tách nền (Magic cutout) =====================

    /** Vào tool Tách nền — CHỈ hiện nút Huỷ ở contextBar (mỗi lần chạm áp dụng NGAY vào base,
     * không có bước xác nhận riêng, KHÔNG cần `applyMagicTool()` riêng). Popup dưới đáy chỉnh dung
     * sai màu TRƯỚC khi chạm. Nút Huỷ wire 1 lần ở photo-ui.js. Slider dung sai + pointer down
     * KHÔNG wire ở đây nữa (Core wire vĩnh viễn, xem `updateMagicSlider()`/`magicPointerDown()`). */
    _startMagicTool() {
        const handle = this._activeImageModalHandle;
        workflowGenericDrawerHelpers.closeFully(); // FIX (bug có từ trước) — xem ghi chú _startCropTool()
        this._activeSubTool = 'magic';
        handle.header.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.add('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolMagic');
        handle.magicPopup.classList.remove('hidden');
    },

    /** Ứng với `imageEdit.magic.slider.input` (kéo slider dung sai màu, wire 1 lần ở photo-ui.js).
     * Public — Router gọi trực tiếp. @param {number} value */
    updateMagicSlider(value) {
        if (this._activeSubTool !== 'magic') return; // guard: slider chỉ HIỆN lúc tool Tách nền mở
        this._activeImageModalHandle.magicValueEl.textContent = value;
    },

    /** Ứng với `imageEdit.interactCanvas.pointerDown` lúc `getActiveSubTool()==='magic'` — chạm 1
     * điểm, tách MÀU TRƠN quanh điểm đó khỏi TOÀN ẢNH (không phải flood-fill theo vùng liền kề, xem
     * `applyMagicCutout()`, core/photo-editor-engine.js), áp NGAY vào `base` + vẽ lại `render`.
     * `taskManager.once(fn, 10, ...)` — nhường 1 tick trước khi quét toàn ảnh (có thể vài chục-trăm
     * ms với ảnh lớn), tránh cảm giác "đứng hình" lúc chạm. Public — Router gọi trực tiếp.
     * @param {{x:number,y:number}} pos
     */
    magicPointerDown(pos) {
        const handle = this._activeImageModalHandle;
        const tolerance = parseInt(handle.magicSliderEl.value, 10);
        taskManager.once(() => { // service/task-manager.js
            const imageData = applyMagicCutout(handle.baseCanvas, Math.floor(pos.x), Math.floor(pos.y), tolerance); // core/photo-editor-engine.js
            if (!imageData) return; // guard: chạm ngoài canvas hoặc điểm đã trong suốt sẵn
            handle.baseCanvas.getContext('2d').putImageData(imageData, 0, 0);
            this._renderEditPreview();
        }, 10, 'photoEditMagicCutout');
    },

    /** Xuất ảnh cuối cùng ra 1 Blob JPEG chất lượng cao — dùng chung bởi `saveEditOverwrite()`/
     * `saveEditAsNew()`. MỚI (layer Text/Shape) — GỘP `layerCanvas` (Text/Shape còn ở dạng object,
     * KHÔNG lưu chồng lên `baseCanvas` như Crop/Vẽ) đè lên `renderCanvas` (base + Điều chỉnh) TRƯỚC
     * khi xuất — dựng 1 canvas TẠM để gộp, KHÔNG mutate `renderCanvas` (vẫn cần giữ nguyên để còn
     * chỉnh sửa tiếp nếu Giang bấm Lưu mà quay lại sửa tiếp, dù hiện tại `saveEdit*()` đóng modal
     * ngay sau — vẫn giữ đúng nguyên tắc "hàm xuất không phá dữ liệu nguồn").
     * @returns {Promise<Blob>} */
    _exportEditedBlob() {
        const handle = this._activeImageModalHandle;
        const flattened = document.createElement('canvas');
        flattened.width = handle.renderCanvas.width; flattened.height = handle.renderCanvas.height;
        const ctx = flattened.getContext('2d');
        ctx.drawImage(handle.renderCanvas, 0, 0);
        ctx.drawImage(handle.layerCanvas, 0, 0);
        return new Promise((resolve, reject) => {
            flattened.toBlob((blob) => {
                if (!blob) { reject(new Error('[_exportEditedBlob] canvas.toBlob trả về null')); return; }
                resolve(blob);
            }, 'image/jpeg', 0.92);
        });
    },

    /** Sinh tên file MỚI cho "Lưu mới" — BẮT BUỘC khác tên gốc: `resolveImageKey()` (core/file-
     * manager/image.js) coi TRÙNG tên là "cùng ảnh, ghi đè đúng key cũ" — dùng nguyên tên gốc sẽ vô
     * tình ghi đè thay vì tạo ảnh mới.
     * @param {string} originalFilename @returns {string} */
    _buildEditedNewFilename(originalFilename) {
        const dotIndex = originalFilename.lastIndexOf('.');
        const base = dotIndex > 0 ? originalFilename.slice(0, dotIndex) : originalFilename;
        const ext = dotIndex > 0 ? originalFilename.slice(dotIndex) : '.jpg';
        return `${base}_edited_${Date.now()}${ext}`;
    },

    /** Ứng với "Ghi đè" trong dropdown Save (icon Save trên header, `openSaveMenu()`) — xuất
     * `renderCanvas` -> resize thumbnail (`workflowFileManagerPhoto.resizeImageForThumbnail()`,
     * dùng chung upload) -> `updateImageBlob()` (core/file-manager/image.js) ghi đè ĐÚNG key đang
     * mở. Đóng modal SAU KHI lưu xong.
     * SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — thêm bước tính lại `duration`
     * (`workflowFileManagerPhoto.computePhotoDuration()`) TRƯỚC `updateImageBlob()` — crop/rotate
     * đổi cả kích thước lẫn dung lượng ảnh, giữ nguyên số `duration` cũ sẽ SAI so với nội dung ảnh
     * thật (cùng lý do `thumbBlob`/`width`/`height` cũng phải tính lại, xem comment gốc trên).
     */
    async saveEditOverwrite() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return; // guard: hiếm, không ở Edit mode nữa
        const imageKey = this._activeImageKey;

        await withLoadingShield(t('common.loading.savingImageEdit'), async () => {
            const finalBlob = await this._exportEditedBlob();
            const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(finalBlob);
            const duration = await workflowFileManagerPhoto.computePhotoDuration(finalBlob, width, height); // MỚI — event/workflow/file-manager-photo.js
            await updateImageBlob(imageKey, finalBlob, thumbBlob, width, height, duration); // core/file-manager/image.js
        });
        workflowFileManagerPhoto.closeImagePreview();
        await alertModal(t('fileManager.photo.image.editSaveOverwriteSuccess'));
    },

    /** Ứng với "Lưu mới" trong dropdown Save (icon Save trên header, `openSaveMenu()`) — xuất
     * `renderCanvas` -> resize thumbnail -> `saveImage()` (core/file-manager/image.js, dùng CHUNG
     * hàm upload) với tên file MỚI (`_buildEditedNewFilename()`). Đóng modal SAU KHI lưu xong.
     * SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — thêm bước tính `duration`
     * (`workflowFileManagerPhoto.computePhotoDuration()`) TRƯỚC `saveImage()`, cùng lý do
     * `saveEditOverwrite()` ngay trên.
     */
    async saveEditAsNew() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return; // guard: hiếm, không ở Edit mode nữa

        await withLoadingShield(t('common.loading.savingImageEdit'), async () => {
            const originalRecord = await getImageRecord(this._activeImageKey); // service/db.js
            const finalBlob = await this._exportEditedBlob();
            const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(finalBlob);
            const duration = await workflowFileManagerPhoto.computePhotoDuration(finalBlob, width, height); // MỚI — event/workflow/file-manager-photo.js
            const newFilename = this._buildEditedNewFilename(originalRecord ? originalRecord.filename : 'photo.jpg');
            await saveImage(finalBlob, newFilename, thumbBlob, width, height, duration); // core/file-manager/image.js
        });
        workflowFileManagerPhoto.closeImagePreview();
        await alertModal(t('fileManager.photo.image.editSaveNewSuccess'));
    },

    /** Dọn Edit mode (nếu đang ở đó) — ẩn canvasWrap, hiện lại `<img>`, gỡ delegated click lưới
     * tool, đóng popup/contextBar từng tool + Generic Drawer, xoá sạch state/snapshot. An toàn gọi
     * khi KHÔNG đang Edit mode (guard `_activeEditParams`). Public — `workflowFileManagerPhoto` gọi
     * ngược lại lúc đóng HẲN modal xem ảnh (`closeImagePreview()`) — KHÔNG gọi ở bất kỳ đâu khác
     * (đóng Generic Drawer bằng nút X KHÔNG gọi hàm này, xem case 'imageEdit.toolGrid.close.click'
     * — không có khái niệm "thoát Edit mà vẫn xem ảnh tiếp"). `toolsBtn` KHÔNG còn bị ẩn ở đây —
     * icon Edit LUÔN hiện trên header (core/file-manager/photo-ui.js), không theo vòng đời Edit
     * mode nữa. Xử lý được cả trường hợp thoát GIỮA CHỪNG 1 sub-tool.
     * SỬA (31/07/2026, Nhóm B) — KHÔNG còn gỡ `_subToolPointerCleanup`/`_textDragCleanup` (2 field
     * đó đã XOÁ, `interactCanvas`/`floatingText`/`document` wire VĨNH VIỄN 1 lần, không theo vòng
     * đời sub-tool nữa) — chỉ cần reset `_drawSessionActive`/`_textDragging` về false (dừng MỌI
     * phiên kéo/vẽ đang dở, nếu có).
     */
    /** Dọn Edit mode (nếu đang ở đó) — ẩn canvasWrap, hiện lại `<img>`, gỡ delegated click lưới
     * tool, đóng popup/contextBar từng tool + Generic Drawer, xoá sạch state/snapshot. An toàn gọi
     * khi KHÔNG đang Edit mode (guard `_activeEditParams`). Public — `workflowFileManagerPhoto` gọi
     * ngược lại lúc đóng HẲN modal xem ảnh (`closeImagePreview()`) — KHÔNG gọi ở bất kỳ đâu khác
     * (đóng Generic Drawer bằng nút X KHÔNG gọi hàm này, xem case 'imageEdit.toolGrid.close.click'
     * — không có khái niệm "thoát Edit mà vẫn xem ảnh tiếp"). `toolsBtn` KHÔNG còn bị ẩn ở đây —
     * icon Edit LUÔN hiện trên header (core/file-manager/photo-ui.js), không theo vòng đời Edit
     * mode nữa. Xử lý được cả trường hợp thoát GIỮA CHỪNG 1 sub-tool.
     * SỬA (31/07/2026, Nhóm B) — KHÔNG còn gỡ `_subToolPointerCleanup`/`_textDragCleanup` (2 field
     * đó đã XOÁ, `interactCanvas`/`floatingText`/`document` wire VĨNH VIỄN 1 lần, không theo vòng
     * đời sub-tool nữa) — chỉ cần reset `_drawSessionActive`/`_textDragging` về false (dừng MỌI
     * phiên kéo/vẽ đang dở, nếu có).
     * MỚI (layer Text/Shape) — reset SẠCH toàn bộ state layer: huỷ hẹn giờ long-press nếu còn
     * treo (tránh callback chạy TRỄ sau khi modal đã đóng, đọc phải `_activeImageModalHandle` đã
     * null), gỡ delegation style editor nếu đang mở, đóng luôn `shapeTypePopup` — `_layers` array
     * TỰ MẤT theo modal (KHÔNG lưu lại giữa các lần mở ảnh khác nhau, mỗi phiên Edit MỚI bắt đầu
     * `_layers = []` lại từ đầu ở `ensureEditSessionReady()`).
     */
    exitEditMode() {
        if (!this._activeEditParams) return;
        this._drawSessionActive = false;
        this._textDragging = false;
        if (this._layerLongPressTimer) { clearTimeout(this._layerLongPressTimer); this._layerLongPressTimer = null; }
        if (this._layerStyleDrawerClickHandler) { this._layerStyleDrawerClickHandler(); this._layerStyleDrawerClickHandler = null; }
        const handle = this._activeImageModalHandle;
        if (handle) {
            if (this._editToolGridClickHandler) { this._editToolGridClickHandler(); this._editToolGridClickHandler = null; }
            handle.canvasWrap.classList.add('hidden');
            handle.imgEl.classList.remove('hidden');
            handle.adjustPopup.classList.add('hidden');
            handle.contextBar.classList.add('hidden');
            handle.contextApplyBtn.classList.remove('hidden'); // reset (Magic/Shape lúc chọn loại tự ẩn nút này)
            handle.floatingText.classList.add('hidden');
            handle.drawControlsPopup.classList.add('hidden');
            handle.magicPopup.classList.add('hidden');
            handle.cropRatioPopup.classList.add('hidden');
            handle.shapeTypePopup.classList.add('hidden');
        }
        if (appState.get('isGenericDrawerOpen')) workflowGenericDrawerHelpers.closeFully();
        this._activeEditParams = null;
        this._activeAdjustParam = null;
        this._activeSubTool = 'none';
        this._activeImageModalHandle = null;
        this._activeImageKey = null;
        this._layers = [];
        this._selectedLayerIndex = -1;
        this._layerDragStart = null;
        this._layerDragMoved = false;
    },

};

