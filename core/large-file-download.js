/**
 * core/large-file-download.js — MỚI (10/09/2026, Giang yêu cầu, sau khi xác nhận qua log/ảnh chụp
 * thật trên thiết bị) — 2 đường tải file hiện có ĐỀU không đáng tin cậy với file rất lớn (zip
 * >500MB) trên Safari:
 *   1. `navigator.share({files:[...]})` (core/id3-export.js) — CRASH app (nghi do phải bàn giao
 *      toàn bộ dữ liệu qua tiến trình OS, không "stream" được).
 *   2. `<a download>` với Blob URL (`blob:...`) — KHÔNG crash nhưng lỗi rõ ràng "Không thể hoàn tất
 *      tác vụ (Lỗi WebKitBlobResource 1.)" — bug WebKit ĐÃ GHI NHẬN TỪ 2019 (nhiều báo cáo độc lập,
 *      gần nhất tháng 12/2024), CHƯA được sửa, chỉ xảy ra với URL `blob:` lớn, KHÔNG phải lỗi code
 *      app — tìm kiếm không thấy cách vá ở tầng JS cho chính đường `blob:` này.
 *
 * CÁCH KHẮC PHỤC duy nhất tìm được có cơ sở kỹ thuật thật (đúng cách WebKit tự gợi ý sửa cho 1 bug
 * tương tự khi tải video lớn, #232076): dùng Cache Storage API + Service Worker (sw.js, gốc dự án)
 * để phục vụ file qua 1 URL CÙNG ORIGIN THẬT (`/__sav-download__/<tên file>`, KHÔNG phải `blob:`) —
 * Safari xử lý đây như 1 tải file MẠNG bình thường, né hẳn lớp bug "WebKitBlobResource".
 *
 * ĐÁNH ĐỔI ĐÃ BIẾT TRƯỚC (Giang xác nhận "tạm thời dùng Service Worker", chấp nhận đánh đổi này):
 *   - Service Worker BẮT BUỘC "secure context" — CHỈ hoạt động khi app chạy qua HTTPS, KHÔNG đăng
 *     ký được qua `file://` (1 trong 2 cách chạy chính thức của app, xem quy ước xuyên suốt dự án).
 *     Chạy qua `file://` thì `registerLargeFileDownloadWorker()` tự nhận biết + im lặng bỏ qua,
 *     `isLargeFileDownloadSupported()` trả `false`, nơi gọi (core/id3-export.js) tự rơi về nhánh cũ
 *     (`<a download>` với `blob:`) — KHÔNG throw, KHÔNG chặn tính năng tải file khác, chỉ riêng file
 *     RẤT LỚN qua `file://` vẫn còn dính đúng bug WebKit chưa có cách vá.
 *   - CHƯA KIỂM CHỨNG THỰC TẾ trên thiết bị — Giang cần tự test lại với file zip lớn thật sau khi
 *     deploy qua HTTPS (GitHub Pages hoặc tương đương) trước khi coi đây đã xong dứt điểm.
 *
 * NẠP SAU: (không phụ thuộc file core nào khác).
 * NẠP TRƯỚC: core/id3-export.js (gọi `isLargeFileDownloadSupported()`/
 * `triggerLargeFileDownloadViaServiceWorker()`), event/workflow/app-boot.js (gọi
 * `registerLargeFileDownloadWorker()` 1 lần lúc boot).
 */

const SAV_DOWNLOAD_CACHE = 'sav-download-cache-v1'; // PHẢI khớp hằng số cùng tên trong sw.js
const SAV_DOWNLOAD_PATH_PREFIX = '/__sav-download__/'; // PHẢI khớp hằng số cùng tên trong sw.js
const SAV_DOWNLOAD_CACHE_CLEANUP_DELAY_MS = 60000; // xem giải thích ở triggerLargeFileDownloadViaServiceWorker()

let _swRegisterPromise = null;

