/**
 * core/file-manager/photo-ui.js — DOM modal xem/sửa ảnh full-screen (markup: components/image-preview-modal.js) và
 * config + wiring lưới công cụ Edit trong Generic Drawer. Xem/zoom/pan/sửa dùng chung 1 mặt: Panzoom gắn trên
 * `mediaWrap`, canvas vẽ đè lên `<img>` xem tạm khi decode xong (event/workflow/image-edit.js).
 *
 * NẠP SAU: service/z-index.js (Z_INDEX). Lúc chạy: instantiateComponent() (service/component-dynamic.js), genericDrawerHeader/
 * genericDrawerBody (core/dom-refs.js).
 */

/** Áp `object-fit` cho 4 canvas Edit (cùng kích thước thật, xếp chồng khít). Gọi lại mỗi khi kích thước thật đổi
 * (decode xong, Áp dụng Crop). @param {object} handle - kết quả openImagePreviewModal()
 * @param {'cover'|'contain'|null} fitMode - computeCoverOrContain() (core/file-manager/image.js); null = chưa có kích thước */
function syncEditCanvasDisplaySize(handle, fitMode) {
    if (!fitMode) return;
    [handle.baseCanvas, handle.renderCanvas, handle.layerCanvas, handle.interactCanvas].forEach((c) => {
        c.style.objectFit = fitMode;
    });
}

/** Kích thước gốc của ảnh xem tạm (sau khi decode). @param {HTMLImageElement} imgEl @returns {{width: number, height: number}} */
function measureImageNaturalSize(imgEl) {
    return { width: imgEl.naturalWidth, height: imgEl.naturalHeight };
}

/** @param {HTMLImageElement} imgEl @param {'cover'|'contain'|null} fitMode */
function setImagePreviewImgFit(imgEl, fitMode) {
    if (!fitMode) return;
    imgEl.style.objectFit = fitMode;
}

/**
 * Dựng modal xem ảnh, gắn vào <body>. Callback chỉ `eventBus.send()` (Rule 5a); pointer trên interactCanvas gửi toạ độ
 * đã quy về hệ pixel canvas.
 * @param {string} html - renderImagePreviewModalHtml() @param {string} url - object URL ảnh gốc (Workflow tạo/thu hồi)
 * @param {string} filename
 * @returns {object} handle: các phần tử Workflow cần (canvas, popup, header…) + `close()`
 */
