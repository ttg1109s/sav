/**
 * core/photo-editor-engine.js — Core trình sửa ảnh Photo (event/workflow/image-edit.js): xử lý pixel (Điều chỉnh,
 * Sharpen, Crop, Vẽ, gộp/xuất), vẽ + đo layer (Text/Shape/Image) và hình học biến đổi layer (vị trí, tỉ lệ, góc xoay,
 * lật, độ mờ). Nhận mọi thứ qua tham số — canvas đích là tham số, không đọc appState, không gọi core khác, không
 * taskManager. Rẽ theo loại layer / loại hình / chế độ kéo do Workflow chọn bằng object map.
 *
 * LAYER — object giữ suốt phiên xem ảnh, chỉ "nướng" vào pixel lúc Lưu:
 *   chung: { id, type, visible, opacity (0..1), scale, rotation (độ), flipX, flipY }
 *   text : { text, x, y (TÂM), fontSizePx, color, fontWeight?, fontStyle?, fontFamily?, fontSource? }
 *   shape: { shapeType, x, y, w, h, fillColor, strokeColor, strokeWidth, sides } — line/arrow: (w,h) là độ lệch điểm cuối
 *   image: { source (canvas đã giải mã), x, y, w, h }
 * Biến đổi quay/co/lật quanh TÂM hộp bao của layer (`computeLayerFrame()`), vẽ giữa `beginLayerPaint()` /
 * `endLayerPaint()`; chạm chọn layer quy đổi ngược về hệ toạ độ gốc của layer (`findTopmostLayerAt()`).
 *
 * NẠP SAU: không phụ thuộc file nào lúc nạp.
 */

/** Chuỗi font mặc định của layer Text. */
const IMAGE_EDIT_DEFAULT_FONT_STACK = 'Inter, sans-serif';
/** Tỉ lệ biến đổi layer cho phép (kéo góc). */
const IMAGE_EDIT_LAYER_MIN_SCALE = 0.05;
const IMAGE_EDIT_LAYER_MAX_SCALE = 20;
/** Unsharp mask: bán kính làm mờ theo cạnh dài ảnh (ảnh lớn cần bán kính lớn để còn thấy sau khi thu về màn hình) và
 * độ mạnh tối đa (Sharpen 100). */
const IMAGE_EDIT_SHARPEN_RADIUS_DIVISOR = 450;
const IMAGE_EDIT_SHARPEN_MAX_STRENGTH = 3;

/**
 * Giải mã ảnh từ URL thành `<canvas>` MỚI, giới hạn cạnh dài (giữ hiệu năng di động). URL do Workflow tạo/thu hồi.
 * @param {string} url @param {number} [maxDimension=2000] @returns {Promise<HTMLCanvasElement>}
 */
async function decodeImageToCanvas(url, maxDimension = 2000) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, maxDimension / img.naturalWidth, maxDimension / img.naturalHeight);
    const w = Math.round(img.naturalWidth * ratio), h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas;
}

/**
 * Đọc pixel canvas nguồn, áp brightness/contrast/saturation/temperature/tint, trả `ImageData` MỚI (không vẽ lên canvas
 * nào). Mọi giá trị 0 -> trả nguyên pixel.
 * @param {HTMLCanvasElement} srcCanvas
 * @param {{brightness:number, contrast:number, saturation:number, temperature:number, tint:number}} params -100..100
 * @returns {ImageData}
 */
function applyColorAdjustments(srcCanvas, params) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const imageData = srcCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
    const data = imageData.data;
    const p = params;
    const isNoFilter = p.brightness === 0 && p.contrast === 0 && p.saturation === 0 && p.temperature === 0 && p.tint === 0;
    if (isNoFilter) return imageData;

    const contrastFactor = (259 * (p.contrast + 255)) / (255 * (259 - p.contrast));
    const temp = p.temperature, tint = p.tint, sat = p.saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // pixel trong suốt
        let r = data[i], g = data[i + 1], b = data[i + 2];

        // Temperature (lệch đỏ/lam) & Tint (lệch xanh lá/tím)
        r = Math.min(255, Math.max(0, r + temp + tint));
        g = Math.min(255, Math.max(0, g + tint));
        b = Math.min(255, Math.max(0, b - temp - tint));

        // Brightness & Contrast
        r = contrastFactor * (r - 128) + 128 + p.brightness;
        g = contrastFactor * (g - 128) + 128 + p.brightness;
        b = contrastFactor * (b - 128) + 128 + p.brightness;

        // Saturation (Luma xấp xỉ)
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
 * Sharpen bằng unsharp mask: làm mờ hộp (2 lượt ngang/dọc, bán kính theo cạnh dài ảnh) rồi cộng thêm phần chênh
 * `gốc - mờ` × độ mạnh. Kernel 3×3 cũ chỉ đổi 1px nên ảnh lớn thu về màn điện thoại gần như không thấy khác.
 * Kênh alpha giữ nguyên. `amount <= 0` -> trả nguyên bản.
 * @param {ImageData} srcImageData @param {number} amount - 0..100 @returns {ImageData}
 */
