/**
 * core/app-settings-ui.js — wire nút ĐỘNG của mọi màn Setting (dựng lại mỗi lần `event/workflow/app-settings.js::_render()`
 * chạy) + vài lệnh ghi DOM nhỏ của các màn đó. Rule 5a: callback chỉ `eventBus.send()`, gom cuối hàm. Carousel Main: wire ở
 * đây, scale/loop ở core/settings-carousel-ui.js.
 *
 * NẠP SAU: event/bus.js. NẠP TRƯỚC: event/workflow/app-settings.js.
 */

/** Header dùng chung mọi màn — nút Back (nếu có) + Close X. */
function wireAppSettingsHeader(headerEl) {
    const backBtn = headerEl.querySelector('#btn-app-settings-back');
    if (backBtn) backBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.back.click', payload: {} }));
    const closeBtn = headerEl.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.close.click', payload: {} }));
}

/** Danh sách row `data-app-settings-nav` (renderAppSettingsRowList() — System/Visualizer Screen/Player/Player > Song) — mỗi
 * row tự mang key đích. */
function wireAppSettingsRowList(bodyEl) {
    bodyEl.querySelectorAll('[data-app-settings-nav]').forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: btn.dataset.appSettingsNav } }));
    });
}

/** Màn Main — carousel ngang (components/settings/app-settings-main.js::renderAppSettingsCarousel()). Không debounce ở
 * đây (hẹn giờ chỉ ở Workflow — workflowAppSettings.handleCarouselScroll()):
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
 * hàng: ĐIỀU HƯỚNG (`data-app-settings-nav`, mở màn con Debug console/Scan & fix video thumbnails/Performance HUD — CÙNG msg.type với
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

/** Màn con "Performance HUD" (components/settings/troubleshooting.js::renderPerfHudSettingsBody()) — công tắc + nút Kiểu +
 * nút Chiều (chỉ có khi Kiểu = strip) -> router 'perfHud'.
 * @param {HTMLElement} bodyEl */
function wireAppSettingsPerfHud(bodyEl) {
    const enabledToggle = bodyEl.querySelector('#setting-perf-hud-enabled');
    const styleBtns = bodyEl.querySelectorAll('[data-perf-hud-style]');
    const orientationBtns = bodyEl.querySelectorAll('[data-perf-hud-orientation]');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (enabledToggle) enabledToggle.addEventListener('change', () => eventBus.send({ router: 'perfHud', type: 'perfHud.enabled.change', payload: { checked: enabledToggle.checked } }));
    styleBtns.forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'perfHud', type: 'perfHud.style.change', payload: { style: btn.dataset.perfHudStyle } }));
    });
    orientationBtns.forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'perfHud', type: 'perfHud.orientation.change', payload: { orientation: btn.dataset.perfHudOrientation } }));
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

/** Màn Player > Video/Photo — select Resolution, các HÀNG Motion (tap -> màn Chọn của Motion,
 * workflowPlayerDisplaySettings.openMotionSlotPicker()), nút reset zoom/pan; mỗi control 1 msg.type kèm `kind`.
 * @param {HTMLElement} bodyEl @param {'video'|'photo'} kind */
function wireAppSettingsPlayerDetail(bodyEl, kind) {
    const resolutionSelect = bodyEl.querySelector(`#setting-player-${kind}-resolution`);
    const motionSlotRows = bodyEl.querySelectorAll('[data-player-motion-slot]'); // components/settings/player-display-settings.js — chỉ dựng đúng slot của kind này
    const zoomResetBtn = bodyEl.querySelector(`#setting-player-${kind}-zoom-reset`);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (resolutionSelect) resolutionSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.player.resolution.change', payload: { kind, value: e.target.value } }));
    motionSlotRows.forEach((rowEl) => {
        rowEl.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.player.motionSlot.openPicker.click', payload: { kind, slot: rowEl.dataset.playerMotionSlot } }));
    });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.player.zoom.reset.click', payload: { kind } }));
}

/** Màn System > Ghi âm (components/settings/recorder-settings.js). Select bắn `change`; slider Sync bắn `input` (chỉ nhãn) +
 * `change` (thả tay -> lưu); nút Latency calibration bắn `click`. Sync + nút đo chỉ có ở chế độ Headphones. */
