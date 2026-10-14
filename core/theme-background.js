/**
 * core/theme-background.js — phép tính THUẦN của nền App Panel (Morphin: None / Gradient / Background media), kính Playlist
 * chính và các giá trị theo nền (status bar, nền preloader). Không đọc config, không ghi DOM: Workflow (event/workflow/
 * {theme,ui-theme,app-settings}.js) đọc config rồi truyền vào. Ghi DOM: core/color-utils.js::updatePlaylistBg(),
 * core/theme-background-ui.js; markup 3 card: components/settings/theme.js.
 *
 * @typedef {{glassFilter:string, glassTint:string, videoSrc:string, videoPoster:string, imageBg:string}} PlaylistBgView
 * @typedef {{mode:string, labelKey:string, uitk:string, selected:boolean, previewStyle:string, showEmpty:boolean, showVideoBadge:boolean}} ThemeBgCardView
 * @typedef {{items:ThemeBgCardView[], byMode:Object<string, ThemeBgCardView>, gradientFrom:string, gradientTo:string,
 *   glassBlur:number, glassTint:number, showGlassRow:boolean}} ThemeBgCardsView
 */

const THEME_MORPHIN_BG_MODES = ['none', 'gradient', 'background']; // 3 kiểu nền Morphin = thứ tự 3 card; 'background' = Background media
const THEME_BG_CARD_LABEL_KEYS = { none: 'appSettings.theme.bg.none', gradient: 'appSettings.theme.bg.gradient', background: 'appSettings.theme.bg.media' };
// Kính Playlist chính — cùng mức kẹp với setAppGlassBlur()/setAppGlassTint() (core/visualizer/visualizer-display.js).
const THEME_GLASS_BLUR_MIN_PX = 10;
const THEME_GLASS_BLUR_MAX_PX = 40;
const THEME_GLASS_BLUR_DEFAULT_PX = 36;
const THEME_GLASS_TINT_MIN_PCT = 5;
const THEME_GLASS_TINT_MAX_PCT = 40;
const THEME_GLASS_TINT_DEFAULT_PCT = 10;
const THEME_BG_OVERLAY_ALPHA = 0.4; // lớp phủ đen luôn chồng lên ảnh/video nền (chữ trắng đọc được)
const THEME_MORPHIN_BASE_BG = '#0f172a'; // = appBaseBg của Morphin (slate-900, core/ui-theme/morphin.js) — nền khi không có nền
const THEME_BG_PREVIEW_HEIGHT_PX = 88; // style inline — tránh class ngoặc vuông (Tailwind CDN tiêm CSS bất đồng bộ)
const THEME_HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Mọi giá trị hiển thị của nền từ vizConfig, tính 1 lần cho 2 nơi: lớp nền App (`playlistBg` -> updatePlaylistBg()) và 3 card
 * ở Settings > Theme (`cards`). Chỉ ở mode 'background' mới vẽ media; URL runtime của media vẫn giữ khi đang ở None/Gradient
 * (card media còn preview). Kính chỉ lấy giá trị người dùng chỉnh khi đang dùng nền media, còn lại về mặc định.
 * @param {object} cfg vizConfig
 * @returns {{playlistBg: PlaylistBgView, cards: ThemeBgCardsView}}
 */
