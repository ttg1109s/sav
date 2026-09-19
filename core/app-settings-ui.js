/**
 * core/app-settings-ui.js — wire nút ĐỘNG của mọi màn Setting (dựng lại mỗi lần
 * `event/workflow/app-settings.js::_render()` chạy) — Rule 5a: DOM động, callback CHỈ
 * `eventBus.send()`, KHÔNG gọi thẳng workflow/core khác. Router "appSettings" (event/router/
 * app-settings.js) nhận message rồi mới gọi `workflowAppSettings` thật.
 *
 * SỬA (20/09/2026) — thêm wireAppSettingsMainCarousel() cho màn Main dạng carousel ngang (phần tính
 * scale/loop nằm ở core/settings-carousel-ui.js, file này CHỈ wire sự kiện -> eventBus).
 *
 * NẠP SAU: event/bus.js, core/player-display-settings.js (getPlayerMotionSlotsForKind(), dùng bởi
 * wireAppSettingsPlayerDetail()).
 * NẠP TRƯỚC: event/workflow/app-settings.js.
 */

/** Header dùng chung mọi màn — nút Back (nếu có) + Close X. */
function wireAppSettingsHeader(headerEl) {
    const backBtn = headerEl.querySelector('#btn-app-settings-back');
    if (backBtn) backBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.back.click', payload: {} }));
    const closeBtn = headerEl.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.close.click', payload: {} }));
}

/** Danh sách row có `data-app-settings-nav` (dùng bởi System/Visualizer Screen/Player — màn Main giờ dùng
 * wireAppSettingsMainCarousel() bên dưới) — mỗi row tự mang key đích. */
function wireAppSettingsMain(bodyEl) {
    bodyEl.querySelectorAll('[data-app-settings-nav]').forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: btn.dataset.appSettingsNav } }));
    });
}

/** Độ trễ (ms) sau sự kiện `scroll` CUỐI CÙNG để coi carousel Main là "đã dừng hẳn" -> gửi
 * 'appSettings.carousel.settle' (kéo lại về bản lặp giữa, xem core/settings-carousel-ui.js). */
const APP_SETTINGS_CAROUSEL_SETTLE_DELAY_MS = 140;

/** Màn Main — carousel ngang (components/settings/app-settings-main.js::renderAppSettingsCarousel()).
 * 3 loại tương tác, callback nào cũng CHỈ `eventBus.send()` (Rule 5a):
 *   - `scroll` -> 'appSettings.carousel.scroll' (mỗi lần — Router gọi thẳng core cập nhật scale/opacity).
 *   - dừng cuộn -> 'appSettings.carousel.settle' — debounce bằng setTimeout THUẦN (cùng khuôn
 *     core/time-picker-modal.js, KHÔNG taskManager), và KHÔNG gửi khi ngón tay còn đang chạm
 *     (`isTouching`) — nhảy scrollLeft giữa lúc đang kéo tay sẽ làm iOS giật; `touchend` tự hẹn lại.
 *   - click card -> 'appSettings.carousel.card.click' (Workflow quyết định: card ở giữa = mở màn đích,
 *     card bên cạnh = cuộn vào giữa).
 * addEventListener gom hết ở CUỐI hàm (Rule 5a).
 * @param {HTMLElement} bodyEl */
function wireAppSettingsMainCarousel(bodyEl) {
    const scrollerEl = bodyEl.querySelector('#app-settings-carousel');
    if (!scrollerEl) return;
    let settleTimeoutId = null;
    let isTouching = false;

    const scheduleSettle = () => {
        if (settleTimeoutId) clearTimeout(settleTimeoutId);
        settleTimeoutId = setTimeout(() => {
            settleTimeoutId = null;
            if (isTouching) return; // touchend sẽ hẹn lại
            eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.settle', payload: { scrollerEl } });
        }, APP_SETTINGS_CAROUSEL_SETTLE_DELAY_MS);
    };

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    scrollerEl.addEventListener('scroll', () => {
        eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.scroll', payload: { scrollerEl } });
        scheduleSettle();
    }, { passive: true });
    scrollerEl.addEventListener('touchstart', () => { isTouching = true; }, { passive: true });
    scrollerEl.addEventListener('touchend', () => { isTouching = false; scheduleSettle(); }, { passive: true });
    scrollerEl.addEventListener('touchcancel', () => { isTouching = false; scheduleSettle(); }, { passive: true });
    scrollerEl.querySelectorAll('[data-carousel-card]').forEach((cardEl) => {
        cardEl.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.card.click', payload: { scrollerEl, cardEl, key: cardEl.dataset.carouselKey } }));
    });
}

/** Màn System — 4 row (Theme/Gesture/Slideshow/Language), CÙNG msg.type với Main (payload.key tự
 * phân biệt — Router đọc key để biết đích, KHÔNG phải rẽ nhánh theo appState khác nên không cần
 * VirtualMachineState, xem event-bus-flow.md mục 4B/(A)). */
function wireAppSettingsSystem(bodyEl) {
    wireAppSettingsMain(bodyEl); // cùng cơ chế data-app-settings-nav — tái dùng thẳng
}

/** Màn Player > Video/Photo (Settings > Visualizer Screen > Player) — 1 select Resolution + 3
 * select Motion (PLAYER_MOTION_SLOTS lọc theo kind, core/player-display-settings.js), MỖI select
 * đổi gửi 1 msg.type riêng kèm `kind` ('video'|'photo') để Router/Workflow biết đang sửa domain
 * field nào — xem workflowAppSettings.handlePlayerResolutionChange()/handlePlayerMotionSlotChange().
 * @param {HTMLElement} bodyEl @param {'video'|'photo'} kind */
function wireAppSettingsPlayerDetail(bodyEl, kind) {
    const resolutionSelect = bodyEl.querySelector(`#setting-player-${kind}-resolution`);
    if (resolutionSelect) resolutionSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.player.resolution.change', payload: { kind, value: e.target.value } }));

    getPlayerMotionSlotsForKind(kind).forEach((s) => { // core/player-display-settings.js — mỗi kind chỉ lấy đúng slot của mình (Video: showing; Photo: pointMove)
        const slotSelect = bodyEl.querySelector(`#setting-player-${kind}-motion-${s.slot}`);
        if (slotSelect) slotSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.player.motionSlot.change', payload: { kind, slot: s.slot, value: e.target.value } }));
    });
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
    // SỬA (09/09/2026, phản hồi Giang mục 2 — "bỏ toggle, bỏ manage filter, chỉ giữ Filter để vào
    // nơi quản lý") — RÚT GỌN lại bản 08/09/2026 (từng có công tắc tổng + nút "Quản lý bộ lọc"
    // riêng) — về lại ĐÚNG 1 nút, mở thẳng danh sách preset — xem event/workflow/
    // playlist-filter-presets.js (workflowPlaylistFilterPresets.openList()).
    const filterBtn = bodyEl.querySelector('#setting-open-playlist-filter');
    if (filterBtn) filterBtn.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.openManage.click', payload: {} }));
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
