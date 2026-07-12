/**
 * App Recovery (ver 10 refine, bổ sung) — 2 hàm core cho "Khởi động lại app" và "Khôi phục cài
 * đặt mặc định" (Settings > "Khắc phục sự cố", xem js/components/settings/misc.js). Dành cho lúc
 * trình phát gặp lỗi/hành vi không bình thường mà người dùng không biết chỉnh gì khác ngoài tự
 * bấm F5 — cho họ 1 lối thoát rõ ràng, có xác nhận trước khi thực hiện (modal ở tầng workflow,
 * xem event/workflow/settings-nav.js).
 *
 * executeRestartApp(): xoá hết state RAM TẠM (resume snapshot + cờ trong localStorage — xem
 * resume-state-storage.js) rồi reload — KHÔNG đụng tới nhạc/playlist (IndexedDB) hay vizConfig.
 *
 * executeRestoreDefaults(): CHỈ reset vizConfig về CONST.DEFAULT_VIZ_CONFIG (service/state.js) —
 * GIỮ NGUYÊN nhạc/playlist đã upload. Sau khi reset, vẫn cần reload để UI tự đồng bộ lại qua
 * loadConfig().
 *
 * ÁP DỤNG /event/ (cụm "settingsNav"): `addEventListener`+`modalChoice()` cũ đã CHUYỂN sang
 * event/workflow/settings-nav.js (modal xác nhận đặt ở workflow, đúng quy tắc — core không biết
 * modalChoice tồn tại) + event/listener/settings-nav.js. 2 hàm dưới đây là core THUẦN: chỉ làm
 * đúng hành động (dọn state / reset config) + reload, không tự hỏi xác nhận gì cả.
 *
 * PHẢI nạp SAU: resume-state-storage.js (cần clearResumeFlag/clearResumeStateFromLocalStorage),
 * service/state.js (cần CONST.DEFAULT_VIZ_CONFIG), config.js (cần vizConfig),
 * equalizer-settings.js (cần saveConfig()).
 */
        /** Core thuần: dọn state RAM tạm (resume) rồi reload. Không hỏi xác nhận gì ở đây. */
        function executeRestartApp() {
            if (typeof clearResumeFlag === 'function') clearResumeFlag();
            if (typeof clearResumeStateFromLocalStorage === 'function') clearResumeStateFromLocalStorage();
            location.reload();
        }

        /** Core thuần: reset vizConfig về default rồi reload. Không hỏi xác nhận gì ở đây.
         * FIX (cùng bug "chỉnh EQ không có kết quả", xem comment đầy đủ ở service/state.js chỗ khởi
         * tạo vizConfig lần đầu) — { ...CONST.DEFAULT_VIZ_CONFIG } là spread NÔNG, field `manualEq`
         * (mảng, bị Object.freeze() trong CONST.DEFAULT_VIZ_CONFIG — bản mẫu, ĐÚNG nên đóng băng)
         * copy theo REFERENCE chứ không phải bản sao — tự tạo mảng MỚI độc lập cho chắc, dù
         * saveConfig()+reload() ngay sau đó thường "tự gột" lại đúng qua loadConfig() (JSON.parse
         * luôn trả mảng thường), phòng hờ nếu có gì đó đọc vizConfig TRƯỚC lúc reload kịp chạy. */
        function executeRestoreDefaults() {
            appState.set('vizConfig', { ...CONST.DEFAULT_VIZ_CONFIG, manualEq: [...CONST.DEFAULT_VIZ_CONFIG.manualEq] });
            saveConfig();
            location.reload();
        }
