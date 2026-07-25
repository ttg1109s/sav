/**
 * core/fatal-error.js — Hàm CORE thuần báo lỗi runtime toàn cục (dời từ core/config.js, đợt tái
 * cấu trúc state 25/07/2026 — cùng lúc app-boot chuyển qua kiến trúc /event/, xem
 * event/listener,router,workflow/app-boot.js). Giữ NGUYÊN hành vi cũ 100% — chỉ đổi VỊ TRÍ file +
 * cách gọi (trước đây `window.addEventListener` gọi thẳng, giờ qua eventBus, xem
 * event/listener/app-boot.js).
 *
 * SILENT hoàn toàn theo yêu cầu Giang — console.error(...) ghi đủ context+err vào console (đủ để
 * dev tự mở DevTools), KHÔNG alert() cho người dùng cuối (tránh phiền vì có thể bắn nhiều lần liên
 * tiếp với lỗi vụn vặt không ảnh hưởng người dùng, vd lỗi từ 1 extension trình duyệt).
 */
        let _hasShownFatalErrorAlert = false;
        function _reportFatalError(context, err) {
            console.error(`[FATAL] ${context}:`, err);
            _hasShownFatalErrorAlert = true; // giữ lại cờ phòng trường hợp code khác đang đọc biến này
        }
