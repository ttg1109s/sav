/**
 * core/ui-theme/status-bar-color.js — MỚI (21/09/2026, Giang báo "theme Morphin: status bar, nav, ô search màu không
 * đồng bộ" — status bar (vùng đồng hồ/pin phía trên cùng, do iOS vẽ) là mảng xanh navy slate-900 trong khi cả app
 * phía dưới là nền cam của Morphin).
 *
 * NGUYÊN NHÂN — viewport-fit=cover ĐÃ BỎ HẲN (xem <meta viewport> index.html), nên app KHÔNG vẽ được xuống dưới status
 * bar; vùng đó iOS tự tô bằng nền của trang (nền `<body>` được đẩy lên canvas). Với Morphin, nền đó là `appBaseBg` = slate-900 ĐẶC
 * (core/ui-theme/morphin.js) — trong khi nền THẬT người dùng thấy là ảnh/gradient vẽ trong `#app-bg-image`
 * (core/color-utils.js::updatePlaylistBg()). CSS thuần không nối được 2 thứ này (nền ảnh/gradient do người dùng chọn
 * lúc chạy) nên cần tính 1 MÀU ĐẶC đại diện cho "mép trên" của nền thật rồi tô lên `<body>`/`theme-color` (CHỈ body, không `<html>` — xem applyStatusBarColor()).
 *
 * 3 hàm, MỖI hàm ĐÚNG 1 việc (Rule 1) — việc CHỌN hàm nào theo theme/mode (gradient hay ảnh hay không có nền) là của
 * Workflow (event/workflow/ui-theme.js::syncStatusBarColor()), không nằm ở đây. Rule 2: không đọc appState/appConfig,
 * mọi đầu vào qua tham số. Rule 3: 3 hàm này KHÔNG gọi nhau và không gọi core khác (tự parse hex nội bộ).
 *
 * NẠP SAU: (không phụ thuộc gì). NẠP TRƯỚC: event/workflow/ui-theme.js.
 */

/** THUẦN — màu của `linear-gradient(135deg, from, to)` (đúng gradient `updatePlaylistBg()` vẽ ở nhánh themeMode
 * 'gradient') tại GIỮA MÉP TRÊN của khung `viewportW × viewportH`. Với góc 135° vị trí dọc trục gradient của điểm giữa
 * mép trên là t = 0.5 − H / (2·(W+H)) (≈0.16 với màn dọc điện thoại — mép trên chỉ đi từ `from` tới ~1/3 đường sang
 * `to`, KHÔNG chạm `to`). "Solid" của Settings = 2 màu cùng giá trị nên ra đúng màu đó. Hex sai định dạng -> trả ''.
 * @param {string} gradientFrom  '#rrggbb' hoặc '#rgb'
 * @param {string} gradientTo    '#rrggbb' hoặc '#rgb'
 * @param {number} viewportW
 * @param {number} viewportH
 * @returns {string} 'rgb(r, g, b)' hoặc '' nếu đầu vào không hợp lệ */
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

/** BẤT ĐỒNG BỘ — màu trung bình của DẢI MÉP TRÊN (6% chiều cao nhìn thấy) của ảnh nền, sau khi mô phỏng đúng
 * `background-size: cover; background-position: center` trong khung `viewportW × viewportH` (giống `#app-bg-image`), rồi
 * nhân với (1 − overlayAlpha) để khớp lớp phủ đen 40% mà `updatePlaylistBg()` luôn chồng lên ảnh. Ảnh nền là blob: URL
 * cùng origin nên canvas không bị "tainted". Mọi lỗi (ảnh hỏng/không tải được/canvas bị chặn) -> resolve '' (không bao
 * giờ reject — nơi gọi coi '' là "không tính được, dùng màu nền mặc định của theme").
 * @param {string} imageUrl
 * @param {number} viewportW
 * @param {number} viewportH
 * @param {number} overlayAlpha  độ đục lớp phủ đen (0.4)
 * @returns {Promise<string>} 'rgb(r, g, b)' hoặc '' */
function sampleImageTopEdgeColor(imageUrl, viewportW, viewportH, overlayAlpha) {
    return new Promise((resolve) => {
        if (!imageUrl || !(viewportW > 0) || !(viewportH > 0)) { resolve(''); return; }
        const img = new Image();
        img.onload = () => {
            try {
                const iw = img.naturalWidth, ih = img.naturalHeight;
                if (!iw || !ih) { resolve(''); return; }
                const scale = Math.max(viewportW / iw, viewportH / ih); // cover
                const visibleW = viewportW / scale, visibleH = viewportH / scale; // phần ảnh gốc lọt vào khung
                const srcX = (iw - visibleW) / 2, srcY = (ih - visibleH) / 2;   // position: center
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
                resolve(`rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`);
            } catch (e) {
                console.warn('[status-bar-color] Không lấy mẫu được màu mép trên của ảnh nền:', e);
                resolve('');
            }
        };
        img.onerror = () => resolve('');
        img.src = imageUrl;
    });
}

/** DOM — tô màu status bar: gán `background-color` inline lên `<body>` (KHÔNG gán lên `<html>`) + cập nhật cả 3 thẻ
 * `<meta name="theme-color">` (index.html khai 3 thẻ, 1 số bản Safari chỉ áp thẻ có scope color-scheme). `color` rỗng ->
 * gỡ inline (trả về màu nền theo class `appBaseBg` của theme đang chạy) + theme-color về #000000 như index.html khai gốc.
 *
 * SỬA (21/09/2026, Giang báo "mất video/photo player") — bản trước gán CẢ `<html>` lẫn `<body>`, và đó là LỖI: khi `<html>` KHÔNG có
 * nền, nền của `<body>` được đẩy lên canvas (propagation) và KHÔNG vẽ thành hộp riêng của body; nhưng ngay khi `<html>` có nền inline,
 * body phải TỰ vẽ nền của nó — mà body nằm TRÊN mọi phần tử z-index ÂM trong root stacking context, nên che mất `#visualizer-solid-bg`
 * (z -3), `#visual-bg-image` (z -2), lớp motion (z -1) = nền video/ảnh của Visualizer (assets/css/base.css). Chỉ gán `<body>` giữ đúng cơ chế
 * cũ (body class `appBaseBg` vốn cũng đi qua propagation): canvas nhận màu -> status bar iOS đổi màu, các lớp z âm vẫn hiện.
 * @param {string} color  'rgb(...)'/'#rrggbb' hoặc '' để gỡ */
function applyStatusBarColor(color) {
    document.body.style.backgroundColor = color;
    const themeColorValue = color || '#000000';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', themeColorValue));
}
