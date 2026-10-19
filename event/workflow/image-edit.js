/**
 * event/workflow/image-edit.js — trình sửa ảnh của modal xem ảnh Photo: Điều chỉnh (6 slider), Crop, Vẽ, Text, Shape,
 * chèn Ảnh, layer (chọn/kéo/long-press menu, danh sách Layer trong Generic Drawer, biến đổi co/xoay/lật), Lưu đè/Lưu mới.
 * Router: event/router/image-edit.js (`imageEdit`).
 *
 * `workflowFileManagerPhoto` giữ vòng đời modal (mở/đóng/Zoom) và lộ 2 khe đọc (`getActiveImageModalHandle()`,
 * `getActiveImageKey()`); workflow này chụp lại lúc `ensureEditSessionReady()` (gọi ngay khi mở modal — canvas sẵn sàng
 * từ đầu, không có "mode" sửa). `exitEditMode()` được gọi ngược lại lúc đóng hẳn modal.
 *
 * Canvas (core/file-manager/photo-ui.js): base = pixel gốc sau thao tác vĩnh viễn (Crop/Vẽ), render = base + Điều chỉnh,
 * layer = các layer vẽ lại mỗi lần đổi (chỉ "nướng" lúc Lưu), interact = khung crop / nét nháp / khung biến đổi.
 * Công cụ có thanh Huỷ/Áp dụng ("sub-tool"): 'crop' | 'draw' | 'text' | 'shapePlacement' | 'transform'; 'none' = đang
 * xem — chạm canvas là chọn/kéo layer. Thoát công cụ quay về nơi đã mở nó (lưới công cụ / danh sách Layer / không gì).
 * Ghi DOM: core/image-edit-ui.js; tính + vẽ: core/photo-editor-engine.js; markup: components/image-preview-modal.js,
 * components/image-edit-drawers.js, components/image-edit-modals.js.
 *
 * NẠP SAU: event/workflow/file-manager-photo.js, event/workflow/generic-drawer-helpers.js, core/photo-editor-engine.js,
 * core/image-edit-ui.js, core/file-manager/photo-ui.js, core/media-transform.js, service/z-index.js. Lúc chạy:
 * workflowElementStyleEditor, workflowPhotoDuration, core/element-style-editor.js (parse CSS, nạp Google Font).
 */

const IMAGE_EDIT_ADJUST_PREVIEW_TASK = 'photoEditAdjustPreview';
const IMAGE_EDIT_LAYER_LONG_PRESS_TASK = 'imageEditLayerLongPress';
const IMAGE_EDIT_LAYER_LONG_PRESS_MS = 1500;
const IMAGE_EDIT_FONT_WAIT_TASK = 'imageEditFontWait';
const IMAGE_EDIT_FONT_WAIT_INTERVAL_MS = 200;
const IMAGE_EDIT_FONT_WAIT_TRIES = 50; // ~10s rồi thôi chờ (mất mạng / tên font sai)
const IMAGE_EDIT_LAYER_MENU_Z_INDEX = 132; // dropdown trên modal ảnh (130) và Generic Drawer của nó (131)
const IMAGE_EDIT_EXPORT_JPEG_QUALITY = 0.92;
// Khoảng cách tính bằng CSS px (quy ra pixel canvas theo object-fit lúc dùng).
const IMAGE_EDIT_CROP_HIT_CSS_PX = 30;
const IMAGE_EDIT_CROP_MIN_CSS_PX = 50;
const IMAGE_EDIT_LAYER_DRAG_THRESHOLD_CSS_PX = 8;
const IMAGE_EDIT_TRANSFORM_HANDLE_GAP_CSS_PX = 36;
const IMAGE_EDIT_TRANSFORM_HIT_CSS_PX = 28;

const IMAGE_EDIT_NEUTRAL_PARAMS = Object.freeze({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 });

/** Slider Điều chỉnh: giới hạn + nhãn (sharpen từ 0, còn lại -100..100). */
const IMAGE_EDIT_ADJUST_PARAMS = {
    brightness: { min: -100, max: 100, labelKey: 'fileManager.photo.image.editToolBrightness' },
    contrast: { min: -100, max: 100, labelKey: 'fileManager.photo.image.editToolContrast' },
    saturation: { min: -100, max: 100, labelKey: 'fileManager.photo.image.editToolSaturation' },
    temperature: { min: -100, max: 100, labelKey: 'fileManager.photo.image.editToolTemperature' },
    tint: { min: -100, max: 100, labelKey: 'fileManager.photo.image.editToolTint' },
    sharpen: { min: 0, max: 100, labelKey: 'fileManager.photo.image.editToolSharpen' },
};

/** Tile lưới công cụ -> việc mở công cụ. */
const EDIT_TOOL_OPEN_BY_KEY = {
    brightness: () => workflowImageEdit.openAdjustTool('brightness'),
    contrast: () => workflowImageEdit.openAdjustTool('contrast'),
    saturation: () => workflowImageEdit.openAdjustTool('saturation'),
    temperature: () => workflowImageEdit.openAdjustTool('temperature'),
    tint: () => workflowImageEdit.openAdjustTool('tint'),
    sharpen: () => workflowImageEdit.openAdjustTool('sharpen'),
    crop: () => workflowImageEdit._startCropTool(),
    draw: () => workflowImageEdit._startDrawTool(),
    text: () => workflowImageEdit._startTextTool(),
    shape: () => workflowImageEdit._startShapeTool(),
    image: () => workflowImageEdit._openInsertImagePicker(),
};

/** Kéo khung Crop / đặt Shape: chế độ (core/media-transform.js::computeCropDragStep()) -> hàm tính rect. */
const CROP_DRAG_RECT_BY_MODE = {
    move: (session, step) => moveCropRect(step.startRect, step.dx, step.dy, session.sourceWidth, session.sourceHeight), // core/media-transform.js
    free: (session, step, minSize) => computeFreeResizedRect(step.startRect, step.flipX, step.flipY, step.dx, step.dy, minSize, session.sourceWidth, session.sourceHeight),
    locked: (session, step, minSize) => computeRatioLockedResizedRect(step.startRect, step.flipX, step.flipY, step.dx, session.aspectRatio, minSize, session.sourceWidth, session.sourceHeight),
};

/** Thoát 1 công cụ xong -> quay về nơi đã mở nó. */
const SUBTOOL_EXIT_RETURN_BY_TARGET = {
    toolGrid: () => workflowImageEdit.openEditToolGrid(),
    layerPanel: () => workflowImageEdit.openLayerPanel(),
    none: () => {},
};

/** Huỷ công cụ: việc hoàn tác riêng (công cụ không có trong bảng -> chỉ thoát). Shape đang đặt bị bỏ; biến đổi trả về
 * trạng thái lúc mở. */
const SUBTOOL_CANCEL_BY_TOOL = {
    shapePlacement: () => workflowImageEdit._discardPendingShape(),
    transform: () => workflowImageEdit._restoreTransformSnapshot(),
};