function applySharpenFilter(srcImageData, amount) {
    if (amount <= 0) return srcImageData;
    const w = srcImageData.width, h = srcImageData.height;
    const s = srcImageData.data;
    const radius = Math.max(1, Math.round(Math.max(w, h) / IMAGE_EDIT_SHARPEN_RADIUS_DIVISOR));
    const strength = (amount / 100) * IMAGE_EDIT_SHARPEN_MAX_STRENGTH;
    const span = radius * 2 + 1;
    const invArea = 1 / (span * span);
    // Chỉ số cột/hàng vào-ra cửa sổ trượt, kẹp mép — tính 1 lần, dùng cho mọi hàng/cột.
    const inX = new Int32Array(w), outX = new Int32Array(w), inY = new Int32Array(h), outY = new Int32Array(h);
    for (let x = 0; x < w; x++) { inX[x] = Math.min(w - 1, x + radius + 1); outX[x] = Math.max(0, x - radius); }
    for (let y = 0; y < h; y++) { inY[y] = Math.min(h - 1, y + radius + 1); outY[y] = Math.max(0, y - radius); }

    // Lượt ngang: TỔNG 3 kênh trên cửa sổ [x - r, x + r] (Uint16 — 255 × span còn xa trần).
    const rowLen = w * 3;
    const horizontal = new Uint16Array(rowLen * h);
    for (let y = 0; y < h; y++) {
        const row = y * w;
        let r = 0, g = 0, b = 0;
        for (let k = -radius; k <= radius; k++) {
            const i = (row + Math.min(w - 1, Math.max(0, k))) * 4;
            r += s[i]; g += s[i + 1]; b += s[i + 2];
        }
        for (let x = 0; x < w; x++) {
            const o = (row + x) * 3;
            horizontal[o] = r; horizontal[o + 1] = g; horizontal[o + 2] = b;
            const ia = (row + inX[x]) * 4, oa = (row + outX[x]) * 4;
            r += s[ia] - s[oa]; g += s[ia + 1] - s[oa + 1]; b += s[ia + 2] - s[oa + 2];
        }
    }

    // Lượt dọc theo hàng (bộ nhớ liền mạch): tổng theo cột của cả hàng = tổng hộp; ra ngay pixel kết quả
    // `gốc + (gốc - mờ) × độ mạnh` (Uint8ClampedArray tự kẹp 0..255 + làm tròn), alpha giữ nguyên.
    const dst = new ImageData(w, h);
    const d = dst.data;
    const colSum = new Uint32Array(rowLen);
    for (let k = -radius; k <= radius; k++) {
        const base = Math.min(h - 1, Math.max(0, k)) * rowLen;
        for (let j = 0; j < rowLen; j++) colSum[j] += horizontal[base + j];
    }
    for (let y = 0; y < h; y++) {
        const inBase = inY[y] * rowLen, outBase = outY[y] * rowLen;
        for (let x = 0; x < w; x++) {
            const j = x * 3, i = (y * w + x) * 4;
            d[i] = s[i] + (s[i] - colSum[j] * invArea) * strength;
            d[i + 1] = s[i + 1] + (s[i + 1] - colSum[j + 1] * invArea) * strength;
            d[i + 2] = s[i + 2] + (s[i + 2] - colSum[j + 2] * invArea) * strength;
            d[i + 3] = s[i + 3];
        }
        for (let j = 0; j < rowLen; j++) colSum[j] += horizontal[inBase + j] - horizontal[outBase + j];
    }
    return dst;
}

/**
 * Cắt 1 vùng chữ nhật (toạ độ nguyên, Workflow làm tròn sẵn qua getCropSessionRect()) ra canvas MỚI.
 * @param {HTMLCanvasElement} srcCanvas @param {{x:number,y:number,w:number,h:number}} rect @returns {HTMLCanvasElement}
 */
