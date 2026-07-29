/**
 * core/fatal-error.js — Hàm CORE thuần báo lỗi runtime toàn cục (dời từ core/config.js, đợt tái
 * cấu trúc state 25/07/2026 — cùng lúc app-boot chuyển qua kiến trúc /event/, xem
 * event/listener,router,workflow/app-boot.js).
 *
 * SỬA (phản hồi Giang — "điều tra lâu thế? tạo một index và bảng debug hiện thị lỗi runtime js
 * ngay trong là được") — ĐẢO quyết định "SILENT hoàn toàn" cũ (giữ nguyên đoạn dưới để đối chiếu
 * lịch sử): console.error(...) vẫn ghi như cũ, NHƯNG giờ CÒN lưu vào `_fatalErrorLog` (mảng, có
 * số thứ tự = "index" Giang yêu cầu) + vẽ TRỰC TIẾP ra `#debug-error-badge`/`#debug-error-panel`
 * (index.html, đặt NGAY SAU Preloader — xem comment đầy đủ ở đó) — không cần DevTools/kết nối máy
 * tính mới xem được lỗi nữa, đặc biệt hữu ích lúc test trên điện thoại qua file://.
 * [Nhận định CŨ, KHÔNG còn áp dụng — giữ lại đối chiếu] SILENT hoàn toàn theo yêu cầu Giang —
 * console.error(...) ghi đủ context+err vào console (đủ để dev tự mở DevTools), KHÔNG alert()
 * cho người dùng cuối (tránh phiền vì có thể bắn nhiều lần liên tiếp với lỗi vụn vặt không ảnh
 * hưởng người dùng, vd lỗi từ 1 extension trình duyệt) — GIỜ đổi thành hiện badge/panel (không
 * phải alert() chặn thao tác) nên không còn xung đột với lý do "tránh phiền" ở nhận định cũ.
 */
        let _hasShownFatalErrorAlert = false;
        const _fatalErrorLog = []; // { index, time, context, message, stack }[] — reset mỗi phiên (KHÔNG persist, chỉ cần trong lúc test)
        function _reportFatalError(context, err) {
            console.error(`[FATAL] ${context}:`, err);
            _hasShownFatalErrorAlert = true; // giữ lại cờ phòng trường hợp code khác đang đọc biến này
            _fatalErrorLog.push({
                index: _fatalErrorLog.length + 1,
                time: new Date().toLocaleTimeString(),
                context: String(context),
                message: (err && err.message) ? err.message : String(err),
                stack: (err && err.stack) ? err.stack : '',
            });
            _renderDebugErrorPanel();
        }

        /**
         * Vẽ lại badge (số đếm) + nội dung panel — KHÔNG qua eventBus/AppState/t() (LƯỚI AN TOÀN
         * CUỐI CÙNG, phải tự chạy được kể cả khi phần còn lại của app đã hỏng nặng — cùng lý do
         * `_reportFatalError()` tự guard `typeof eventBus` ở event/listener/app-boot.js). Tự
         * `document.getElementById()` trực tiếp, guard null an toàn (phòng trường hợp hiếm gọi
         * TRƯỚC khi parser tới được khối HTML debug panel — dù vị trí đặt NGAY SAU Preloader nên
         * thực tế luôn đã có mặt tại thời điểm file JS này được nạp và chạy).
         */
        function _renderDebugErrorPanel() {
            const badge = document.getElementById('debug-error-badge');
            if (badge) {
                badge.textContent = String(_fatalErrorLog.length);
                badge.classList.remove('debug-error-hidden');
            }
            const list = document.getElementById('debug-error-list');
            if (list) {
                list.textContent = _fatalErrorLog.map((e) => `#${e.index} [${e.time}] ${e.context}\n${e.message}\n${e.stack}\n${'-'.repeat(48)}`).join('\n');
            }
        }

        /** Nối 4 nút (badge mở/copy/clear/close) — plain addEventListener, KHÔNG qua eventBus
         * (cùng lý do "lưới an toàn" đã giải thích ở trên). Gọi TRỰC TIẾP (không đợi
         * DOMContentLoaded) — file này nạp SỚM nhưng SAU khối HTML debug panel (đặt ngay đầu
         * <body>, xem index.html), nên 4 phần tử dưới đây CHẮC CHẮN đã có mặt trong DOM tại thời
         * điểm dòng này chạy. */
        (function _wireDebugErrorPanel() {
            const badge = document.getElementById('debug-error-badge');
            const panel = document.getElementById('debug-error-panel');
            const copyBtn = document.getElementById('debug-error-copy');
            const clearBtn = document.getElementById('debug-error-clear');
            const closeBtn = document.getElementById('debug-error-close');
            if (badge && panel) badge.addEventListener('click', () => panel.classList.remove('debug-error-hidden'));
            if (closeBtn && panel) closeBtn.addEventListener('click', () => panel.classList.add('debug-error-hidden'));
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const text = _fatalErrorLog.map((e) => `#${e.index} [${e.time}] ${e.context}\n${e.message}\n${e.stack}`).join('\n\n');
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).catch(() => {});
                    }
                });
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    _fatalErrorLog.length = 0;
                    _renderDebugErrorPanel();
                    if (badge) badge.classList.add('debug-error-hidden');
                    if (panel) panel.classList.add('debug-error-hidden');
                });
            }
        })();
