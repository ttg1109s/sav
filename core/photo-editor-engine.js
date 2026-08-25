/**
 * core/photo-editor-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md), hàm xử lý
 * pixel cho canvas Edit của modal xem ảnh Photo (event/workflow/image-edit.js).
 *
 * PORT từ prototype "Lumina Pro" (Giang cung cấp, file HTML độc lập) — chỉ lấy phần `Engine`/
 * `CropTool`/... (xử lý `ImageData` thuần, không đụng DOM ngoài chính canvas nhận vào), KHÔNG lấy
 * UI/header/footer/CSS/font riêng của prototype đó (đã thảo luận: nhét nguyên `<body>` sẽ vỡ UI
 * modal xem ảnh sẵn có — xem docstring `ensureEditSessionReady()`, event/workflow/image-edit.js).
 *
 * Rule 2 — không đọc `appState`, không giữ state module-level — mọi tham số (params điều chỉnh,
 * canvas nguồn...) đều nhận qua tham số hàm, Workflow tự giữ.
 * Rule 3 — không gọi core nào khác, không gọi API thư viện ngoài nào (thuần Canvas 2D API chuẩn
 * trình duyệt — xem thảo luận "chỗ decode-in/decode-out" không phụ thuộc thư viện có lộ ra hay
 * không).
 *
 * BẢN ĐẦU (31/07/2026) — CHỈ có `applyColorAdjustments()`/`applySharpenFilter()` (nhóm "Điều
 * chỉnh") + `decodeImageToCanvas()` (dựng canvas ban đầu). Crop/Draw/Text/Tách nền (nhóm "Công cụ"/
 * "Vẽ"/"Tách nền" trong Generic Drawer grid) CHƯA port — hiện placeholder "chưa khả dụng" trong
 * lưới, xem `_buildEditToolGridHtml()`.
 */

/**
 * Decode 1 Blob ảnh thành 1 `<canvas>` MỚI, tự giới hạn kích thước tối đa mỗi chiều (giữ hiệu năng
 * di động — đúng khuôn Lumina Pro `MAX = 2000`). Dùng lúc vào Edit mode để dựng `baseCanvas` ban
 * đầu từ ảnh gốc.
 * @param {Blob} blob
 * @param {number} [maxDimension=2000]
 * @returns {Promise<HTMLCanvasElement>}
 */
function decodeImageToCanvas(blob, maxDimension = 2000) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxDimension || h > maxDimension) {
                const ratio = Math.min(maxDimension / w, maxDimension / h);
                w = Math.round(w * ratio); h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
    });
}

/**
 * Đọc pixel từ 1 canvas nguồn, áp brightness/contrast/saturation/temperature/tint, TRẢ VỀ
 * `ImageData` MỚI — KHÔNG tự vẽ lên canvas nào (nơi gọi tự `putImageData()` vào canvas đích, giữ
 * hàm thuần input->output, Rule 1 — đúng 1 việc: tính pixel, không quyết định vẽ ở đâu).
 * @param {HTMLCanvasElement} srcCanvas
 * @param {{brightness:number, contrast:number, saturation:number, temperature:number, tint:number}} params
 *        mỗi giá trị -100..100, 0 = không đổi.
 * @returns {ImageData}
 */
function applyColorAdjustments(srcCanvas, params) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const imageData = srcCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const p = params;
    const isNoFilter = p.brightness === 0 && p.contrast === 0 && p.saturation === 0 && p.temperature === 0 && p.tint === 0;
    if (isNoFilter) return imageData;

    const contrastFactor = (259 * (p.contrast + 255)) / (255 * (259 - p.contrast));
    const temp = p.temperature, tint = p.tint, sat = p.saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // bỏ qua pixel trong suốt
        let r = data[i], g = data[i + 1], b = data[i + 2];

        // Temperature (lệch đỏ/lam) & Tint (lệch xanh lá/tím)
        r = Math.min(255, Math.max(0, r + temp + tint));
        g = Math.min(255, Math.max(0, g + tint));
        b = Math.min(255, Math.max(0, b - temp - tint));

        // Brightness & Contrast
        r = contrastFactor * (r - 128) + 128 + p.brightness;
        g = contrastFactor * (g - 128) + 128 + p.brightness;
        b = contrastFactor * (b - 128) + 128 + p.brightness;

        // Saturation (công thức Luma xấp xỉ)
        if (sat !== 0) {
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            r = luma + (r - luma) * (1 + sat);
            g = luma + (g - luma) * (1 + sat);
            b = luma + (b - luma) * (1 + sat);
        }

        data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
        data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    return imageData;
}

