/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. CHỐT 03/07/2026 (mục 1a/3/7) — panel "Photo & Album" (gộp UI Ảnh + Album).
 *
 * Batch 3 (03/07/2026) — nội dung thật: story slider album + masonry ảnh, xem
 * core/file-manager/photo-ui.js + event/workflow/file-manager-photo.js.
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * 'open' ĐỔI TÊN 'openPanel.click'. Case 'close' ĐÃ XOÁ — đóng dùng CHUNG
 * 'settingsStackNav.back.click'. Case 'upload.click' ĐÃ XOÁ — nút trigger giờ click thẳng input
 * file panel-scoped NGAY TRONG listener (DOM proxy thuần, không cần round-trip qua router — xem
 * event/listener/file-manager-photo.js).
 *
 * ĐẬP ĐI LÀM LẠI (Giai đoạn 3b, rewrite Photo/Album, mục 3a/4, Giang yêu cầu) — XOÁ HẲN:
 *   - `album.storyClick`/`albumStory.prev.click`/`albumStory.next.click` (story slider ngang) —
 *     THAY bằng Album List sub-panel (`albumList.*` ngay dưới).
 *   - `album.manageClick` (thanh quản lý album inline) — 4 hành động của nó (thêm ảnh/đổi tên/xoá/
 *     [MỚI] xem) giờ SỐNG trong Album List sub-panel (`albumList.action.click`). "Dùng làm nền
 *     Slideshow" (`setSlideshowBg`) TẠM BỎ KHỎI 4 icon (Giang chỉ liệt kê đúng 4: xem/thêm/đổi tên/
 *     xoá) — core `setAsSlideshowBackground()` vẫn còn nguyên, CHƯA có UI gọi tới, cần Giang xác
 *     nhận chỗ đặt lại (coi như nợ kỹ thuật đã biết, không xoá core).
 *   - `imageSelectionMode`/`selectedImageKeys`/`imageSelection.cancel`/`imageSelection.confirm`
 *     (chọn nhiều NGAY TRONG lưới chính để thêm vào album) — KHÔNG còn ai kích hoạt (chỉ từng bật
 *     qua `manageClick` action='addImages' đã xoá) — THAY HẲN bằng `imagePicker.*` (Generic Drawer
 *     picker riêng, multi-select trong picker đó, KHÔNG đụng lưới ảnh chính nữa).
 *
 * STATE CONTEXT còn lại: `activeAlbumId` (album đang lọc lưới ảnh chính, null = "Tất cả").
 * MỚI (Giai đoạn 3b): `albumListPageIndex` (trang Album List sub-panel), `imagePickerAlbumId`/
 * `imagePickerSelectedKeys` (context của picker "thêm ảnh vào album" — Generic Drawer, KHÔNG phải
 * lưới chính).
 * MỚI (14/07/2026, mục cuối): `imageQuickDeleteMode` (chế độ xoá nhanh).
 * SỬA (Giai đoạn 3, redesign xoá nhanh) — `imageQuickDeleteMode` giờ CHỈ bật/tắt chế độ, KHÔNG còn
 * tự xoá ngay lúc bấm ảnh. `quickDeleteSelectedKeys` (Set closure, cùng khuôn `imagePickerSelectedKeys`)
 * — bấm ảnh chỉ TOGGLE vào/ra Set này (patch DOM, không refresh/không DB). Nút xoá nhanh ở header
 * dùng `VirtualMachineState.run()` 3 nhánh loại trừ nhau — tránh gọi `deleteImage()`/`refresh()`
 * lãng phí khi Set rỗng.
 * 2 chế độ khi bấm 1 ảnh trong lưới CHÍNH (`imageQuickDeleteMode`/bình thường) LOẠI TRỪ NHAU.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto),
 * core/settings-panel-stack.js (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    let activeAlbumId = null; // context state CỦA RIÊNG panel Photo — reset về null mỗi lần mở lại
    let imageQuickDeleteMode = false; // true = đang ở chế độ xoá nhanh (KHÔNG tự xoá ngay lúc bấm ảnh — xem quickDeleteSelectedKeys)
    let quickDeleteSelectedKeys = new Set(); // ảnh đã đánh dấu chờ xoá trong lưới chính

    let albumListPageIndex = 0; // MỚI (Giai đoạn 3b) — trang hiện tại của Album List sub-panel (mode 'list', core/pagination.js)

    // SỬA (Giai đoạn 4, rewrite Photo/Album, mục 4) — `imagePickerAlbumId`/`imagePickerSelectedKeys`
    // ĐÃ CHUYỂN vào Workflow (`_imagePickerSession`, event/workflow/file-manager-photo.js) — picker
    // giờ dùng CHUNG cho 2 chế độ (thêm ảnh vào album/chọn bìa bài hát, mục 4), "chế độ nào đang mở"
    // là "handle của UI đang mở" (cùng loại `fileManagerPhotoPanelEl`), không còn là "state nghiệp vụ
    // ảnh hưởng rẽ nhánh Router" thuần cho riêng album nữa — Router giờ CHỈ relay message, không giữ
    // state picker nào cả.

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.openPanel.click': {
                activeAlbumId = null; // luôn mở lại từ "Tất cả", không nhớ lọc phiên trước
                imageQuickDeleteMode = false;
                quickDeleteSelectedKeys = new Set();
                workflowFileManagerPhoto.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
                break;
            }

            // ===================== MỚI (Giai đoạn 3b) — bỏ lọc nhanh (chip ở panel Photo chính) ===

            case 'fileManagerPhoto.albumFilter.clear.click': {
                activeAlbumId = null;
                workflowFileManagerPhoto.refresh(activeAlbumId, imageQuickDeleteMode, quickDeleteSelectedKeys);
                break;
            }

            // ===================== MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — Album List
            // sub-panel (THAY HẲN story slider + thanh quản lý album cũ) =========================

            case 'fileManagerPhoto.albumList.open.click': {
                albumListPageIndex = 0; // mở lại luôn từ trang 1
                workflowFileManagerPhoto.openAlbumListPanel(); // >1 hàm core nối tiếp (push + đợi trượt + shield + đọc DB + vẽ) -> workflow
                break;
            }

            // Pagination mode 'list' (buildPaginationListHtml, core/pagination.js) — bấm THẲNG vào
            // số trang, KHÔNG có nút ‹ › (khác story pagination cũ, mode 'arrow').
            case 'fileManagerPhoto.albumList.page.click': {
                const { pageIndex } = msg.payload;
                albumListPageIndex = pageIndex;
                workflowFileManagerPhoto.refreshAlbumListPanel(albumListPageIndex); // đọc lại DB — số album nhỏ, rẻ, cùng tinh thần refreshSongTab()
                break;
            }

            case 'fileManagerPhoto.albumList.create.click': {
                workflowFileManagerPhoto.promptCreateAlbumFromList(albumListPageIndex); // >1 hàm core -> workflow
                break;
            }

            // ĐÃ GỠ (fix bug 2, Giang yêu cầu "ấn vào album lại ra sub panel -> bỏ") — case
            // 'fileManagerPhoto.albumList.rowClick' (bấm tên/số lượng -> lọc lưới ảnh chính + quay
            // lại panel Photo) XOÁ HẲN — vùng tên/số lượng KHÔNG còn bấm được nữa, xem
            // itemTemplateAlbumListRow() (components/items.js). ĐÍNH CHÍNH (17/07/2026, bỏ carousel
            // action 'view') — `activeAlbumId` giờ LẠI CÓ đường set khác null: action 'view' ngay
            // dưới (icon "..." -> "Xem") set nó rồi lọc lưới ảnh chính, KHÁC HẲN case rowClick đã xoá
            // ở trên (đây là hành động CHỦ Ý qua menu, không phải bấm nhầm ngay trên hàng album).

            // MỚI (Giang yêu cầu "action ba chấm dropdown, tái dùng như action song") — THAY 4 icon
            // rời cũ bằng 1 nút "..." mở dropdown (core/dropdown-menu.js). `anchorBtn` truyền qua
            // payload — ĐÚNG tiền lệ đã có (event/listener/playlist.js::'playlist.item.menuClick',
            // truyền `anchorBtn` y hệt cách này).
            case 'fileManagerPhoto.albumList.menu.click': {
                const { albumId, anchorBtn } = msg.payload;
                workflowFileManagerPhoto.openAlbumActionMenu(albumId, anchorBtn, albumListPageIndex); // dựng dropdown + wire callback -> workflow
                break;
            }

            // 4 hành động LOẠI TRỪ NHAU — ĐÍCH dispatch của dropdown ngay trên (mỗi mục dropdown tự
            // eventBus.send() case này, xem workflowFileManagerPhoto.openAlbumActionMenu()) — CHÍNH
            // case này KHÔNG đổi gì so với bản trước (chỉ đổi NƠI trigger từ 4 nút rời sang dropdown).
            case 'fileManagerPhoto.albumList.action.click': {
                const { action, albumId } = msg.payload;
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'view', callback: () => {
                        // SỬA (17/07/2026, bỏ carousel) — "xem" giờ lọc THẲNG lưới ảnh panel Photo
                        // chính theo album này (activeAlbumId là state CỦA RIÊNG Router, xem đầu
                        // file — Workflow không tự mutate được, phải set NGAY Ở ĐÂY trước khi gọi).
                        // Reset LUÔN imageQuickDeleteMode/quickDeleteSelectedKeys — refresh() bên
                        // trong viewAlbumImages() dùng tham số mặc định (false/Set rỗng, xem chữ ký
                        // refresh()); nếu KHÔNG reset ở đây, Router vẫn tưởng đang bật xoá nhanh
                        // (cờ closure cũ) trong khi lưới vừa vẽ lại KHÔNG hiện badge nào — bấm ảnh
                        // sẽ lặng lẽ đánh dấu xoá thay vì mở preview, lệch hẳn với UI đang thấy.
                        activeAlbumId = albumId;
                        imageQuickDeleteMode = false;
                        quickDeleteSelectedKeys = new Set();
                        workflowFileManagerPhoto.viewAlbumImages(activeAlbumId); // refresh panel Photo (đang ẩn dưới) + pop về đó -> workflow
                    } },
                    { state: action, operation: '===', value: 'addImages', callback: () => {
                        workflowFileManagerPhoto.openAlbumImagePicker(albumId, albumListPageIndex); // >1 hàm core (Generic Drawer + shield + đọc DB + windowing) -> workflow
                    } },
                    { state: action, operation: '===', value: 'rename', callback: () => {
                        workflowFileManagerPhoto.renameAlbumFromList(albumId, albumListPageIndex); // >1 hàm core -> workflow
                    } },
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        // onDeleted: reset activeAlbumId về null NGAY TẦNG NÀY nếu album vừa xoá
                        // đang là album đang lọc lưới chính — workflow không tự mutate được biến
                        // closure primitive của router (xem comment đầu file).
                        workflowFileManagerPhoto.deleteAlbumFromList(albumId, albumListPageIndex, () => {
                            if (activeAlbumId === albumId) activeAlbumId = null;
                        });
                    } },
                ]);
                break;
            }

            // ===================== MỚI (Giai đoạn 3b, mục 3a/4) — Picker "thêm ảnh vào album"
            // (Generic Drawer, multi-select) — event bus ĐẦY ĐỦ (listener -> đây -> workflow), KHÔNG
            // dùng raw callback như modal picker cover bài hát cũ (core/file-manager/photo-ui.js::
            // openPhotoUiImagePickerModal(), tiền lệ CŨ trước Rule 5a, không hồi tố nhưng KHÔNG lặp
            // lại cho code MỚI này — đúng yêu cầu Giang "đảm bảo event bus"). ==================

            case 'fileManagerPhoto.imagePicker.tile.click': {
                const { imageKey } = msg.payload;
                workflowFileManagerPhoto.handleImagePickerTileClick(imageKey); // Workflow tự branch theo _imagePickerSession.mode
                break;
            }

            case 'fileManagerPhoto.imagePicker.confirm.click': {
                workflowFileManagerPhoto.handleImagePickerConfirmClick();
                break;
            }

            case 'fileManagerPhoto.imagePicker.close.click': {
                workflowFileManagerPhoto.handleImagePickerCloseClick();
                break;
            }

            // ===================== Ảnh (lưới chính) =====================

            case 'fileManagerPhoto.image.click': {
                const { imageKey } = msg.payload;
                // SỬA (Giai đoạn 3b) — CHỈ còn 2 Ý NGHĨA loại trừ nhau (đã bỏ hẳn nhánh
                // imageSelectionMode — "thêm ảnh vào album" giờ là picker riêng, không đụng lưới
                // chính nữa): đánh dấu chờ xoá (xoá nhanh) / mở preview (bình thường).
                VirtualMachineState.run([
                    { state: imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.toggleQuickDeleteMarkInSet(imageKey, quickDeleteSelectedKeys); // mutate Set qua tham chiếu + patch DOM surgical, KHÔNG xoá/KHÔNG refresh
                    } },
                    { state: !imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.openImagePreview(imageKey, activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== Chế độ xoá nhanh =====================
            // VirtualMachineState 3 nhánh LOẠI TRỪ NHAU (Giang chỉ ra "tránh lãng phí khi không xoá
            // gì" — SỬA thêm sau: "tại sao phải có refresh?" — nhánh 1/2 KHÔNG đổi dữ liệu ảnh, chỉ
            // đổi UI):
            //   1. Chưa bật mode -> hỏi xác nhận, bật mode + Set rỗng -> CHỈ đổi UI nút/badge
            //      (updateQuickDeleteModeUI()), KHÔNG đọc lại DB/KHÔNG dựng lại lưới.
            //   2. Đang bật, CHƯA đánh dấu ảnh nào -> tắt mode NGAY -> CŨNG chỉ đổi UI, cùng lý do
            //      trên — KHÔNG gọi deleteImage() nào, KHÔNG refresh() nào.
            //   3. Đang bật, ĐÃ đánh dấu ≥1 ảnh -> hỏi xác nhận kèm số lượng -> xoá batch 1 lần —
            //      NHÁNH DUY NHẤT còn refresh() thật (bên trong confirmQuickDeleteBatch()), vì ảnh
            //      THẬT SỰ bị xoá khỏi DB, lưới bắt buộc phải đọc lại/dựng lại.

            case 'fileManagerPhoto.image.deleteMode.click': {
                VirtualMachineState.run([
                    { state: !imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.promptQuickDeleteMode(() => { // >1 hàm core (modal + cập nhật UI) -> workflow
                            imageQuickDeleteMode = true;
                            quickDeleteSelectedKeys = new Set();
                            // SỬA (Giang chỉ ra "tại sao phải có refresh?") — bật mode KHÔNG cần đọc
                            // lại DB/dựng lại lưới, dữ liệu ảnh không đổi — chỉ đổi màu nút + bật
                            // badge trên tile đang hiển thị.
                            workflowFileManagerPhoto.updateQuickDeleteModeUI(imageQuickDeleteMode, quickDeleteSelectedKeys);
                        });
                    } },
                    { state: (imageQuickDeleteMode && quickDeleteSelectedKeys.size === 0), operation: '===', value: true, callback: () => {
                        imageQuickDeleteMode = false;
                        // SỬA (Giang chỉ ra "tại sao phải có refresh?") — tắt mode (chưa đánh dấu gì)
                        // CŨNG không cần đọc lại DB/dựng lại lưới — cùng lý do nhánh trên.
                        workflowFileManagerPhoto.updateQuickDeleteModeUI(imageQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    { state: (imageQuickDeleteMode && quickDeleteSelectedKeys.size > 0), operation: '===', value: true, callback: () => {
                        // onConfirmed: Router KHÔNG tự đặt imageQuickDeleteMode=false NGAY ở đây —
                        // modalChoice() còn đang MỞ, user có thể Huỷ (khi đó mode PHẢI vẫn đang bật,
                        // UI vẫn đang hiện badge đỏ đúng thực tế) — Workflow tự gọi callback này ĐÚNG
                        // lúc xoá xong thật (bên trong onClick nút xác nhận), Router lúc đó mới đồng
                        // bộ biến của mình. NHÁNH NÀY VẪN GỌI refresh() THẬT (bên trong
                        // confirmQuickDeleteBatch()) — ảnh THẬT SỰ bị xoá khỏi DB, lưới bắt buộc phải
                        // đọc lại/dựng lại, khác 2 nhánh trên (chỉ đổi UI, không đổi dữ liệu).
                        workflowFileManagerPhoto.confirmQuickDeleteBatch(quickDeleteSelectedKeys, activeAlbumId, () => { imageQuickDeleteMode = false; }); // >1 hàm core (modal + shield + deleteImage*N + refresh) -> workflow
                    } },
                ]);
                break;
            }

            // ===================== Upload (Batch 3 — nút riêng của Photo drawer, CHƯA phải bộ
            // phân loại thông minh dùng chung với upload nhạc — đó là Batch 8 theo kế hoạch) =====

            case 'fileManagerPhoto.upload.change': {
                const { files } = msg.payload;
                workflowFileManagerPhoto.uploadImages(files, activeAlbumId); // >1 hàm core -> workflow
                break;
            }

            default:
                console.warn(`[router:fileManagerPhoto] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerPhoto', routerFileManagerPhoto);
