/**
 * App Recovery (ver 10 refine, bổ sung) — 2 hàm core cho "Khởi động lại app" và "Xoá cache JS/CSS"
 * (Settings > "Khắc phục sự cố", xem js/components/settings/misc.js). Dành cho lúc trình phát gặp
 * lỗi/hành vi không bình thường mà người dùng không biết chỉnh gì khác ngoài tự bấm F5 — cho họ 1
 * lối thoát rõ ràng, có xác nhận trước khi thực hiện (modal ở tầng workflow, xem
 * event/workflow/settings-misc.js).
 *
 * executeRestartApp(): reload trang — KHÔNG đụng tới nhạc/playlist (IndexedDB) hay vizConfig.
 *
 * XOÁ (12/08/2026, Giang chỉ ra 2a/2b "Reset app default" THỰC RA là yêu cầu RESET — không phải
 * loại trừ, bản trước mình hiểu ngược) — executeRestoreDefaults() cũ (CHỈ reset vizConfig) đã
 * CHUYỂN HẲN thành workflowSettingsMisc.confirmRestoreDefaults() (event/workflow/settings-misc.js):
 * giờ phải reset CẢ vizConfig LẪN visualBgConfig LẪN 5 preset EQ gốc trong meta.eqPresets — 3 domain
 * + 2 lượt persist bất đồng bộ (phải ĐỢI ghi xong mới reload, tránh mất trắng do race) không còn là
 * "1 process" Core làm gọn được nữa (Rule 1), nên rời hẳn khỏi core/, KHÔNG còn hàm nào ở file này
 * tên "executeRestoreDefaults" — xem docstring hàm mới ở event/workflow/settings-misc.js.
 *
 * executeClearCache() (MỚI 14/07/2026): xoá Cache Storage API (nếu có) RỒI điều hướng lại trang
 * với query cache-bust mới — mạnh hơn `location.reload()` đơn thuần, xem docstring tại hàm.
 *
 * ÁP DỤNG /event/ (cụm "settingsMisc"): `addEventListener`+`modalChoice()` cũ đã CHUYỂN sang
 * event/workflow/settings-misc.js (modal xác nhận đặt ở workflow, đúng quy tắc — core không biết
 * modalChoice tồn tại) + event/listener/settings-misc.js. Hàm dưới đây là core THUẦN: chỉ làm
 * đúng hành động (dọn state / xoá cache) + reload/điều hướng, không tự hỏi xác nhận gì cả.
 */
        /** Core thuần: reload trang. Không hỏi xác nhận gì ở đây. */
        function executeRestartApp() {
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
