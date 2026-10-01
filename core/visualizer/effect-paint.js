/**
 * core/visualizer/effect-paint.js — Màu + độ blur của effect ĐANG CHẠY, đọc theo Custom Effect của frame vẽ hiện tại.
 *
 * [DỜI — 01/10/2026, Giang: "move những hàm không liên quan ra khỏi audio-analysis"] Từ core/audio-analysis.js, logic
 * GIỮ NGUYÊN. Cả 2 hàm là HOT PATH DI SẢN được miễn trừ (readme/core-legacy-audit.md): tự đọc `frameEffectConfig`
 * (appState) và `getComputedColor` tự đọc hue từ kho `audioAnalysis` (service/audio-analysis.js) — khoảng 70 nơi gọi
 * mỗi frame, truyền tham số thì phải sửa toàn bộ, nên giữ cách đọc cũ.
 *
 * Phụ thuộc lúc CHẠY (không phải lúc nạp): getActiveEffectConfig (core/custom-effect.js), interpolateColor
 * (core/color-utils.js), audioAnalysis (service/audio-analysis.js).
 */

/** Màu riêng theo TỪNG effect (cfg.customEffect[cfg.type]) — không còn 1 mode màu chung
 * cho toàn app, xem core/custom-effect.js::getActiveEffectConfig(). */
function getComputedColor(i, totalLength, dataValue) {
    // SỬA (28/09/2026, Phase 2 dọn visualizer) — đọc config effect ĐÃ RESOLVE SẴN cho frame vẽ hiện tại
    // (`frameEffectConfig`, workflowVisualizerRender._tickDraw() ghi đầu frame, xoá về null cuối frame)
    // thay vì gọi getActiveEffectConfig() MỖI LẦN — hàm đó tạo object mới (2 spread + forEach + delete)
    // mỗi lời gọi, nhân với hàng trăm lời gọi/frame. Ngoài frame vẽ (init scene, UI...) giá trị là
    // null -> rơi về getActiveEffectConfig() như cũ, luôn đọc config MỚI NHẤT. Hàm hot-path di sản
    // (miễn trừ, core-legacy-audit.md) — chỉ đổi NGUỒN đọc, không đổi logic.
    const ec = appState.get('frameEffectConfig') || getActiveEffectConfig(); // core/custom-effect.js
    // MỚI (Giang báo "THREE.Color: Alpha component of hsla(...) will be ignored" khi ở connector):
    // `fillNoAlpha` = CÙNG màu với `fill` nhưng KHÔNG có alpha — dành riêng cho nơi đưa màu vào
    // THREE.Color (connector). Parser hsla() của THREE r128 luôn cảnh báo (mỗi lần gọi, kể cả mỗi
    // frame) khi alpha < 1 dù bỏ qua alpha; canvas 2D vẫn dùng `fill` (alpha 0.9) như cũ. 2 mode
    // còn lại vốn không có alpha nên `fillNoAlpha` === `fill`.
    if (ec.mode === 'dynamic') { const c = interpolateColor(ec.dynA, ec.dynB, i / totalLength); return { fill: c, fillNoAlpha: c, glow: c }; }
    else if (ec.mode === 'gradient') {
        let baseHue = (audioAnalysis.hueOffset() + (i / totalLength) * 240) % 360; // SỬA 01/10/2026: globalHueOffset dời vào service/audio-analysis.js (hot path miễn trừ — vẫn tự đọc như trước)
        let finalHue = (baseHue + (dataValue / 255) * 80) % 360;
        // FIX (16/09/2026, Giang báo "THREE.Color: Unknown color hsla(...)"): saturation/
        // lightness PHẢI là số nguyên — parser hsl()/hsla() của THREE.Color (r128) chỉ nhận
        // %-value dạng \d+ (không hỗ trợ thập phân), trong khi hue thì hỗ trợ thập phân bình
        // thường. Trước đây 2 giá trị này là số thập phân (vd "83.764...%") -> khớp regex
        // thất bại toàn bộ -> "Unknown color" (không chỉ dừng ở mức cảnh báo "alpha ignored"
        // như khi chúng tình cờ là số nguyên). Math.round() ở đây không ảnh hưởng canvas 2D
        // (fillStyle vẫn nhận hsla() bình thường, sai khác <1% không nhận ra được bằng mắt).
        let lightness = Math.round(40 + (dataValue / 255) * 30);
        let saturation = Math.round(70 + (dataValue / 255) * 30);
        return { fill: `hsla(${finalHue}, ${saturation}%, ${lightness}%, 0.9)`, fillNoAlpha: `hsl(${finalHue}, ${saturation}%, ${lightness}%)`, glow: `hsl(${finalHue}, 100%, ${lightness + 15}%)` };
    } else return { fill: ec.solidColor, fillNoAlpha: ec.solidColor, glow: ec.solidColor };
}

/** Cường độ blur/glow effect ĐANG CHẠY, quy đổi 0-1 cho `perf.blurMult` cũ — 0 nếu tắt. */
function getActiveBlurMult() {
    const ec = appState.get('frameEffectConfig') || getActiveEffectConfig(); // xem ghi chú ở getComputedColor()
    return ec.blurEnabled ? ec.blurIntensity / 100 : 0;
}
