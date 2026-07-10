/**
 * event/listener/theme.js — TẤT CẢ listener của cụm "theme" (MỞ ĐẦU THEME THẬT, 07/07/2026).
 * 4 card TĨNH (Main list, KHÔNG di chuyển) — dùng listener trực tiếp, KHÔNG cần delegation.
 * MỚI (09/07/2026): themeModeCardGradient (card thứ 4) + 2 input màu #setting-theme-gradient-
 * from/to (cũng TĨNH, nằm trong Main list, không phải panel động — không cần delegation).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */
[themeModeCardLight, themeModeCardDark, themeModeCardBackground, themeModeCardGradient].forEach((card) => {
    if (!card) return; // guard
    card.addEventListener('click', () => {
        eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: card.dataset.themeMode } });
    });
});

if (typeof themeGradientFromPicker !== 'undefined' && themeGradientFromPicker) {
    themeGradientFromPicker.addEventListener('input', (e) => {
        eventBus.send({ router: 'theme', type: 'theme.gradientFrom.input', payload: { value: e.target.value } });
    });
}
if (typeof themeGradientToPicker !== 'undefined' && themeGradientToPicker) {
    themeGradientToPicker.addEventListener('input', (e) => {
        eventBus.send({ router: 'theme', type: 'theme.gradientTo.input', payload: { value: e.target.value } });
    });
}
