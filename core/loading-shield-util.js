/**
 * Utility dùng chung: withLoadingShield(text, fn, display=true) — che màn hình khi đang xử lý,
 * tự khoá mọi tác vụ chồng lệnh qua biến isShieldBusy (xem PLAN_INDEXEDDB.md mục 5).
 *
 * Tham số display (on/off):
 *  - display = true  (mặc định): hiển thị lớp che (spinner + text) như cũ.
 *  - display = false: VẪN chạy logic + khoá isShieldBusy + chờ fn() xong, nhưng KHÔNG hiện gì
 *    (không bật lớp che, không fade). Dùng cho tác vụ nhanh không muốn nháy màn hình — ví dụ
 *    CHUYỂN BÀI: trước đây mỗi lần Next/Prev lại nháy lớp đen bg-black/80 rồi fade, gây cảm giác
 *    "chớp" (đặc biệt khi có video nền). Giờ chuyển bài gọi với display=false nên im lặng hoàn toàn.
 *
 * PHẢI nạp sau khi #loading-shield/#loading-text đã có trong DOM (sau main.js, cùng nhóm
 * core đầu tiên — đặt cạnh db.js).
 */
        const SHIELD_FADE_MS = 200; // khớp duration-200 trong CSS của #loading-shield

        async function withLoadingShield(text, fn, display = true) {
            if (appState.get('isShieldBusy')) {
                // Im lặng theo thiết kế (chặn double-click/double-call hợp lệ) — chỉ log để dễ dò khi
                // nghi ngờ bị "kẹt" khoá (ví dụ sau khi quay lại tab trên iOS, xem resetPlayerToIdle()
                // ở player-controls.js — hàm đó tự giải phóng isShieldBusy để tránh kẹt vĩnh viễn).
                console.warn(`[loading-shield] Bỏ qua "${text}" vì đang có tác vụ khác dùng shield.`);
                return;
            }
            appState.set('isShieldBusy', true);

            if (display) {
                loadingText.textContent = text;
                loadingShield.classList.remove('opacity-0', 'pointer-events-none');
                loadingShield.classList.add('opacity-100', 'pointer-events-auto');
            }

            try {
                return await fn();
            } finally {
                if (display) {
                    loadingShield.classList.remove('opacity-100');
                    loadingShield.classList.add('opacity-0');
                    // Chờ fade-out kết thúc HẲN rồi mới mở khoá — không cho thao tác tiếp trong lúc
                    // đang còn mờ dần, chỉ mở khi đã tắt hoàn toàn.
                    await new Promise(resolve => taskManager.once(resolve, SHIELD_FADE_MS));
                    // QUAN TRỌNG: phải remove 'pointer-events-auto' ở đây — nếu không, class này tồn tại
                    // song song với 'pointer-events-none' vừa thêm. Vì cả 2 đều là utility class của
                    // Tailwind CDN với cùng độ ưu tiên CSS, trình duyệt áp dụng class nào đứng SAU trong
                    // stylesheet đã generate (không nhất định theo thứ tự gọi classList.add ở đây) — có
                    // thể khiến 'pointer-events-auto' thắng, làm #loading-shield (phủ kín toàn màn hình,
                    // z-[200]) tiếp tục chặn MỌI click/chạm dù đã mờ hẳn (opacity-0), tức "treo, không
                    // thao tác được gì" dù dữ liệu đã lưu xong (chỉ thấy đúng lại sau khi reload trang).
                    loadingShield.classList.remove('pointer-events-auto');
                    loadingShield.classList.add('pointer-events-none');
                }
                appState.set('isShieldBusy', false);
            }
        }

        /** Ẩn Preloader toàn màn hình (index.html) — chỉ thêm class `app-preloader-hidden` lên `<html>`; CSS lo fade +
         * visibility (không gỡ phần tử, không hẹn giờ). Gọi lại nhiều lần vô hại. Lưới an toàn 10 s ở service/boot-preloader.js
         * thêm đúng class này. @param {HTMLElement} rootEl document.documentElement */
        function hideAppPreloader(rootEl) {
            rootEl.classList.add('app-preloader-hidden');
        }
