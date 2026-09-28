/**
 * event/listener/custom-effect.js — Listener cụm "customEffect" (MỚI 28/09/2026, dọn vi phạm event bus).
 *
 * Trước đây event/workflow/custom-effect.js tự `querySelector` + `addEventListener` 21 lần lên từng phần tử của
 * Drawer sau MỖI lần vẽ, callback gọi thẳng core (setCustomEffectField/saveConfig/...) — bỏ qua Listener -> Router.
 * Nay: ủy quyền 1 lần trên `genericDrawerBody` (+ `genericDrawerHeader` cho nút đóng), cùng chuẩn các Drawer khác
 * (auto-switch-visual.js, visual-bg.js...). Listener CHỈ đọc giá trị phần tử làm payload rồi chuyển thư.
 *
 * Mỗi loại sự kiện 1 bảng tuyến: `match(target)` -> phần tử khớp (hoặc null), `send(el)` -> [msg.type, payload].
 * Phần tử của Drawer khác không khớp tuyến nào -> bỏ qua.
 */

/** Thanh trượt của đèn tuỳ chỉnh (Rain street) — class -> khoá slider (workflow tra bảng field/đơn vị). */
const CUSTOM_EFFECT_LAMP_SLIDER_KEY_BY_CLASS = { 'ce-lamp-x': 'x', 'ce-lamp-height': 'height', 'ce-lamp-flare': 'flare' };

function _ceLampSliderKey(el) {
    return Object.keys(CUSTOM_EFFECT_LAMP_SLIDER_KEY_BY_CLASS).find((cls) => el.classList.contains(cls));
}

function _ceMatchLampSlider(target) {
    return target.classList && _ceLampSliderKey(target) ? target : null;
}

const CUSTOM_EFFECT_INPUT_ROUTES = [
    { match: (t) => (t.id === 'ce-solid-color-picker' || t.id === 'ce-solid-color-text' ? t : null), send: (el) => ['customEffect.solidColor.input', { value: el.value, crossTargetId: el.dataset.crossTarget }] },
    { match: (t) => (t.id === 'ce-dyn-color-a' ? t : null), send: (el) => ['customEffect.dynColor.input', { field: 'dynA', value: el.value }] },
    { match: (t) => (t.id === 'ce-dyn-color-b' ? t : null), send: (el) => ['customEffect.dynColor.input', { field: 'dynB', value: el.value }] },
    { match: (t) => (t.id === 'ce-blur-intensity' ? t : null), send: (el) => ['customEffect.blurIntensity.input', { raw: el.value }] },
    { match: (t) => (t.closest ? t.closest('.ce-field-slider') : null), send: (el) => ['customEffect.fieldSlider.input', { field: el.dataset.field, raw: el.value, isFloat: el.dataset.float === '1' }] },
    { match: _ceMatchLampSlider, send: (el) => ['customEffect.lampSlider.input', { index: parseInt(el.dataset.lampIndex, 10), key: CUSTOM_EFFECT_LAMP_SLIDER_KEY_BY_CLASS[_ceLampSliderKey(el)], raw: el.value }] },
];

const CUSTOM_EFFECT_CHANGE_ROUTES = [
    { match: (t) => (t.id === 'ce-color-mode' ? t : null), send: (el) => ['customEffect.colorMode.change', { value: el.value }] },
    { match: (t) => (t.id === 'ce-blur-enable' ? t : null), send: (el) => ['customEffect.blurEnabled.change', { checked: el.checked }] },
    { match: (t) => (t.id === 'ce-blur-intensity' ? t : null), send: () => ['customEffect.blurIntensity.commit', {}] },
    { match: (t) => (t.closest ? t.closest('.ce-field-toggle') : null), send: (el) => ['customEffect.fieldToggle.change', { field: el.dataset.field, checked: el.checked }] },
    { match: (t) => (t.closest ? t.closest('.ce-field-select') : null), send: (el) => ['customEffect.fieldSelect.change', { field: el.dataset.field, value: el.value }] },
    { match: (t) => (t.closest ? t.closest('.ce-field-slider') : null), send: (el) => ['customEffect.fieldSlider.commit', { field: el.dataset.field }] },
    { match: (t) => (t.closest ? t.closest('.ce-fw-style-check') : null), send: (el) => ['customEffect.fireworksStyle.change', { style: el.dataset.style, checked: el.checked }] },
    { match: _ceMatchLampSlider, send: () => ['customEffect.lampSlider.commit', {}] },
];

const CUSTOM_EFFECT_CLICK_ROUTES = [
    { match: (t) => (t.closest ? t.closest('#ce-fw-text-add') : null), send: () => ['customEffect.fireworksText.add', { text: (genericDrawerBody.querySelector('#ce-fw-text-input') || {}).value || '' }] },
    { match: (t) => (t.closest ? t.closest('.ce-fw-text-remove') : null), send: (el) => ['customEffect.fireworksText.remove', { index: parseInt(el.dataset.textIndex, 10) }] },
    { match: (t) => (t.closest ? t.closest('#ce-lamp-add') : null), send: () => ['customEffect.lamp.add', {}] },
    { match: (t) => (t.closest ? t.closest('.ce-lamp-remove') : null), send: (el) => ['customEffect.lamp.remove', { index: parseInt(el.dataset.lampIndex, 10) }] },
];

const CUSTOM_EFFECT_HEADER_CLICK_ROUTES = [
    { match: (t) => (t.closest ? t.closest('[data-ce-close]') : null), send: () => ['customEffect.close.click', {}] },
];

/** Tìm tuyến đầu tiên khớp phần tử bị tác động rồi chuyển thư cho Router 'customEffect'. */
function _ceDispatch(routes, e) {
    for (const route of routes) {
        const el = route.match(e.target);
        if (!el) continue;
        const [type, payload] = route.send(el);
        eventBus.send({ router: 'customEffect', type, payload });
        return;
    }
}

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('input', (e) => _ceDispatch(CUSTOM_EFFECT_INPUT_ROUTES, e));
    genericDrawerBody.addEventListener('change', (e) => _ceDispatch(CUSTOM_EFFECT_CHANGE_ROUTES, e));
    genericDrawerBody.addEventListener('click', (e) => _ceDispatch(CUSTOM_EFFECT_CLICK_ROUTES, e));
}
if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => _ceDispatch(CUSTOM_EFFECT_HEADER_CLICK_ROUTES, e));
}
