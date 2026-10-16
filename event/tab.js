/**
 * event/tab.js — lifecycle của tab: dọn tài nguyên khi tab thật sự bị đóng/unload (F5, đóng tab, điều hướng trang khác).
 * Gọi thẳng `workflowAppCleanup.run()`, không qua bus (không có ngữ cảnh DOM, không có msg.type nghiệp vụ hợp lý).
 *
 * NẠP SAU: event/workflow/app-cleanup.js. Nạp cuối khối /event/ (lifecycle toàn trang, không phụ thuộc cụm khác).
 */
window.addEventListener('beforeunload', () => {
    workflowAppCleanup.run();
});
