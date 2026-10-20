/**
 * event/workflow/app-settings.js — Settings trong Generic Drawer (router "appSettings").
 *
 * Điều hướng nhiều cấp = swap nội dung Drawer + ngăn xếp JS `_screenStack` (mảng hàm render) để Back về đúng màn
 * trước; mỗi độ sâu 1 `scrollKey` riêng (giữ vị trí cuộn khi vẽ lại/quay lại). Mỗi màn `_renderXxx()` gọi `_render()`
 * với HTML từ components/settings/*, components/*-drawer.js; `onMount` CHỈ đồng bộ giá trị hoặc gọi hàm wire của core
 * (core/app-settings-ui.js, core/pagination-ui.js) — KHÔNG `addEventListener` ở đây. Tương tác của màn Playlist
 * Filter và Motion đi qua delegate event/listener/playlist-filter-presets.js và event/listener/motion-presets.js.
 *
 * Main là carousel ngang (components/settings/app-settings-main.js, wire ở core/app-settings-ui.js, scale/loop ở
 * core/settings-carousel-ui.js). Motion: Quản lý mở từ System; nơi tiêu thụ (Visual Background, Player) mở danh sách
 * ở chế độ Chọn (`_renderMotionPicker()`, workflowMotionPresets.openPicker()).
 *
 * CÒN NỢ: nút Cancel của picker chọn THƯ MỤC video trong Visual Background chưa tự quay lại màn Visual
 * Background (hạ tầng `workflowPlaylist._openFolderPickerDrawer()` dùng chung với Playlist).
 *
 * NẠP SAU: core/generic-drawer.js, core/app-settings-ui.js, core/settings-carousel-ui.js, core/pagination-ui.js,
 * core/playlist/filter-presets.js, core/motion-presets.js, core/player-display-settings.js, components/settings/*,
 * components/{gesture-settings,motion-settings,debug-console,playlist-sort,playlist-filter,visual-bg-settings,
 * visual-bg-gradient,visual-bg-video-audio}-drawer.js, lang/language-settings.js, event/workflow/{generic-drawer-helpers,
 * app-panel-nav,gesture-settings,playlist,playlist-filter-presets,motion-presets,settings-misc,visualizer-display,
 * visual-bg-common,player-display-settings,pagination}.js.
 * NẠP TRƯỚC: event/router/player-controls.js, event/router/app-settings.js, event/router/app-panel-nav.js,
 * event/router/visual-bg.js.
 */
/** Carousel Main (`_renderMain()`): chờ drawer trượt lên gần xong rồi mới cho card ở tâm phóng to, thời lượng phóng to, và độ
 * trễ debounce sau sự kiện `scroll` cuối cùng để coi là "đã dừng" (kéo về bản lặp giữa — computeSettingsCarouselSettleLeft()). */
const APP_SETTINGS_CAROUSEL_ENTRANCE_DELAY_MS = 180;
const APP_SETTINGS_CAROUSEL_ENTRANCE_MS = 420;
const APP_SETTINGS_CAROUSEL_SETTLE_DELAY_MS = 140;
const APP_SETTINGS_CAROUSEL_ENTRANCE_TASK = 'appSettingsCarouselEntrance';
const APP_SETTINGS_CAROUSEL_ENTRANCE_END_TASK = 'appSettingsCarouselEntranceEnd';
const APP_SETTINGS_CAROUSEL_SETTLE_TASK = 'appSettingsCarouselSettle';

// 6 field của 1 Point Move (màn Point Move Edit).
const APP_SETTINGS_POINT_MOVE_FIELD_KEYS = ['linearX', 'linearY', 'rotate', 'zoom', 'flipX', 'flipY'];

// back(): còn màn trước -> vẽ lại màn đó; ngăn xếp rỗng (không nên xảy ra — Main không có nút Back) -> đóng hẳn.
const APP_SETTINGS_BACK_BY_HAS_PREV = {
    true: (prev) => prev(), // `_scrollResetPending` vẫn false -> `_render()` khôi phục vị trí cuộn lúc rời màn này
    false: () => workflowAppSettings.close(),
};
// Màn con dựng từ 1 bản ghi (preset, point move…): bản ghi còn -> vẽ; vừa bị xoá ở nơi khác / phiên đã kết thúc -> lùi 1 màn.
const APP_SETTINGS_SCREEN_BY_FOUND = {
    true: (render) => render(),
    false: () => workflowAppSettings.back(),
};
// Tap card carousel Main: card đang ở tâm -> nhớ mục (Back về Main giữ mục đó ở giữa) + mở màn đích; card bên cạnh -> cuộn vào giữa.
const APP_SETTINGS_CAROUSEL_TAP_BY_FOCUSED = {
    true: (scrollerEl, cardEl, tap, key) => {
        workflowAppSettings._mainCarouselIndex = tap.index;
        eventBus.send({ router: 'appSettings', type: 'appSettings.nav.click', payload: { key } });
    },
    false: (scrollerEl, cardEl) => scrollSettingsCarouselTo(scrollerEl, computeSettingsCarouselCenterLeft(scrollerEl, cardEl)), // core/settings-carousel-ui.js
};
// Đổi 1 control của 1 nơi ở màn Pagination (event/workflow/pagination.js).
const APP_SETTINGS_PAGINATION_CHANGE_BY_FIELD = {
    enabled: (place, value) => workflowPagination.changePlaceEnabled(place, value),
    pageSize: (place, value) => workflowPagination.changePlacePageSize(place, value),
    style: (place, value) => workflowPagination.changePlaceStyle(place, value),
};

