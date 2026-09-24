/**
 * event/workflow/app-settings.js — "THẰNG THỰC THI CUỐI" cho Setting (VIẾT LẠI, phản hồi Giang —
 * "tận dụng UI cũ, không đổi logic code, chỉ phân phối lại section + styling theo generic drawer").
 *
 * KIẾN TRÚC: Setting dùng THẲNG `core/generic-drawer.js` (singleton chung, Giang chỉ định rõ), 90vh.
 * Điều hướng nhiều cấp (Main -> System -> Theme/Gesture/Motion/Language, Main -> Playlist ->
 * Sắp xếp/Lọc...) KHÔNG dùng lại `core/settings-panel-stack-ui.js` (cơ chế push/pop CŨ, DOM đó giờ
 * thuộc về Photo, xem components/photo-panel.js) — mà dùng đúng "cơ chế swap nội dung của Generic
 * Drawer đã có" (Giang chỉ định): `updateGenericDrawer()` (đã dùng bởi eq-presets.js/custom-
 * effect.js) + 1 NGĂN XẾP JS thuần (`_screenStack`, mảng hàm render) để Back
 * biết quay lại ĐÚNG màn trước, KHÔNG phải DOM push/pop.
 *
 * TÁI DÙNG NGUYÊN VẸN mọi hàm render/hàm đồng bộ giá trị đã có (renderGestureSettingsPanelBody(),
 * workflowGestureSettings.openPanel(), TPL_SETTINGS_LANGUAGE, renderLanguageOptions(), renderDebugConsolePanelBody(),
 * workflowSettingsMisc.openDebugConsole(), TPL_SETTINGS_PLAYLIST_VIEW, workflowPlaylist.
 * workflowPlaylist.openSortPanel() (Filter giờ tự quản qua workflowPlaylistFilterPresets, KHÔNG
 * còn openFilterPanel()), 3 hàm askRestartApp/askRestoreDefaults/askClearCache) — các
 * hàm đó ĐÃ được sửa (đợt này) để đọc/ghi qua `genericDrawerBody` thay vì panel push động cũ
 * (`fooPanelEl = pushSettingsPanel(...)` -> `fooPanelEl = genericDrawerBody`) — bản thân NGHIỆP VỤ
 * (field nào ghi gì, gọi core nào) HOÀN TOÀN KHÔNG đổi, chỉ đổi "nội dung sống ở container nào".
 *
 * STYLING (SỬA 09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — TRƯỚC ĐÂY bodyHtml mọi màn bọc
 * trong `.app-settings-scope`, CSS đè màu sang light theme (assets/css/layout-nav.css), KHÔNG sửa
 * màu trực tiếp trong từng template cũ. Giờ mọi template con đã tự viết LẠI bằng đúng bảng màu
 * sáng (xem docstring từng file), override CSS đó ĐÃ XOÁ HẲN — wrapper chỉ còn `class="text-slate-
 * 900 p-4"` (màu chữ mặc định kế thừa xuống + padding, không còn ý nghĩa "scope đè màu" nào nữa).
 *
 * Visualizer Screen (Display/Auto-Switch/Visual Background, kể cả 2 sub-panel Gradient/Video Audio
 * + picker con video/ảnh/thư mục của Visual Background) ĐÃ migrate xong (đợt "làm nốt visualizer") —
 * cùng khuôn Gesture/Motion/Language/Troubleshooting. Motion (Cấu hình Transition/Ken Burns/React
 * Beat Audio, hệ preset độc lập) — Quản lý mở từ System; nơi tiêu thụ (Visual Background, Player)
 * mở THẲNG danh sách Motion ở chế độ CHỌN (`_renderMotionPicker()`, SỬA 24/09/2026 — thay cơ chế
 * đăng ký "Áp dụng cho" cũ, xem event/workflow/motion-presets.js::openPicker()).
 *
 * CÒN NỢ (đã biết, chưa sửa — dời lại theo yêu cầu Giang "logic bổ sung tính sau"): nút Cancel của
 * picker chọn THƯ MỤC video (1 trong 4 nguồn Visual Background) chưa tự quay lại Visual Background
 * — hạ tầng `workflowPlaylist._openFolderPickerDrawer()` dùng CHUNG với Playlist, chưa sửa vì rủi ro
 * ảnh hưởng nơi khác. 3 picker còn lại (ảnh đơn/video đơn/album) đã tự quay lại đúng (xem
 * `_closePickerDrawer()`/`openPickPhoto()`, event/workflow/visual-bg.js).
 *
 * SỬA (20/09/2026, Giang yêu cầu thiết kế lại Main Setting) — màn Main giờ là carousel ngang (xem
 * `_renderMain()`/`handleCarouselCardTap()`; UI ở components/settings/app-settings-main.js, wire ở
 * core/app-settings-ui.js::wireAppSettingsMainCarousel(), scale/loop ở core/settings-carousel-ui.js).
 *
 * NẠP SAU: core/generic-drawer.js, core/app-panel-nav.js, components/settings/app-settings-main.js,
 * core/settings-carousel-ui.js,
 * components/settings/playlist-view.js, components/settings/language.js, components/gesture-
 * settings-drawer.js, components/motion-settings-drawer.js, components/debug-console-drawer.js,
 * components/playlist-sort-drawer.js, components/playlist-filter-drawer.js, core/playlist/
 * filter-presets.js, event/workflow/playlist-filter-presets.js, components/settings/
 * visualizer-display-panel.js, components/settings/visualizer-auto-switch-drawer.js, components/
 * visual-bg-settings-drawer.js, components/visual-bg-gradient-drawer.js, components/visual-bg-
 * video-audio-drawer.js, event/workflow/generic-drawer-helpers.js, event/workflow/app-panel-nav.js,
 * event/workflow/gesture-settings.js, event/workflow/visual-bg-photo-motion.js, event/workflow/playlist.js,
 * event/workflow/settings-misc.js, event/workflow/visualizer-display.js, event/workflow/
 * visual-bg.js, lang/language-settings.js (renderLanguageOptions/updateLanguageDeleteButtonVisibility),
 * core/player-display-settings.js, components/settings/player-display-settings.js, event/workflow/
 * player-display-settings.js (MỚI — "Player", xem docstring nhóm hàm _renderPlayer() ngay dưới),
 * components/settings/pagination.js + event/workflow/pagination.js (MỚI 23/09/2026 — System > Pagination).
 * NẠP TRƯỚC: event/router/player-controls.js, event/router/app-settings.js,
 * event/router/app-panel-nav.js, event/router/visual-bg.js.
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

/** MỚI (21/09/2026) — tô sáng hàng Point Move đang là ĐÍCH THẢ lúc kéo-sắp-xếp (Motion drawer). Trước đây bật/tắt class cứng
 * `bg-sky-100` (pastel chói trên Dark/Morphin, lại còn đè lên nền card do theme áp) — giờ đổi bộ KEY của chính hàng đó rồi áp lại
 * theme cho riêng nó: đích thả = `rowActiveBg` (nền "đang chọn"), bình thường = `cardBg`; `cardBorder` giữ cả 2 trạng thái. */
