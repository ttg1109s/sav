/**
 * event/listener/theme.js — listener tĩnh của cụm "theme": đổi màn App Panel <-> Visualizer và ẩn/hiện app. Cụm 3 card nền
 * (DOM động) gắn ở core/theme-background-ui.js::wireThemeBackgroundCards().
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */
// Đổi màn: quan sát class `playlist-hidden` của #app-stack (gán/gỡ ở nhiều đường khác nhau) thay vì rải lời gọi vào từng nơi
// đổi màn. Chỉ báo khi màn THẬT SỰ đổi (attribute `class` còn đổi vì lý do khác, vd `.hidden`/animation).
if (typeof appStack !== 'undefined' && appStack && typeof MutationObserver !== 'undefined') {
    let lastVisualizerScreenActive = appStack.classList.contains('playlist-hidden');
    new MutationObserver(() => {
        const visualizerScreenActive = appStack.classList.contains('playlist-hidden');
        if (visualizerScreenActive === lastVisualizerScreenActive) return;
        lastVisualizerScreenActive = visualizerScreenActive;
        eventBus.send({ router: 'theme', type: 'theme.appStackScreen.change', payload: { visualizerScreenActive } });
    }).observe(appStack, { attributes: true, attributeFilter: ['class'] });
}

// Ẩn/hiện app (khoá máy, chuyển app, chuyển tab) — dừng/tiếp tục video nền App.
document.addEventListener('visibilitychange', () => {
    eventBus.send({ router: 'theme', type: 'theme.documentVisibility.change', payload: { visible: document.visibilityState !== 'hidden' } });
});