function cropCanvas(srcCanvas, rect) {
    const out = document.createElement('canvas');
    out.width = rect.w; out.height = rect.h;
    out.getContext('2d').drawImage(srcCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    return out;
}

/**
 * Vẽ `overlayCanvas` lên trên `baseCanvas` (cùng kích thước) theo composite operation, trả canvas MỚI (không mutate 2
 * canvas nhận vào) — "Áp dụng" tool Vẽ.
 * @param {HTMLCanvasElement} baseCanvas @param {HTMLCanvasElement} overlayCanvas
 * @param {GlobalCompositeOperation} [compositeOp='source-over'] - 'destination-out' cho Tẩy
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

/** Ảnh xuất cuối: kết quả Điều chỉnh + lớp layer gộp lên 1 canvas MỚI (không mutate 2 canvas nguồn).
 * @param {HTMLCanvasElement} renderCanvas @param {HTMLCanvasElement} layerCanvas @returns {HTMLCanvasElement} */
function flattenEditCanvases(renderCanvas, layerCanvas) {
    const out = document.createElement('canvas');
    out.width = renderCanvas.width; out.height = renderCanvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(renderCanvas, 0, 0);
    ctx.drawImage(layerCanvas, 0, 0);
    return out;
}

/** Xuất canvas ra JPEG. @param {HTMLCanvasElement} canvas @param {number} quality 0..1
 * @returns {Promise<Blob|null>} null = trình duyệt không xuất được */
function exportCanvasJpegBlob(canvas, quality) {
    return new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', quality); });
}

/** Xoá trắng toàn bộ canvas. @param {HTMLCanvasElement} canvas */
function clearCanvas(canvas) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Vẽ 1 đoạn nét tool Vẽ lên canvas nháp — Cọ `source-over` theo màu, Tẩy `destination-out` (đục thủng, lúc Áp dụng
 * hiện lại pixel gốc). Độ dày = giá trị slider × (cạnh dài ảnh / 1000), cùng cảm giác trên mọi cỡ ảnh.
 * @param {HTMLCanvasElement} canvas @param {{x:number,y:number}} fromPos @param {{x:number,y:number}} toPos
 * @param {{sizeRaw: string, color: string, isEraser: boolean, imageWidth: number, imageHeight: number}} brush
 */
function drawEditStroke(canvas, fromPos, toPos, brush) {
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = parseInt(brush.sizeRaw, 10) * (Math.max(brush.imageWidth, brush.imageHeight) / 1000);
    ctx.globalCompositeOperation = brush.isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brush.isEraser ? 'rgba(0,0,0,1)' : brush.color;
    ctx.stroke();
}

// ===================== Layer — tạo / sửa (thuần, trả object mới) =====================

/**
 * Layer Text từ khung chữ nổi: tâm khung (toạ độ client) quy về pixel canvas theo hình học object-fit; cỡ chữ 30 CSS px.
 * @param {number} id @param {string} text @param {string} color @param {{x:number,y:number}} clientCenter
 * @param {{rect: DOMRect, displayScale: number, offsetX: number, offsetY: number}} fit - measureEditCanvasFit()
 * @returns {object} layer text
 */
function buildTextLayerFromFloating(id, text, color, clientCenter, fit) {
    return {
        id, type: 'text', text, color,
        x: (clientCenter.x - fit.rect.left - fit.offsetX) / fit.displayScale,
        y: (clientCenter.y - fit.rect.top - fit.offsetY) / fit.displayScale,
        fontSizePx: 30 / fit.displayScale,
        visible: true, opacity: 1, scale: 1, rotation: 0, flipX: false, flipY: false, // trường biến đổi chung
    };
}

/**
 * Layer Shape mới giữa ảnh (40% bề ngang; line/arrow nằm ngang, các hình khác cao 30%).
 * @param {number} id @param {'rect'|'circle'|'line'|'arrow'|'polygon'} shapeType @param {number} canvasW @param {number} canvasH
 * @returns {object} layer shape
 */
function buildNewShapeLayer(id, shapeType, canvasW, canvasH) {
    const isLinear = shapeType === 'line' || shapeType === 'arrow';
    const hasFill = shapeType === 'rect' || shapeType === 'circle';
    const w = canvasW * 0.4;
    const h = isLinear ? 0 : canvasH * 0.3;
    return {
        id, type: 'shape', shapeType,
        x: canvasW / 2 - w / 2, y: canvasH / 2 - h / 2, w, h,
        fillColor: hasFill ? 'rgba(10,132,255,0.35)' : null,
        strokeColor: '#0A84FF', strokeWidth: 6, sides: 5,
        visible: true, opacity: 1, scale: 1, rotation: 0, flipX: false, flipY: false, // trường biến đổi chung
    };
}

/** Phiên kéo khung (cùng cấu trúc session của core/media-transform.js) để đặt/co Shape mới; khung tối thiểu 40px.
 * @param {object} layer @param {number} canvasW @param {number} canvasH @returns {object} session */
function buildShapePlacementSession(layer, canvasW, canvasH) {
    return {
        sourceWidth: canvasW, sourceHeight: canvasH,
        rect: { x: layer.x, y: layer.y, w: layer.w || 40, h: layer.h || 40 },
        activeHandle: null, dragStart: null, aspectRatio: NaN,
    };
}

/**
 * Layer Image: ảnh nguồn đặt giữa, vừa trong 50% khung ảnh đang sửa (giữ tỉ lệ).
 * @param {number} id @param {HTMLCanvasElement} source @param {number} canvasW @param {number} canvasH @returns {object}
 */
function buildImageLayer(id, source, canvasW, canvasH) {
    const ratio = Math.min((canvasW * 0.5) / source.width, (canvasH * 0.5) / source.height);
    const w = source.width * ratio, h = source.height * ratio;
    return {
        id, type: 'image', source,
        x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h,
        visible: true, opacity: 1, scale: 1, rotation: 0, flipX: false, flipY: false, // trường biến đổi chung
    };
}

/** Bản sao layer với id mới, lệch 20px để thấy rõ bản mới. @param {object} layer @param {number} id @returns {object} */
function duplicateImageEditLayer(layer, id) {
    return { ...layer, id, x: layer.x + 20, y: layer.y + 20 };
}

/** Dịch mọi layer (Crop đổi gốc toạ độ). @param {object[]} layers @param {number} dx @param {number} dy @returns {object[]} */
function shiftImageEditLayers(layers, dx, dy) {
    return layers.map((layer) => ({ ...layer, x: layer.x + dx, y: layer.y + dy }));
}

/** Nội dung chữ mới từ ô "Sửa nội dung" — rỗng/toàn khoảng trắng giữ chữ cũ. @param {string} raw @param {string} current
 * @returns {string} */
function resolveLayerTextContent(raw, current) {
    const trimmed = String(raw || '').trim();
    return trimmed || current;
}

/** Khung chữ nổi có chữ thật không. @param {string} text @returns {boolean} */
function hasLayerText(text) {
    return !!(text && text.trim());
}

/** Độ mờ layer từ slider %. @param {number|string} pct @returns {number} 0..1 */
function computeLayerOpacity(pct) {
    const n = Number(pct);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) / 100 : 1;
}

