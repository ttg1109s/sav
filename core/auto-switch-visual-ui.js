/**
 * core/auto-switch-visual-ui.js — thao tác DOM của phiên kéo thả danh sách item Auto-Switch (sub panel "Effect list",
 * components/settings/visualizer-auto-switch-drawer.js): hàng nổi lên + đổ bóng + bám con trỏ, hàng đích viền xanh.
 * Luồng: event/listener/auto-switch-visual.js -> router 'autoSwitchVisual' -> workflowAutoSwitchVisual (giữ phiên kéo)
 * -> các hàm dưới đây. Mỗi hàm 1 việc, không đọc appState, không gọi core khác.
 */

/** Nhấc hàng lên: bắt con trỏ trên tay cầm (pointermove/pointerup sau đó về đúng tay cầm, nổi bọt lên listener ủy
 * quyền — không gắn listener lên `document`), nổi hàng lên trên + chặn bôi đen chữ toàn trang khi kéo.
 * @param {HTMLElement} rowEl @param {HTMLElement} handleEl @param {number} pointerId */
function liftAutoSwitchDragRow(rowEl, handleEl, pointerId) {
    handleEl.setPointerCapture(pointerId);
    Object.assign(rowEl.style, { position: 'relative', zIndex: '30', boxShadow: '0 10px 24px rgba(0,0,0,0.25)', userSelect: 'none' });
    document.body.style.userSelect = 'none';
}

/** Hàng đang kéo bám theo con trỏ. @param {HTMLElement} rowEl @param {string} transform */
function setAutoSwitchDragRowTransform(rowEl, transform) {
    rowEl.style.transform = transform;
}

/** Bật/tắt viền "đích thả" của 1 hàng (null -> bỏ qua). @param {HTMLElement|null} rowEl @param {boolean} isTarget */
function setAutoSwitchDropTargetOutline(rowEl, isTarget) {
    if (!rowEl) return;
    rowEl.style.outline = isTarget ? '2px solid rgba(56,189,248,0.7)' : '';
}

/** Thả hàng: trả style về như cũ + bỏ chặn bôi đen chữ. @param {HTMLElement} rowEl */
function dropAutoSwitchDragRow(rowEl) {
    Object.assign(rowEl.style, { position: '', zIndex: '', boxShadow: '', transform: '', userSelect: '' });
    document.body.style.userSelect = '';
}