function openImagePreviewModal(html, url, filename) {
    const stale = document.getElementById('image-preview-overlay');
    if (stale) stale.remove();

    const fragment = instantiateComponent(html, { // service/component-dynamic.js
        src: { selector: '.photo-preview-image', prop: 'src', value: url },
        alt: { selector: '.photo-preview-image', prop: 'alt', value: filename },
    });
    const overlay = fragment.firstElementChild;
    overlay.style.zIndex = String(Z_INDEX.IMAGE_PREVIEW);
    const q = (selector) => overlay.querySelector(selector);
    const handle = {
        close: () => overlay.remove(),
        imgEl: q('.photo-preview-image'),
        mediaWrap: q('#image-preview-media-wrap'),
        canvasWrap: q('#image-edit-canvas-wrap'),
        baseCanvas: q('#image-edit-base-canvas'),
        renderCanvas: q('#image-edit-render-canvas'),
        layerCanvas: q('#image-edit-layer-canvas'),
        interactCanvas: q('#image-edit-interact-canvas'),
        toolsBtn: q('[data-image-preview-tools]'),
        header: q('[data-image-preview-header]'),
        adjustPopup: q('#image-edit-adjust-popup'),
        adjustLabelEl: q('#image-edit-adjust-label'),
        adjustValueEl: q('#image-edit-adjust-value'),
        adjustSliderEl: q('#image-edit-adjust-slider'),
        adjustDoneBtn: q('#image-edit-adjust-done'),
        contextBar: q('#image-edit-context-bar'),
        contextCancelBtn: q('#image-edit-context-cancel'),
        contextTitleEl: q('#image-edit-context-title'),
        contextApplyBtn: q('#image-edit-context-apply'),
        cropRatioPopup: q('#image-edit-crop-ratio-popup'),
        shapeTypePopup: q('#image-edit-shape-type-popup'),
        floatingText: q('#image-edit-floating-text'),
        drawControlsPopup: q('#image-edit-draw-popup'),
        drawBrushBtn: q('#image-edit-draw-brush'),
        drawEraserBtn: q('#image-edit-draw-eraser'),
        drawColorEl: q('#image-edit-draw-color'),
        drawSizeEl: q('#image-edit-draw-size'),
    };
    const closeBtn = q('[data-image-preview-close]');
    const saveBtn = q('[data-image-preview-save]');
    const { interactCanvas } = handle;
    document.body.appendChild(overlay);

    // Toạ độ chạm -> pixel canvas. `object-fit` làm vùng ảnh thật lệch khỏi hộp CSS của canvas: 'contain' thu nhỏ chừa
    // viền, 'cover' phóng tràn rồi cắt — tính tỉ lệ hiển thị thật + độ lệch tâm rồi mới quy đổi.
    const computeInteractPos = (clientX, clientY) => {
        const rect = interactCanvas.getBoundingClientRect();
        const cw = interactCanvas.width, ch = interactCanvas.height;
        if (!cw || !ch || !rect.width || !rect.height) return { x: clientX - rect.left, y: clientY - rect.top }; // canvas chưa layout/decode xong
        const fitMode = interactCanvas.style.objectFit || 'cover';
        const displayScale = fitMode === 'contain'
            ? Math.min(rect.width / cw, rect.height / ch)
            : Math.max(rect.width / cw, rect.height / ch);
        const offsetX = (rect.width - cw * displayScale) / 2, offsetY = (rect.height - ch * displayScale) / 2;
        return { x: (clientX - rect.left - offsetX) / displayScale, y: (clientY - rect.top - offsetY) / displayScale };
    };

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    // Nút công cụ mang msg.type cố định; Router imageEdit tự chọn hàm theo công cụ đang mở.
    closeBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.close.click', payload: {} }));
    saveBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.save.click', payload: { anchorEl: saveBtn } }));
    handle.toolsBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.tools.click', payload: {} }));
    handle.contextCancelBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.subTool.cancel.click', payload: {} }));
    handle.contextApplyBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.subTool.apply.click', payload: {} }));
    handle.adjustDoneBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.adjust.done.click', payload: {} }));
    handle.drawBrushBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.draw.selectBrush.click', payload: {} }));
    handle.drawEraserBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.draw.selectEraser.click', payload: {} }));
    handle.cropRatioPopup.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-crop-ratio]');
        if (!btn) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.crop.setRatio.click', payload: { ratio: btn.dataset.cropRatio } });
    });
    handle.shapeTypePopup.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-shape-type]');
        if (!btn) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.shapeType.select.click', payload: { shapeType: btn.dataset.shapeType } });
    });
    interactCanvas.addEventListener('pointerdown', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerDown', payload: computeInteractPos(e.clientX, e.clientY) }));
    interactCanvas.addEventListener('pointermove', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerMove', payload: computeInteractPos(e.clientX, e.clientY) }));
    interactCanvas.addEventListener('pointerup', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerUp', payload: {} }));
    interactCanvas.addEventListener('pointerleave', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerUp', payload: {} })); // trượt ra ngoài lúc đang kéo = nhả tay
    // Kéo tiếp (pointermove/up trên document) gắn 1 lần ở event/listener/image-edit.js.
    handle.floatingText.addEventListener('pointerdown', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.floatingText.pointerDown', payload: {} }));
    handle.adjustSliderEl.addEventListener('input', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.adjust.slider.input', payload: { value: parseInt(e.target.value, 10) } }));

    return handle;
}

// ===================== Lưới công cụ Edit (Generic Drawer) =====================

/** Workflow (event/workflow/image-edit.js::openEditToolGrid()) mở qua `workflowGenericDrawerHelpers.open()` rồi gọi
 * `wirePhotoEditToolGridDrawerUi()`. @param {string} headerHtml - buildDrawerHeaderHtml() (components/generic-drawer.js)
 * @param {string} bodyHtml @returns {object} config Generic Drawer lưới tool Edit mode */
function buildPhotoEditToolGridDrawerConfig(headerHtml, bodyHtml) {
    return {
        height: 'auto', maxHeight: '70vh',
        zIndex: Z_INDEX.IMAGE_ACTION_MENU_DRAWER, // service/z-index.js (131) — TRÊN modal xem ảnh (130)
        headerHtml,
        bodyHtml,
        bodyClass: 'overflow-y-auto',
    };
}

/** Wire nút X + click tile lưới tool (`[data-edit-tool]`, delegated trên các con TRỰC TIẾP của body — DOM động, tự mất
 * khi nội dung bị thay, không cần hàm gỡ). Callback CHỈ bắn eventBus (Rule 5a). Gọi NGAY SAU khi gắn nội dung. */
function wirePhotoEditToolGridDrawerUi() {
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    const contentRoots = Array.from(genericDrawerBody.children);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.toolGrid.close.click', payload: {} }));
    contentRoots.forEach((root) => root.addEventListener('click', (e) => {
        const tile = e.target.closest('[data-edit-tool]');
        if (!tile) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.toolGrid.tile.click', payload: { tool: tile.dataset.editTool } });
    }));
}