/** @param {object} layer @returns {{flipX: boolean}} */
function computeLayerFlipX(layer) { return { flipX: !layer.flipX }; }
/** @param {object} layer @returns {{flipY: boolean}} */
function computeLayerFlipY(layer) { return { flipY: !layer.flipY }; }
/** Xoay thêm 90° (giữ trong -180..180). @param {object} layer @returns {{rotation: number}} */
function computeLayerRotate90(layer) {
    const next = (layer.rotation || 0) + 90;
    return { rotation: next > 180 ? next - 360 : next };
}
/** Về trạng thái chưa biến đổi (giữ vị trí). @returns {object} */
function computeLayerTransformReset() {
    return { scale: 1, rotation: 0, flipX: false, flipY: false };
}

/** Ảnh chụp các trường biến đổi + vị trí để Huỷ phiên biến đổi. @param {object} layer @returns {object} */
function snapshotLayerTransform(layer) {
    return { x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation, flipX: layer.flipX, flipY: layer.flipY };
}

// ===================== Layer — style (Element Style Editor) =====================

/** Chuỗi CSS khởi tạo Element Style Editor cho layer Text (kể cả font đang dùng). @param {object} layer @returns {string} */
function buildTextLayerStyleCss(layer) {
    const parts = [`color: ${layer.color}`, `font-size: ${layer.fontSizePx}px`, `font-weight: ${layer.fontWeight || 'bold'}`, `font-style: ${layer.fontStyle || 'normal'}`];
    if (layer.fontFamily) parts.push(`font-family: '${layer.fontFamily}'${layer.fontSource === 'google' ? ', sans-serif' : ''}`);
    return parts.join('; ');
}

/** Chuỗi CSS khởi tạo Element Style Editor cho layer Shape (tô = background, viền = border). @param {object} layer @returns {string} */
function buildShapeLayerStyleCss(layer) {
    const parts = [];
    if (layer.fillColor) parts.push(`background-color: ${layer.fillColor}`);
    if (layer.strokeWidth > 0) parts.push(`border: ${layer.strokeWidth}px solid ${layer.strokeColor}`);
    return parts.join('; ');
}

/**
 * Trường cần ghi lên layer Text từ kết quả parseElementStyleCssString(). Màu/cỡ/đậm/nghiêng tắt -> giữ giá trị đang
 * có (canvas luôn cần 1 giá trị); font-family tắt -> về font mặc định. Box-model bỏ qua (không có nghĩa trên canvas).
 * @param {{text: object}} patch @param {object} layer @returns {object}
 */
function computeTextLayerStylePatch(patch, layer) {
    const t = patch.text;
    const family = t.fontFamily && t.fontFamily.enabled && t.fontFamily.value ? t.fontFamily : null;
    return {
        color: t.color ? t.color.value : layer.color,
        fontSizePx: t.fontSize ? Math.round(t.fontSize.value) : layer.fontSizePx,
        fontWeight: t.fontWeight === undefined ? layer.fontWeight : (t.fontWeight === 'none' ? 'bold' : t.fontWeight),
        fontStyle: t.fontStyle === undefined ? layer.fontStyle : (t.fontStyle === 'none' ? 'normal' : t.fontStyle),
        fontFamily: family ? family.value : null,
        fontSource: family ? family.source : null,
        fontGoogleWeight: family ? (family.googleWeight || '400') : null,
    };
}

