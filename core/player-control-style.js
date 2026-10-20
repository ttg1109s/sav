/**
 * core/player-control-style.js — Kiểu nền + độ trong suốt của Bottom Player (Settings > Theme > Player control). Field config:
 * `playerControlBgStyle`, `playerControlOpacity` (viz, core/config.js). CSS: assets/css/player-control.css. Điều phối:
 * event/workflow/theme.js (đổi ở Settings + lúc boot).
 *
 * NẠP SAU: core/config.js (appConfigViz).
 */

/** Thứ tự = thứ tự nút ở Settings. 'gradient' = giao diện gốc (đen mờ dần lên trên). */
const PLAYER_CONTROL_BG_STYLES = ['gradient', 'solid', 'glass', 'floating', 'none'];
const PLAYER_CONTROL_DEFAULT_BG_STYLE = 'gradient';
const PLAYER_CONTROL_OPACITY_MIN_PCT = 0;
const PLAYER_CONTROL_OPACITY_MAX_PCT = 100;
const PLAYER_CONTROL_DEFAULT_OPACITY_PCT = 100;

/**
 * Giá trị hiển thị (Bottom Player + cụm Player control ở Settings) từ config — kiểu lạ về mặc định, độ đục kẹp 0-100.
 * @param {object} cfg - appConfigViz.getAll() @param {string} accentColor - màu effect đang chạy (khung xem trước)
 * @returns {{style:string, opacityPct:number, alpha:number, showOpacity:boolean, accentColor:string,
 *   items:{style:string, labelKey:string, selected:boolean, uitk:string}[]}}
 */
function computePlayerControlView(cfg, accentColor) {
    const style = PLAYER_CONTROL_BG_STYLES.includes(cfg.playerControlBgStyle) ? cfg.playerControlBgStyle : PLAYER_CONTROL_DEFAULT_BG_STYLE;
    const opacityPct = Number.isFinite(cfg.playerControlOpacity)
        ? Math.max(PLAYER_CONTROL_OPACITY_MIN_PCT, Math.min(PLAYER_CONTROL_OPACITY_MAX_PCT, Math.round(cfg.playerControlOpacity)))
        : PLAYER_CONTROL_DEFAULT_OPACITY_PCT;
    return {
        style,
        opacityPct,
        alpha: opacityPct / 100,
        showOpacity: style !== 'none', // không nền thì không có gì để chỉnh độ đục
        accentColor,
        items: PLAYER_CONTROL_BG_STYLES.map((s) => ({
            style: s,
            labelKey: `appSettings.theme.playerControl.style.${s}`,
            selected: s === style,
            uitk: s === style ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText',
        })),
    };
}

/** Ghi kiểu nền — kiểu không có trong PLAYER_CONTROL_BG_STYLES thì bỏ qua. @param {string} style */
function setPlayerControlBgStyleConfig(style) {
    if (!PLAYER_CONTROL_BG_STYLES.includes(style)) return;
    appConfigViz.mutateAll((cfg) => { cfg.playerControlBgStyle = style; });
    console.log(`writer: "setPlayerControlBgStyleConfig", page: "viz.playerControlBgStyle", content: "${style}"`);
}

/** Ghi độ đục nền — số nguyên, kẹp 0-100. @param {string|number} value */
function setPlayerControlOpacityConfig(value) {
    const pct = Math.max(PLAYER_CONTROL_OPACITY_MIN_PCT, Math.min(PLAYER_CONTROL_OPACITY_MAX_PCT, parseInt(value, 10) || 0));
    appConfigViz.mutateAll((cfg) => { cfg.playerControlOpacity = pct; });
    console.log(`writer: "setPlayerControlOpacityConfig", page: "viz.playerControlOpacity", content: "${pct}"`);
}

/** Áp kiểu nền + độ đục lên 1 bề mặt `.pc-surface` (#player-panel). @param {HTMLElement} surfaceEl
 * @param {{style:string, alpha:number}} view - computePlayerControlView() */
function paintPlayerControlSurface(surfaceEl, view) {
    surfaceEl.dataset.pcStyle = view.style;
    surfaceEl.style.setProperty('--pc-alpha', String(view.alpha));
}
