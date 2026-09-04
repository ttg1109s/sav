/**
 * core/visual-bg-common.js — Core thuần domain "Visual Background", phần CHUNG cho cả Photo lẫn
 * Video: type/origin kind, quản lý `source.list` (advance/shuffle/sort/mark-missing), và toàn bộ
 * hệ màu nền (solid/gradient + Movement). Phần riêng từng loại: core/visual-bg-video.js,
 * core/visual-bg-photo.js. Điều phối ở event/workflow/visual-bg-common.js
 * (+ event/workflow/motion-engine.js cho riêng render ảnh).
 * NẠP SAU: service/state.js, core/dom-refs.js. NẠP TRƯỚC: event/workflow/visual-bg-common.js.
 */

const VISUAL_BG_TYPES = ['photo', 'video'];
/** 'multi' = nhiều ảnh/video chọn tay qua picker multi-select (originId = JSON mảng key theo thứ
 * tự chọn); 'groupMulti' = nhiều Thư mục gộp lại (originId = JSON mảng folderId). */
const VISUAL_BG_ORIGIN_KINDS = ['single', 'group', 'multi', 'groupMulti'];
const VISUAL_BG_COLOR_MODES = ['solid', 'gradient'];
const VISUAL_BG_GRADIENT_MIN_STOPS = 2;
const VISUAL_BG_GRADIENT_MAX_STOPS = 7;
/** 2 mode LOẠI TRỪ NHAU, xem docstring core/config.js::DEFAULT_VISUAL_BG_CONFIG.gradientMovement. */
const VISUAL_BG_GRADIENT_MOVEMENT_MODES = ['time', 'audio'];
const VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS = 1000; // picker "1s-60s" — dùng chung rotateDurationMs/colorSwapIntervalMs
const VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS = 60000;
const VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS = 500; // picker "500ms-3s" — riêng colorSwapTransitionMs
const VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS = 3000;
const VISUAL_BG_GRADIENT_MOVEMENT_TICK_MS = 100; // 10fps — đủ mượt cho xoay/chuyển màu chậm, nhẹ hơn render loop 60fps
const VISUAL_BG_GRADIENT_MOVEMENT_TASK = 'visualBgGradientMovement'; // tên task taskManager, xem event/workflow/visual-bg-common.js
const VISUAL_BG_LIST_PLAYBACK_MODES = ['perSong', 'slideshow'];
const VISUAL_BG_NEXT_ORDERS = ['random', 'sequential', 'playlist'];
const VISUAL_BG_DURATION_MODES = ['duration', 'fixtime']; // "Seconds per video/photo" — dùng chung video/ảnh

/** 1 pha = 1 lần xoay/giãn mượt từ giá trị hiện tại -> đích, chạy trọn `duration` rồi mới lấy mẫu
 * nhạc chốt pha kế (event/workflow/visual-bg-common.js::_commitNextGradientPhase()). `duration`
 * tính từ BPM/energy tại thời điểm chốt pha, cùng công thức core/visualizer/types/space.js. */
const VISUAL_BG_GRADIENT_PHASE_BASE_MS = 2000; // mốc tham chiếu ở BPM=120, energy trung bình
const VISUAL_BG_GRADIENT_MUSIC_FACTOR_MIN = 0.5;
const VISUAL_BG_GRADIENT_MUSIC_FACTOR_MAX = 2.2;

/**
 * Core thuần — áp `nextIndex` ĐÃ TÍNH SẴN (Workflow tự chọn thuật toán rồi truyền vào — Rule 3) vào
 * `source.list` (mảng key, có thể lẫn `null` = đã bị xoá, chờ dọn).
 * `nextIndex===0` (hết 1 vòng): dọn null trong mảng trước khi trả. Gặp null: KHÔNG tự thử index kế
 * (Giang chốt) — trả nguyên, chờ lần advance() sau.
 * @param {Array<string|null>} list
 * @param {number} nextIndex
 * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn.
 */
function advanceVisualBgList(list, nextIndex) {
    if (list.length === 0) return { list, index: -1 };
    if (nextIndex !== 0) return { list, index: nextIndex };
    const swept = list.filter((key) => key !== null);
    return { list: swept, index: swept.length > 0 ? 0 : -1 };
}

/**
 * Core thuần — xáo ngẫu nhiên (Fisher-Yates) TOÀN BỘ `list`. Shuffle-bag đúng nghĩa: xáo cả mảng 1
 * lần, bước tuần tự qua mảng đã xáo (pickNextMotionEngineIndexSequential()), hết 1 vòng mới xáo
 * lại — đảm bảo mọi item được phát đủ 1 lượt trước khi lặp.
 * @param {Array<string|null>} list
 * @returns {Array<string|null>} mảng MỚI.
 */
