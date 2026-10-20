/**
 * core/player-control-style.js — Settings > Theme > Player control của Bottom Player: kiểu nền, độ đục, bìa trong nút Play,
 * vị trí phụ đề (trong thanh / ngoài thanh + khoảng cách). Field config (viz, core/config.js): `playerControlBgStyle`,
 * `playerControlOpacity`, `playerControlCoverPlay`, `playerControlSubtitlePlacement`, `playerControlSubtitleGap`.
 * CSS: assets/css/player-control.css. Điều phối: event/workflow/theme.js (đổi ở Settings, lúc boot, khi ẩn/hiện thanh).
 *
 * NẠP SAU: core/config.js (appConfigViz).
 */

/** Thứ tự = thứ tự nút ở Settings. */
const PLAYER_CONTROL_BG_STYLES = ['glass', 'floating', 'none'];
const PLAYER_CONTROL_DEFAULT_BG_STYLE = 'glass';
const PLAYER_CONTROL_OPACITY_MIN_PCT = 20;
const PLAYER_CONTROL_OPACITY_MAX_PCT = 100;
const PLAYER_CONTROL_DEFAULT_OPACITY_PCT = 100;
/** 'inbox' = trong thanh, trên tên media; 'outside' = phía trên thanh, cách `playerControlSubtitleGap` px. */
const PLAYER_CONTROL_SUBTITLE_PLACEMENTS = ['inbox', 'outside'];
const PLAYER_CONTROL_DEFAULT_SUBTITLE_PLACEMENT = 'outside';
const PLAYER_CONTROL_SUBTITLE_GAP_MIN_PX = 0;
const PLAYER_CONTROL_SUBTITLE_GAP_MAX_PX = 160;
const PLAYER_CONTROL_DEFAULT_SUBTITLE_GAP_PX = 16;

/**
 * Giá trị hiển thị (Bottom Player + cụm Player control ở Settings) từ config — giá trị lạ về mặc định, số kẹp trong khoảng.
 * `subtitleDock`: chỗ neo #subtitle-display — theo lựa chọn khi thanh đang hiện, 'overlay' (vị trí gốc trên Visualizer) khi
 * thanh bị tắt ở Settings > Visualizer display.
 * @param {object} cfg - appConfigViz.getAll() @param {string} accentColor - màu effect đang chạy (khung xem trước)
 * @returns {{style:string, opacityPct:number, alpha:number, showOpacity:boolean, accentColor:string, coverOn:boolean,
 *   subtitlePlacement:string, subtitleGapPx:number, showSubtitleGap:boolean, subtitleDock:'inbox'|'outside'|'overlay',
 *   items:{style:string, labelKey:string, selected:boolean, uitk:string}[],
 *   subtitleItems:{placement:string, labelKey:string, selected:boolean, uitk:string}[]}}
 */
function computePlayerControlView(cfg, accentColor) {
    const style = PLAYER_CONTROL_BG_STYLES.includes(cfg.playerControlBgStyle) ? cfg.playerControlBgStyle : PLAYER_CONTROL_DEFAULT_BG_STYLE;
    const opacityPct = Number.isFinite(cfg.playerControlOpacity)
        ? Math.max(PLAYER_CONTROL_OPACITY_MIN_PCT, Math.min(PLAYER_CONTROL_OPACITY_MAX_PCT, Math.round(cfg.playerControlOpacity)))
        : PLAYER_CONTROL_DEFAULT_OPACITY_PCT;
    const subtitlePlacement = PLAYER_CONTROL_SUBTITLE_PLACEMENTS.includes(cfg.playerControlSubtitlePlacement)
        ? cfg.playerControlSubtitlePlacement : PLAYER_CONTROL_DEFAULT_SUBTITLE_PLACEMENT;
    const subtitleGapPx = Number.isFinite(cfg.playerControlSubtitleGap)
        ? Math.max(PLAYER_CONTROL_SUBTITLE_GAP_MIN_PX, Math.min(PLAYER_CONTROL_SUBTITLE_GAP_MAX_PX, Math.round(cfg.playerControlSubtitleGap)))
        : PLAYER_CONTROL_DEFAULT_SUBTITLE_GAP_PX;
    return {
        style,
        opacityPct,
        alpha: opacityPct / 100,
        showOpacity: style !== 'none', // không nền thì không có gì để chỉnh độ đục
        accentColor,
        coverOn: cfg.playerControlCoverPlay !== false,
        subtitlePlacement,
        subtitleGapPx,
        showSubtitleGap: subtitlePlacement === 'outside',
        subtitleDock: cfg.bottomPlayerVisible !== false ? subtitlePlacement : 'overlay',
        items: PLAYER_CONTROL_BG_STYLES.map((s) => ({
            style: s,
            labelKey: `appSettings.theme.playerControl.style.${s}`,
            selected: s === style,
            uitk: s === style ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText',
        })),
        subtitleItems: PLAYER_CONTROL_SUBTITLE_PLACEMENTS.map((p) => ({
            placement: p,
            labelKey: `appSettings.theme.playerControl.subtitle.${p}`,
            selected: p === subtitlePlacement,
            uitk: p === subtitlePlacement ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText',
        })),
    };
}

