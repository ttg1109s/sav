/**
 * event/listener/app-boot.js — MỚI (25/07/2026, đợt tái cấu trúc state, mục "app-boot đi qua
 * eventBus"). TRƯỚC ĐÂY `DOMContentLoaded`/`error`/`unhandledrejection` đứng NGOÀI kiến trúc
 * /event/ (gọi trực tiếp, xem event/router/app-boot.js bản cũ + core/config.js bản cũ) — quy ước
 * "ngoại lệ lifecycle boot" mà code cũ viện dẫn (event-bus-flow.md mục 1) thực ra CHƯA TỪNG được
 * ghi rõ trong tài liệu đó (rà lại lúc thảo luận đợt này không thấy) — SỬA luôn cho ĐÚNG khớp tài
 * liệu: mọi listener, kể cả browser lifecycle event, đều gửi qua eventBus như các cụm khác.
 *
 * `app.boot` — 1 message DUY NHẤT cho toàn bộ chuỗi ~15 bước boot (vốn tuần tự/awaited chặt chẽ,
 * xem event/workflow/app-boot.js) — KHÔNG tách nhỏ theo từng mốc. An toàn về thứ tự nạp: callback
 * `DOMContentLoaded` chỉ THỰC SỰ chạy sau khi TOÀN BỘ tài liệu (mọi <script> phía sau, kể cả
 * event/bus.js/event/workflow/app-boot.js ở cuối) đã nạp xong — vị trí file này trong tài liệu
 * KHÔNG quan trọng cho message này.
 *
 * `app.fatalError` — KHÁC HẲN `app.boot`: 2 listener `error`/`unhandledrejection` bên dưới PHẢI
 * nạp SỚM (đặt NGAY SAU core/fatal-error.js, TRƯỚC phần lớn core/ còn lại — giữ ĐÚNG vị trí sớm
 * của handler gốc, xem core/fatal-error.js) để bắt được lỗi xảy ra ngay trong lúc các file core/
 * khác đang nạp — SỚM HƠN thời điểm `event/bus.js` tồn tại (file đó nạp ở khối /event/ cuối tài
 * liệu, xem index.html). Vì vậy 2 handler này tự kiểm tra `typeof eventBus` — CÓ thì gửi qua
 * eventBus (đúng kiến trúc, cho `event/router/app-boot.js` xử lý — router đó nạp CÙNG khối
 * /event/ cuối tài liệu, không cần tồn tại sớm vì chỉ cần sẵn sàng TRƯỚC LÚC message thật sự tới,
 * không phải trước lúc listener đăng ký); CHƯA có (lỗi xảy ra quá sớm) thì gọi THẲNG
 * `_reportFatalError()` làm lưới an toàn — không mất lỗi trong khoảng nạp sớm đó.
 */
document.addEventListener('DOMContentLoaded', () => {
    eventBus.send({ router: 'appBoot', type: 'app.boot', payload: {} });
});
window.addEventListener('error', (e) => {
    const context = `${e.filename || 'script'}:${e.lineno || '?'}`;
    const err = e.error || e.message;
    if (typeof eventBus !== 'undefined') {
        eventBus.send({ router: 'appBoot', type: 'app.fatalError', payload: { context, err } });
    } else {
        _reportFatalError(context, err); // lưới an toàn — lỗi xảy ra TRƯỚC khi event/bus.js kịp nạp
    }
});
window.addEventListener('unhandledrejection', (e) => {
    const context = 'Promise bị reject nhưng không ai .catch()';
    if (typeof eventBus !== 'undefined') {
        eventBus.send({ router: 'appBoot', type: 'app.fatalError', payload: { context, err: e.reason } });
    } else {
        _reportFatalError(context, e.reason); // lưới an toàn — xem comment ở handler 'error' trên
    }
});
