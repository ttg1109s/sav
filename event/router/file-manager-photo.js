/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. CHỐT 03/07/2026 (plan-v12-multimedia-decisions.md mục 1a/3/7) — drawer con "Photo & Album"
 * (gộp UI Ảnh + Album, b2/b3) mở thẳng từ section File Manager trong Settings.
 *
 * Hiện CHỈ có mở/đóng (nội dung thật của b2/b3 CHƯA code, đang placeholder "sắp ra mắt") — cả 2
 * đều CHỈ 1 hàm core patch DOM thuần (core/file-manager/nav.js), không cần workflow.
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (showFileManagerPhotoDrawer/
 * hideFileManagerPhotoDrawer).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.open': {
                showFileManagerPhotoDrawer();
                break;
            }
            case 'fileManagerPhoto.close': {
                hideFileManagerPhotoDrawer();
                break;
            }
            default:
                console.warn(`[router:fileManagerPhoto] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerPhoto', routerFileManagerPhoto);
