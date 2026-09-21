/**
 * event/listener/theme.js — TẤT CẢ listener của cụm "theme" (MỞ ĐẦU THEME THẬT, 07/07/2026).
 * DỌN DEADCODE 21/09/2026: khối listener 4 card TĨNH (themeModeCard*) + 2 input màu gradient tĩnh ĐÃ XOÁ — các phần tử đó không còn trong DOM từ khi
 * Theme dời vào Settings (Generic Drawer), luôn là null. UI nền hiện tại (3 card Solid/Gradient/Background media) gắn listener riêng ở
 * core/theme-background-ui.js::wireThemeBackgroundCards(). File này CHỈ còn: theo dõi đổi màn App Panel<->Visualizer và ẩn/hiện app.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */
// MỚI (21/09/2026, Giang chỉ ra "bg của theme không được động chạm phần Visualizer") — theo dõi ĐỔI MÀN App Panel <-> Visualizer (class
// `playlist-hidden` trên #app-stack, gán/gỡ bởi core/player-controls.js ở nhiều đường khác nhau — quan sát class ở ĐÂY thay vì rải lời gọi vào
// từng nơi đổi màn). CHỈ gom dữ liệu + gửi message (listener không biết nghiệp vụ). Có chốt `lastVisualizerScreenActive` để chỉ báo khi màn THẬT
// SỰ đổi (attribute `class` còn đổi vì lý do khác, vd `.hidden`/animation).
if (typeof appStack !== 'undefined' && appStack && typeof MutationObserver !== 'undefined') {
    let lastVisualizerScreenActive = appStack.classList.contains('playlist-hidden');
    new MutationObserver(() => {
        const visualizerScreenActive = appStack.classList.contains('playlist-hidden');
        if (visualizerScreenActive === lastVisualizerScreenActive) return;
        lastVisualizerScreenActive = visualizerScreenActive;
        eventBus.send({ router: 'theme', type: 'theme.appStackScreen.change', payload: { visualizerScreenActive } });
    }).observe(appStack, { attributes: true, attributeFilter: ['class'] });
}

// MỚI (21/09/2026, Giang chọn "video nền chỉ chạy khi ở App Panel, dừng khi ẩn app") — app bị ẩn/hiện lại (khoá máy, chuyển app, chuyển tab) để dừng/tiếp tục
// video nền App. CHỈ gửi message, không biết nghiệp vụ. `document` là phần tử tĩnh sẵn có (không phải DOM động), listener đăng ký 1 lần.
document.addEventListener('visibilitychange', () => {
    eventBus.send({ router: 'theme', type: 'theme.documentVisibility.change', payload: { visible: document.visibilityState !== 'hidden' } });
});
