/**
 * event/workflow/theme.js — "THẰNG THỰC THI CUỐI" của router "theme": chốt NỀN của app (Light/Dark không nền · Solid · Gradient · Background media).
 *
 * VIẾT LẠI 21/09/2026 (Giang yêu cầu "sửa lại UI: 3 card Solid/Gradient/Background media phản ánh đúng nền của nó + nút chọn bên dưới; Background
 * media cho thêm VIDEO; sửa lỗi dropdown nền chọn mục khác đều bị fallback về cái hiện tại; media bị xoá/mất -> boot fallback về lựa chọn trước đó").
 * Điểm chốt (Giang đã chọn khi được hỏi):
 *   - Nền media THAM CHIẾU item thư viện (`bgMediaKind` 'photo'|'video' + `bgMediaKey`) thay vì copy blob vào meta như bản cũ -> video không nhân đôi
 *     dung lượng; item bị xoá/mất thì lúc boot `loadPlaylistBgMediaAsset()` (core/config.js) tự về `bgFallbackMode` (nền Solid/Gradient chọn gần nhất).
 *   - Video nền CHỈ chạy khi đang ở màn App Panel và tab đang hiện; vào Visualizer / ẩn app -> pause (`syncBackgroundVideoPlayback()`).
 *   - Solid là mode RIÊNG có màu riêng (`bgSolidColor`) — hết cách "đoán solid từ gradient 2 màu giống nhau" vốn là nguyên nhân dropdown cũ nhảy ngược.
 *     SỬA 23/09/2026 (Giang: "bỏ toàn bộ background solid -> thay bằng none") — mode 'solid' ĐÃ XOÁ, card đầu là 'none' (Morphin không nền, không có ô màu).
 *   - MỚI 23/09/2026 (Giang báo lỗi vào lại Morphin bị ép về Background media) — mỗi lần chốt 1 kiểu nền Morphin ('none'|'gradient'|'background') đều ghi
 *     `morphinLastMode`; workflowAppSettings.handleUiThemeChange() dùng nó khi vào lại Morphin từ Light/Dark.
 *
 * Các method chốt mode: `applyNonBackgroundMode(mode)` (light/dark/solid/gradient), `reuseExistingBackgroundMedia()` (bấm lại card media khi đã có
 * item), `pickBackgroundMedia(kind)` + `handleMediaPickerTileClick()` (chọn item mới) — Router (event/router/theme.js) chọn ĐÚNG 1 method; đều kết thúc
 * bằng `_commitThemeMode()`. Sửa màu (`setGradientFrom`/`setGradientTo`) cũng CHỌN luôn card Gradient (`_commitColorEdit()`).
 *
 * Picker chọn item thư viện = Generic Drawer TÁI DÙNG `openMediaPickerDrawerUi()` (core/media-picker-drawer-ui.js) + lưới ảnh/video có sẵn
 * (`workflowFileManagerPhoto.setupPhotoGridWindow()`, `workflowVideoGalleryWindow`), mở `updateInPlace` vì đang đứng TRONG Settings (cùng khuôn picker của
 * Visual Background); chọn xong/đóng thì dựng lại màn Theme (`workflowAppSettings._renderTheme()`).
 *
 * `_commitThemeMode()` mutate `cfg.themeMode` TRƯỚC, rồi `updatePlaylistBg()` (core/color-utils.js — đọc themeMode để biết vẽ gì) + `forceGlassRepaint()`
 * (fix WebKit/iOS backdrop-filter không tự resample) + đồng bộ status bar/preloader + trạng thái phát video nền + UI card.
 *
 * NẠP SAU: core/config.js (saveConfig, resolveAppBgMedia), core/color-utils.js (updatePlaylistBg, forceGlassRepaint, setAppBgVideoPlayback),
 * core/visualizer/visualizer-display.js (setThemeGradientFrom/To, setAppGlassBlur/Tint), core/loading-shield-util.js (withLoadingShield), core/theme-background-ui.js
 * (patchThemeBackgroundCards), core/media-picker-drawer-ui.js (openMediaPickerDrawerUi), core/file-manager/image.js (listImages), core/file-manager/video.js
 * (listVideos), event/workflow/file-manager-photo.js, event/workflow/photo-gallery-window.js, event/workflow/video-gallery-window.js,
 * event/workflow/app-settings.js (workflowAppSettings._renderTheme — runtime), event/workflow/ui-theme.js (workflowUiTheme — runtime), core/dom-refs.js
 * (appStack, genericDrawerBody).
 */
