/**
 * event/workflow/theme.js — router "theme": chốt NỀN của app (Light · Dark · Morphin: None / Gradient / Background media).
 *
 *   - Background media THAM CHIẾU item thư viện (`bgMediaKind` + `bgMediaKey`), không copy blob; item bị xoá/mất -> boot về
 *     `bgFallbackMode` (`workflowConfig.loadOnBoot()`, event/workflow/config.js).
 *   - Mọi lần chốt mode đi qua `commitThemeMode()`; field config ghi vào do core thuần `computeThemeModeCommit()` tính.
 *   - Giá trị hiển thị (lớp nền App + 3 card ở Settings > Theme) tính 1 lần bằng `computeThemeBackgroundView()`
 *     (core/theme-background.js); ghi DOM: `updatePlaylistBg()` (core/color-utils.js), `patchThemeBackgroundCards()`.
 *   - Video nền chỉ phát ở màn App Panel khi tab đang hiện (`syncBackgroundVideoPlayback()`).
 *   - Picker media: `workflowGenericDrawerHelpers.mountMediaPicker()` (updateInPlace, đang đứng trong Settings); chọn
 *     xong/đóng thì dựng lại màn Theme.
 *   - Player control: kiểu nền, độ đục, bìa nút Play, chỗ neo phụ đề của Bottom Player (`syncPlayerControlStyle()`,
 *     core/player-control-style.js).
 *
 * NẠP SAU: core/config.js, core/color-utils.js, core/theme-background.js, core/theme-background-ui.js,
 * core/player-control-style.js, core/player-control-settings-ui.js, core/custom-effect.js,
 * core/visualizer/visualizer-display.js, core/loading-shield-util.js, components/media-gallery.js, core/dom-refs.js.
 * Lúc chạy: event/workflow/{generic-drawer-helpers,playlist-scope,file-manager-photo,photo-gallery-window,
 * video-gallery-window,app-settings,ui-theme}.js.
 */
const THEME_MEDIA_PICKER_SCROLL_ID = 'theme-bg-picker-scroll';
const THEME_MEDIA_PICKER_EMPTY_ID = 'theme-bg-picker-empty';
// Picker thư viện theo loại media nền: chữ, cách nhận tile, dựng/gỡ lưới.
const THEME_MEDIA_PICKER_BY_KIND = {
    photo: {
        titleKey: 'playlistView.songEdit.coverPickLibrary', emptyKey: 'fileManager.photo.image.empty',
        tileSelector: '[data-image-key]', tileDataKey: 'imageKey',
        mount: (scrollEl, items) => workflowFileManagerPhoto.setupPhotoGridWindow(scrollEl, items), // event/workflow/file-manager-photo.js
        unmount: () => workflowPhotoGalleryWindow.unmount('genericDrawer'), // event/workflow/photo-gallery-window.js
    },
    video: {
        titleKey: 'fileManager.video.pickerTitle', emptyKey: 'fileManager.video.empty',
        tileSelector: '.video-tile', tileDataKey: 'videoKey',
        mount: (scrollEl, items) => workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos: items, badgeMode: null }), // event/workflow/video-gallery-window.js
        unmount: () => workflowVideoGalleryWindow.unmount('genericDrawer'),
    },
};

// Chỗ neo #subtitle-display theo `subtitleDock` (computePlayerControlView()) — phần tử ở core/dom-refs.js.
const PLAYER_CONTROL_SUBTITLE_HOST_BY_DOCK = {
    outside: () => playerContainer,
    overlay: () => subtitleOverlayDock,
};

