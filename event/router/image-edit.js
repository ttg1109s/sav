/**
 * event/router/image-edit.js — Router tên "imageEdit". TOÀN BỘ msg.type liên quan Edit mode xử lý
 * Ở ĐÂY — biên giới theo TRÁCH NHIỆM (routing của Edit mode), không theo nơi UI đặt nút.
 *
 * KHÔNG có khái niệm "mode" nào cần thoát — View/Zoom/Edit tích hợp sẵn (xem docstring đầu
 * event/workflow/image-edit.js). Đóng Generic Drawer lưới tool (case 'imageEdit.toolGrid.
 * close.click') CHỈ đóng Drawer, KHÔNG gọi gì tới `exitEditMode()`.
 *
 * NẠP SAU: event/bus.js, event/workflow/image-edit.js (workflowImageEdit),
 * event/workflow/file-manager-photo.js (workflowFileManagerPhoto — case 'save.click' gọi ngược
 * sang miền đó qua workflowImageEdit.openSaveMenu(), Workflow-gọi-Workflow tự do).
 */
const routerImageEdit = (() => {
    function handle(msg) {
        switch (msg.type) {

            // Icon Edit (bút chì) cố định trên header modal xem ảnh (core/file-manager/photo-ui.js)
            // — Router tự đọc `isEditModeActive()` để chọn: CHƯA editing -> vào lần đầu
            // (`enterEditMode()`, decode canvas + ẩn <img>); ĐÃ editing -> chỉ mở lại lưới tool
            // (`openEditToolGrid()`, vd sau khi tự đóng Drawer bằng nút X).
            case 'imageEdit.tools.click': {
                const isEditing = workflowImageEdit.isEditModeActive();
                VirtualMachineState.run([
                    { state: isEditing, operation: '===', value: false, callback: () => {
                        workflowImageEdit.enterEditMode();
                    } },
                    { state: isEditing, operation: '===', value: true, callback: () => {
                        workflowImageEdit.openEditToolGrid();
                    } },
                ]);
                break;
            }

            // Icon Save cố định trên header modal xem ảnh — mở dropdown 2 lựa chọn (Ghi đè/Lưu
            // mới). Đích cố định -> gọi thẳng Workflow, guard/ensure-decoded nằm trong chính
            // `openSaveMenu()`.
            case 'imageEdit.save.click': {
                workflowImageEdit.openSaveMenu(msg.payload.anchorEl);
                break;
            }

            // Bấm 1 tile trong lưới tool (Generic Drawer, workflowImageEdit::_buildEditToolGridHtml())
            // — openEditTool() tự phân luồng theo toolKey (Điều chỉnh/Crop/Vẽ/Text/Tách nền).
            case 'imageEdit.toolGrid.tile.click': {
                workflowImageEdit.openEditTool(msg.payload.tool);
                break;
            }

            // Nút tỉ lệ trong cropRatioPopup (MỚI) — Đích cố định, guard nằm trong chính hàm.
            case 'imageEdit.crop.setRatio.click': {
                workflowImageEdit.setCropAspectRatio(msg.payload.ratio);
                break;
            }

            // Nút X TRÊN CHÍNH Generic Drawer (header lưới tool, core/file-manager/photo-ui.js::
            // openPhotoEditToolGridDrawerUi()) — CHỈ đóng Drawer (KHÔNG mode nào để thoát — canvas
            // vẫn hiện nguyên, bấm lại icon Edit trên header là mở lại lưới). Đích cố định, hạ tầng
            // dùng chung nhiều domain -> gọi thẳng `workflowGenericDrawerHelpers` (event/workflow/
            // generic-drawer-helpers.js).
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

            // Đích dispatch của dropdown Save (icon Save trên header, `openSaveMenu()`) — mỗi
            // msg.type mô tả ĐÚNG 1 lựa chọn, routing thuộc miền Edit (nơi 2 hàm này sống thật).
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
            // VĨNH VIỄN 1 lần, bắn eventBus BẤT KỂ tool nào đang mở.
            // SỬA (31/07/2026, phát hiện lúc rà chi phí hiệu năng) — 3 case dưới đây CỐ Ý dùng
            // `switch` THƯỜNG thay vì `VirtualMachineState.run()`: `run()` coi "0 rule khớp" là BẤT
            // THƯỜNG, tự `console.warn()` (xem event/virtual-machine-state.js::run()) — ĐÚNG cho
            // dispatch business luôn phải khớp 1 nhánh, nhưng SAI CHỖ ở đây — "không tool nào liên
            // quan đang mở" là trạng thái BÌNH THƯỜNG, XẢY RA LIÊN TỤC (rê chuột qua ảnh lúc đang mở
            // lưới tool/Text/Magic) — dùng `run()` sẽ SPAM console mỗi lần đó, tốn thật (serialize
            // object để DevTools hiển thị), không phải lý thuyết.

            case 'imageEdit.interactCanvas.pointerDown': {
                switch (workflowImageEdit.getActiveSubTool()) {
                    case 'crop': workflowImageEdit.cropPointerDown(msg.payload); break;
                    case 'draw': workflowImageEdit.drawPointerDown(msg.payload); break;
                    case 'magic': workflowImageEdit.magicPointerDown(msg.payload); break;
                    // 'none'/'text' -> không làm gì, KHÔNG cảnh báo (bình thường).
                }
                break;
            }
            case 'imageEdit.interactCanvas.pointerMove': {
                switch (workflowImageEdit.getActiveSubTool()) {
                    case 'crop': workflowImageEdit.cropPointerMove(msg.payload); break;
                    case 'draw': workflowImageEdit.drawPointerMove(msg.payload); break;
                    // 'magic' KHÔNG cần theo dõi pointermove (chỉ 1 điểm chạm là đủ, xem
                    // magicPointerDown()) — cố ý không có case.
                }
                break;
            }
            case 'imageEdit.interactCanvas.pointerUp': {
                switch (workflowImageEdit.getActiveSubTool()) {
                    case 'crop': workflowImageEdit.cropPointerUp(); break;
                    case 'draw': workflowImageEdit.drawPointerUp(); break;
                }
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
