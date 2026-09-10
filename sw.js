/**
 * sw.js — MỚI (10/09/2026, Giang yêu cầu "tạm thời dùng Service Worker" cho vấn đề tải file zip lớn
 * (>500MB) bị lỗi "WebKitBlobResource error 1" trên Safari khi dùng `<a download>` với `blob:` URL
 * (đã thử + xác nhận qua log thật — cả `navigator.share()` lẫn `<a download>`/`blob:` đều không
 * đáng tin cậy với file rất lớn, đây là bug WebKit đã ghi nhận từ 2019, chưa sửa tới nay). Cách
 * khắc phục DUY NHẤT tìm được có cơ sở kỹ thuật: dùng Cache Storage API + Service Worker để phục vụ
 * file qua 1 URL CÙNG ORIGIN THẬT (KHÔNG phải `blob:`) — Safari xử lý đây như 1 tải file MẠNG bình
 * thường, né hẳn lớp bug đó (đúng cách WebKit tự gợi ý sửa cho 1 bug tương tự, #232076).
 *
 * File này CHỈ làm ĐÚNG 1 việc: chặn request tới đúng 1 tiền tố URL cố định
 * (`SAV_DOWNLOAD_PATH_PREFIX` — PHẢI khớp hằng số CÙNG TÊN trong core/large-file-download.js, nơi
 * ghi file vào Cache Storage TRƯỚC khi điều hướng tới URL này) và trả lời từ cache — KHÔNG cache gì
 * khác, KHÔNG có ý định làm "app offline" hay PWA cache-first đầy đủ (ngoài phạm vi yêu cầu hiện
 * tại) — mọi request KHÁC tiền tố này được bỏ qua hoàn toàn (`return` sớm trong 'fetch', KHÔNG gọi
 * `event.respondWith()`), để trình duyệt tự xử lý y hệt như không có Service Worker nào cả.
 *
 * CHỈ hoạt động khi app chạy qua HTTPS (Service Worker BẮT BUỘC "secure context", KHÔNG đăng ký
 * được qua `file://`) — core/large-file-download.js::registerLargeFileDownloadWorker() tự kiểm tra
 * + không throw nếu môi trường không hỗ trợ, nơi gọi (core/id3-export.js) tự rơi về nhánh cũ
 * (`<a download>` với `blob:`/`navigator.share()`) nếu Service Worker này không khả dụng.
 *
 * ĐẶT Ở GỐC DỰ ÁN (cùng cấp index.html, KHÔNG phải trong core/): phạm vi (scope) mặc định của 1
 * Service Worker chỉ bao trùm chính thư mục chứa nó trở xuống — đặt trong core/ sẽ KHÔNG chặn được
 * request ở đường dẫn gốc (`/__sav-download__/...`).
 */

const SAV_DOWNLOAD_CACHE = 'sav-download-cache-v1'; // PHẢI khớp hằng số cùng tên trong core/large-file-download.js
const SAV_DOWNLOAD_PATH_PREFIX = '/__sav-download__/'; // PHẢI khớp hằng số cùng tên trong core/large-file-download.js

self.addEventListener('install', () => {
    // skipWaiting() — kích hoạt bản SW mới ngay, không đợi mọi tab cũ đóng hết: file này không cache
    // gì lâu dài/không có khái niệm "phiên bản asset cũ" cần giữ, an toàn để thay thế ngay lập tức.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // clients.claim() — điều khiển NGAY các tab đang mở sẵn (không cần người dùng tải lại trang) để
    // Service Worker có hiệu lực chặn fetch() kịp lúc người dùng bấm "Tải xuống" lần đầu sau khi cài.
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (!url.pathname.startsWith(SAV_DOWNLOAD_PATH_PREFIX)) return; // KHÔNG phải request tải file lớn -> bỏ qua hoàn toàn, để trình duyệt tự xử lý như không có SW nào
    event.respondWith((async () => {
        const cache = await caches.open(SAV_DOWNLOAD_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        // Không tìm thấy (đã bị dọn/hết hạn, hoặc bấm lại link cũ) — 404 rõ ràng thay vì để trình
        // duyệt tự đoán, core/large-file-download.js không có cơ chế retry cho case hiếm này.
        return new Response('Không tìm thấy file để tải (có thể đã hết hạn) — Service Worker sav-download.', { status: 404 });
    })());
});