function shuffleVisualBgList(list) {
    const result = list.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** Core thuần — đánh dấu 1 vị trí trong `source.list` là mất (record không còn tồn tại). Trả mảng MỚI. */
function markVisualBgListItemMissing(list, index) {
    if (index < 0 || index >= list.length) return list;
    const next = list.slice();
    next[index] = null;
    return next;
}

/**
 * Core thuần: sắp danh sách item nền theo TÊN hiển thị (A-Z / Z-A). Không sửa mảng gốc.
 * @param {Array<{name: string}>} items @param {boolean} descending - true = Z-A.
 * @returns {Array} mảng MỚI đã sắp.
 */
function sortVisualBgItemsByName(items, descending) {
    return items.slice().sort((a, b) => {
        const cmp = (a.name || '').localeCompare(b.name || '', 'vi');
        return descending ? -cmp : cmp;
    });
}

/**
 * Core thuần: sắp danh sách item nền theo NGÀY THÊM (mới nhất / cũ nhất trước). Không sửa mảng gốc.
 * @param {Array<{addedAt: number}>} items @param {boolean} newestFirst
 * @returns {Array} mảng MỚI đã sắp.
 */
function sortVisualBgItemsByAddedAt(items, newestFirst) {
    return items.slice().sort((a, b) => {
        const diff = (a.addedAt || 0) - (b.addedAt || 0);
        return newestFirst ? -diff : diff;
    });
}

/**
 * Core thuần — dựng chuỗi CSS `linear-gradient(...)` từ danh sách chặng màu. Tự sắp theo
 * `position` tăng dần trước khi ghép (CSS đọc chặng theo đúng thứ tự viết ra, không tự sắp).
 * @param {Array<{color: string, position: number}>} stops - 2..7 chặng, `position` là % (0-100).
 * @param {number} angleDeg - góc xoay, chuẩn CSS (0deg = từ dưới lên trên).
 * @returns {string} '' nếu chưa đủ 2 chặng (nơi gọi tự rơi về nền đơn sắc).
 */
function buildVisualBgGradientCss(stops, angleDeg) {
    if (!Array.isArray(stops) || stops.length < VISUAL_BG_GRADIENT_MIN_STOPS) return '';
    const parts = stops.slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => `${s.color} ${s.position}%`);
    return `linear-gradient(${angleDeg}deg, ${parts.join(', ')})`;
}

/**
 * Core thuần — chèn 1 chặng màu mới vào khoảng trống RỘNG NHẤT giữa 2 chặng liền nhau (màu lặp
 * chặng bên trái, không nội suy). Trả mảng MỚI; trả nguyên mảng cũ nếu đã chạm trần.
 * @param {Array<{color: string, position: number}>} stops
 * @returns {Array<{color: string, position: number}>}
 */
function addVisualBgGradientStop(stops) {
    if (stops.length >= VISUAL_BG_GRADIENT_MAX_STOPS) return stops.slice();
    const sorted = stops.slice().sort((a, b) => a.position - b.position);
    let gapIndex = 0;
    let gapSize = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
        const size = sorted[i + 1].position - sorted[i].position;
        if (size > gapSize) { gapSize = size; gapIndex = i; }
    }
    const left = sorted[gapIndex];
    const inserted = { color: left.color, position: Math.round(left.position + gapSize / 2) };
    sorted.splice(gapIndex + 1, 0, inserted);
    return sorted;
}

/**
 * Core thuần — bỏ 1 chặng màu theo vị trí trong mảng. Trả nguyên mảng cũ nếu đang ở mức tối thiểu.
 * @param {Array<{color: string, position: number}>} stops @param {number} index
 * @returns {Array<{color: string, position: number}>}
 */
function removeVisualBgGradientStop(stops, index) {
    if (stops.length <= VISUAL_BG_GRADIENT_MIN_STOPS) return stops.slice();
    return stops.filter((_, i) => i !== index);
}

// ===================== Movement (xoay/giãn gradient theo thời gian hoặc nhạc) =====================
// Phục vụ event/workflow/visual-bg-common.js::_tickGradientMovement() — không hàm nào tự đọc
// appState/Date.now() (Rule 1/2), không hàm nào gọi hàm core khác kể cả buildVisualBgGradientCss()
// ở trên (Rule 3) — Workflow tự gọi riêng từng hàm rồi mới ghép.

/** Góc xoay mode 'time' — chạy đều theo thời gian, hết đúng 1 vòng 360° sau `durationMs` rồi lặp.
 * @param {number} elapsedMs - Workflow tự trừ mốc bắt đầu trước khi truyền vào.
 * @param {number} durationMs @returns {number} 0-360 */
function computeGradientTimeRotateAngle(elapsedMs, durationMs) {
    if (durationMs <= 0) return 0;
    return ((elapsedMs % durationMs) / durationMs) * 360;
}

/** Nội suy tuyến tính [from,to] theo hệ số 0-1 — dùng chung cho góc xoay lẫn độ giãn stop mode
 * 'audio'. @param {number} from @param {number} to @param {number} factor01 @returns {number} */
