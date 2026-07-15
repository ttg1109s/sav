/**
 * App Recovery (ver 10 refine, bổ sung) — 3 hàm core cho "Khởi động lại app", "Khôi phục cài đặt
 * mặc định", và "Xoá cache JS/CSS" (Settings > "Khắc phục sự cố", xem
 * js/components/settings/misc.js). Dành cho lúc trình phát gặp lỗi/hành vi không bình thường mà
 * người dùng không biết chỉnh gì khác ngoài tự bấm F5 — cho họ 1 lối thoát rõ ràng, có xác nhận
 * trước khi thực hiện (modal ở tầng workflow, xem event/workflow/settings-misc.js).
 *
 * executeRestartApp(): xoá hết state RAM TẠM (resume snapshot + cờ trong localStorage — xem
 * resume-state-storage.js) rồi reload — KHÔNG đụng tới nhạc/playlist (IndexedDB) hay vizConfig.
 *
 * executeRestoreDefaults(): CHỈ reset vizConfig về CONST.DEFAULT_VIZ_CONFIG (service/state.js) —
 * GIỮ NGUYÊN nhạc/playlist đã upload. Sau khi reset, vẫn cần reload để UI tự đồng bộ lại qua
 * loadConfig().
 *
 * executeClearCache() (MỚI 14/07/2026): xoá Cache Storage API (nếu có) RỒI điều hướng lại trang
 * với query cache-bust mới — mạnh hơn `location.reload()` đơn thuần, xem docstring tại hàm.
 *
 * ÁP DỤNG /event/ (cụm "settingsMisc"): `addEventListener`+`modalChoice()` cũ đã CHUYỂN sang
 * event/workflow/settings-misc.js (modal xác nhận đặt ở workflow, đúng quy tắc — core không biết
 * modalChoice tồn tại) + event/listener/settings-misc.js. 3 hàm dưới đây là core THUẦN: chỉ làm
 * đúng hành động (dọn state / reset config / xoá cache) + reload/điều hướng, không tự hỏi xác nhận
 * gì cả.
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

        /** MỚI (14/07/2026, Giang yêu cầu — "nút xoá cache js/css cho page") — Core THUẦN: xoá MỌI
         * Cache Storage API (nếu trình duyệt/webview có tạo — app này KHÔNG tự dùng Service Worker
         * nào, nhưng 1 số WebView di động vẫn có thể cache tài nguyên qua cơ chế riêng của hệ điều
         * hành mà `caches` API vẫn truy cập được) RỒI điều hướng LẠI CHÍNH trang hiện tại với 1 query
         * param cache-bust MỚI hoàn toàn (`_cb=<timestamp>`). KHÁC hẳn `executeRestartApp()`
         * (`location.reload()` — chỉ tải lại ĐÚNG URL cũ, nếu trình duyệt đã cache CHÍNH file HTML
         * đó thì reload cũng chỉ lấy lại bản HTML CŨ, kéo theo mọi thẻ `<script src="...?v=...">`
         * bên trong CŨNG là bản CŨ dù file thật trên đĩa đã cập nhật) — đổi hẳn URL (thêm query MỚI)
         * buộc trình duyệt phải coi đây là 1 request KHÁC, không thể phục vụ bằng bản cache nào của
         * URL cũ. Không hỏi xác nhận gì ở đây (Workflow lo phần đó, cùng quy ước 2 hàm trên). */
        async function executeClearCache() {
            if (typeof caches !== 'undefined' && caches.keys) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map((name) => caches.delete(name)));
                } catch (e) {
                    console.warn('[executeClearCache] Lỗi khi xoá Cache Storage API (bỏ qua, vẫn tiếp tục điều hướng lại trang):', e);
                }
            }
            const url = new URL(location.href);
            url.searchParams.set('_cb', Date.now().toString());
            location.href = url.toString();
        }
