/**
 * event/router/image-edit.js — Router tên "imageEdit", TÁCH RA từ event/router/file-manager-
 * photo.js (31/07/2026, yêu cầu Giang) — 3 msg.type riêng cho Edit mode, tách khỏi router
 * `fileManagerPhoto` để event/block.js khoá chéo Zoom view <-> Edit theo ĐÚNG msg.type (xem
 * event/block.js).
 *
 * NẠP SAU: event/bus.js, event/workflow/image-edit.js (workflowImageEdit),
 * event/workflow/file-manager-photo.js (workflowFileManagerPhoto — case 'toggle.click' nhánh thoát
 * gọi ngược sang đó).
 */
const routerImageEdit = (() => {
    function handle(msg) {
        switch (msg.type) {

            // Item "Edit"/"Thoát Edit" trong dropdown "..." (event/workflow/file-manager-photo.js::
            // openImageActionMenu()) — TOGGLE, đọc imagePreviewMode 1 lần, gộp vào `state` thành
            // boolean loại trừ nhau. Nhánh thoát gọi SANG router khác (workflowFileManagerPhoto —
            // nơi thật sự sở hữu vòng đời modal/Panzoom) — Workflow-gọi-Workflow tự do, boundary
            // theo trách nhiệm chứ không theo file (xem event-bus-flow.md mục 4B). event/block.js
            // chặn HẲN msg.type này khi đang Zoom mode (khoá chéo, 1 chiều).
            case 'imageEdit.toggle.click': {
                const isCurrentlyEditing = appState.get('imagePreviewMode') === 'edit';
                VirtualMachineState.run([
                    { state: isCurrentlyEditing, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.exitImagePreviewMode();
                    } },
                    { state: isCurrentlyEditing, operation: '===', value: false, callback: () => {
                        workflowImageEdit.enterEditMode();
                    } },
                ]);
                break;
            }

            // Bấm 1 tile trong lưới tool (Generic Drawer, workflowImageEdit::_buildEditToolGridHtml())
            // — openEditTool() tự phân luồng theo toolKey (Điều chỉnh/Crop/Vẽ/Text/Tách nền).
            case 'imageEdit.toolGrid.tile.click': {
                workflowImageEdit.openEditTool(msg.payload.tool);
                break;
            }

            // Nút `toolsBtn` ở header modal — mở LẠI lưới tool sau khi người dùng tự đóng Drawer
            // (nút X trên Drawer) mà không chọn tool nào. Đích cố định -> gọi thẳng Workflow, guard
            // clause nằm trong chính `openEditToolGrid()`.
            case 'imageEdit.tools.click': {
                workflowImageEdit.openEditToolGrid();
                break;
            }

            default:
                console.warn(`[router:imageEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('imageEdit', routerImageEdit);
