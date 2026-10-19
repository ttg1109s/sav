/**
 * core/image-edit-ui.js — Core-UI trình sửa ảnh Photo: ghi DOM/canvas của modal xem ảnh (handle của
 * core/file-manager/photo-ui.js::openImagePreviewModal()) và danh sách Layer trong Generic Drawer — nhận phần tử qua
 * tham số, không quyết định nghiệp vụ. Điều phối: event/workflow/image-edit.js.
 *
 * NẠP SAU: không phụ thuộc gì lúc nạp.
 */

/** Hình học object-fit thật của canvas Edit: CSS px trên mỗi pixel canvas + độ lệch vùng ảnh trong hộp CSS ('contain'
 * chừa viền, 'cover' tràn ra ngoài). @param {HTMLCanvasElement} canvas
 * @returns {{rect: DOMRect, displayScale: number, offsetX: number, offsetY: number}} */
function measureEditCanvasFit(canvas) {
    const rect = canvas.getBoundingClientRect();
    const cw = canvas.width, ch = canvas.height;
    if (!cw || !ch || !rect.width || !rect.height) return { rect, displayScale: 1, offsetX: 0, offsetY: 0 }; // chưa layout/decode xong
    const fitMode = canvas.style.objectFit || 'cover';
    const displayScale = fitMode === 'contain' ? Math.min(rect.width / cw, rect.height / ch) : Math.max(rect.width / cw, rect.height / ch);
    return { rect, displayScale, offsetX: (rect.width - cw * displayScale) / 2, offsetY: (rect.height - ch * displayScale) / 2 };
}

/** Pixel canvas -> toạ độ client (nghịch đảo phép quy đổi chạm). @param {HTMLCanvasElement} canvas @param {{x:number,y:number}} pos
 * @returns {{x:number, y:number}} */
function canvasPointToClient(canvas, pos) {
    const rect = canvas.getBoundingClientRect();
    const cw = canvas.width || 1, ch = canvas.height || 1;
    const fitMode = canvas.style.objectFit || 'cover';
    const scale = fitMode === 'contain' ? Math.min(rect.width / cw, rect.height / ch) : Math.max(rect.width / cw, rect.height / ch);
    return { x: rect.left + (rect.width - cw * scale) / 2 + pos.x * scale, y: rect.top + (rect.height - ch * scale) / 2 + pos.y * scale };
}

/** Nạp ảnh nguồn làm nền mới: 4 canvas đổi cỡ theo nguồn (đổi cỡ = xoá trắng), base + render vẽ nguồn.
 * @param {object} handle @param {HTMLCanvasElement} source */
function loadEditCanvases(handle, source) {
    [handle.baseCanvas, handle.renderCanvas, handle.layerCanvas, handle.interactCanvas].forEach((c) => {
        c.width = source.width; c.height = source.height;
    });
    handle.baseCanvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0); // Điều chỉnh đọc lại pixel base mỗi lần kéo slider
    handle.renderCanvas.getContext('2d').drawImage(source, 0, 0);
}

/** Thay pixel nền (cùng cỡ) — Áp dụng Vẽ. Layer/tương tác giữ nguyên. @param {object} handle @param {HTMLCanvasElement} source */
function replaceEditBaseImage(handle, source) {
    [handle.baseCanvas, handle.renderCanvas].forEach((c) => {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(source, 0, 0);
    });
}

/** @param {object} handle @param {ImageData} imageData - kết quả Điều chỉnh */
function putEditRenderImageData(handle, imageData) {
    handle.renderCanvas.getContext('2d').putImageData(imageData, 0, 0);
}

/** Hiện popup slider Điều chỉnh. @param {object} handle @param {{label: string, min: number, max: number, value: number}} view */
function showAdjustPopup(handle, view) {
    handle.adjustLabelEl.textContent = view.label;
    handle.adjustSliderEl.min = String(view.min);
    handle.adjustSliderEl.max = String(view.max);
    handle.adjustSliderEl.value = String(view.value);
    handle.adjustValueEl.textContent = String(view.value);
    handle.adjustPopup.classList.remove('hidden');
}

/** @param {object} handle @param {number} value */
function setAdjustValueLabel(handle, value) {
    handle.adjustValueEl.textContent = String(value);
}

/** @param {object} handle */
function hideAdjustPopup(handle) {
    handle.adjustPopup.classList.add('hidden');
}

/** Vào 1 công cụ có thanh Huỷ/Áp dụng: ẩn header, hiện thanh với tiêu đề; `showApply` false = chỉ còn nút Huỷ.
 * @param {object} handle @param {string} title @param {boolean} showApply */
function showEditContextBar(handle, title, showApply) {
    handle.header.classList.add('hidden');
    handle.contextBar.classList.remove('hidden');
    handle.contextApplyBtn.classList.toggle('hidden', !showApply);
    handle.contextTitleEl.textContent = title;
}

/** Hiện/ẩn 1 popup công cụ (tỉ lệ Crop, Vẽ, loại Shape, Biến đổi). @param {HTMLElement} popupEl @param {boolean} visible */
function setEditPopupVisible(popupEl, visible) {
    popupEl.classList.toggle('hidden', !visible);
}

/** Thoát công cụ về mặt xem: xoá lớp tương tác, ẩn thanh Huỷ/Áp dụng + khung chữ nổi + mọi popup, hiện header.
 * @param {object} handle */