const workflowAppSettings = {

    _carouselTouching: false, // ngón tay còn đang chạm carousel Main — không nhảy scrollLeft lúc đang kéo tay
    _screenStack: [], // mảng hàm render (KHÔNG gồm màn hiện tại) — back() pop ra màn NGAY TRƯỚC
    _playlistFilterListPageIndex: 0, // trang đang xem của danh sách preset Filter (nơi 'filterPresets' của Pagination), core tự kẹp
    _playlistFilterListSource: null, // Nguồn của lần vẽ danh sách Filter trước — đổi Nguồn thì về trang 1
    _motionListPageIndex: 0, // trang đang xem của danh sách preset Motion (nơi 'motionPresets' của Pagination), sống theo phiên, core tự kẹp
    _scrollResetPending: false, // true = lần `_render()` kế tiếp là màn ĐI TỚI (open/navigateTo) -> bắt đầu từ đầu; false = vẽ lại tại chỗ hoặc quay lại -> giữ/khôi phục vị trí cuộn (event/workflow/generic-drawer-helpers.js, `scrollKey`)
    _mainCarouselIndex: 0, // mục (0..4) đang ở giữa carousel Main lần cuối người dùng bấm mở 1 màn con — Back về Main giữ đúng mục đó ở giữa; `open()` luôn reset về 0 (mục đầu tiên)

    open() {
        this._screenStack = [];
        this._scrollResetPending = true; // mở Settings luôn từ đầu
        this._mainCarouselIndex = 0;
        this._renderMain();
        workflowAppPanelNav.setActiveTab('setting');
    },

    close() {
        this._screenStack = [];
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        workflowAppPanelNav.activateMedia(); // event/workflow/app-panel-nav.js
    },

    /** Điều hướng TỚI 1 màn mới — đẩy màn HIỆN TẠI vào ngăn xếp để back() quay lại đúng.
     * @param {() => void} renderFn */
    navigateTo(renderFn) {
        this._screenStack.push(this._currentRenderFn);
        this._scrollResetPending = true; // màn đi TỚI bắt đầu từ đầu; vị trí màn vừa rời đã được nhớ theo key độ sâu (event/workflow/generic-drawer-helpers.js)
        renderFn();
    },

    /** Ứng với nút Back động ở header (mọi màn trừ Main). */
    back() {
        const prev = this._screenStack.pop();
        APP_SETTINGS_BACK_BY_HAS_PREV[Boolean(prev)](prev);
    },

    // ===================== Khung dùng chung =====================

    /** Dựng header (Back nếu không phải Main + Close X) + body bọc `p-4`, mở/swap Generic Drawer, rồi `onMount(body)` —
     * chỉ đồng bộ giá trị hoặc gọi hàm wire của core, không addEventListener.
     * @param {string} title @param {string} bodyHtml @param {(body: HTMLElement) => void} [onMount]
     * @param {string} [extraHeaderHtml] - nút hành động riêng của màn, đặt trước nút Close (tương tác qua Listener của màn đó).
     */
    _render(title, bodyHtml, onMount, extraHeaderHtml) {
        const hasBack = this._screenStack.length > 0;
        // Mỗi độ sâu ngăn xếp là 1 `scrollKey` riêng (màn ở độ sâu N luôn là màn đang hiện/sẽ quay lại ở độ sâu đó).
        // Vẽ lại tại chỗ (cùng độ sâu, kể cả từ Workflow miền khác) -> giữ vị trí; `back()` -> về đúng vị trí
        // lúc rời đi (kể cả khi giữa chừng Drawer bị picker/Element Style Editor chiếm tạm rồi gọi lại
        // `_renderXxx()`); `open()`/`navigateTo()` -> từ đầu.
        const scrollReset = this._scrollResetPending;
        this._scrollResetPending = false;
        const config = {
            scrollKey: `appSettings@${this._screenStack.length}`,
            scrollReset,
            height: 'auto', // tự co theo nội dung, xem core/generic-drawer.js
            maxHeight: '85vh',
            headerHtml: buildDrawerHeaderHtml({ layout: 'center', backId: hasBack ? 'btn-app-settings-back' : '', title, actionsHtml: extraHeaderHtml || '' }), // components/generic-drawer.js — header dùng chung
            bodyHtml: `<div class="p-4" data-uitk="textPrimary">${bodyHtml}</div>`,
            bodyClass: 'overflow-y-auto',
        };
        if (genericDrawerPanel.classList.contains('hidden')) workflowGenericDrawerHelpers.open(config); else workflowGenericDrawerHelpers.update(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        wireAppSettingsHeader(genericDrawerHeader); // core/app-settings-ui.js — Rule 5a

        if (onMount) onMount(genericDrawerBody);
        // onMount có thể làm nội dung CAO thêm (bỏ `hidden` các hàng theo config, vd Visual
        // BG `refreshPanelUI()`) — lúc gắn nội dung còn thấp nên vị trí cuộn bị kẹp; áp lại đích sau onMount.
        workflowGenericDrawerHelpers.restoreScroll(); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
    },

    // ===================== Main =====================

    _renderMain() {
        this._currentRenderFn = () => this._renderMain();
        this._render(t('appSettings.title'), renderAppSettingsMainBody(), (body) => { // components/settings/app-settings-main.js — carousel ngang
            wireAppSettingsMainCarousel(body); // core/app-settings-ui.js — chỉ wire sự kiện -> eventBus
            const scrollerEl = body.querySelector('#app-settings-carousel');
            this._carouselTouching = false;
            // Hiệu ứng mở: đặt mục hiện tại vào tâm (card vẫn nhỏ/mờ) -> đợi drawer trượt lên gần xong -> card ở tâm phóng to ->
            // hết animation thì gỡ transition (cuộn theo tay tức thì).
            const startCardEl = beginSettingsCarouselEntrance(scrollerEl, this._mainCarouselIndex); // core/settings-carousel-ui.js
            if (startCardEl) setSettingsCarouselScrollLeftInstant(scrollerEl, computeSettingsCarouselCenterLeft(scrollerEl, startCardEl)); // core/settings-carousel-ui.js
            taskManager.once(() => {
                startSettingsCarouselEntrance(scrollerEl, APP_SETTINGS_CAROUSEL_ENTRANCE_MS); // core/settings-carousel-ui.js
                this._applyCarouselFocus(scrollerEl);
                taskManager.once(() => endSettingsCarouselEntrance(scrollerEl), APP_SETTINGS_CAROUSEL_ENTRANCE_MS + 40, APP_SETTINGS_CAROUSEL_ENTRANCE_END_TASK);
            }, APP_SETTINGS_CAROUSEL_ENTRANCE_DELAY_MS, APP_SETTINGS_CAROUSEL_ENTRANCE_TASK);
        });
    },

    /** Mỗi sự kiện `scroll` của carousel Main (Router 'appSettings.carousel.scroll') — cập nhật
     * scale/opacity theo vị trí + đặt lại (debounce, cùng tên task) bộ đếm "đã dừng cuộn". */
    handleCarouselScroll(scrollerEl) {
        this._applyCarouselFocus(scrollerEl);
        this._scheduleCarouselSettle(scrollerEl);
    },

    /** Card càng gần tâm càng to/rõ (bỏ qua lúc đang hiệu ứng mở / carousel đã rời DOM — core tự guard). */
    _applyCarouselFocus(scrollerEl) {
        applySettingsCarouselFocusStyles(scrollerEl, measureSettingsCarousel(scrollerEl)); // core/settings-carousel-ui.js
    },

    /** Ngón tay chạm/nhấc khỏi carousel Main (Router 'appSettings.carousel.touch.start|end'). Nhấc tay
     * -> hẹn lại "đã dừng" (có thể lúc chạm cuộn đã đứng yên sẵn, không còn sự kiện scroll nào tới nữa). */
    handleCarouselTouch(scrollerEl, isTouching) {
        this._carouselTouching = isTouching;
        if (!isTouching) this._scheduleCarouselSettle(scrollerEl);
    },

    /** Cuộn đã dừng (debounce cùng tên task): card current ở bản lặp ngoài thì nhảy về bản giữa — "vô hạn" 2 phía. */
    _scheduleCarouselSettle(scrollerEl) {
        taskManager.once(() => {
            if (this._carouselTouching) return; // còn đang kéo tay — touchend sẽ hẹn lại
            const left = computeSettingsCarouselSettleLeft(scrollerEl, measureSettingsCarousel(scrollerEl)); // core/settings-carousel-ui.js
            if (left !== null) setSettingsCarouselScrollLeftInstant(scrollerEl, left); // core/settings-carousel-ui.js
        }, APP_SETTINGS_CAROUSEL_SETTLE_DELAY_MS, APP_SETTINGS_CAROUSEL_SETTLE_TASK);
    },

    /** Ứng với 'appSettings.carousel.card.click' — card ở tâm: mở màn đích (qua 'appSettings.nav.click'); card bên cạnh: cuộn
     * vào giữa. @param {HTMLElement} scrollerEl @param {HTMLElement} cardEl @param {string} key */
    handleCarouselCardTap(scrollerEl, cardEl, key) {
        const tap = resolveSettingsCarouselTap(measureSettingsCarousel(scrollerEl), cardEl); // core/settings-carousel-ui.js
        APP_SETTINGS_CAROUSEL_TAP_BY_FOCUSED[tap.isFocused](scrollerEl, cardEl, tap, key);
    },

    // ===================== Playlist (TÁI DÙNG TPL_SETTINGS_PLAYLIST_VIEW + workflowPlaylist) =====

    _renderPlaylist() {
        this._currentRenderFn = () => this._renderPlaylist();
        const { activeMediaSource, isGridView } = appState.get(['activeMediaSource', 'isGridView']);
        this._render(t('appSettings.row.playlist'), TPL_SETTINGS_PLAYLIST_VIEW, (body) => {
            setAppSettingsPlaylistSelects(body, activeMediaSource, isGridView ? 'grid' : 'list'); // core/app-settings-ui.js
            wireAppSettingsPlaylist(body); // core/app-settings-ui.js
        });
    },

    _renderPlaylistSort() {
        this._currentRenderFn = () => this._renderPlaylistSort();
        const { activeMediaSource, displayStatSortField } = appState.get(['activeMediaSource', 'displayStatSortField']);
        // Nguồn: Photo ẩn 2 field times/duration; field Stats: template dựng sẵn đúng hàng Hướng (chiều cao đo đúng ngay).
        this._render(t('playlistSortPanel.title'), renderPlaylistSortPanelBody(activeMediaSource, displayStatSortField), () => {
            workflowPlaylist.openSortPanel(); // event/workflow/playlist.js — đồng bộ giá trị
        });
    },

    /** Danh sách preset Filter của Nguồn đang chọn (mỗi Nguồn 1 danh sách riêng) — đổi Nguồn so với lần vẽ trước thì về
     * trang 1. Tương tác: event/listener/playlist-filter-presets.js. */
    _renderPlaylistFilterList() {
        this._currentRenderFn = () => this._renderPlaylistFilterList();
        const s = appState.get(['activeMediaSource', 'playlistFilterPresets', 'playlistFilterActivePresetId']);
        const source = s.activeMediaSource;
        const presets = s.playlistFilterPresets[source];
        const activeId = s.playlistFilterActivePresetId[source];
        this._resetFilterListPageOnSourceChange(source);
        const view = workflowPagination.computePlaceView('filterPresets', presets, this._playlistFilterListPageIndex); // event/workflow/pagination.js
        this._playlistFilterListPageIndex = view.pageIndex; // đã kẹp (vd vừa xoá preset cuối của trang cuối)
        this._render(
            tFormat('playlistFilterPresetsDrawer.list.titleForSource', { source: t('settingsPlaylistBg.mediaSource.' + source) }),
            renderPlaylistFilterListBody(view.pageItems, activeId, workflowPagination.buildControlsHtml(view)), // components/playlist-filter-drawer.js
            (body) => wirePaginationControls(body.querySelector('#playlist-filter-list-pagination'), 'appSettings', 'appSettings.playlistFilterList.page.change'), // core/pagination-ui.js
        );
    },

    _resetFilterListPageOnSourceChange(source) {
        if (this._playlistFilterListSource === source) return;
        this._playlistFilterListSource = source;
        this._playlistFilterListPageIndex = 0;
    },

    /** Sửa 1 preset (`workflowPlaylistFilterPresets._editingId`, Nguồn `_editingSource` chốt lúc mở). Preset đang active
     * -> nút đầu "Cập nhật", nút sau "Bỏ chọn". Tương tác: event/listener/playlist-filter-presets.js. */
    _renderPlaylistFilterEdit() {
        this._currentRenderFn = () => this._renderPlaylistFilterEdit();
        const source = workflowPlaylistFilterPresets._editingSource;
        const s = appState.get(['playlistFilterPresets', 'playlistFilterActivePresetId']);
        const preset = findPlaylistFilterPresetById(s.playlistFilterPresets[source], workflowPlaylistFilterPresets._editingId); // core/playlist/filter-presets.js
        APP_SETTINGS_SCREEN_BY_FOUND[Boolean(preset)](() => this._render(
            tFormat('playlistFilterPresetsDrawer.edit.titleForSource', { source: t('settingsPlaylistBg.mediaSource.' + source) }),
            renderPlaylistFilterEditBody(preset, source, preset.id === s.playlistFilterActivePresetId[source]), // components/playlist-filter-drawer.js
            () => workflowPlaylistFilterPresets._syncEditUI(), // event/workflow/playlist-filter-presets.js — đổ giá trị field sau mount
        ));
    },

    // ===================== System (Theme/Motion/Language/Recording/Pagination) =====================

    _renderSystem() {
        this._currentRenderFn = () => this._renderSystem();
        const rows = [
            { key: 'theme', icon: 'theme', labelKey: 'appSettings.system.theme.label', hintKey: 'appSettings.system.theme.hint' },
            { key: 'motion', icon: 'photograph', labelKey: 'appSettings.system.motion.label', hintKey: 'appSettings.system.motion.hint' },
            { key: 'language', icon: 'globe', labelKey: 'appSettings.system.language.label', hintKey: 'appSettings.system.language.hint' },
            { key: 'recorder', icon: 'microphone', labelKey: 'appSettings.system.recorder.label', hintKey: 'appSettings.system.recorder.hint' },
            // Cài đặt CHUNG cho mọi danh sách có phân trang, xem _renderPagination().
            { key: 'pagination', icon: 'pagination', labelKey: 'appSettings.system.pagination.label', hintKey: 'appSettings.system.pagination.hint' },
        ];
        this._render(t('appSettings.row.system'), renderAppSettingsRowList(rows), wireAppSettingsRowList); // core/app-settings-ui.js
    },

    // ===================== Pagination — mỗi NƠI 1 checkbox + số item/trang + kiểu riêng =====================
    // Domain 'pagination' (core/config.js::DEFAULT_PAGINATION_CONFIG.places), đọc/ghi qua workflowPagination
    // (event/workflow/pagination.js — gọi trực tiếp, cùng cách Player gọi workflowPlayerDisplaySettings).

    _renderPagination() {
        this._currentRenderFn = () => this._renderPagination();
        const settingsByPlace = {};
        const previewHtmlByPlace = {};
        for (const place of PAGINATION_PLACES) { // core/pagination.js
            settingsByPlace[place.key] = workflowPagination.getPlaceSettings(place.key); // event/workflow/pagination.js — đã chuẩn hoá
            if (settingsByPlace[place.key].enabled) previewHtmlByPlace[place.key] = workflowPagination.buildPreviewHtml(place.key);
        }
        this._render(t('appSettings.system.pagination.label'), renderPaginationSettingsBody(settingsByPlace, previewHtmlByPlace), (body) => { // components/settings/pagination.js
            wireAppSettingsPagination(body); // core/app-settings-ui.js
        });
    },

    /** Ứng với 'appSettings.pagination.place.change' — 1 control của 1 nơi đổi (checkbox / ô số / select).
     * Ghi bền rồi DỰNG LẠI màn: checkbox mở/ẩn phần chi tiết, ô số hiện lại giá trị đã kẹp (vd nhập 500 ->
     * 200, nhập rỗng -> số cũ), Preview đổi theo. Giữ vị trí cuộn (danh sách nơi có thể dài hơn màn hình).
     * @param {{place:string, field:'enabled'|'pageSize'|'style', value:*}} payload */
    async handlePaginationPlaceChange(payload) {
        const { place, field, value } = payload;
        const change = APP_SETTINGS_PAGINATION_CHANGE_BY_FIELD[field];
        if (change) await change(place, value);
        this._renderPagination(); // vẽ lại tại chỗ — `_render()` tự giữ vị trí cuộn
    },

    /** Ứng với 'appSettings.pagination.input.keydown' — Enter ở ô số: bỏ focus (trình duyệt tự phát `change`).
     * @param {string} key @param {HTMLElement} inputEl */
    handlePaginationInputKeydown(key, inputEl) {
        if (key !== 'Enter') return; // guard: chỉ Enter
        blurAppSettingsInput(inputEl); // core/app-settings-ui.js
    },

    // ===================== Theme — select "Color" (Light/Dark/Morphin) + 3 card nền (chỉ khi Morphin) =====================
    // Đổi nền đi qua router 'theme' (event/router/theme.js) bằng eventBus.

    _renderTheme() {
        this._currentRenderFn = () => this._renderTheme();
        const activeUiTheme = resolveUiThemeName(appConfigUiTheme.getAll().activeUiTheme); // core/ui-theme/registry.js — tên lạ -> Light (khớp theme thật đang áp)
        const backgroundHtml = activeUiTheme === 'morphin' ? renderThemeBackgroundCardsHtml(computeThemeBackgroundView(appConfigViz.getAll()).cards) : ''; // components/settings/theme.js + core/theme-background.js
        const playerControlView = workflowTheme.getPlayerControlView(); // event/workflow/theme.js
        const playerControlHtml = renderPlayerControlSettingsHtml(playerControlView); // components/settings/theme.js
        this._render(t('appSettings.system.theme.label'), renderAppSettingsThemeBody(getSelectableUiThemeNames(), activeUiTheme, backgroundHtml, playerControlHtml), (body) => { // components/settings/theme.js
            wireAppSettingsTheme(body); // core/app-settings-ui.js
            wireThemeBackgroundCards(body); // core/theme-background-ui.js — không có cụm 3 card (Color khác Morphin) thì không gắn gì
            patchPlayerControlSettings(body, playerControlView); // core/player-control-settings-ui.js — điền slot khung xem trước
            wirePlayerControlSettings(body);
        });
    },

    /** Ứng với 'appSettings.uiTheme.change' — đổi màu GIAO DIỆN rồi đồng bộ NỀN phía sau app: Morphin cần nền (kính có gì để
     * làm mờ) -> vào Morphin dùng lại kiểu nền Morphin gần nhất; Light/Dark dùng panel đặc -> chốt mode 'light'/'dark' (nền
     * media/màu gradient vẫn nhớ). Mode cần chốt do core thuần computeUiThemeChangeBgMode() tính ('' = giữ nguyên); chốt qua
     * router 'theme'. Cuối cùng dựng lại màn Theme để phần chọn nền hiện/ẩn theo Color mới. */
    async handleUiThemeChange(themeName) {
        await workflowUiTheme.switchUiTheme(themeName); // event/workflow/ui-theme.js
        const mode = computeUiThemeChangeBgMode(themeName, appConfigViz.getAll()); // core/theme-background.js
        if (mode) eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode } });
        this._renderTheme();
    },

    // ===================== Gesture (renderGestureSettingsPanelBody() + workflowGestureSettings) =====================

    _renderGesture() {
        this._currentRenderFn = () => this._renderGesture();
        this._render(t('gestureSettings.title'), renderGestureSettingsPanelBody(), () => {
            workflowGestureSettings.openPanel(); // event/workflow/gesture-settings.js
        });
    },

    // ===================== Motion =====================
    // System > Motion -> danh sách preset (CRUD); nơi tiêu thụ (VBG, Player) -> cùng danh sách ở chế độ Chọn
    // (`_renderMotionPicker()`). Mọi tương tác: event/listener/motion-presets.js -> router 'motionPresets'.

    /** Danh sách preset — tap = sửa, nút xoá nhanh mỗi dòng. */
    _renderMotionList() {
        this._currentRenderFn = () => this._renderMotionList();
        const presets = appState.get('motionPresets');
        const view = workflowPagination.computePlaceView('motionPresets', presets, this._motionListPageIndex); // event/workflow/pagination.js
        this._motionListPageIndex = view.pageIndex; // đã kẹp
        this._render(
            t('motionPresetsDrawer.list.title'),
            renderMotionListBody(view.pageItems, workflowPagination.buildControlsHtml(view)), // components/motion-settings-drawer.js
            (body) => wirePaginationControls(body.querySelector('#motion-list-pagination'), 'appSettings', 'appSettings.motionList.page.change'), // core/pagination-ui.js
        );
    },

    /** Ứng với 'appSettings.playlistFilterList.page.change' — vẽ lại tại chỗ, bắt đầu từ đầu trang mới (`scrollReset`).
     * @param {number} pageIndex */
    setPlaylistFilterListPage(pageIndex) {
        this._playlistFilterListPageIndex = pageIndex;
        this._scrollResetPending = true;
        this._renderPlaylistFilterList();
    },

    /** Ứng với 'appSettings.motionList.page.change' — vẽ lại tại chỗ (không push ngăn xếp), từ đầu trang mới. @param {number} pageIndex */
    setMotionListPage(pageIndex) {
        this._motionListPageIndex = pageIndex;
        this._scrollResetPending = true;
        this._renderMotionList();
    },

    /** Danh sách preset ở chế độ Chọn (phiên do `workflowMotionPresets.openPicker()` giữ) — tap dòng = chọn nháp, nút
     * Apply ở header = xác nhận + back(). Phân trang dùng chung nơi 'motionPresets'. */
    _renderMotionPicker() {
        this._currentRenderFn = () => this._renderMotionPicker();
        const data = workflowMotionPresets.getPickerRenderData(); // event/workflow/motion-presets.js — null = phiên Chọn đã kết thúc
        APP_SETTINGS_SCREEN_BY_FOUND[Boolean(data)](() => this._render(
            data.title,
            renderMotionPickerBody(data.view.pageItems, data.draftId, workflowPagination.buildControlsHtml(data.view)), // components/motion-settings-drawer.js
            (body) => wirePaginationControls(body.querySelector('#motion-picker-pagination'), 'motionPresets', 'motionPresets.picker.page.change'), // core/pagination-ui.js
            renderMotionPickerApplyButtonHtml(), // components/motion-settings-drawer.js
        ));
    },

    /** Sửa 1 preset (`workflowMotionPresets._editingId`). */
    _renderMotionEdit() {
        this._currentRenderFn = () => this._renderMotionEdit();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        APP_SETTINGS_SCREEN_BY_FOUND[Boolean(preset)](() => this._render(
            t('motionPresetsDrawer.edit.title'),
            renderMotionEditBody(preset), // components/motion-settings-drawer.js
            () => workflowMotionPresets._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio), // event/workflow/motion-presets.js
        ));
    },

    /** Danh sách point move của preset đang sửa — [kéo] | checkbox | tên | nhân bản | xoá | sửa. Kéo tay cầm hoán đổi
     * toàn bộ 2 point move (workflowMotionPresets.startPointMoveDrag()/endPointMoveDrag()). */
    _renderPointMoveList() {
        this._currentRenderFn = () => this._renderPointMoveList();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        APP_SETTINGS_SCREEN_BY_FOUND[Boolean(preset)](() => this._render(t('motionSettingsDrawer.pointMove.list.label'), renderPointMoveListBody(preset))); // components/motion-settings-drawer.js
    },

    /** Sửa 1 point move (`workflowMotionPresets._editingPointMoveId`) — 6 field cùng hình dạng UI. */
    _renderPointMoveEdit() {
        this._currentRenderFn = () => this._renderPointMoveEdit();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, workflowMotionPresets._editingPointMoveId) : null; // core/motion-presets.js
        APP_SETTINGS_SCREEN_BY_FOUND[Boolean(pointMove)](() => this._render(
            t('motionSettingsDrawer.pointMove.edit.title'),
            renderPointMoveEditBody(pointMove), // components/motion-settings-drawer.js
            () => APP_SETTINGS_POINT_MOVE_FIELD_KEYS.forEach((fieldKey) => workflowMotionPresets._updatePointMoveFieldLabel(fieldKey)), // event/workflow/motion-presets.js — ô số + dải tô màu lúc mở
        ));
    },

    /** Đường cong Timing (chỉ khi `pointMoveRunMode==='all'`) — SVG dựng bởi `workflowMotionPresets._renderTimingCurve()`;
     * zoom +/- chỉ giãn trục thời gian (scaleX), không persist, về 0 mỗi lần vẽ. */
    _renderPointMoveTiming() {
        this._currentRenderFn = () => this._renderPointMoveTiming();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        APP_SETTINGS_SCREEN_BY_FOUND[Boolean(preset)](() => this._render(
            t('motionSettingsDrawer.pointMove.timing.label'),
            renderPointMoveTimingBody(preset.pointMoves), // components/motion-settings-drawer.js
            (body) => {
                workflowMotionPresets._renderTimingCurve(body.querySelector('#ptmove-timing-container')); // event/workflow/motion-presets.js
                workflowMotionPresets.resetPointMoveTimingZoom();
            },
        ));
    },

    // ===================== Language (TPL_SETTINGS_LANGUAGE + renderLanguageOptions(), cụm "languageSettings") =====================

    _renderLanguage() {
        this._currentRenderFn = () => this._renderLanguage();
        this._render(t('appSettings.system.language.label'), TPL_SETTINGS_LANGUAGE, async () => {
            await renderLanguageOptions(); // lang/language-settings.js
        });
    },

    // ===================== Visualizer Screen — Display/Subtitles/Auto-Switch/Background Color/Gesture/Player =====================

    _renderVisualizerScreen() {
        this._currentRenderFn = () => this._renderVisualizerScreen();
        const rows = [
            { key: 'display', icon: 'monitor', labelKey: 'settingsVisualizer.openDisplay.label', hintKey: 'settingsVisualizer.openDisplay.hint' },
            { key: 'subtitle', icon: 'subtitle', labelKey: 'settingsSubtitleStyle.sectionTitle', hintKey: 'settingsSubtitleStyle.openPanel.hint' },
            { key: 'autoSwitch', icon: 'refresh', labelKey: 'settingsVisualizer.openAutoSwitch.label', hintKey: 'settingsVisualizer.openAutoSwitch.hint' },
            // Chỉ card màu nền; phần media (toggle tổng + Media + Playback) ở Player > Song > Background Media.
            { key: 'visualBgColor', icon: 'color-swatch', labelKey: 'settingsVisualizer.bgColor.label', hintKey: 'settingsVisualizer.bgColor.hint' },
            // Cử chỉ chỉ có tác dụng trên #visualizer-gesture-surface nên nằm ở nhóm này (-> _renderGesture()).
            { key: 'gesture', icon: 'hand', labelKey: 'settingsVisualizer.gesture.label', hintKey: 'settingsVisualizer.gesture.hint' },
            // Resolution + Motion của Video/Photo lúc phát chính (core/player-display-settings.js).
            { key: 'player', icon: 'play-circle', labelKey: 'appSettings.player.label', hintKey: 'appSettings.player.hint' },
        ];
        this._render(t('appSettings.row.visualizerScreen'), renderAppSettingsRowList(rows), wireAppSettingsRowList); // core/app-settings-ui.js — data-app-settings-nav, TÁI DÙNG cơ chế chung
    },

    _renderDisplay() {
        this._currentRenderFn = () => this._renderDisplay();
        this._render(t('visualizerDisplayPanel.title'), renderVisualizerDisplayPanelBody(), () => {
            workflowVisualizerDisplay.openDisplayPanel(); // event/workflow/visualizer-display.js
        });
    },

    /** Sub panel "Effect list" của Auto-Switch (danh sách group/style; kéo thả ủy quyền ở event/listener/auto-switch-visual.js). */
    _renderAutoSwitchList() {
        this._currentRenderFn = () => this._renderAutoSwitchList();
        this._render(t('visualizerSettingsDrawer.autoSwitchList.label'), renderVisualizerAutoSwitchListBody(workflowAutoSwitchVisual.buildPanelModel())); // components/settings/visualizer-auto-switch-drawer.js
    },

    _renderAutoSwitch() {
        this._currentRenderFn = () => this._renderAutoSwitch();
        this._render(t('visualizerAutoSwitchDrawer.title'), renderVisualizerAutoSwitchPanelBody(workflowAutoSwitchVisual.buildPanelModel())); // body vẽ từ model (event/workflow/auto-switch-visual.js)
    },

    /** Visualizer Screen > Background Color: CHỈ card
     * màu nền (Solid/Gradient), sub panel Gradient (`_renderVisualBgGradient()`). Phần media ở
     * `_renderPlayerSongBgMedia()`. CÙNG workflowVisualBg (openPanel()/refreshPanelUI() tự bỏ qua control không có). */
    _renderVisualBgColor() {
        this._currentRenderFn = () => this._renderVisualBgColor();
        this._render(t('settingsVisualizer.bgColor.label'), renderVisualBgColorPanelBody(), () => { // components/visual-bg-settings-drawer.js
            workflowVisualBg.openPanel(); // event/workflow/visual-bg-common.js
        });
    },

    _renderVisualBgGradient() {
        this._currentRenderFn = () => this._renderVisualBgGradient();
        this._render(t('visualBgSettingsDrawer.openGradient.label'), renderVisualBgGradientPanelBody(), () => {
            workflowVisualBg.openGradientPanel(); // event/workflow/visual-bg.js
        });
    },

    /** Danh sách hàng dựng SẴN trong bodyHtml (workflowVisualBg đọc DB TRƯỚC khi chuyển màn, xem
     * event/workflow/visual-bg-video.js::openVideoAudioPanel()) -> chiều cao Drawer đo đúng ngay, không co rồi giãn. */
    _renderVisualBgVideoAudio() {
        this._currentRenderFn = () => this._renderVisualBgVideoAudio();
        this._render(t('visualBgSettingsDrawer.openVideoAudio.label'), renderVisualBgVideoAudioPanelBody(workflowVisualBg.buildVideoAudioListHtml()), () => { // components/visual-bg-video-audio-drawer.js
            workflowVisualBg.mountVideoAudioPanel(); // event/workflow/visual-bg-video.js
        });
    },

    // ===================== Player — Song (Background Media) + Resolution/Motion của Video/Photo lúc PHÁT CHÍNH =====
    // core/player-display-settings.js, core/config.js::DEFAULT_PLAYER_DISPLAY_CONFIG. Motion mỗi vai trò lưu ở domain
    // 'playerDisplay', chọn qua màn Chọn của Motion (event/workflow/player-display-settings.js::openMotionSlotPicker()).
    // 2 kind 'video'/'photo' đối xứng -> dùng chung _renderPlayerDetail().

    /** Danh sách con — Song/Video/Photo, CÙNG khuôn renderAppSettingsRowList() (data-app-settings-nav). */
    _renderPlayer() {
        this._currentRenderFn = () => this._renderPlayer();
        const rows = [
            { key: 'playerSong', icon: 'music-note', labelKey: 'appSettings.player.song.label', hintKey: 'appSettings.player.song.hint' },
            { key: 'playerVideo', icon: 'video-camera', labelKey: 'appSettings.player.video.label', hintKey: 'appSettings.player.video.hint' },
            { key: 'playerPhoto', icon: 'photograph', labelKey: 'appSettings.player.photo.label', hintKey: 'appSettings.player.photo.hint' },
        ];
        this._render(t('appSettings.player.label'), renderAppSettingsRowList(rows), wireAppSettingsRowList); // core/app-settings-ui.js — TÁI DÙNG cơ chế chung data-app-settings-nav
    },

    /** Player > Song: danh sách con, hiện có 1 row Background Media. */
    _renderPlayerSong() {
        this._currentRenderFn = () => this._renderPlayerSong();
        const rows = [
            { key: 'playerSongBgMedia', icon: 'photograph', labelKey: 'appSettings.player.song.bgMedia.label', hintKey: 'appSettings.player.song.bgMedia.hint' },
        ];
        this._render(t('appSettings.player.song.label'), renderAppSettingsRowList(rows), wireAppSettingsRowList); // core/app-settings-ui.js
    },

    /** Player > Song > Background Media: toggle tổng + Media + Playback
     * của Visual Background. Sub panel Video audio (`_renderVisualBgVideoAudio()`) + picker Generic Drawer con (video/ảnh/
     * thư mục — event/workflow/visual-bg-common.js tự gọi lại hàm này để quay về đúng chỗ, xem `_closePickerDrawer()`). */
    _renderPlayerSongBgMedia() {
        this._currentRenderFn = () => this._renderPlayerSongBgMedia();
        this._render(t('appSettings.player.song.bgMedia.label'), renderVisualBgMediaPanelBody(), () => { // components/visual-bg-settings-drawer.js
            workflowVisualBg.openPanel(); // event/workflow/visual-bg-common.js
        });
    },

    _renderPlayerVideo() {
        this._currentRenderFn = () => this._renderPlayerVideo();
        this._renderPlayerDetail('video');
    },

    _renderPlayerPhoto() {
        this._currentRenderFn = () => this._renderPlayerPhoto();
        this._renderPlayerDetail('photo');
    },

    /** System > Ghi âm, domain 'recorder' (core/config.js).
     * Recording mode / Count-in / Recording quality (select) + Sync (slider) + Latency calibration (nút);
     * đổi Recording mode -> workflowRecorder.changeConfigField() gọi lại hàm này (Sync + nút đo chỉ có ở Headphones). */
    _renderRecorder() {
        this._currentRenderFn = () => this._renderRecorder();
        this._render(t('appSettings.system.recorder.label'), renderRecorderSettingsBody(appConfigRecorder.getAll()), wireAppSettingsRecorder); // components/settings/recorder-settings.js, core/config.js, core/app-settings-ui.js
    },

    /** Dựng CHUNG 1 màn Resolution + Motion cho Video/Photo (2 kind gần như đối xứng, chỉ khác
     * field config đọc/ghi — Photo lọc bỏ vai trò `reactBeat`, xem core/player-display-settings.js
     * ::getPlayerMotionSlotsForKind()) — xem components/settings/player-display-settings.js
     * ::renderPlayerDisplayBody(). Mỗi vai trò Motion là 1 HÀNG (tên preset đang gắn / "None") mở màn Chọn của
     * Motion — truyền TOÀN BỘ `motionPresets` chỉ để tra tên preset đang gắn.
     * @param {'video'|'photo'} kind */
    _renderPlayerDetail(kind) {
        const cfg = appConfigPlayerDisplay.getAll(); // core/config.js
        const motionPresets = appState.get('motionPresets');
        const titleKey = kind === 'video' ? 'appSettings.player.video.label' : 'appSettings.player.photo.label';
        this._render(t(titleKey), renderPlayerDisplayBody(kind, cfg, motionPresets), (body) => {
            wireAppSettingsPlayerDetail(body, kind); // core/app-settings-ui.js
        });
    },

    /** Ứng select Resolution đổi (Player > Video hoặc Photo). CHƯA re-render lại màn — không field
     * nào khác phụ thuộc lựa chọn Resolution (khác Theme, nơi đổi mode phải hiện/ẩn khối con). */
    async handlePlayerResolutionChange(kind, value) {
        await workflowPlayerDisplaySettings.changeResolutionMode(kind, value); // event/workflow/player-display-settings.js
    },

    /** Ứng nút reset nhanh zoom/pan (Player > Video/Photo > Zoom): về gốc rồi vẽ lại màn
     * tại chỗ (cùng độ sâu -> giữ scroll) để 3 con số Zoom/Pan X/Pan Y hiện lại giá trị mới.
     * @param {'video'|'photo'} kind */
    async handlePlayerZoomReset(kind) {
        await workflowPlayerDisplaySettings.resetZoom(kind); // event/workflow/player-display-settings.js
        this._renderPlayerDetail(kind);
    },

    /** Subtitle — row "Subtitles" ở Visualizer Screen (key 'subtitle', event/router/app-settings.js); event/workflow/
     * subtitle-style-settings.js gọi lại để quay về sau Element Style Editor. */
    _renderSubtitle() {
        this._currentRenderFn = () => this._renderSubtitle();
        this._render(t('subtitleSettingsDrawer.title'), renderSubtitlePanelBody(), () => {
            workflowSubtitleStyleSettings.openPanel(); // event/workflow/subtitle-style-settings.js
        });
    },

    // ===================== Troubleshooting — danh sách PHẲNG: [Debug console >] · [Scan & fix video thumbnails >] ·
    // [Performance HUD >] · [Restore default settings] · [Clear app cache]. "Restart app" ở icon header Playlist
    // (components/playlist-view.js, listener event/listener/settings-misc.js). =====================

    _renderTroubleshooting() {
        this._currentRenderFn = () => this._renderTroubleshooting();
        this._render(t('appSettings.row.troubleshooting'), renderTroubleshootingBody(), wireAppSettingsTroubleshooting); // components/settings/troubleshooting.js, core/app-settings-ui.js
    },

    /** Màn con Performance HUD: Hiển thị / Kiểu / Chiều (chỉ khi Kiểu = strip). Gọi lại
     * tại chỗ từ workflowPerfHud.setStyle()/setOrientation() (event/workflow/perf-hud.js) để cập nhật nút đang chọn. */
    _renderPerfHudSettings() {
        this._currentRenderFn = () => this._renderPerfHudSettings();
        this._render(t('appSettings.troubleshooting.perfHud.label'), renderPerfHudSettingsBody(appConfigPerfHud.getAll()), wireAppSettingsPerfHud); // components/settings/troubleshooting.js, core/config.js, core/app-settings-ui.js
    },

    /** Debug console — TÁI DÙNG NGUYÊN workflowSettingsMisc.openDebugConsole() (vẽ danh sách log + wire nút). */
    _renderDebugConsole() {
        this._currentRenderFn = () => this._renderDebugConsole();
        this._render(t('settingsMisc.debugConsole.title'), renderDebugConsolePanelBody(), () => {
            workflowSettingsMisc.openDebugConsole(); // event/workflow/settings-misc.js
        });
    },

    /** Scan & fix video thumbnails — CHỈ phần kiểm tra/sửa thumb của Video.
     * KHÔNG phải "Scan & clean broken files" của panel Storage (khối đó GIỮ NGUYÊN ở Storage). Wire 3 nút ở
     * core/app-settings-ui.js::wireAppSettingsVideoThumb() -> router 'fileManagerStorage'. */
    _renderVideoThumbRepair() {
        this._currentRenderFn = () => this._renderVideoThumbRepair();
        this._render(t('appSettings.troubleshooting.videoThumb.label'), renderVideoThumbRepairBody(), wireAppSettingsVideoThumb); // components/settings/troubleshooting.js, core/app-settings-ui.js
    },
};
