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
 * KHÔNG có khái niệm "mode" nào cần thoát — View/Zoom/Edit tích hợp sẵn, chạy đồng thời (bỏ
 * dropdown "..." + state `imagePreviewMode` cũ). Bấm icon Edit lần đầu decode ảnh vào canvas + ẩn
 * `<img>` (tạm dừng Zoom qua `workflowFileManagerPhoto.pauseZoomForEdit()` — kỹ thuật thuần, canvas
 * và `<img>` không thể cùng hiện), rồi mở Generic Drawer lưới tool. Đóng Drawer (nút X) CHỈ đóng
 * Drawer — canvas VẪN hiện nguyên, không có bước "quay lại xem ảnh thường" nào cả; bấm lại icon
 * Edit chỉ đơn giản mở lại lưới (`openEditToolGrid()`). Chỉ khi đóng HẲN modal xem ảnh mới thật sự
 * dọn sạch mọi state Edit (`exitEditMode()`).
 *
 * NẠP SAU: event/workflow/file-manager-photo.js, event/workflow/generic-drawer-helpers.js,
 * core/photo-editor-engine.js, core/crop-selector.js, core/generic-drawer.js, service/z-index.js.
 */
const workflowImageEdit = {

    _activeImageModalHandle: null, // snapshot từ workflowFileManagerPhoto.getActiveImageModalHandle() lúc enterEditMode()
    _activeImageKey: null,         // snapshot từ getActiveImageKey() — decode canvas cần lại
    _activeEditParams: null,       // {brightness,contrast,saturation,temperature,tint,sharpen} — null khi không ở Edit mode
    _activeAdjustParam: null,      // key param đang mở slider — null khi popup adjust đang ẩn
    _activeSubTool: 'none',        // 'none'|'crop'|'draw'|'text'|'magic' — KHÁC 'adjust' (live-preview trực tiếp, không có sub-tool mode riêng)
    _editToolGridClickHandler: null, // hàm GỠ trả về từ wirePhotoEditToolGridDelegation() (core/file-manager/photo-ui.js), wire 1 lần/phiên
    _cropSession: null,            // session core/crop-selector.js — chỉ có nghĩa khi _activeSubTool==='crop'
    _drawType: 'brush',            // 'brush'|'eraser'
    _drawSessionActive: false,     // SỬA (31/07/2026, Nhóm B) — THAY biến `isDrawing` closure cũ (đã xoá cùng _wireSubToolPointerEvents()) — true trong lúc đang kéo vẽ 1 nét
    _drawLastPos: null,            // THAY biến `lastPos` closure cũ — điểm cuối cùng đã vẽ, nối tiếp nét kế tiếp
    _textDragging: false,          // SỬA (31/07/2026, Nhóm B) — THAY biến `dragging` closure cũ (đã xoá cùng _wireFloatingTextDrag()) — true trong lúc đang kéo floatingText. Router gọi updateTextDrag()/endTextDrag() TỪ document pointermove/pointerup TOÀN APP (event/listener/image-edit.js) — field này là "cổng" duy nhất quyết định có làm gì hay không

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
        [handle.baseCanvas, handle.renderCanvas, handle.interactCanvas].forEach(c => {
            c.width = decoded.width; c.height = decoded.height;
        });
        handle.baseCanvas.getContext('2d').drawImage(decoded, 0, 0);
        handle.renderCanvas.getContext('2d').drawImage(decoded, 0, 0);
        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
        return true;
    },

    /** Vào Edit mode (router `imageEdit`, case 'imageEdit.tools.click' khi CHƯA editing) — tạm dừng
     * Zoom (ảnh/canvas không thể cùng lúc pan/zoom VÀ hiện kết quả edit), đảm bảo đã decode
     * (`ensureEditSessionReady()`), ẩn `<img>`/hiện `canvasWrap`, mở Generic Drawer hiện lưới tool
     * phẳng. KHÔNG có khái niệm "thoát Edit mode" quay lại xem ảnh thường — đóng Drawer (nút X)
     * CHỈ đóng Drawer, canvas vẫn hiện nguyên (xem case 'imageEdit.toolGrid.close.click'); chỉ có
     * đóng HẲN modal xem ảnh mới dọn sạch (`exitEditMode()`, gọi từ `closeImagePreview()`).
     */
    async enterEditMode() {
        workflowFileManagerPhoto.pauseZoomForEdit(); // GỘP View/Zoom/Edit làm 1 — Zoom tạm dừng trong lúc Edit hiện canvas thay <img>
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
        handle.contextApplyBtn.classList.remove('hidden'); // reset — _startMagicTool() tự ẩn nút này
        handle.header.classList.remove('hidden');
        handle.floatingText.classList.add('hidden');
        handle.drawControlsPopup.classList.add('hidden');
        handle.magicPopup.classList.add('hidden');
        this._activeSubTool = 'none';
        this._cropSession = null;
        this.openEditToolGrid();
    },

    // ===================== Crop =====================
    // Tương tác (khung/handle/kéo tay) ở core/crop-selector.js — DÙNG CHUNG với Video Editor. File
    // này chỉ giữ `_cropSession` + phần "Áp dụng" riêng của Photo (cắt pixel thật ngay).

    /** Vào tool Crop — Photo KHÔNG khoá tỉ lệ khung hình (aspectRatio NaN = Tự do). Pointer events
     * KHÔNG wire ở đây nữa (Core đã wire vĩnh viễn, xem `cropPointerDown()`/`cropPointerMove()`/
     * `cropPointerUp()` — Router tự gọi khi `getActiveSubTool()==='crop'`). */
    _startCropTool() {
        const handle = this._activeImageModalHandle;
        this._activeSubTool = 'crop';
        handle.header.classList.add('hidden');
        handle.contextBar.classList.remove('hidden');
        handle.contextApplyBtn.classList.remove('hidden');
        handle.contextTitleEl.textContent = t('fileManager.photo.image.editToolCrop');

        this._cropSession = initCropSession(handle.baseCanvas.width, handle.baseCanvas.height); // core/crop-selector.js
        this._drawCropOverlay();
    },

    /** Ứng với `imageEdit.interactCanvas.pointerDown` lúc `getActiveSubTool()==='crop'`. Public —
     * Router gọi trực tiếp. @param {{x:number,y:number}} pos */
    cropPointerDown(pos) {
        if (!this._cropSession) return; // guard: hiếm, lệch nhịp giữa Router đọc state và lúc hàm này thật sự chạy
        cropSessionPointerDown(this._cropSession, pos, 30 * this._editScale()); // core/crop-selector.js
    },

    /** Ứng với `imageEdit.interactCanvas.pointerMove` lúc `getActiveSubTool()==='crop'`. Public —
     * Router gọi trực tiếp. @param {{x:number,y:number}} pos */
    cropPointerMove(pos) {
        if (!this._cropSession) return;
        this._moveOrResizeCropSession(pos);
        this._drawCropOverlay();
    },

    /** Ứng với `imageEdit.interactCanvas.pointerUp` lúc `getActiveSubTool()==='crop'`. Public —
     * Router gọi trực tiếp. */
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
        [handle.baseCanvas, handle.renderCanvas, handle.interactCanvas].forEach(c => { c.width = rect.w; c.height = rect.h; });
        handle.baseCanvas.getContext('2d').drawImage(cropped, 0, 0);
        handle.renderCanvas.getContext('2d').drawImage(cropped, 0, 0);
        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
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

    /** Áp dụng Text — "nướng" thẳng lên `base` MỚI (gồm Điều chỉnh hiện tại gộp vào trước), tại
     * ĐÚNG vị trí `floatingText` đang hiện (quy đổi CSS -> canvas qua `_editScale()`). Bỏ qua nếu
     * rỗng/toàn khoảng trắng. Public — Router gọi qua case 'imageEdit.subTool.apply.click'.
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

        const baseCtx = handle.baseCanvas.getContext('2d');
        baseCtx.clearRect(0, 0, handle.baseCanvas.width, handle.baseCanvas.height);
        baseCtx.drawImage(handle.renderCanvas, 0, 0); // gộp Điều chỉnh hiện tại vào base trước khi vẽ chữ đè lên
        drawTextOnCanvas(handle.baseCanvas, text, cx, cy, fontSizePx, handle.floatingText.style.color); // core/photo-editor-engine.js

        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
        this._renderEditPreview(); // params vừa reset về 0 -> chỉ copy base (đã có chữ) sang render
        this.exitSubTool();
    },

    // ===================== Tách nền (Magic cutout) =====================

    /** Vào tool Tách nền — CHỈ hiện nút Huỷ ở contextBar (mỗi lần chạm áp dụng NGAY vào base,
     * không có bước xác nhận riêng, KHÔNG cần `applyMagicTool()` riêng). Popup dưới đáy chỉnh dung
     * sai màu TRƯỚC khi chạm. Nút Huỷ wire 1 lần ở photo-ui.js. Slider dung sai + pointer down
     * KHÔNG wire ở đây nữa (Core wire vĩnh viễn, xem `updateMagicSlider()`/`magicPointerDown()`). */
    _startMagicTool() {
        const handle = this._activeImageModalHandle;
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

    /** Xuất `renderCanvas` (kết quả đã áp Điều chỉnh) ra 1 Blob JPEG chất lượng cao — dùng chung
     * bởi `saveEditOverwrite()`/`saveEditAsNew()`. @returns {Promise<Blob>} */
    _exportEditedBlob() {
        return new Promise((resolve, reject) => {
            this._activeImageModalHandle.renderCanvas.toBlob((blob) => {
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
    exitEditMode() {
        if (!this._activeEditParams) return;
        this._drawSessionActive = false;
        this._textDragging = false;
        const handle = this._activeImageModalHandle;
        if (handle) {
            if (this._editToolGridClickHandler) { this._editToolGridClickHandler(); this._editToolGridClickHandler = null; }
            handle.canvasWrap.classList.add('hidden');
            handle.imgEl.classList.remove('hidden');
            handle.adjustPopup.classList.add('hidden');
            handle.contextBar.classList.add('hidden');
            handle.contextApplyBtn.classList.remove('hidden'); // reset (Magic tự ẩn nút này)
            handle.floatingText.classList.add('hidden');
            handle.drawControlsPopup.classList.add('hidden');
            handle.magicPopup.classList.add('hidden');
        }
        if (appState.get('isGenericDrawerOpen')) workflowGenericDrawerHelpers.closeFully();
        this._activeEditParams = null;
        this._activeAdjustParam = null;
        this._activeSubTool = 'none';
        this._activeImageModalHandle = null;
        this._activeImageKey = null;
    },

};