/**
 * Đăng ký sw.js — gọi 1 LẦN lúc boot (event/workflow/app-boot.js::boot()). KHÔNG throw nếu môi
 * trường không hỗ trợ (`file://`, HTTP không mã hoá, trình duyệt cũ không có `navigator.
 * serviceWorker`) — chỉ `console.warn()` rồi thôi; `isLargeFileDownloadSupported()` (ngay dưới) là
 * nơi DUY NHẤT nơi gọi cần kiểm tra trước khi dùng, không cần bọc try/catch riêng quanh hàm này.
 * Idempotent — gọi nhiều lần chỉ đăng ký/kiểm tra 1 lần thật sự (nhờ `_swRegisterPromise` memo hoá).
 * @returns {Promise<void>}
 */
function registerLargeFileDownloadWorker() {
    if (_swRegisterPromise) return _swRegisterPromise;
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        console.warn('[large-file-download] navigator.serviceWorker không tồn tại (thường do chạy qua file:// hoặc HTTP không mã hoá) — tính năng tải file lớn qua Service Worker sẽ không khả dụng, tự rơi về <a download> với blob:.');
        _swRegisterPromise = Promise.resolve();
        return _swRegisterPromise;
    }
    _swRegisterPromise = navigator.serviceWorker.register('./sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => {}) // chuẩn hoá kết quả về undefined, nơi gọi không cần giá trị trả về
        .catch((err) => {
            console.warn('[large-file-download] Đăng ký Service Worker (sw.js) thất bại — tính năng tải file lớn qua đường này sẽ không khả dụng, tự rơi về <a download> với blob::', err);
        });
    return _swRegisterPromise;
}

/**
 * Kiểm tra NHANH (đồng bộ) có dùng được đường Service Worker cho tải file lớn hay không — PHẢI có
 * `navigator.serviceWorker.controller` (không chỉ đăng ký xong — phải THẬT SỰ đang điều khiển trang
 * hiện tại, xem `clients.claim()` trong sw.js) thì request tới `SAV_DOWNLOAD_PATH_PREFIX` mới chắc
 * chắn được sw.js chặn đúng lúc cần.
 * @returns {boolean}
 */
function isLargeFileDownloadSupported() {
    return typeof navigator !== 'undefined' && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
}

/**
 * Ghi `blob` vào Cache Storage dưới 1 URL CÙNG ORIGIN cố định rồi điều hướng tới đó (`<a
 * download>` trên URL đó, KHÔNG phải `blob:`) để kích hoạt tải — sw.js chặn request này, trả lời
 * từ cache. Xem docstring đầu file để biết đầy đủ lý do/bằng chứng.
 *
 * DỌN CACHE: không có cách biết CHÍNH XÁC lúc trình duyệt đọc xong file tải về (điều hướng tải file
 * không bắn sự kiện "đã xong" nào về JS, khác hẳn `navigator.share()`/`fetch()` có Promise chờ
 * được) — xoá entry cache SAU 1 khoảng trễ cố định (`SAV_DOWNLOAD_CACHE_CLEANUP_DELAY_MS`, 60s, đủ
 * rộng cho hầu hết trường hợp) thay vì chờ tín hiệu hoàn tất không tồn tại.
 * @param {Blob} blob @param {string} filename
 * @returns {Promise<void>}
 */
async function triggerLargeFileDownloadViaServiceWorker(blob, filename) {
    const cache = await caches.open(SAV_DOWNLOAD_CACHE);
    const url = SAV_DOWNLOAD_PATH_PREFIX + encodeURIComponent(filename);
    const response = new Response(blob, {
        headers: {
            'Content-Type': blob.type || 'application/octet-stream',
            'Content-Length': String(blob.size),
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
    await cache.put(url, response);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => { cache.delete(url).catch((e) => { /* dọn thất bại — bỏ qua, không nghiêm trọng, chỉ tích 1 entry cache tạm */ }); }, SAV_DOWNLOAD_CACHE_CLEANUP_DELAY_MS);
}