/**
 * Sharpen (convolution 3x3) — nhận `ImageData` (thường là kết quả `applyColorAdjustments()` ở
 * trên), trả `ImageData` MỚI đã sharpen. Tách riêng khỏi `applyColorAdjustments()` (Rule 1 — mỗi
 * hàm 1 việc) — nơi gọi tự nối 2 hàm nếu cần cả 2 cùng lúc.
 * @param {ImageData} srcImageData
 * @param {number} amount - 0-100, `<= 0` trả nguyên bản không đổi.
 * @returns {ImageData}
 */
function applySharpenFilter(srcImageData, amount) {
    if (amount <= 0) return srcImageData;
    const w = srcImageData.width, h = srcImageData.height;
    const s = srcImageData.data;
    const dst = new ImageData(w, h);
    const d = dst.data;
    const mix = amount / 100;

    // Kernel sharpen 3x3 đơn giản: [0,-1,0, -1,5,-1, 0,-1,0]
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            if (s[i + 3] === 0) continue;
            for (let c = 0; c < 3; c++) {
                const val = 5 * s[i + c] - s[i - 4 + c] - s[i + 4 + c] - s[i - w * 4 + c] - s[i + w * 4 + c];
                const clamped = val < 0 ? 0 : val > 255 ? 255 : val;
                d[i + c] = s[i + c] + (clamped - s[i + c]) * mix;
            }
            d[i + 3] = s[i + 3];
        }
    }
    // Giữ nguyên viền ngoài (tránh artifact do kernel không đủ hàng xóm ở mép). FIX (bug có từ
    // trước) — vòng lặp chính CHỈ xử lý x trong [1, w-2] (bỏ qua 2 cột trái/phải), nhưng đoạn giữ
    // viền TRƯỚC ĐÂY chỉ copy 2 HÀNG trên/dưới, quên hẳn 2 CỘT trái/phải — 2 cột đó bị bỏ trống ở
    // `new ImageData()` (mặc định trong suốt hoàn toàn), tạo 1 viền dọc trong suốt/đen rộng 1px
    // dọc 2 mép trái/phải ảnh mỗi khi bật Sharpen. Thêm 2 vòng lặp copy cột 0 và cột w-1 (theo y).
    for (let i = 0; i < w * 4; i++) { d[i] = s[i]; d[(h - 1) * w * 4 + i] = s[(h - 1) * w * 4 + i]; }
    for (let y = 0; y < h; y++) {
        const left = y * w * 4, right = (y * w + w - 1) * 4;
        for (let c = 0; c < 4; c++) { d[left + c] = s[left + c]; d[right + c] = s[right + c]; }
    }
    return dst;
}

/**
 * Cắt 1 vùng chữ nhật ra khỏi canvas nguồn, trả về canvas MỚI đúng kích thước vùng cắt — dùng khi
 * "Áp dụng" tool Crop. Toạ độ/kích thước LÀM TRÒN sẵn ở nơi gọi (Workflow) trước khi truyền vào —
 * hàm này không tự làm tròn để tránh lệch 1px giữa toạ độ Workflow đang vẽ overlay và toạ độ THẬT
 * SỰ dùng để cắt.
 * @param {HTMLCanvasElement} srcCanvas
 * @param {{x:number,y:number,w:number,h:number}} rect - toạ độ nguyên (px), theo hệ toạ độ srcCanvas.
 * @returns {HTMLCanvasElement}
 */