/** Trường cần ghi lên layer Shape: background -> tô (tắt = không tô), border -> viền (tắt = độ dày 0).
 * @param {{box: object}} patch @param {object} layer @returns {object} */
function computeShapeLayerStylePatch(patch, layer) {
    const b = patch.box;
    return {
        fillColor: b.background ? b.background.value : null,
        strokeColor: b.border ? b.border.color : layer.strokeColor,
        strokeWidth: b.border ? Math.round(b.border.width) : 0,
    };
}

// ===================== Layer — font =====================

/** Chuỗi `ctx.font` của layer Text — font chọn ở Element Style Editor (nếu có) rồi tới font mặc định.
 * @param {object} layer @returns {string} */
function buildTextLayerFontSpec(layer) {
    const family = layer.fontFamily ? `'${layer.fontFamily}', ${IMAGE_EDIT_DEFAULT_FONT_STACK}` : IMAGE_EDIT_DEFAULT_FONT_STACK;
    return `${layer.fontStyle || 'normal'} ${layer.fontWeight || 'bold'} ${layer.fontSizePx}px ${family}`;
}

/** Google Font cần nạp cho các layer Text (mỗi family 1 lần). @param {object[]} layers
 * @returns {Array<{family: string, weight: string, spec: string}>} spec = chuỗi font dùng để chờ nạp xong */
function listTextLayerGoogleFonts(layers) {
    const byFamily = new Map();
    layers.forEach((layer) => {
        if (layer.type !== 'text' || layer.fontSource !== 'google' || !layer.fontFamily || byFamily.has(layer.fontFamily)) return;
        byFamily.set(layer.fontFamily, { family: layer.fontFamily, weight: layer.fontGoogleWeight || '400', spec: `${layer.fontStyle || 'normal'} ${layer.fontWeight || 'bold'} 16px '${layer.fontFamily}'` });
    });
    return Array.from(byFamily.values());
}

/** Yêu cầu trình duyệt tải font (canvas không tự vẽ lại khi font về). @param {string} spec
 * @returns {Promise<number>} số FontFace khớp đã sẵn sàng (0 = CSS Google Font chưa về / không có font này) */
function loadCanvasFontFaceCount(spec) {
    return document.fonts.load(spec).then((faces) => faces.length, () => 0);
}

/** @param {number[]} counts - kết quả loadCanvasFontFaceCount() @returns {boolean} mọi font đã sẵn sàng */
function areCanvasFontsReady(counts) {
    return counts.every((n) => n > 0);
}

// ===================== Layer — vẽ =====================

/** Vẽ layer Text (nhiều dòng, canh giữa quanh tâm). @param {HTMLCanvasElement} canvas @param {object} layer @param {string} fontSpec */
function drawTextLayer(canvas, layer, fontSpec) {
    const ctx = canvas.getContext('2d');
    ctx.font = fontSpec;
    ctx.fillStyle = layer.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = layer.text.split('\n');
    lines.forEach((line, i) => {
        ctx.fillText(line, layer.x, layer.y + (i - (lines.length - 1) / 2) * layer.fontSizePx * 1.2);
    });
}

/** Nét/tô chung của mọi Shape — gọi trước hàm vẽ từng loại. @param {HTMLCanvasElement} canvas @param {object} shape */
function applyShapeLayerStyle(canvas, shape) {
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = shape.strokeWidth;
    ctx.strokeStyle = shape.strokeColor;
    ctx.fillStyle = shape.fillColor || 'transparent';
}

/** @param {HTMLCanvasElement} canvas @param {object} shape */
function drawRectShapeLayer(canvas, shape) {
    const ctx = canvas.getContext('2d');
    const x = Math.min(shape.x, shape.x + shape.w), y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w), h = Math.abs(shape.h);
    if (shape.fillColor) ctx.fillRect(x, y, w, h);
    if (shape.strokeWidth > 0) ctx.strokeRect(x, y, w, h);
}

/** @param {HTMLCanvasElement} canvas @param {object} shape */
function drawCircleShapeLayer(canvas, shape) {
    const ctx = canvas.getContext('2d');
    const x = Math.min(shape.x, shape.x + shape.w), y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w), h = Math.abs(shape.h);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (shape.fillColor) ctx.fill();
    if (shape.strokeWidth > 0) ctx.stroke();
}

/** @param {HTMLCanvasElement} canvas @param {object} shape */
function drawLineShapeLayer(canvas, shape) {
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(shape.x, shape.y);
    ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
    ctx.stroke();
}

/** Đường thẳng + 2 nét đầu mũi tên ở điểm cuối. @param {HTMLCanvasElement} canvas @param {object} shape */
function drawArrowShapeLayer(canvas, shape) {
    const ctx = canvas.getContext('2d');
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
}

