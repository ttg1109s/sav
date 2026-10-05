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
 * CÒN NỢ (Giang dời lại): nút Cancel của picker chọn THƯ MỤC video trong Visual Background chưa tự quay lại màn Visual
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
/** Carousel Main (xem `_renderMain()`): chờ drawer trượt lên gần xong rồi mới cho card đầu tiên phóng
 * to, thời lượng phóng to, và độ trễ debounce sau sự kiện `scroll` CUỐI CÙNG để coi là "đã dừng hẳn"
 * (kéo lại về bản lặp giữa — xem core/settings-carousel-ui.js::settleSettingsCarouselLoop()). Timer
 * chạy qua taskManager (task-manager-conventions.md — CHỈ Workflow được hẹn giờ). */
const APP_SETTINGS_CAROUSEL_ENTRANCE_DELAY_MS = 180;
const APP_SETTINGS_CAROUSEL_ENTRANCE_MS = 420;
const APP_SETTINGS_CAROUSEL_SETTLE_DELAY_MS = 140;
const APP_SETTINGS_CAROUSEL_ENTRANCE_TASK = 'appSettingsCarouselEntrance';
const APP_SETTINGS_CAROUSEL_ENTRANCE_END_TASK = 'appSettingsCarouselEntranceEnd';
const APP_SETTINGS_CAROUSEL_SETTLE_TASK = 'appSettingsCarouselSettle';

// 6 field của 1 Point Move (màn Point Move Edit).
const APP_SETTINGS_POINT_MOVE_FIELD_KEYS = ['linearX', 'linearY', 'rotate', 'zoom', 'flipX', 'flipY'];

