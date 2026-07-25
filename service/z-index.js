/**
 * service/z-index.js — Bảng z-index TẬP TRUNG (dời từ core/config.js, đợt tái cấu trúc state
 * 25/07/2026 — trước đó object này KHÔNG được bất kỳ file nào đọc thật, chỉ tồn tại như tài liệu
 * chưa ai áp dụng; đợt này rà lại 4 nơi đang hardcode số trùng đúng các mốc dưới đây và đổi qua
 * đọc `Z_INDEX.xxx` thật — xem core/generic-drawer.js, core/file-manager/photo-ui.js,
 * core/file-manager/file-manager-photo.js, core/modal-choice.js).
 *
 * MỌI overlay/modal/drawer MỚI PHẢI tra bảng này qua `element.style.zIndex = String(Z_INDEX.xxx)`
 * (KHÔNG dùng class Tailwind tĩnh kiểu `z-[130]` — không interpolate được hằng số JS lúc runtime).
 *
 * PHẢI nạp TRƯỚC mọi file core/ có dùng z-index (đặt cùng nhóm service/ với state.js/operation.js).
 */
        const Z_INDEX = Object.freeze({
            APP_STACK: 60,                  // #app-stack (main.js) — mốc tham chiếu thấp nhất
            GENERIC_DRAWER: 128,             // core/generic-drawer.js — panel; overlay tự dùng GENERIC_DRAWER - 1
            IMAGE_PREVIEW: 130,              // core/file-manager/photo-ui.js::openImagePreviewModal()
            IMAGE_CAROUSEL_PICKER: 130,      // core/file-manager/photo-ui.js::openImageCarouselPickerModal()
            IMAGE_ACTION_MENU_DRAWER: 131,   // event/workflow/file-manager-photo.js::_openImageActionMenu() — Generic Drawer mở TRÊN Image Preview
            MODAL_CHOICE: 200,               // core/modal-choice.js — luôn cao nhất
        });
