/**
 * core/subtitle/subtitle-karaoke-display-ui.js — Core DOM/canvas cho karaoke trên phụ đề Visualizer (Rule 5,
 * hậu tố -ui vì tự dựng DOM/canvas). Mỗi hàm 1 việc, không gọi hàm khác trong app, không appState/taskManager,
 * không addEventListener. Điều phối: event/workflow/subtitle-display.js.
 *
 * Mỗi từ = `.kr-word` (inline-block, nhận transform/opacity/viền) chứa `.kr-base` (chữ gốc, kế thừa style khung
 * phụ đề) + `.kr-fill` (bản sao màu karaoke đè lên, cắt bằng clip-path theo phần đã tô). Không dùng
 * background-clip:text — text-shadow sẽ vẽ đè lên lớp clip. CSS: assets/css/base.css (khối "Karaoke").
 */

/** Hình pointer vẽ lại theo các kiểu CSS cursor. anchor = điểm mũi (tỉ lệ 0..1 của khung) đặt đúng tâm mép dưới từ. */
const KARAOKE_POINTER_SHAPES = {
    default: {
        anchor: { x: 0.14, y: 0.08 },
        svg: '<svg viewBox="0 0 24 24"><path d="M3.5 2l14 11.2-6.2 1 3.1 6.6-2.7 1.3-3.1-6.7-5.1 4.2z" style="fill:var(--kr-color,#facc15)" stroke="rgba(0,0,0,.65)" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    },
    pointer: {
        anchor: { x: 0.44, y: 0.08 },
        svg: '<svg viewBox="0 0 24 24"><path d="M9 11V4.5a1.5 1.5 0 013 0V10h.5V8.5a1.5 1.5 0 013 0V10h.5V9.5a1.5 1.5 0 013 0V15c0 3.3-2.7 6-6 6h-1c-2.2 0-3.6-1-4.7-2.6L4.2 14.2a1.5 1.5 0 012.3-1.9L9 14z" style="fill:var(--kr-color,#facc15)" stroke="rgba(0,0,0,.65)" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    },
    text: {
        anchor: { x: 0.5, y: 0.1 },
        svg: '<svg viewBox="0 0 24 24"><path d="M8.5 3.5h7M8.5 20.5h7M12 3.5v17" fill="none" stroke="rgba(0,0,0,.65)" stroke-width="4" stroke-linecap="round"/><path d="M8.5 3.5h7M8.5 20.5h7M12 3.5v17" fill="none" style="stroke:var(--kr-color,#facc15)" stroke-width="2" stroke-linecap="round"/></svg>',
    },
    crosshair: {
        anchor: { x: 0.5, y: 0.5 },
        svg: '<svg viewBox="0 0 24 24"><path d="M12 2v7M12 15v7M2 12h7M15 12h7" fill="none" stroke="rgba(0,0,0,.65)" stroke-width="4" stroke-linecap="round"/><path d="M12 2v7M12 15v7M2 12h7M15 12h7" fill="none" style="stroke:var(--kr-color,#facc15)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" style="fill:var(--kr-color,#facc15)" stroke="rgba(0,0,0,.65)" stroke-width="1"/></svg>',
    },
};

/** Dựng khối <p> karaoke cho 1 dòng. Token 'word' -> .kr-word, 'space' -> ' ', 'break' -> <br>.
 * @param {string} subId @param {number} startSec @param {Array<{kind: string, text: string}>} tokens
 * @returns {{block: HTMLElement, words: Array<{el: HTMLElement, baseEl: HTMLElement, fillEl: HTMLElement}>}} */
function buildKaraokeSubtitleBlockUi(subId, startSec, tokens) {
    const block = document.createElement('p');
    block.id = `sub-active-${subId}`;
    block.dataset.subId = subId;
    block.dataset.start = String(startSec);
    block.classList.add('kr-line');
    const words = [];
    tokens.forEach((token) => {
        if (token.kind === 'break') { block.appendChild(document.createElement('br')); return; }
        if (token.kind === 'space') { block.appendChild(document.createTextNode(' ')); return; }
        const el = document.createElement('span');
        el.className = 'kr-word';
        const baseEl = document.createElement('span');
        baseEl.className = 'kr-base';
        baseEl.textContent = token.text;
        const fillEl = document.createElement('span');
        fillEl.className = 'kr-fill';
        fillEl.setAttribute('aria-hidden', 'true');
        fillEl.textContent = token.text;
        el.appendChild(baseEl);
        el.appendChild(fillEl);
        block.appendChild(el);
        words.push({ el, baseEl, fillEl });
    });
    return { block, words };
}

/** Phần đã tô (0..1) -> cắt lớp màu karaoke từ phải vào. */
function setKaraokeWordFillUi(fillEl, fill) {
    const clip = `inset(0 ${((1 - fill) * 100).toFixed(2)}% 0 0)`;
    fillEl.style.clipPath = clip;
    fillEl.style.webkitClipPath = clip;
}

/** Độ hiện của 1 từ, `durationMs` = 0 là đặt thẳng. */
function setKaraokeWordOpacityUi(wordEl, opacity, durationMs) {
    wordEl.style.transition = durationMs > 0 ? `opacity ${durationMs}ms ease` : 'none';
    wordEl.style.opacity = String(opacity);
}

/** transform của từ đang hát ('' = về nguyên trạng). */
function setKaraokeWordTransformUi(wordEl, transform) {
    wordEl.style.transform = transform;
}

/** Bật/tắt viền (class .kr-outline, thông số lấy từ biến CSS). */
function setKaraokeWordOutlineUi(wordEl, enabled) {
    wordEl.classList.toggle('kr-outline', enabled);
}

/** Ghi biến CSS karaoke lên #subtitle-display (kế thừa xuống từ + pointer; nằm ngoài #subtitle-frame nên style
 * tuỳ chỉnh của khung — removeAttribute('style') — không xoá mất). @param {{r:number,g:number,b:number}} rgb */
function applyKaraokeStyleVarsUi(displayEl, rgb, outlineWidthPx, outlineOpacity, glow, blurPx) {
    const rgbText = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    displayEl.style.setProperty('--kr-color', `rgb(${rgbText})`);
    displayEl.style.setProperty('--kr-ow', `${outlineWidthPx}px`);
    displayEl.style.setProperty('--kr-oc', `rgba(${rgbText}, ${outlineOpacity})`);
    displayEl.style.setProperty('--kr-gc', `rgba(${rgbText}, ${glow})`);
    displayEl.style.setProperty('--kr-blur', `${blurPx}px`);
}

/** Đổi hình pointer. @param {{svg: string}} shape KARAOKE_POINTER_SHAPES[...] */
function setKaraokePointerShapeUi(pointerEl, shape) {
    pointerEl.innerHTML = shape.svg;
}

function setKaraokePointerVisibleUi(pointerEl, visible) {
    pointerEl.classList.toggle('hidden', !visible);
}

/** Đặt pointer vào từ: mũi (anchor) ở tâm mép dưới từ, cỡ theo chiều cao chữ. `transition` = 'none' khi hiện lần
 * đầu (không trượt từ góc vào), '' = dùng transition CSS mặc định (trượt mượt sang từ mới).
 * @param {{x: number, y: number}} anchor */
function positionKaraokePointerUi(pointerEl, wordEl, containerEl, anchor, transition) {
    const wr = wordEl.getBoundingClientRect();
    const cr = containerEl.getBoundingClientRect();
    const size = Math.max(14, Math.min(40, wr.height * 0.9));
    pointerEl.style.transition = transition;
    pointerEl.style.width = `${size}px`;
    pointerEl.style.height = `${size}px`;
    const x = wr.left - cr.left + wr.width / 2 - anchor.x * size;
    const y = wr.bottom - cr.top - anchor.y * size + 2;
    pointerEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
}

/** Hộp của từ (CSS px) trong hệ toạ độ canvas hiệu ứng. @returns {{x: number, y: number, w: number, h: number}} */
function measureKaraokeWordBoxUi(wordEl, canvasEl) {
    const wr = wordEl.getBoundingClientRect();
    const cr = canvasEl.getBoundingClientRect();
    return { x: wr.left - cr.left, y: wr.top - cr.top, w: wr.width, h: wr.height };
}

/** Font + màu chữ đang hiển thị của 1 phần tử (dùng vẽ lại chữ lên canvas lấy mẫu hạt). */
function readKaraokeTextStyleUi(el) {
    const cs = getComputedStyle(el);
    return { font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color: cs.color };
}

/** Canvas nháp để vẽ chữ lấy mẫu điểm ảnh. */
function createKaraokeScratchCanvasUi() {
    return document.createElement('canvas');
}

/** Lấy mẫu điểm ảnh của chữ (vẽ lại lên canvas nháp) -> điểm (CSS px, hệ toạ độ canvas hiệu ứng) theo bước
 * `stepPx`. @returns {Array<{x: number, y: number}>} */
function sampleKaraokeGlyphPointsUi(scratchCanvas, text, font, box, stepPx) {
    const pad = 4;
    const w = Math.max(1, Math.ceil(box.w) + pad * 2);
    const h = Math.max(1, Math.ceil(box.h) + pad * 2);
    scratchCanvas.width = w;
    scratchCanvas.height = h;
    const ctx = scratchCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(text, pad, pad + box.h / 2);
    const data = ctx.getImageData(0, 0, w, h).data;
    const points = [];
    for (let y = 0; y < h; y += stepPx) {
        for (let x = 0; x < w; x += stepPx) {
            if (data[(y * w + x) * 4 + 3] > 128) points.push({ x: box.x + x - pad, y: box.y + y - pad });
        }
    }
    return points;
}

/** Sprite 1 hạt (32px) màu `color` — `core` 0 = mềm (khói), ~0.7 = hạt đặc (bụi). */
function buildKaraokeParticleSpriteUi(color, core) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(core, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 32);
    return canvas;
}

/** Khớp kích thước bitmap canvas hiệu ứng với kích thước hiển thị x dpr. */
function syncKaraokeFxCanvasSizeUi(canvasEl, dpr) {
    const w = Math.max(1, Math.round(canvasEl.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvasEl.clientHeight * dpr));
    if (canvasEl.width !== w) canvasEl.width = w;
    if (canvasEl.height !== h) canvasEl.height = h;
}

/** Xoá canvas rồi vẽ mọi hạt tại `nowMs` (vị trí/cỡ easeOut, độ trong tuyến tính theo đời hạt).
 * @param {Map<string, HTMLCanvasElement>} sprites */
function drawKaraokeParticlesUi(ctx, particles, nowMs, sprites, dpr) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const sprite = sprites.get(p.key);
        if (!sprite) continue;
        const u = Math.max(0, Math.min(1, (nowMs - p.t0) / p.life));
        const e = 1 - (1 - u) * (1 - u);
        const size = p.s0 + (p.s1 - p.s0) * e;
        ctx.globalAlpha = p.a0 + (p.a1 - p.a0) * u;
        ctx.drawImage(sprite, p.x0 + (p.x1 - p.x0) * e - size / 2, p.y0 + (p.y1 - p.y0) * e - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
}
