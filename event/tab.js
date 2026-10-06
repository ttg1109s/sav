/**
 * event/tab.js — lifecycle listener của tab: dọn tài nguyên khi tab thật sự bị đóng/unload
 * (F5, đóng tab, điều hướng sang trang khác). Gọi thẳng hàm, không qua bus (không có ngữ cảnh
 * DOM cụ thể, không có msg.type nghiệp vụ hợp lý để đặt tên).
 *
 * SỬA (06/10/2026, dọn nợ Rule 2/3) — gọi `workflowAppCleanup.run()` (event/workflow/app-cleanup.js) thay cho core
 * `executeAppCleanup()` (core/app-cleanup.js — ĐÃ XOÁ). Bước ghi nốt thống kê từng media giờ nằm trong workflow đó.
 *
 * PHẢI nạp SAU: event/workflow/app-cleanup.js.
 * NẠP CUỐI CÙNG trong khối /event/ (sau tất cả router/listener khác) vì đây là
 * lifecycle toàn trang, không phụ thuộc thứ tự với các cụm nghiệp vụ còn lại.
 */
window.addEventListener('beforeunload', () => {
    workflowAppCleanup.run();
});
