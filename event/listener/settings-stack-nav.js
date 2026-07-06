/**
 * event/listener/settings-stack-nav.js — TẤT CẢ listener của cụm "settingsStackNav".
 *
 * `btnSettingsStackBack` là phần tử TĨNH (sống trong header dùng chung của #drawer-settings, xem
 * components/settings-drawer.js — KHÔNG bị xoá/tạo lại như các panel con), nên gắn listener 1 LẦN
 * ở đây lúc boot là đủ, giống các listener khác — KHÔNG cần event delegation cho riêng nút này.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnSettingsStackBack) {
    btnSettingsStackBack.addEventListener('click', () => {
        eventBus.send({ router: 'settingsStackNav', type: 'settingsStackNav.back.click', payload: {} });
    });
}
