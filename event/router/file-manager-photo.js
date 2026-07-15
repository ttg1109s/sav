/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. CHỐT 03/07/2026 (mục 1a/3/7) — panel "Photo & Album" (gộp UI Ảnh + Album).
 *
 * Batch 3 (03/07/2026) — nội dung thật: story slider album + masonry ảnh, xem
 * core/file-manager/photo-ui.js + event/workflow/file-manager-photo.js.
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): Đổi tên/Xoá album đang lọc (`fileManagerPhoto.album.manageClick`) + chế độ
 * chọn nhiều ảnh để thêm vào album đang lọc (`fileManagerPhoto.imageSelection.*`).
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * 'open' ĐỔI TÊN 'openPanel.click'. Case 'close' ĐÃ XOÁ — đóng dùng CHUNG
 * 'settingsStackNav.back.click'. Case 'upload.click' ĐÃ XOÁ — nút trigger giờ click thẳng input
 * file panel-scoped NGAY TRONG listener (DOM proxy thuần, không cần round-trip qua router — xem
 * event/listener/file-manager-photo.js).
 *
 * STATE CONTEXT: `activeAlbumId` (album đang lọc masonry, null = "Tất cả"), `imageSelectionMode`/
 * `selectedImageKeys` sống Ở ĐÂY — cùng cách router "fileManagerSong" giữ `currentFolderDetailId`.
 * MỚI (14/07/2026, mục cuối): `albumStoryPageIndex` (trang hiện tại của story album, arrow
 * pagination) + `imageQuickDeleteMode` (chế độ xoá nhanh — bấm ảnh nào xoá ảnh đó, không hỏi lại).
 * 3 chế độ khi bấm 1 ảnh (`imageSelectionMode`/`imageQuickDeleteMode`/bình thường) LOẠI TRỪ NHAU —
 * KHÔNG BAO GIỜ bật đồng thời 2 cái (guard ở case tương ứng).
 *
 * SỬA (Giai đoạn 3, rewrite Photo/Album — redesign chế độ xoá nhanh, Giang chỉ ra "tránh lãng phí
 * khi không xoá gì") — `imageQuickDeleteMode` giờ CHỈ bật/tắt chế độ, KHÔNG còn tự xoá ngay lúc bấm
 * ảnh. Thêm `quickDeleteSelectedKeys` (Set closure, CÙNG khuôn `selectedImageKeys` — chỉ khác Set
 * đích, KHÔNG đẩy lên service `appState`, giữ nhất quán state cùng lớp trong file này) — bấm ảnh chỉ
 * TOGGLE vào/ra Set này (patch DOM, không refresh/không DB). Nút xoá nhanh ở header giờ dùng
 * `VirtualMachineState.run()` 3 nhánh loại trừ nhau (case `fileManagerPhoto.image.deleteMode.click`
 * ngay dưới) thay vì if/else — tránh gọi `deleteImage()`/`refresh()` lãng phí khi Set rỗng.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto),
 * core/settings-panel-stack.js (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    let activeAlbumId = null; // context state CỦA RIÊNG panel Photo — reset về null mỗi lần mở lại
    let imageSelectionMode = false; // MỚI — true = đang chọn nhiều ảnh để thêm vào activeAlbumId
    let selectedImageKeys = new Set(); // MỚI — tập imageKey đang được chọn khi imageSelectionMode=true
    let albumStoryPageIndex = 0; // MỚI (14/07/2026) — trang hiện tại của story album (arrow pagination)
    let imageQuickDeleteMode = false; // MỚI (14/07/2026) — true = đang ở chế độ xoá nhanh (SỬA Giai đoạn 3: KHÔNG còn tự xoá ngay lúc bấm ảnh — xem quickDeleteSelectedKeys)
    let quickDeleteSelectedKeys = new Set(); // MỚI (Giai đoạn 3, redesign chế độ xoá nhanh) — ảnh đã đánh dấu chờ xoá, cùng khuôn selectedImageKeys, LOẠI TRỪ với nó (không bao giờ cả 2 mode cùng bật)

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.openPanel.click': {
                activeAlbumId = null; // luôn mở lại từ "Tất cả", không nhớ lọc phiên trước
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                albumStoryPageIndex = 0;
                imageQuickDeleteMode = false;
                workflowFileManagerPhoto.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
                break;
            }

            // ===================== Album (story slider) =====================

            case 'fileManagerPhoto.album.storyClick': {
                // BUG FIX (14/07/2026, Giang báo "Add new album không hiện modal gì cả") — bản
                // trước chặn CẢ khi `imageQuickDeleteMode` đang bật, im lặng `break` KHÔNG báo gì —
                // đúng cảm giác "bấm không có phản ứng". Xét lại: KHÔNG có xung đột nghiệp vụ thật
                // giữa "xoá nhanh" và đổi lọc/tạo album (khác `imageSelectionMode` — đang GIỮA CHỪNG
                // chọn ảnh để thêm vào 1 album cụ thể, đổi lọc/tạo album lúc đó MỚI thật sự phá dở
                // luồng). Chỉ còn guard đúng `imageSelectionMode`.
                if (imageSelectionMode) break; // guard: đang chọn nhiều ảnh để thêm vào album -> KHÔNG cho đổi lọc/tạo album giữa chừng (chỉ Huỷ/Xác nhận mới thoát chế độ này)
                const { action, albumId } = msg.payload;
                // 3 giá trị LOẠI TRỪ NHAU (đúng data-album-story-action khai báo ở
                // components/file-manager.js/core/file-manager/photo-ui.js) -> BẮT BUỘC qua VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'all', callback: () => {
                        activeAlbumId = null;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    { state: action, operation: '===', value: 'select', callback: () => {
                        // Bấm lại đúng album đang lọc -> bỏ lọc (toggle), giống hành vi tab.
                        activeAlbumId = (activeAlbumId === albumId) ? null : albumId;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    { state: action, operation: '===', value: 'create', callback: () => {
                        workflowFileManagerPhoto.promptCreateAlbum(activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // MỚI (14/07/2026, mục 2.3) — pagination "arrow" cho story album. Giang ĐƠN GIẢN HOÁ:
            // CHỈ toggle CSS (`workflowFileManagerPhoto.navigateAlbumStoryPage()`), KHÔNG gọi lại
            // `refresh()` (không cần đọc lại DB/dựng lại DOM chỉ để đổi trang xem).
            case 'fileManagerPhoto.albumStory.prev.click': {
                albumStoryPageIndex = workflowFileManagerPhoto.navigateAlbumStoryPage(albumStoryPageIndex - 1);
                break;
            }
            case 'fileManagerPhoto.albumStory.next.click': {
                albumStoryPageIndex = workflowFileManagerPhoto.navigateAlbumStoryPage(albumStoryPageIndex + 1);
                break;
            }

            // ===================== MỚI (batch tiếp theo, mục 2.2) — thanh quản lý album đang lọc:
            // Đổi tên / Xoá / mở chế độ "Thêm ảnh có sẵn" =====================

            case 'fileManagerPhoto.album.manageClick': {
                if (!activeAlbumId) break; // guard: không có album nào đang lọc thì thanh này vốn đang ẩn, không có đích để thao tác
                const { action } = msg.payload;
                const albumId = activeAlbumId;
                // 4 giá trị LOẠI TRỪ NHAU (đúng id nút khai báo ở components/file-manager.js, map
                // qua actionById trong event/listener/file-manager-photo.js) -> VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'addImages', callback: () => {
                        imageSelectionMode = true;
                        selectedImageKeys = new Set();
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    // MỚI (Batch 8, slideshow) — "Dùng làm nền Slideshow" cho album đang lọc.
                    { state: action, operation: '===', value: 'setSlideshowBg', callback: () => {
                        workflowFileManagerPhoto.setAsSlideshowBackground(albumId); // >1 hàm core -> workflow
                    } },
                    { state: action, operation: '===', value: 'rename', callback: () => {
                        workflowFileManagerPhoto.renameAlbumById(albumId); // >1 hàm core -> workflow
                    } },
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        // onDeleted: reset activeAlbumId về null NGAY TẦNG NÀY — workflow không tự
                        // mutate được biến closure primitive của router (xem comment đầu file).
                        workflowFileManagerPhoto.deleteAlbumById(albumId, () => { activeAlbumId = null; });
                    } },
                ]);
                break;
            }

            // ===================== Ảnh (masonry) =====================

            case 'fileManagerPhoto.image.click': {
                const { imageKey } = msg.payload;
                // Click 1 ảnh có 3 Ý NGHĨA LOẠI TRỪ NHAU tuỳ chế độ hiện tại: chọn/bỏ (đang thêm
                // ảnh vào album) / đánh dấu chờ xoá (chế độ xoá nhanh — SỬA Giai đoạn 3: KHÔNG còn
                // xoá ngay, chỉ TOGGLE vào/ra quickDeleteSelectedKeys) / mở preview (bình thường) ->
                // VirtualMachineState (3 state loại trừ nhau, chỉ ĐÚNG 1 khớp tại 1 thời điểm — bất
                // biến đảm bảo ở 2 case bật/tắt tương ứng, không bao giờ bật đồng thời).
                VirtualMachineState.run([
                    { state: imageSelectionMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.toggleImageSelectionInSet(imageKey, selectedImageKeys); // mutate Set qua tham chiếu + patch DOM surgical -> KHÔNG cần activeAlbumId (fix mục 3, không còn refresh() toàn bộ)
                    } },
                    { state: imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.toggleQuickDeleteMarkInSet(imageKey, quickDeleteSelectedKeys); // MỚI (Giai đoạn 3) — mutate Set qua tham chiếu + patch DOM surgical, cùng khuôn toggleImageSelectionInSet(), KHÔNG xoá/KHÔNG refresh
                    } },
                    { state: (!imageSelectionMode && !imageQuickDeleteMode), operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.openImagePreview(imageKey, activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== MỚI (14/07/2026, mục 2.2) — chế độ xoá nhanh =====================
            // SỬA (Giai đoạn 3, rewrite Photo/Album — redesign, Giang chỉ ra "tránh lãng phí khi
            // không xoá gì") — THAY if/else cũ bằng VirtualMachineState 3 nhánh LOẠI TRỪ NHAU (cùng
            // khuôn case 'fileManagerPhoto.image.click' ở trên/'fileManagerPhoto.album.storyClick'):
            //   1. Chưa bật mode -> hỏi xác nhận (như cũ), bật mode + Set rỗng.
            //   2. Đang bật, CHƯA đánh dấu ảnh nào -> tắt mode NGAY, 1 refresh() để vẽ lại UI bình
            //      thường — KHÔNG gọi deleteImage() nào (đúng ý "tránh lãng phí" khi không xoá gì).
            //   3. Đang bật, ĐÃ đánh dấu ≥1 ảnh -> hỏi xác nhận kèm số lượng (workflow tự lo) -> xoá
            //      batch 1 lần + 1 refresh() duy nhất -> tắt mode.

            case 'fileManagerPhoto.image.deleteMode.click': {
                if (imageSelectionMode) break; // guard: đang chọn nhiều ảnh để thêm vào album -> không cho bật xoá nhanh giữa chừng
                VirtualMachineState.run([
                    { state: !imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.promptQuickDeleteMode(() => { // >1 hàm core (modal + refresh) -> workflow
                            imageQuickDeleteMode = true;
                            quickDeleteSelectedKeys = new Set();
                            workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode, quickDeleteSelectedKeys);
                        });
                    } },
                    { state: (imageQuickDeleteMode && quickDeleteSelectedKeys.size === 0), operation: '===', value: true, callback: () => {
                        imageQuickDeleteMode = false;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    { state: (imageQuickDeleteMode && quickDeleteSelectedKeys.size > 0), operation: '===', value: true, callback: () => {
                        // onConfirmed: Router KHÔNG tự đặt imageQuickDeleteMode=false NGAY ở đây —
                        // modalChoice() còn đang MỞ, user có thể Huỷ (khi đó mode PHẢI vẫn đang bật,
                        // UI vẫn đang hiện badge đỏ đúng thực tế) — cùng khuôn onDeleted() của
                        // deleteAlbumById() ngay trên: Workflow tự gọi callback này ĐÚNG lúc xoá xong
                        // thật (bên trong onClick của nút xác nhận), Router lúc đó mới đồng bộ biến
                        // của mình. Đặt sai chỗ (set false NGAY tại đây) sẽ lệch giữa "Router nghĩ đã
                        // tắt" và "UI thật vẫn đang bật" nếu user bấm Huỷ hoặc chưa kịp bấm gì.
                        workflowFileManagerPhoto.confirmQuickDeleteBatch(quickDeleteSelectedKeys, activeAlbumId, albumStoryPageIndex, () => { imageQuickDeleteMode = false; }); // >1 hàm core (modal + shield + deleteImage*N + refresh) -> workflow
                    } },
                ]);
                break;
            }

            // ===================== MỚI (batch tiếp theo, mục 2.3) — thanh hành động chọn nhiều ==

            case 'fileManagerPhoto.imageSelection.cancel': {
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode, quickDeleteSelectedKeys);
                break;
            }

            case 'fileManagerPhoto.imageSelection.confirm': {
                const albumId = activeAlbumId; // luôn hợp lệ tại đây: chỉ vào được selectionMode qua 'addImages' (đã guard activeAlbumId ở trên), và storyClick bị khoá suốt lúc đang chọn (guard đầu case đó) -> activeAlbumId không thể đổi/về null giữa chừng
                const keysToAdd = selectedImageKeys;
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                workflowFileManagerPhoto.confirmAddSelectedImages(albumId, keysToAdd, albumId); // >1 hàm core (shield + addImagesToAlbum) -> workflow
                break;
            }

            // ===================== Upload (Batch 3 — nút riêng của Photo drawer, CHƯA phải bộ
            // phân loại thông minh dùng chung với upload nhạc — đó là Batch 8 theo kế hoạch) =====

            // (case 'upload.click' ĐÃ XOÁ — Batch D6, xem docstring đầu file)

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
