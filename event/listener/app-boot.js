/**
 * event/listener/app-boot.js — MỚI (25/07/2026, đợt tái cấu trúc state, mục "app-boot đi qua
 * eventBus"). TRƯỚC ĐÂY `DOMContentLoaded` đứng NGOÀI kiến trúc /event/ (gọi trực tiếp, xem
 * event/router/app-boot.js bản cũ + core/config.js bản cũ) — quy ước "ngoại lệ lifecycle boot" mà
 * code cũ viện dẫn (event-bus-flow.md mục 1) thực ra CHƯA TỪNG được ghi rõ trong tài liệu đó (rà
 * lại lúc thảo luận đợt này không thấy) — SỬA luôn cho ĐÚNG khớp tài liệu: mọi listener, kể cả
 * browser lifecycle event, đều gửi qua eventBus như các cụm khác.
 *
 * `app.boot` — 1 message DUY NHẤT cho toàn bộ chuỗi ~15 bước boot (vốn tuần tự/awaited chặt chẽ,
 * xem event/workflow/app-boot.js) — KHÔNG tách nhỏ theo từng mốc. An toàn về thứ tự nạp: callback
 * `DOMContentLoaded` chỉ THỰC SỰ chạy sau khi TOÀN BỘ tài liệu (mọi <script> phía sau, kể cả
 * event/bus.js/event/workflow/app-boot.js ở cuối) đã nạp xong — vị trí file này trong tài liệu
 * KHÔNG quan trọng cho message này.
 *
 * XOÁ (phản hồi Giang — "phải cho ngay lên hàng đầu trước bất kỳ script nào") — 2 listener
 * `error`/`unhandledrejection` TỪNG ở đây (bắt lỗi runtime, gửi qua eventBus nếu đã sẵn sàng, gọi
 * thẳng `_reportFatalError()` làm lưới an toàn nếu chưa) đã BỎ HẲN — DỜI NGUYÊN VÀO 1 khối
 * `<script>` inline NGAY DÒNG ĐẦU TIÊN của `<body>` (index.html, TRƯỚC CẢ Preloader/mọi thẻ CDN),
 * KHÔNG còn gửi qua eventBus nữa (gọi thẳng `window._reportFatalError()` — cùng lý do "lưới an
 * toàn phải tự đứng độc lập, không phụ thuộc kiến trúc có thể chưa sẵn sàng/đang hỏng" đã áp dụng
 * xuyên suốt). Lý do dời hẳn (không chỉ đổi vị trí file .js): vị trí VẬT LÝ của bản thân file này
 * trong tài liệu (dù đã đặt khá sớm, ~dòng 480/987) vẫn SAU rất nhiều thẻ <script> khác (Preloader,
 * 11 thẻ CDN, nhiều core/ khác) — lỗi xảy ra TRONG lúc những thẻ đó đang nạp sẽ KHÔNG được bắt vì
 * 2 listener này chưa kịp đăng ký. Giữ nguyên listener `app.boot` dưới đây — vị trí của NÓ không
 * quan trọng như đã giải thích, không cần dời.
 */
document.addEventListener('DOMContentLoaded', () => {
    eventBus.send({ router: 'appBoot', type: 'app.boot', payload: {} });
});