/** Đa giác đều nội tiếp hộp, đỉnh đầu hướng lên. @param {HTMLCanvasElement} canvas @param {object} shape */
function drawPolygonShapeLayer(canvas, shape) {
    const ctx = canvas.getContext('2d');
    const x = Math.min(shape.x, shape.x + shape.w), y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w), h = Math.abs(shape.h);
    const cx = x + w / 2, cy = y + h / 2, radius = Math.min(w, h) / 2, sides = shape.sides || 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius); // đỉnh 0 (góc -90°)
    for (let i = 1; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
    }
    ctx.closePath();
    if (shape.fillColor) ctx.fill();
    if (shape.strokeWidth > 0) ctx.stroke();
}

/** @param {HTMLCanvasElement} canvas @param {object} layer - layer Image */
function drawImageLayer(canvas, layer) {
    canvas.getContext('2d').drawImage(layer.source, layer.x, layer.y, layer.w, layer.h);
}

// ===================== Layer — đo + biến đổi =====================

/** Hộp bao layer Text (đo đúng font sẽ vẽ). @param {HTMLCanvasElement} canvas @param {object} layer @param {string} fontSpec
 * @returns {{x:number,y:number,w:number,h:number}} */
function measureTextLayerBox(canvas, layer, fontSpec) {
    const ctx = canvas.getContext('2d');
    ctx.font = fontSpec;
    const lines = layer.text.split('\n');
    const w = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const h = lines.length * layer.fontSizePx * 1.2;
    return { x: layer.x - w / 2, y: layer.y - h / 2, w, h };
}

/** Hộp bao layer Shape — line/arrow nới thêm mỗi phía (≥ 20px) để chạm trúng nét mảnh. @param {object} shape
 * @returns {{x:number,y:number,w:number,h:number}} */
function measureShapeLayerBox(shape) {
    const x = Math.min(shape.x, shape.x + shape.w), y = Math.min(shape.y, shape.y + shape.h);
    const w = Math.abs(shape.w), h = Math.abs(shape.h);
    const pad = shape.shapeType === 'line' || shape.shapeType === 'arrow' ? Math.max(20, shape.strokeWidth * 2) : 0;
    return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
}

/** @param {object} layer - layer Image @returns {{x:number,y:number,w:number,h:number}} */
function measureImageLayerBox(layer) {
    return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
}

/** Khung biến đổi của layer: tâm hộp bao, hệ số co theo 2 trục (âm = lật), góc (radian), độ mờ.
 * @param {object} layer @param {{x:number,y:number,w:number,h:number}} box
 * @returns {{cx:number, cy:number, sx:number, sy:number, rad:number, opacity:number, box: object}} */
function computeLayerFrame(layer, box) {
    const scale = layer.scale || 1;
    return {
        cx: box.x + box.w / 2, cy: box.y + box.h / 2,
        sx: scale * (layer.flipX ? -1 : 1), sy: scale * (layer.flipY ? -1 : 1),
        rad: ((layer.rotation || 0) * Math.PI) / 180,
        opacity: layer.opacity === undefined ? 1 : layer.opacity,
        box,
    };
}

/** Mở 1 lượt vẽ layer theo khung biến đổi (save + alpha + xoay/co quanh tâm). Đóng bằng endLayerPaint().
 * @param {HTMLCanvasElement} canvas @param {object} frame - computeLayerFrame() */
function beginLayerPaint(canvas, frame) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha = frame.opacity;
    ctx.translate(frame.cx, frame.cy);
    ctx.rotate(frame.rad);
    ctx.scale(frame.sx, frame.sy);
    ctx.translate(-frame.cx, -frame.cy);
}

/** @param {HTMLCanvasElement} canvas */
function endLayerPaint(canvas) {
    canvas.getContext('2d').restore();
}

/** Layer trên cùng (duyệt ngược) chứa điểm chạm — điểm quy ngược về hệ toạ độ gốc của layer rồi so với hộp bao.
 * Layer ẩn bỏ qua. @param {{x:number,y:number}} pos @param {Array<{frame: object, visible: boolean}>} entries
 * @returns {number} index, -1 = không trúng */
function findTopmostLayerAt(pos, entries) {
    for (let i = entries.length - 1; i >= 0; i--) {
        const { frame, visible } = entries[i];
        if (!visible) continue;
        const dx = pos.x - frame.cx, dy = pos.y - frame.cy;
        const cos = Math.cos(-frame.rad), sin = Math.sin(-frame.rad);
        const lx = frame.cx + (dx * cos - dy * sin) / frame.sx;
        const ly = frame.cy + (dx * sin + dy * cos) / frame.sy;
        const b = frame.box;
        if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return i;
    }
    return -1;
}

