/**
 * event/listener/element-style-editor.js — Listener cụm "elementStyleEditor": nội dung Generic Drawer "Element Style
 * Editor". Ủy quyền 1 lần trên `genericDrawerBody`/`genericDrawerHeader` (TĨNH, core/dom-refs.js), khuôn
 * event/listener/custom-effect.js — bảng tuyến `match(target) -> send(el)`, Listener CHỈ đọc giá trị/dataset phần tử làm
 * payload rồi chuyển thư cho Router 'elementStyleEditor'.
 *
 * Selector đều riêng của công cụ (`data-ese-*`, `.ese-*`, `#ese-*`, `#btn-ese-*`) -> Drawer khác dùng chung body/header
 * không khớp tuyến nào, bỏ qua. `.ese-field`: `<select>` nghe `change`, ô nhập (text/number/color) nghe `input` — KHÔNG
 * để select lọt vào tuyến `input` (Chrome cũng bắn `input` cho select) hay ô nhập lọt vào tuyến `change` (bắn lúc rời ô).
 *
 * NẠP SAU CÙNG (sau bus, core/dom-refs.js, event/router/element-style-editor.js).
 */

function _eseClosest(target, selector) {
    return target.closest ? target.closest(selector) : null;
}

/** Payload chung của 1 ô `.ese-field` (giá trị thô — Workflow nhờ core đổi sang số nếu `data-numeric`). */
function _eseFieldPayload(el) {
    const d = el.dataset;
    return { section: d.section, field: d.field, subkey: d.subkey, raw: el.value, isNumeric: d.numeric === '1', rerender: d.rerender === '1', crossTargetId: d.crossTarget || null };
}

const ELEMENT_STYLE_EDITOR_HEADER_CLICK_ROUTES = [
    { match: (t) => _eseClosest(t, '[data-ese-close]'), send: () => ['elementStyleEditor.close.click', {}] },
    { match: (t) => _eseClosest(t, '[data-ese-tab]'), send: (el) => ['elementStyleEditor.tab.click', { tab: el.dataset.eseTab }] },
    { match: (t) => _eseClosest(t, '#btn-ese-fontpicker-back'), send: () => ['elementStyleEditor.fontPicker.back.click', {}] },
];

const ELEMENT_STYLE_EDITOR_BODY_CLICK_ROUTES = [
    { match: (t) => _eseClosest(t, '#ese-fontfamily-load-btn'), send: () => ['elementStyleEditor.loadFont.click', {}] },
    { match: (t) => _eseClosest(t, '#ese-fontfamily-open-picker'), send: () => ['elementStyleEditor.fontPicker.open.click', {}] },
    { match: (t) => _eseClosest(t, '#ese-apply-btn'), send: () => ['elementStyleEditor.apply.click', {}] },
    { match: (t) => _eseClosest(t, '.ese-font-option'), send: (el) => ['elementStyleEditor.fontPicker.option.click', { fontName: el.dataset.fontName }] },
];

const ELEMENT_STYLE_EDITOR_BODY_CHANGE_ROUTES = [
    { match: (t) => (t.classList && t.classList.contains('ese-enable') ? t : null), send: (el) => ['elementStyleEditor.enable.change', { section: el.dataset.section, field: el.dataset.field, checked: el.checked }] },
    { match: (t) => (t.classList && t.classList.contains('ese-field') && t.tagName === 'SELECT' ? t : null), send: (el) => ['elementStyleEditor.field.input', _eseFieldPayload(el)] },
    { match: (t) => (t.classList && t.classList.contains('ese-simple-field') ? t : null), send: (el) => ['elementStyleEditor.simpleField.change', { section: el.dataset.section, field: el.dataset.field, value: el.value }] },
];

const ELEMENT_STYLE_EDITOR_BODY_INPUT_ROUTES = [
    { match: (t) => (t.classList && t.classList.contains('ese-field') && t.tagName !== 'SELECT' ? t : null), send: (el) => ['elementStyleEditor.field.input', _eseFieldPayload(el)] },
    { match: (t) => (t.id === 'ese-fontpicker-search' ? t : null), send: (el) => ['elementStyleEditor.fontPicker.search.input', { query: el.value }] },
];

/** Tìm tuyến đầu tiên khớp phần tử bị tác động rồi chuyển thư cho Router 'elementStyleEditor' (không khớp -> bỏ qua). */
function _eseDispatch(routes, e) {
    for (const route of routes) {
        const el = route.match(e.target);
        if (!el) continue;
        const [type, payload] = route.send(el);
        eventBus.send({ router: 'elementStyleEditor', type, payload });
        return;
    }
}

if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => _eseDispatch(ELEMENT_STYLE_EDITOR_HEADER_CLICK_ROUTES, e));
}
if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', (e) => _eseDispatch(ELEMENT_STYLE_EDITOR_BODY_CLICK_ROUTES, e));
    genericDrawerBody.addEventListener('change', (e) => _eseDispatch(ELEMENT_STYLE_EDITOR_BODY_CHANGE_ROUTES, e));
    genericDrawerBody.addEventListener('input', (e) => _eseDispatch(ELEMENT_STYLE_EDITOR_BODY_INPUT_ROUTES, e));
}
