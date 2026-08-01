/**
 * event/router/image-edit.js — Router tên "imageEdit". TOÀN BỘ msg.type liên quan Edit mode xử lý
 * Ở ĐÂY (kể cả khi nguồn bắn — dropdown "..." — nằm ở file khác thuộc miền `fileManagerPhoto`, xem
 * event/workflow/file-manager-photo.js::openImageActionMenu()) — biên giới theo TRÁCH NHIỆM
 * (routing của Edit mode) chứ không theo nơi UI đặt nút, "workflow xuyên miền gọi được" KHÔNG phải
 * lý do để giữ routing ở router khác.
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

            // MỚI (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow")
            // — nút X TRÊN CHÍNH Generic Drawer (header lưới tool, core/file-manager/photo-ui.js::
            // openPhotoEditToolGridDrawerUi()) — đóng hẳn Drawer, KHÔNG mở lại (khác `tools.click` ở
            // trên). Đích cố định, hạ tầng dùng chung nhiều domain -> gọi thẳng
            // `workflowGenericDrawerHelpers` (event/workflow/generic-drawer-helpers.js).
            case 'imageEdit.toolGrid.close.click': {
                workflowGenericDrawerHelpers.closeFully();
                break;
            }

            // MỚI (31/07/2026, Giang chỉ ra vi phạm Rule 5a) — `contextCancelBtn`/`contextApplyBtn`/
            // `adjustDoneBtn`/`drawBrushBtn`/`drawEraserBtn` (core/file-manager/photo-ui.js) TRƯỚC
            // ĐÂY bị workflowImageEdit tự gán LẠI `.onclick` mỗi lần đổi sub-tool — SAI Rule 5a (nội
            // dung callback KHÔNG qua eventBus, VÀ không "gom cuối hàm" — rải ở 4 hàm
            // `_startXxxTool()` khác nhau). Giờ 5 nút wire ĐÚNG 1 LẦN ở photo-ui.js, msg.type CỐ
            // ĐỊNH — 5 case dưới đây thay cho việc "nút tự đổi nghĩa theo tool đang mở".

            // Huỷ sub-tool (Crop/Vẽ/Text/Tách nền) — hành vi GIỐNG HỆT bất kể tool nào đang mở, gọi
            // thẳng, KHÔNG cần VirtualMachineState phân theo `_activeSubTool`.
            case 'imageEdit.subTool.cancel.click': {
                workflowImageEdit.exitSubTool();
                break;
            }

            // Áp dụng sub-tool — hành vi KHÁC NHAU theo tool đang mở (Magic không có nút này, tự ẩn
            // `contextApplyBtn`) — Router tự đọc `getActiveSubTool()` rồi CHỌN đúng hàm (Rule 1: nơi
            // gọi chọn hàm, không phải nút tự đổi nghĩa/core tự rẽ nhánh).
            case 'imageEdit.subTool.apply.click': {
                const activeSubTool = workflowImageEdit.getActiveSubTool();
                VirtualMachineState.run([
                    { state: activeSubTool, operation: '===', value: 'crop', callback: () => {
                        workflowImageEdit.applyCropTool();
                    } },
                    { state: activeSubTool, operation: '===', value: 'draw', callback: () => {
                        workflowImageEdit.applyDrawTool();
                    } },
                    { state: activeSubTool, operation: '===', value: 'text', callback: () => {
                        workflowImageEdit.applyTextTool();
                    } },
                ]);
                break;
            }

            // Nút "xong" popup Điều chỉnh — hành vi GIỐNG HỆT bất kể param nào đang mở.
            case 'imageEdit.adjust.done.click': {
                workflowImageEdit.exitAdjustTool();
                break;
            }

            // Toggle Cọ/Tẩy trong popup tool Vẽ.
            case 'imageEdit.draw.selectBrush.click': {
                workflowImageEdit.selectDrawBrush();
                break;
            }
            case 'imageEdit.draw.selectEraser.click': {
                workflowImageEdit.selectDrawEraser();
                break;
            }

            // MỚI (31/07/2026, Giang chỉ ra "đừng viện dẫn workflow xuyên miền để biện minh giữ
            // routing sai chỗ") — "Lưu đè"/"Lưu mới" (dropdown "...", event/workflow/file-manager-
            // photo.js::openImageActionMenu()) TRƯỚC ĐÂY bắn qua msg.type dùng CHUNG
            // 'fileManagerPhoto.imageMenu.action.click' (router `fileManagerPhoto`) rồi mới gọi
            // CHÉO sang workflowImageEdit — ĐÚNG là Workflow-gọi-Workflow được phép, NHƯNG bản thân
            // việc ROUTING (nơi msg.type này được xử lý) vẫn là trách nhiệm của miền Edit, không
            // phải chỉ vì "gọi chéo được" mà biện minh cho việc giữ routing ở router khác — tách
            // hẳn msg.type RIÊNG, xử lý ĐÚNG ở router này.
            case 'imageEdit.saveOverwrite.click': {
                workflowImageEdit.saveEditOverwrite();
                break;
            }
            case 'imageEdit.saveAsNew.click': {
                workflowImageEdit.saveEditAsNew();
                break;
            }

            // MỚI (31/07/2026, Giang chỉ ra "Nhóm B không có ngoại lệ trong tài liệu — Rule 5a
            // không phân biệt theo loại/tần suất event") — pointer Crop/Vẽ/Tách nền
            // (`interactCanvas`) + kéo Text (`floatingText`/`document`) + 2 slider (Điều chỉnh/dung
            // sai Tách nền) TRƯỚC ĐÂY Workflow tự `addEventListener`/`removeEventListener` theo
            // vòng đời từng sub-tool. Core (`interactCanvas`/`floatingText`/2 slider` — DOM ĐỘNG,
            // photo-ui.js) + Listener (`document` — DOM TĨNH, event/listener/image-edit.js) giờ wire
            // VĨNH VIỄN 1 lần, bắn eventBus BẤT KỂ tool nào đang mở — Router tự đọc
            // `getActiveSubTool()` mỗi lần nhận để CHỌN đúng hàm (kể cả không chọn hàm nào nếu
            // 'none'/tool không liên quan — VirtualMachineState không khớp rule nào, an toàn).

            case 'imageEdit.interactCanvas.pointerDown': {
                const activeSubTool = workflowImageEdit.getActiveSubTool();
                VirtualMachineState.run([
                    { state: activeSubTool, operation: '===', value: 'crop', callback: () => {
                        workflowImageEdit.cropPointerDown(msg.payload);
                    } },
                    { state: activeSubTool, operation: '===', value: 'draw', callback: () => {
                        workflowImageEdit.drawPointerDown(msg.payload);
                    } },
                    { state: activeSubTool, operation: '===', value: 'magic', callback: () => {
                        workflowImageEdit.magicPointerDown(msg.payload);
                    } },
                ]);
                break;
            }
            case 'imageEdit.interactCanvas.pointerMove': {
                const activeSubTool = workflowImageEdit.getActiveSubTool();
                VirtualMachineState.run([
                    { state: activeSubTool, operation: '===', value: 'crop', callback: () => {
                        workflowImageEdit.cropPointerMove(msg.payload);
                    } },
                    { state: activeSubTool, operation: '===', value: 'draw', callback: () => {
                        workflowImageEdit.drawPointerMove(msg.payload);
                    } },
                    // Tách nền KHÔNG cần theo dõi pointermove (chỉ 1 điểm chạm là đủ, xem
                    // magicPointerDown()) — KHÔNG có rule 'magic' ở đây, cố ý.
                ]);
                break;
            }
            case 'imageEdit.interactCanvas.pointerUp': {
                const activeSubTool = workflowImageEdit.getActiveSubTool();
                VirtualMachineState.run([
                    { state: activeSubTool, operation: '===', value: 'crop', callback: () => {
                        workflowImageEdit.cropPointerUp();
                    } },
                    { state: activeSubTool, operation: '===', value: 'draw', callback: () => {
                        workflowImageEdit.drawPointerUp();
                    } },
                ]);
                break;
            }

            // Đích CỐ ĐỊNH (không phân theo `_activeSubTool` — chính 3 hàm này tự guard bằng
            // `_activeSubTool`/`_textDragging` bên trong, xem docstring từng hàm,
            // event/workflow/image-edit.js). `pointerMove`/`pointerUp` bắn TỪ `document` TOÀN APP,
            // không chỉ lúc Photo Edit mở — 2 hàm Workflow tương ứng return sớm gần như luôn luôn.
            case 'imageEdit.floatingText.pointerDown': {
                workflowImageEdit.startTextDrag();
                break;
            }
            case 'imageEdit.floatingText.pointerMove': {
                workflowImageEdit.updateTextDrag(msg.payload.x, msg.payload.y);
                break;
            }
            case 'imageEdit.floatingText.pointerUp': {
                workflowImageEdit.endTextDrag();
                break;
            }

            case 'imageEdit.adjust.slider.input': {
                workflowImageEdit.updateAdjustSlider(msg.payload.value);
                break;
            }
            case 'imageEdit.magic.slider.input': {
                workflowImageEdit.updateMagicSlider(msg.payload.value);
                break;
            }

            default:
                console.warn(`[router:imageEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('imageEdit', routerImageEdit);
