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
 *     picker riêng, KHÔNG đụng lưới ảnh chính nữa).
 *
 * SỬA TIẾP (17/07/2026, phản hồi Giang) — 4 THAY ĐỔI CÙNG ĐỢT:
 *   1. Nút "Tải ảnh lên" ở header panel Photo, khi đang lọc theo 1 album, giờ TỰ thêm ảnh vừa tải
 *      vào ĐÚNG album đó (xem `workflowFileManagerPhoto.uploadImages()`) — XOÁ HẲN action
 *      "addImages" (dropdown) + picker Generic Drawer multi-select liên quan (`openAlbumImagePicker`,
 *      case `imagePicker.confirm.click`, nhánh `multiSelectAlbum` trong `_imagePickerSession`) —
 *      picker ảnh CÒN đúng 1 chế độ (chọn 1 ảnh, dùng cho "Ảnh bìa" bài hát + Theme Background).
 *      **MỤC NÀY ĐẢO NGƯỢC 1 PHẦN NGAY HÔM SAU, xem mục 5.**
 *   2. Case MỚI `albumList.row.click` — bấm THẲNG vào hàng album (không qua dropdown) lọc lưới ảnh
 *      chính + lùi về panel Photo NGAY — action "view" trong dropdown ĐÃ XOÁ (dư thừa, cùng 1 hành
 *      vi). Dropdown giờ CHỈ CÒN "Đổi tên"/"Xoá".
 *   3. `back()` DÙNG CHUNG (event/workflow/settings-stack-nav.js) giờ tự kiểm tra "đang đứng đúng
 *      panel Photo + đang lọc theo album" (qua `getActiveAlbumId()` ngay dưới) TRƯỚC khi pop — nếu
 *      đúng, bỏ lọc (`clearActiveAlbumFilter()`) thay vì pop hẳn ra Settings Main.
 *   4. Xoá 1 album đang là album ĐANG LỌC lưới chính -> tự bỏ lọc + vẽ lại NGAY (Tất cả) — dùng
 *      chung `clearActiveAlbumFilter()` (case 'delete' bên dưới).
 *
 * SỬA TIẾP (18/07/2026, phản hồi Giang — "khôi phục add photo vào album, bấm + ra 2 lựa chọn"):
 *   5. Nút "+" (upload) ở header panel Photo KHÔNG còn LUÔN mở thẳng hộp thoại chọn file nữa — khi
 *      đang lọc theo 1 album (`activeAlbumId` khác null), giờ mở dropdown 2 lựa chọn ("Tải ảnh lên"
 *      / "Chọn ảnh có sẵn") — case MỚI `uploadTrigger.click` (đọc `activeAlbumId` quyết định) +
 *      `addPhotoChoice.click` (đích dispatch của dropdown). "Chọn ảnh có sẵn" RESTORE LẠI picker
 *      Generic Drawer multi-select + case `imagePicker.confirm.click` (mục 1 ở trên đã xoá) —
 *      `openAlbumImagePicker()` giờ gọi từ đây (KHÔNG còn từ dropdown Album List như bản GỐC trước
 *      17/07/2026, xem docstring hàm đó). "Tải ảnh lên" vẫn dùng ĐÚNG `triggerUploadInput()` +
 *      `uploadImages()` cũ (mục 1) — hành vi upload KHÔNG đổi gì, chỉ đổi CÁCH BẤM TỚI nó khi đang
 *      lọc theo album. KHÔNG đang lọc -> nút "+" vẫn mở thẳng hộp thoại chọn file như trước giờ.
 *
 * STATE CONTEXT còn lại: `activeAlbumId` (album đang lọc lưới ảnh chính, null = "Tất cả") — lộ CHỈ
 * ĐỌC ra ngoài qua `getActiveAlbumId()`, GHI qua `clearActiveAlbumFilter()` hoặc message của chính
 * router này (xem 2 hàm ngay dưới `let` — dùng bởi `workflowSettingsStackNav.back()`, miền khác).
 * MỚI (Giai đoạn 3b): `albumListPageIndex` (trang Album List sub-panel).
 * MỚI (14/07/2026, mục cuối): `imageQuickDeleteMode` (chế độ xoá nhanh).
 * SỬA (Giai đoạn 3, redesign xoá nhanh) — `imageQuickDeleteMode` giờ CHỈ bật/tắt chế độ, KHÔNG còn
 * tự xoá ngay lúc bấm ảnh. `quickDeleteSelectedKeys` (Set closure) — bấm ảnh chỉ TOGGLE vào/ra Set
 * này (patch DOM, không refresh/không DB). Nút xoá nhanh ở header dùng `VirtualMachineState.run()`
 * 3 nhánh loại trừ nhau — tránh gọi `deleteImage()`/`refresh()` lãng phí khi Set rỗng.
 * 2 chế độ khi bấm 1 ảnh trong lưới CHÍNH (`imageQuickDeleteMode`/bình thường) LOẠI TRỪ NHAU.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto),
 * core/settings-panel-stack-ui.js (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js. `getActiveAlbumId()`/`clearActiveAlbumFilter()`
 * chỉ resolve LÚC `workflowSettingsStackNav.back()` THẬT SỰ chạy (bấm Back) — không cần nạp trước
 * event/workflow/settings-stack-nav.js, cùng quy ước lazy-reference đã có ở file đó.
 */
const routerFileManagerPhoto = (() => {
    let activeAlbumId = null; // context state CỦA RIÊNG panel Photo — reset về null mỗi lần mở lại
    let imageQuickDeleteMode = false; // true = đang ở chế độ xoá nhanh (KHÔNG tự xoá ngay lúc bấm ảnh — xem quickDeleteSelectedKeys)
    let quickDeleteSelectedKeys = new Set(); // ảnh đã đánh dấu chờ xoá trong lưới chính

    let albumListPageIndex = 0; // MỚI (Giai đoạn 3b) — trang hiện tại của Album List sub-panel (mode 'list', core/pagination.js)

    // `imagePickerAlbumId`/`imagePickerSelectedKeys` cũ (context picker "thêm ảnh vào album") ĐÃ
    // CHUYỂN vào Workflow từ Giai đoạn 4 (`_imagePickerSession`, event/workflow/file-manager-
    // photo.js) — Router giờ CHỈ relay message, không giữ state picker nào cả. 17/07/2026 từng xoá
    // hẳn chế độ multi-select đó, 18/07/2026 Giang yêu cầu khôi phục lại (xem mục 5, đầu file).

    /** MỚI (17/07/2026, Giang yêu cầu) — bỏ lọc album đang xem + vẽ lại lưới ảnh chính (Tất cả).
     * DÙNG CHUNG cho 3 nơi cần "bỏ lọc": chip "bỏ lọc" (case ngay dưới), Back khi đang lọc
     * (event/workflow/settings-stack-nav.js::back(), qua `getActiveAlbumId()` ngay dưới + kiểm tra
     * đang đứng đúng panel Photo), và khi CHÍNH album đang lọc bị xoá (case 'delete' bên dưới) —
     * gộp lại tránh lặp `activeAlbumId = null` + `refresh()` ở nhiều nơi. GIỮ NGUYÊN
     * `imageQuickDeleteMode`/`quickDeleteSelectedKeys` hiện tại (không reset) — đúng hành vi cũ của
     * chip "bỏ lọc". */
    function clearActiveAlbumFilter() {
        activeAlbumId = null;
        workflowFileManagerPhoto.refresh(activeAlbumId, imageQuickDeleteMode, quickDeleteSelectedKeys);
    }

    /** MỚI (17/07/2026, Giang yêu cầu) — lộ `activeAlbumId` ra ngoài (CHỈ ĐỌC) cho
     * `workflowSettingsStackNav.back()` kiểm tra "đang lọc theo album không" TRƯỚC khi quyết định
     * pop hẳn panel hay chỉ bỏ lọc (xem event/workflow/settings-stack-nav.js). KHÔNG đổi tinh thần
     * "activeAlbumId là state RIÊNG của Router" — đây chỉ là 1 khe ĐỌC hẹp, GHI vẫn phải qua
     * `clearActiveAlbumFilter()` ở trên hoặc qua chính message của router này. */
    function getActiveAlbumId() { return activeAlbumId; }

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
                clearActiveAlbumFilter();
                break;
            }

            // ===================== MỚI (17/07/2026, Giang yêu cầu "bấm vào album để view luôn ảnh")
            // — bấm THẲNG vào hàng album (KHÔNG phải nút "...") trong Album List sub-panel -> lọc
            // NGAY lưới ảnh chính theo album đó + lùi về panel Photo. THAY cho action "view" trong
            // dropdown (đã xoá, xem openAlbumActionMenu() — event/workflow/file-manager-photo.js).
            // Cùng logic hệt action 'view' cũ (xem lịch sử trong workflowFileManagerPhoto.viewAlbumImages()).

            case 'fileManagerPhoto.albumList.row.click': {
                const { albumId } = msg.payload;
                activeAlbumId = albumId;
                imageQuickDeleteMode = false;
                quickDeleteSelectedKeys = new Set();
                workflowFileManagerPhoto.viewAlbumImages(activeAlbumId); // refresh panel Photo (đang ẩn dưới) + pop về đó -> workflow
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

            // LỊCH SỬ (chỉ để đối chiếu, KHÔNG còn đúng hiện trạng — xem case 'albumList.row.click'
            // Ở TRÊN thay vào chỗ này): "fix bug 2" (Giang yêu cầu "ấn vào album lại ra sub panel ->
            // bỏ") từng xoá hẳn hành vi bấm-hàng-để-lọc — 17/07/2026 Giang yêu cầu THÊM LẠI đúng hành
            // vi đó (qua case 'albumList.row.click'), lần này CHỦ Ý, không phải bug.

            // MỚI (Giang yêu cầu "action ba chấm dropdown, tái dùng như action song") — THAY 4 icon
            // rời cũ bằng 1 nút "..." mở dropdown (core/dropdown-menu.js). `anchorBtn` truyền qua
            // payload — ĐÚNG tiền lệ đã có (event/listener/playlist.js::'playlist.item.menuClick',
            // truyền `anchorBtn` y hệt cách này).
            case 'fileManagerPhoto.albumList.menu.click': {
                const { albumId, anchorBtn } = msg.payload;
                workflowFileManagerPhoto.openAlbumActionMenu(albumId, anchorBtn, albumListPageIndex); // dựng dropdown + wire callback -> workflow
                break;
            }

            // SỬA (17/07/2026, phản hồi Giang) — dropdown CHỈ CÒN 2 hành động (rename/delete):
            //   - 'view' XOÁ khỏi đây — bấm hàng đã làm việc này rồi (case 'albumList.row.click' ở
            //     trên), giữ 2 đường vào cho CÙNG 1 hành động là dư thừa.
            //   - 'addImages' XOÁ HẲN — nút "Tải ảnh lên" ở header panel Photo giờ TỰ thêm ảnh vừa
            //     tải vào album đang lọc (nếu có), xem workflowFileManagerPhoto.uploadImages() —
            //     không cần picker "thêm ảnh có sẵn" riêng nữa.
            case 'fileManagerPhoto.albumList.action.click': {
                const { action, albumId } = msg.payload;
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'rename', callback: () => {
                        workflowFileManagerPhoto.renameAlbumFromList(albumId, albumListPageIndex); // >1 hàm core -> workflow
                    } },
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        // onDeleted: nếu album vừa xoá đang là album đang lọc lưới chính -> bỏ lọc +
                        // vẽ lại lưới (Tất cả) NGAY (MỚI 17/07/2026, Giang yêu cầu "back về Album List
                        // phải render lại all photo") — dùng chung clearActiveAlbumFilter() (đầu file),
                        // workflow không tự mutate được biến closure primitive của router.
                        workflowFileManagerPhoto.deleteAlbumFromList(albumId, albumListPageIndex, () => {
                            if (activeAlbumId === albumId) clearActiveAlbumFilter();
                        });
                    } },
                ]);
                break;
            }

            // ===================== Picker ảnh (Generic Drawer) — event bus ĐẦY ĐỦ (listener -> đây
            // -> workflow), KHÔNG dùng raw callback như modal picker cover bài hát cũ (core/file-
            // manager/photo-ui.js::openPhotoUiImagePickerModal(), tiền lệ CŨ trước Rule 5a, không
            // hồi tố nhưng KHÔNG lặp lại cho code MỚI này). SỬA (17/07/2026) từng XOÁ hẳn case
            // 'imagePicker.confirm.click' cùng lúc bỏ action "Add photos" — RESTORE (18/07/2026,
            // Giang yêu cầu "khôi phục add photo vào album") cùng lúc thêm nút "+" 2 lựa chọn (xem
            // case 'uploadTrigger.click'/'addPhotoChoice.click' ở khu vực Upload bên dưới). Picker
            // giờ LẠI CÓ 2 chế độ (chọn 1 ảnh / multi-select thêm vào album, xem
            // workflowFileManagerPhoto._imagePickerSession). ================================

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

            // MỚI (18/07/2026, Giang yêu cầu "khôi phục add photo vào album, bấm + ra 2 lựa chọn")
            // — nút "+" ở header panel Photo giờ dispatch qua ĐÂY thay vì gọi thẳng
            // `uploadInput.click()` (xem event/workflow/file-manager-photo.js::_wireHeaderActionEvents()) —
            // cần đọc `activeAlbumId` (state RIÊNG của Router) để quyết định CHẠY GÌ -> LUÔN
            // VirtualMachineState (event-bus-flow.md mục 4C), cùng khuôn case 'image.click' phía trên.
            case 'fileManagerPhoto.uploadTrigger.click': {
                VirtualMachineState.run([
                    { state: !!activeAlbumId, operation: '===', value: true, callback: () => {
                        // Đang lọc theo 1 album -> mở dropdown 2 lựa chọn (Tải ảnh lên / Chọn ảnh có sẵn).
                        workflowFileManagerPhoto.openAddToAlbumChoiceMenu(activeAlbumId);
                    } },
                    { state: !activeAlbumId, operation: '===', value: true, callback: () => {
                        // KHÔNG lọc -> mở thẳng hộp thoại chọn file, giữ NGUYÊN hành vi cũ.
                        workflowFileManagerPhoto.triggerUploadInput();
                    } },
                ]);
                break;
            }

            // Đích dispatch của dropdown 2 lựa chọn ngay trên (mỗi mục dropdown tự eventBus.send()
            // case này, xem workflowFileManagerPhoto.openAddToAlbumChoiceMenu()) — 2 lựa chọn LOẠI
            // TRỪ NHAU, dispatch theo msg.payload.choice (KHÔNG phải appState) — cùng khuôn case
            // 'albumList.action.click' (dispatch theo payload, tiền lệ đã có sẵn trong chính file này).
            case 'fileManagerPhoto.addPhotoChoice.click': {
                const { choice, albumId } = msg.payload;
                VirtualMachineState.run([
                    { state: choice, operation: '===', value: 'upload', callback: () => {
                        workflowFileManagerPhoto.triggerUploadInput();
                    } },
                    { state: choice, operation: '===', value: 'existing', callback: () => {
                        workflowFileManagerPhoto.openAlbumImagePicker(albumId); // >1 hàm core (Generic Drawer + shield + đọc DB + windowing) -> workflow
                    } },
                ]);
                break;
            }

            case 'fileManagerPhoto.upload.change': {
                const { files } = msg.payload;
                workflowFileManagerPhoto.uploadImages(files, activeAlbumId); // >1 hàm core -> workflow
                break;
            }

            // MỚI (21/07/2026, Giang yêu cầu "menu action ảnh chuyển từ Generic Drawer sang
            // dropdown") — đích dispatch của dropdown (event/workflow/file-manager-photo.js::
            // _openImageActionMenu()) — dùng `activeAlbumId` CỦA ROUTER (closure, KHÔNG qua
            // payload) — luôn phản ánh ĐÚNG ngữ cảnh đang lọc lúc action THẬT SỰ chạy, tránh lệch
            // nếu người dùng đổi ngữ cảnh giữa lúc mở menu và lúc bấm action (hiếm, nhưng an toàn
            // hơn truyền qua payload lúc mở menu).
            case 'fileManagerPhoto.imageMenu.action.click': {
                const { action, imageKey } = msg.payload;
                // MỚI (31/07/2026, Zoom mode) — TOGGLE: cùng 1 action='zoom' cho cả vào/thoát, dùng
                // ĐÚNG 1 lần imagePreviewMode đọc TRƯỚC, gộp thẳng vào `state` của rule thành biểu
                // thức boolean loại trừ nhau — VirtualMachineState.run() chạy TẤT CẢ rule khớp
                // (không dừng ở rule đầu tiên, xem docstring event/virtual-machine-state.js), nên
                // KHÔNG thể tách "action==='zoom'" và "imagePreviewMode==='zoom'" thành 2 rule riêng
                // (sẽ khớp CÙNG LÚC khi cả 2 đúng, chạy nhầm cả enter LẪN exit).
                const isCurrentlyZooming = appState.get('imagePreviewMode') === 'zoom';
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'setPlaylistBg', callback: () => {
                        workflowFileManagerPhoto.setAsPlaylistBackground(imageKey);
                    } },
                    { state: (action === 'zoom' && isCurrentlyZooming), operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.exitImagePreviewMode();
                    } },
                    { state: (action === 'zoom' && !isCurrentlyZooming), operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.enterZoomMode();
                    } },
                    { state: action, operation: '===', value: 'editImage', callback: () => {
                        workflowFileManagerPhoto.navigateToImageEdit(imageKey);
                    } },
                    { state: action, operation: '===', value: 'removeFromAlbum', callback: () => {
                        removeImageFromAlbum(imageKey, activeAlbumId).then(() => workflowFileManagerPhoto.refresh(activeAlbumId)); // core/file-manager/album.js
                    } },
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        deleteImage(imageKey).then(() => workflowFileManagerPhoto.refresh(activeAlbumId)); // core/file-manager/image.js — cascade dọn album
                    } },
                ]);
                break;
            }

            // MỚI (31/07/2026, Zoom mode) — nút X của modal xem ảnh, giờ đi qua eventBus (TRƯỚC ĐÂY
            // đóng thẳng, core/file-manager/photo-ui.js) — Block gate (event/block.js) chặn HẲN
            // msg.type này khi imagePreviewMode !== 'view' (đang Zoom/Edit), tự hiện notify, KHÔNG
            // chạy gì cả — chỉ khi KHÔNG bị chặn (đang 'view') mới thật sự chạy tới đây.
            case 'fileManagerPhoto.imagePreview.close.click': {
                workflowFileManagerPhoto.closeImagePreview();
                break;
            }

            default:
                console.warn(`[router:fileManagerPhoto] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle, getActiveAlbumId, clearActiveAlbumFilter };
})();

eventBus.register('fileManagerPhoto', routerFileManagerPhoto);