function setMotionRowDropHighlight(rowEl, isHighlighted) {
    rowEl.dataset.uitk = isHighlighted ? 'rowActiveBg cardBorder' : 'cardBg cardBorder';
    if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(rowEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
}

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

    /** Dựng header (Back nếu không phải Main + Close X luôn có) + bodyHtml bọc `text-slate-900 p-4`
     * rồi mở/swap Generic Drawer + gọi `onMount(genericDrawerBody)` để màn tự đồng bộ giá trị/wire.
     * MỞ RỘNG (29/08/2026, hệ "Cấu hình Motion") — tham số thứ 4 `extraHeaderHtml` (tuỳ chọn,
     * KHÔNG đổi gì cho mọi màn cũ không truyền) — chèn THÊM 1 nút hành động vào header (vd "+" ở màn
     * danh sách preset, "Xoá"/"Reset" ở màn sửa 1 preset) — đặt TRƯỚC nút Close, căn phải cùng cụm.
     * @param {string} title @param {string} bodyHtml @param {(body: HTMLElement) => void} [onMount]
     * @param {string} [extraHeaderHtml] - HTML 1 (hoặc vài) nút, tự wire ở `onMount` (Rule 5a — nút
     *        RIÊNG của từng màn, không thuộc `wireAppSettingsHeader()` dùng chung).
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

    /** Danh sách preset Filter CỦA Nguồn đang chọn (`activeMediaSource`) — tap dòng = sửa, mỗi dòng
     * có thêm nút chọn áp dụng nhanh + xoá nhanh (CÙNG khuôn _renderMotionList() — KHÁC Motion 1
     * chỗ: Motion được CHỌN từ phía nơi tiêu thụ (màn Chọn `_renderMotionPicker()`), Playlist Filter
     * cần bấm "chọn áp dụng" được NGAY từ danh sách, phản hồi Giang). SỬA (09/09/2026, phản hồi Giang mục cuối — "mỗi source media 1
     * list filter khác nhau") — `playlistFilterPresets`/`playlistFilterActivePresetId` giờ keyed
     * theo Nguồn, danh sách này CHỈ đọc/hiện đúng phần của Nguồn đang chọn — đổi Nguồn ở Settings →
     * Playlist rồi mở lại "Lọc" sẽ thấy danh sách KHÁC hẳn (độc lập, không lẫn giữa Song/Video/
     * Photo). Tiêu đề có thêm tên Nguồn (mẫu "Filters for Song", SỬA 09/09/2026 phản hồi Giang —
     * TRƯỚC ĐÂY nối bằng dấu "—") cho rõ đang xem preset của Nguồn nào. */
    _renderPlaylistFilterList() {
        this._currentRenderFn = () => this._renderPlaylistFilterList();
        const source = appState.get('activeMediaSource');
        const presets = appState.get('playlistFilterPresets')[source];
        const activeId = appState.get('playlistFilterActivePresetId')[source];
        // MỚI 23/09/2026 — nơi 'filterPresets' của Settings > System > Pagination (tắt = vẽ hết như cũ). Mỗi Nguồn
        // 1 danh sách khác hẳn -> Nguồn đổi so với lần vẽ trước thì về trang 1.
        if (this._playlistFilterListSource !== source) { this._playlistFilterListSource = source; this._playlistFilterListPageIndex = 0; }
        const view = workflowPagination.computePlaceView('filterPresets', presets, this._playlistFilterListPageIndex); // event/workflow/pagination.js
        this._playlistFilterListPageIndex = view.pageIndex; // giá trị đã kẹp (vd vừa xoá preset cuối của trang cuối)
        this._render(
            tFormat('playlistFilterPresetsDrawer.list.titleForSource', { source: t('settingsPlaylistBg.mediaSource.' + source) }),
            renderPlaylistFilterListBody(view.pageItems, activeId, workflowPagination.buildControlsHtml(view)), // components/playlist-filter-drawer.js
            (body) => {
                wirePaginationControls(body.querySelector('#playlist-filter-list-pagination'), 'appSettings', 'appSettings.playlistFilterList.page.change'); // core/pagination-ui.js
                body.querySelectorAll('[data-playlist-filter-tile]').forEach((el) => {
                    el.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.tile.click', payload: { id: el.dataset.playlistFilterTile } }));
                });
                body.querySelectorAll('[data-playlist-filter-quickselect]').forEach((el) => {
                    el.addEventListener('click', (e) => { e.stopPropagation(); eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.quickSelect.click', payload: { id: el.dataset.playlistFilterQuickselect } }); });
                });
                body.querySelectorAll('[data-playlist-filter-quickdelete]').forEach((el) => {
                    el.addEventListener('click', (e) => { e.stopPropagation(); eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.quickDelete.click', payload: { id: el.dataset.playlistFilterQuickdelete } }); });
                });
                // MỚI (09/09/2026, phản hồi Giang — "với filter đang active, thay vì nút delete ->
                // unselect") — dòng active hiện nút bỏ chọn thay vì xoá nhanh, xem components/
                // playlist-filter-drawer.js::renderPlaylistFilterListBody().
                body.querySelectorAll('[data-playlist-filter-quickunselect]').forEach((el) => {
                    el.addEventListener('click', (e) => { e.stopPropagation(); eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.quickUnselect.click', payload: { source } }); });
                });
                const addBtn = body.querySelector('#btn-playlist-filter-list-add');
                if (addBtn) addBtn.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.add.click', payload: {} }));
            },
        );
    },

    /** Sửa 1 preset (`workflowPlaylistFilterPresets._editingId`, Nguồn `_editingSource` — CHỐT lúc
     * mở màn, KHÔNG đọc lại `activeMediaSource`, xem docstring đầu event/workflow/
     * playlist-filter-presets.js) — field rule theo ĐÚNG Nguồn đó (component render RỖNG,
     * `_syncEditUI()` tự bind giá trị NGAY sau khi mount) + 2 nút "Chọn áp dụng"/"Xoá" cuối — nút
     * đầu đổi chữ thành "Cập nhật" khi preset đang sửa CHÍNH LÀ preset đang active CHO ĐÚNG NGUỒN
     * ĐÓ (`isActive`, xem components/playlist-filter-drawer.js::renderPlaylistFilterEditBody()).
     * XOÁ (09/09/2026, phản hồi Giang mục 1 — "loại bỏ cơ chế này") — cơ chế `_leaveGuard`/
     * `autoUnapplyIfInvalid()` (tự gỡ filter khi thoát X/Back mà preset đang active hết field hợp
     * lệ) ĐÃ BỎ HẲN — sửa preset đang active xuống hết field hợp lệ rồi thoát KHÔNG còn tự gỡ gì cả,
     * ảnh chốt (`playlistFilterAppliedConfig`) giữ NGUYÊN cho tới khi bấm "Chọn áp dụng"/"Cập nhật"
     * LẦN NỮA — ĐÚNG 1 quy tắc DUY NHẤT xuyên suốt: sửa field KHÔNG BAO GIỜ tự đổi filter thật, chỉ
     * "Chọn áp dụng"/"Cập nhật" mới đổi (xoá preset đang active vẫn tự gỡ như cũ — KHÔNG liên quan
     * cơ chế đã xoá này, xem workflowPlaylistFilterPresets._deletePresetById()). */
    _renderPlaylistFilterEdit() {
        this._currentRenderFn = () => this._renderPlaylistFilterEdit();
        const source = workflowPlaylistFilterPresets._editingSource;
        const preset = findPlaylistFilterPresetById(appState.get('playlistFilterPresets')[source], workflowPlaylistFilterPresets._editingId); // core/playlist/filter-presets.js
        if (!preset) { this.back(); return; } // guard: preset vừa bị xoá ở nơi khác giữa lúc đang sửa — quay lại danh sách an toàn
        const isActive = preset.id === appState.get('playlistFilterActivePresetId')[source];
        this._render(
            tFormat('playlistFilterPresetsDrawer.edit.titleForSource', { source: t('settingsPlaylistBg.mediaSource.' + source) }),
            renderPlaylistFilterEditBody(preset, source, isActive), // components/playlist-filter-drawer.js
            (body) => {
                workflowPlaylistFilterPresets._syncEditUI(); // event/workflow/playlist-filter-presets.js — bind giá trị field NGAY sau mount
                const nameInput = body.querySelector('#playlist-filter-drawer-name');
                if (nameInput) nameInput.addEventListener('blur', (e) => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.name.change', payload: { value: e.target.value } }));
                // MỚI (09/09/2026, phản hồi Giang — checkbox "Có áp dụng cho thư mục hay không")
                const appliesToFolderCheckbox = body.querySelector('#playlist-filter-drawer-appliestofolder');
                if (appliesToFolderCheckbox) appliesToFolderCheckbox.addEventListener('change', (e) => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.appliesToFolder.change', payload: { value: e.target.checked } }));
                const selectBtn = body.querySelector('#btn-playlist-filter-select');
                if (selectBtn) selectBtn.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.select.click', payload: { id: preset.id, source } }));
                const deleteBtn = body.querySelector('#btn-playlist-filter-delete');
                if (deleteBtn) deleteBtn.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.delete.click', payload: { id: preset.id } }));
                // MỚI (09/09/2026) — preset đang active hiện nút "Bỏ chọn" thay vì "Xoá" (id khác,
                // xem renderPlaylistFilterEditBody()) — CHỈ 1 trong 2 nút tồn tại trong DOM mỗi lần.
                const unselectBtn = body.querySelector('#btn-playlist-filter-unselect');
                if (unselectBtn) unselectBtn.addEventListener('click', () => eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.unselect.click', payload: { source } }));
            },
        );
    },

    // ===================== System (Theme/Motion/Language/Pagination) =====================

    _renderSystem() {
        this._currentRenderFn = () => this._renderSystem();
        const rows = [
            { key: 'theme', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h9a2 2 0 012 2v12a4 4 0 01-4 4H7zm0 0h10a2 2 0 002-2v-9', labelKey: 'appSettings.system.theme.label', hintKey: 'appSettings.system.theme.hint' },
            { key: 'motion', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'appSettings.system.motion.label', hintKey: 'appSettings.system.motion.hint' },
            { key: 'language', icon: 'M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18M21 12a9 9 0 11-18 0 9 9 0 0118 0z', labelKey: 'appSettings.system.language.label', hintKey: 'appSettings.system.language.hint' },
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

    // ===================== Motion — hệ Cấu hình độc lập =====================
    // 2 lối vào: System > Motion -> danh sách preset (Quản lý — CRUD); nơi tiêu thụ (VBG Photo, Player)
    // -> CÙNG danh sách đó ở chế độ CHỌN (`_renderMotionPicker()`). SỬA (24/09/2026, Giang yêu cầu) —
    // cơ chế đăng ký nơi tiêu thụ ("Áp dụng cho" trong màn Edit) ĐÃ XOÁ — xem components/motion-
    // settings-drawer.js + event/workflow/motion-presets.js (workflowMotionPresets).

    /** Danh sách preset — tap = sửa, nút xoá nhanh mỗi dòng. */
    _renderMotionList() {
        this._currentRenderFn = () => this._renderMotionList();
        const presets = appState.get('motionPresets');
        // MỚI 23/09/2026 — nơi 'motionPresets' của Settings > System > Pagination (tắt = vẽ hết như cũ).
        const view = workflowPagination.computePlaceView('motionPresets', presets, this._motionListPageIndex); // event/workflow/pagination.js
        this._motionListPageIndex = view.pageIndex; // giá trị đã kẹp (vd vừa xoá hết preset trang cuối)
        this._render(
            t('motionPresetsDrawer.list.title'),
            renderMotionListBody(view.pageItems, workflowPagination.buildControlsHtml(view)), // components/motion-settings-drawer.js
            (body) => {
                wirePaginationControls(body.querySelector('#motion-list-pagination'), 'appSettings', 'appSettings.motionList.page.change'); // core/pagination-ui.js
                body.querySelectorAll('[data-motion-preset-tile]').forEach((el) => {
                    el.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.tile.click', payload: { id: el.dataset.motionPresetTile } }));
                });
                body.querySelectorAll('[data-motion-preset-quickdelete]').forEach((el) => {
                    el.addEventListener('click', (e) => { e.stopPropagation(); eventBus.send({ router: 'motionPresets', type: 'motionPresets.quickDelete.click', payload: { id: el.dataset.motionPresetQuickdelete } }); });
                });
                const addBtn = body.querySelector('#btn-motion-list-add');
                if (addBtn) addBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.add.click', payload: {} }));
            },
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

    /** MỚI (24/09/2026, Giang yêu cầu) — danh sách preset ở chế độ CHỌN, mở từ nơi tiêu thụ qua
     * `workflowMotionPresets.openPicker()` (event/workflow/motion-presets.js — giữ toàn bộ state phiên
     * Chọn: tiêu đề, nháp, trang, `onApply`). Tap dòng = chọn nháp (vẽ lại tại chỗ); nút "Apply" ở
     * header = xác nhận + tự back(). Pagination DÙNG CHUNG nơi 'motionPresets' với `_renderMotionList()`. */
    _renderMotionPicker() {
        this._currentRenderFn = () => this._renderMotionPicker();
        const data = workflowMotionPresets.getPickerRenderData(); // event/workflow/motion-presets.js
        if (!data) { this.back(); return; } // guard: không còn phiên Chọn nào (đã Apply) — quay lại an toàn
        this._render(
            data.title,
            renderMotionPickerBody(data.view.pageItems, data.draftId, workflowPagination.buildControlsHtml(data.view)), // components/motion-settings-drawer.js, event/workflow/pagination.js
            (body) => {
                const optionEls = body.querySelectorAll('[data-motion-picker-option]');
                const applyBtn = genericDrawerHeader.querySelector('#btn-motion-picker-apply'); // core/dom-refs.js — nút nằm ở HEADER (extraHeaderHtml), không phải body
                wirePaginationControls(body.querySelector('#motion-picker-pagination'), 'motionPresets', 'motionPresets.picker.page.change'); // core/pagination-ui.js
                optionEls.forEach((el) => {
                    el.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.picker.select.click', payload: { id: el.dataset.motionPickerOption } }));
                });
                if (applyBtn) applyBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.picker.apply.click', payload: {} }));
            },
            renderMotionPickerApplyButtonHtml(), // components/motion-settings-drawer.js
        );
    },

    /** Sửa 1 preset (`workflowMotionPresets._editingId`). */
    _renderMotionEdit() {
        this._currentRenderFn = () => this._renderMotionEdit();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        if (!preset) { this.back(); return; } // guard: preset vừa bị xoá ở nơi khác giữa lúc đang sửa — quay lại danh sách an toàn
        this._render(
            t('motionPresetsDrawer.edit.title'),
            renderMotionEditBody(preset), // components/motion-settings-drawer.js
            (body) => {
                const nameInput = body.querySelector('#setting-motion-name');
                if (nameInput) nameInput.addEventListener('blur', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.name.change', payload: { value: e.target.value } }));
                const transitionEnabled = body.querySelector('#setting-motion-transition-enabled');
                if (transitionEnabled) transitionEnabled.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionEnabled.change', payload: { checked: e.target.checked } }));
                const transitionType = body.querySelector('#setting-motion-transition');
                if (transitionType) transitionType.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionType.change', payload: { value: e.target.value } }));
                const transitionDirection = body.querySelector('#setting-motion-transition-direction');
                if (transitionDirection) transitionDirection.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionDirection.change', payload: { value: e.target.value } }));
                const transitionZoomDirection = body.querySelector('#setting-motion-transition-zoom-direction');
                if (transitionZoomDirection) transitionZoomDirection.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionZoomDirection.change', payload: { value: e.target.value } }));
                const transitionSpinDirection = body.querySelector('#setting-motion-transition-spin-direction');
                if (transitionSpinDirection) transitionSpinDirection.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionSpinDirection.change', payload: { value: e.target.value } }));
                const transitionWipeDirection = body.querySelector('#setting-motion-transition-wipe-direction');
                if (transitionWipeDirection) transitionWipeDirection.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionWipeDirection.change', payload: { value: e.target.value } }));
                const transitionCurtainDirection = body.querySelector('#setting-motion-transition-curtain-direction');
                if (transitionCurtainDirection) transitionCurtainDirection.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionCurtainDirection.change', payload: { value: e.target.value } }));
                const edgeFlipVariant = body.querySelector('#setting-motion-edge-flip-variant');
                if (edgeFlipVariant) edgeFlipVariant.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.edgeFlipVariant.change', payload: { value: e.target.value } }));
                const edgeFlipStaticOld = body.querySelector('#setting-motion-edge-flip-static-old');
                if (edgeFlipStaticOld) edgeFlipStaticOld.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.edgeFlipStaticOld.change', payload: { checked: e.target.checked } }));
                const transitionDurationBtn = body.querySelector('#setting-motion-transition-duration');
                if (transitionDurationBtn) transitionDurationBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.openTransitionDurationPicker.click', payload: {} }));
                const ratioSlider = body.querySelector('#setting-motion-transition-ratio');
                if (ratioSlider) {
                    ratioSlider.addEventListener('input', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionRatio.preview', payload: { value: Number(e.target.value) } }));
                    ratioSlider.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionRatio.change', payload: { value: Number(e.target.value) } }));
                }
                workflowMotionPresets._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio); // event/workflow/motion-presets.js
                const easingSelect = body.querySelector('#setting-motion-transition-easing');
                if (easingSelect) easingSelect.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.transitionEasing.change', payload: { value: e.target.value } }));

                // Point Move (thay Ken Burns) — nav "danh sách" + 2 select (chế độ chạy/thứ tự).
                // SỬA (phản hồi Giang — dời "Return baseline"/"Timing" sang subpanel Point moves) —
                // 2 wiring đó KHÔNG còn ở đây nữa, xem _renderPointMoveList() bên dưới.
                const pointMoveEnabled = body.querySelector('#setting-motion-pointmove-enabled');
                if (pointMoveEnabled) pointMoveEnabled.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.enabled.change', payload: { checked: e.target.checked } }));
                const pointMoveListBtn = body.querySelector('#btn-motion-pointmove-list');
                if (pointMoveListBtn) pointMoveListBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.openList.click', payload: {} }));
                const pointMoveRunMode = body.querySelector('#setting-motion-pointmove-runmode');
                if (pointMoveRunMode) pointMoveRunMode.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.runMode.change', payload: { value: e.target.value } }));
                const pointMoveOrder = body.querySelector('#setting-motion-pointmove-order');
                if (pointMoveOrder) pointMoveOrder.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.oneOrder.change', payload: { value: e.target.value } }));

                // "React Beat Audio" — mọi control (checkbox/slider/select) gửi CÙNG 1 msg.type, chỉ
                // khác payload {effectKey, fieldKey, value} — GENERIC, khớp đúng
                // `workflowMotionPresets.changeBeatReactField()` (1 hàm xử lý mọi field).
                const sendBeatReact = (effectKey, fieldKey, value) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.beatReact.field.change', payload: { effectKey, fieldKey, value } });
                const wireBeatReactCheckbox = (id, effectKey, fieldKey) => {
                    const el = body.querySelector(`#${id}`);
                    if (el) el.addEventListener('change', (e) => sendBeatReact(effectKey, fieldKey, e.target.checked));
                };
                const wireBeatReactSelect = (id, effectKey, fieldKey) => {
                    const el = body.querySelector(`#${id}`);
                    if (el) el.addEventListener('change', (e) => sendBeatReact(effectKey, fieldKey, e.target.value));
                };
                // MỚI (phản hồi Giang — ô nhập số type=number sync 2 chiều với slider) — slider kéo
                // (`input`) chỉ cập nhật LIVE ô input (chưa persist); thả tay (`change`) MỚI persist.
                // Gõ tay vào ô input, thoát focus/Enter (`change`) — tự kẹp [min,max] (validate JS,
                // không tin số ngoài biên dù `type=number` đã hạn chế phần lớn), đồng bộ NGƯỢC lại
                // slider, rồi persist CÙNG msg.type với slider (server không phân biệt nguồn).
                const wireBeatReactMax = (key, fieldKey) => {
                    const slider = body.querySelector(`#setting-motion-beatreact-${key}-max`);
                    const input = body.querySelector(`#motion-beatreact-${key}-max-input`);
                    if (slider && input) slider.addEventListener('input', (e) => { input.value = e.target.value; });
                    if (slider) slider.addEventListener('change', (e) => sendBeatReact(key, fieldKey, Number(e.target.value)));
                    if (input) input.addEventListener('change', (e) => {
                        const v = Math.max(Number(input.min), Math.min(Number(input.max), Number(e.target.value) || 0));
                        input.value = v;
                        if (slider) slider.value = v;
                        sendBeatReact(key, fieldKey, v);
                    });
                };
                wireBeatReactCheckbox('setting-motion-beatreact-enabled', null, 'enabled');
                ['zoom', 'panX', 'panY', 'rotate'].forEach((key) => {
                    wireBeatReactCheckbox(`setting-motion-beatreact-${key}-enabled`, key, 'enabled');
                    wireBeatReactMax(key, key === 'rotate' ? 'maxDeg' : 'maxPct');
                    wireBeatReactCheckbox(`setting-motion-beatreact-${key}-randommax`, key, 'randomMax'); // MỚI — Random Max, xem core/motion-presets.js
                });
                wireBeatReactSelect('setting-motion-beatreact-panX-direction', 'panX', 'direction');
                wireBeatReactSelect('setting-motion-beatreact-panY-direction', 'panY', 'direction');
                wireBeatReactSelect('setting-motion-beatreact-rotate-direction', 'rotate', 'direction');
                wireBeatReactCheckbox('setting-motion-beatreact-panX-reverse', 'panX', 'reverse');
                wireBeatReactCheckbox('setting-motion-beatreact-panY-reverse', 'panY', 'reverse');
                wireBeatReactCheckbox('setting-motion-beatreact-rotate-reverse', 'rotate', 'reverse');

                const resetBtn = body.querySelector('#btn-motion-edit-reset');
                if (resetBtn) resetBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.reset.click', payload: {} }));
                const deleteBtn = body.querySelector('#btn-motion-edit-delete');
                if (deleteBtn) deleteBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.delete.click', payload: {} }));
                // XOÁ (24/09/2026) — wiring nhóm "Áp dụng cho" (select nơi tiêu thụ + nút Đăng ký/Huỷ) — cơ chế đã bỏ.
            },
        );
    },

    /** Danh sách point move của preset đang sửa — [kéo] | checkbox | tên | nhân bản | xoá | sửa.
     * Kéo trên tay cầm (⠿) HOÁN ĐỔI TOÀN BỘ 2 point move (order N + mọi field, bao gồm timingX —
     * CÙNG LÚC, phản hồi Giang) — hàng đang kéo NỔI LÊN bám con trỏ (translateY/z-index/shadow),
     * pointer-events THUẦN (touch-compatible, không dùng HTML5 Drag-and-Drop API vì hỗ trợ cảm ứng/
     * mobile kém). */
    _renderPointMoveList() {
        this._currentRenderFn = () => this._renderPointMoveList();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        if (!preset) { this.back(); return; }
        this._render(
            t('motionSettingsDrawer.pointMove.list.label'),
            renderPointMoveListBody(preset), // components/motion-settings-drawer.js — SỬA (phản hồi Giang) — nhận CẢ preset (cần pointMoveEndForceBaseline/pointMoveRunMode cho card "Return baseline"/"Timing" MỚI dời vào đây)
            (body) => {
                body.querySelectorAll('[data-ptmove-checkbox]').forEach((el) => {
                    el.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.toggleChecked.change', payload: { id: el.dataset.ptmoveCheckbox, checked: e.target.checked } }));
                });
                body.querySelectorAll('[data-ptmove-duplicate]').forEach((el) => {
                    el.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.duplicate.click', payload: { id: el.dataset.ptmoveDuplicate } }));
                });
                body.querySelectorAll('[data-ptmove-delete]').forEach((el) => {
                    el.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.delete.click', payload: { id: el.dataset.ptmoveDelete } }));
                });
                body.querySelectorAll('[data-ptmove-edit]').forEach((el) => {
                    el.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.openEdit.click', payload: { id: el.dataset.ptmoveEdit } }));
                });
                const addBtn = body.querySelector('#btn-ptmove-add');
                if (addBtn) addBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.add.click', payload: {} }));

                // MỚI (phản hồi Giang — dời từ màn Edit chính vào đây) — "Return baseline" (đổi tên
                // từ "Endpoint: force baseline") + "Timing", CHỈ hiện khi pointMoveRunMode==='all'
                // (renderPointMoveListBody() đã tự ẩn cả card khi khác 'all', ở đây querySelector chỉ
                // trả null vô hại nếu card không tồn tại).
                const endForce = body.querySelector('#setting-motion-pointmove-end-force-baseline');
                if (endForce) endForce.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.endForceBaseline.change', payload: { checked: e.target.checked } }));
                const timingBtn = body.querySelector('#btn-motion-pointmove-timing');
                if (timingBtn) timingBtn.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.openTiming.click', payload: {} }));

                // Kéo-thả sắp xếp lại — pointer-events thuần (touch OK), gom addEventListener tại đây
                // (Workflow, không bị Rule 5a giới hạn). Node ĐANG kéo NỔI LÊN + BÁM THEO con trỏ
                // (translateY, z-index, shadow) — phản hồi Giang: "phải nổi lên và kéo được, không
                // phải thêm border rồi coi như đã kéo" — + `user-select:none` lúc đang kéo (phản hồi
                // Giang) tránh bôi đen chữ ngoài ý muốn. Thả xong gửi ĐÚNG 1 thao tác hoán đổi TOÀN
                // BỘ (order N + mọi field, bao gồm timingX — CÙNG LÚC, xem
                // event/workflow/motion-presets.js::swapPointMoveOrder()). SỬA (phản hồi Giang —
                // "Point 0 = start point") — hàng ĐẦU (index 0, `pointMoves[0].id`) KHÔNG còn tay cầm
                // kéo trong template (renderPointMoveListBody()) nên KHÔNG BAO GIỜ là `draggingId`;
                // ở đây CHẶN THÊM nó khỏi làm ĐÍCH thả (hoverRowEl) — kéo hàng khác THẢ ĐÈ lên hàng 0
                // vẫn phải vô hiệu, không chỉ chặn chiều kéo-ra.
                const rows = Array.from(body.querySelectorAll('[data-ptmove-row]'));
                const point0Id = preset.pointMoves[0] ? preset.pointMoves[0].id : null;
                let draggingId = null;
                let draggingRowEl = null;
                let dragStartClientY = 0;
                let hoverRowEl = null;
                body.querySelectorAll('[data-ptmove-drag-handle]').forEach((handle) => {
                    handle.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        draggingId = handle.dataset.ptmoveDragHandle;
                        draggingRowEl = rows.find((row) => row.dataset.ptmoveRow === draggingId) || null;
                        dragStartClientY = e.clientY;
                        if (draggingRowEl) {
                            draggingRowEl.style.position = 'relative';
                            draggingRowEl.style.zIndex = '30';
                            draggingRowEl.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)';
                            draggingRowEl.style.userSelect = 'none';
                        }
                        document.body.style.userSelect = 'none';
                    });
                });
                document.addEventListener('pointermove', (e) => {
                    if (!draggingId || !draggingRowEl) return;
                    draggingRowEl.style.transform = `translateY(${e.clientY - dragStartClientY}px) scale(1.02)`;
                    if (hoverRowEl) setMotionRowDropHighlight(hoverRowEl, false);
                    hoverRowEl = rows.find((row) => {
                        if (row === draggingRowEl || row.dataset.ptmoveRow === point0Id) return false; // Point 0 KHÔNG nhận thả (start point cố định)
                        const rect = row.getBoundingClientRect();
                        return e.clientY >= rect.top && e.clientY <= rect.bottom;
                    }) || null;
                    if (hoverRowEl) setMotionRowDropHighlight(hoverRowEl, true);
                });
                document.addEventListener('pointerup', () => {
                    if (!draggingId) return;
                    if (draggingRowEl) {
                        draggingRowEl.style.position = '';
                        draggingRowEl.style.zIndex = '';
                        draggingRowEl.style.boxShadow = '';
                        draggingRowEl.style.transform = '';
                        draggingRowEl.style.userSelect = '';
                    }
                    document.body.style.userSelect = '';
                    if (hoverRowEl) setMotionRowDropHighlight(hoverRowEl, false);
                    const targetId = hoverRowEl ? hoverRowEl.dataset.ptmoveRow : null;
                    if (targetId && targetId !== draggingId) {
                        eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.swapOrder.change', payload: { idA: draggingId, idB: targetId } });
                    }
                    draggingId = null;
                    draggingRowEl = null;
                    hoverRowEl = null;
                });
            },
        );
    },

    /** Sửa 1 point move (`workflowMotionPresets._editingPointMoveId`) — 6 nhóm thông số, mỗi nhóm
     * DÙNG CHUNG 1 bộ wiring (`wirePointMoveField()`) vì hình dạng UI giống hệt nhau. */
    _renderPointMoveEdit() {
        this._currentRenderFn = () => this._renderPointMoveEdit();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, workflowMotionPresets._editingPointMoveId) : null; // core/motion-presets.js
        if (!pointMove) { this.back(); return; }
        this._render(
            t('motionSettingsDrawer.pointMove.edit.title'),
            renderPointMoveEditBody(pointMove), // components/motion-settings-drawer.js
            (body) => {
                const wirePointMoveField = (fieldKey, hasUnit) => {
                    if (hasUnit) {
                        body.querySelectorAll(`[data-ptmove-unit="${fieldKey}"]`).forEach((el) => {
                            el.addEventListener('click', () => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.unit.change', payload: { fieldKey, unit: el.dataset.value } }));
                        });
                    }
                    const modeSelect = body.querySelector(`[data-ptmove-mode="${fieldKey}"]`);
                    if (modeSelect) modeSelect.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldMode.change', payload: { fieldKey, mode: e.target.value } }));

                    // MỚI (phản hồi Giang — ô nhập số type=number sync 2 chiều với slider "single").
                    const singleInput = body.querySelector(`#setting-ptmove-${fieldKey}-single`);
                    const singleInputNum = body.querySelector(`#ptmove-${fieldKey}-single-input`);
                    if (singleInput) {
                        singleInput.addEventListener('input', (e) => {
                            if (singleInputNum) singleInputNum.value = e.target.value; // slider kéo -> cập nhật LIVE ô input, chưa persist
                            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldSingle.preview', payload: { fieldKey, value: Number(e.target.value) } });
                        });
                        singleInput.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldSingle.change', payload: { fieldKey, value: Number(e.target.value) } }));
                    }
                    if (singleInputNum) {
                        singleInputNum.addEventListener('change', (e) => { // gõ tay xong (blur/Enter) -> tự kẹp biên, đồng bộ NGƯỢC slider, persist
                            const v = Math.max(Number(singleInputNum.min), Math.min(Number(singleInputNum.max), Number(e.target.value) || 0));
                            singleInputNum.value = v;
                            if (singleInput) singleInput.value = v;
                            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldSingle.change', payload: { fieldKey, value: v } });
                        });
                    }

                    const rangeMinInput = body.querySelector(`#setting-ptmove-${fieldKey}-rangemin`);
                    const rangeMaxInput = body.querySelector(`#setting-ptmove-${fieldKey}-rangemax`);
                    const rangeMinInputNum = body.querySelector(`#ptmove-${fieldKey}-rangemin-input`);
                    const rangeMaxInputNum = body.querySelector(`#ptmove-${fieldKey}-rangemax-input`);
                    const fillEl = body.querySelector(`#ptmove-${fieldKey}-range-fill`);
                    const previewRangeFill = () => { // cập nhật dải tô màu + 2 ô input số NGAY lúc kéo — thuần DOM cục bộ, KHÔNG qua eventBus (không phải state, không cần persist)
                        if (!rangeMinInput || !rangeMaxInput) return;
                        if (fillEl) {
                            const lo = Number(rangeMinInput.min), hi = Number(rangeMinInput.max);
                            const leftPct = ((Number(rangeMinInput.value) - lo) / (hi - lo)) * 100;
                            const rightPct = ((Number(rangeMaxInput.value) - lo) / (hi - lo)) * 100;
                            fillEl.style.left = `${leftPct}%`;
                            fillEl.style.width = `${Math.max(0, rightPct - leftPct)}%`;
                        }
                        if (rangeMinInputNum) rangeMinInputNum.value = rangeMinInput.value;
                        if (rangeMaxInputNum) rangeMaxInputNum.value = rangeMaxInput.value;
                    };
                    if (rangeMinInput) {
                        rangeMinInput.addEventListener('input', previewRangeFill);
                        rangeMinInput.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldRange.change', payload: { fieldKey, which: 'min', value: Number(e.target.value) } }));
                    }
                    if (rangeMaxInput) {
                        rangeMaxInput.addEventListener('input', previewRangeFill);
                        rangeMaxInput.addEventListener('change', (e) => eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldRange.change', payload: { fieldKey, which: 'max', value: Number(e.target.value) } }));
                    }
                    // MỚI (phản hồi Giang) — 2 ô nhập số min/max sync 2 chiều với 2 tay kéo dual-range.
                    if (rangeMinInputNum) {
                        rangeMinInputNum.addEventListener('change', (e) => {
                            const v = Math.max(Number(rangeMinInputNum.min), Math.min(Number(rangeMinInputNum.max), Number(e.target.value) || 0));
                            rangeMinInputNum.value = v;
                            if (rangeMinInput) rangeMinInput.value = v;
                            previewRangeFill();
                            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldRange.change', payload: { fieldKey, which: 'min', value: v } });
                        });
                    }
                    if (rangeMaxInputNum) {
                        rangeMaxInputNum.addEventListener('change', (e) => {
                            const v = Math.max(Number(rangeMaxInputNum.min), Math.min(Number(rangeMaxInputNum.max), Number(e.target.value) || 0));
                            rangeMaxInputNum.value = v;
                            if (rangeMaxInput) rangeMaxInput.value = v;
                            previewRangeFill();
                            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMove.fieldRange.change', payload: { fieldKey, which: 'max', value: v } });
                        });
                    }
                    workflowMotionPresets._updatePointMoveFieldLabel(fieldKey); // event/workflow/motion-presets.js — set dải tô màu + ô input dual-range lúc mở màn
                };
                wirePointMoveField('linearX', true);
                wirePointMoveField('linearY', true);
                wirePointMoveField('rotate', false);
                wirePointMoveField('zoom', false);
                wirePointMoveField('flipX', false);
                wirePointMoveField('flipY', false);

                // MỚI (phản hồi Giang — nút "±" đảo dấu, bù bàn phím `inputmode="decimal"` của iOS
                // KHÔNG có phím trừ) — GENERIC 1 wiring DUY NHẤT cho MỌI nút (data-ptmove-sign-toggle
                // = id của ô input nó đảo dấu, xem components/motion-settings-drawer.js). Bấm -> đảo
                // dấu giá trị `.value` hiện có, kẹp lại [min,max], rồi TÁI DÙNG đúng luồng 'change' đã
                // wire sẵn cho ô input đó ở trên (clamp/đồng bộ slider/persist) — KHÔNG lặp code.
                body.querySelectorAll('[data-ptmove-sign-toggle]').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const inputEl = body.querySelector(`#${btn.dataset.ptmoveSignToggle}`);
                        if (!inputEl) return;
                        const negated = -(Number(inputEl.value) || 0);
                        inputEl.value = Math.max(Number(inputEl.min), Math.min(Number(inputEl.max), negated));
                        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                });
            },
        );
    },

    /** Đường cong Timing (chỉ dùng khi `pointMoveRunMode==='all'`) — SVG THẬT dựng bởi
     * `workflowMotionPresets._renderTimingCurve()` (gọi core-ui, xem core/point-move-timing-ui.js).
     * Zoom (+/-) thuần view, KHÔNG persist — chỉ đổi CSS `transform:scaleX()` cục bộ NGAY TẠI ĐÂY
     * (SỬA, phản hồi Giang — mục đích zoom là GIÃN KHOẢNG CÁCH GIỮA CÁC NODE theo trục thời gian để
     * đỡ bấm/kéo nhầm, KHÔNG phải phóng to toàn bộ hình — chỉ scaleX, giữ NGUYÊN chiều cao/cỡ node/
     * chữ; thang hiển thị 0%-100% ĐÚNG NGHĨA "mức giãn thêm", KHÔNG phải % kích thước kết quả kiểu
     * 100%-300% như bản trước), không qua eventBus/workflow (không có state nào cần ghi nhớ). */
    _renderPointMoveTiming() {
        this._currentRenderFn = () => this._renderPointMoveTiming();
        const preset = findMotionPresetById(appState.get('motionPresets'), workflowMotionPresets._editingId); // core/motion-presets.js
        if (!preset) { this.back(); return; }
        this._render(
            t('motionSettingsDrawer.pointMove.timing.label'),
            renderPointMoveTimingBody(preset.pointMoves), // components/motion-settings-drawer.js
            (body) => {
                workflowMotionPresets._renderTimingCurve(body.querySelector('#ptmove-timing-container')); // event/workflow/motion-presets.js

                const ZOOM_STEPS_PCT = [0, 25, 50, 75, 100]; // "mức giãn thêm" (0 = không giãn) — KHÔNG phải % kích thước kết quả
                const ZOOM_MAX_EXTRA_SCALE_X = 1; // 100% giãn thêm -> scaleX tối đa = 1 + 1 = 2 (gấp đôi khoảng cách ngang, giữ nguyên chiều cao)
                let zoomIdx = 0;
                const zoomableEl = body.querySelector('#ptmove-timing-container');
                const zoomLabelEl = body.querySelector('#ptmove-timing-zoom-label');
                const applyZoom = () => {
                    const extraPct = ZOOM_STEPS_PCT[zoomIdx];
                    if (zoomableEl) zoomableEl.style.transform = `scaleX(${1 + (extraPct / 100) * ZOOM_MAX_EXTRA_SCALE_X})`;
                    if (zoomLabelEl) zoomLabelEl.textContent = `${extraPct}%`;
                };
                const zoomInBtn = body.querySelector('#btn-ptmove-timing-zoom-in');
                if (zoomInBtn) zoomInBtn.addEventListener('click', () => { zoomIdx = Math.min(ZOOM_STEPS_PCT.length - 1, zoomIdx + 1); applyZoom(); });
                const zoomOutBtn = body.querySelector('#btn-ptmove-timing-zoom-out');
                if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { zoomIdx = Math.max(0, zoomIdx - 1); applyZoom(); });
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
            { key: 'visualBg', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'settingsVisualizer.visualBg.label', hintKey: 'settingsVisualizer.visualBg.hint' },
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

    _renderAutoSwitch() {
        this._currentRenderFn = () => this._renderAutoSwitch();
        this._render(t('visualizerAutoSwitchDrawer.title'), renderVisualizerAutoSwitchPanelBody(), () => {
            workflowVisualizerDisplay.openAutoSwitchPanel(); // event/workflow/visualizer-display.js
        });
    },

    /** Visual Background — Main. Tự mở thêm 2 sub-panel (Gradient/Video Audio, xem
     * _renderVisualBgGradient()/_renderVisualBgVideoAudio() ngay dưới) + picker Generic Drawer con
     * (video/ảnh/album/folder — event/workflow/visual-bg.js tự gọi thẳng `navigateTo()`/
     * `_renderVisualBg()` để quay lại đúng chỗ, xem docstring tại đó). */
    _renderVisualBg() {
        this._currentRenderFn = () => this._renderVisualBg();
        this._render(t('visualBgSettingsDrawer.title'), renderVisualBgPanelBody(), () => {
            workflowVisualBg.openPanel(); // event/workflow/visual-bg.js
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

    /** Danh sách con — 2 row Video/Photo, CÙNG khuôn renderAppSettingsRowList() (data-app-settings-nav). */
    _renderPlayer() {
        this._currentRenderFn = () => this._renderPlayer();
        const rows = [
            { key: 'playerVideo', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', labelKey: 'appSettings.player.video.label', hintKey: 'appSettings.player.video.hint' },
            { key: 'playerPhoto', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'appSettings.player.photo.label', hintKey: 'appSettings.player.photo.hint' },
        ];
        this._render(t('appSettings.player.label'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js — TÁI DÙNG cơ chế chung data-app-settings-nav
    },

    _renderPlayerVideo() {
        this._currentRenderFn = () => this._renderPlayerVideo();
        this._renderPlayerDetail('video');
    },

    _renderPlayerPhoto() {
        this._currentRenderFn = () => this._renderPlayerPhoto();
        this._renderPlayerDetail('photo');
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

    // ===================== Troubleshooting (SỬA 20/09/2026, Giang yêu cầu gộp vào 1 nhóm) — màn danh sách
    // PHẲNG 4 hàng ngang hàng: [Debug console >] · [Restore default settings] · [Clear app cache] (2 hàng
    // riêng, thay modalChoice 3 nút "Reset app" cũ) · [Scan & fix video thumbnails >].
    // "Restart app" KHÔNG còn ở Settings — chuyển lên icon header Playlist (components/playlist-view.js,
    // id `setting-restart-app`, đã có sẵn listener ở event/listener/settings-misc.js). =====================

    _renderTroubleshooting() {
        this._currentRenderFn = () => this._renderTroubleshooting();
        this._render(t('appSettings.row.troubleshooting'), renderTroubleshootingBody(), wireAppSettingsTroubleshooting); // components/settings/troubleshooting.js, core/app-settings-ui.js
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
