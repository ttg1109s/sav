/**
 * core/motion-presets-ui.js — ghi DOM các màn "Cấu hình Motion" trong Settings (components/motion-settings-drawer.js):
 * ẩn/hiện dòng theo kiểu Transition, nhãn thời lượng / tỉ lệ in-out, ô số + slider, cụm single/range của field Point Move,
 * phiên kéo-sắp-xếp danh sách Point Move, thanh Timing (gắn SVG, vá node, zoom). Workflow (event/workflow/motion-presets.js)
 * tra phần tử + tính giá trị rồi truyền vào; mỗi hàm 1 việc, không đọc appState, không gọi core khác.
 */

/** Style hàng Point Move lúc đang kéo (nổi lên + đổ bóng) và lúc thả (trả về). */
const POINT_MOVE_DRAG_ROW_STYLE_LIFTED = { position: 'relative', zIndex: '30', boxShadow: '0 10px 24px rgba(0,0,0,0.25)', userSelect: 'none' };
const POINT_MOVE_DRAG_ROW_STYLE_DROPPED = { position: '', zIndex: '', boxShadow: '', userSelect: '', transform: '' };
/** Bộ theme key của hàng: đích thả đang hover / bình thường. */
const POINT_MOVE_DROP_TARGET_THEME_KEYS = { true: 'rowActiveBg cardBorder', false: 'cardBg cardBorder' };

/**
 * Đồng bộ màn Edit preset: ẩn/hiện các dòng theo kiểu Transition + run mode, nút thời lượng, slider tỉ lệ.
 * @param {Object<string, HTMLElement|null>} els - ratioRow, directionRow, zoomDirectionRow, spinDirectionRow, wipeDirectionRow,
 *        curtainDirectionRow, variantRow, staticOldRow, durationBtn, ratioSlider, orderRow
 * @param {object} preset
 * @param {{ratio: boolean, direction: boolean, zoomDirection: boolean, spinDirection: boolean, wipeDirection: boolean,
 *          curtainDirection: boolean, edgeFlip: boolean}} caps - các `transitionSupports*()`/`transitionIsEdgeFlip()` của kiểu
 *        đang chọn (core/motion-engine.js, Workflow gọi)
 */
function syncMotionEditUi(els, preset, caps) {
    const toggleRow = (el, visible) => { if (el) el.classList.toggle('hidden', !visible); };
    toggleRow(els.ratioRow, caps.ratio);
    toggleRow(els.directionRow, caps.direction);
    toggleRow(els.zoomDirectionRow, caps.zoomDirection);
    toggleRow(els.spinDirectionRow, caps.spinDirection);
    toggleRow(els.wipeDirectionRow, caps.wipeDirection);
    toggleRow(els.curtainDirectionRow, caps.curtainDirection);
    toggleRow(els.variantRow, caps.edgeFlip);
    // "Ảnh trước đứng yên" chỉ khi flipEdge + variant 'close'.
    toggleRow(els.staticOldRow, caps.edgeFlip && preset.edgeFlipVariant === 'close');
    // "Thứ tự chọn" chỉ khi run mode 'one'.
    toggleRow(els.orderRow, preset.pointMoveRunMode === 'one');
    if (els.durationBtn) els.durationBtn.textContent = `${(preset.transitionDurationMs / 1000).toFixed(1)}s`;
    if (els.ratioSlider) els.ratioSlider.value = preset.transitionInOutRatio;
}

/** Nút thời lượng chuyển cảnh, vd "1.5s". @param {HTMLElement|null} btnEl @param {number} durationMs */
function setMotionTransitionDurationText(btnEl, durationMs) {
    if (btnEl) btnEl.textContent = `${(durationMs / 1000).toFixed(1)}s`;
}

/** Nhãn xem trước tỉ lệ in/out, vd "In 0.5s · Out 0.5s". @param {HTMLElement|null} labelEl
 * @param {{inMs: number, outMs: number}} inOutMs - computeMotionEngineTransitionInOutMs() */
function setMotionTransitionRatioLabel(labelEl, inOutMs) {
    if (!labelEl) return;
    labelEl.textContent = tFormat('motionSettingsDrawer.transitionRatio.previewFormat', { in: (inOutMs.inMs / 1000).toFixed(1), out: (inOutMs.outMs / 1000).toFixed(1) });
}

