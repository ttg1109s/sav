/**
 * components/gameplay-arrow-stage.js — MỚI (07/10/2026, Giang yêu cầu game "Arrow"). Khung TĨNH màn chơi mode "Arrow"
 * (Rule 5d) — nội suy vào TPL_GAMEPLAY_OVERLAY (components/gameplay-overlay.js) nên PHẢI nạp TRƯỚC file đó.
 *
 * Bố cục (style ở assets/css/gameplay-arrow.css):
 *   - HUD level + hệ số tốc độ.
 *   - Thanh tiến trình `#gameplay-arrow-track`: vạch đích nhấp nháy tại 80% + dải blur mờ 2 bên (`-zone`/`-target`,
 *     vị trí/bề rộng do core-ui gán từ config — vẽ ĐÚNG vùng core chấm điểm), nút tròn to hơn thanh chạy 0 -> 100%
 *     (`-cursor-rail` dịch bằng transform mỗi frame).
 *   - Dải vòng tròn mũi tên `#gameplay-arrow-strip` — RỖNG ở đây, mỗi vòng chơi đổ HTML từ renderGameplayArrowStripHtml().
 *   - Bàn phím: trái `#gameplay-arrow-pad` (vòng tròn 8 nút hướng, `data-arrow-dir` 0..7, 0 = lên, theo chiều kim đồng
 *     hồ), phải `#btn-gameplay-arrow-commit` (Enter).
 *
 * Chỉ hiện khi `#gameplay-layer[data-game-mode="arrow"]` (core/gameplay/engine-ui.js::setGameplayLayerMode()) —
 * mode Circle giữ nguyên canvas + tap-surface. Stage tự chiếm MỌI chạm trên màn (pointer-events auto) để cử chỉ
 * Visualizer phía dưới không chạy giữa ván.
 */
const TPL_GAMEPLAY_ARROW_STAGE = `
                <div id="gameplay-arrow-stage" class="gameplay-arrow-stage">
                    <div class="gameplay-arrow-board">
                        <div class="gameplay-arrow-hud">
                            <span class="gameplay-arrow-hud-chip"><span data-i18n="gameplayArrow.hud.level">${t('gameplayArrow.hud.level')}</span> <span id="gameplay-arrow-level">1</span></span>
                            <span class="gameplay-arrow-hud-chip gameplay-arrow-hud-chip--speed" id="gameplay-arrow-speed">×1.00</span>
                        </div>
                        <div id="gameplay-arrow-track" class="gameplay-arrow-track">
                            <div class="gameplay-arrow-track-groove"></div>
                            <div id="gameplay-arrow-track-fill" class="gameplay-arrow-track-fill"></div>
                            <div id="gameplay-arrow-zone" class="gameplay-arrow-zone"></div>
                            <div id="gameplay-arrow-target" class="gameplay-arrow-target"></div>
                            <div id="gameplay-arrow-cursor-rail" class="gameplay-arrow-cursor-rail">
                                <div class="gameplay-arrow-cursor"></div>
                            </div>
                        </div>
                        <div id="gameplay-arrow-strip" class="gameplay-arrow-strip"></div>
                    </div>

                    <div class="gameplay-arrow-controls">
                        <div id="gameplay-arrow-pad" class="gameplay-arrow-pad">
                            <div class="gameplay-arrow-pad-ring"></div>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="0">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="1">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="2">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="3">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="4">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="5">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="6">${iconSvg('arrow-sm-up')}</button>
                            <button type="button" class="gameplay-arrow-pad-btn" data-arrow-dir="7">${iconSvg('arrow-sm-up')}</button>
                            <div class="gameplay-arrow-pad-hub"></div>
                        </div>
                        <button type="button" id="btn-gameplay-arrow-commit" class="gameplay-arrow-commit">
                            <span class="gameplay-arrow-commit-label" data-i18n="gameplayArrow.commit.label">${t('gameplayArrow.commit.label')}</span>
                        </button>
                    </div>
                </div>
`;

/**
 * 1 dải vòng tròn mũi tên — gọi mỗi lần mở vòng chơi mới (event/workflow/gameplay-arrow.js::_beginRound()). Hướng hiển
 * thị qua `data-dir` (CSS xoay mũi tên), vòng đỏ qua `data-reversed`, trạng thái nhập qua `data-state` (core-ui đổi sau).
 * Chỉ nội suy số nguyên/boolean do core sinh — không có dữ liệu người dùng, không cần escape.
 * @param {{ dir: number, reversed: boolean }[]} arrows
 */
function renderGameplayArrowStripHtml(arrows) {
    return arrows.map((arrow, index) =>
        `<div class="gameplay-arrow-cell" data-index="${index}" data-dir="${arrow.dir}" data-reversed="${arrow.reversed}" data-state="pending" style="animation-delay:${index * 40}ms">` +
        `<span class="gameplay-arrow-cell-glyph">${iconSvg('arrow-sm-up')}</span>` +
        `</div>`
    ).join('');
}
