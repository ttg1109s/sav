/**
 * event/router/custom-effect.js — Router cụm "customEffect" (MỚI 28/09/2026) — nội dung Custom Effect Drawer, nhận thư
 * từ event/listener/custom-effect.js, giao hết cho `workflowCustomEffect` (mọi thao tác đều đọc effect đang mở +
 * ghi config + lưu, tức (B) Workflow — readme/event-bus-flow.md mục 4).
 * (Nút #btn-cycle-mode — giữ/bấm — vẫn đi qua router 'visualizerDisplay' như trước.)
 */
const routerCustomEffect = (() => {
    function handle(msg) {
        const p = msg.payload;
        switch (msg.type) {
            case 'customEffect.colorMode.change':
                workflowCustomEffect.setColorMode(p.value);
                break;
            case 'customEffect.solidColor.input':
                workflowCustomEffect.setSolidColor(p.value, p.crossTargetId);
                break;
            case 'customEffect.dynColor.input':
                workflowCustomEffect.setDynColor(p.field, p.value);
                break;
            case 'customEffect.blurEnabled.change':
                workflowCustomEffect.setBlurEnabled(p.checked);
                break;
            case 'customEffect.blurIntensity.input':
                workflowCustomEffect.previewBlurIntensity(p.raw);
                break;
            case 'customEffect.blurIntensity.commit':
                workflowCustomEffect.commit();
                break;
            case 'customEffect.fieldToggle.change':
                workflowCustomEffect.setFieldValue(p.field, p.checked);
                break;
            case 'customEffect.fieldSelect.change':
                workflowCustomEffect.setFieldValue(p.field, p.value);
                break;
            case 'customEffect.fieldSlider.input':
                workflowCustomEffect.previewFieldSlider(p.field, p.raw, p.isFloat);
                break;
            case 'customEffect.fieldSlider.commit':
                workflowCustomEffect.commitFieldSlider(p.field);
                break;
            case 'customEffect.fireworksStyle.change':
                workflowCustomEffect.setFireworksStyleEnabled(p.style, p.checked);
                break;
            case 'customEffect.fireworksText.add':
                workflowCustomEffect.addFireworksText(p.text);
                break;
            case 'customEffect.fireworksText.remove':
                workflowCustomEffect.removeFireworksText(p.index);
                break;
            case 'customEffect.lamp.add':
                workflowCustomEffect.addLamp();
                break;
            case 'customEffect.lamp.remove':
                workflowCustomEffect.removeLamp(p.index);
                break;
            case 'customEffect.lampSlider.input':
                workflowCustomEffect.previewLampSlider(p.index, p.key, p.raw);
                break;
            case 'customEffect.lampSlider.commit':
                workflowCustomEffect.commitLampSlider();
                break;
            case 'customEffect.close.click':
                workflowCustomEffect.close();
                break;
            default:
                console.warn(`[routerCustomEffect] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('customEffect', routerCustomEffect);
