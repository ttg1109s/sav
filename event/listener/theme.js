/**
 * event/listener/theme.js — TẤT CẢ listener của cụm "theme" (MỞ ĐẦU THEME THẬT, 07/07/2026).
 * 3 card TĨNH (Main list, KHÔNG di chuyển) — dùng listener trực tiếp, KHÔNG cần delegation.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */
[themeModeCardLight, themeModeCardDark, themeModeCardBackground].forEach((card) => {
    if (!card) return; // guard
    card.addEventListener('click', () => {
        eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: card.dataset.themeMode } });
    });
});
