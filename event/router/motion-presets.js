/**
 * event/router/motion-presets.js — Router tên "motionPresets", tự đăng ký với eventBus lúc
 * nạp. MỚI (29/08/2026) — mọi msg.type của hệ "Cấu hình Motion" (danh sách/sửa/Áp dụng), xem
 * event/workflow/motion-presets.js (workflowMotionPresets).
 *
 * NẠP SAU: event/bus.js, event/workflow/motion-presets.js.
 */
const routerMotionPresets = (() => {
    function handle(msg) {
        switch (msg.type) {

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

            // MỚI (30/08/2026, phản hồi Giang) — 2 field phụ CHỈ có ý nghĩa khi transitionType là
            // flip-mép, xem docstring workflowMotionPresets.changeEdgeFlipVariant().
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

            case 'motionPresets.kenBurnsEnabled.change':
                workflowMotionPresets.changeKenBurnsEnabled(msg.payload.checked);
                break;

            case 'motionPresets.kenBurnsMode.change':
                workflowMotionPresets.changeKenBurnsMode(msg.payload.value);
                break;

            // MỚI (29/08/2026) — "React Beat Audio" — GENERIC 1 case DUY NHẤT cho mọi field (13
            // control khác nhau ở UI đều gửi CÙNG msg.type này, chỉ khác payload) — xem docstring
            // workflowMotionPresets.changeBeatReactField().
            case 'motionPresets.beatReact.field.change':
                workflowMotionPresets.changeBeatReactField(msg.payload.effectKey, msg.payload.fieldKey, msg.payload.value);
                break;

            case 'motionPresets.reset.click':
                workflowMotionPresets.resetEditing();
                break;

            case 'motionPresets.delete.click':
                workflowMotionPresets.deleteEditing();
                break;

            case 'motionPresets.openPickForPhotoVisualBg.click':
                workflowMotionPresets.openPickForPhotoVisualBg();
                break;

            case 'motionPresets.detachFromPhotoVisualBg.click':
                workflowMotionPresets.detachFromPhotoVisualBg();
                break;

            default:
                console.warn(`[router:motionPresets] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('motionPresets', routerMotionPresets);
