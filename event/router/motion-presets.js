/**
 * event/router/motion-presets.js — Router tên "motionPresets", tự đăng ký với eventBus lúc nạp.
 * Mọi msg.type của hệ "Cấu hình Motion" (danh sách/sửa/Point Move/Timing/Chọn — picker), xem
 * event/workflow/motion-presets.js (workflowMotionPresets).
 *
 * Nguồn message: event/listener/motion-presets.js (delegate trên Generic Drawer), core/point-move-timing-ui.js
 * (node thanh Timing), core/pagination-ui.js (phân trang picker).
 *
 * NẠP SAU: event/bus.js, event/workflow/motion-presets.js.
 */
const routerMotionPresets = (() => {
    function handle(msg) {
        switch (msg.type) {

            // XOÁ (07/10/2026, Giang) — 'motionPresets.addRandom.click' (random cả preset). THAY bằng random theo nhóm:
            case 'motionPresets.beatReact.random.click':
                workflowMotionPresets.randomizeBeatReactValues();
                break;

            case 'motionPresets.pointMove.random.click':
                workflowMotionPresets.randomizePointMoveValues();
                break;

            case 'motionPresets.add.click':
                workflowMotionPresets.addPreset();
                break;

            case 'motionPresets.tile.click':
                workflowMotionPresets.tileClick(msg.payload.id);
                break;

            case 'motionPresets.quickDelete.click':
                workflowMotionPresets.quickDelete(msg.payload.id);
                break;

            case 'motionPresets.name.change':
                workflowMotionPresets.changeName(msg.payload.value);
                break;

            case 'motionPresets.transitionEnabled.change':
                workflowMotionPresets.changeTransitionEnabled(msg.payload.checked);
                break;

            case 'motionPresets.transitionType.change':
                workflowMotionPresets.changeTransitionType(msg.payload.value);
                break;

            case 'motionPresets.transitionDirection.change':
                workflowMotionPresets.changeTransitionDirection(msg.payload.value);
                break;

            case 'motionPresets.transitionZoomDirection.change':
                workflowMotionPresets.changeTransitionZoomDirection(msg.payload.value);
                break;

            case 'motionPresets.transitionSpinDirection.change':
                workflowMotionPresets.changeTransitionSpinDirection(msg.payload.value);
                break;

            case 'motionPresets.transitionWipeDirection.change':
                workflowMotionPresets.changeTransitionWipeDirection(msg.payload.value);
                break;

            case 'motionPresets.transitionCurtainDirection.change':
                workflowMotionPresets.changeTransitionCurtainDirection(msg.payload.value);
                break;

            case 'motionPresets.edgeFlipVariant.change':
                workflowMotionPresets.changeEdgeFlipVariant(msg.payload.value);
                break;

            case 'motionPresets.edgeFlipStaticOld.change':
                workflowMotionPresets.changeEdgeFlipStaticOld(msg.payload.checked);
                break;

            case 'motionPresets.openTransitionDurationPicker.click':
                workflowMotionPresets.openTransitionDurationPicker();
                break;

            case 'motionPresets.transitionRatio.preview':
                workflowMotionPresets.previewTransitionRatio(msg.payload.value);
                break;

            case 'motionPresets.transitionRatio.change':
                workflowMotionPresets.changeTransitionRatio(msg.payload.value);
                break;

            case 'motionPresets.transitionEasing.change':
                workflowMotionPresets.changeTransitionEasing(msg.payload.value);
                break;

            // ===================== Point Move (thay Ken Burns) =====================

            case 'motionPresets.pointMove.enabled.change':
                workflowMotionPresets.changePointMoveEnabled(msg.payload.checked);
                break;

            case 'motionPresets.pointMove.openList.click':
                workflowMotionPresets.openPointMoveList();
                break;

            case 'motionPresets.pointMove.runMode.change':
                workflowMotionPresets.changePointMoveRunMode(msg.payload.value);
                break;

            case 'motionPresets.pointMove.oneOrder.change':
                workflowMotionPresets.changePointMoveOneOrder(msg.payload.value);
                break;

            case 'motionPresets.pointMove.endForceBaseline.change':
                workflowMotionPresets.changePointMoveEndForceBaseline(msg.payload.checked);
                break;

            case 'motionPresets.pointMove.toggleChecked.change':
                workflowMotionPresets.togglePointMoveChecked(msg.payload.id, msg.payload.checked);
                break;

            case 'motionPresets.pointMove.add.click':
                workflowMotionPresets.addPointMove();
                break;

            case 'motionPresets.pointMove.duplicate.click':
                workflowMotionPresets.duplicatePointMove(msg.payload.id);
                break;

            case 'motionPresets.pointMove.drag.start':
                workflowMotionPresets.startPointMoveDrag(msg.payload);
                break;

            case 'motionPresets.pointMove.drag.move':
                workflowMotionPresets.movePointMoveDrag(msg.payload.clientY);
                break;

            case 'motionPresets.pointMove.drag.end':
                workflowMotionPresets.endPointMoveDrag();
                break;

            case 'motionPresets.pointMove.delete.click':
                workflowMotionPresets.deletePointMove(msg.payload.id);
                break;

            case 'motionPresets.pointMove.openEdit.click':
                workflowMotionPresets.openPointMoveEdit(msg.payload.id);
                break;

            case 'motionPresets.pointMove.unit.change':
                workflowMotionPresets.changePointMoveUnit(msg.payload.fieldKey, msg.payload.unit);
                break;

            case 'motionPresets.pointMove.fieldMode.change':
                workflowMotionPresets.changePointMoveFieldMode(msg.payload.fieldKey, msg.payload.mode);
                break;

            case 'motionPresets.pointMove.fieldSingle.preview':
                workflowMotionPresets.previewPointMoveFieldSingle(msg.payload.fieldKey, msg.payload.value);
                break;

            case 'motionPresets.pointMove.fieldSingle.change':
                workflowMotionPresets.changePointMoveFieldSingle(msg.payload.fieldKey, msg.payload.value);
                break;

            case 'motionPresets.pointMove.fieldRange.change':
                workflowMotionPresets.changePointMoveFieldRange(msg.payload.fieldKey, msg.payload.which, msg.payload.value);
                break;

            case 'motionPresets.pointMove.fieldRange.preview':
                workflowMotionPresets.previewPointMoveFieldRange(msg.payload.fieldKey);
                break;

            case 'motionPresets.pointMove.numberInput.change':
                workflowMotionPresets.commitPointMoveNumberInput(msg.payload.fieldKey, msg.payload.which, msg.payload.raw);
                break;

            case 'motionPresets.pointMove.signToggle.click':
                workflowMotionPresets.togglePointMoveInputSign(msg.payload.fieldKey, msg.payload.which);
                break;

            case 'motionPresets.pointMove.openTiming.click':
                workflowMotionPresets.openPointMoveTiming();
                break;

            case 'motionPresets.pointMoveTiming.nodeDrag.preview':
                workflowMotionPresets.previewPointMoveTimingDrag(msg.payload.id, msg.payload.timingX);
                break;

            case 'motionPresets.pointMoveTiming.nodeDrag.end':
                workflowMotionPresets.commitPointMoveTimingDrag();
                break;

            case 'motionPresets.pointMoveTiming.nodeTap':
                workflowMotionPresets.openPointMoveTimingNodeModal(msg.payload.id);
                break;

            case 'motionPresets.pointMove.timingZoom.click':
                workflowMotionPresets.stepPointMoveTimingZoom(msg.payload.delta);
                break;

            // ===================== React Beat Audio =====================

            case 'motionPresets.beatReact.field.change':
                workflowMotionPresets.changeBeatReactField(msg.payload.effectKey, msg.payload.fieldKey, msg.payload.value);
                break;

            case 'motionPresets.beatReact.maxSlider.input':
                workflowMotionPresets.previewBeatReactMax(msg.payload.effectKey, msg.payload.value);
                break;

            case 'motionPresets.beatReact.maxInput.change':
                workflowMotionPresets.commitBeatReactMaxInput(msg.payload.effectKey, msg.payload.fieldKey, msg.payload.raw);
                break;

            case 'motionPresets.reset.click':
                workflowMotionPresets.resetEditing();
                break;

            case 'motionPresets.delete.click':
                workflowMotionPresets.deleteEditing();
                break;

            // ===================== Chế độ Chọn (picker) =====================
            // Nơi tiêu thụ mở màn này qua workflowMotionPresets.openPicker() (Workflow gọi Workflow).

            case 'motionPresets.picker.select.click':
                workflowMotionPresets.selectPickerDraft(msg.payload.id);
                break;

            case 'motionPresets.picker.page.change':
                workflowMotionPresets.setPickerPage(msg.payload.pageIndex);
                break;

            case 'motionPresets.picker.apply.click':
                workflowMotionPresets.applyPicker();
                break;

            default:
                console.warn(`[router:motionPresets] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('motionPresets', routerMotionPresets);
