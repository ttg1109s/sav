/**
 * event/listener/image-edit.js — Listener cụm "imageEdit": danh sách Layer của trình sửa ảnh trong Generic Drawer. Ủy
 * quyền 1 lần trên `genericDrawerBody`/`genericDrawerHeader` (khuôn event/listener/motion-presets.js): mỗi loại sự kiện
 * 1 bảng tuyến `match(target)` -> phần tử khớp, `send(el, e)` -> [msg.type, payload]; nội dung Drawer khác không khớp
 * tuyến nào -> bỏ qua. Phần tử mang `data-image-layer-*` (components/image-edit-drawers.js), nút X `data-image-layers-close`.
 *
 * Kéo-thả sắp xếp: pointerdown trên tay nắm -> 'drag.start' (Workflow giữ con trỏ trên tay nắm), nên pointermove/up sau
 * đó tới đúng tay nắm và nổi bọt lên đây.
 *
 * Các nút/canvas của chính modal ảnh (DOM tạo mỗi lần mở) wire ở core/file-manager/photo-ui.js::openImagePreviewModal().
 *
 * NẠP SAU: event/bus.js, core/dom-refs.js (genericDrawerBody/Header), event/router/image-edit.js.
 */

function _ieClosest(target, selector) {
    return target.closest ? target.closest(selector) : null;
}

const IMAGE_EDIT_LAYER_CLICK_ROUTES = [
    { match: (t) => _ieClosest(t, '[data-image-layer-visible]'), send: (el) => ['imageEdit.layerPanel.visible.click', { id: Number(el.dataset.imageLayerVisible) }] },
    { match: (t) => _ieClosest(t, '[data-image-layer-transform]'), send: (el) => ['imageEdit.layerPanel.transform.click', { id: Number(el.dataset.imageLayerTransform) }] },
    { match: (t) => _ieClosest(t, '[data-image-layer-delete]'), send: (el) => ['imageEdit.layerPanel.delete.click', { id: Number(el.dataset.imageLayerDelete) }] },
];
const IMAGE_EDIT_LAYER_INPUT_ROUTES = [
    { match: (t) => _ieClosest(t, '[data-image-layer-opacity]'), send: (el) => ['imageEdit.layerPanel.opacity.input', { id: Number(el.dataset.imageLayerOpacity), value: el.value }] },
];
const IMAGE_EDIT_LAYER_POINTERDOWN_ROUTES = [
    { match: (t) => _ieClosest(t, '[data-image-layer-drag]'), send: (el, e) => { e.preventDefault(); return ['imageEdit.layerPanel.drag.start', { id: Number(el.dataset.imageLayerDrag), pointerId: e.pointerId, clientY: e.clientY, handleEl: el, rowEl: el.closest('[data-image-layer-row]') }]; } },
];
const IMAGE_EDIT_LAYER_POINTERMOVE_ROUTES = [
    { match: (t) => _ieClosest(t, '[data-image-layer-drag]'), send: (el, e) => ['imageEdit.layerPanel.drag.move', { clientY: e.clientY }] },
];
const IMAGE_EDIT_LAYER_POINTEREND_ROUTES = [
    { match: (t) => _ieClosest(t, '[data-image-layer-drag]'), send: () => ['imageEdit.layerPanel.drag.end', {}] },
];
const IMAGE_EDIT_LAYER_HEADER_CLICK_ROUTES = [
    { match: (t) => _ieClosest(t, '[data-image-layers-close]'), send: () => ['imageEdit.layerPanel.close.click', {}] },
];

/** Tuyến đầu tiên khớp phần tử bị tác động -> Router 'imageEdit'. */
function _ieDispatch(routes, e) {
    for (const route of routes) {
        const el = route.match(e.target);
        if (!el) continue;
        const [type, payload] = route.send(el, e);
        eventBus.send({ router: 'imageEdit', type, payload });
        return;
    }
}

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', (e) => _ieDispatch(IMAGE_EDIT_LAYER_CLICK_ROUTES, e));
    genericDrawerBody.addEventListener('input', (e) => _ieDispatch(IMAGE_EDIT_LAYER_INPUT_ROUTES, e));
    genericDrawerBody.addEventListener('pointerdown', (e) => _ieDispatch(IMAGE_EDIT_LAYER_POINTERDOWN_ROUTES, e));
    genericDrawerBody.addEventListener('pointermove', (e) => _ieDispatch(IMAGE_EDIT_LAYER_POINTERMOVE_ROUTES, e));
    genericDrawerBody.addEventListener('pointerup', (e) => _ieDispatch(IMAGE_EDIT_LAYER_POINTEREND_ROUTES, e));
    genericDrawerBody.addEventListener('pointercancel', (e) => _ieDispatch(IMAGE_EDIT_LAYER_POINTEREND_ROUTES, e));
}
if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => _ieDispatch(IMAGE_EDIT_LAYER_HEADER_CLICK_ROUTES, e));
}