function cropCanvas(srcCanvas, rect) {
    const out = document.createElement('canvas');
    out.width = rect.w; out.height = rect.h;
    out.getContext('2d').drawImage(srcCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    return out;
}

/**
 * Vẽ chồng `overlayCanvas` LÊN TRÊN `baseCanvas` (cùng kích thước) theo 1 composite operation cho
 * trước, trả về canvas MỚI đã gộp — dùng khi "Áp dụng" tool Vẽ (gộp nét cọ/tẩy từ `interactCanvas`
 * vào ảnh gốc) — KHÔNG mutate 2 canvas nhận vào (Rule 1 — hàm thuần input->output).
 * @param {HTMLCanvasElement} baseCanvas
 * @param {HTMLCanvasElement} overlayCanvas
 * @param {GlobalCompositeOperation} [compositeOp='source-over'] - 'source-over' (vẽ đè, cọ) hoặc
 *        'destination-out' (đục thủng, tẩy).
 * @returns {HTMLCanvasElement}
 */
function mergeCanvases(baseCanvas, overlayCanvas, compositeOp = 'source-over') {
    const out = document.createElement('canvas');
    out.width = baseCanvas.width; out.height = baseCanvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.globalCompositeOperation = compositeOp;
    ctx.drawImage(overlayCanvas, 0, 0);
    return out;
}

/**
 * Tách nền màu trơn ("Tách nền"/Magic cutout) — quét TOÀN BỘ ảnh, pixel nào lệch màu tại điểm chạm
 * (`startX`,`startY`) trong khoảng `tolerance` thì đặt alpha=0. Thuật toán chromakey đơn giản (KHÔNG
 * phải flood-fill đệ quy theo vùng liền kề — quét toàn ảnh nhanh hơn hẳn trên di động, đúng khuôn
 * Lumina Pro) — phù hợp nền TRƠN 1 màu, không phù hợp nền có gradient/hoạ tiết phức tạp.
 * @param {HTMLCanvasElement} canvas
 * @param {number} startX @param {number} startY - toạ độ điểm chạm, hệ toạ độ canvas (nguyên).
 * @param {number} tolerance - 0-255-ish, độ lệch màu tối đa vẫn tính là "cùng vùng".
 * @returns {ImageData|null} `null` nếu điểm chạm nằm ngoài canvas hoặc đã trong suốt sẵn.
 */
function applyMagicCutout(canvas, startX, startY, tolerance) {
    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startY < 0 || startX >= w || startY >= h) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const targetPos = (startY * w + startX) * 4;
    const tR = data[targetPos], tG = data[targetPos + 1], tB = data[targetPos + 2];
    if (data[targetPos + 3] === 0) return null; // điểm chạm đã trong suốt sẵn — không có gì để tách

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const diff = Math.max(Math.abs(data[i] - tR), Math.abs(data[i + 1] - tG), Math.abs(data[i + 2] - tB));
        if (diff <= tolerance) data[i + 3] = 0;
    }
    return imageData;
}

/**
 * "Nướng" 1 đoạn văn bản thẳng lên canvas TẠI ĐÚNG vị trí — mutate `canvas` nhận vào TRỰC TIẾP
 * (KHÁC các hàm khác ở file này — chữ là thao tác "vẽ thêm 1 lần", không có ý nghĩa giữ bản canvas
 * cũ để so sánh lại, nên không cần tách input/output riêng, đỡ 1 lần copy canvas tốn kém trên ảnh
 * lớn). Hỗ trợ xuống dòng (`\n`), tự canh giữa each dòng quanh (x,y).
 * @param {HTMLCanvasElement} canvas
 * @param {string} text @param {number} x @param {number} y - tâm khối chữ, hệ toạ độ canvas.
 * @param {number} fontSizePx @param {string} color
 */
function drawTextOnCanvas(canvas, text, x, y, fontSizePx, color) {
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSizePx}px Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
        ctx.fillText(line, x, y + (i - (lines.length - 1) / 2) * fontSizePx * 1.2);
    });
}

