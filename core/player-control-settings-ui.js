/**
 * core/player-control-settings-ui.js — cụm "Player control" ở Settings > Theme: gắn listener (`wirePlayerControlSettings`) và vá
 * tại chỗ theo giá trị mới (`patchPlayerControlSettings`). Markup: components/settings/theme.js::renderPlayerControlSettingsHtml();
 * giá trị: computePlayerControlView() (core/player-control-style.js), Workflow truyền vào.
 */

/** Gắn listener — callback chỉ `eventBus.send()` (Rule 5a), gom cuối. Không có cụm -> không gắn gì. @param {HTMLElement} rootEl */
function wirePlayerControlSettings(rootEl) {
    const styleButtons = rootEl.querySelectorAll('[data-pc-style-pick]');
    const opacityInput = rootEl.querySelector('#player-control-opacity');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    styleButtons.forEach((btn) => btn.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.playerControlStyle.click', payload: { style: btn.dataset.pcStylePick } })));
    if (opacityInput) opacityInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.playerControlOpacity.input', payload: { value: e.target.value } }));
}

/**
 * Vá TẠI CHỖ (không dựng lại — gọi được lúc đang kéo slider; cũng là bước điền slot ngay sau khi dựng): nút kiểu nền đang
 * chọn, số %, slider (trừ khi đang được chạm), ẩn/hiện hàng độ đục, khung xem trước (kiểu nền, độ đục, màu effect). Trả phần
 * tử cụm để Workflow áp lại UI theme cho `data-uitk` vừa đổi; không có cụm -> null.
 * @param {HTMLElement} rootEl @param {ReturnType<typeof computePlayerControlView>} view @returns {HTMLElement|null}
 */
function patchPlayerControlSettings(rootEl, view) {
    const cluster = rootEl.querySelector('#player-control-settings');
    if (!cluster) return null;
    cluster.querySelectorAll('[data-pc-style-pick]').forEach((btn) => {
        const item = view.items.find((it) => it.style === btn.dataset.pcStylePick);
        if (!item) return;
        btn.dataset.uitk = item.uitk;
        btn.setAttribute('aria-pressed', String(item.selected));
    });
    const valueEl = cluster.querySelector('#player-control-opacity-value');
    if (valueEl) valueEl.textContent = `${view.opacityPct}%`;
    const input = cluster.querySelector('#player-control-opacity');
    if (input && document.activeElement !== input && Number(input.value) !== view.opacityPct) input.value = String(view.opacityPct);
    const opacityRow = cluster.querySelector('#player-control-opacity-row');
    if (opacityRow) opacityRow.classList.toggle('hidden', !view.showOpacity);
    const preview = cluster.querySelector('[data-pc-preview]');
    if (preview) preview.style.setProperty('--progress-fill', view.accentColor);
    const surface = cluster.querySelector('[data-pc-preview-surface]');
    if (surface) {
        surface.dataset.pcStyle = view.style;
        surface.style.setProperty('--pc-alpha', String(view.alpha));
    }
    return cluster;
}
