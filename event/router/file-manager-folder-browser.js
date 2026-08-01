/**
 * event/router/file-manager-folder-browser.js — Router tên "fileManagerFolderBrowser", tự đăng ký
 * với eventBus lúc nạp. MỚI (ver12 "Song/Video Unification", Batch 5, mục 6e).
 *
 * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") — TRƯỚC
 * ĐÂY toàn bộ tương tác BÊN TRONG Generic Drawer (tile/back/đóng/xoá/gỡ item/toggle/phân trang/tạo
 * folder/sửa tên inline) đi THẲNG `workflowFileManagerFolderBrowser.xxx()` (Workflow tự
 * `addEventListener` lên genericDrawerHeader/Body), CỐ Ý "bỏ qua Router" — SAI Rule 5a. Toàn bộ đã
 * dời wiring sang core/file-manager/folder-picker-ui.js::wireFolderBrowserListEvents()/
 * wireFolderBrowserReadEvents(), giờ ĐI QUA ĐÚNG router này như mọi domain khác.
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
            case 'fileManagerFolderBrowser.list.tile.click': {
                workflowFileManagerFolderBrowser.openRead(msg.payload.folderId);
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

            // ===================== Read =====================

            case 'fileManagerFolderBrowser.read.back.click': {
                workflowFileManagerFolderBrowser.openList();
                break;
            }
            case 'fileManagerFolderBrowser.read.close.click': {
                workflowFileManagerFolderBrowser.closeBrowser();
                break;
            }
            case 'fileManagerFolderBrowser.read.rename.click': {
                workflowFileManagerFolderBrowser.promptRename();
                break;
            }
            case 'fileManagerFolderBrowser.read.delete.click': {
                workflowFileManagerFolderBrowser.confirmDeleteFolder();
                break;
            }
            case 'fileManagerFolderBrowser.read.removeItem.click': {
                workflowFileManagerFolderBrowser.removeItem(msg.payload.songKey);
                break;
            }
            case 'fileManagerFolderBrowser.read.removeAll.click': {
                workflowFileManagerFolderBrowser.confirmRemoveAllItems();
                break;
            }
            case 'fileManagerFolderBrowser.read.pagination.click': {
                workflowFileManagerFolderBrowser.goToReadPage(msg.payload.pageIndex);
                break;
            }
            // Toggle "Chỉ trong folder"/"Loại trừ" — Router tự đọc `payload.checked` để CHỌN đúng
            // hàm (Rule 1: nơi gọi chọn hàm, TRƯỚC ĐÂY logic if/else này nằm lẫn trong chính
            // callback addEventListener ở Workflow, giờ chuyển đúng vai trò Router).
            case 'fileManagerFolderBrowser.read.scope.change': {
                if (msg.payload.checked) workflowFileManagerFolderBrowser.enableScope();
                else workflowFileManagerFolderBrowser.disableScope();
                break;
            }
            case 'fileManagerFolderBrowser.read.exclude.change': {
                workflowFileManagerFolderBrowser.setExclude(msg.payload.checked);
                break;
            }

            default:
                console.warn(`[router:fileManagerFolderBrowser] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerFolderBrowser', routerFileManagerFolderBrowser);
