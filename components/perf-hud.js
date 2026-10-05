/**
 * components/perf-hud.js — MỚI (05/10/2026, Giang yêu cầu). Template tĩnh của Performance HUD (Rule 5d — chỉ trả chuỗi
 * HTML, KHÔNG addEventListener). Instantiate + wire ở core/perf-hud-ui.js::mountPerfHud(); chọn template theo Kiểu ở
 * event/workflow/perf-hud.js (PERF_HUD_TEMPLATE_BY_STYLE).
 *
 * Bố cục theo 2 ảnh mẫu Giang gửi, MÀU lấy từ theme app (data-uitk) — không hardcode:
 *   - `renderPerfHudStrip()`  — "HUD Strip": khối FPS lớn bên trái + 4 ô (icon / số / nhãn ngắn) ngăn bằng vạch kẻ.
 *     Chiều Dọc = cùng các khối xếp chồng (class `pph-vertical`, assets/css/perf-hud.css).
 *   - `renderPerfHudDetail()` — "Clean Light": đầu thẻ (icon màn hình + FPS lớn + biểu đồ cột FPS 12s gần nhất) +
 *     4 hàng (icon / nhãn đầy đủ / số bên phải) ngăn bằng vạch kẻ.
 * Màu icon theo nhóm `iconHue` của theme (Light bậc -500, Dark bậc -400...): FPS emerald, giật rose, frame sky,
 * JS amber, video violet. Nền = `modalCardBg modalCardBorder` (Morphin tự thành kính), chữ `textPrimary`/`textSecondary`,
 * vạch kẻ `dividerBorder`. Cấu trúc/kích thước viết CSS thuần ở assets/css/perf-hud.css (KHÔNG dùng class Tailwind
 * mới — tailwind.css là bản dựng sẵn).
 *
 * Ô số liệu mang `data-pph-value="<id>"` — id khớp formatPerfHudValues() (core/perf-hud.js). Cột biểu đồ mang
 * `data-pph-bar`. Không còn tay cầm kéo — chạm giữ vào HUD để kéo (Giang yêu cầu).
 */

// Icon Lucide (https://lucide.dev, ISC) — nét 2px, viewBox 24. `fill` riêng cho icon đặc như ảnh mẫu (tia sét, camera).
const PERF_HUD_ICONS = {
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2" fill="currentColor" fill-opacity="0.18"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    zap: '<path fill="currentColor" d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    codeXml: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    video: '<path fill="currentColor" d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect fill="currentColor" x="2" y="6" width="14" height="12" rx="2"/>',
};

/** 4 chỉ số phụ (FPS đứng riêng làm khối chính) — thứ tự hiển thị của cả 2 kiểu. */
const PERF_HUD_METRIC_ITEMS = [
    { id: 'jank', icon: 'zap', hue: 'rose', stripKey: 'perfHud.strip.jank', detailKey: 'perfHud.detail.jank' },
    { id: 'frame', icon: 'clock', hue: 'sky', stripKey: 'perfHud.strip.frame', detailKey: 'perfHud.detail.frame' },
    { id: 'js', icon: 'codeXml', hue: 'amber', stripKey: 'perfHud.strip.js', detailKey: 'perfHud.detail.js' },
    { id: 'drop', icon: 'video', hue: 'violet', stripKey: 'perfHud.strip.drop', detailKey: 'perfHud.detail.drop' },
];

function _perfHudSvg(iconKey) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PERF_HUD_ICONS[iconKey]}</svg>`;
}

/** Kiểu "HUD Strip". @returns {string} */
function renderPerfHudStrip() {
    const cellsHtml = PERF_HUD_METRIC_ITEMS.map((item) => `
            <div class="pph-cell" data-uitk="dividerBorder">
                <span class="pph-icon" data-uitk="iconHue:${item.hue}">${_perfHudSvg(item.icon)}</span>
                <span class="pph-value" data-pph-value="${item.id}">-</span>
                <span class="pph-label" data-uitk="textSecondary">${t(item.stripKey)}</span>
            </div>`).join('');
    return `
        <div id="perf-hud" class="pph pph-strip" data-uitk="textPrimary">
            <div class="pph-bg" data-uitk="modalCardBg modalCardBorder"></div>
            <div class="pph-body">
                <div class="pph-hero" data-uitk="iconHue:emerald">
                    <span class="pph-hero-label">${t('perfHud.fps')}</span>
                    <span class="pph-hero-value" data-pph-value="fps">-</span>
                </div>${cellsHtml}
            </div>
        </div>
    `;
}

/** Kiểu "Chi tiết". @param {number} barCount - số cột biểu đồ FPS (PERF_HUD_SPARK_BARS, core/perf-hud.js) @returns {string} */
function renderPerfHudDetail(barCount) {
    const barsHtml = Array.from({ length: barCount }, () => '<span class="pph-bar" data-pph-bar></span>').join('');
    const rowsHtml = PERF_HUD_METRIC_ITEMS.map((item) => `
            <div class="pph-row" data-uitk="dividerBorder">
                <span class="pph-icon" data-uitk="iconHue:${item.hue}">${_perfHudSvg(item.icon)}</span>
                <span class="pph-row-label">${t(item.detailKey)}</span>
                <span class="pph-value" data-pph-value="${item.id}">-</span>
            </div>`).join('');
    return `
        <div id="perf-hud" class="pph pph-detail" data-uitk="textPrimary">
            <div class="pph-bg" data-uitk="modalCardBg modalCardBorder"></div>
            <div class="pph-body">
                <div class="pph-head">
                    <span class="pph-head-icon" data-uitk="iconHue:emerald">${_perfHudSvg('monitor')}</span>
                    <div class="pph-head-text">
                        <span class="pph-head-label" data-uitk="textSecondary">${t('perfHud.fps')}</span>
                        <span class="pph-hero-value" data-pph-value="fps">-</span>
                    </div>
                    <div class="pph-spark" data-uitk="iconHue:emerald">${barsHtml}</div>
                </div>${rowsHtml}
            </div>
        </div>
    `;
}
