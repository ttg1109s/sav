/**
 * core/visualizer/effect-paint.js — Màu + độ blur của effect đang chạy. Mỗi LUẬT MÀU là 1 core thuần riêng (Rule 1 — dynamic /
 * gradient HSL / bảng 7 màu / solid là các thuật toán khác nhau): `resolveEffectColorRule()` trả khoá luật, Workflow
 * (event/workflow/visualizer-render.js, map VIZ_COLOR_RULE_BY_KEY) chọn luật 1 lần mỗi frame rồi các hàm vẽ gọi
 * `workflowVisualizerRender.colorAt(i, total, value)`. Mọi luật trả cùng dạng `{fill, fillNoAlpha, glow}`; `fillNoAlpha` dành cho
 * THREE.Color (r128 cảnh báo mỗi lần gặp alpha trong hsla()).
 *
 * SỬA 20/10/2026 — thay `getComputedColor()`/`getActiveBlurMult()` (tự đọc appState + gọi core khác + rẽ luật trong 1 hàm).
 *
 * NẠP SAU: không phụ thuộc gì.
 */

/** Khoá luật màu của effect: 'solid' | 'dynamic' | 'gradient' (dải hue HSL mặc định) | 'palette' (gradient + bảng 7 màu tuỳ chỉnh).
 * Mode lạ -> 'solid' (đúng nhánh mặc định cũ). @param {{mode:string, gradientPaletteRgb:object[]|null}} ec @returns {string} */
function resolveEffectColorRule(ec) {
    const gradientRule = ec.gradientPaletteRgb ? 'palette' : 'gradient';
    return ec.mode === 'dynamic' ? 'dynamic' : (ec.mode === 'gradient' ? gradientRule : 'solid');
}

/** 1 màu cho cả 3 field — luật solid (màu cấu hình) và dynamic (Workflow nội suy trước bằng interpolateColor(), core/color-utils.js).
 * @param {string} color @returns {{fill:string, fillNoAlpha:string, glow:string}} */
function computeUniformEffectColor(color) {
    return { fill: color, fillNoAlpha: color, glow: color };
}

/** Luật gradient mặc định — dải hue liên tục: hue = hueOffset + vị trí × 240° + dataValue (0-255) × 80°; saturation/lightness
 * tăng theo dataValue. saturation/lightness làm tròn nguyên (parser hsl() của THREE.Color r128 chỉ nhận % nguyên).
 * @param {number} hueOffset @param {number} position - 0-1 @param {number} dataValue @returns {{fill:string, fillNoAlpha:string, glow:string}} */
function computeGradientHslEffectColor(hueOffset, position, dataValue) {
    const baseHue = (hueOffset + position * 240) % 360;
    const hue = (baseHue + (dataValue / 255) * 80) % 360;
    const lightness = Math.round(40 + (dataValue / 255) * 30);
    const saturation = Math.round(70 + (dataValue / 255) * 30);
    return { fill: `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`, fillNoAlpha: `hsl(${hue}, ${saturation}%, ${lightness}%)`, glow: `hsl(${hue}, 100%, ${lightness + 15}%)` };
}

/** Luật bảng 7 màu — cùng trục hue với luật gradient mặc định, đổi hue thành vị trí trên vòng N màu rồi nội suy 2 màu kề nhau;
 * tối hơn khi dataValue nhỏ (hệ số 0.7-1). Dùng chung cho effect (computePaletteEffectColor) và cửa sổ Rain glass.
 * @param {{r:number,g:number,b:number}[]} paletteRgb @param {number} hueOffset @param {number} position - 0-1
 * @param {number} dataValue @returns {{r:number, g:number, b:number}} (số nguyên) */
function computeGradientPaletteRgb(paletteRgb, hueOffset, position, dataValue) {
    const hue = (((hueOffset + position * 240 + (dataValue / 255) * 80) % 360) + 360) % 360;
    const pos = (hue / 360) * paletteRgb.length;
    const k = Math.floor(pos) % paletteRgb.length;
    const f = pos - Math.floor(pos);
    const a = paletteRgb[k], b = paletteRgb[(k + 1) % paletteRgb.length];
    const shade = 0.7 + (dataValue / 255) * 0.3;
    return {
        r: Math.round((a.r + (b.r - a.r) * f) * shade),
        g: Math.round((a.g + (b.g - a.g) * f) * shade),
        b: Math.round((a.b + (b.b - a.b) * f) * shade),
    };
}

/** Màu effect từ 1 RGB của bảng 7 màu — fill alpha 0.9, quầng pha 35% trắng.
 * @param {{r:number,g:number,b:number}} rgb @returns {{fill:string, fillNoAlpha:string, glow:string}} */
function computePaletteEffectColor(rgb) {
    const glow = `rgb(${Math.round(rgb.r + (255 - rgb.r) * 0.35)}, ${Math.round(rgb.g + (255 - rgb.g) * 0.35)}, ${Math.round(rgb.b + (255 - rgb.b) * 0.35)})`;
    return { fill: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`, fillNoAlpha: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, glow };
}

/** Cường độ blur/glow của effect, quy đổi 0-1 (`frame.perf.blurMult`) — 0 nếu tắt.
 * @param {{blurEnabled:boolean, blurIntensity:number}} ec @returns {number} */
function computeEffectBlurMult(ec) {
    return ec.blurEnabled ? ec.blurIntensity / 100 : 0;
}
