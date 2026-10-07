/**
 * service/boot-preloader.js — phần CHẠY SỚM của Preloader (index.html). Nạp ĐỒNG BỘ trong <head>, trước mọi file khác:
 * script <head> chạy xong trình duyệt mới vẽ khung đầu tiên, nên nền theo theme có sẵn ngay — không chớp nền trắng.
 *
 * Lúc này <body> và #app-preloader CHƯA tồn tại -> chỉ gắn class + biến CSS lên <html>; CSS của Preloader (khối <style>
 * đầu <body>) tự áp theo đó:
 *   - `app-preloader-dark`     — theme dark hoặc morphin.
 *   - `app-preloader-morphin`  — morphin; nền lấy từ `--app-preloader-bg`.
 *   - `app-boot-statusbar`     — morphin có màu status bar; <body> tô `--app-boot-statusbar` tới lần
 *                                applyStatusBarColor() đầu tiên (core/ui-theme/status-bar-color.js — hàm đó gỡ class này).
 *                                CHỈ <body>, không <html> (lý do: xem docstring hàm đó).
 * Theme đọc qua localStorage (`uiThemeName`, `uiThemeBoot` — bản sao do event/workflow/ui-theme.js ghi) vì IndexedDB bất
 * đồng bộ. localStorage bị chặn (Private Mode) -> giữ Light.
 *
 * Ẩn Preloader = class `app-preloader-hidden` trên <html> (CSS lo fade + visibility, không gỡ phần tử). Đường chính:
 * event/workflow/app-boot.js gọi hideAppPreloader() (core/loading-shield-util.js) khi Playlist dựng xong.
 *
 * NGOẠI LỆ ĐÃ DUYỆT (Giang, 07/10/2026): file khởi động chạy trước toàn bộ kiến trúc (chưa có eventBus/taskManager),
 * nên được đọc localStorage và dùng `setTimeout` thô cho LƯỚI AN TOÀN 10 giây — boot lỗi giữa chừng thì Preloader vẫn tự
 * ẩn, không kẹt màn hình. Lưới này phải độc lập với mọi file nạp sau, đúng lý do nó tồn tại.
 */
(function () {
    var rootEl = document.documentElement;
    try {
        var savedUiTheme = localStorage.getItem('uiThemeName');
        if (savedUiTheme === 'dark' || savedUiTheme === 'morphin') rootEl.classList.add('app-preloader-dark');
        if (savedUiTheme === 'morphin') {
            rootEl.classList.add('app-preloader-morphin');
            var bootBackdrop = null;
            try { bootBackdrop = JSON.parse(localStorage.getItem('uiThemeBoot') || 'null'); } catch (e2) { bootBackdrop = null; }
            var preloaderBg = (bootBackdrop && typeof bootBackdrop.preloaderBg === 'string' && bootBackdrop.preloaderBg) || '#0f172a'; // slate-900 = appBaseBg của Morphin
            rootEl.style.setProperty('--app-preloader-bg', preloaderBg);
            var statusBar = bootBackdrop && typeof bootBackdrop.statusBar === 'string' ? bootBackdrop.statusBar : '';
            if (statusBar) {
                rootEl.style.setProperty('--app-boot-statusbar', statusBar);
                rootEl.classList.add('app-boot-statusbar');
                var themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
                for (var i = 0; i < themeColorMetas.length; i++) themeColorMetas[i].setAttribute('content', statusBar);
            }
        }
    } catch (e) { /* localStorage bị chặn — giữ Light mặc định */ }

    setTimeout(function () {
        if (rootEl.classList.contains('app-preloader-hidden')) return;
        console.warn('[preloader] Boot chưa xong sau 10s — tự ẩn preloader (lưới an toàn), có thể do lỗi JS trong lúc boot.');
        rootEl.classList.add('app-preloader-hidden');
    }, 10000);
})();
