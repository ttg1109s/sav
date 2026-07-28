/**
 * event/router/file-manager-folder-browser.js — Router tên "fileManagerFolderBrowser", tự đăng ký
 * với eventBus lúc nạp. MỚI (ver12 "Song/Video Unification", Batch 5, mục 6e).
 *
 * CHỈ 2 msg.type — ĐÚNG khuôn event/router/document-picker.js (List↔Read Generic Drawer): mọi
 * tương tác BÊN TRONG Generic Drawer (tile/back/đóng/xoá/gỡ item/toggle/phân trang/tạo folder/sửa
 * tên inline) gọi THẲNG `workflowFileManagerFolderBrowser.xxx()` (Workflow tự wire trực tiếp lên
 * genericDrawerHeader/Body, xem docstring đầu event/workflow/file-manager-folder-browser.js) —
 * KHÔNG qua Router. Router chỉ còn:
 *   - 'open.click' — nút "Duyệt thư mục" ở panel Song & Video (NGOÀI Generic Drawer).
 *   - 'rename.confirm' — modal đổi tên folder (core/file-manager/folder-picker-ui.js::
 *     openRenameFolderModal(), DOM overlay RIÊNG ngoài genericDrawerBody, giữ nguyên eventBus).
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

            default:
                console.warn(`[router:fileManagerFolderBrowser] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerFolderBrowser', routerFileManagerFolderBrowser);