const workflowAppSettings = {

    _carouselTouching: false, // ngón tay còn đang chạm carousel Main — không nhảy scrollLeft lúc đang kéo tay
    _screenStack: [], // mảng hàm render (KHÔNG gồm màn hiện tại) — back() pop ra màn NGAY TRƯỚC
    _playlistFilterListPageIndex: 0, // MỚI 23/09/2026 — trang đang xem của danh sách preset Filter (nơi 'filterPresets' của Pagination), core tự kẹp
    _playlistFilterListSource: null, // MỚI 23/09/2026 — Nguồn của lần vẽ danh sách Filter trước — đổi Nguồn thì về trang 1
    _motionListPageIndex: 0, // MỚI 23/09/2026 — trang đang xem của danh sách preset Motion (nơi 'motionPresets' của Pagination), sống theo phiên, core tự kẹp
    _scrollResetPending: false, // MỚI (24/09/2026) — true = lần `_render()` kế tiếp là màn ĐI TỚI (open/navigateTo) -> bắt đầu từ đầu; false = vẽ lại tại chỗ hoặc quay lại -> giữ/khôi phục vị trí cuộn (event/workflow/generic-drawer-helpers.js, `scrollKey`)
    _mainCarouselIndex: 0, // MỚI (20/09/2026) — mục (0..4) đang ở giữa carousel Main lần cuối người dùng bấm mở 1 màn con — Back về Main giữ đúng mục đó ở giữa; `open()` luôn reset về 0 (mục đầu tiên)

    open() {
        this._screenStack = [];
        this._scrollResetPending = true; // MỚI (24/09/2026) — mở Settings luôn từ đầu
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
        this._scrollResetPending = true; // MỚI (24/09/2026) — màn đi TỚI bắt đầu từ đầu; vị trí màn vừa rời đã được nhớ theo key độ sâu (event/workflow/generic-drawer-helpers.js)
        renderFn();
    },

    /** Ứng với nút Back động ở header (mọi màn trừ Main). */
    back() {
        const prev = this._screenStack.pop();
        if (!prev) { this.close(); return; } // không còn gì để lùi (không nên xảy ra — Main không có nút Back) -> đóng hẳn cho an toàn
        prev(); // SỬA (24/09/2026) — `_scrollResetPending` vẫn false -> `_render()` khôi phục đúng vị trí cuộn lúc rời màn này (event/workflow/generic-drawer-helpers.js)
    },

    // ===================== Khung dùng chung =====================

    /** Dựng header (Back nếu không phải Main + Close X) + body bọc `p-4`, mở/swap Generic Drawer, rồi `onMount(body)` —
     * chỉ đồng bộ giá trị hoặc gọi hàm wire của core, không addEventListener.
     * @param {string} title @param {string} bodyHtml @param {(body: HTMLElement) => void} [onMount]
     * @param {string} [extraHeaderHtml] - nút hành động riêng của màn, đặt trước nút Close (tương tác qua Listener của màn đó).
     */
    _render(title, bodyHtml, onMount, extraHeaderHtml) {
        const hasBack = this._screenStack.length > 0;
        // MỚI (24/09/2026, Giang báo "vẽ lại panel mất scroll cũ" + "quay về panel cũ luôn về 0") — mỗi độ
        // sâu ngăn xếp là 1 `scrollKey` riêng (màn ở độ sâu N luôn là màn đang hiện/sẽ quay lại ở độ sâu đó).
        // Vẽ lại tại chỗ (cùng độ sâu, kể cả từ Workflow miền khác) -> giữ vị trí; `back()` -> về đúng vị trí
        // lúc rời đi (kể cả khi giữa chừng Drawer bị picker/Element Style Editor chiếm tạm rồi gọi lại
        // `_renderXxx()`); `open()`/`navigateTo()` -> từ đầu.
        const scrollReset = this._scrollResetPending;
        this._scrollResetPending = false;
        const config = {
            scrollKey: `appSettings@${this._screenStack.length}`,
            scrollReset,
            height: 'auto', // MỚI (phản hồi Giang mục 2) — tự co theo nội dung, xem core/generic-drawer.js
            maxHeight: '85vh',
            headerHtml: `
                <div class="relative flex items-center justify-center px-14 py-3 border-b" data-uitk="dividerBorder">
                    ${hasBack ? `
                    <button id="btn-app-settings-back" class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full" data-uitk="cardHoverBg headerCloseIcon">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>` : ''}
                    <h3 class="text-base truncate text-center" data-uitk="headerTitle">${title}</h3>
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        ${extraHeaderHtml || ''}
                        <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="cardHoverBg headerCloseIcon">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            `,
            bodyHtml: `<div class="p-4" data-uitk="textPrimary">${bodyHtml}</div>`,
            bodyClass: 'overflow-y-auto',
        };
        if (genericDrawerPanel.classList.contains('hidden')) workflowGenericDrawerHelpers.open(config); else workflowGenericDrawerHelpers.update(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        wireAppSettingsHeader(genericDrawerHeader); // core/app-settings-ui.js — Rule 5a

        if (onMount) onMount(genericDrawerBody);
        // MỚI (24/09/2026) — onMount có thể làm nội dung CAO thêm (bỏ `hidden` các hàng theo config, vd Visual
        // BG `refreshPanelUI()`) — lúc gắn nội dung còn thấp nên vị trí cuộn bị kẹp; áp lại đích sau onMount.
        workflowGenericDrawerHelpers.restoreScroll(); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
    },

    // ===================== Main =====================

    _renderMain() {
        this._currentRenderFn = () => this._renderMain();
        this._render(t('appSettings.title'), renderAppSettingsMainBody(), (body) => { // components/settings/app-settings-main.js — carousel ngang (SỬA 20/09/2026)
            wireAppSettingsMainCarousel(body); // core/app-settings-ui.js — chỉ wire sự kiện -> eventBus
            const scrollerEl = body.querySelector('#app-settings-carousel');
            this._carouselTouching = false;
            initSettingsCarousel(scrollerEl, this._mainCarouselIndex); // core/settings-carousel-ui.js — đặt mục hiện tại vào tâm, card vẫn nhỏ/mờ
            // Hiệu ứng mở: đợi drawer trượt lên gần xong -> card ở tâm phóng to -> hết animation thì gỡ transition (cuộn theo tay tức thì).
            taskManager.once(() => {
                startSettingsCarouselEntrance(scrollerEl, APP_SETTINGS_CAROUSEL_ENTRANCE_MS); // core/settings-carousel-ui.js
                taskManager.once(() => endSettingsCarouselEntrance(scrollerEl), APP_SETTINGS_CAROUSEL_ENTRANCE_MS + 40, APP_SETTINGS_CAROUSEL_ENTRANCE_END_TASK);
            }, APP_SETTINGS_CAROUSEL_ENTRANCE_DELAY_MS, APP_SETTINGS_CAROUSEL_ENTRANCE_TASK);
        });
    },

    /** Mỗi sự kiện `scroll` của carousel Main (Router 'appSettings.carousel.scroll') — cập nhật
     * scale/opacity theo vị trí + đặt lại (debounce, cùng tên task) bộ đếm "đã dừng cuộn". */
    handleCarouselScroll(scrollerEl) {
        updateSettingsCarouselFocus(scrollerEl); // core/settings-carousel-ui.js
        this._scheduleCarouselSettle(scrollerEl);
    },

    /** Ngón tay chạm/nhấc khỏi carousel Main (Router 'appSettings.carousel.touch.start|end'). Nhấc tay
     * -> hẹn lại "đã dừng" (có thể lúc chạm cuộn đã đứng yên sẵn, không còn sự kiện scroll nào tới nữa). */
    handleCarouselTouch(scrollerEl, isTouching) {
        this._carouselTouching = isTouching;
        if (!isTouching) this._scheduleCarouselSettle(scrollerEl);
    },

    _scheduleCarouselSettle(scrollerEl) {
        taskManager.once(() => {
            if (this._carouselTouching) return; // còn đang kéo tay — touchend sẽ hẹn lại
            settleSettingsCarouselLoop(scrollerEl); // core/settings-carousel-ui.js
        }, APP_SETTINGS_CAROUSEL_SETTLE_DELAY_MS, APP_SETTINGS_CAROUSEL_SETTLE_TASK);
    },

    /** Tap 1 card ở carousel Main (Router 'appSettings.carousel.card.click').
     * @returns {boolean} true = card VỪA được cuộn vào giữa (chưa mở gì); false = card ĐÃ ở giữa
     *          -> nhớ vị trí (để Back về Main giữ nguyên mục này ở giữa) và để Router mở màn đích. */
    handleCarouselCardTap(scrollerEl, cardEl) {
        const focusedCardEl = getSettingsCarouselFocusCard(scrollerEl); // core/settings-carousel-ui.js — dùng RETURN VALUE để rẽ nhánh
        if (focusedCardEl !== cardEl) {
            scrollSettingsCarouselTo(scrollerEl, cardEl); // core/settings-carousel-ui.js
            return true;
        }
        this._mainCarouselIndex = Number(cardEl.dataset.carouselIndex) || 0;
        return false;
    },

    // ===================== Playlist (TÁI DÙNG TPL_SETTINGS_PLAYLIST_VIEW + workflowPlaylist) =====

    _renderPlaylist() {
        this._currentRenderFn = () => this._renderPlaylist();
        this._render(t('appSettings.row.playlist'), TPL_SETTINGS_PLAYLIST_VIEW, (body) => {
            const mediaSourceSelect = body.querySelector('#setting-playlist-media-source');
            if (mediaSourceSelect) mediaSourceSelect.value = appState.get('activeMediaSource');
            // XOÁ (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") — lời gọi
            // `PlaylistMain.updateActiveFolderUI(mediaSourceSelect)` (khoá <select> + chèn option
            // tên folder khi có Scope) bỏ hẳn cùng hàm đó — `<select>` "Nguồn" ở đây trở lại bình
            // thường, chỉ còn đồng bộ `.value` như dòng ngay trên. Báo "đang Scope folder nào" giờ
            // là việc của badge trong ô tìm kiếm Playlist (components/playlist-view.js), tự cập
            // nhật từ event/workflow/playlist-scope.js, không liên quan gì tới màn Settings này nữa.
            const viewModeSelect = body.querySelector('#setting-playlist-view-mode');
            if (viewModeSelect) viewModeSelect.value = appState.get('isGridView') ? 'grid' : 'list';
            wireAppSettingsPlaylist(body); // core/app-settings-ui.js
        });
    },

    _renderPlaylistSort() {
        this._currentRenderFn = () => this._renderPlaylistSort();
        const source = appState.get('activeMediaSource'); // MỚI (hợp nhất Photo vào Playlist) — Photo ẩn 2 field times/duration
        this._render(t('playlistSortPanel.title'), renderPlaylistSortPanelBody(source), () => {
            workflowPlaylist.openSortPanel(); // event/workflow/playlist.js — đồng bộ giá trị (đã migrate sang genericDrawerBody)
        });
    },

    /** Danh sách preset Filter của Nguồn đang chọn (mỗi Nguồn 1 danh sách riêng) — đổi Nguồn so với lần vẽ trước thì về
     * trang 1. Tương tác: event/listener/playlist-filter-presets.js. */
    _renderPlaylistFilterList() {
        this._currentRenderFn = () => this._renderPlaylistFilterList();
        const source = appState.get('activeMediaSource');
        const presets = appState.get('playlistFilterPresets')[source];
        const activeId = appState.get('playlistFilterActivePresetId')[source];
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
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets')[source], workflowPlaylistFilterPresets._editingId); // core/playlist/filter-presets.js
        if (!preset) { this.back(); return; } // guard: preset vừa bị xoá ở nơi khác
        const isActive = preset.id === appState.get('playlistFilterActivePresetId')[source];
        this._render(
            tFormat('playlistFilterPresetsDrawer.edit.titleForSource', { source: t('settingsPlaylistBg.mediaSource.' + source) }),
            renderPlaylistFilterEditBody(preset, source, isActive), // components/playlist-filter-drawer.js
            () => workflowPlaylistFilterPresets._syncEditUI(), // event/workflow/playlist-filter-presets.js — đổ giá trị field sau mount
        );
    },

    // ===================== System (Theme/Motion/Language/Recording/Pagination) =====================

    _renderSystem() {
        this._currentRenderFn = () => this._renderSystem();
        const rows = [
            { key: 'theme', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h9a2 2 0 012 2v12a4 4 0 01-4 4H7zm0 0h10a2 2 0 002-2v-9', labelKey: 'appSettings.system.theme.label', hintKey: 'appSettings.system.theme.hint' },
            { key: 'motion', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'appSettings.system.motion.label', hintKey: 'appSettings.system.motion.hint' },
            { key: 'language', icon: 'M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18M21 12a9 9 0 11-18 0 9 9 0 0118 0z', labelKey: 'appSettings.system.language.label', hintKey: 'appSettings.system.language.hint' },
            // DỜI (05/10/2026, Giang yêu cầu) — Ghi âm từ Visualizer Screen > Player sang System, đứng trên Pagination.
            { key: 'recorder', icon: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM19 11a7 7 0 01-14 0M12 18v3M8.5 21h7', labelKey: 'appSettings.system.recorder.label', hintKey: 'appSettings.system.recorder.hint' },
            // MỚI 23/09/2026 (Giang yêu cầu) — cài đặt CHUNG cho mọi danh sách có phân trang, xem _renderPagination() bên dưới.
            { key: 'pagination', icon: 'M4 6h16M4 11h16M8 16l-2 2.5L8 21M16 16l2 2.5-2 2.5', labelKey: 'appSettings.system.pagination.label', hintKey: 'appSettings.system.pagination.hint' },
        ];
        this._render(t('appSettings.row.system'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js
    },

    // ===================== Pagination (MỚI 23/09/2026) — mỗi NƠI 1 checkbox + số item/trang + kiểu riêng =====================
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
        if (field === 'enabled') await workflowPagination.changePlaceEnabled(place, value); // event/workflow/pagination.js
        else if (field === 'pageSize') await workflowPagination.changePlacePageSize(place, value);
        else if (field === 'style') await workflowPagination.changePlaceStyle(place, value);
        this._renderPagination(); // vẽ lại tại chỗ — `_render()` tự giữ vị trí cuộn (SỬA 24/09/2026, bỏ lưu/khôi phục tay cũ)
    },

    // ===================== Theme — CHỈ 1 lựa chọn "Color" (Light/Dark/Morphin) =====================
    // SỬA 21/09/2026 (Giang yêu cầu "bỏ phần Background, thay Interface = Color; chỉ hiện chọn ảnh nền/gradient khi chọn
    // Morphin"): select "Background" cũ (viz.themeMode light/dark/glass) ĐÃ XOÁ — light/dark của nó thực chất không vẽ gì
    // (chỉ 'gradient'/'background' mới có nền, xem core/color-utils.js::updatePlaylistBg). Giờ 1 select "Color" = UI Theme
    // (core/ui-theme/*), và phần chọn NỀN (None/Gradient/Background media) CHỈ dựng khi Color = Morphin — nền chỉ có nghĩa với kính mờ.
    // Các luồng nền GIỮ NGUYÊN: TÁI DÙNG router 'theme' gốc (event/router/theme.js — KHÔNG đổi gì) qua eventBus.

    /** SỬA 23/09/2026 — 3 card nền Morphin giờ là None/Gradient/Background media (Giang bỏ Solid — mode 'solid' + `bgSolidColor` đã xoá, xem
     * DEFAULT_VIZ_CONFIG, core/config.js). */
    _renderTheme() {
        this._currentRenderFn = () => this._renderTheme();
        const activeUiTheme = getSelectableUiThemeNames().includes(appConfigUiTheme.getAll().activeUiTheme) ? appConfigUiTheme.getAll().activeUiTheme : UI_THEME_DEFAULT_NAME; // core/config.js + core/ui-theme/registry.js — tên lạ/không cho chọn -> Light (khớp theme THẬT đang áp)
        const isMorphin = activeUiTheme === 'morphin';
        // SỬA 21/09/2026 (Giang yêu cầu 3 card + sửa lỗi dropdown nền nhảy ngược): phần nền CHỈ dựng khi Morphin — 3 card Solid/Gradient/Background media
        // (core/theme-background-ui.js), trạng thái do workflowTheme.buildBackgroundCardState() đọc từ config (mode `solid` giờ có thật, không "đoán" nữa).
        const backgroundSectionHtml = isMorphin ? buildThemeBackgroundCardsHtml(workflowTheme.buildBackgroundCardState(), t) : ''; // core/theme-background-ui.js
        const bodyHtml = `
            <div class="flex flex-col gap-2">
                <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                    <div class="flex justify-between items-center px-4 py-3.5">
                        <span class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${t('appSettings.theme.uiTheme.label')}</span>
                        <select id="app-settings-ui-theme-select" class="rounded-lg px-2 py-1.5 text-xs outline-none w-40 text-right" data-uitk="inputBg inputBorder inputText">
                            ${getSelectableUiThemeNames().map((name) => `<option value="${name}">${t('appSettings.theme.uiTheme.option.' + name)}</option>`).join('')}
                        </select>
                    </div>
                    ${backgroundSectionHtml}
                </div>
            </div>
        `;
        this._render(t('appSettings.system.theme.label'), bodyHtml, (body) => {
            body.querySelector('#app-settings-ui-theme-select').value = activeUiTheme;
            wireAppSettingsTheme(body); // core/app-settings-ui.js
            wireThemeBackgroundCards(body); // core/theme-background-ui.js — no-op khi không có cụm 3 card (Color khác Morphin)
        });
    },

    /** Ứng với 'appSettings.uiTheme.change' (Router gọi) — đổi màu GIAO DIỆN (Light/Dark/Morphin) RỒI đồng bộ NỀN phía sau
     * app cho khớp: Morphin CẦN có nền (ảnh/gradient) để lớp kính có gì để làm mờ -> chưa có nền nào thì đặt mặc định
     * 'gradient' (indigo→pink, core/config.js); Light/Dark dùng panel ĐẶC nên nền phía sau vô nghĩa -> tắt (mode 'light'/'dark' của
     * router 'theme' gốc tự `applyBgImageEnabled(false)`, ảnh đã chọn bị bỏ, 2 màu gradient vẫn nhớ). Cuối cùng dựng lại màn
     * Theme để phần chọn nền hiện/ẩn đúng theo Color mới. `eventBus.send` router 'theme' là đường DUY NHẤT vào luồng đổi nền
     * (Router tự tính VirtualMachineState, xem event/router/theme.js). */
    async handleUiThemeChange(themeName) {
        await workflowUiTheme.switchUiTheme(themeName); // event/workflow/ui-theme.js
        const vizCfg = appConfigViz.getAll();
        const morphinAlreadyHasBackground = ['none', 'gradient', 'background'].includes(vizCfg.themeMode); // SỬA 23/09/2026 — 'solid' đã bỏ, thêm 'none'
        // Vào Morphin lúc đang Light/Dark: SỬA 23/09/2026 (Giang báo "Morphin -> chọn media -> chọn kiểu khác -> đổi theme -> vào lại Morphin bị fallback về
        // Background media") — trước đây cứ còn media là ép 'background', bỏ qua kiểu vừa chọn. Giờ dùng đúng kiểu Morphin chọn gần nhất
        // (event/workflow/theme.js::resolveMorphinEntryMode()).
        const morphinStartMode = workflowTheme.resolveMorphinEntryMode();
        if (themeName === 'morphin' && !morphinAlreadyHasBackground) eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: morphinStartMode } });
        else if (themeName !== 'morphin') eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: themeName } }); // 'light' | 'dark' — tắt nền
        this._renderTheme();
    },

    // ===================== Gesture (TÁI DÙNG NGUYÊN renderGestureSettingsPanelBody() +
    // workflowGestureSettings — ĐÃ migrate sang genericDrawerBody) =====================

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

    /** MỚI 23/09/2026 — ứng với 'appSettings.playlistFilterList.page.change' (thanh phân trang danh sách
     * preset Filter). Vẽ lại tại chỗ, cuộn về đầu. @param {number} pageIndex */
    setPlaylistFilterListPage(pageIndex) {
        this._playlistFilterListPageIndex = pageIndex;
        this._renderPlaylistFilterList();
        genericDrawerBody.scrollTop = 0;
    },

    /** MỚI 23/09/2026 — ứng với 'appSettings.motionList.page.change' (thanh phân trang danh sách Motion).
     * Vẽ lại tại chỗ (không push ngăn xếp), cuộn về đầu để thấy trang mới từ trên xuống.
     * @param {number} pageIndex */
    setMotionListPage(pageIndex) {
        this._motionListPageIndex = pageIndex;
        this._renderMotionList();
        genericDrawerBody.scrollTop = 0;
    },

    /** Danh sách preset ở chế độ Chọn (phiên do `workflowMotionPresets.openPicker()` giữ) — tap dòng = chọn nháp, nút
     * Apply ở header = xác nhận + back(). Phân trang dùng chung nơi 'motionPresets'. */
    _renderMotionPicker() {
        this._currentRenderFn = () => this._renderMotionPicker();
        const data = workflowMotionPresets.getPickerRenderData(); // event/workflow/motion-presets.js
        if (!data) { this.back(); return; } // guard: phiên Chọn đã kết thúc
        this._render(
            data.title,
            renderMotionPickerBody(data.view.pageItems, data.draftId, workflowPagination.buildControlsHtml(data.view)), // components/motion-settings-drawer.js
            (body) => wirePaginationControls(body.querySelector('#motion-picker-pagination'), 'motionPresets', 'motionPresets.picker.page.change'), // core/pagination-ui.js
            renderMotionPickerApplyButtonHtml(), // components/motion-settings-drawer.js
        );
    },

    /** Sửa 1 preset (`workflowMotionPresets._editingId`). */
    _renderMotionEdit() {
        this._currentRenderFn = () => this._renderMotionEdit();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        if (!preset) { this.back(); return; } // guard: preset vừa bị xoá ở nơi khác
        this._render(
            t('motionPresetsDrawer.edit.title'),
            renderMotionEditBody(preset), // components/motion-settings-drawer.js
            () => workflowMotionPresets._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio), // event/workflow/motion-presets.js
        );
    },

    /** Danh sách point move của preset đang sửa — [kéo] | checkbox | tên | nhân bản | xoá | sửa. Kéo tay cầm hoán đổi
     * toàn bộ 2 point move (workflowMotionPresets.startPointMoveDrag()/endPointMoveDrag()). */
    _renderPointMoveList() {
        this._currentRenderFn = () => this._renderPointMoveList();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        if (!preset) { this.back(); return; }
        this._render(t('motionSettingsDrawer.pointMove.list.label'), renderPointMoveListBody(preset)); // components/motion-settings-drawer.js
    },

    /** Sửa 1 point move (`workflowMotionPresets._editingPointMoveId`) — 6 field cùng hình dạng UI. */
    _renderPointMoveEdit() {
        this._currentRenderFn = () => this._renderPointMoveEdit();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, workflowMotionPresets._editingPointMoveId) : null; // core/motion-presets.js
        if (!pointMove) { this.back(); return; }
        this._render(
            t('motionSettingsDrawer.pointMove.edit.title'),
            renderPointMoveEditBody(pointMove), // components/motion-settings-drawer.js
            () => APP_SETTINGS_POINT_MOVE_FIELD_KEYS.forEach((fieldKey) => workflowMotionPresets._updatePointMoveFieldLabel(fieldKey)), // event/workflow/motion-presets.js — ô số + dải tô màu lúc mở
        );
    },

    /** Đường cong Timing (chỉ khi `pointMoveRunMode==='all'`) — SVG dựng bởi `workflowMotionPresets._renderTimingCurve()`;
     * zoom +/- chỉ giãn trục thời gian (scaleX), không persist, về 0 mỗi lần vẽ. */
    _renderPointMoveTiming() {
        this._currentRenderFn = () => this._renderPointMoveTiming();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        if (!preset) { this.back(); return; }
        this._render(
            t('motionSettingsDrawer.pointMove.timing.label'),
            renderPointMoveTimingBody(preset.pointMoves), // components/motion-settings-drawer.js
            (body) => {
                workflowMotionPresets._renderTimingCurve(body.querySelector('#ptmove-timing-container')); // event/workflow/motion-presets.js
                workflowMotionPresets.resetPointMoveTimingZoom();
            },
        );
    },

    // ===================== Language (TÁI DÙNG NGUYÊN TPL_SETTINGS_LANGUAGE +
    // renderLanguageOptions()/updateLanguageDeleteButtonVisibility() — ĐÃ migrate sang
    // genericDrawerBody, listener cụm "languageSettings" KHÔNG đổi gì) =====================

    _renderLanguage() {
        this._currentRenderFn = () => this._renderLanguage();
        this._render(t('appSettings.system.language.label'), TPL_SETTINGS_LANGUAGE, async () => {
            await renderLanguageOptions(); // lang/language-settings.js
        });
    },

    // ===================== Visualizer Screen — Display/Auto-Switch/Visual Background (TÁI DÙNG
    // NGUYÊN 5 hàm render + workflowVisualizerDisplay/workflowVisualBg — ĐÃ migrate sang
    // genericDrawerBody) =====================

    _renderVisualizerScreen() {
        this._currentRenderFn = () => this._renderVisualizerScreen();
        const rows = [
            { key: 'display', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM8 21h8m-4-4v4', labelKey: 'settingsVisualizer.openDisplay.label', hintKey: 'settingsVisualizer.openDisplay.hint' },
            { key: 'autoSwitch', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', labelKey: 'settingsVisualizer.openAutoSwitch.label', hintKey: 'settingsVisualizer.openAutoSwitch.hint' },
            // SỬA (05/10/2026, Giang yêu cầu) — "Visual Background" đổi thành "Background Color": màn này chỉ còn card màu
            // nền; phần media (toggle tổng + Media + Playback) dời sang Player > Song > Background Media.
            { key: 'visualBgColor', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', labelKey: 'settingsVisualizer.bgColor.label', hintKey: 'settingsVisualizer.bgColor.hint' },
            // MỚI (Giang chốt "gesture cùng nhóm chủ đề với Display/Visual Background — cử chỉ chỉ
            // có tác dụng trên #visualizer-gesture-surface") — DỜI từ System sang đây, đổi
            // labelKey/hintKey sang cặp key CÙNG namespace 'settingsVisualizer.*' đã có sẵn (chưa
            // từng dùng tới trước đợt này, xem lang/patch/patch-subtitle-settings.js) thay vì giữ
            // cặp key cũ 'appSettings.system.gesture.*' (namespace đó giờ không còn khớp vị trí
            // thật) — router 'gesture' -> _renderGesture() KHÔNG đổi gì, chỉ đổi CHỖ trỏ tới nó.
            { key: 'gesture', icon: 'M7 11.5V9a2 2 0 114 0v1.5M11 9.5V6a2 2 0 114 0v5m0-3.5V8a2 2 0 114 0v4c0 4-2 6-6 6s-5.5-1-7-4l-1.5-3a1.7 1.7 0 012.6-2.1L8 10', labelKey: 'settingsVisualizer.gesture.label', hintKey: 'settingsVisualizer.gesture.hint' },
            // MỚI (Giang yêu cầu "Player" — Resolution + Motion của Video/Photo lúc phát chính,
            // xem core/player-display-settings.js) — CÙNG nhóm chủ đề, đặt cuối danh sách.
            { key: 'player', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', labelKey: 'appSettings.player.label', hintKey: 'appSettings.player.hint' },
        ];
        this._render(t('appSettings.row.visualizerScreen'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js — data-app-settings-nav, TÁI DÙNG cơ chế chung
    },

    _renderDisplay() {
        this._currentRenderFn = () => this._renderDisplay();
        this._render(t('visualizerDisplayPanel.title'), renderVisualizerDisplayPanelBody(), () => {
            workflowVisualizerDisplay.openDisplayPanel(); // event/workflow/visualizer-display.js
        });
    },

    /** Sub panel "Effect list" của Auto-Switch (MỚI 26/09/2026 — tách danh sách group/style khỏi panel chính cho gọn). */
    _renderAutoSwitchList() {
        this._currentRenderFn = () => this._renderAutoSwitchList();
        this._render(t('visualizerSettingsDrawer.autoSwitchList.label'), renderVisualizerAutoSwitchListBody(workflowAutoSwitchVisual.buildPanelModel()), () => { // components/settings/visualizer-auto-switch-drawer.js
            workflowVisualizerDisplay.openAutoSwitchPanel(); // event/workflow/visualizer-display.js — gắn kéo thả
        });
    },

    _renderAutoSwitch() {
        this._currentRenderFn = () => this._renderAutoSwitch();
        this._render(t('visualizerAutoSwitchDrawer.title'), renderVisualizerAutoSwitchPanelBody(workflowAutoSwitchVisual.buildPanelModel()), () => { // SỬA 26/09/2026 — body vẽ từ model (event/workflow/auto-switch-visual.js)
            workflowVisualizerDisplay.openAutoSwitchPanel(); // event/workflow/visualizer-display.js
        });
    },

    /** SỬA (05/10/2026, Giang yêu cầu — tách màn Visual Background cũ) — Visualizer Screen > Background Color: CHỈ card
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

    _renderVisualBgVideoAudio() {
        this._currentRenderFn = () => this._renderVisualBgVideoAudio();
        this._render(t('visualBgSettingsDrawer.openVideoAudio.label'), renderVisualBgVideoAudioPanelBody(), () => {
            workflowVisualBg.openVideoAudioPanel(); // event/workflow/visual-bg.js
        });
    },

    // ===================== Player (MỚI, Giang yêu cầu — Resolution + Motion của Video/Photo lúc
    // PHÁT CHÍNH, xem core/player-display-settings.js/core/config.js::DEFAULT_PLAYER_DISPLAY_CONFIG.
    // Lựa chọn Motion mỗi vai trò lưu ở domain 'playerDisplay' — chọn qua màn Chọn của Motion (SỬA
    // 24/09/2026 — thay select + cơ chế đăng ký consumer 'player' cũ), xem event/workflow/player-
    // display-settings.js::openMotionSlotPicker(). 2 kind 'video'/'photo' hoàn toàn ĐỐI XỨNG -> dùng
    // chung _renderPlayerDetail() thay vì viết 2 hàm gần như giống hệt nhau) =====================

    /** Danh sách con — Song/Video/Photo, CÙNG khuôn renderAppSettingsRowList() (data-app-settings-nav). SỬA (05/10/2026,
     * Giang yêu cầu) — thêm Song (đầu danh sách, chứa Background Media); Ghi âm DỜI sang System. */
    _renderPlayer() {
        this._currentRenderFn = () => this._renderPlayer();
        const rows = [
            { key: 'playerSong', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3', labelKey: 'appSettings.player.song.label', hintKey: 'appSettings.player.song.hint' },
            { key: 'playerVideo', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', labelKey: 'appSettings.player.video.label', hintKey: 'appSettings.player.video.hint' },
            { key: 'playerPhoto', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'appSettings.player.photo.label', hintKey: 'appSettings.player.photo.hint' },
        ];
        this._render(t('appSettings.player.label'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js — TÁI DÙNG cơ chế chung data-app-settings-nav
    },

    /** MỚI (05/10/2026, Giang yêu cầu) — Player > Song: danh sách con, hiện có 1 row Background Media. */
    _renderPlayerSong() {
        this._currentRenderFn = () => this._renderPlayerSong();
        const rows = [
            { key: 'playerSongBgMedia', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'appSettings.player.song.bgMedia.label', hintKey: 'appSettings.player.song.bgMedia.hint' },
        ];
        this._render(t('appSettings.player.song.label'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js
    },

    /** MỚI (05/10/2026, tách từ màn Visual Background cũ) — Player > Song > Background Media: toggle tổng + Media + Playback
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

    /** MỚI (01/10/2026, Ghi âm) — System > Ghi âm (DỜI 05/10/2026 từ Player, Giang yêu cầu): khử tiếng vọng (toggle) + bù trễ giọng (slider), domain 'recorder'
     * (core/config.js). Đổi giá trị không vẽ lại màn (không field nào phụ thuộc nhau) — xem workflowRecorder.changeConfigField(). */
    _renderRecorder() {
        this._currentRenderFn = () => this._renderRecorder();
        this._render(t('appSettings.system.recorder.label'), renderRecorderSettingsBody(appConfigRecorder.getAll()), wireAppSettingsRecorder); // components/settings/recorder-settings.js, core/config.js, core/app-settings-ui.js
    },

    /** Dựng CHUNG 1 màn Resolution + Motion cho Video/Photo (2 kind gần như đối xứng, chỉ khác
     * field config đọc/ghi — Photo lọc bỏ vai trò `reactBeat`, xem core/player-display-settings.js
     * ::getPlayerMotionSlotsForKind()) — xem components/settings/player-display-settings.js
     * ::renderPlayerDisplayBody(). SỬA (24/09/2026) — mỗi vai trò Motion là 1 HÀNG (tên preset đang
     * gắn / "None") mở màn Chọn của Motion, KHÔNG còn select lọc theo consumer 'player' đã đăng ký —
     * truyền TOÀN BỘ `motionPresets` chỉ để tra tên preset đang gắn.
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

    /** MỚI (29/09/2026, Giang) — ứng nút reset nhanh zoom/pan (Player > Video/Photo > Zoom): về gốc rồi vẽ lại màn
     * tại chỗ (cùng độ sâu -> giữ scroll) để 3 con số Zoom/Pan X/Pan Y hiện lại giá trị mới.
     * @param {'video'|'photo'} kind */
    async handlePlayerZoomReset(kind) {
        await workflowPlayerDisplaySettings.resetZoom(kind); // event/workflow/player-display-settings.js
        this._renderPlayerDetail(kind);
    },

    // XOÁ (24/09/2026) — handlePlayerMotionSlotChange() (ứng select Motion cũ): hàng Motion giờ mở màn Chọn,
    // router gọi thẳng workflowPlayerDisplaySettings.openMotionSlotPicker() (event/router/app-settings.js).

    /** Subtitle — MỚI phát hiện lúc migrate: nằm LỒNG bên trong Display (nút "Phụ đề", components/
     * settings/visualizer-display-panel.js), không phải row riêng ở Visualizer Screen — đúng vị trí
     * cũ, chỉ đổi cơ chế hiển thị. Mở TỪ event/router/subtitle-style-settings.js (navigateTo()),
     * KHÔNG có row Main/System nào trỏ thẳng vào đây. */
    _renderSubtitle() {
        this._currentRenderFn = () => this._renderSubtitle();
        this._render(t('subtitleSettingsDrawer.title'), renderSubtitlePanelBody(), () => {
            workflowSubtitleStyleSettings.openPanel(); // event/workflow/subtitle-style-settings.js
        });
    },

    // ===================== Troubleshooting (SỬA 20/09/2026, Giang yêu cầu gộp vào 1 nhóm; SỬA 05/10/2026 sắp xếp lại)
    // — màn danh sách PHẲNG 5 hàng: [Debug console >] · [Scan & fix video thumbnails >] · [Performance HUD >] ·
    // [Restore default settings] · [Clear app cache] (2 hàng hành động xuống cuối).
    // "Restart app" KHÔNG còn ở Settings — chuyển lên icon header Playlist (components/playlist-view.js,
    // id `setting-restart-app`, đã có sẵn listener ở event/listener/settings-misc.js). =====================

    _renderTroubleshooting() {
        this._currentRenderFn = () => this._renderTroubleshooting();
        // SỬA (05/10/2026, Giang yêu cầu) — Performance HUD thành màn con (_renderPerfHudSettings()), không còn truyền trạng thái.
        this._render(t('appSettings.row.troubleshooting'), renderTroubleshootingBody(), wireAppSettingsTroubleshooting); // components/settings/troubleshooting.js, core/app-settings-ui.js
    },

    /** MỚI (05/10/2026, Giang yêu cầu) — màn con Performance HUD: Hiển thị / Kiểu / Chiều (chỉ khi Kiểu = strip). Gọi lại
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

    /** Scan & fix video thumbnails — CHỈ phần kiểm tra/sửa thumb của Video (Giang yêu cầu, 20/09/2026).
     * KHÔNG phải "Scan & clean broken files" của panel Storage (khối đó GIỮ NGUYÊN ở Storage). Wire 3 nút ở
     * core/app-settings-ui.js::wireAppSettingsVideoThumb() -> router 'fileManagerStorage'. */
    _renderVideoThumbRepair() {
        this._currentRenderFn = () => this._renderVideoThumbRepair();
        this._render(t('appSettings.troubleshooting.videoThumb.label'), renderVideoThumbRepairBody(), wireAppSettingsVideoThumb); // components/settings/troubleshooting.js, core/app-settings-ui.js
    },
};
