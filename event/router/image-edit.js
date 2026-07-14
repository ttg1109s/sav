/**
 * event/router/image-edit.js — Router "imageEdit", tự đăng ký với eventBus. Trang `image-edit.html`
 * DUY NHẤT dùng router này (KHÔNG nạp ở `index.html`) — cùng khuôn `event/router/subtitle-editor.js`.
 */
const routerImageEdit = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'imageEdit.back.click': { workflowImageEdit.handleBack(); break; }
            case 'imageEdit.save.click': { workflowImageEdit.handleSave(); break; }
            case 'imageEdit.crop.click': { workflowImageEdit.handleCrop(); break; }
            case 'imageEdit.rotateLeft.click': { workflowImageEdit.handleRotate(-90); break; }
            case 'imageEdit.rotateRight.click': { workflowImageEdit.handleRotate(90); break; }
            case 'imageEdit.flipH.click': { workflowImageEdit.handleFlipHorizontal(); break; }
            case 'imageEdit.flipV.click': { workflowImageEdit.handleFlipVertical(); break; }
            case 'imageEdit.grayscale.click': { workflowImageEdit.handleGrayscaleToggle(); break; }
            case 'imageEdit.reset.click': { workflowImageEdit.handleReset(); break; }
            case 'imageEdit.filter.change': { workflowImageEdit.handleSliderChange(); break; }

            default:
                console.warn(`[router:imageEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('imageEdit', routerImageEdit);
