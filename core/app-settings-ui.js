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

/** Màn Main — carousel ngang (components/settings/app-settings-main.js::renderAppSettingsCarousel()).
 * 4 loại sự kiện, callback nào cũng CHỈ `eventBus.send()` (Rule 5a) — KHÔNG timer/debounce ở đây
 * (task-manager-conventions.md: timer chỉ Workflow được dùng, xem workflowAppSettings.
 * handleCarouselScroll()):
 *   - `scroll` -> 'appSettings.carousel.scroll' (mỗi lần) — cập nhật scale/opacity + hẹn "đã dừng".
 *   - `touchstart`/`touchend`/`touchcancel` -> 'appSettings.carousel.touch.start|end' — Workflow cần biết
 *     ngón tay còn chạm không (nhảy scrollLeft giữa lúc đang kéo tay sẽ làm iOS giật).
 *   - click card -> 'appSettings.carousel.card.click' (card ở giữa = mở màn đích, card bên cạnh = cuộn vào giữa).
 * addEventListener gom hết ở CUỐI hàm (Rule 5a).
 * @param {HTMLElement} bodyEl */
function wireAppSettingsMainCarousel(bodyEl) {
    const scrollerEl = bodyEl.querySelector('#app-settings-carousel');
    if (!scrollerEl) return;

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    scrollerEl.addEventListener('scroll', () => eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.scroll', payload: { scrollerEl } }), { passive: true });
    scrollerEl.addEventListener('touchstart', () => eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.touch.start', payload: { scrollerEl } }), { passive: true });
    scrollerEl.addEventListener('touchend', () => eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.touch.end', payload: { scrollerEl } }), { passive: true });
    scrollerEl.addEventListener('touchcancel', () => eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.touch.end', payload: { scrollerEl } }), { passive: true });
    scrollerEl.querySelectorAll('[data-carousel-card]').forEach((cardEl) => {
        cardEl.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.carousel.card.click', payload: { scrollerEl, cardEl, key: cardEl.dataset.carouselKey } }));
    });
}

/** msg.type đích của từng hàng HÀNH ĐỘNG ở màn Troubleshooting — TÁI DÙNG NGUYÊN 2 msg.type đã có của
 * router 'settingsMisc' (askRestoreDefaults()/askClearCache() -> modal xác nhận -> ...confirm), KHÔNG
 * tạo msg.type mới. */
const APP_SETTINGS_TROUBLESHOOTING_ACTION_MSG = {
    restoreDefaults: 'settingsMisc.restoreDefaults.click',
    clearCache: 'settingsMisc.clearCache.click',
};

/** Màn Troubleshooting (components/settings/troubleshooting.js::renderTroubleshootingBody()) — 2 loại
 * hàng: ĐIỀU HƯỚNG (`data-app-settings-nav`, mở màn con Debug console/Scan & fix video thumbnails — CÙNG msg.type với
 * Main/System) và HÀNH ĐỘNG (`data-troubleshooting-action`, Restore default settings/Clear app cache).
 * @param {HTMLElement} bodyEl */
function wireAppSettingsTroubleshooting(bodyEl) {
    const navBtns = bodyEl.querySelectorAll('[data-app-settings-nav]');
    const actionBtns = bodyEl.querySelectorAll('[data-troubleshooting-action]');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    navBtns.forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: btn.dataset.appSettingsNav } }));
    });
    actionBtns.forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'settingsMisc', type: APP_SETTINGS_TROUBLESHOOTING_ACTION_MSG[btn.dataset.troubleshootingAction], payload: {} }));
    });
}

/** Màn "Scan & fix video thumbnails" (components/settings/troubleshooting.js::renderVideoThumbRepairBody()) —
 * 3 nút, callback CHỈ `eventBus.send()` tới router 'fileManagerStorage' (Rule 5a, gom cuối hàm).
 * @param {HTMLElement} bodyEl */
function wireAppSettingsVideoThumb(bodyEl) {
    const scanBtn = bodyEl.querySelector('#btn-video-thumb-scan');
    const fixBtn = bodyEl.querySelector('#btn-video-thumb-fix');
    const dismissBtn = bodyEl.querySelector('#btn-video-thumb-dismiss');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (scanBtn) scanBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.videoThumb.scan.click', payload: {} }));
    if (fixBtn) fixBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.videoThumb.fix.click', payload: {} }));
    if (dismissBtn) dismissBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.videoThumb.dismiss.click', payload: {} }));
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

/** Màn Theme — dropdown "Color" (light/dark/morphin) + [CHỈ khi Morphin] dropdown loại nền (solid/gradient/image) +
 * 3 input màu — dropdown Theme/loại nền TÁI DÙNG THẲNG msg.type cụm "theme" gốc (event/router/
 * theme.js KHÔNG đổi gì); riêng "hiện đúng hàng con theo lựa chọn glassType" là thao tác DOM THUẦN
 * (không đổi appState, chỉ đổi cái NGƯỜI DÙNG ĐANG NHÌN trước khi họ chọn xong) — gửi kèm 1
 * msg.type riêng ('appSettings.theme.previewGlassType.click') để Router/Workflow xử lý, ĐÚNG Rule
 * 5a (callback ở đây không tự toggle class). */
function wireAppSettingsTheme(bodyEl) {
    const uiThemeSelect = bodyEl.querySelector('#app-settings-ui-theme-select'); // MỚI 21/09/2026 — màu giao diện Light/Dark
    if (uiThemeSelect) uiThemeSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.uiTheme.change', payload: { themeName: e.target.value } }));

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
