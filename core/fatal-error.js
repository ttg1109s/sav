/**
 * core/fatal-error.js — XOÁ NỘI DUNG (phản hồi Giang — "phải cho ngay lên hàng đầu trước bất kỳ
 * script nào"). Toàn bộ nội dung file này (`_reportFatalError()`/`_renderDebugErrorPanel()` + badge/
 * panel debug) đã DỜI HẲN vào 1 khối `<script>` inline ngay ĐẦU `<body>` trong index.html (dòng
 * đầu tiên, TRƯỚC CẢ Preloader) — lý do: window.addEventListener('error'/'unhandledrejection')
 * phải đăng ký TRƯỚC MỌI THẺ <script> KHÁC (kể cả 11 thẻ CDN/Preloader) mới chắc chắn không bỏ
 * sót lỗi nào xảy ra trong lúc các file đó đang nạp — file JS RIÊNG (nạp ở vị trí ~dòng 480 như
 * trước) không thể sớm hơn vị trí vật lý của chính nó trong tài liệu.
 *
 * Thẻ <script src="core/fatal-error.js"> ĐÃ XOÁ khỏi index.html — Giang xoá tay file này khi
 * rảnh (không còn tác dụng gì, giữ lại chỉ để đối chiếu nếu cần).
 *
 * `_reportFatalError`/`_renderDebugErrorPanel` giờ là 2 hàm global gắn qua `window._reportFatalError`/
 * `window._renderDebugErrorPanel` (định nghĩa trong index.html) — mọi nơi gọi 2 hàm này (event/
 * listener/app-boot.js cũ, event/router/app-boot.js) vẫn gọi được y hệt vì đều là biến global,
 * KHÔNG cần đổi gì thêm ở phía gọi.
 */
