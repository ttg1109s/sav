/**
 * event/listener/motion-presets.js — Listener cụm "motionPresets": mọi màn Motion trong Settings (List, Chọn — picker,
 * Edit, Point Move List/Edit, Timing). Ủy quyền 1 lần trên `genericDrawerBody` (+ `genericDrawerHeader` cho nút Apply
 * của picker) — thay cho ~60 `addEventListener` từng gắn lại trong onMount của event/workflow/app-settings.js mỗi lần
 * vẽ màn. Cùng khuôn event/listener/custom-effect.js: mỗi loại sự kiện 1 bảng tuyến `match(target)` -> phần tử khớp,
 * `send(el, e)` -> [msg.type, payload]; phần tử của màn khác không khớp tuyến nào -> bỏ qua. Listener chỉ đọc giá trị
 * phần tử làm payload; xử lý (kẹp số, đồng bộ slider/ô số, persist) ở workflowMotionPresets.
 *
 * Kéo-sắp-xếp Point Move: pointerdown trên tay cầm -> 'pointMove.drag.start' (workflow gọi setPointerCapture), nên
 * pointermove/pointerup sau đó tới đúng tay cầm và nổi bọt lên đây — không gắn listener lên `document`.
 *
 * NẠP SAU: event/bus.js, core/dom-refs.js (genericDrawerBody/Header), event/router/motion-presets.js.
 */

const MOTION_BEAT_REACT_EFFECT_KEYS = ['zoom', 'panX', 'panY', 'rotate'];
// Checkbox React Beat theo hậu tố id -> fieldKey.
const MOTION_BEAT_REACT_CHECKBOX_FIELD_BY_SUFFIX = { enabled: 'enabled', randommax: 'randomMax', reverse: 'reverse' };
const MOTION_BEAT_REACT_MAX_FIELD_BY_EFFECT = { zoom: 'maxPct', panX: 'maxPct', panY: 'maxPct', rotate: 'maxDeg' };
// Ô nhập số / slider Point Move: hậu tố id -> which.
const MOTION_POINT_MOVE_WHICH_BY_SUFFIX = { single: 'single', rangemin: 'min', rangemax: 'max' };
// Select hướng transition: id -> msg.type.
const MOTION_TRANSITION_SELECT_TYPE_BY_ID = {
    'setting-motion-transition': 'motionPresets.transitionType.change',
    'setting-motion-transition-direction': 'motionPresets.transitionDirection.change',
    'setting-motion-transition-zoom-direction': 'motionPresets.transitionZoomDirection.change',
    'setting-motion-transition-spin-direction': 'motionPresets.transitionSpinDirection.change',
    'setting-motion-transition-wipe-direction': 'motionPresets.transitionWipeDirection.change',
    'setting-motion-transition-curtain-direction': 'motionPresets.transitionCurtainDirection.change',
    'setting-motion-edge-flip-variant': 'motionPresets.edgeFlipVariant.change',
    'setting-motion-transition-easing': 'motionPresets.transitionEasing.change',
    'setting-motion-pointmove-runmode': 'motionPresets.pointMove.runMode.change',
    'setting-motion-pointmove-order': 'motionPresets.pointMove.oneOrder.change',
};
// Checkbox đơn: id -> msg.type (payload { checked }).
const MOTION_CHECKBOX_TYPE_BY_ID = {
    'setting-motion-transition-enabled': 'motionPresets.transitionEnabled.change',
    'setting-motion-edge-flip-static-old': 'motionPresets.edgeFlipStaticOld.change',
    'setting-motion-pointmove-enabled': 'motionPresets.pointMove.enabled.change',
    'setting-motion-pointmove-end-force-baseline': 'motionPresets.pointMove.endForceBaseline.change',
};
// Nút đơn: id -> [msg.type, payload].
const MOTION_BUTTON_MSG_BY_ID = {
    'btn-motion-list-add': ['motionPresets.add.click', {}],
    'btn-motion-list-add-random': ['motionPresets.addRandom.click', {}],
    'setting-motion-transition-duration': ['motionPresets.openTransitionDurationPicker.click', {}],
    'btn-motion-pointmove-list': ['motionPresets.pointMove.openList.click', {}],
    'btn-motion-edit-reset': ['motionPresets.reset.click', {}],
    'btn-motion-edit-delete': ['motionPresets.delete.click', {}],
    'btn-ptmove-add': ['motionPresets.pointMove.add.click', {}],
    'btn-motion-pointmove-timing': ['motionPresets.pointMove.openTiming.click', {}],
    'btn-ptmove-timing-zoom-in': ['motionPresets.pointMove.timingZoom.click', { delta: 1 }],
    'btn-ptmove-timing-zoom-out': ['motionPresets.pointMove.timingZoom.click', { delta: -1 }],
};