const THEME_MORPHIN_BG_MODES = ['none', 'gradient', 'background']; // MỚI 23/09/2026 — 3 kiểu nền của Morphin (khớp THEME_BG_CARD_MODES, core/theme-background-ui.js)

const workflowTheme = {
    _mediaPickerKind: null, // 'photo' | 'video' | null — đang có picker media nền mở hay không
    _mediaPickerOpen: false, // SỬA (24/09/2026) — THAY `_mediaPickerCleanup` (hàm gỡ listener cũ, không còn cần — listener gắn trên nội dung động)

    /**
     * Ứng với 'theme.selectMode.click' khi `mode !== 'background'` (light/dark/none/gradient) — Router đã chọn ĐÚNG method này. None/Gradient
     * ghi nhớ làm `bgFallbackMode` (nền quay về khi media nền bị xoá/mất). Runtime URL media (nếu có) GIỮ nguyên — card Background media vẫn còn preview
     * và bấm lại là dùng ngay; `updatePlaylistBg()` chỉ vẽ media khi themeMode = 'background'.
     * @param {'light'|'dark'|'none'|'gradient'} mode
     */
    applyNonBackgroundMode(mode) {
        if (mode === 'none' || mode === 'gradient') appConfigViz.mutateAll(cfg => { cfg.bgFallbackMode = mode; });
        this._commitThemeMode(mode);
    },

    /** Ứng với 'theme.selectMode.click' khi mode = 'background' — bấm card Background media. Đã có item (URL runtime còn) -> dùng lại NGAY, không mở
     * picker; CHƯA có item nào -> không làm gì (card hiện khung "Not set", người dùng chọn qua nút Photo/Video bên dưới). */
    reuseExistingBackgroundMedia() {
        const cfg = appConfigViz.getAll();
        if (!cfg.bgImage && !cfg.bgVideo) return;
        this._commitThemeMode('background');
    },

    /**
     * Ứng với 'theme.pickBackgroundMedia.click' — mở picker thư viện ảnh/video (single-select: bấm item nào chọn NGAY item đó, không nút xác nhận).
     * Picker Generic Drawer KHÔNG blocking: `await` chỉ đợi tới lúc lưới dựng xong, việc chốt nền nằm ở `handleMediaPickerTileClick()`.
     * @param {'photo'|'video'} kind
     */
    async pickBackgroundMedia(kind) {
        this._mediaPickerKind = kind;
        const isPhoto = kind === 'photo';
        const scrollId = 'theme-bg-picker-scroll', emptyId = 'theme-bg-picker-empty';
        workflowGenericDrawerHelpers.mountMediaPicker({ // event/workflow/generic-drawer-helpers.js — SỬA 24/09/2026
            routerName: 'theme', msgPrefix: 'theme.mediaPicker',
            title: isPhoto ? t('playlistView.songEdit.coverPickLibrary') : t('fileManager.video.pickerTitle'),
            bodyHtml: this._buildMediaPickerBodyHtml(scrollId, emptyId, isPhoto ? t('fileManager.photo.image.empty') : t('fileManager.video.empty')),
            tileSelector: isPhoto ? '[data-image-key]' : '.video-tile', tileDataKey: isPhoto ? 'imageKey' : 'videoKey', showConfirmButton: false, updateInPlace: true,
        });
        this._mediaPickerOpen = true;
        const items = isPhoto ? await listImages() : await listVideos(); // core/file-manager/image.js | video.js
        if (!this._mediaPickerOpen) return; // guard — đóng picker RẤT NHANH lúc đang đọc DB
        const scrollEl = genericDrawerBody.querySelector(`#${scrollId}`);
        const emptyEl = genericDrawerBody.querySelector(`#${emptyId}`);
        if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);
        if (isPhoto) workflowFileManagerPhoto.setupPhotoGridWindow(scrollEl, items); // event/workflow/file-manager-photo.js
        else workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos: items, badgeMode: null }); // event/workflow/video-gallery-window.js
    },

    /** Khung picker: scroll container (lưới windowing chèn vào TRONG). Chuỗi thuần. */
    _buildMediaPickerBodyHtml(scrollId, emptyId, emptyText) {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">
                <p id="${emptyId}" class="hidden text-sm text-center py-10 px-6" data-uitk="textSecondary">${emptyText}</p>
            </div>
        `;
    },

    /** Dọn picker (gỡ lưới windowing + listener delegated) — KHÔNG đóng drawer/dựng lại màn (nơi gọi quyết định). */
    _teardownMediaPicker() {
        if (this._mediaPickerKind === 'photo') workflowPhotoGalleryWindow.unmount('genericDrawer'); // event/workflow/photo-gallery-window.js
        else if (this._mediaPickerKind === 'video') workflowVideoGalleryWindow.unmount('genericDrawer');
        this._mediaPickerOpen = false;
        this._mediaPickerKind = null;
    },

    /** Ứng với 'theme.mediaPicker.tile.click' — bấm 1 item: chốt làm nền media. Xong dựng lại màn Theme. @param {{imageKey?:string, videoKey?:string}} payload */
    async handleMediaPickerTileClick(payload) {
        const kind = this._mediaPickerKind;
        if (!kind) return; // picker đã đóng (race hiếm)
        const key = kind === 'photo' ? payload.imageKey : payload.videoKey;
        this._teardownMediaPicker();
        await withLoadingShield(t('common.loading.savingImageBg'), async () => { // core/loading-shield-util.js
            await this._applyPickedMedia(kind, key);
        });
        workflowAppSettings._renderTheme(); // event/workflow/app-settings.js — quay về màn Theme, card media phản ánh item mới
    },

    /** Ứng với 'theme.mediaPicker.close.click' — huỷ picker (chưa chọn gì): giữ nguyên nền, quay về màn Theme. */
    handleMediaPickerCloseClick() {
        if (!this._mediaPickerKind) return;
        this._teardownMediaPicker();
        workflowAppSettings._renderTheme();
    },

    /** Resolve item thư viện -> URL runtime -> ghi tham chiếu + chốt mode 'background'. Item vừa bị xoá ở nơi khác (`resolveAppBgMedia` null) -> bỏ qua. */
    async _applyPickedMedia(kind, key) {
        const media = await resolveAppBgMedia(kind, key); // core/config.js
        if (!media) return;
        this._releaseRuntimeMedia();
        appConfigViz.mutateAll(cfg => {
            cfg.bgMediaKind = kind; cfg.bgMediaKey = key;
            cfg.bgImage = media.imageUrl; cfg.bgVideo = media.videoUrl; cfg.bgMediaThumb = media.thumbUrl;
        });
        this._commitThemeMode('background');
    },

    /** Thu hồi 3 blob: URL runtime của nền media hiện tại (trước khi thay bằng item khác). */
    _releaseRuntimeMedia() {
        const cfg = appConfigViz.getAll();
        [cfg.bgImage, cfg.bgVideo, cfg.bgMediaThumb].forEach((url) => { if (url && url.startsWith('blob:')) URL.revokeObjectURL(url); });
    },

    /** Gộp phần "chốt mode" DÙNG CHUNG: mutate themeMode + saveConfig + updatePlaylistBg + forceGlassRepaint + đồng bộ status bar/preloader + phát video + UI card.
     * SỬA 23/09/2026 — kiểu nền Morphin ('none'|'gradient'|'background') còn được nhớ vào `morphinLastMode` (xem DEFAULT_VIZ_CONFIG, core/config.js);
     * 'light'/'dark' (rời Morphin) KHÔNG ghi đè -> vào lại Morphin quay đúng kiểu đã chọn trước đó.
     * @param {'light'|'dark'|'none'|'gradient'|'background'} mode */
    _commitThemeMode(mode) {
        appConfigViz.mutateAll(cfg => {
            cfg.themeMode = mode;
            if (THEME_MORPHIN_BG_MODES.includes(mode)) cfg.morphinLastMode = mode;
        });
        saveConfig();
        updatePlaylistBg(); // ĐẶT SAU khi themeMode đã cập nhật — updatePlaylistBg() đọc themeMode để quyết định vẽ gì.
        forceGlassRepaint(); // fix bug mục 3 (09/07/2026) — ép WebKit vẽ lại lớp kính NGAY, không đợi thao tác khác.
        workflowUiTheme.syncStatusBarColor(); // status bar iOS + mirror preloader theo nền (event/workflow/ui-theme.js)
        this.syncBackgroundVideoPlayback();
        this.refreshThemeCardUI();
    },

    // XOÁ 23/09/2026: setSolidColor() ('theme.solidColor.input') — nền Solid đã bỏ.

    /** MỚI 23/09/2026 (Giang: "tinh chỉnh độ mờ cho playlist main app" — thay blur ảnh nền) — ứng với 'theme.glassBlur.input'. Độ nhoè kính
     * Playlist chính; `updatePlaylistBg()` gán lại biến CSS (core/color-utils.js). Gọi liên tục lúc kéo -> không qua
     * `_commitThemeMode()` (không đổi mode). @param {string} value */
    setAppGlassBlur(value) {
        setAppGlassBlur(value); // core/visualizer/visualizer-display.js
        saveConfig();
        updatePlaylistBg();
        forceGlassRepaint();
        this.refreshThemeCardUI();
    },

    /** MỚI 23/09/2026 — ứng với 'theme.glassTint.input'. Độ đục nền trắng của kính Playlist chính. @param {string} value */
    setAppGlassTint(value) {
        setAppGlassTint(value); // core/visualizer/visualizer-display.js
        saveConfig();
        updatePlaylistBg();
        this.refreshThemeCardUI();
    },

    /** Ứng với 'theme.gradientFrom.input'. Chạm ô màu Gradient = CHỌN Gradient luôn. @param {string} value */
    setGradientFrom(value) {
        setThemeGradientFrom(value); // core cùng tên, gọi trần phân giải theo scope từ vựng (core/visualizer/visualizer-display.js)
        this._commitColorEdit('gradient');
    },

    /** Ứng với 'theme.gradientTo.input'. @param {string} value */
    setGradientTo(value) {
        setThemeGradientTo(value);
        this._commitColorEdit('gradient');
    },

    /** Đuôi chung của 2 hàm sửa màu Gradient: chọn mode Gradient (+ ghi nhớ làm fallback + kiểu Morphin gần nhất) rồi vẽ lại — gọi liên tục lúc kéo ô màu
     * nên KHÔNG gọi `_commitThemeMode()` (thêm việc vô ích mỗi lần `input`). @param {'gradient'} mode */
    _commitColorEdit(mode) {
        appConfigViz.mutateAll(cfg => { cfg.themeMode = mode; cfg.bgFallbackMode = mode; cfg.morphinLastMode = mode; });
        saveConfig();
        updatePlaylistBg();
        forceGlassRepaint();
        workflowUiTheme.syncStatusBarColor();
        this.syncBackgroundVideoPlayback(); // rời nền video (nếu đang ở đó) -> updatePlaylistBg() đã gỡ src, hàm này chỉ đảm bảo trạng thái nhất quán
        this.refreshThemeCardUI();
    },

    /** Ứng với 'theme.appStackScreen.change' — đổi màn App Panel <-> Visualizer (listener theo dõi class `playlist-hidden` của #app-stack): (1) status bar
     * theo theme chỉ áp ở App Panel (`workflowUiTheme.applyStatusBarForCurrentScreen()`); (2) video nền chỉ phát ở App Panel. */
    onAppStackScreenChange() {
        workflowUiTheme.applyStatusBarForCurrentScreen();
        this.syncBackgroundVideoPlayback();
    },

    /** Ứng với 'theme.documentVisibility.change' — app bị ẩn/hiện lại (khoá máy, chuyển app, chuyển tab): dừng/tiếp tục video nền. */
    onDocumentVisibilityChange() {
        this.syncBackgroundVideoPlayback();
    },

    /** Quyết định video nền PHÁT hay DỪNG: chỉ phát khi đang ở mode 'background' + có video + màn App Panel (không phải Visualizer) + tab đang hiện.
     * Gọi từ MỌI nơi 1 trong 4 điều kiện đó có thể đổi (chốt mode, đổi màn, ẩn/hiện app, boot — `workflowUiTheme.loadPersistedUiThemeOnBoot()`). */
    syncBackgroundVideoPlayback() {
        const cfg = appConfigViz.getAll();
        const shouldPlay = cfg.themeMode === 'background' && !!cfg.bgVideo && !appStack.classList.contains('playlist-hidden') && document.visibilityState !== 'hidden';
        setAppBgVideoPlayback(shouldPlay); // core/color-utils.js
    },

    /** Trạng thái 3 card nền (preview + card đang chọn) từ config — Workflow đọc, Core-ui (core/theme-background-ui.js) chỉ vẽ. Dùng cho
     * `workflowAppSettings._renderTheme()` (dựng lần đầu) VÀ `refreshThemeCardUI()` (vá tại chỗ). Preview media: photo = chính ảnh; video = thumb full-res.
     * @returns {ThemeBackgroundState} */
    buildBackgroundCardState() {
        const cfg = appConfigViz.getAll();
        return {
            themeMode: cfg.themeMode,
            gradientFrom: cfg.gradientFrom,
            gradientTo: cfg.gradientTo,
            mediaKind: cfg.bgMediaKind,
            hasMedia: !!cfg.bgMediaKey && (!!cfg.bgImage || !!cfg.bgVideo),
            mediaPreviewUrl: cfg.bgMediaKind === 'video' ? cfg.bgMediaThumb : (cfg.bgMediaKind === 'photo' ? cfg.bgImage : ''),
            glassBlur: Number.isFinite(cfg.appGlassBlur) ? Math.max(10, Math.min(40, cfg.appGlassBlur)) : 36, // MỚI 23/09/2026 — kính Playlist chính (guard data cũ)
            glassTint: Number.isFinite(cfg.appGlassTint) ? Math.max(5, Math.min(40, cfg.appGlassTint)) : 10, // SỬA 23/09/2026 — kẹp min 10px/5% như updatePlaylistBg()
            // Hàng "Panel glass" chỉ hiện khi ĐANG dùng nền media (ảnh hoặc video) — Giang chọn; cùng điều kiện áp giá trị trong updatePlaylistBg().
            showGlassRow: cfg.themeMode === 'background' && !!(cfg.bgVideo || cfg.bgImage),
        };
    },

    /** MỚI 23/09/2026 (Giang báo "vào lại Morphin bị fallback về Background media") — kiểu nền khi VÀO Morphin từ Light/Dark: đúng kiểu chọn gần nhất
     * (`morphinLastMode`); kiểu đó là 'background' mà media đã mất -> `bgFallbackMode` (None/Gradient gần nhất); chưa từng chọn -> giữ cách cũ (có media thì
     * media, không thì fallback). Chỉ ĐỌC config, trả chuỗi — workflowAppSettings.handleUiThemeChange() gửi message chốt.
     * @returns {'none'|'gradient'|'background'} */
    resolveMorphinEntryMode() {
        const cfg = appConfigViz.getAll();
        const hasMedia = !!cfg.bgMediaKey && !!(cfg.bgImage || cfg.bgVideo);
        const fallback = cfg.bgFallbackMode === 'none' ? 'none' : 'gradient';
        const last = THEME_MORPHIN_BG_MODES.includes(cfg.morphinLastMode) ? cfg.morphinLastMode : (hasMedia ? 'background' : fallback);
        return last === 'background' && !hasMedia ? fallback : last;
    },

    /** Vá tại chỗ 3 card ở màn Theme (nếu đang mở) theo config hiện tại — gọi sau mỗi lần đổi mode/màu/media, và lúc boot (không có DOM thì bỏ qua). */
    refreshThemeCardUI() {
        patchThemeBackgroundCards(genericDrawerBody, this.buildBackgroundCardState()); // core/theme-background-ui.js
    },
};
