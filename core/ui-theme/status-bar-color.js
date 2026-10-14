/**
 * core/ui-theme/status-bar-color.js — màu status bar iOS (và nền preloader) khớp nền THẬT của Morphin.
 *
 * Không dùng viewport-fit=cover nên app không vẽ xuống dưới status bar; iOS tô vùng đó bằng nền trang (nền `<body>` đẩy lên
 * canvas). Nền Morphin thật là ảnh/gradient trong `#app-bg-image` (core/color-utils.js::updatePlaylistBg()), nên cần 1 MÀU ĐẶC
 * đại diện cho mép trên của nền rồi tô lên `<body>`/`theme-color`. Chọn nguồn màu: computeStatusBarColorSource()
 * (core/theme-background.js) + Workflow (event/workflow/ui-theme.js::syncStatusBarColor()).
 */

/** THUẦN — màu của `linear-gradient(135deg, from, to)` tại GIỮA MÉP TRÊN khung `viewportW × viewportH`: vị trí trên trục
 * gradient t = 0.5 − H / (2·(W+H)) (≈0.16 với màn dọc điện thoại). Hex sai định dạng -> ''.
 * @param {string} gradientFrom '#rrggbb' hoặc '#rgb' @param {string} gradientTo @param {number} viewportW @param {number} viewportH
 * @returns {string} 'rgb(r, g, b)' hoặc '' */
function computeGradientTopEdgeColor(gradientFrom, gradientTo, viewportW, viewportH) {
    const parseHex = (hex) => {
        if (typeof hex !== 'string') return null;
        const m = hex.trim().replace('#', '');
        const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
        if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
        return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
    };
    const from = parseHex(gradientFrom);
    const to = parseHex(gradientTo);
    if (!from || !to || !(viewportW > 0) || !(viewportH > 0)) return '';
    const t = 0.5 - viewportH / (2 * (viewportW + viewportH));
    const mix = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
}

/** BẤT ĐỒNG BỘ — màu trung bình của dải mép trên (6% chiều cao nhìn thấy) của ảnh nền, mô phỏng `background-size: cover;
 * background-position: center` trong khung viewport, nhân (1 − overlayAlpha) cho khớp lớp phủ đen của nền. Ảnh là blob: URL
 * cùng origin nên canvas không bị "tainted". Chờ ảnh bằng `img.decode()` (không gắn onload/onerror). Mọi lỗi -> '' (không reject).
 * @param {string} imageUrl @param {number} viewportW @param {number} viewportH @param {number} overlayAlpha
 * @returns {Promise<string>} 'rgb(r, g, b)' hoặc '' */
async function sampleImageTopEdgeColor(imageUrl, viewportW, viewportH, overlayAlpha) {
    if (!imageUrl || !(viewportW > 0) || !(viewportH > 0)) return '';
    const img = new Image();
    img.src = imageUrl;
    const loaded = await img.decode().then(() => true, () => false); // ảnh hỏng/không tải được -> '' (im lặng)
    if (!loaded) return '';
    try {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw || !ih) return '';
        const scale = Math.max(viewportW / iw, viewportH / ih); // cover
        const visibleW = viewportW / scale, visibleH = viewportH / scale; // phần ảnh gốc lọt vào khung
        const srcX = (iw - visibleW) / 2, srcY = (ih - visibleH) / 2; // position: center
        const stripH = Math.max(1, visibleH * 0.06);
        const SAMPLE_W = 16, SAMPLE_H = 4; // đủ nhỏ để rẻ, đủ lớn để trung bình không lệch theo 1 pixel
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_W; canvas.height = SAMPLE_H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, srcX, srcY, visibleW, stripH, 0, 0, SAMPLE_W, SAMPLE_H);
        const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
        let r = 0, g = 0, b = 0;
        const count = SAMPLE_W * SAMPLE_H;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
        const k = (1 - overlayAlpha) / count;
        return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
    } catch (e) {
        console.warn('[status-bar-color] Không lấy mẫu được màu mép trên của ảnh nền:', e);
        return '';
    }
}

/** DOM — tô status bar: `background-color` inline lên `<body>` + 3 thẻ `<meta name="theme-color">` (1 số bản Safari chỉ áp thẻ
 * có scope color-scheme). `color` rỗng -> gỡ inline (về `appBaseBg` của theme) + theme-color về #000000.
 * Chỉ gán `<body>`, KHÔNG gán `<html>`: `<html>` có nền thì body phải tự vẽ hộp nền, che mất các lớp z-index âm của Visualizer
 * (`#visualizer-solid-bg`, `#visual-bg-image`, lớp motion — assets/css/base.css).
 * @param {string} color 'rgb(...)'/'#rrggbb' hoặc '' để gỡ */
function applyStatusBarColor(color) {
    document.documentElement.classList.remove('app-boot-statusbar'); // màu tạm lúc boot (service/boot-preloader.js) hết vai trò từ lần tô thật đầu tiên
    document.body.style.backgroundColor = color;
    const themeColorValue = color || '#000000';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', themeColorValue));
}

/** DOM — đổi ngay nền preloader đang hiện (vd boot phát hiện media nền đã mất -> về fallback). Preloader đã gỡ -> bỏ qua.
 * @param {string} background chuỗi CSS `background` */
function applyBootPreloaderBackground(background) {
    const preloaderEl = document.getElementById('app-preloader');
    if (preloaderEl) preloaderEl.style.background = background;
}