function lerpGradientMovementValue(from, to, factor01) {
    const clamped = Math.max(0, Math.min(1, factor01));
    return from + (to - from) * clamped;
}

/** Hệ số tốc độ 1 pha xoay/giãn gradient theo nhạc — BPM/energy cao chạy nhanh hơn. Cùng công thức
 * core/visualizer/types/space.js dùng cho tốc độ xoay camera Space. */
function computeMusicSpeedFactor(bpm, energy01, min, max) {
    const factor = (bpm / 120) * (0.7 + energy01 * 0.6);
    return Math.max(min, Math.min(max, factor));
}

/** Thời lượng 1 pha (ms) = `baseDurationMs` (mốc BPM=120) chia hệ số tốc độ nhạc, tính TẠI THỜI
 * ĐIỂM pha cũ vừa xong (không phải hằng số cố định). */
function computeGradientPhaseDuration(baseDurationMs, musicSpeedFactor) {
    return baseDurationMs / musicSpeedFactor;
}

/** Easing vào/ra êm cho 1 pha xoay/giãn. */
function easeInOutSine(progress01) {
    return -(Math.cos(Math.PI * progress01) - 1) / 2;
}

/** Co/giãn vị trí % của các stop đối xứng quanh tâm 50% — `spreadPercent` càng lớn, stop càng "toé"
 * xa tâm, tỷ lệ theo khoảng cách hiện tại tới tâm (không đảo thứ tự stop). Kẹp 0-100 sau khi dịch.
 * @param {Array<{color: string, position: number}>} stops @param {number} spreadPercent - 0-50
 * @returns {Array<{color: string, position: number}>} mảng MỚI */
function computeGradientStopSpread(stops, spreadPercent) {
    if (!spreadPercent) return stops.slice();
    return stops.map((s) => {
        const distanceFromCenter = (s.position - 50) / 50;
        const shifted = s.position + distanceFromCenter * spreadPercent;
        return { ...s, position: Math.max(0, Math.min(100, Math.round(shifted))) };
    });
}

/** "Tráo màu ngẫu nhiên" — đổi CHỖ màu cho nhau giữa các stop (Fisher-Yates), GIỮ NGUYÊN vị trí %.
 * Nhận sẵn mảng số ngẫu nhiên (Workflow tự Math.random() rồi truyền vào — core không nhận callback).
 * @param {Array<{color: string, position: number}>} stops @param {number[]} randomFactors
 * @returns {Array<{color: string, position: number}>} mảng MỚI */
function shuffleGradientStopColors(stops, randomFactors) {
    const colors = stops.map((s) => s.color);
    for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor((randomFactors[i] || 0) * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return stops.map((s, i) => ({ ...s, color: colors[i] }));
}

/** Nội suy màu CHÉO giữa 2 bộ stop CÙNG vị trí % — dùng cho hiệu ứng chuyển cảnh mượt lúc "tráo
 * màu". Nhận màu ĐÃ nội suy sẵn qua tham số (Workflow tự gọi interpolateColor(), core/color-utils.js).
 * @param {Array<{color: string, position: number}>} fromStops @param {string[]} interpolatedColors
 * @returns {Array<{color: string, position: number}>} */
function applyGradientStopColors(fromStops, interpolatedColors) {
    return fromStops.map((s, i) => ({ ...s, color: interpolatedColors[i] || s.color }));
}

/** Core thuần — ghi TRỰC TIẾP 1 chuỗi CSS gradient (đã dựng sẵn) lên #visualizer-solid-bg — dùng
 * cho Movement (mỗi tick animation), KHÔNG đọc/ghi appConfigVisualBg (khác updateDOMBackground(),
 * core/color-utils.js — giá trị Movement mỗi khung hình chỉ là hiệu ứng nhất thời).
 * @param {string} gradientCss */
function applyGradientCssFrame(gradientCss) {
    visualizerSolidBg.style.backgroundImage = gradientCss;
}

/** Fill style nền VBG hiện tại, sẵn sàng gán `ctx.fillStyle` — solid: trả thẳng hex string.
 * gradient: dựng CanvasGradient khớp khung hình đang hiển thị (đọc khung Movement LIVE nếu đang
 * chạy, tĩnh nếu Movement tắt). Dùng bởi visual 2D cần tô nền theo màu VBG — vd core/visualizer/types/rain.js.
 * @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height */
function getVisualBgFillStyle(ctx, width, height) {
    const vb = appConfigVisualBg.getAll();
    if (vb.colorMode !== 'gradient') return vb.solidColor;
    const liveAngle = appState.get('visualBgGradientLiveAngle');
    const liveStops = appState.get('visualBgGradientLiveStops');
    const angle = liveAngle !== null ? liveAngle : vb.gradientAngleDeg;
    const stops = liveStops || vb.gradientStops;
    return buildCanvasLinearGradient(ctx, angle, width, height, stops); // core/color-utils.js
}
