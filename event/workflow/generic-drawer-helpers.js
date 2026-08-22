/**
 * event/workflow/generic-drawer-helpers.js — GỘP LẠI (31/07/2026, Giang chỉ ra: "xây Generic Drawer
 * mà vẫn phải nhân bản là vô lý") — `closeFully()` từng bị chép nguyên văn ở nhiều file Workflow
 * (file-manager-photo/file-manager-video/file-manager-folder-browser/playlist/image-edit/
 * video-editor). Gộp về ĐÚNG 1 chỗ, mọi nơi gọi qua `workflowGenericDrawerHelpers.xxx()`.
 *
 * SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") —
 * `buildSimpleHeaderHtml()` (trả headerHtml "tiêu đề + nút X", dùng bởi picker Ảnh/lưới tool Edit)
 * ĐÃ XOÁ khỏi đây — phần WIRE nút X đó bắt buộc là Core (Rule 5a), nên header HTML gộp LUÔN vào
 * chính hàm Core dựng+wire Drawer đó (core/file-manager/photo-ui.js::
 * openPhotoImagePickerDrawerUi()/openPhotoEditToolGridDrawerUi(), mỗi hàm tự có bản HTML riêng,
 * chấp nhận trùng lặp nhỏ — tránh 1 hàm Core gọi hàm Core khác chỉ để lấy string, Rule 3a không có
 * ngoại lệ nào cho việc đó).
 *
 * `closeFully()` VẪN ở Workflow (không phải core/generic-drawer.js) — đây KHÔNG phải wiring cho
 * tương tác người dùng (Rule 5a không áp) mà là ĐIỀU PHỐI tuần tự 2 lời gọi Core (`closeGenericDrawer()`
 * -> đợi `transitionend` -> `hideGenericDrawerImmediately()`) — đúng vai trò Workflow (cùng vai trò
 * `taskManager`, Rule 3b cấm `taskManager` trong Core).
 *
 * `video-editor.js` KHÔNG gọi thẳng `closeFully()` — nó cần thêm side-effect riêng
 * (`_destroyShiftWaveform()`/`_renderAllTracks()`/...) quanh cùng lõi này, vẫn giữ
 * `_closeGenericDrawerFully()` riêng nhưng thân hàm giờ gọi `closeFully()` thay vì chép lại lõi.
 *
 * NẠP SAU: core/generic-drawer.js, dom-refs.js (genericDrawerPanel).
 */
const workflowGenericDrawerHelpers = {

    /** Trượt Generic Drawer xuống rồi ẩn hẳn sau `transitionend` (Core `core/generic-drawer.js`
     * KHÔNG được tự `addEventListener` cho DOM tĩnh, xem docstring đầu file). */
    closeFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
    },
};