/** Ghi cùng 1 giá trị vào các ô số/slider (phần tử null bỏ qua). @param {Array<HTMLInputElement|null>} inputEls @param {*} value */
function setMotionInputValues(inputEls, value) {
    inputEls.forEach((el) => { if (el) el.value = value; });
}

/** Chép giá trị slider sang ô số (đang kéo, chưa lưu). @param {HTMLInputElement|null} fromEl @param {HTMLInputElement|null} toEl */
function copyMotionInputValue(fromEl, toEl) {
    if (fromEl && toEl) toEl.value = fromEl.value;
}

/** Hiện cụm slider + ô số của mode đang chọn (single / randomRange) cho 1 field Point Move.
 * @param {{singleWrap, rangeWrap, singleInputWrap, rangeInputWrap}} els @param {'single'|'randomRange'} mode */
function showPointMoveFieldMode(els, mode) {
    const isSingle = mode === 'single';
    if (els.singleWrap) els.singleWrap.style.display = isSingle ? '' : 'none';
    if (els.rangeWrap) els.rangeWrap.style.display = isSingle ? 'none' : '';
    if (els.singleInputWrap) els.singleInputWrap.classList.toggle('hidden', !isSingle);
    if (els.rangeInputWrap) els.rangeInputWrap.classList.toggle('hidden', isSingle);
}

/** Dải tô màu giữa 2 tay kéo dual-range. @param {HTMLElement} fillEl @param {{left: string, width: string}} fill */
function paintPointMoveRangeFill(fillEl, fill) {
    fillEl.style.left = fill.left;
    fillEl.style.width = fill.width;
}

/** Nhấc hàng Point Move: bắt con trỏ trên tay cầm (pointermove/pointerup về đúng tay cầm, nổi bọt lên listener ủy quyền),
 * nổi hàng lên + chặn bôi đen chữ toàn trang. @param {HTMLElement} rowEl @param {HTMLElement} handleEl @param {number} pointerId */
function liftPointMoveDragRow(rowEl, handleEl, pointerId) {
    handleEl.setPointerCapture(pointerId);
    Object.assign(rowEl.style, POINT_MOVE_DRAG_ROW_STYLE_LIFTED);
    document.body.style.userSelect = 'none';
}

/** Hàng đang kéo bám con trỏ. @param {HTMLElement} rowEl @param {string} transform */
function setPointMoveDragRowTransform(rowEl, transform) {
    rowEl.style.transform = transform;
}

/** Thả hàng: trả style + bỏ chặn bôi đen chữ. @param {HTMLElement} rowEl */
function dropPointMoveDragRow(rowEl) {
    Object.assign(rowEl.style, POINT_MOVE_DRAG_ROW_STYLE_DROPPED);
    document.body.style.userSelect = '';
}

/** Đổi bộ theme key của hàng đích thả (Workflow áp theme ngay sau). @param {HTMLElement|null} rowEl @param {boolean} isTarget */
function setPointMoveDropTargetThemeKeys(rowEl, isTarget) {
    if (rowEl) rowEl.dataset.uitk = POINT_MOVE_DROP_TARGET_THEME_KEYS[isTarget];
}

/** Thay toàn bộ SVG thanh Timing. @param {HTMLElement} containerEl - `#ptmove-timing-container`
 * @param {SVGElement} curveEl - buildPointMoveTimingCurveEl() (core/point-move-timing-ui.js) */
function mountPointMoveTimingCurve(containerEl, curveEl) {
    containerEl.innerHTML = '';
    containerEl.appendChild(curveEl);
}

/** Vá vị trí 1 node ngay trong SVG đang có (đang kéo — không dựng lại). @param {SVGElement} nodeEl @param {number} cx */
function setPointMoveTimingNodeCx(nodeEl, cx) {
    nodeEl.setAttribute('cx', cx);
}

/** Zoom trục thời gian màn Timing. @param {HTMLElement|null} zoomableEl @param {HTMLElement|null} labelEl
 * @param {{transform: string, labelText: string}} view - computePointMoveTimingZoomView() */
function applyPointMoveTimingZoomUi(zoomableEl, labelEl, view) {
    if (zoomableEl) zoomableEl.style.transform = view.transform;
    if (labelEl) labelEl.textContent = view.labelText;
}

/** Cuộn thân Drawer về đầu (sang trang khác của màn Chọn). @param {HTMLElement} bodyEl */
function resetMotionDrawerScroll(bodyEl) {
    bodyEl.scrollTop = 0;
}
