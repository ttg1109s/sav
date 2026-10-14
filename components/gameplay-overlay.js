/**
 * components/gameplay-overlay.js — khung tĩnh Game Mode, mount 1 lần lúc boot bên trong TPL_VISUALIZER_OVERLAY
 * (components/visualizer-overlay.js nội suy `${TPL_GAMEPLAY_OVERLAY}` — file này nạp trước file đó, xem index.html); kèm
 * template thân modal Kết quả (render*() dưới cùng, gọi từ event/workflow/gameplay-engine.js).
 *
 * `#gameplay-canvas`: vẽ circle + wave (core/gameplay/circle-mode-ui.js, nền trong suốt cho visualizer xuyên qua).
 * `#gameplay-tier-popup-layer`: chữ tier nổi + hiệu ứng vỡ vụn bằng DOM + CSS animation (core/gameplay/engine-ui.js).
 * `#gameplay-tap-surface`: lớp bắt chạm riêng của Game, nằm trên `#visualizer-gesture-surface` nên chiếm chạm trước.
 * z-[65] cao hơn mốc cao nhất trong `#visualizer-ui` (z-[60] của #subtitle-display).
 *
 * `#btn-gameplay-exit` (đúng vị trí #btn-open-control-center) bị modalChoice() (z-[130]) che lúc modal Kết quả mở — chủ ý:
 * modal có nút riêng, nút exit chỉ lo pha 'countdown'/'playing'.
 *
 * `${TPL_GAMEPLAY_ARROW_STAGE}` (components/gameplay-arrow-stage.js, nạp trước file này) chèn sau tap-surface: dưới nút
 * exit, countdown và popup layer. Layer mang `data-game-mode` (setGameplayLayerMode(), core/gameplay/engine-ui.js) — CSS
 * (assets/css/gameplay-arrow.css) hiện stage Arrow hoặc canvas + tap-surface Circle.
 */
const TPL_GAMEPLAY_OVERLAY = `
            <div id="gameplay-layer" class="hidden absolute inset-0 z-[65]">
                <div id="gameplay-tap-surface" class="absolute inset-0 pointer-events-auto"></div>
${TPL_GAMEPLAY_ARROW_STAGE}

                <button id="btn-gameplay-exit" class="absolute top-4 left-3 sm:left-6 z-20 w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors shadow-lg pointer-events-auto">
                    ${iconSvg('x', 'h-5 w-5 text-slate-300')}
                </button>

                <canvas id="gameplay-canvas" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
                <div id="gameplay-tier-popup-layer" class="absolute inset-0 pointer-events-none"></div>

                <div id="gameplay-countdown-screen" class="hidden absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div id="gameplay-countdown-number" class="gameplay-countdown-number">5</div>
                </div>
            </div>
`;

/** Vòng tròn % điểm: mỗi lap 1 cặp track + fill. `--ring-circumference` (rỗng) / `--ring-target` (đích) đọc bởi @keyframes
 * gameplayRingFill (assets/css/gameplay.css) — animation tự chạy khi chèn DOM.
 * @param {ReturnType<typeof computeScoreRingGeometry>} geometry - core/gameplay/engine.js @returns {string} */
function renderGameplayScoreRingSvg({ size, cx, cy, strokeWidth, circles }) {
    const circlesHtml = circles.map(({ r, circumference, target, color, delayMs }) =>
        `<circle class="gameplay-ring-track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${strokeWidth}"></circle>` +
        `<circle class="gameplay-ring-fill" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${strokeWidth}" stroke="${color}" ` +
        `stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="${circumference}" ` +
        `style="--ring-circumference:${circumference};--ring-target:${target};animation-delay:${delayMs}ms" ` +
        `transform="rotate(-90 ${cx} ${cy})"></circle>`
    ).join('');
    return `<svg class="gameplay-score-ring" viewBox="0 0 ${size} ${size}">${circlesHtml}</svg>`;
}

/**
 * Thân modal Kết quả: thông tin media (title/thời lượng/độ khó/số lượt chơi) trên cùng, vòng % làm nền với 2 dòng điểm
 * (`#gameplay-score-main` / `#gameplay-score-sub`, Workflow đếm-lên sau khi mở) chồng giữa, sao, breakdown tier
 * (`#gameplay-hit-<tier>`, ghi 1 lần). Không có tiêu đề. `title` đã escapeHtml() ở Workflow (dữ liệu người dùng).
 * @returns {string}
 */
function renderGameplayResultBodyHtml({ ringSvg, starMax, starRating, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel }) {
    const stars = Array.from({ length: starMax }, (_, i) =>
        `<span class="gameplay-star${i < starRating ? ' gameplay-star--lit' : ''}" style="animation-delay:${i * 180}ms">★</span>`
    ).join('');

    const hitGrid = tierOrder.map((name) => `
        <div>
            <div class="font-mono font-bold" id="gameplay-hit-${name}" data-uitk="textPrimary">0</div>
            <div class="text-[10px]" data-uitk="textSecondary">${tierLabels[name]}</div>
        </div>
    `).join('');

    return `
        <div class="flex flex-col items-center gap-3">
            <div class="w-full text-center">
                <div class="text-sm font-semibold truncate px-2" data-uitk="textPrimary">${title}</div>
                <div class="text-xs mt-0.5" data-uitk="textSecondary">${durationLabel} · ${difficultyLabel} · ${playCountLabel}</div>
            </div>
            <div class="relative w-[120px] h-[120px]">
                ${ringSvg}
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <div class="font-mono text-2xl font-bold" id="gameplay-score-main" data-uitk="textPrimary">0.000</div>
                    <div class="font-mono text-xs" id="gameplay-score-sub" data-uitk="textSecondary">0/0</div>
                </div>
            </div>
            <div class="flex gap-1 text-2xl">${stars}</div>
            <div class="grid grid-cols-5 gap-2 text-center w-full pt-2 border-t" data-uitk="dividerBorder">${hitGrid}</div>
        </div>
    `;
}