function computeThemeBackgroundView(cfg) {
    const isMediaMode = cfg.themeMode === 'background';
    const hasMediaUrl = !!(cfg.bgImage || cfg.bgVideo);
    const hasMedia = !!cfg.bgMediaKey && hasMediaUrl;
    const isTunedGlass = isMediaMode && hasMediaUrl;
    // Kẹp cả lúc đọc: data lưu dưới mức min (bản cũ 0-40) tự lên đúng min; data cũ chưa có field -> mặc định.
    const glassBlur = Number.isFinite(cfg.appGlassBlur) ? Math.max(THEME_GLASS_BLUR_MIN_PX, Math.min(THEME_GLASS_BLUR_MAX_PX, cfg.appGlassBlur)) : THEME_GLASS_BLUR_DEFAULT_PX;
    const glassTint = Number.isFinite(cfg.appGlassTint) ? Math.max(THEME_GLASS_TINT_MIN_PCT, Math.min(THEME_GLASS_TINT_MAX_PCT, cfg.appGlassTint)) : THEME_GLASS_TINT_DEFAULT_PCT;
    const appliedBlur = isTunedGlass ? glassBlur : THEME_GLASS_BLUR_DEFAULT_PX;
    const appliedTint = isTunedGlass ? glassTint : THEME_GLASS_TINT_DEFAULT_PCT;

    const overlay = `linear-gradient(rgba(0,0,0,${THEME_BG_OVERLAY_ALPHA}), rgba(0,0,0,${THEME_BG_OVERLAY_ALPHA}))`;
    const gradientCss = `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`;
    const videoSrc = isMediaMode && cfg.bgVideo ? cfg.bgVideo : '';
    // Thứ tự ưu tiên: video (appBgImage chỉ mang overlay, video nằm dưới) -> ảnh -> gradient -> không nền.
    let imageBg = 'none';
    if (cfg.themeMode === 'gradient') imageBg = gradientCss;
    if (isMediaMode && cfg.bgImage) imageBg = `${overlay}, url(${cfg.bgImage})`;
    if (videoSrc) imageBg = overlay;

    // Preview card media: photo = chính ảnh, video = thumb full-res.
    const mediaPreviewUrl = cfg.bgMediaKind === 'video' ? cfg.bgMediaThumb : (cfg.bgMediaKind === 'photo' ? cfg.bgImage : '');
    const previewHeight = `height:${THEME_BG_PREVIEW_HEIGHT_PX}px;`;
    const previewStyleByMode = {
        none: `${previewHeight} background:${THEME_MORPHIN_BASE_BG};`,
        gradient: `${previewHeight} background:${gradientCss};`,
        background: mediaPreviewUrl ? `${previewHeight} background:url(${mediaPreviewUrl}) center / cover no-repeat;` : previewHeight,
    };
    const items = THEME_MORPHIN_BG_MODES.map((mode) => {
        const selected = cfg.themeMode === mode;
        const isMediaCard = mode === 'background';
        return {
            mode,
            labelKey: THEME_BG_CARD_LABEL_KEYS[mode],
            selected,
            uitk: selected ? 'rowActiveBg rowActiveBorder' : 'cardBg cardBorder',
            previewStyle: previewStyleByMode[mode],
            showEmpty: isMediaCard && !hasMedia,
            showVideoBadge: isMediaCard && hasMedia && cfg.bgMediaKind === 'video',
        };
    });

    return {
        playlistBg: {
            glassFilter: `blur(${appliedBlur}px) saturate(1.6)`,
            glassTint: `rgba(255, 255, 255, ${appliedTint / 100})`,
            videoSrc,
            videoPoster: cfg.bgMediaThumb || '',
            imageBg,
        },
        cards: {
            items,
            byMode: Object.fromEntries(items.map((item) => [item.mode, item])),
            gradientFrom: cfg.gradientFrom,
            gradientTo: cfg.gradientTo,
            glassBlur,
            glassTint,
            showGlassRow: isTunedGlass,
        },
    };
}

/**
 * Các field config ghi khi chốt 1 mode nền: kiểu Morphin ('none'|'gradient'|'background') được nhớ vào `morphinLastMode`
 * (vào lại Morphin quay đúng kiểu đó); None/Gradient còn ghi làm `bgFallbackMode` (nền quay về khi media mất). 'light'/'dark'
 * chỉ đổi `themeMode`.
 * @param {object} cfg vizConfig hiện tại @param {string} mode
 * @returns {{themeMode:string, morphinLastMode:string, bgFallbackMode:string}}
 */
function computeThemeModeCommit(cfg, mode) {
    const isMorphinMode = THEME_MORPHIN_BG_MODES.includes(mode);
    const isFallbackMode = mode === 'none' || mode === 'gradient';
    return {
        themeMode: mode,
        morphinLastMode: isMorphinMode ? mode : cfg.morphinLastMode,
        bgFallbackMode: isFallbackMode ? mode : cfg.bgFallbackMode,
    };
}