/** Áp dụng Text: có chữ -> tạo layer; rỗng -> chỉ thoát. */
const TEXT_APPLY_BY_HAS_TEXT = {
    true: (draft) => workflowImageEdit._addTextLayer(draft),
    false: () => {},
};

/** Chạm canvas lúc không mở công cụ: trúng layer -> bắt đầu nhấn/kéo; trượt -> bỏ chọn. */
const LAYER_POINTER_DOWN_BY_HIT = {
    true: (index, pos) => workflowImageEdit._beginLayerPress(index, pos),
    false: () => workflowImageEdit._clearLayerSelection(),
};

/** Hộp bao theo loại layer (core/photo-editor-engine.js). */
const IMAGE_EDIT_LAYER_BOX_BY_TYPE = {
    text: (layer, canvas) => measureTextLayerBox(canvas, layer, buildTextLayerFontSpec(layer)),
    shape: (layer) => measureShapeLayerBox(layer),
    image: (layer) => measureImageLayerBox(layer),
};

/** Vẽ Shape theo loại hình. */
const IMAGE_EDIT_SHAPE_PAINT_BY_KIND = {
    rect: (canvas, layer) => drawRectShapeLayer(canvas, layer),
    circle: (canvas, layer) => drawCircleShapeLayer(canvas, layer),
    line: (canvas, layer) => drawLineShapeLayer(canvas, layer),
    arrow: (canvas, layer) => drawArrowShapeLayer(canvas, layer),
    polygon: (canvas, layer) => drawPolygonShapeLayer(canvas, layer),
};

/** Vẽ theo loại layer (đã trong khung biến đổi beginLayerPaint()). */
const IMAGE_EDIT_LAYER_PAINT_BY_TYPE = {
    text: (canvas, layer) => drawTextLayer(canvas, layer, buildTextLayerFontSpec(layer)),
    shape: (canvas, layer) => {
        applyShapeLayerStyle(canvas, layer);
        IMAGE_EDIT_SHAPE_PAINT_BY_KIND[layer.shapeType](canvas, layer);
    },
    image: (canvas, layer) => drawImageLayer(canvas, layer),
};

/** "Sửa kiểu" (Element Style Editor) theo loại layer — Image không có mục này. */
const IMAGE_EDIT_LAYER_STYLE_BY_TYPE = {
    text: { buildCss: (layer) => buildTextLayerStyleCss(layer), computePatch: (patch, layer) => computeTextLayerStylePatch(patch, layer), startTab: 'text' },
    shape: { buildCss: (layer) => buildShapeLayerStyleCss(layer), computePatch: (patch, layer) => computeShapeLayerStylePatch(patch, layer), startTab: 'box' },
};

/** Mục riêng theo loại của menu long-press (trước Biến đổi / Nhân bản / Xoá). `send(type)` trả callback bắn eventBus. */
const IMAGE_EDIT_LAYER_MENU_ITEMS_BY_TYPE = {
    text: (send) => [
        { icon: iconSvg('text'), name: t('fileManager.photo.image.layerMenuEditContent'), callback: send('imageEdit.layerMenu.editContent.click') },
        { icon: iconSvg('pencil-alt'), name: t('fileManager.photo.image.layerMenuEdit'), callback: send('imageEdit.layerMenu.editStyle.click') },
    ],
    shape: (send) => [
        { icon: iconSvg('pencil-alt'), name: t('fileManager.photo.image.layerMenuEdit'), callback: send('imageEdit.layerMenu.editStyle.click') },
    ],
    image: () => [],
};

/** Kéo khung biến đổi theo chế độ chạm đầu. */
const IMAGE_EDIT_TRANSFORM_DRAG_BY_MODE = {
    move: (drag, pos) => computeLayerMoveDrag(drag, pos), // core/photo-editor-engine.js
    scale: (drag, pos) => computeLayerScaleDrag(drag, pos),
    rotate: (drag, pos) => computeLayerRotateDrag(drag, pos),
};

/** Nút của popup biến đổi. */
const IMAGE_EDIT_TRANSFORM_ACTION_BY_KEY = {
    flipX: (layer) => computeLayerFlipX(layer), // core/photo-editor-engine.js
    flipY: (layer) => computeLayerFlipY(layer),
    rotate90: (layer) => computeLayerRotate90(layer),
    reset: () => computeLayerTransformReset(),
};

