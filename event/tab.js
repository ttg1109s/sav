/**
 * event/tab.js — lifecycle listener của tab: dọn tài nguyên khi tab thật sự bị đóng/unload
 * (F5, đóng tab, điều hướng sang trang khác). Gọi thẳng hàm, không qua bus (không có ngữ cảnh
 * DOM cụ thể, không có msg.type nghiệp vụ hợp lý để đặt tên).
 *
 * PHẢI nạp SAU: core/app-cleanup.js (executeAppCleanup).
 * NẠP CUỐI CÙNG trong khối /event/ (sau tất cả router/listener khác) vì đây là
 * lifecycle toàn trang, không phụ thuộc thứ tự với các cụm nghiệp vụ còn lại.
 */
window.addEventListener('beforeunload', () => {
    executeAppCleanup();
});