const MOTION_BEAT_REACT_CHECKBOX_RE = new RegExp(`^setting-motion-beatreact-(${MOTION_BEAT_REACT_EFFECT_KEYS.join('|')})-(enabled|randommax|reverse)$`);
const MOTION_BEAT_REACT_DIRECTION_RE = /^setting-motion-beatreact-(panX|panY|rotate)-direction$/;
const MOTION_BEAT_REACT_MAX_SLIDER_RE = new RegExp(`^setting-motion-beatreact-(${MOTION_BEAT_REACT_EFFECT_KEYS.join('|')})-max$`);
const MOTION_BEAT_REACT_MAX_INPUT_RE = new RegExp(`^motion-beatreact-(${MOTION_BEAT_REACT_EFFECT_KEYS.join('|')})-max-input$`);
const MOTION_POINT_MOVE_SLIDER_RE = /^setting-ptmove-(\w+)-(single|rangemin|rangemax)$/;
const MOTION_POINT_MOVE_NUMBER_INPUT_RE = /^ptmove-(\w+)-(single|rangemin|rangemax)-input$/;

function _mpClosest(target, selector) {
    return target.closest ? target.closest(selector) : null;
}

function _mpMatchId(target, idSet) {
    return target.id && idSet[target.id] ? target : null;
}

function _mpMatchIdRe(target, re) {
    return target.id && re.test(target.id) ? target : null;
}

/** {fieldKey, which} của 1 id ô số/slider Point Move. */
function _mpPointMoveIdParts(id, re) {
    const [, fieldKey, suffix] = id.match(re);
    return { fieldKey, which: MOTION_POINT_MOVE_WHICH_BY_SUFFIX[suffix] };
}

const MOTION_PRESETS_CLICK_ROUTES = [
    // Nút nhỏ trong 1 dòng đứng TRƯỚC tuyến dòng (dòng chứa nút) — khớp đầu tiên thắng.
    { match: (t) => _mpClosest(t, '[data-motion-preset-quickdelete]'), send: (el) => ['motionPresets.quickDelete.click', { id: el.dataset.motionPresetQuickdelete }] },
    { match: (t) => _mpClosest(t, '[data-motion-preset-tile]'), send: (el) => ['motionPresets.tile.click', { id: el.dataset.motionPresetTile }] },
    { match: (t) => _mpClosest(t, '[data-motion-picker-option]'), send: (el) => ['motionPresets.picker.select.click', { id: el.dataset.motionPickerOption }] },
    { match: (t) => _mpClosest(t, '[data-ptmove-duplicate]'), send: (el) => ['motionPresets.pointMove.duplicate.click', { id: el.dataset.ptmoveDuplicate }] },
    { match: (t) => _mpClosest(t, '[data-ptmove-delete]'), send: (el) => ['motionPresets.pointMove.delete.click', { id: el.dataset.ptmoveDelete }] },
    { match: (t) => _mpClosest(t, '[data-ptmove-edit]'), send: (el) => ['motionPresets.pointMove.openEdit.click', { id: el.dataset.ptmoveEdit }] },
    { match: (t) => _mpClosest(t, '[data-ptmove-unit]'), send: (el) => ['motionPresets.pointMove.unit.change', { fieldKey: el.dataset.ptmoveUnit, unit: el.dataset.value }] },
    { match: (t) => _mpClosest(t, '[data-ptmove-sign-toggle]'), send: (el) => ['motionPresets.pointMove.signToggle.click', _mpPointMoveIdParts(el.dataset.ptmoveSignToggle, MOTION_POINT_MOVE_NUMBER_INPUT_RE)] },
    { match: (t) => { const el = _mpClosest(t, 'button[id]'); return el && MOTION_BUTTON_MSG_BY_ID[el.id] ? el : null; }, send: (el) => MOTION_BUTTON_MSG_BY_ID[el.id] },
];

