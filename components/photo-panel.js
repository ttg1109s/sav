/**
 * components/photo-panel.js — Photo, MỚI (đợt tái cấu trúc bottom nav) — 1 khung full-screen RIÊNG
 * của chính nó, NGANG CẤP kiến trúc với Setting (Generic Drawer) — KHÔNG dùng chung singleton
 * core/generic-drawer.js (picker "thêm ảnh có sẵn vào album" bên trong Photo cũng cần Generic
 * Drawer — dùng chung sẽ đè lên chính Photo, xem event/workflow/file-manager-photo.js::
 * _openImagePickerDrawer()), KHÔNG còn là panel con của Settings (`pushSettingsPanel()` cũ).
 *
 * TÁI DÙNG NGUYÊN VẸN cơ chế ngăn xếp `core/settings-panel-stack-ui.js` (pushSettingsPanel()/
 * popSettingsPanel()/resetSettingsStackToMain(), đọc `settingsStackBody`/`settingsStackPanelMain`
 * từ dom-refs.js) — CHỈ đổi nơi 2 phần tử `#settings-stack-body`/`#settings-stack-panel-main` SỐNG
 * (trước ở trong `#drawer-settings` cũ, giờ ở trong `#photo-panel`) — TÊN ID GIỮ NGUYÊN.
 *
 * SỬA (phát hiện lúc code) — `#settings-stack-panel-main` KHÔNG còn pre-render nội dung Photo tĩnh
 * ở ĐÂY nữa: `workflowFileManagerPhoto.openPanel()` (event/workflow/file-manager-photo.js) tự dựng
 * `headerActionHtml` ĐỘNG (nút upload/xoá-nhanh, tuỳ trạng thái ảnh) MỖI LẦN mở — pre-render tĩnh
 * ở component sẽ mất các nút đó VÀ gọi lại `openPanel()` sẽ đẩy chồng thêm panel. `openPanel()` đã
 * SỬA để ghi thẳng vào `#settings-stack-panel-main` tĩnh (thay vì `pushSettingsPanel()` tạo mới) —
 * xem docstring tại đó. Component này chỉ còn dựng KHUNG RỖNG, Main để trống lúc boot.
 *
 * NẠP TRƯỚC: main.js (mount vào #app-root).
 */
const TPL_PHOTO_PANEL = `
    <div id="photo-panel" class="hidden flex flex-col" style="z-index: 128;">
        <div id="settings-stack-body" class="flex overflow-x-hidden overflow-y-hidden flex-grow">
            <div id="settings-stack-panel-main" class="settings-stack-panel w-full h-full flex-shrink-0 flex flex-col"></div>
        </div>
    </div>
`;
