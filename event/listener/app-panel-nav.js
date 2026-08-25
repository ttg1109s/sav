/**
 * event/listener/app-panel-nav.js — TẤT CẢ listener của cụm "appPanelNav" (bottom nav App Panel).
 * 1 listener DELEGATED DUY NHẤT trên `appBottomNav` (5 nút, phân biệt qua `data-tab`) — đúng quy
 * ước "listener không biết nghiệp vụ, chỉ gom data + gửi message" (giống playlist.js).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (appBottomNav) {
    appBottomNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.app-bottom-nav-btn');
        if (!btn) return;
        const tab = btn.dataset.tab;
        eventBus.send({ router: 'appPanelNav', type: `appPanelNav.${tab}.click`, payload: {} });
    });
}