const MOTION_PRESETS_CHANGE_ROUTES = [
    { match: (t) => _mpMatchId(t, MOTION_TRANSITION_SELECT_TYPE_BY_ID), send: (el) => [MOTION_TRANSITION_SELECT_TYPE_BY_ID[el.id], { value: el.value }] },
    { match: (t) => _mpMatchId(t, MOTION_CHECKBOX_TYPE_BY_ID), send: (el) => [MOTION_CHECKBOX_TYPE_BY_ID[el.id], { checked: el.checked }] },
    { match: (t) => (t.id === 'setting-motion-transition-ratio' ? t : null), send: (el) => ['motionPresets.transitionRatio.change', { value: Number(el.value) }] },
    { match: (t) => (t.id === 'setting-motion-beatreact-enabled' ? t : null), send: (el) => ['motionPresets.beatReact.field.change', { effectKey: null, fieldKey: 'enabled', value: el.checked }] },
    { match: (t) => _mpMatchIdRe(t, MOTION_BEAT_REACT_CHECKBOX_RE), send: (el) => { const [, effectKey, suffix] = el.id.match(MOTION_BEAT_REACT_CHECKBOX_RE); return ['motionPresets.beatReact.field.change', { effectKey, fieldKey: MOTION_BEAT_REACT_CHECKBOX_FIELD_BY_SUFFIX[suffix], value: el.checked }]; } },
    { match: (t) => _mpMatchIdRe(t, MOTION_BEAT_REACT_DIRECTION_RE), send: (el) => ['motionPresets.beatReact.field.change', { effectKey: el.id.match(MOTION_BEAT_REACT_DIRECTION_RE)[1], fieldKey: 'direction', value: el.value }] },
    { match: (t) => _mpMatchIdRe(t, MOTION_BEAT_REACT_MAX_SLIDER_RE), send: (el) => { const effectKey = el.id.match(MOTION_BEAT_REACT_MAX_SLIDER_RE)[1]; return ['motionPresets.beatReact.field.change', { effectKey, fieldKey: MOTION_BEAT_REACT_MAX_FIELD_BY_EFFECT[effectKey], value: Number(el.value) }]; } },
    { match: (t) => _mpMatchIdRe(t, MOTION_BEAT_REACT_MAX_INPUT_RE), send: (el) => { const effectKey = el.id.match(MOTION_BEAT_REACT_MAX_INPUT_RE)[1]; return ['motionPresets.beatReact.maxInput.change', { effectKey, fieldKey: MOTION_BEAT_REACT_MAX_FIELD_BY_EFFECT[effectKey], raw: el.value }]; } },
    { match: (t) => (t.dataset && t.dataset.ptmoveCheckbox ? t : null), send: (el) => ['motionPresets.pointMove.toggleChecked.change', { id: el.dataset.ptmoveCheckbox, checked: el.checked }] },
    { match: (t) => (t.dataset && t.dataset.ptmoveMode ? t : null), send: (el) => ['motionPresets.pointMove.fieldMode.change', { fieldKey: el.dataset.ptmoveMode, mode: el.value }] },
    { match: (t) => _mpMatchIdRe(t, MOTION_POINT_MOVE_SLIDER_RE), send: (el) => {
        const { fieldKey, which } = _mpPointMoveIdParts(el.id, MOTION_POINT_MOVE_SLIDER_RE);
        return which === 'single'
            ? ['motionPresets.pointMove.fieldSingle.change', { fieldKey, value: Number(el.value) }]
            : ['motionPresets.pointMove.fieldRange.change', { fieldKey, which, value: Number(el.value) }];
    } },
    { match: (t) => _mpMatchIdRe(t, MOTION_POINT_MOVE_NUMBER_INPUT_RE), send: (el) => ['motionPresets.pointMove.numberInput.change', { ..._mpPointMoveIdParts(el.id, MOTION_POINT_MOVE_NUMBER_INPUT_RE), raw: el.value }] },
];