const workflowImageEdit = {

    _activeImageModalHandle: null, // snapshot từ workflowFileManagerPhoto lúc ensureEditSessionReady()
    _activeImageKey: null,
    _activeEditParams: null,       // {brightness..sharpen} — null trước khi decode xong
    _activeAdjustParam: null,      // param đang mở slider — null khi popup ẩn
    _activeSubTool: 'none',        // 'none'|'crop'|'draw'|'text'|'shapePlacement'|'transform'
    _subToolReturn: 'toolGrid',    // thoát công cụ xong quay về đâu (SUBTOOL_EXIT_RETURN_BY_TARGET)
    _cropSession: null,            // session kéo khung — Crop và đặt Shape mới
    _drawIsEraser: false,
    _drawSessionActive: false,
    _drawLastPos: null,
    _textDrag: null,               // { offset } lúc đang kéo tay nắm khung chữ nổi

    _layers: [],                   // thứ tự vẽ: dưới -> trên (xem docstring core/photo-editor-engine.js)
    _layerIdSeq: 0,
    _selectedLayerId: null,
    _pendingShapeId: null,         // Shape vừa tạo, đang đặt vị trí (Huỷ thì bỏ)
    _layerDragStart: null,         // {x, y, layerX, layerY} lúc chạm 1 layer (không mở công cụ)
    _layerDragMoved: false,
    _transformDrag: null,          // {mode, startPos, start, cx, cy}
    _transformSnapshot: null,      // trạng thái lúc mở Biến đổi — Huỷ trả về
    _layerPanelOpen: false,        // Generic Drawer đang hiện danh sách Layer
    _panelDrag: null,              // {id, rowEl, rowEls, rects, startY, targetIndex} lúc kéo-thả dòng

    /** Decode ảnh vào 4 canvas — idempotent. Gọi ngay khi mở modal (workflowFileManagerPhoto.openImagePreview()) và
     * phòng hờ ở các lối mở công cụ (bấm quá nhanh). @returns {Promise<boolean>} false = không còn modal/ảnh */
    async ensureEditSessionReady() {
        if (this._activeEditParams) return true;
        const handle = workflowFileManagerPhoto.getActiveImageModalHandle();
        if (!handle) return false;
        this._activeImageModalHandle = handle;
        this._activeImageKey = workflowFileManagerPhoto.getActiveImageKey();

        const record = await getImageRecord(this._activeImageKey); // service/db.js — Blob gốc
        if (!record) return false; // ảnh vừa bị xoá
        const decoded = await this._decodeBlobToCanvas(record.blob);
        loadEditCanvases(handle, decoded); // core/image-edit-ui.js
        syncEditCanvasDisplaySize(handle, computeCoverOrContain(decoded.width, decoded.height, window.innerWidth, window.innerHeight)); // core/file-manager/photo-ui.js + core/file-manager/image.js
        this._activeEditParams = { ...IMAGE_EDIT_NEUTRAL_PARAMS };
        this._layers = [];
        return true;
    },

    /** @param {Blob} blob @returns {Promise<HTMLCanvasElement>} */
    async _decodeBlobToCanvas(blob) {
        const url = createBlobUrl(blob); // service/blob-url.js
        try {
            return await decodeImageToCanvas(url); // core/photo-editor-engine.js
        } finally {
            revokeBlobUrl(url);
        }
    },

    // ===================== Lưới công cụ / Lưu =====================

    /** Icon Edit trên header — mở lưới công cụ (Generic Drawer). Gọi lại sau mỗi lần thoát công cụ mở từ lưới. */
    async openEditToolGrid() {
        const ready = await this.ensureEditSessionReady();
        if (!ready || !this._activeImageModalHandle) return;
        this._layerPanelOpen = false;
        workflowGenericDrawerHelpers.open(buildImageEditDrawerConfig(renderImageEditToolGridHeaderHtml(), renderImageEditToolGridHtml(), 'imageEdit:toolGrid')); // core/file-manager/photo-ui.js + components/image-edit-drawers.js
        wirePhotoEditToolGridDrawerUi(); // core/file-manager/photo-ui.js
    },

    /** 'imageEdit.toolGrid.tile.click'. @param {string} toolKey */
    openEditTool(toolKey) {
        const open = EDIT_TOOL_OPEN_BY_KEY[toolKey];
        if (!open) return;
        open();
    },

    /** Icon Lưu trên header — dropdown Ghi đè / Lưu mới (lưu được cả khi chưa sửa gì). @param {HTMLElement} anchorEl */
    async openSaveMenu(anchorEl) {
        const ready = await this.ensureEditSessionReady();
        if (!ready) return;
        const items = [
            { icon: iconSvg('save-image'), name: t('fileManager.photo.image.btnSaveOverwrite'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.saveOverwrite.click', payload: {} }) },
            { icon: iconSvg('plus'), name: t('fileManager.photo.image.btnSaveNew'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.saveAsNew.click', payload: {} }) },
        ];
        openDropdownMenu(anchorEl, items, { zIndex: IMAGE_EDIT_LAYER_MENU_Z_INDEX }); // core/dropdown-menu.js
    },

    // ===================== Điều chỉnh =====================

    /** Tile Điều chỉnh — đóng Drawer, hiện popup slider (kéo tới đâu áp tới đó). @param {string} paramKey */
    openAdjustTool(paramKey) {
        const handle = this._activeImageModalHandle;
        const config = IMAGE_EDIT_ADJUST_PARAMS[paramKey];
        if (!handle || !this._activeEditParams || !config) return;
        workflowGenericDrawerHelpers.closeFully();
        this._activeAdjustParam = paramKey;
        showAdjustPopup(handle, { label: t(config.labelKey), min: config.min, max: config.max, value: this._activeEditParams[paramKey] }); // core/image-edit-ui.js
    },

    /** 'imageEdit.adjust.slider.input' — vẽ lại xem trước (debounce). @param {number} value */
    updateAdjustSlider(value) {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeAdjustParam) return;
        this._activeEditParams[this._activeAdjustParam] = value;
        setAdjustValueLabel(handle, value); // core/image-edit-ui.js
        taskManager.once(() => this._renderEditPreview(), 60, IMAGE_EDIT_ADJUST_PREVIEW_TASK);
    },

    /** 'imageEdit.adjust.done.click' — đóng popup, về lưới công cụ. */
    exitAdjustTool() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeAdjustParam) return;
        hideAdjustPopup(handle); // core/image-edit-ui.js
        this._activeAdjustParam = null;
        this.openEditToolGrid();
    },

    /** render = base + Điều chỉnh + Sharpen (base giữ nguyên để chỉnh đi chỉnh lại). */
    _renderEditPreview() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return;
        const adjusted = applyColorAdjustments(handle.baseCanvas, this._activeEditParams); // core/photo-editor-engine.js
        putEditRenderImageData(handle, applySharpenFilter(adjusted, this._activeEditParams.sharpen)); // core/image-edit-ui.js
    },

    // ===================== Công cụ có Huỷ/Áp dụng (chung) =====================

    /** @returns {string} công cụ đang mở — Router chọn hàm cho chạm canvas / nút Áp dụng. */
    getActiveSubTool() { return this._activeSubTool; },

    /** @returns {{rect: DOMRect, displayScale: number, offsetX: number, offsetY: number}} */
    _fit() {
        return measureEditCanvasFit(this._activeImageModalHandle.interactCanvas); // core/image-edit-ui.js
    },

    /** @param {number} cssPx @returns {number} pixel canvas */
    _cssToCanvasPx(cssPx) {
        return cssPxToCanvasPx(cssPx, this._fit().displayScale); // core/photo-editor-engine.js
    },

    /** Vào 1 công cụ: đóng Drawer, hiện thanh Huỷ/Áp dụng. @param {string} tool @param {string} titleKey
     * @param {boolean} showApply @param {'toolGrid'|'layerPanel'|'none'} returnTo */
    _enterSubTool(tool, titleKey, showApply, returnTo) {
        workflowGenericDrawerHelpers.closeFully(); // Drawer đè lên thanh Huỷ/Áp dụng + canvas
        this._layerPanelOpen = false;
        this._activeSubTool = tool;
        this._subToolReturn = returnTo;
        showEditContextBar(this._activeImageModalHandle, t(titleKey), showApply); // core/image-edit-ui.js
    },

    /** 'imageEdit.subTool.cancel.click' — hoàn tác riêng của công cụ (nếu có) rồi thoát. */
    exitSubTool() {
        if (!this._activeImageModalHandle) return;
        (SUBTOOL_CANCEL_BY_TOOL[this._activeSubTool] || (() => {}))();
        this._leaveSubTool();
    },

    /** Thoát công cụ về mặt xem rồi quay về nơi đã mở công cụ. */
    _leaveSubTool() {
        resetEditChrome(this._activeImageModalHandle); // core/image-edit-ui.js
        this._activeSubTool = 'none';
        this._cropSession = null;
        this._textDrag = null;
        this._transformDrag = null;
        this._transformSnapshot = null;
        this._pendingShapeId = null;
        const returnTo = this._subToolReturn;
        this._subToolReturn = 'toolGrid';
        SUBTOOL_EXIT_RETURN_BY_TARGET[returnTo]();
    },

    // ===================== Crop =====================

    /** Tile Crop — mặc định Tự do; tỉ lệ chọn ở popup. */
    _startCropTool() {
        const handle = this._activeImageModalHandle;
        this._enterSubTool('crop', 'fileManager.photo.image.editToolCrop', true, 'toolGrid');
        setEditPopupVisible(handle.cropRatioPopup, true); // core/image-edit-ui.js
        this._cropSession = initCropSession(handle.baseCanvas.width, handle.baseCanvas.height); // core/media-transform.js
        this._drawCropOverlay();
    },

    /** 'imageEdit.crop.setRatio.click'. @param {string} ratioKey - 'free'|'1:1'|'4:3'|'3:4'|'16:9'|'9:16' */
    setCropAspectRatio(ratioKey) {
        if (!this._cropSession) return;
        setCropSessionAspectRatio(this._cropSession, parseCropRatioKey(ratioKey)); // core/media-transform.js + core/photo-editor-engine.js
        this._drawCropOverlay();
    },

    /** Chạm canvas lúc 'crop' / 'shapePlacement'. @param {{x:number,y:number}} pos */
    cropPointerDown(pos) {
        if (!this._cropSession) return;
        cropSessionPointerDown(this._cropSession, pos, this._cssToCanvasPx(IMAGE_EDIT_CROP_HIT_CSS_PX)); // core/media-transform.js
    },

    /** Kéo khung; đang đặt Shape mới thì Shape chạy theo khung. @param {{x:number,y:number}} pos */
    cropPointerMove(pos) {
        if (!this._cropSession) return;
        const step = computeCropDragStep(this._cropSession, pos); // core/media-transform.js
        const computeRect = CROP_DRAG_RECT_BY_MODE[step.mode];
        if (!computeRect) return; // không giữ handle nào
        this._cropSession.rect = computeRect(this._cropSession, step, this._cssToCanvasPx(IMAGE_EDIT_CROP_MIN_CSS_PX));
        this._drawCropOverlay();
        this._syncPendingShapeRect();
    },

    cropPointerUp() {
        if (!this._cropSession) return;
        cropSessionPointerUp(this._cropSession); // core/media-transform.js
    },

    _drawCropOverlay() {
        drawCropSessionOverlay(this._activeImageModalHandle.interactCanvas, this._cropSession, this._cssToCanvasPx(1)); // core/media-transform.js
    },

    /** Áp dụng Crop — cắt từ render (gồm Điều chỉnh), nạp làm nền mới, dịch layer theo gốc toạ độ mới (layer nằm ngoài
     * vùng cắt tự ra ngoài canvas). */
    applyCropTool() {
        const handle = this._activeImageModalHandle;
        const rect = getCropSessionRect(this._cropSession); // core/media-transform.js
        const cropped = cropCanvas(handle.renderCanvas, rect); // core/photo-editor-engine.js
        loadEditCanvases(handle, cropped); // core/image-edit-ui.js
        syncEditCanvasDisplaySize(handle, computeCoverOrContain(rect.w, rect.h, window.innerWidth, window.innerHeight)); // tỉ lệ đổi sau Crop
        this._activeEditParams = { ...IMAGE_EDIT_NEUTRAL_PARAMS };
        this._layers = shiftImageEditLayers(this._layers, -rect.x, -rect.y); // core/photo-editor-engine.js
        this._renderLayers();
        this._leaveSubTool();
    },

    // ===================== Vẽ (Cọ/Tẩy) =====================

    /** Tile Vẽ — nét nháp trên lớp tương tác, Áp dụng mới gộp vào ảnh. Tẩy chỉ xoá nét nháp. */
    _startDrawTool() {
        const handle = this._activeImageModalHandle;
        this._enterSubTool('draw', 'fileManager.photo.image.editToolDraw', true, 'toolGrid');
        this._drawIsEraser = false;
        this._drawSessionActive = false;
        this._drawLastPos = null;
        setEditPopupVisible(handle.drawControlsPopup, true); // core/image-edit-ui.js
        paintDrawToolButtons(handle, false);
    },

    /** @param {{x:number,y:number}} pos */
    drawPointerDown(pos) {
        this._drawSessionActive = true;
        this._drawLastPos = pos;
        this._drawStroke(pos, pos);
    },

    /** @param {{x:number,y:number}} pos */
    drawPointerMove(pos) {
        if (!this._drawSessionActive) return;
        this._drawStroke(this._drawLastPos, pos);
        this._drawLastPos = pos;
    },

    drawPointerUp() {
        this._drawSessionActive = false;
    },

    /** 'imageEdit.draw.selectBrush.click' */
    selectDrawBrush() {
        const handle = this._activeImageModalHandle;
        if (!handle || this._activeSubTool !== 'draw') return;
        this._drawIsEraser = false;
        paintDrawToolButtons(handle, false); // core/image-edit-ui.js
    },

    /** 'imageEdit.draw.selectEraser.click' */
    selectDrawEraser() {
        const handle = this._activeImageModalHandle;
        if (!handle || this._activeSubTool !== 'draw') return;
        this._drawIsEraser = true;
        paintDrawToolButtons(handle, true); // core/image-edit-ui.js
    },

    _drawStroke(fromPos, toPos) {
        const handle = this._activeImageModalHandle;
        drawEditStroke(handle.interactCanvas, fromPos, toPos, { // core/photo-editor-engine.js
            sizeRaw: handle.drawSizeEl.value, color: handle.drawColorEl.value, isEraser: this._drawIsEraser,
            imageWidth: handle.baseCanvas.width, imageHeight: handle.baseCanvas.height,
        });
    },

    /** Áp dụng Vẽ — nét nháp (Tẩy đã xoá bớt ngay trên lớp nháp) gộp đè lên render thành nền mới. */
    applyDrawTool() {
        const handle = this._activeImageModalHandle;
        replaceEditBaseImage(handle, mergeCanvases(handle.renderCanvas, handle.interactCanvas, 'source-over')); // core/image-edit-ui.js + core/photo-editor-engine.js
        this._activeEditParams = { ...IMAGE_EDIT_NEUTRAL_PARAMS };
        this._leaveSubTool();
    },

    // ===================== Text =====================

    /** Tile Text — khung chữ nổi giữa màn (ô nhập nhiều dòng, kéo bằng tay nắm). */
    _startTextTool() {
        const handle = this._activeImageModalHandle;
        this._enterSubTool('text', 'fileManager.photo.image.editToolText', true, 'toolGrid');
        this._textDrag = null;
        showFloatingText(handle, t('fileManager.photo.image.editTextPlaceholder')); // core/image-edit-ui.js
    },

    /** 'imageEdit.floatingText.grip.pointerDown' — giữ con trỏ trên tay nắm, nhớ độ lệch tới tâm khung.
     * @param {{pointerId: number, x: number, y: number}} p */
    startTextDrag(p) {
        const handle = this._activeImageModalHandle;
        if (!handle || this._activeSubTool !== 'text') return;
        captureEditPointer(handle.floatingTextGrip, p.pointerId); // core/image-edit-ui.js
        this._textDrag = { offset: computeFloatingTextDragOffset(measureFloatingTextCenter(handle.floatingText), p) }; // core/photo-editor-engine.js + core/image-edit-ui.js
    },

    /** 'imageEdit.floatingText.grip.pointerMove'. @param {{x:number, y:number}} p */
    updateTextDrag(p) {
        if (!this._textDrag || !this._activeImageModalHandle) return;
        placeFloatingText(this._activeImageModalHandle.floatingText, applyFloatingTextDragOffset(p, this._textDrag.offset)); // core/image-edit-ui.js + core/photo-editor-engine.js
    },

    /** 'imageEdit.floatingText.grip.pointerUp' */
    endTextDrag() {
        this._textDrag = null;
    },

    /** 'imageEdit.floatingText.input' — ô nhập cao theo số dòng. */
    fitFloatingText() {
        if (!this._activeImageModalHandle) return;
        fitFloatingTextarea(this._activeImageModalHandle.floatingTextarea); // core/image-edit-ui.js
    },

    /** Áp dụng Text — tạo layer Text tại vị trí ô nhập (rỗng thì thôi). */
    applyTextTool() {
        const draft = readFloatingText(this._activeImageModalHandle); // core/image-edit-ui.js
        TEXT_APPLY_BY_HAS_TEXT[hasLayerText(draft.text)](draft); // core/photo-editor-engine.js
        this._leaveSubTool();
    },

    /** @param {{text: string, color: string, center: {x:number,y:number}}} draft */
    _addTextLayer(draft) {
        this._layers.push(buildTextLayerFromFloating(++this._layerIdSeq, draft.text, draft.color, draft.center, this._fit())); // core/photo-editor-engine.js
        this._renderLayers();
    },

    // ===================== Shape =====================

    /** Tile Shape — popup chọn loại hình (chỉ còn nút Huỷ tới khi chọn). */
    _startShapeTool() {
        this._enterSubTool('none', 'fileManager.photo.image.editToolShape', false, 'toolGrid');
        setEditPopupVisible(this._activeImageModalHandle.shapeTypePopup, true); // core/image-edit-ui.js
    },

    /** 'imageEdit.shapeType.select.click' — tạo Shape giữa ảnh, vào kéo khung đặt vị trí/kích thước (cùng thao tác Crop).
     * @param {string} shapeType */
    selectShapeType(shapeType) {
        const handle = this._activeImageModalHandle;
        if (!handle || !IMAGE_EDIT_SHAPE_PAINT_BY_KIND[shapeType]) return;
        const { width, height } = handle.baseCanvas;
        const layer = buildNewShapeLayer(++this._layerIdSeq, shapeType, width, height); // core/photo-editor-engine.js
        this._layers.push(layer);
        this._pendingShapeId = layer.id;
        this._selectedLayerId = layer.id;
        this._renderLayers();

        setEditPopupVisible(handle.shapeTypePopup, false); // core/image-edit-ui.js
        showEditContextBar(handle, t('fileManager.photo.image.editToolShape'), true);
        this._activeSubTool = 'shapePlacement';
        this._cropSession = buildShapePlacementSession(layer, width, height); // core/photo-editor-engine.js
        this._drawCropOverlay();
    },

    /** Shape đang đặt chạy theo khung (không đặt Shape nào -> bỏ qua). */
    _syncPendingShapeRect() {
        const layer = this._findLayer(this._pendingShapeId);
        if (!layer) return;
        Object.assign(layer, getCropSessionRect(this._cropSession)); // core/media-transform.js
        this._renderLayers();
    },

    /** Áp dụng — giữ Shape ở khung cuối. */
    applyShapePlacement() {
        this._syncPendingShapeRect();
        this._pendingShapeId = null;
        this._leaveSubTool();
    },

    /** Huỷ lúc đang đặt Shape mới — bỏ Shape đó. */
    _discardPendingShape() {
        this._layers = removeImageEditLayer(this._layers, this._pendingShapeId); // core/photo-editor-engine.js
        this._pendingShapeId = null;
        this._selectedLayerId = null;
        this._renderLayers();
    },

    // ===================== Image (chèn ảnh từ thư viện) =====================

    /** Tile Image — picker ảnh thư viện mở trên modal; chọn xong thành layer rồi vào Biến đổi. */
    _openInsertImagePicker() {
        workflowFileManagerPhoto.openCoverImagePicker( // event/workflow/file-manager-photo.js
            (imageKey) => this.insertImageLayer(imageKey),
            null,
            { zIndex: Z_INDEX.IMAGE_ACTION_MENU_DRAWER, title: t('fileManager.photo.image.insertImageTitle') }, // service/z-index.js
        );
    },

    /** @param {string} imageKey */
    async insertImageLayer(imageKey) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !this._activeImageModalHandle) return; // ảnh vừa bị xoá / modal đã đóng
        const source = await this._decodeBlobToCanvas(record.blob);
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        const layer = buildImageLayer(++this._layerIdSeq, source, handle.baseCanvas.width, handle.baseCanvas.height); // core/photo-editor-engine.js
        this._layers.push(layer);
        this._renderLayers();
        this._startTransform(layer.id, 'toolGrid');
    },

    // ===================== Biến đổi layer (di chuyển / co / xoay / lật) =====================

    /** Mở Biến đổi cho 1 layer từ danh sách Layer ('imageEdit.layerPanel.transform.click') hoặc menu long-press.
     * @param {number} id @param {'layerPanel'|'none'} returnTo */
    startLayerTransform(id, returnTo) {
        if (!this._activeImageModalHandle) return;
        this._startTransform(id, returnTo);
    },

    _startTransform(id, returnTo) {
        const layer = this._findLayer(id);
        if (!layer) return;
        this._enterSubTool('transform', 'fileManager.photo.image.layerMenuTransform', true, returnTo);
        this._selectedLayerId = id;
        this._transformSnapshot = snapshotLayerTransform(layer); // core/photo-editor-engine.js
        this._transformDrag = null;
        setEditPopupVisible(this._activeImageModalHandle.transformPopup, true); // core/image-edit-ui.js
        this._drawTransformOverlay();
    },

    /** @returns {object} hình học khung biến đổi của layer đang chọn */
    _transformGeometry(layer) {
        return computeLayerTransformGeometry(this._layerFrame(layer), this._cssToCanvasPx(IMAGE_EDIT_TRANSFORM_HANDLE_GAP_CSS_PX)); // core/photo-editor-engine.js
    },

    _drawTransformOverlay() {
        const layer = this._findLayer(this._selectedLayerId);
        if (!layer) return;
        drawLayerTransformOverlay(this._activeImageModalHandle.interactCanvas, this._transformGeometry(layer), this._cssToCanvasPx(1)); // core/photo-editor-engine.js
    },

    /** Chạm canvas lúc 'transform': núm xoay / góc (co) / trong khung (di chuyển). @param {{x:number,y:number}} pos */
    transformPointerDown(pos) {
        const layer = this._findLayer(this._selectedLayerId);
        if (!layer) return;
        const geom = this._transformGeometry(layer);
        const mode = resolveLayerTransformHandle(pos, geom, this._cssToCanvasPx(IMAGE_EDIT_TRANSFORM_HIT_CSS_PX)); // core/photo-editor-engine.js
        if (!mode) return;
        this._transformDrag = { mode, startPos: pos, start: snapshotLayerTransform(layer), cx: geom.cx, cy: geom.cy };
    },

    /** @param {{x:number,y:number}} pos */
    transformPointerMove(pos) {
        const drag = this._transformDrag;
        const layer = this._findLayer(this._selectedLayerId);
        if (!drag || !layer) return;
        Object.assign(layer, IMAGE_EDIT_TRANSFORM_DRAG_BY_MODE[drag.mode](drag, pos));
        this._renderLayers();
        this._drawTransformOverlay();
    },

    transformPointerUp() {
        this._transformDrag = null;
    },

    /** 'imageEdit.transform.action.click' — lật ngang/dọc, xoay 90°, đặt lại. @param {string} action */
    applyTransformAction(action) {
        const compute = IMAGE_EDIT_TRANSFORM_ACTION_BY_KEY[action];
        const layer = this._findLayer(this._selectedLayerId);
        if (!compute || !layer || this._activeSubTool !== 'transform') return;
        Object.assign(layer, compute(layer));
        this._renderLayers();
        this._drawTransformOverlay();
    },

    /** Áp dụng Biến đổi — giữ nguyên trạng thái hiện tại. */
    applyTransform() {
        this._transformSnapshot = null;
        this._leaveSubTool();
    },

    /** Huỷ Biến đổi — trả layer về lúc mở. */
    _restoreTransformSnapshot() {
        const layer = this._findLayer(this._selectedLayerId);
        if (!layer || !this._transformSnapshot) return;
        Object.assign(layer, this._transformSnapshot);
        this._renderLayers();
    },

    // ===================== Layer — chọn / kéo / menu long-press (không mở công cụ) =====================

    /** @param {number|null} id @returns {object|null} */
    _findLayer(id) {
        return this._layers[findImageEditLayerIndex(this._layers, id)] || null; // core/photo-editor-engine.js
    },

    /** Khung biến đổi (tâm hộp bao, co/lật, góc, độ mờ) của layer. @param {object} layer @returns {object} */
    _layerFrame(layer) {
        const box = IMAGE_EDIT_LAYER_BOX_BY_TYPE[layer.type](layer, this._activeImageModalHandle.layerCanvas);
        return computeLayerFrame(layer, box); // core/photo-editor-engine.js
    },

    /** @param {{x:number,y:number}} pos @returns {number} index layer trên cùng trúng chạm, -1 = không */
    _hitTestLayers(pos) {
        const entries = this._layers.map((layer) => ({ frame: this._layerFrame(layer), visible: layer.visible !== false }));
        return findTopmostLayerAt(pos, entries); // core/photo-editor-engine.js
    },

    /** Chạm canvas lúc không mở công cụ. @param {{x:number,y:number}} pos */
    layerPointerDown(pos) {
        if (!this._activeImageModalHandle) return;
        const index = this._hitTestLayers(pos);
        LAYER_POINTER_DOWN_BY_HIT[index !== -1](index, pos);
    },

    /** Trúng layer: nhớ điểm bắt đầu, hẹn giờ long-press (kéo đủ xa thì huỷ). @param {number} index @param {{x:number,y:number}} pos */
    _beginLayerPress(index, pos) {
        const layer = this._layers[index];
        this._selectedLayerId = layer.id;
        this._layerDragMoved = false;
        this._layerDragStart = { x: pos.x, y: pos.y, layerX: layer.x, layerY: layer.y };
        taskManager.once(() => this._openLayerActionMenuAt(layer.id, pos), IMAGE_EDIT_LAYER_LONG_PRESS_MS, IMAGE_EDIT_LAYER_LONG_PRESS_TASK);
    },

    _clearLayerSelection() {
        this._selectedLayerId = null;
    },

    /** Kéo layer — vượt ngưỡng nhỏ mới tính là kéo (huỷ long-press). @param {{x:number,y:number}} pos */
    layerPointerMove(pos) {
        const layer = this._findLayer(this._selectedLayerId);
        if (!layer || !this._layerDragStart) return;
        const step = computeLayerDragStep(this._layerDragStart, pos, this._cssToCanvasPx(IMAGE_EDIT_LAYER_DRAG_THRESHOLD_CSS_PX), this._layerDragMoved); // core/photo-editor-engine.js
        if (!step.moved) return;
        taskManager.kill(IMAGE_EDIT_LAYER_LONG_PRESS_TASK);
        this._layerDragMoved = true;
        layer.x = step.x;
        layer.y = step.y;
        this._renderLayers();
    },

    layerPointerUp() {
        taskManager.kill(IMAGE_EDIT_LAYER_LONG_PRESS_TASK);
        this._layerDragStart = null;
        this._layerDragMoved = false;
    },

    /** Menu long-press neo tại điểm chạm (quy ngược pixel canvas -> client). Callback bắn eventBus.
     * @param {number} id @param {{x:number,y:number}} pos */
    _openLayerActionMenuAt(id, pos) {
        const handle = this._activeImageModalHandle;
        const layer = this._findLayer(id);
        if (!handle || !layer) return;
        const client = canvasPointToClient(handle.interactCanvas, pos); // core/image-edit-ui.js
        const anchorEl = createPointAnchorEl(client.x, client.y); // core/dropdown-menu.js
        const send = (type) => () => eventBus.send({ router: 'imageEdit', type, payload: { id } });
        const items = [
            ...IMAGE_EDIT_LAYER_MENU_ITEMS_BY_TYPE[layer.type](send),
            { icon: iconSvg('arrows-expand'), name: t('fileManager.photo.image.layerMenuTransform'), callback: send('imageEdit.layerMenu.transform.click') },
            { icon: iconSvg('duplicate'), name: t('fileManager.photo.image.layerMenuDuplicate'), callback: send('imageEdit.layerMenu.duplicate.click') },
            { icon: iconSvg('trash'), name: t('fileManager.photo.image.layerMenuDelete'), callback: send('imageEdit.layerMenu.delete.click'), destructive: true },
        ];
        openDropdownMenu(anchorEl, items, { zIndex: IMAGE_EDIT_LAYER_MENU_Z_INDEX }); // core/dropdown-menu.js
        removeImageEditAnchor(anchorEl); // core/image-edit-ui.js — menu đã đọc vị trí đồng bộ
    },

    /** Xoá layer (menu / danh sách Layer). @param {number} id */
    deleteLayer(id) {
        this._layers = removeImageEditLayer(this._layers, id); // core/photo-editor-engine.js
        this._selectedLayerId = null;
        this._renderLayers();
        this._refreshLayerPanel();
    },

    /** Nhân bản layer (lệch 20px). @param {number} id */
    duplicateLayer(id) {
        const layer = this._findLayer(id);
        if (!layer) return;
        this._layers.push(duplicateImageEditLayer(layer, ++this._layerIdSeq)); // core/photo-editor-engine.js
        this._renderLayers();
    },

    /** "Sửa kiểu" — Element Style Editor (công cụ chung) mở trên modal; kết quả về qua onApply. @param {number} id */
    openLayerStyleEditor(id) {
        const layer = this._findLayer(id);
        const style = layer ? IMAGE_EDIT_LAYER_STYLE_BY_TYPE[layer.type] : null;
        if (!style) return; // layer Image không có kiểu chữ/tô
        this._selectedLayerId = id;
        this._layerPanelOpen = false;
        workflowElementStyleEditor.open( // event/workflow/element-style-editor.js
            null,
            (cssString) => this._applyLayerStyleCssString(cssString),
            style.buildCss(layer),
            () => { workflowGenericDrawerHelpers.closeFully(); this._selectedLayerId = null; },
            { zIndex: Z_INDEX.IMAGE_ACTION_MENU_DRAWER, startTab: style.startTab }, // service/z-index.js
        );
    },

    /** onApply của Element Style Editor — ghi trường tương ứng lên layer, nạp Google Font nếu có. @param {string} cssString */
    _applyLayerStyleCssString(cssString) {
        const layer = this._findLayer(this._selectedLayerId);
        const style = layer ? IMAGE_EDIT_LAYER_STYLE_BY_TYPE[layer.type] : null;
        if (!style) return;
        Object.assign(layer, style.computePatch(parseElementStyleCssString(cssString), layer)); // core/element-style-editor.js + core/photo-editor-engine.js
        this._renderLayers();
        this._ensureLayerFonts();
    },

    /**
     * Google Font của layer Text: nạp `<link>` (nếu chưa) rồi chờ font thật sự sẵn sàng mới vẽ lại — canvas không tự vẽ
     * lại khi font về như chữ DOM (trước đây chọn Google Font cho chữ trên ảnh không có tác dụng vì lý do này).
     */
    _ensureLayerFonts() {
        const fonts = listTextLayerGoogleFonts(this._layers); // core/photo-editor-engine.js
        if (!fonts.length) return;
        const loaded = appState.get('eseLoadedGoogleFonts');
        fonts.forEach((font) => loadGoogleFont(font.family, font.weight, loaded)); // core/element-style-editor.js
        taskManager.kill(IMAGE_EDIT_FONT_WAIT_TASK);
        taskManager.addNew(IMAGE_EDIT_FONT_WAIT_TASK, { time: IMAGE_EDIT_FONT_WAIT_INTERVAL_MS, exe: () => this._checkLayerFonts(fonts), mode: 'timeout', count: IMAGE_EDIT_FONT_WAIT_TRIES });
        taskManager.operator(IMAGE_EDIT_FONT_WAIT_TASK, 'enabled');
    },

    /** 1 nhịp chờ font: đủ cả -> thôi chờ + vẽ lại. @param {Array<{spec: string}>} fonts */
    async _checkLayerFonts(fonts) {
        const counts = await Promise.all(fonts.map((font) => loadCanvasFontFaceCount(font.spec))); // core/photo-editor-engine.js
        if (!areCanvasFontsReady(counts)) return;
        taskManager.kill(IMAGE_EDIT_FONT_WAIT_TASK);
        this._renderLayers();
    },

    /** "Sửa nội dung" (layer Text) — modalChoice + textarea; đọc `.value` lúc bấm Lưu rồi gửi eventBus. @param {number} id */
    editLayerTextContent(id) {
        const layer = this._findLayer(id);
        if (!layer) return;
        modalChoice( // core/modal-choice-ui.js
            t('fileManager.photo.image.layerEditContentTitle'),
            [{
                label: t('common.save'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent',
                onClick: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.layerContent.save.click', payload: { id, value: textareaEl.value } }),
            }],
            { bodyHtml: renderLayerEditContentModalBody(layer.text) }, // components/image-edit-modals.js
        );
        const textareaEl = document.getElementById('modal-choice-body').querySelector('#layer-edit-content-textarea');
    },

    /** 'imageEdit.layerContent.save.click' — rỗng giữ chữ cũ. @param {number} id @param {string} value */
    saveLayerTextContent(id, value) {
        const layer = this._findLayer(id);
        if (!layer) return;
        layer.text = resolveLayerTextContent(value, layer.text); // core/photo-editor-engine.js
        this._renderLayers();
        this._refreshLayerPanel();
    },

    /** Vẽ lại toàn bộ layer (ẩn thì bỏ qua) lên lớp layer — mỗi layer trong khung biến đổi riêng. */
    _renderLayers() {
        const handle = this._activeImageModalHandle;
        if (!handle) return;
        clearCanvas(handle.layerCanvas); // core/photo-editor-engine.js
        this._layers.forEach((layer) => this._paintLayer(handle.layerCanvas, layer));
    },

    _paintLayer(canvas, layer) {
        if (layer.visible === false) return;
        const frame = this._layerFrame(layer);
        beginLayerPaint(canvas, frame); // core/photo-editor-engine.js
        IMAGE_EDIT_LAYER_PAINT_BY_TYPE[layer.type](canvas, layer);
        endLayerPaint(canvas);
    },

    // ===================== Danh sách Layer (Generic Drawer) =====================

    /** Icon Layer trên header — danh sách layer (trên cùng đứng đầu). Block gate chặn khi đang có Drawer khác (event/block.js). */
    async openLayerPanel() {
        const ready = await this.ensureEditSessionReady();
        if (!ready || !this._activeImageModalHandle) return;
        this._layerPanelOpen = true;
        workflowGenericDrawerHelpers.open(this._layerPanelConfig());
    },

    /** @returns {object} config Generic Drawer của danh sách Layer */
    _layerPanelConfig() {
        const labels = {
            image: t('fileManager.photo.image.layerKindImage'),
            shape: {
                rect: t('fileManager.photo.image.layerKindRect'), circle: t('fileManager.photo.image.layerKindCircle'),
                line: t('fileManager.photo.image.layerKindLine'), arrow: t('fileManager.photo.image.layerKindArrow'),
                polygon: t('fileManager.photo.image.layerKindPolygon'),
            },
        };
        const rows = computeImageEditLayerRows(this._layers, labels); // core/photo-editor-engine.js
        return buildImageEditDrawerConfig(renderImageEditLayerPanelHeaderHtml(), renderImageEditLayerPanelHtml(rows), 'imageEdit:layers'); // core/file-manager/photo-ui.js + components/image-edit-drawers.js
    },

    /** Vẽ lại danh sách tại chỗ (giữ vị trí cuộn) — chỉ khi danh sách đang hiện. */
    _refreshLayerPanel() {
        if (!this._layerPanelOpen || !appState.get('isGenericDrawerOpen')) return;
        workflowGenericDrawerHelpers.update(this._layerPanelConfig());
    },

    /** 'imageEdit.layerPanel.close.click' */
    closeLayerPanel() {
        this._layerPanelOpen = false;
        this._panelDrag = null;
        workflowGenericDrawerHelpers.closeFully();
    },

    /** 'imageEdit.layerPanel.visible.click'. @param {number} id */
    toggleLayerVisible(id) {
        const layer = this._findLayer(id);
        if (!layer) return;
        Object.assign(layer, computeLayerVisibleToggle(layer)); // core/photo-editor-engine.js
        this._renderLayers();
        this._refreshLayerPanel();
    },

    /** 'imageEdit.layerPanel.opacity.input' — kéo slider: vẽ lại ảnh + nhãn %, không vẽ lại danh sách.
     * @param {number} id @param {string} value - 0..100 */
    setLayerOpacity(id, value) {
        const layer = this._findLayer(id);
        if (!layer) return;
        layer.opacity = computeLayerOpacity(value); // core/photo-editor-engine.js
        this._renderLayers();
        setLayerOpacityLabel(genericDrawerBody, id, value); // core/image-edit-ui.js
    },

    /** 'imageEdit.layerPanel.drag.start' — nhấc dòng, giữ con trỏ trên tay nắm.
     * @param {{id: number, pointerId: number, clientY: number, handleEl: Element, rowEl: HTMLElement}} p */
    startLayerPanelDrag(p) {
        if (!this._layerPanelOpen || !p.rowEl) return;
        captureEditPointer(p.handleEl, p.pointerId); // core/image-edit-ui.js
        const { rowEls, rects } = readLayerPanelRows(genericDrawerBody);
        this._panelDrag = { id: p.id, rowEl: p.rowEl, rowEls, rects, startY: p.clientY, targetIndex: -1 };
        liftLayerPanelRow(p.rowEl, p.clientY, p.clientY);
    },

    /** 'imageEdit.layerPanel.drag.move' — dòng bám ngón tay, tô dòng đích. @param {number} clientY */
    moveLayerPanelDrag(clientY) {
        const drag = this._panelDrag;
        if (!drag) return;
        liftLayerPanelRow(drag.rowEl, drag.startY, clientY); // core/image-edit-ui.js
        drag.targetIndex = findLayerDropDisplayIndex(drag.rects, clientY); // core/photo-editor-engine.js
        markLayerPanelDropTarget(drag.rowEls, drag.targetIndex);
    },

    /** 'imageEdit.layerPanel.drag.end' — thả: đổi thứ tự layer, vẽ lại ảnh + danh sách. */
    endLayerPanelDrag() {
        const drag = this._panelDrag;
        if (!drag) return;
        this._panelDrag = null;
        settleLayerPanelRow(drag.rowEl); // core/image-edit-ui.js
        markLayerPanelDropTarget(drag.rowEls, -1);
        this._layers = moveImageEditLayer(this._layers, drag.id, drag.targetIndex); // core/photo-editor-engine.js
        this._renderLayers();
        this._refreshLayerPanel();
    },

    // ===================== Lưu =====================

    /** Ảnh cuối = render + lớp layer, xuất JPEG. @returns {Promise<Blob>} */
    async _exportEditedBlob() {
        const handle = this._activeImageModalHandle;
        const blob = await exportCanvasJpegBlob(flattenEditCanvases(handle.renderCanvas, handle.layerCanvas), IMAGE_EDIT_EXPORT_JPEG_QUALITY); // core/photo-editor-engine.js
        if (!blob) throw new Error('[_exportEditedBlob] canvas.toBlob trả về null');
        return blob;
    },

    /** "Ghi đè" — ghi lại đúng key đang mở (kèm thumbnail, kích thước, duration tính lại). Quá cỡ (core/upload-validation.js)
     * -> báo sau khi tắt shield, giữ modal mở. */
    async saveEditOverwrite() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return;
        const imageKey = this._activeImageKey;

        let tooLargeReason = null; // báo SAU khi shield tắt
        await withLoadingShield(t('common.loading.savingImageEdit'), async () => {
            const finalBlob = await this._exportEditedBlob();
            const sizeCheck = validateMediaFileSize(finalBlob); // core/upload-validation.js
            if (!sizeCheck.valid) { tooLargeReason = sizeCheck.reason; return; }
            const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(finalBlob);
            const duration = await workflowPhotoDuration.compute(finalBlob, width, height); // event/workflow/photo-duration.js
            await updateImageBlob(imageKey, finalBlob, thumbBlob, width, height, duration); // core/file-manager/image.js
            // Ảnh này đang hiện/làm nền thì tự nạp lại.
            eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'photo', key: imageKey } });
        });
        if (tooLargeReason) { await alertModal(tFormat('common.validate.generatedNotSaved', { reason: tooLargeReason })); return; }
        workflowFileManagerPhoto.closeImagePreview();
        await alertModal(t('fileManager.photo.image.editSaveOverwriteSuccess'));
    },

    /** "Lưu mới" — ảnh mới tên khác (buildEditedImageFilename()), cùng cách tính/chặn dung lượng như Ghi đè. */
    async saveEditAsNew() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return;

        let tooLargeReason = null;
        await withLoadingShield(t('common.loading.savingImageEdit'), async () => {
            const originalRecord = await getMediaMeta('photo', this._activeImageKey); // service/db.js — chỉ cần filename
            const finalBlob = await this._exportEditedBlob();
            const sizeCheck = validateMediaFileSize(finalBlob);
            if (!sizeCheck.valid) { tooLargeReason = sizeCheck.reason; return; }
            const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(finalBlob);
            const duration = await workflowPhotoDuration.compute(finalBlob, width, height);
            const newFilename = buildEditedImageFilename(originalRecord ? originalRecord.filename : 'photo.jpg', Date.now()); // core/file-manager/image.js
            const newKey = await resolveImageKey(newFilename); // service/db.js
            await saveImage(newKey, finalBlob, newFilename, thumbBlob, width, height, duration); // core/file-manager/image.js
        });
        if (tooLargeReason) { await alertModal(tFormat('common.validate.generatedNotSaved', { reason: tooLargeReason })); return; }
        workflowFileManagerPhoto.closeImagePreview();
        await alertModal(t('fileManager.photo.image.editSaveNewSuccess'));
    },

    /** Dọn toàn bộ phiên sửa — chỉ gọi từ workflowFileManagerPhoto.closeImagePreview() (đóng hẳn modal). DOM modal do
     * photo-ui tự gỡ. Thoát được cả lúc đang dở 1 công cụ. */
    exitEditMode() {
        if (!this._activeEditParams) return;
        taskManager.kill(IMAGE_EDIT_LAYER_LONG_PRESS_TASK);
        taskManager.kill(IMAGE_EDIT_FONT_WAIT_TASK);
        taskManager.kill(IMAGE_EDIT_ADJUST_PREVIEW_TASK);
        if (appState.get('isGenericDrawerOpen')) workflowGenericDrawerHelpers.closeFully();
        this._activeEditParams = null;
        this._activeAdjustParam = null;
        this._activeSubTool = 'none';
        this._subToolReturn = 'toolGrid';
        this._activeImageModalHandle = null;
        this._activeImageKey = null;
        this._cropSession = null;
        this._drawSessionActive = false;
        this._textDrag = null;
        this._layers = [];
        this._selectedLayerId = null;
        this._pendingShapeId = null;
        this._layerDragStart = null;
        this._layerDragMoved = false;
        this._transformDrag = null;
        this._transformSnapshot = null;
        this._layerPanelOpen = false;
        this._panelDrag = null;
    },
};