/** Hình học khung biến đổi trên màn: 4 góc (đã xoay/co), tâm, núm xoay phía trên cạnh đầu.
 * @param {object} frame - computeLayerFrame() @param {number} handleGapPx - khoảng cách núm xoay (pixel canvas)
 * @returns {{cx:number, cy:number, corners: Array<{x:number,y:number}>, rotateHandle: {x:number,y:number}, topMid: {x:number,y:number}}} */
function computeLayerTransformGeometry(frame, handleGapPx) {
    const b = frame.box;
    const cos = Math.cos(frame.rad), sin = Math.sin(frame.rad);
    const halfW = (b.w / 2) * Math.abs(frame.sx), halfH = (b.h / 2) * Math.abs(frame.sy);
    const place = (lx, ly) => ({ x: frame.cx + lx * cos - ly * sin, y: frame.cy + lx * sin + ly * cos });
    return {
        cx: frame.cx, cy: frame.cy,
        corners: [place(-halfW, -halfH), place(halfW, -halfH), place(halfW, halfH), place(-halfW, halfH)],
        topMid: place(0, -halfH),
        rotateHandle: place(0, -halfH - handleGapPx),
    };
}

/** Vẽ khung biến đổi lên canvas tương tác (xoá trước): viền + 4 núm góc + núm xoay. `displayScale` = pixel canvas trên
 * mỗi CSS px để nét/núm đủ to trên màn. @param {HTMLCanvasElement} canvas @param {object} geom @param {number} displayScale */
