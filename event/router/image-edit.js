/**
 * event/router/image-edit.js — Router "imageEdit": mọi thao tác của trình sửa ảnh Photo (event/workflow/image-edit.js).
 * Không có "mode" sửa — canvas sẵn sàng từ lúc mở modal; đóng Drawer lưới công cụ chỉ đóng Drawer.
 *
 * Chạm canvas tương tác (`interactCanvas.*`) rẽ theo công cụ đang mở bằng `switch` thường, không VirtualMachineState:
 * "không công cụ nào liên quan đang mở" là trạng thái bình thường, xảy ra liên tục (rê chuột qua ảnh) — `run()` sẽ
 * `console.warn` mỗi lần không rule nào khớp. 'none' = chọn/kéo layer.
 *
 * NẠP SAU: event/bus.js, event/workflow/image-edit.js.
 */
const routerImageEdit = (() => {
    function handle(msg) {
        switch (msg.type) {
            // Header modal ảnh: Edit (lưới công cụ), Layer (danh sách layer — Block gate khi Drawer khác đang mở), Lưu.
            case 'imageEdit.tools.click': { workflowImageEdit.openEditToolGrid(); break; }
            case 'imageEdit.layers.click': { workflowImageEdit.openLayerPanel(); break; }
            case 'imageEdit.save.click': { workflowImageEdit.openSaveMenu(msg.payload.anchorEl); break; }
            case 'imageEdit.saveOverwrite.click': { workflowImageEdit.saveEditOverwrite(); break; }
            case 'imageEdit.saveAsNew.click': { workflowImageEdit.saveEditAsNew(); break; }

            // Lưới công cụ (Generic Drawer).
            case 'imageEdit.toolGrid.tile.click': { workflowImageEdit.openEditTool(msg.payload.tool); break; }
            case 'imageEdit.toolGrid.close.click': { workflowGenericDrawerHelpers.closeFully(); break; }

            // Popup của từng công cụ.
            case 'imageEdit.adjust.slider.input': { workflowImageEdit.updateAdjustSlider(msg.payload.value); break; }
            case 'imageEdit.adjust.done.click': { workflowImageEdit.exitAdjustTool(); break; }
            case 'imageEdit.crop.setRatio.click': { workflowImageEdit.setCropAspectRatio(msg.payload.ratio); break; }
            case 'imageEdit.draw.selectBrush.click': { workflowImageEdit.selectDrawBrush(); break; }
            case 'imageEdit.draw.selectEraser.click': { workflowImageEdit.selectDrawEraser(); break; }
            case 'imageEdit.shapeType.select.click': { workflowImageEdit.selectShapeType(msg.payload.shapeType); break; }
            case 'imageEdit.transform.action.click': { workflowImageEdit.applyTransformAction(msg.payload.action); break; }

            // Thanh Huỷ/Áp dụng. Huỷ giống nhau mọi công cụ (hoàn tác riêng nằm trong Workflow); Áp dụng rẽ theo công cụ.
            case 'imageEdit.subTool.cancel.click': { workflowImageEdit.exitSubTool(); break; }
            case 'imageEdit.subTool.apply.click': {
                const activeSubTool = workflowImageEdit.getActiveSubTool();
                VirtualMachineState.run([
                    { state: activeSubTool, operation: '===', value: 'crop', callback: () => workflowImageEdit.applyCropTool() },
                    { state: activeSubTool, operation: '===', value: 'draw', callback: () => workflowImageEdit.applyDrawTool() },
                    { state: activeSubTool, operation: '===', value: 'text', callback: () => workflowImageEdit.applyTextTool() },
                    { state: activeSubTool, operation: '===', value: 'shapePlacement', callback: () => workflowImageEdit.applyShapePlacement() },
                    { state: activeSubTool, operation: '===', value: 'transform', callback: () => workflowImageEdit.applyTransform() },
                ]);
                break;
            }

            case 'imageEdit.interactCanvas.pointerDown': {
                switch (workflowImageEdit.getActiveSubTool()) {
                    case 'crop': case 'shapePlacement': workflowImageEdit.cropPointerDown(msg.payload); break;
                    case 'draw': workflowImageEdit.drawPointerDown(msg.payload); break;
                    case 'transform': workflowImageEdit.transformPointerDown(msg.payload); break;
                    case 'none': workflowImageEdit.layerPointerDown(msg.payload); break;
                    // 'text' -> không làm gì
                }
                break;
            }
            case 'imageEdit.interactCanvas.pointerMove': {
                switch (workflowImageEdit.getActiveSubTool()) {
                    case 'crop': case 'shapePlacement': workflowImageEdit.cropPointerMove(msg.payload); break;
                    case 'draw': workflowImageEdit.drawPointerMove(msg.payload); break;
                    case 'transform': workflowImageEdit.transformPointerMove(msg.payload); break;
                    case 'none': workflowImageEdit.layerPointerMove(msg.payload); break;
                }
                break;
            }
            case 'imageEdit.interactCanvas.pointerUp': {
                switch (workflowImageEdit.getActiveSubTool()) {
                    case 'crop': case 'shapePlacement': workflowImageEdit.cropPointerUp(); break;
                    case 'draw': workflowImageEdit.drawPointerUp(); break;
                    case 'transform': workflowImageEdit.transformPointerUp(); break;
                    case 'none': workflowImageEdit.layerPointerUp(); break;
                }
                break;
            }

            // Khung chữ nổi (tool Text): kéo bằng tay nắm (con trỏ được giữ trên tay nắm), ô nhập cao theo số dòng.
            case 'imageEdit.floatingText.grip.pointerDown': { workflowImageEdit.startTextDrag(msg.payload); break; }
            case 'imageEdit.floatingText.grip.pointerMove': { workflowImageEdit.updateTextDrag(msg.payload); break; }
            case 'imageEdit.floatingText.grip.pointerUp': { workflowImageEdit.endTextDrag(); break; }
            case 'imageEdit.floatingText.input': { workflowImageEdit.fitFloatingText(); break; }

            // Menu long-press trên 1 layer.
            case 'imageEdit.layerMenu.editContent.click': { workflowImageEdit.editLayerTextContent(msg.payload.id); break; }
            case 'imageEdit.layerMenu.editStyle.click': { workflowImageEdit.openLayerStyleEditor(msg.payload.id); break; }
            case 'imageEdit.layerMenu.transform.click': { workflowImageEdit.startLayerTransform(msg.payload.id, 'none'); break; }
            case 'imageEdit.layerMenu.duplicate.click': { workflowImageEdit.duplicateLayer(msg.payload.id); break; }
            case 'imageEdit.layerMenu.delete.click': { workflowImageEdit.deleteLayer(msg.payload.id); break; }
            case 'imageEdit.layerContent.save.click': { workflowImageEdit.saveLayerTextContent(msg.payload.id, msg.payload.value); break; }

            // Danh sách Layer (Generic Drawer — event/listener/image-edit.js).
            case 'imageEdit.layerPanel.close.click': { workflowImageEdit.closeLayerPanel(); break; }
            case 'imageEdit.layerPanel.visible.click': { workflowImageEdit.toggleLayerVisible(msg.payload.id); break; }
            case 'imageEdit.layerPanel.transform.click': { workflowImageEdit.startLayerTransform(msg.payload.id, 'layerPanel'); break; }
            case 'imageEdit.layerPanel.delete.click': { workflowImageEdit.deleteLayer(msg.payload.id); break; }
            case 'imageEdit.layerPanel.opacity.input': { workflowImageEdit.setLayerOpacity(msg.payload.id, msg.payload.value); break; }
            case 'imageEdit.layerPanel.drag.start': { workflowImageEdit.startLayerPanelDrag(msg.payload); break; }
            case 'imageEdit.layerPanel.drag.move': { workflowImageEdit.moveLayerPanelDrag(msg.payload.clientY); break; }
            case 'imageEdit.layerPanel.drag.end': { workflowImageEdit.endLayerPanelDrag(); break; }

            default:
                console.warn(`[router:imageEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('imageEdit', routerImageEdit);