/**
 * MỚI (layer Text/Shape, Giang yêu cầu "text/shape cần là layer chỉnh sửa lại được") — đo bounding
 * box CANVAS-PIXEL của 1 text layer, dùng cho hit-test chọn layer (KHÔNG vẽ gì lên canvas — hàm
 * THUẦN chỉ đọc `measureText()`, canvas nhận vào chỉ để mượn context đo, không bị mutate).
 * @param {HTMLCanvasElement} canvas
 * @param {{text: string, x: number, y: number, fontSizePx: number}} layer
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function measureTextLayerBoundingBox(canvas, layer) {
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${layer.fontSizePx}px Inter, sans-serif`;
    const lines = layer.text.split('\n');
    const w = Math.max(...lines.map(line => ctx.measureText(line).width));
    const h = lines.length * layer.fontSizePx * 1.2;
    return { x: layer.x - w / 2, y: layer.y - h / 2, w, h };
}

/**
 * MỚI (Shape layer — Giang yêu cầu "thêm shape/hoạ tiết, cũng là layer") — vẽ 1 shape (chữ nhật/
 * tròn/đường thẳng/mũi tên/đa giác) lên canvas. Hàm THUẦN — KHÔNG tự `clearRect()` (nơi gọi tự lo,
 * xem event/workflow/image-edit.js::_renderLayers() — vẽ NHIỀU layer liên tiếp lên CÙNG 1 canvas
 * layer riêng, clear đúng 1 lần trước khi vẽ cả loạt).
 * `x,y,w,h` là hệ toạ độ CANVAS-PIXEL, `w`/`h` CÓ THỂ ÂM (rect/circle: bounding box thường; line/
 * arrow: `w`/`h` là ĐỘ LỆCH từ điểm đầu (x,y) tới điểm cuối (x+w, y+h), không phải bounding box).
 * `fillColor: null` = không tô (chỉ viền).
 * @param {HTMLCanvasElement} canvas
 * @param {{shapeType: 'rect'|'circle'|'line'|'arrow'|'polygon', x: number, y: number, w: number, h: number, fillColor: string|null, strokeColor: string, strokeWidth: number, sides?: number}} shape
 */
function drawShapeOnCanvas(canvas, shape) {
    const ctx = canvas.getContext('2d');
    const x = Math.min(shape.x, shape.x + shape.w), y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w), h = Math.abs(shape.h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = shape.strokeWidth;
    ctx.strokeStyle = shape.strokeColor;
    ctx.fillStyle = shape.fillColor || 'transparent';

    if (shape.shapeType === 'rect') {
        if (shape.fillColor) ctx.fillRect(x, y, w, h);
        if (shape.strokeWidth > 0) ctx.strokeRect(x, y, w, h);
    } else if (shape.shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (shape.fillColor) ctx.fill();
        if (shape.strokeWidth > 0) ctx.stroke();
    } else if (shape.shapeType === 'line') {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
        ctx.stroke();
    } else if (shape.shapeType === 'arrow') {
        const ex = shape.x + shape.w, ey = shape.y + shape.h;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        const angle = Math.atan2(shape.h, shape.w);
        const headLen = Math.max(12, shape.strokeWidth * 4);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    } else if (shape.shapeType === 'polygon') {
        const cx = x + w / 2, cy = y + h / 2, radius = Math.min(w, h) / 2, sides = shape.sides || 5;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
            const px = cx + radius * Math.cos(a), py = cy + radius * Math.sin(a);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (shape.fillColor) ctx.fill();
        if (shape.strokeWidth > 0) ctx.stroke();
    }
}

/**
 * MỚI (Shape layer) — bounding box CANVAS-PIXEL của 1 shape layer, dùng cho hit-test chọn layer.
 * line/arrow không có "bề dày" hình học (chỉ 1 nét) — nới rộng thêm `strokeWidth` (tối thiểu 20px)
 * mỗi phía để vẫn chạm trúng được bằng ngón tay, không cần bấm trúng TUYỆT ĐỐI lên đường kẻ mảnh.
 * @param {{shapeType: string, x: number, y: number, w: number, h: number, strokeWidth: number}} shape
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function measureShapeLayerBoundingBox(shape) {
    const x = Math.min(shape.x, shape.x + shape.w), y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w), h = Math.abs(shape.h);
    if (shape.shapeType !== 'line' && shape.shapeType !== 'arrow') return { x, y, w, h };
    const pad = Math.max(20, shape.strokeWidth * 2);
    return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
}
