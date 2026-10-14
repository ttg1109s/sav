/**
 * core/theme-background-ui.js — cụm 3 card nền Morphin (None / Gradient / Background media) + hàng "Panel glass" ở Settings >
 * Theme: gắn listener (`wireThemeBackgroundCards`) và vá tại chỗ theo trạng thái mới (`patchThemeBackgroundCards`). Markup:
 * components/settings/theme.js; trạng thái: computeThemeBackgroundView().cards (core/theme-background.js), Workflow truyền vào.
 */

/**
 * Gắn listener cho cụm 3 card vừa dựng — callback chỉ `eventBus.send()` (Rule 5a), gom cuối. Chạm ô màu Gradient cũng là chọn
 * card Gradient (Workflow lo). Không có cụm (Color khác Morphin) -> các ô không tồn tại, bỏ qua.
 * @param {HTMLElement} rootEl
 */
function wireThemeBackgroundCards(rootEl) {
    const cards = rootEl.querySelectorAll('[data-theme-bg-card]');
    const pickButtons = rootEl.querySelectorAll('[data-theme-bg-pick]');
    const fromInput = rootEl.querySelector('#theme-bg-gradient-from');
    const toInput = rootEl.querySelector('#theme-bg-gradient-to');
    const glassBlurInput = rootEl.querySelector('#theme-glass-blur');
    const glassTintInput = rootEl.querySelector('#theme-glass-tint');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    cards.forEach((card) => card.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: card.dataset.themeBgCard } })));
    pickButtons.forEach((btn) => btn.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.pickBackgroundMedia.click', payload: { kind: btn.dataset.themeBgPick } })));
    if (fromInput) fromInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.gradientFrom.input', payload: { value: e.target.value } }));
    if (toInput) toInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.gradientTo.input', payload: { value: e.target.value } }));
    if (glassBlurInput) glassBlurInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.glassBlur.input', payload: { value: e.target.value } }));
    if (glassTintInput) glassTintInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.glassTint.input', payload: { value: e.target.value } }));
}

/**
 * Vá TẠI CHỖ cụm 3 card (key theme của card, tick, preview, khung "chưa có media", dấu play, ô màu, hàng kính) — không dựng
 * lại DOM, nên gọi được lúc đang kéo ô màu/slider (dựng lại sẽ đóng bảng chọn màu giữa chừng). Ô đang được chạm
 * (`document.activeElement`) giữ nguyên giá trị. Trả phần tử cụm để Workflow áp lại UI theme (`data-uitk` của card vừa đổi);
 * cụm không có trong DOM (Settings không ở màn Theme, hoặc Color khác Morphin) -> trả null.
 * @param {HTMLElement} rootEl - phần tử chứa `#theme-bg-cards` (vd genericDrawerBody)
 * @param {ThemeBgCardsView} view
 * @returns {HTMLElement|null}
 */
function patchThemeBackgroundCards(rootEl, view) {
    const cluster = rootEl.querySelector('#theme-bg-cards');
    if (!cluster) return null;
    cluster.querySelectorAll('[data-theme-bg-card]').forEach((card) => {
        const item = view.byMode[card.dataset.themeBgCard];
        if (!item) return;
        card.dataset.uitk = item.uitk;
        const check = card.querySelector('[data-theme-bg-check]');
        if (check) { check.classList.toggle('hidden', !item.selected); check.classList.toggle('flex', item.selected); }
        const preview = card.querySelector('[data-theme-bg-preview]');
        if (preview) preview.style.cssText = item.previewStyle;
        const empty = card.querySelector('[data-theme-bg-empty]');
        if (empty) { empty.classList.toggle('hidden', !item.showEmpty); empty.classList.toggle('flex', item.showEmpty); }
        const videoBadge = card.querySelector('[data-theme-bg-video-badge]');
        if (videoBadge) { videoBadge.classList.toggle('hidden', !item.showVideoBadge); videoBadge.classList.toggle('flex', item.showVideoBadge); }
    });
    [['#theme-bg-gradient-from', view.gradientFrom], ['#theme-bg-gradient-to', view.gradientTo]].forEach(([selector, value]) => {
        const input = cluster.querySelector(selector);
        if (input && document.activeElement !== input && input.value !== value) input.value = value;
    });
    const glassRow = cluster.querySelector('#theme-glass-row');
    if (glassRow) glassRow.classList.toggle('hidden', !view.showGlassRow);
    [['blur', view.glassBlur, 'px'], ['tint', view.glassTint, '%']].forEach(([part, value, unit]) => {
        const valueEl = cluster.querySelector(`#theme-glass-${part}-value`);
        if (valueEl) valueEl.textContent = `${value}${unit}`;
        const input = cluster.querySelector(`#theme-glass-${part}`);
        if (input && document.activeElement !== input && Number(input.value) !== value) input.value = String(value);
    });
    return cluster;
}