/**
 * Mode nền cần chốt khi đổi Color (Light/Dark/Morphin). Rời Morphin -> chính tên theme ('light'|'dark'). Vào Morphin khi nền
 * chưa phải kiểu Morphin -> kiểu chọn gần nhất (`morphinLastMode`); kiểu đó là 'background' mà media đã mất -> `bgFallbackMode`;
 * chưa từng chọn -> có media thì media, không thì fallback. Đang có sẵn kiểu Morphin -> '' (không đổi).
 * @param {string} themeName @param {object} cfg vizConfig @returns {string}
 */
function computeUiThemeChangeBgMode(themeName, cfg) {
    const hasMedia = !!cfg.bgMediaKey && !!(cfg.bgImage || cfg.bgVideo);
    const fallback = cfg.bgFallbackMode === 'none' ? 'none' : 'gradient';
    const last = THEME_MORPHIN_BG_MODES.includes(cfg.morphinLastMode) ? cfg.morphinLastMode : (hasMedia ? 'background' : fallback);
    const entryMode = last === 'background' && !hasMedia ? fallback : last;
    const keepMode = THEME_MORPHIN_BG_MODES.includes(cfg.themeMode) ? '' : entryMode;
    return themeName === 'morphin' ? keepMode : themeName;
}

/**
 * Video nền App chỉ phát khi đang ở mode 'background' + có video + màn App Panel (không phải Visualizer) + tab đang hiện.
 * @param {object} cfg vizConfig @param {boolean} visualizerScreenActive @param {string} visibilityState document.visibilityState
 * @returns {boolean}
 */
function shouldPlayAppBgVideo(cfg, visualizerScreenActive, visibilityState) {
    return cfg.themeMode === 'background' && !!cfg.bgVideo && !visualizerScreenActive && visibilityState !== 'hidden';
}

/**
 * Nguồn màu status bar theo nền thật (cùng thứ tự ưu tiên của updatePlaylistBg()). Chỉ Morphin mới tô: 'background' -> lấy mẫu
 * ảnh (video thì thumb full-res — video không lấy mẫu trực tiếp được); 'gradient' -> nội suy 2 màu; còn lại 'none' (gỡ màu,
 * trả về `appBaseBg` của theme).
 * @param {string} activeUiTheme @param {object} cfg vizConfig
 * @returns {{kind:'none'|'image'|'gradient', url:string, from:string, to:string}}
 */
function computeStatusBarColorSource(activeUiTheme, cfg) {
    const isMorphin = activeUiTheme === 'morphin';
    const sampleUrl = cfg.bgVideo ? cfg.bgMediaThumb : cfg.bgImage;
    let kind = 'none';
    if (isMorphin && cfg.themeMode === 'gradient') kind = 'gradient';
    if (isMorphin && cfg.themeMode === 'background' && sampleUrl) kind = 'image';
    return { kind, url: sampleUrl || '', from: cfg.gradientFrom, to: cfg.gradientTo };
}

/**
 * Bản sao nền cho preloader lần mở sau (`localStorage['uiThemeBoot']`, service/boot-preloader.js đọc đồng bộ). Chỉ Morphin
 * (`keep`); nền media -> màu mép trên đã lấy mẫu (blob nằm trong IndexedDB, không mirror được chính media); gradient -> chuỗi
 * `linear-gradient` (chỉ khi 2 màu đúng dạng hex, vì chuỗi này gán thẳng vào `style.background`); còn lại slate-900.
 * @param {string} activeUiTheme @param {object} cfg vizConfig @param {string} statusBarColor màu vừa tô ('' nếu không có)
 * @returns {{keep:boolean, preloaderBg:string, storageJson:string}}
 */
function computeBootBackdropMirror(activeUiTheme, cfg, statusBarColor) {
    const isGradientValid = cfg.themeMode === 'gradient' && THEME_HEX_COLOR_RE.test(cfg.gradientFrom) && THEME_HEX_COLOR_RE.test(cfg.gradientTo);
    let preloaderBg = THEME_MORPHIN_BASE_BG;
    if (isGradientValid) preloaderBg = `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`;
    if (cfg.themeMode === 'background') preloaderBg = statusBarColor || THEME_MORPHIN_BASE_BG;
    return {
        keep: activeUiTheme === 'morphin',
        preloaderBg,
        storageJson: JSON.stringify({ preloaderBg, statusBar: statusBarColor || '' }),
    };
}
