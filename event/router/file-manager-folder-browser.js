/**
 * event/router/file-manager-folder-browser.js — Router tên "fileManagerFolderBrowser", tự đăng ký
 * với eventBus lúc nạp. MỚI (ver12 "Song/Video Unification", Batch 5, mục 6e).
 *
 * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") — TRƯỚC
 * ĐÂY toàn bộ tương tác BÊN TRONG Generic Drawer đi THẲNG `workflowFileManagerFolderBrowser.xxx()`
 * (Workflow tự `addEventListener`), CỐ Ý "bỏ qua Router" — SAI Rule 5a. Toàn bộ wiring đã dời sang
 * core/file-manager/folder-picker-ui.js::wireFolderPickerDrawerEvents(), đi qua ĐÚNG router này.
 *
 * SỬA (06/09/2026, Giang chốt mục 3.6 — "bỏ hẳn màn Read") — mọi case 'read.*' (back/close/rename/
 * delete/removeItem/removeAll/pagination/2 toggle Scope-Exclude) bỏ hẳn cùng màn hình đó. Thêm 2
 * case MỚI cho tile: `.tile.click` (áp dụng Scope ngay) và `.tile.longpress` (mở menu hành động) —
 * xem event/workflow/file-manager-folder-browser.js.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-folder-browser.js.
 * NẠP TRƯỚC: event/listener/file-manager-song.js (nút "Duyệt thư mục" delegate ở đó).
 */
const routerFileManagerFolderBrowser = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerFolderBrowser.open.click':
                workflowFileManagerFolderBrowser.openList(); // >1 hàm core (đọc DB + vẽ) -> workflow
                break;

            case 'fileManagerFolderBrowser.rename.confirm': {
                const { folderId, name } = msg.payload;
                workflowFileManagerFolderBrowser.confirmRenameFolder(folderId, name);
                break;
            }

            // ===================== List =====================

            case 'fileManagerFolderBrowser.list.close.click': {
                workflowFileManagerFolderBrowser.closeBrowser();
                break;
            }
            // SỬA (06/09/2026, mục 2.1 — "tap thư mục -> áp dụng ngay") — TRƯỚC ĐÂY gọi openRead()
            // (chuyển sang màn xem nội dung folder, ĐÃ XOÁ). Giờ áp Scope THẲNG.
            case 'fileManagerFolderBrowser.list.tile.click': {
                workflowFileManagerFolderBrowser.applyFolderFromTile(msg.payload.folderId);
                break;
            }
            // MỚI (06/09/2026, mục 2.7 — long-press mở menu hành động).
            case 'fileManagerFolderBrowser.list.tile.longpress': {
                workflowFileManagerFolderBrowser.openTileActionsMenu(msg.payload.folderId);
                break;
            }
            case 'fileManagerFolderBrowser.list.addTile.click': {
                workflowFileManagerFolderBrowser.createFolderInBrowser();
                break;
            }
            case 'fileManagerFolderBrowser.list.rename.commit': {
                workflowFileManagerFolderBrowser.commitListRename(msg.payload.folderId, msg.payload.name);
                break;
            }

            default:
                console.warn(`[router:fileManagerFolderBrowser] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerFolderBrowser', routerFileManagerFolderBrowser);