/** Ghi kiểu nền — kiểu không có trong PLAYER_CONTROL_BG_STYLES thì bỏ qua. @param {string} style */
function setPlayerControlBgStyleConfig(style) {
    if (!PLAYER_CONTROL_BG_STYLES.includes(style)) return;
    appConfigViz.mutateAll((cfg) => { cfg.playerControlBgStyle = style; });
    console.log(`writer: "setPlayerControlBgStyleConfig", page: "viz.playerControlBgStyle", content: "${style}"`);
}

/** Ghi độ đục nền — số nguyên, kẹp 20-100. @param {string|number} value */
function setPlayerControlOpacityConfig(value) {
    const pct = Math.max(PLAYER_CONTROL_OPACITY_MIN_PCT, Math.min(PLAYER_CONTROL_OPACITY_MAX_PCT, parseInt(value, 10) || 0));
    appConfigViz.mutateAll((cfg) => { cfg.playerControlOpacity = pct; });
    console.log(`writer: "setPlayerControlOpacityConfig", page: "viz.playerControlOpacity", content: "${pct}"`);
}

/** Ghi bật/tắt bìa trong nút Play. @param {boolean} checked */
function setPlayerControlCoverConfig(checked) {
    const on = checked === true;
    appConfigViz.mutateAll((cfg) => { cfg.playerControlCoverPlay = on; });
    console.log(`writer: "setPlayerControlCoverConfig", page: "viz.playerControlCoverPlay", content: "${on}"`);
}

/** Ghi vị trí phụ đề — giá trị lạ thì bỏ qua. @param {string} placement */
function setPlayerControlSubtitlePlacementConfig(placement) {
    if (!PLAYER_CONTROL_SUBTITLE_PLACEMENTS.includes(placement)) return;
    appConfigViz.mutateAll((cfg) => { cfg.playerControlSubtitlePlacement = placement; });
    console.log(`writer: "setPlayerControlSubtitlePlacementConfig", page: "viz.playerControlSubtitlePlacement", content: "${placement}"`);
}

/** Ghi khoảng cách phụ đề ↔ mép trên thanh (chế độ Outside) — số nguyên px, kẹp 0-160. @param {string|number} value */
function setPlayerControlSubtitleGapConfig(value) {
    const px = Math.max(PLAYER_CONTROL_SUBTITLE_GAP_MIN_PX, Math.min(PLAYER_CONTROL_SUBTITLE_GAP_MAX_PX, parseInt(value, 10) || 0));
    appConfigViz.mutateAll((cfg) => { cfg.playerControlSubtitleGap = px; });
    console.log(`writer: "setPlayerControlSubtitleGapConfig", page: "viz.playerControlSubtitleGap", content: "${px}"`);
}

/** Áp kiểu nền, độ đục, bìa nút Play lên 1 bề mặt `.pc-surface` (#player-panel). @param {HTMLElement} surfaceEl
 * @param {ReturnType<typeof computePlayerControlView>} view */
function paintPlayerControlSurface(surfaceEl, view) {
    surfaceEl.dataset.pcStyle = view.style;
    surfaceEl.dataset.pcCover = view.coverOn ? 'on' : 'off';
    surfaceEl.style.setProperty('--pc-alpha', String(view.alpha));
}

/** Neo #subtitle-display vào chỗ ứng với `view.subtitleDock` (chỉ chuyển khi đổi chỗ — không ngắt hiệu ứng đang chạy) + khoảng
 * cách chế độ Outside. Vị trí cụ thể theo `data-sub-dock` (assets/css/player-control.css).
 * @param {HTMLElement} subtitleEl - #subtitle-display @param {HTMLElement} hostEl - #pc-sub-slot / #player-container /
 * #subtitle-overlay-dock @param {ReturnType<typeof computePlayerControlView>} view */
function dockSubtitleDisplay(subtitleEl, hostEl, view) {
    if (subtitleEl.parentNode !== hostEl) hostEl.appendChild(subtitleEl);
    subtitleEl.dataset.subDock = view.subtitleDock;
    subtitleEl.style.setProperty('--pc-sub-gap', `${view.subtitleGapPx}px`);
}