const MOTION_PRESETS_INPUT_ROUTES = [
    { match: (t) => (t.id === 'setting-motion-transition-ratio' ? t : null), send: (el) => ['motionPresets.transitionRatio.preview', { value: Number(el.value) }] },
    { match: (t) => _mpMatchIdRe(t, MOTION_BEAT_REACT_MAX_SLIDER_RE), send: (el) => ['motionPresets.beatReact.maxSlider.input', { effectKey: el.id.match(MOTION_BEAT_REACT_MAX_SLIDER_RE)[1], value: el.value }] },
    { match: (t) => _mpMatchIdRe(t, MOTION_POINT_MOVE_SLIDER_RE), send: (el) => {
        const { fieldKey, which } = _mpPointMoveIdParts(el.id, MOTION_POINT_MOVE_SLIDER_RE);
        return which === 'single'
            ? ['motionPresets.pointMove.fieldSingle.preview', { fieldKey, value: Number(el.value) }]
            : ['motionPresets.pointMove.fieldRange.preview', { fieldKey }];
    } },
];

// 'focusout' thay 'blur' (blur không nổi bọt).
const MOTION_PRESETS_FOCUSOUT_ROUTES = [
    { match: (t) => (t.id === 'setting-motion-name' ? t : null), send: (el) => ['motionPresets.name.change', { value: el.value }] },
];

const MOTION_PRESETS_POINTERDOWN_ROUTES = [
    { match: (t) => _mpClosest(t, '[data-ptmove-drag-handle]'), send: (el, e) => { e.preventDefault(); return ['motionPresets.pointMove.drag.start', { id: el.dataset.ptmoveDragHandle, clientY: e.clientY, handleEl: el, pointerId: e.pointerId }]; } },
];
const MOTION_PRESETS_POINTERMOVE_ROUTES = [
    { match: (t) => _mpClosest(t, '[data-ptmove-drag-handle]'), send: (el, e) => ['motionPresets.pointMove.drag.move', { clientY: e.clientY }] },
];
const MOTION_PRESETS_POINTEREND_ROUTES = [
    { match: (t) => _mpClosest(t, '[data-ptmove-drag-handle]'), send: () => ['motionPresets.pointMove.drag.end', {}] },
];

const MOTION_PRESETS_HEADER_CLICK_ROUTES = [
    { match: (t) => _mpClosest(t, '#btn-motion-picker-apply'), send: () => ['motionPresets.picker.apply.click', {}] },
];

/** Tìm tuyến đầu tiên khớp phần tử bị tác động rồi chuyển thư cho Router 'motionPresets'. */
function _mpDispatch(routes, e) {
    for (const route of routes) {
        const el = route.match(e.target);
        if (!el) continue;
        const [type, payload] = route.send(el, e);
        eventBus.send({ router: 'motionPresets', type, payload });
        return;
    }
}

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', (e) => _mpDispatch(MOTION_PRESETS_CLICK_ROUTES, e));
    genericDrawerBody.addEventListener('change', (e) => _mpDispatch(MOTION_PRESETS_CHANGE_ROUTES, e));
    genericDrawerBody.addEventListener('input', (e) => _mpDispatch(MOTION_PRESETS_INPUT_ROUTES, e));
    genericDrawerBody.addEventListener('focusout', (e) => _mpDispatch(MOTION_PRESETS_FOCUSOUT_ROUTES, e));
    genericDrawerBody.addEventListener('pointerdown', (e) => _mpDispatch(MOTION_PRESETS_POINTERDOWN_ROUTES, e));
    genericDrawerBody.addEventListener('pointermove', (e) => _mpDispatch(MOTION_PRESETS_POINTERMOVE_ROUTES, e));
    genericDrawerBody.addEventListener('pointerup', (e) => _mpDispatch(MOTION_PRESETS_POINTEREND_ROUTES, e));
    genericDrawerBody.addEventListener('pointercancel', (e) => _mpDispatch(MOTION_PRESETS_POINTEREND_ROUTES, e));
}
if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => _mpDispatch(MOTION_PRESETS_HEADER_CLICK_ROUTES, e));
}