function resetEditChrome(handle) {
    const ctx = handle.interactCanvas.getContext('2d');
    ctx.clearRect(0, 0, handle.interactCanvas.width, handle.interactCanvas.height);
    handle.contextBar.classList.add('hidden');
    handle.contextApplyBtn.classList.remove('hidden');
    handle.header.classList.remove('hidden');
    handle.floatingText.classList.add('hidden');
    [handle.drawControlsPopup, handle.cropRatioPopup, handle.shapeTypePopup, handle.transformPopup].forEach((el) => el.classList.add('hidden'));
}

/** Tô nút Cọ/Tẩy đang chọn. @param {object} handle @param {boolean} isEraser */
function paintDrawToolButtons(handle, isEraser) {
    handle.drawBrushBtn.classList.toggle('text-sky-400', !isEraser);
    handle.drawBrushBtn.classList.toggle('text-white/60', isEraser);
    handle.drawEraserBtn.classList.toggle('text-sky-400', isEraser);
    handle.drawEraserBtn.classList.toggle('text-white/60', !isEraser);
}

/** Mở khung chữ nổi giữa màn, ô nhập chứa sẵn chữ gợi ý đã chọn hết (gõ là thay). @param {object} handle @param {string} placeholder */
function showFloatingText(handle, placeholder) {
    const el = handle.floatingText;
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    handle.floatingTextarea.style.color = '#ffffff';
    handle.floatingTextarea.value = placeholder;
    el.classList.remove('hidden');
    handle.floatingTextarea.style.height = 'auto';
    handle.floatingTextarea.style.height = `${handle.floatingTextarea.scrollHeight}px`;
    handle.floatingTextarea.focus();
    handle.floatingTextarea.select();
}

/** Đặt TÂM khung chữ nổi tại toạ độ client. @param {HTMLElement} floatingEl @param {{x:number,y:number}} center */
function placeFloatingText(floatingEl, center) {
    floatingEl.style.left = `${center.x}px`;
    floatingEl.style.top = `${center.y}px`;
    floatingEl.style.transform = 'translate(-50%, -50%)';
}

/** Ô nhập chữ cao theo số dòng. @param {HTMLTextAreaElement} textareaEl */
function fitFloatingTextarea(textareaEl) {
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
}

/** Nội dung + màu + tâm (client) của ô nhập chữ nổi. @param {object} handle
 * @returns {{text: string, color: string, center: {x:number, y:number}}} */
function readFloatingText(handle) {
    const box = handle.floatingTextarea.getBoundingClientRect();
    return {
        text: handle.floatingTextarea.value,
        color: handle.floatingTextarea.style.color || '#ffffff',
        center: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
    };
}

/** Tâm khung chữ nổi (client). @param {HTMLElement} floatingEl @returns {{x:number, y:number}} */
function measureFloatingTextCenter(floatingEl) {
    const box = floatingEl.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Giữ con trỏ trên phần tử đang kéo (move/up sau đó tới đúng phần tử dù ngón tay trượt ra ngoài).
 * @param {Element} el @param {number} pointerId */
function captureEditPointer(el, pointerId) {
    try { el.setPointerCapture(pointerId); } catch (e) { /* con trỏ đã nhả */ }
}

/** Gỡ neo tạm của dropdown (createPointAnchorEl()) sau khi menu đã đọc vị trí. @param {HTMLElement} el */
function removeImageEditAnchor(el) {
    el.remove();
}

// ===================== Danh sách Layer (Generic Drawer) =====================

/** Các dòng layer đang hiện + khung của chúng (thứ tự hiển thị). @param {HTMLElement} bodyEl
 * @returns {{rowEls: HTMLElement[], rects: Array<{top:number, bottom:number}>}} */
function readLayerPanelRows(bodyEl) {
    const rowEls = Array.from(bodyEl.querySelectorAll('[data-image-layer-row]'));
    return { rowEls, rects: rowEls.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }) };
}

/** Dòng đang kéo bám theo ngón tay. @param {HTMLElement} rowEl @param {number} startY @param {number} clientY */
function liftLayerPanelRow(rowEl, startY, clientY) {
    rowEl.style.transform = `translateY(${clientY - startY}px) scale(1.02)`;
    rowEl.style.zIndex = '2';
    rowEl.style.position = 'relative';
    rowEl.classList.add('shadow-lg');
}

/** Trả dòng về chỗ. @param {HTMLElement} rowEl */
function settleLayerPanelRow(rowEl) {
    rowEl.style.transform = '';
    rowEl.style.zIndex = '';
    rowEl.style.position = '';
    rowEl.classList.remove('shadow-lg');
}

/** Tô dòng đích thả (−1 = không dòng nào). @param {HTMLElement[]} rowEls @param {number} index */
function markLayerPanelDropTarget(rowEls, index) {
    rowEls.forEach((el, i) => el.classList.toggle('ring-2', i === index));
}

/** Nhãn % độ mờ của 1 dòng. @param {HTMLElement} bodyEl @param {number} id @param {number} pct */
function setLayerOpacityLabel(bodyEl, id, pct) {
    const labelEl = bodyEl.querySelector(`[data-image-layer-opacity-label="${id}"]`);
    if (labelEl) labelEl.textContent = `${pct}%`;
}