function drawLayerTransformOverlay(canvas, geom, displayScale) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.lineWidth = 2 * displayScale;
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([6 * displayScale, 4 * displayScale]);
    ctx.beginPath();
    ctx.moveTo(geom.corners[0].x, geom.corners[0].y);
    geom.corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.moveTo(geom.topMid.x, geom.topMid.y);
    ctx.lineTo(geom.rotateHandle.x, geom.rotateHandle.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0A84FF';
    const half = 8 * displayScale;
    geom.corners.forEach((p) => { ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2); ctx.strokeRect(p.x - half, p.y - half, half * 2, half * 2); });
    ctx.beginPath();
    ctx.arc(geom.rotateHandle.x, geom.rotateHandle.y, 10 * displayScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/** Chế độ kéo theo điểm chạm đầu: núm xoay > góc (co) > trong khung (di chuyển); ngoài cả 3 -> null.
 * @param {{x:number,y:number}} pos @param {object} geom @param {number} hitRadius - pixel canvas
 * @returns {'rotate'|'scale'|'move'|null} */
function resolveLayerTransformHandle(pos, geom, hitRadius) {
    const near = (p) => Math.hypot(pos.x - p.x, pos.y - p.y) <= hitRadius;
    if (near(geom.rotateHandle)) return 'rotate';
    if (geom.corners.some(near)) return 'scale';
    // Trong tứ giác lồi: cùng phía với mọi cạnh.
    const sides = geom.corners.map((a, i) => {
        const b = geom.corners[(i + 1) % 4];
        return (b.x - a.x) * (pos.y - a.y) - (b.y - a.y) * (pos.x - a.x);
    });
    const inside = sides.every((v) => v >= 0) || sides.every((v) => v <= 0);
    return inside ? 'move' : null;
}

/** Kéo di chuyển: vị trí mới = vị trí lúc bắt đầu + độ lệch. @param {{startPos: object, start: object}} drag
 * @param {{x:number,y:number}} pos @returns {{x:number, y:number}} */
function computeLayerMoveDrag(drag, pos) {
    return { x: drag.start.x + (pos.x - drag.startPos.x), y: drag.start.y + (pos.y - drag.startPos.y) };
}

/** Kéo góc: tỉ lệ theo khoảng cách tới tâm so với lúc bắt đầu (co đều 2 chiều), kẹp MIN..MAX.
 * @param {{startPos: object, start: object, cx: number, cy: number}} drag @param {{x:number,y:number}} pos
 * @returns {{scale: number}} */
function computeLayerScaleDrag(drag, pos) {
    const startDist = Math.max(1, Math.hypot(drag.startPos.x - drag.cx, drag.startPos.y - drag.cy));
    const dist = Math.hypot(pos.x - drag.cx, pos.y - drag.cy);
    return { scale: Math.min(IMAGE_EDIT_LAYER_MAX_SCALE, Math.max(IMAGE_EDIT_LAYER_MIN_SCALE, drag.start.scale * (dist / startDist))) };
}

/** Kéo núm xoay: góc mới = góc lúc bắt đầu + góc quét quanh tâm (độ, giữ trong -180..180).
 * @param {{startPos: object, start: object, cx: number, cy: number}} drag @param {{x:number,y:number}} pos
 * @returns {{rotation: number}} */
function computeLayerRotateDrag(drag, pos) {
    const a0 = Math.atan2(drag.startPos.y - drag.cy, drag.startPos.x - drag.cx);
    const a1 = Math.atan2(pos.y - drag.cy, pos.x - drag.cx);
    const deg = (drag.start.rotation || 0) + ((a1 - a0) * 180) / Math.PI;
    return { rotation: ((((deg + 180) % 360) + 360) % 360) - 180 };
}

/** Kéo layer khi không mở công cụ nào: đã vượt ngưỡng (huỷ long-press) chưa + vị trí mới.
 * @param {{x:number, y:number, layerX:number, layerY:number}} start @param {{x:number,y:number}} pos
 * @param {number} thresholdPx @param {boolean} alreadyMoved @returns {{moved: boolean, x: number, y: number}} */
function computeLayerDragStep(start, pos, thresholdPx, alreadyMoved) {
    const dx = pos.x - start.x, dy = pos.y - start.y;
    return { moved: alreadyMoved || Math.hypot(dx, dy) > thresholdPx, x: start.layerX + dx, y: start.layerY + dy };
}

// ===================== Danh sách Layer (Generic Drawer) =====================

/** Dòng hiển thị của danh sách Layer — layer trên cùng đứng đầu.
 * @param {object[]} layers @param {{image: string, shape: Object<string,string>}} labels - chữ theo loại (t() do Workflow)
 * @returns {Array<{id:number, type:string, label:string, visible:boolean, opacityPct:number}>} */
function computeImageEditLayerRows(layers, labels) {
    return layers.slice().reverse().map((layer) => ({
        id: layer.id,
        type: layer.type,
        label: layer.type === 'text' ? layer.text.split('\n')[0].slice(0, 40) : (layer.type === 'shape' ? labels.shape[layer.shapeType] : labels.image),
        visible: layer.visible !== false,
        opacityPct: Math.round((layer.opacity === undefined ? 1 : layer.opacity) * 100),
    }));
}

/** Vị trí thả (thứ tự hiển thị) — dòng mà con trỏ đang nằm trên, kẹp vào đầu/cuối danh sách.
 * @param {Array<{top:number, bottom:number}>} rects @param {number} clientY @returns {number} */
function findLayerDropDisplayIndex(rects, clientY) {
    const hit = rects.findIndex((r) => clientY >= r.top && clientY <= r.bottom);
    if (hit !== -1) return hit;
    return rects.length && clientY < rects[0].top ? 0 : rects.length - 1;
}

/** Chuyển layer `id` tới vị trí hiển thị `toDisplayIndex` (0 = trên cùng). @param {object[]} layers @param {number} id
 * @param {number} toDisplayIndex @returns {object[]} mảng mới (thứ tự vẽ: dưới -> trên) */
function moveImageEditLayer(layers, id, toDisplayIndex) {
    const from = layers.findIndex((layer) => layer.id === id);
    if (from === -1 || toDisplayIndex < 0) return layers;
    const next = layers.slice();
    const [moved] = next.splice(from, 1);
    next.splice(Math.max(0, layers.length - 1 - toDisplayIndex), 0, moved);
    return next;
}

/** Bỏ layer `id`. @param {object[]} layers @param {number} id @returns {object[]} mảng mới */
function removeImageEditLayer(layers, id) {
    return layers.filter((layer) => layer.id !== id);
}

/** Bật/tắt hiển thị layer. @param {object} layer @returns {{visible: boolean}} */
function computeLayerVisibleToggle(layer) {
    return { visible: layer.visible === false };
}

/** @param {object[]} layers @param {number} id @returns {number} index, -1 = không có */
function findImageEditLayerIndex(layers, id) {
    return layers.findIndex((layer) => layer.id === id);
}

/** Toạ độ/khoảng cách CSS px -> pixel canvas. @param {number} cssPx @param {number} displayScale @returns {number} */
function cssPxToCanvasPx(cssPx, displayScale) {
    return cssPx / (displayScale || 1);
}

/** Nút tỉ lệ Crop -> tỉ lệ số: 'free' -> NaN (Tự do), 'W:H' -> W/H. @param {string} ratioKey @returns {number} */
function parseCropRatioKey(ratioKey) {
    if (ratioKey === 'free') return NaN;
    const [wPart, hPart] = String(ratioKey).split(':').map(Number);
    return wPart / hPart;
}

/** Độ lệch giữa tâm khung chữ nổi và điểm chạm lúc bắt đầu kéo tay nắm (khung không nhảy tâm vào ngón tay).
 * @param {{x:number,y:number}} center @param {{x:number,y:number}} pointer @returns {{dx:number, dy:number}} */
function computeFloatingTextDragOffset(center, pointer) {
    return { dx: center.x - pointer.x, dy: center.y - pointer.y };
}

/** Tâm mới của khung chữ nổi theo điểm chạm hiện tại. @param {{x:number,y:number}} pointer @param {{dx:number,dy:number}} offset
 * @returns {{x:number, y:number}} */
function applyFloatingTextDragOffset(pointer, offset) {
    return { x: pointer.x + offset.dx, y: pointer.y + offset.dy };
}
