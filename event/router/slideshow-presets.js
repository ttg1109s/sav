/**
 * event/router/slideshow-presets.js — Router tên "slideshowPresets", tự đăng ký với eventBus lúc
 * nạp. MỚI (29/08/2026) — mọi msg.type của hệ "Cấu hình Slideshow" (danh sách/sửa/Áp dụng), xem
 * event/workflow/slideshow-presets.js (workflowSlideshowPresets).
 *
 * NẠP SAU: event/bus.js, event/workflow/slideshow-presets.js.
 */
const routerSlideshowPresets = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'slideshowPresets.add.click':
                workflowSlideshowPresets.addPreset();
                break;

            case 'slideshowPresets.tile.click':
                workflowSlideshowPresets.tileClick(msg.payload.id);
                break;

            case 'slideshowPresets.quickDelete.click':
                workflowSlideshowPresets.quickDelete(msg.payload.id);
                break;

            case 'slideshowPresets.name.change':
                workflowSlideshowPresets.changeName(msg.payload.value);
                break;

            case 'slideshowPresets.transitionEnabled.change':
                workflowSlideshowPresets.changeTransitionEnabled(msg.payload.checked);
                break;

            case 'slideshowPresets.transitionType.change':
                workflowSlideshowPresets.changeTransitionType(msg.payload.value);
                break;

            case 'slideshowPresets.openTransitionDurationPicker.click':
                workflowSlideshowPresets.openTransitionDurationPicker();
                break;

            case 'slideshowPresets.transitionRatio.preview':
                workflowSlideshowPresets.previewTransitionRatio(msg.payload.value);
                break;

            case 'slideshowPresets.transitionRatio.change':
                workflowSlideshowPresets.changeTransitionRatio(msg.payload.value);
                break;

            case 'slideshowPresets.transitionEasing.change':
                workflowSlideshowPresets.changeTransitionEasing(msg.payload.value);
                break;

            case 'slideshowPresets.kenBurnsEnabled.change':
                workflowSlideshowPresets.changeKenBurnsEnabled(msg.payload.checked);
                break;

            case 'slideshowPresets.kenBurnsMode.change':
                workflowSlideshowPresets.changeKenBurnsMode(msg.payload.value);
                break;

            // MỚI (29/08/2026) — "React Beat Audio" — GENERIC 1 case DUY NHẤT cho mọi field (13
            // control khác nhau ở UI đều gửi CÙNG msg.type này, chỉ khác payload) — xem docstring
            // workflowSlideshowPresets.changeBeatReactField().
            case 'slideshowPresets.beatReact.field.change':
                workflowSlideshowPresets.changeBeatReactField(msg.payload.effectKey, msg.payload.fieldKey, msg.payload.value);
                break;

            case 'slideshowPresets.reset.click':
                workflowSlideshowPresets.resetEditing();
                break;

            case 'slideshowPresets.delete.click':
                workflowSlideshowPresets.deleteEditing();
                break;

            case 'slideshowPresets.openPickForPhotoVisualBg.click':
                workflowSlideshowPresets.openPickForPhotoVisualBg();
                break;

            case 'slideshowPresets.detachFromPhotoVisualBg.click':
                workflowSlideshowPresets.detachFromPhotoVisualBg();
                break;

            default:
                console.warn(`[router:slideshowPresets] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('slideshowPresets', routerSlideshowPresets);
