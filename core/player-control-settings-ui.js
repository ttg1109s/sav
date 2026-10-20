/**
 * core/player-control-settings-ui.js — cụm "Player control" ở Settings > Theme: gắn listener (`wirePlayerControlSettings`) và vá
 * tại chỗ theo giá trị mới (`patchPlayerControlSettings`). Markup: components/settings/theme.js::renderPlayerControlSettingsHtml();
 * giá trị: computePlayerControlView() (core/player-control-style.js), Workflow truyền vào.
 */

/** Gắn listener — callback chỉ `eventBus.send()` (Rule 5a), gom cuối. Không có cụm -> không gắn gì. @param {HTMLElement} rootEl */
function wirePlayerControlSettings(rootEl) {
    const styleButtons = rootEl.querySelectorAll('[data-pc-style-pick]');
    const subtitleButtons = rootEl.querySelectorAll('[data-pc-sub-pick]');
    const opacityInput = rootEl.querySelector('#player-control-opacity');
    const coverInput = rootEl.querySelector('#player-control-cover');
    const gapInput = rootEl.querySelector('#player-control-sub-gap');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    styleButtons.forEach((btn) => btn.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.playerControlStyle.click', payload: { style: btn.dataset.pcStylePick } })));
    subtitleButtons.forEach((btn) => btn.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.playerControlSubtitle.click', payload: { placement: btn.dataset.pcSubPick } })));
    if (opacityInput) opacityInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.playerControlOpacity.input', payload: { value: e.target.value } }));
    if (coverInput) coverInput.addEventListener('change', (e) => eventBus.send({ router: 'theme', type: 'theme.playerControlCover.change', payload: { checked: e.target.checked } }));
    if (gapInput) gapInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.playerControlSubtitleGap.input', payload: { value: e.target.value } }));
}

/**
 * Vá TẠI CHỖ (gọi được lúc đang kéo slider; cũng là bước điền slot ngay sau khi dựng): nút đang chọn (kiểu nền, vị trí phụ
 * đề), số + slider (trừ slider đang được chạm), công tắc bìa, ẩn/hiện hàng độ đục / khoảng cách, khung xem trước. Trả phần tử
 * cụm để Workflow áp lại UI theme cho `data-uitk` vừa đổi; không có cụm -> null.
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
    cluster.querySelectorAll('[data-pc-sub-pick]').forEach((btn) => {
        const item = view.subtitleItems.find((it) => it.placement === btn.dataset.pcSubPick);
        if (!item) return;
        btn.dataset.uitk = item.uitk;
        btn.setAttribute('aria-pressed', String(item.selected));
    });
    const opacityValueEl = cluster.querySelector('#player-control-opacity-value');
    if (opacityValueEl) opacityValueEl.textContent = `${view.opacityPct}%`;
    const opacityInput = cluster.querySelector('#player-control-opacity');
    if (opacityInput && document.activeElement !== opacityInput && Number(opacityInput.value) !== view.opacityPct) opacityInput.value = String(view.opacityPct);
    const opacityRow = cluster.querySelector('#player-control-opacity-row');
    if (opacityRow) opacityRow.classList.toggle('hidden', !view.showOpacity);
    const coverInput = cluster.querySelector('#player-control-cover');
    if (coverInput) coverInput.checked = view.coverOn;
    const gapValueEl = cluster.querySelector('#player-control-sub-gap-value');
    if (gapValueEl) gapValueEl.textContent = `${view.subtitleGapPx}px`;
    const gapInput = cluster.querySelector('#player-control-sub-gap');
    if (gapInput && document.activeElement !== gapInput && Number(gapInput.value) !== view.subtitleGapPx) gapInput.value = String(view.subtitleGapPx);
    const gapRow = cluster.querySelector('#player-control-sub-gap-row');
    if (gapRow) gapRow.classList.toggle('hidden', !view.showSubtitleGap);
    const preview = cluster.querySelector('[data-pc-preview]');
    if (preview) {
        preview.style.setProperty('--progress-fill', view.accentColor);
        preview.style.setProperty('--pc-sub-gap', `${view.subtitleGapPx}px`);
        preview.dataset.pcSub = view.subtitlePlacement;
    }
    const surface = cluster.querySelector('[data-pc-preview-surface]');
    if (surface) {
        surface.dataset.pcStyle = view.style;
        surface.dataset.pcCover = view.coverOn ? 'on' : 'off';
        surface.style.setProperty('--pc-alpha', String(view.alpha));
    }
    return cluster;
}
