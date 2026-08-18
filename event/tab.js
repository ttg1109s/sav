/**
 * event/tab.js — 3 lifecycle listener đặc thù của tab, gọi thẳng hàm (không qua bus).
 *
 * Không qua bus vì không có định tuyến: mỗi sự kiện ánh xạ 1-1 đến đúng 1 hàm,
 * không có ngữ cảnh DOM cụ thể (không phải click nút hay input nào), không có
 * msg.type nghiệp vụ hợp lý để đặt tên.
 *
 * scheduleHideAndReload() — orchestration debounce (chờ HIDE_RELOAD_DEBOUNCE_MS rồi mới đọc lại
 * _isRealUnloadHappening để phân biệt "ẩn tab thật" vs "F5/đóng tab") — cố ý đặt Ở ĐÂY chứ không
 * trong core/tab-hide-reload.js: đây là kiểu đọc-state-SAU-khi-chờ, không phải "chuẩn bị dữ liệu rồi
 * gọi Core" thông thường, và file này vốn đã là ngoại lệ đứng ngoài bus, tự đọc/ghi appState trực
 * tiếp (beforeunload bên dưới cũng vậy) — không hợp lý tách riêng 1 Workflow chỉ cho việc này.
 *
 * Tập trung ở đây để dễ mở rộng: thêm việc cần làm khi ẩn/đóng tab → sửa đúng chỗ này,
 * không phải lùng trong từng file core.
 *
 * PHẢI nạp SAU: core/tab-hide-reload.js (pauseAndSaveResumeState, HIDE_RELOAD_DEBOUNCE_MS),
 *   core/app-cleanup.js (executeAppCleanup).
 * NẠP CUỐI CÙNG trong khối /event/ (sau tất cả router/listener khác) vì đây là
 * lifecycle toàn trang, không phụ thuộc thứ tự với các cụm nghiệp vụ còn lại.
 */
let _hideReloadInProgress = false; // biến NỘI BỘ (không thuộc STATE) — chỉ dùng trong file này

function scheduleHideAndReload() {
    if (_hideReloadInProgress) return; // chặn gọi chồng (visibilitychange + pagehide cùng bắn)
    _hideReloadInProgress = true;
    appState.set('_isRealUnloadHappening', false); // reset trước khi chờ — đo lại đúng cho lượt này

    setTimeout(() => {
        _hideReloadInProgress = false; // mở lại ngay, phòng trường hợp ẩn/hiện/ẩn liên tục
        if (appState.get('_isRealUnloadHappening')) return; // F5/đóng tab/điều hướng thật → không làm gì cả
        pauseAndSaveResumeState(appState.get('gameplayPhase'));
    }, HIDE_RELOAD_DEBOUNCE_MS);
}

// ── Ẩn tab thật (chuyển tab, khoá máy, thu nhỏ) ─────────────────────────────
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') scheduleHideAndReload();
});

// ── Dự phòng iOS Safari (pagehide đáng tin hơn visibilitychange trên WebKit) ─
window.addEventListener('pagehide', scheduleHideAndReload);

// ── F5 / đóng tab / điều hướng thật ─────────────────────────────────────────
window.addEventListener('beforeunload', () => {
    appState.set('_isRealUnloadHappening', true); // huỷ scheduleHideAndReload() đang chờ (nếu có)
    executeAppCleanup();
});