function wireAppSettingsRecorder(bodyEl) {
    const modeSelect = bodyEl.querySelector('#setting-recorder-mode');
    const countInSelect = bodyEl.querySelector('#setting-recorder-count-in');
    const qualitySelect = bodyEl.querySelector('#setting-recorder-quality');
    const latencySlider = bodyEl.querySelector('#setting-recorder-latency');
    const calibrateBtn = bodyEl.querySelector('#setting-recorder-calibrate');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (modeSelect) modeSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.recorder.field.change', payload: { field: 'mode', value: e.target.value } }));
    if (countInSelect) countInSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.recorder.field.change', payload: { field: 'countInSec', value: e.target.value } }));
    if (qualitySelect) qualitySelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.recorder.field.change', payload: { field: 'quality', value: e.target.value } }));
    if (latencySlider) latencySlider.addEventListener('input', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.recorder.latency.input', payload: { value: e.target.value } }));
    if (latencySlider) latencySlider.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.recorder.field.change', payload: { field: 'latencyMs', value: e.target.value } }));
    if (calibrateBtn) calibrateBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.recorder.calibrate.click', payload: {} }));
}

/** Màn Playlist — 2 select Nguồn/Kiểu xem (msg.type của cụm "playlist") + 2 nút mở Sắp xếp / danh sách preset Filter. */
function wireAppSettingsPlaylist(bodyEl) {
    const mediaSourceSelect = bodyEl.querySelector('#setting-playlist-media-source');
    const viewModeSelect = bodyEl.querySelector('#setting-playlist-view-mode');
    const sortBtn = bodyEl.querySelector('#setting-open-playlist-sort');
    const filterBtn = bodyEl.querySelector('#setting-open-playlist-filter');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (mediaSourceSelect) mediaSourceSelect.addEventListener('change', (e) => eventBus.send({ router: 'playlist', type: 'playlist.mediaSource.change', payload: { source: e.target.value } }));
    if (viewModeSelect) viewModeSelect.addEventListener('change', (e) => eventBus.send({ router: 'playlist', type: 'playlist.viewMode.change', payload: { mode: e.target.value } }));
    if (sortBtn) sortBtn.addEventListener('click', () => eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key: 'playlistSort' } }));
    if (filterBtn) filterBtn.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.openManage.click', payload: {} }));
}

/** Đổ giá trị 2 select của màn Playlist. @param {HTMLElement} bodyEl @param {string} mediaSource @param {'grid'|'list'} viewMode */
function setAppSettingsPlaylistSelects(bodyEl, mediaSource, viewMode) {
    const mediaSourceSelect = bodyEl.querySelector('#setting-playlist-media-source');
    const viewModeSelect = bodyEl.querySelector('#setting-playlist-view-mode');
    if (mediaSourceSelect) mediaSourceSelect.value = mediaSource;
    if (viewModeSelect) viewModeSelect.value = viewMode;
}

/** Màn Theme — gắn select "Color" (Light/Dark/Morphin). Cụm 3 card nền gắn riêng ở
 * core/theme-background-ui.js::wireThemeBackgroundCards() (event/workflow/app-settings.js::_renderTheme() gọi cả 2). */
function wireAppSettingsTheme(bodyEl) {
    const uiThemeSelect = bodyEl.querySelector('#app-settings-ui-theme-select');
    if (uiThemeSelect) uiThemeSelect.addEventListener('change', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.uiTheme.change', payload: { themeName: e.target.value } }));
}

/** Màn System > Pagination (components/settings/pagination.js). Mọi control mang `data-pagination-place` +
 * `data-pagination-field` -> 'appSettings.pagination.place.change'. Ô số bắn ở `change` (rời ô / Done trên bàn phím) — không
 * bắn theo từng phím (mỗi lần bắn là 1 lần dựng lại màn, gõ "150" sẽ mất focus sau "1"); phím trong ô số ->
 * 'appSettings.pagination.input.keydown' (Enter -> Workflow bỏ focus -> tự phát `change`). Khung Preview `inert`.
 * @param {HTMLElement} bodyEl */
function wireAppSettingsPagination(bodyEl) {
    const controls = bodyEl.querySelectorAll('[data-pagination-place][data-pagination-field]');
    const numberInputs = bodyEl.querySelectorAll('input[type="number"][data-pagination-place]');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    controls.forEach((el) => {
        el.addEventListener('change', () => eventBus.send({ router: 'appSettings', type: 'appSettings.pagination.place.change', payload: { place: el.dataset.paginationPlace, field: el.dataset.paginationField, value: el.type === 'checkbox' ? el.checked : el.value } }));
    });
    numberInputs.forEach((el) => {
        el.addEventListener('keydown', (e) => eventBus.send({ router: 'appSettings', type: 'appSettings.pagination.input.keydown', payload: { key: e.key, inputEl: el } }));
    });
}

/** Bỏ focus 1 ô nhập (Enter ở ô số màn Pagination -> trình duyệt tự phát `change`). @param {HTMLElement} inputEl */
function blurAppSettingsInput(inputEl) {
    if (inputEl) inputEl.blur();
}