const workflowTheme = {
    _mediaPickerKind: null, // 'photo' | 'video' | null — đang có picker media nền mở hay không
    _mediaPickerOpen: false, // guard: picker bị đóng trong lúc đang đọc DB

    /**
     * Chốt 1 mode nền — 'theme.selectMode.click' với card khác media, 'light'/'dark' khi đổi Color, và mọi đường chốt khác
     * (dùng lại media, chọn item mới, sửa màu Gradient). Ghi config + lưu, vẽ lại nền + ép kính vẽ lại, đồng bộ status bar /
     * preloader, video nền, vá 3 card. Runtime URL media GIỮ nguyên khi rời 'background' (card media còn preview, bấm lại là dùng).
     * @param {'light'|'dark'|'none'|'gradient'|'background'} mode
     */
    commitThemeMode(mode) {
        const patch = computeThemeModeCommit(appConfigViz.getAll(), mode); // core/theme-background.js
        appConfigViz.mutateAll((cfg) => { Object.assign(cfg, patch); });
        workflowConfig.save(); // core/config.js
        const view = computeThemeBackgroundView(appConfigViz.getAll()); // core/theme-background.js
        updatePlaylistBg(view.playlistBg); // core/color-utils.js
        this._forceGlassRepaint();
        workflowUiTheme.syncStatusBarColor(); // event/workflow/ui-theme.js — status bar iOS + mirror preloader
        this.syncBackgroundVideoPlayback();
        this._patchCards(view.cards);
    },

    /** Ứng với 'theme.selectMode.click' khi mode = 'background' — đã có item (URL runtime còn) -> dùng lại ngay; chưa có -> không
     * làm gì (card hiện khung "chưa có", người dùng chọn qua nút Photo/Video bên dưới). */
    reuseExistingBackgroundMedia() {
        const cfg = appConfigViz.getAll();
        if (!cfg.bgImage && !cfg.bgVideo) return;
        this.commitThemeMode('background');
    },

    /**
     * Ứng với 'theme.pickBackgroundMedia.click' — mở picker thư viện (single-select: bấm item là chọn ngay). Không blocking:
     * `await` chỉ đợi lưới dựng xong, việc chốt nền ở `handleMediaPickerTileClick()`.
     * @param {'photo'|'video'} kind
     */
    async pickBackgroundMedia(kind) {
        const picker = THEME_MEDIA_PICKER_BY_KIND[kind];
        if (!picker) return;
        this._mediaPickerKind = kind;
        workflowGenericDrawerHelpers.mountMediaPicker({ // event/workflow/generic-drawer-helpers.js
            routerName: 'theme', msgPrefix: 'theme.mediaPicker', title: t(picker.titleKey),
            bodyHtml: renderMediaPickerBodyHtml(THEME_MEDIA_PICKER_SCROLL_ID, THEME_MEDIA_PICKER_EMPTY_ID, t(picker.emptyKey), 'textSecondary'), // components/media-gallery.js
            tileSelector: picker.tileSelector, tileDataKey: picker.tileDataKey, showConfirmButton: false, updateInPlace: true,
        });
        this._mediaPickerOpen = true;
        const items = await workflowPlaylistScope.listPickableMedia(kind); // event/workflow/playlist-scope.js — bỏ item thuộc folder Hidden
        if (!this._mediaPickerOpen) return; // guard — picker bị đóng trong lúc đang đọc DB
        const scrollEl = genericDrawerBody.querySelector('#' + THEME_MEDIA_PICKER_SCROLL_ID);
        setMediaPickerEmptyUi(genericDrawerBody.querySelector('#' + THEME_MEDIA_PICKER_EMPTY_ID), items.length === 0); // core/file-manager/gallery-window-ui.js
        picker.mount(scrollEl, items);
    },

    /** Gỡ lưới picker — KHÔNG đóng drawer/dựng lại màn (nơi gọi quyết định). */
    _teardownMediaPicker() {
        const picker = THEME_MEDIA_PICKER_BY_KIND[this._mediaPickerKind];
        if (picker) picker.unmount();
        this._mediaPickerOpen = false;
        this._mediaPickerKind = null;
    },

    /** Ứng với 'theme.mediaPicker.tile.click' — chốt item làm nền media rồi dựng lại màn Theme. @param {{imageKey?:string, videoKey?:string}} payload */
    async handleMediaPickerTileClick(payload) {
        const kind = this._mediaPickerKind;
        const picker = THEME_MEDIA_PICKER_BY_KIND[kind];
        if (!picker) return; // picker đã đóng (race hiếm)
        const key = payload[picker.tileDataKey];
        this._teardownMediaPicker();
        await withLoadingShield(t('common.loading.savingImageBg'), async () => { // core/loading-shield-util.js
            await this._applyPickedMedia(kind, key);
        });
        workflowAppSettings._renderTheme(); // event/workflow/app-settings.js
    },

    /** Ứng với 'theme.mediaPicker.close.click' — huỷ picker: giữ nguyên nền, quay về màn Theme. */
    handleMediaPickerCloseClick() {
        if (!this._mediaPickerKind) return;
        this._teardownMediaPicker();
        workflowAppSettings._renderTheme();
    },

    /** Item thư viện -> URL runtime -> ghi tham chiếu + chốt 'background'. Item vừa bị xoá ở nơi khác (null) -> bỏ qua. */
    async _applyPickedMedia(kind, key) {
        const media = await workflowConfig.resolveAppBgMedia(kind, key); // event/workflow/config.js
        if (!media) return;
        const cfg = appConfigViz.getAll();
        [cfg.bgImage, cfg.bgVideo, cfg.bgMediaThumb].forEach(revokeBlobUrl); // service/blob-url.js — 3 URL runtime của nền media cũ
        appConfigViz.mutateAll((c) => {
            c.bgMediaKind = kind; c.bgMediaKey = key;
            c.bgImage = media.imageUrl; c.bgVideo = media.videoUrl; c.bgMediaThumb = media.thumbUrl;
        });
        this.commitThemeMode('background');
    },

    /** Ứng với 'theme.glassBlur.input' — độ nhoè kính Playlist chính. Gọi liên tục lúc kéo, không đổi mode. @param {string} value */
    setAppGlassBlur(value) {
        setAppGlassBlur(value); // core/visualizer/visualizer-display.js
        workflowConfig.save();
        const view = computeThemeBackgroundView(appConfigViz.getAll());
        updatePlaylistBg(view.playlistBg);
        this._forceGlassRepaint();
        this._patchCards(view.cards);
    },

    /** Ứng với 'theme.glassTint.input' — độ đục nền trắng của kính Playlist chính. @param {string} value */
    setAppGlassTint(value) {
        setAppGlassTint(value); // core/visualizer/visualizer-display.js
        workflowConfig.save();
        const view = computeThemeBackgroundView(appConfigViz.getAll());
        updatePlaylistBg(view.playlistBg);
        this._patchCards(view.cards);
    },

    /** Ứng với 'theme.gradientFrom.input' — chạm ô màu Gradient = chọn Gradient luôn. @param {string} value */
    setGradientFrom(value) {
        setThemeGradientFrom(value); // core/visualizer/visualizer-display.js
        this.commitThemeMode('gradient');
    },

    /** Ứng với 'theme.gradientTo.input'. @param {string} value */
    setGradientTo(value) {
        setThemeGradientTo(value); // core/visualizer/visualizer-display.js
        this.commitThemeMode('gradient');
    },

    /** Ứng với 'theme.appStackScreen.change' — đổi màn App Panel <-> Visualizer: status bar theo theme chỉ áp ở App Panel,
     * video nền chỉ phát ở App Panel. */
    onAppStackScreenChange() {
        workflowUiTheme.applyStatusBarForCurrentScreen(); // event/workflow/ui-theme.js
        this.syncBackgroundVideoPlayback();
    },

    /** Ứng với 'theme.documentVisibility.change' — ẩn/hiện app: dừng/tiếp tục video nền. */
    onDocumentVisibilityChange() {
        this.syncBackgroundVideoPlayback();
    },

    /** Video nền PHÁT hay DỪNG — gọi ở mọi nơi 1 trong các điều kiện của `shouldPlayAppBgVideo()` có thể đổi (chốt mode, đổi
     * màn, ẩn/hiện app, boot — `workflowUiTheme.loadPersistedUiThemeOnBoot()`). */
    syncBackgroundVideoPlayback() {
        const visualizerScreenActive = appStack.classList.contains('playlist-hidden'); // core/dom-refs.js
        setAppBgVideoPlayback(shouldPlayAppBgVideo(appConfigViz.getAll(), visualizerScreenActive, document.visibilityState)); // core/color-utils.js + core/theme-background.js
    },

    /** Vẽ nền App Panel theo config hiện tại — lúc boot (event/workflow/app-boot.js, ngay sau workflowConfig.loadOnBoot()). */
    repaintAppBackground() {
        updatePlaylistBg(computeThemeBackgroundView(appConfigViz.getAll()).playlistBg); // core/color-utils.js + core/theme-background.js
    },

    /** Ép lớp kính vẽ lại ngay sau khi nền đổi (WebKit giữ ảnh chụp nền cũ sau kính): tắt tạm backdrop, khung hình kế trả lại.
     * Mỗi lần gọi tự trả đúng danh sách của nó (tên task tự sinh — gọi dồn lúc kéo slider không bỏ sót phần tử nào). */
    _forceGlassRepaint() {
        const glassEls = suspendGlassBackdrop(); // core/color-utils.js
        taskManager.onceFrame(() => restoreGlassBackdrop(glassEls), 1); // core/color-utils.js
    },

    // ===================== Player control (Bottom Player) =====================

    /** Ứng với 'theme.playerControlStyle.click'. @param {string} style */
    setPlayerControlBgStyle(style) {
        setPlayerControlBgStyleConfig(style); // core/player-control-style.js
        workflowConfig.save();
        this.syncPlayerControlStyle();
    },

    /** Ứng với 'theme.playerControlOpacity.input' — gọi liên tục lúc kéo. @param {string} value */
    setPlayerControlOpacity(value) {
        setPlayerControlOpacityConfig(value); // core/player-control-style.js
        workflowConfig.save();
        this.syncPlayerControlStyle();
    },

    /** Ứng với 'theme.playerControlCover.change' — bìa trong nút Play. @param {boolean} checked */
    setPlayerControlCover(checked) {
        setPlayerControlCoverConfig(checked); // core/player-control-style.js
        workflowConfig.save();
        this.syncPlayerControlStyle();
    },

    /** Ứng với 'theme.playerControlSubtitleGap.input' — gọi liên tục lúc kéo. @param {string} value */
    setPlayerControlSubtitleGap(value) {
        setPlayerControlSubtitleGapConfig(value); // core/player-control-style.js
        workflowConfig.save();
        this.syncPlayerControlStyle();
    },

    /** Giá trị hiển thị Player control theo config hiện tại (kèm màu effect đang chạy cho khung xem trước). */
    getPlayerControlView() {
        const cfg = appConfigViz.getAll();
        const accentColor = computeProgressBarFillColor(resolveEffectConfig(cfg.customEffect, cfg.type)); // core/visualizer/visualizer-display.js + core/custom-effect.js
        return computePlayerControlView(cfg, accentColor); // core/player-control-style.js
    },

    /** Áp Player control lên Bottom Player (bề mặt + chỗ neo phụ đề), vá cụm ở Settings nếu màn Theme đang mở. Gọi lúc boot
     * (app-boot.js), sau mỗi lần đổi, và khi ẩn/hiện thanh (workflowVisualizerDisplay.setBottomPlayerVisible()). */
    syncPlayerControlStyle() {
        const view = this.getPlayerControlView();
        paintPlayerControlSurface(playerPanel, view); // core/player-control-style.js + core/dom-refs.js
        dockSubtitleDisplay(subtitleDisplay, PLAYER_CONTROL_SUBTITLE_HOST_BY_DOCK[view.subtitleDock](), view); // core/player-control-style.js
        const cluster = patchPlayerControlSettings(genericDrawerBody, view); // core/player-control-settings-ui.js
        if (cluster) applyUiThemeToDom(cluster, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    },

    /** Vá 3 card ở màn Theme (nếu đang mở) rồi áp lại UI theme cho cụm (key theme của card vừa đổi). @param {ThemeBgCardsView} cards */
    _patchCards(cards) {
        const cluster = patchThemeBackgroundCards(genericDrawerBody, cards); // core/theme-background-ui.js
        if (cluster) applyUiThemeToDom(cluster, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    },
};
