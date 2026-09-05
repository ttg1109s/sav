/**
 * core/visualizer/groups/bar/cascade.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'cascade'
 * tách riêng khỏi `core/visualizer/types/bar.js` cũ (trước đây gộp chung với 'mirror'). Nội dung
 * hàm GIỮ NGUYÊN 100%. Thác đổ — giữ nguyên cách vẽ của visual "synthesia" cũ (các "phím" rơi
 * xuống đáy màn hình theo tần số). Độ dày mỗi phím tự tính theo độ rộng slot của bố cục N phím
 * (cascadeKeyCount, tuỳ chỉnh), KHÔNG còn phụ thuộc setting "Độ dày thanh" (setting đó giờ chỉ
 * dùng cho Black Hole).
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig (rà soát Rule 3) — Workflow
 * (`_tickBar()`, event/workflow/visualizer-render.js) tự gom state rồi gọi, tự resolve màu qua
 * `getComputedColor()` rồi gọi `paintBarRects()` (core/visualizer/groups/bar/common.js) cho từng
 * lô rect trả về.
 *
 * NẠP SAU: core/visualizer/groups/bar/common.js (không phụ thuộc hàm, chỉ để đọc thứ tự nhất quán).
 */

/**
 * Tính khung hình BAR CASCADE — THUẦN, không side-effect, không đọc appState/getActiveEffectConfig.
 * @returns {{colorArgs:number[], shadowRect:object, capRect:object}[]}
 */
function computeBarCascadeFrame(cfg, canvasWidth, canvasHeight, dpr, vizDataArray) {
    const scaledMinH = cfg.minH * dpr;
    const keysY = canvasHeight;
    const numKeys = cfg.cascadeKeyCount;
    const keyWidth = canvasWidth / numKeys;
    const keys = [];
    for (let i = 0; i < numKeys; i++) {
        const val = vizDataArray[i + 5] || 0;
        const finalHeight = scaledMinH + ((val / 255) * cfg.maxH * dpr);
        const kx = i * keyWidth;
        const kw = keyWidth * 0.8;
        const cx = kx + kw / 2;
        keys.push({
            colorArgs: [i, numKeys, val],
            shadowRect: { x: cx - kw / 2, y: keysY - finalHeight, w: kw, h: finalHeight, plain: true, alpha: cfg.cascadeBaseAlpha },
            capRect: { x: cx - kw / 2, y: keysY - finalHeight, w: kw, h: Math.max(5, finalHeight * 0.1), cornerR: 2 * dpr },
        });
    }
    return keys;
}
