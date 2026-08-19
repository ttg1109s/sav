/**
 * core/app-settings-ui.js — wire nút ĐỘNG của mọi màn Setting (dựng lại mỗi lần
 * `event/workflow/app-settings.js::_render()` chạy) — Rule 5a: DOM động, callback CHỈ
 * `eventBus.send()`, KHÔNG gọi thẳng workflow/core khác. Router "appSettings" (event/router/
 * app-settings.js) nhận message rồi mới gọi `workflowAppSettings` thật.
 *
 * NẠP SAU: event/bus.js.
 * NẠP TRƯỚC: event/workflow/app-settings.js.
 */

/** Header dùng chung mọi màn — nút Back (nếu có) + Close X. */
function wireAppSettingsHeader(headerEl) {
    const backBtn = headerEl.querySelector('#btn-app-settings-back');
    if (backBtn) backBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.back.click', payload: {} }));
    const closeBtn = headerEl.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.close.click', payload: {} }));
}

/** Màn Main — 5 row, mỗi row `data-app-settings-nav` tự mang key đích. */
function wireAppSettingsMain(bodyEl) {
    bodyEl.querySelectorAll('[data-app-settings-nav]').forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: btn.dataset.appSettingsNav } }));
    });
}

/** Màn System — 4 row (Theme/Gesture/Slideshow/Language), CÙNG msg.type với Main (payload.key tự
 * phân biệt — Router đọc key để biết đích, KHÔNG phải rẽ nhánh theo appState khác nên không cần
 * VirtualMachineState, xem event-bus-flow.md mục 4B/(A)). */
function wireAppSettingsSystem(bodyEl) {
    wireAppSettingsMain(bodyEl); // cùng cơ chế data-app-settings-nav — tái dùng thẳng
}

/** Màn Playlist — 2 <select> (Nguồn/Kiểu xem, TÁI DÙNG msg.type gốc của cụm "playlist" — router đó
 * KHÔNG đổi gì) + 2 nút mở Sắp xếp/Lọc (điều hướng nội bộ Setting). */
function wireAppSettingsPlaylist(bodyEl) {
    const mediaSourceSelect = bodyEl.querySelector('#setting-playlist-media-source');
    if (mediaSourceSelect) mediaSourceSelect.addEventListener('change', (e) => eventBus.send({ router: 'playlist', type: 'playlist.mediaSource.change', payload: { source: e.target.value } }));
    const viewModeSelect = bodyEl.querySelector('#setting-playlist-view-mode');
    if (viewModeSelect) viewModeSelect.addEventListener('change', (e) => eventBus.send({ router: 'playlist', type: 'playlist.viewMode.change', payload: { mode: e.target.value } }));
    const sortBtn = bodyEl.querySelector('#setting-open-playlist-sort');
    if (sortBtn) sortBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: 'playlistSort' } }));
    const filterBtn = bodyEl.querySelector('#setting-open-playlist-filter');
    if (filterBtn) filterBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: 'playlistFilter' } }));
}

/** Màn Theme — dropdown Theme (light/dark/glass) + dropdown loại nền glass (solid/gradient/image) +
 * 3 input màu — dropdown Theme/loại nền TÁI DÙNG THẲNG msg.type cụm "theme" gốc (event/router/
 * theme.js KHÔNG đổi gì); riêng "hiện đúng hàng con theo lựa chọn glassType" là thao tác DOM THUẦN
 * (không đổi appState, chỉ đổi cái NGƯỜI DÙNG ĐANG NHÌN trước khi họ chọn xong) — gửi kèm 1
 * msg.type riêng ('appSettings.theme.previewGlassType.click') để Router/Workflow xử lý, ĐÚNG Rule
 * 5a (callback ở đây không tự toggle class). */
function wireAppSettingsTheme(bodyEl) {
    const modeSelect = bodyEl.querySelector('#app-settings-theme-select');
    if (modeSelect) modeSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.theme.selectMode.change', payload: { mode: e.target.value } }));

    const glassTypeSelect = bodyEl.querySelector('#app-settings-theme-glass-type');
    if (glassTypeSelect) glassTypeSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.theme.selectGlassType.change', payload: { glassType: e.target.value, solidColor: bodyEl.querySelector('#app-settings-theme-solid-color').value } }));

    const solidColorInput = bodyEl.querySelector('#app-settings-theme-solid-color');
    if (solidColorInput) solidColorInput.addEventListener('input', (e) => {
        eventBus.send({ router: 'theme', type: 'theme.gradientFrom.input', payload: { value: e.target.value } });
        eventBus.send({ router: 'theme', type: 'theme.gradientTo.input', payload: { value: e.target.value } });
    });
    const gradientFromInput = bodyEl.querySelector('#app-settings-theme-gradient-from');
    if (gradientFromInput) gradientFromInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.gradientFrom.input', payload: { value: e.target.value } }));
    const gradientToInput = bodyEl.querySelector('#app-settings-theme-gradient-to');
    if (gradientToInput) gradientToInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.gradientTo.input', payload: { value: e.target.value } }));
    const imagePickBtn = bodyEl.querySelector('#app-settings-theme-image-pick');
    if (imagePickBtn) imagePickBtn.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: 'background' } }));
}
