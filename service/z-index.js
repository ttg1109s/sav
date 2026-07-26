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
 * SỬA (25/07/2026, phản hồi Giang — "theo code hiện tại") — bản trước đợt tái cấu trúc gọi
 * entry 200 là `MODAL_CHOICE`, nhưng code thật của `core/modal-choice.js` đang chạy ĐÚNG ở z-130
 * (dưới `components/loading-shield.js`, thật sự ở z-200, theo đúng comment gốc trong chính
 * modal-choice.js: "vẫn DƯỚI loading-shield vì shield là trạng thái..."). SỬA lại tên/giá trị cho
 * KHỚP hành vi THẬT đang chạy (không đổi bất kỳ z-index thật nào) — `MODAL_CHOICE` giờ đúng 130,
 * thêm `LOADING_SHIELD: 200` cho lớp cao nhất thật sự.
 *
 * PHẢI nạp TRƯỚC mọi file core/ có dùng z-index (đặt cùng nhóm service/ với state.js/operation.js).
 */
        const Z_INDEX = Object.freeze({
            APP_STACK: 60,                  // #app-stack (main.js) — mốc tham chiếu thấp nhất
            GENERIC_DRAWER: 128,             // core/generic-drawer.js — panel; overlay tự dùng GENERIC_DRAWER - 1
            IMAGE_PREVIEW: 130,              // core/file-manager/photo-ui.js::openImagePreviewModal()
            IMAGE_CAROUSEL_PICKER: 130,      // core/file-manager/photo-ui.js::openImageCarouselPickerModal()
            IMAGE_ACTION_MENU_DRAWER: 131,   // event/workflow/file-manager-photo.js::_openImageActionMenu() — Generic Drawer mở TRÊN Image Preview
            MODAL_CHOICE: 130,               // core/modal-choice.js — CÙNG lớp với các modal overlay ảnh (không phải cao nhất)
            LOADING_SHIELD: 200,             // components/loading-shield.js — luôn cao nhất, KHÔNG dùng constant này được (xem ghi chú cuối file service/z-index.js)
        });

        // GHI CHÚ (25/07/2026) — `components/loading-shield.js` KHÔNG migrate sang đọc
        // `Z_INDEX.LOADING_SHIELD` được: file đó là 1 CHUỖI TEMPLATE TĨNH (`TPL_LOADING_SHIELD`)
        // được ĐÁNH GIÁ (evaluate) NGAY lúc parse — SỚM HƠN nhiều so với vị trí nạp
        // `service/z-index.js` (khối `<script>` phía cuối trong index.html) — interpolate
        // `Z_INDEX.LOADING_SHIELD` vào chuỗi đó lúc này sẽ ReferenceError, sập cả app. Khác hẳn
        // `core/modal-choice.js`/`photo-ui.js` (hàm, chỉ THỰC SỰ chạy lúc người dùng thao tác —
        // Z_INDEX chắc chắn đã nạp xong từ lâu). Giữ nguyên `z-[200]` hardcode ở file đó — giá trị
        // VẪN ĐÚNG khớp bảng này (200), chỉ là không đọc qua hằng số chung được do giới hạn thứ tự
        // nạp kể trên.
