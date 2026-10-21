/**
 * core/visual-bg-common.js — Core thuần domain "Visual Background", phần CHUNG cho Photo lẫn Video: kiểm/khôi phục cấu hình
 * lưu, `source.list` (đếm/advance/shuffle/so sánh/sắp), mã hoá origin nhiều item, picker multi-select và hệ màu nền
 * (solid/gradient + Movement). Không đọc appState/config, không gọi core khác. Phần riêng: core/visual-bg-video.js,
 * core/visual-bg-photo.js; ghi DOM panel: core/visual-bg-panel-ui.js. Điều phối: event/workflow/visual-bg-common.js.
 * NẠP SAU: core/dom-refs.js (visualizerSolidBg — lúc chạy).
 */

const VISUAL_BG_TYPES = ['photo', 'video'];
/** 'multi' = nhiều ảnh/video chọn tay (originId = JSON mảng key theo thứ tự chọn); 'groupMulti' = nhiều Thư mục gộp
 * (originId = JSON mảng folderId). */
const VISUAL_BG_ORIGIN_KINDS = ['single', 'group', 'multi', 'groupMulti'];
const VISUAL_BG_COLOR_MODES = ['solid', 'gradient'];
const VISUAL_BG_GRADIENT_MIN_STOPS = 2;
const VISUAL_BG_GRADIENT_MAX_STOPS = 7;
/** 2 mode loại trừ nhau, xem core/config.js::DEFAULT_VISUAL_BG_CONFIG.gradientMovement. */
const VISUAL_BG_GRADIENT_MOVEMENT_MODES = ['time', 'audio'];
const VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS = 1000; // picker "1s-60s" — dùng chung rotateDurationMs/colorSwapIntervalMs
const VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS = 60000;
const VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS = 500; // picker "500ms-3s" — riêng colorSwapTransitionMs
const VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS = 3000;
const VISUAL_BG_GRADIENT_MOVEMENT_TICK_MS = 100; // 10fps — đủ mượt cho xoay/chuyển màu chậm
const VISUAL_BG_GRADIENT_MOVEMENT_TASK = 'visualBgGradientMovement'; // task taskManager của Workflow
const VISUAL_BG_LIST_PLAYBACK_MODES = ['perSong', 'slideshow'];
const VISUAL_BG_NEXT_ORDERS = ['random', 'sequential', 'playlist'];
const VISUAL_BG_DURATION_MODES = ['duration', 'fixtime']; // "Seconds per video/photo" — dùng chung video/ảnh
const VISUAL_BG_DURATION_SECONDS_MIN = 0.5; // picker "Seconds per video/photo": 0.5-60s, bước 0.1s
const VISUAL_BG_DURATION_SECONDS_MAX = 60;
const VISUAL_BG_LEGACY_SLIDESHOW_MIN_SECONDS = 5; // `slideshow.intervalSeconds` đời cũ — chỉ nhận khi ≥ 5s

/** Mode 'audio': 1 pha xoay/giãn chạy trọn `duration` rồi mới lấy mẫu nhạc chốt pha kế; `duration` tính từ BPM/energy lúc
 * chốt pha, cùng công thức core/visualizer/types/space.js. */
const VISUAL_BG_GRADIENT_PHASE_BASE_MS = 2000; // mốc ở BPM=120, energy trung bình
const VISUAL_BG_GRADIENT_MUSIC_FACTOR_MIN = 0.5;
const VISUAL_BG_GRADIENT_MUSIC_FACTOR_MAX = 2.2;

// ===================== Cấu hình lưu (meta.visualBgConfig) =====================

/**
 * Khôi phục cấu hình đã lưu lên nền `current`: mỗi field lấy giá trị lưu nếu hợp lệ, không thì giữ `current`. 3 phần cần
 * core khác (tiếng từng video, Resolution Video/Photo) trả RAW để Workflow chuẩn hoá tiếp.
 * `durationSeconds` lạ -> thử `slideshow.intervalSeconds` đời cũ; Resolution thiếu -> `resolutionMode` chung đời cũ.
 * @param {object} saved - object đọc từ DB (đã kiểm là object)
 * @param {object} current - appConfigVisualBg.getAll()
 * @returns {{config: object, videoAudioRaw: object|null, videoResolutionRaw: *, photoResolutionRaw: *}}
 */
function sanitizeVisualBgConfig(saved, current) {
    const src = saved.source && typeof saved.source === 'object' ? saved.source : null;
    const source = { ...current.source };
    if (src) {
        source.originKind = src.originKind === null || VISUAL_BG_ORIGIN_KINDS.includes(src.originKind) ? src.originKind : source.originKind;
        source.originId = src.originId === null || typeof src.originId === 'string' ? src.originId : source.originId;
        source.list = Array.isArray(src.list) ? src.list.filter((k) => k === null || typeof k === 'string') : source.list;
    }

    const pend = saved.pending;
    const isPendingValid = !!pend && typeof pend === 'object' && (pend.originKind === null || VISUAL_BG_ORIGIN_KINDS.includes(pend.originKind)) && Array.isArray(pend.list);
    const pending = isPendingValid
        ? { originKind: pend.originKind, originId: typeof pend.originId === 'string' ? pend.originId : null, list: pend.list.filter((k) => k === null || typeof k === 'string') }
        : { ...current.pending };

    const ds = saved.durationSeconds;
    const legacy = saved.slideshow && typeof saved.slideshow.intervalSeconds === 'number' && saved.slideshow.intervalSeconds >= VISUAL_BG_LEGACY_SLIDESHOW_MIN_SECONDS
        ? saved.slideshow.intervalSeconds : current.durationSeconds;

    const g = saved.gradientMovement && typeof saved.gradientMovement === 'object' ? saved.gradientMovement : {};
    const c = current.gradientMovement;
    const rotMin = VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS;
    const rotMax = VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS;
    const gradientMovement = {
        ...c,
        enabled: typeof g.enabled === 'boolean' ? g.enabled : c.enabled,
        mode: VISUAL_BG_GRADIENT_MOVEMENT_MODES.includes(g.mode) ? g.mode : c.mode,
        rotateDurationMs: typeof g.rotateDurationMs === 'number' && g.rotateDurationMs >= rotMin && g.rotateDurationMs <= rotMax ? g.rotateDurationMs : c.rotateDurationMs,
        audioRotateFrom: typeof g.audioRotateFrom === 'number' ? Math.max(0, Math.min(360, g.audioRotateFrom)) : c.audioRotateFrom,
        audioRotateTo: typeof g.audioRotateTo === 'number' ? Math.max(0, Math.min(360, g.audioRotateTo)) : c.audioRotateTo,
        audioStopSpreadFrom: typeof g.audioStopSpreadFrom === 'number' ? Math.max(0, Math.min(50, g.audioStopSpreadFrom)) : c.audioStopSpreadFrom,
        audioStopSpreadTo: typeof g.audioStopSpreadTo === 'number' ? Math.max(0, Math.min(50, g.audioStopSpreadTo)) : c.audioStopSpreadTo,
        colorSwapEnabled: typeof g.colorSwapEnabled === 'boolean' ? g.colorSwapEnabled : c.colorSwapEnabled,
        colorSwapIntervalMs: typeof g.colorSwapIntervalMs === 'number' && g.colorSwapIntervalMs >= rotMin && g.colorSwapIntervalMs <= rotMax ? g.colorSwapIntervalMs : c.colorSwapIntervalMs,
        colorSwapTransitionMs: typeof g.colorSwapTransitionMs === 'number' && g.colorSwapTransitionMs >= VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS && g.colorSwapTransitionMs <= VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS
            ? g.colorSwapTransitionMs : c.colorSwapTransitionMs,
    };

    const stops = saved.gradientStops;
    const config = {
        type: VISUAL_BG_TYPES.includes(saved.type) ? saved.type : current.type,
        source,
        pending,
        listPlaybackMode: VISUAL_BG_LIST_PLAYBACK_MODES.includes(saved.listPlaybackMode) ? saved.listPlaybackMode : current.listPlaybackMode,
        nextOrder: VISUAL_BG_NEXT_ORDERS.includes(saved.nextOrder) ? saved.nextOrder : current.nextOrder,
        durationMode: VISUAL_BG_DURATION_MODES.includes(saved.durationMode) ? saved.durationMode : current.durationMode,
        durationSeconds: typeof ds === 'number' && ds >= VISUAL_BG_DURATION_SECONDS_MIN && ds <= VISUAL_BG_DURATION_SECONDS_MAX ? ds : legacy,
        colorMode: VISUAL_BG_COLOR_MODES.includes(saved.colorMode) ? saved.colorMode : current.colorMode,
        solidColor: typeof saved.solidColor === 'string' ? saved.solidColor : current.solidColor,
        gradientAngleDeg: typeof saved.gradientAngleDeg === 'number' ? saved.gradientAngleDeg : current.gradientAngleDeg,
        gradientStops: Array.isArray(stops) && stops.length >= VISUAL_BG_GRADIENT_MIN_STOPS && stops.length <= VISUAL_BG_GRADIENT_MAX_STOPS ? stops : current.gradientStops,
        gradientMovement,
        motionPresetId: typeof saved.motionPresetId === 'string' || saved.motionPresetId === null ? saved.motionPresetId : current.motionPresetId,
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : current.enabled,
        videoSyncPlaybackSpeed: typeof saved.videoSyncPlaybackSpeed === 'boolean' ? saved.videoSyncPlaybackSpeed : current.videoSyncPlaybackSpeed,
    };
    return {
        config,
        videoAudioRaw: src && src.videoAudio && typeof src.videoAudio === 'object' ? src.videoAudio : null,
        videoResolutionRaw: saved.videoResolutionMode || saved.resolutionMode,
        photoResolutionRaw: saved.photoResolutionMode || saved.resolutionMode,
    };
}

/** Toggle tổng (`enabled`) có bật không — field thiếu (config cũ) coi như bật. @param {object} cfg @returns {boolean} */
function isVisualBgMediaEnabled(cfg) {
    return cfg.enabled !== false;
}

/** "Song đang chạy" theo góc nhìn VBG: Song phát thật VÀ app không ở chế độ nền.
 * @param {boolean} isAudioPaused @param {boolean} isBackgroundSuspended @returns {boolean} */
function isVisualBgSongActive(isAudioPaused, isBackgroundSuspended) {
    return !isAudioPaused && !isBackgroundSuspended;
}

/** Có áp `pending` ở lượt này không: chỉ khi được phép (bật toggle / lúc boot) và đang có pending.
 * @param {boolean} isAllowed @param {string|null} pendingOriginKind @returns {boolean} */
function shouldApplyVisualBgPending(isAllowed, pendingOriginKind) {
    return isAllowed && !!pendingOriginKind;
}

/** Origin + list đang HIỂN THỊ ở Settings: `pending` (nếu có) thắng `source`.
 * @param {object} cfg @returns {{originKind: string|null, originId: string|null, list: Array<string|null>}} */
function resolveVisualBgDisplayedSource(cfg) {
    const from = cfg.pending.originKind ? cfg.pending : cfg.source;
    return { originKind: from.originKind, originId: from.originId, list: from.list };
}

/** Áp tốc độ VBG Video ngay lên `bgVideoElement` không: chỉ khi type 'video' và không ở Video Player mode.
 * @param {string} type @param {boolean} isVideoPlayerMode @returns {boolean} */
function shouldApplyVisualBgVideoSpeedLive(type, isVideoPlayerMode) {
    return type === 'video' && !isVideoPlayerMode;
}

// ===================== source.list =====================

/** Số item CÒN SỐNG (khác null): 0 = ẩn media, 1 = tĩnh, >1 = cycle. @param {Array<string|null>} list @returns {number} */
function countVisualBgLiveItems(list) {
    return list.filter((k) => k !== null).length;
}

/** Key còn sống (bỏ null). @param {Array<string|null>} list @returns {string[]} */
function listVisualBgLiveKeys(list) {
    return list.filter((k) => k !== null);
}

/** Đang cycle nhiều item kiểu slideshow (≥2 item sống) — chỉ lúc này VBG tự hẹn giờ chuyển item.
 * @param {string} listPlaybackMode @param {number} liveCount @returns {boolean} */
function isVisualBgSlideshowCycling(listPlaybackMode, liveCount) {
    return listPlaybackMode === 'slideshow' && liveCount > 1;
}

/** Thời lượng 1 item tính theo đâu: đang cycle + 'fixtime' -> 'fixtime' (`durationSeconds`); còn lại -> 'natural' — thời
 * lượng của chính media (video: độ dài video; ảnh: `record.duration`), kể cả 1 nguồn và 'perSong'.
 * @param {boolean} isCycling @param {string} durationMode @returns {'fixtime'|'natural'} */
function resolveVisualBgItemDurationSource(isCycling, durationMode) {
    return isCycling && durationMode === 'fixtime' ? 'fixtime' : 'natural';
}

/** ms của "Fix time" (tối thiểu 0.5s). @param {number} durationSeconds @returns {number} */
function computeVisualBgFixtimeMs(durationSeconds) {
    return Math.max(VISUAL_BG_DURATION_SECONDS_MIN, durationSeconds) * 1000;
}

/** Kẹp thời lượng theo trần (vd video dài hơn "Fix time" bị cắt sớm). @param {number} ms @param {number} capMs @returns {number} */
function capVisualBgDurationMs(ms, capMs) {
    return Math.min(ms, capMs);
}

/**
 * Áp `nextIndex` đã tính sẵn vào `source.list` (có thể lẫn `null` = đã xoá). `nextIndex===0` (hết 1 vòng): dọn null trước
 * khi trả. Gặp null không tự thử index kế (Giang chốt) — chờ lượt sau.
 * @param {Array<string|null>} list @param {number} nextIndex
 * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn.
 */
function advanceVisualBgList(list, nextIndex) {
    if (list.length === 0) return { list, index: -1 };
    if (nextIndex !== 0) return { list, index: nextIndex };
    const swept = list.filter((key) => key !== null);
    return { list: swept, index: swept.length > 0 ? 0 : -1 };
}

/**
 * Xáo ngẫu nhiên (Fisher-Yates) TOÀN BỘ `list` — shuffle-bag: xáo cả mảng 1 lần, bước tuần tự qua mảng đã xáo, hết 1
 * vòng mới xáo lại (mọi item phát đủ 1 lượt trước khi lặp).
 * @param {Array<string|null>} list @returns {Array<string|null>} mảng MỚI.
 */
function shuffleVisualBgList(list) {
    const result = list.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** Bước kế ở nextOrder 'random' có mở vòng mới (xáo lại cả mảng) không — đúng lúc quay về index 0 và mảng > 1 item.
 * @param {boolean} isRandom @param {number} nextIndex @param {number} length @returns {boolean} */
function isVisualBgNewRandomRound(isRandom, nextIndex, length) {
    return isRandom && nextIndex === 0 && length > 1;
}

/** Vòng mới vừa xáo có đặt đúng item vừa phát lên đầu không (phát lặp 2 lần liền).
 * @param {Array<string|null>} reshuffled @param {Array<string|null>} list - mảng trước khi xáo @param {number} currentIndex
 * @returns {boolean} */
function isVisualBgRoundFrontRepeat(reshuffled, list, currentIndex) {
    const justPlayedKey = currentIndex >= 0 ? list[currentIndex] : null;
    return reshuffled[0] === justPlayedKey;
}

/** Đổi chỗ phần tử đầu với 1 vị trí ngẫu nhiên trong [1, length-1]. @param {Array<string|null>} list
 * @param {number} random01 - Workflow tự Math.random() @returns {Array<string|null>} mảng MỚI */
function swapVisualBgListFront(list, random01) {
    const result = list.slice();
    const swapWith = 1 + Math.floor(random01 * (result.length - 1));
    [result[0], result[swapWith]] = [result[swapWith], result[0]];
    return result;
}

/** Đánh dấu 1 vị trí trong `source.list` là mất (record không còn). Trả mảng MỚI. */
function markVisualBgListItemMissing(list, index) {
    if (index < 0 || index >= list.length) return list;
    const next = list.slice();
    next[index] = null;
    return next;
}

/**
 * So 2 mảng key — "list mới có khác list cũ không, khác bao nhiêu". `unchanged` nghiêm hơn `added===0 && removed===0`: đổi
 * CHỖ (cùng thành viên, khác thứ tự) vẫn là có đổi (thứ tự có nghĩa với 'sequential'/'playlist').
 * @param {Array<string|null>} oldList - `null` bị lọc trước khi so @param {string[]} newList
 * @returns {{unchanged: boolean, added: number, removed: number, total: number}}
 */
function diffVisualBgKeyLists(oldList, newList) {
    const oldKeys = oldList.filter((k) => k !== null);
    const unchanged = newList.length === oldKeys.length && newList.every((k, i) => k === oldKeys[i]);
    const oldSet = new Set(oldKeys);
    const newSet = new Set(newList);
    const added = newList.filter((k) => !oldSet.has(k)).length;
    const removed = oldKeys.filter((k) => !newSet.has(k)).length;
    return { unchanged, added, removed, total: newList.length };
}

/**
 * Cách xử lý 1 lượt đọc lại origin: origin rỗng -> gỡ hẳn ('clear'); không đổi -> 'unchanged'; đang có media sống -> xếp
 * pending ('queue'); còn lại áp ngay ('commit').
 * @param {number} keyCount @param {{unchanged: boolean}} diff @param {number} liveCount - item sống của `source.list`
 * @returns {'clear'|'unchanged'|'queue'|'commit'}
 */
function resolveVisualBgCommitRoute(keyCount, diff, liveCount) {
    if (keyCount === 0) return 'clear';
    if (diff.unchanged) return 'unchanged';
    if (liveCount > 0) return 'queue';
    return 'commit';
}

/** `originId` của 'multi'/'groupMulti' từ mảng key/folderId. @param {string[]} keys @returns {string} */
function encodeVisualBgMultiOriginId(keys) {
    return JSON.stringify(keys);
}

/** Chiều ngược `encodeVisualBgMultiOriginId()`. JSON hỏng/không phải mảng -> [] (Workflow tự gỡ nguồn vì origin rỗng).
 * @param {string} originId @returns {string[]} */
function decodeVisualBgMultiOriginId(originId) {
    try {
        const parsed = JSON.parse(originId);
        return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
    } catch (e) {
        return [];
    }
}

/** Giữ key còn record (record đọc cả lô, thẳng hàng với keys). @param {string[]} keys @param {Array<object|undefined>} records
 * @returns {string[]} */
function keepVisualBgKeysWithRecords(keys, records) {
    return keys.filter((_, i) => records[i]);
}

/** Dựng item sắp xếp từ key + record + tên hiển thị (Workflow tra tên theo loại). Thiếu record -> tên = key, addedAt = 0.
 * @param {string[]} keys @param {Array<object|undefined>} records @param {Array<string|null>} names
 * @returns {Array<{key: string, name: string, addedAt: number}>} */
function buildVisualBgSortItems(keys, records, names) {
    return keys.map((k, i) => ({
        key: k,
        name: records[i] ? names[i] : k,
        addedAt: records[i] ? records[i].addedAt : 0,
    }));
}

/** Key đã sắp theo TÊN (A-Z / Z-A). @param {Array<{key: string, name: string}>} items @param {boolean} descending
 * @returns {string[]} */
function sortVisualBgKeysByName(items, descending) {
    return items.slice().sort((a, b) => {
        const cmp = (a.name || '').localeCompare(b.name || '', 'vi');
        return descending ? -cmp : cmp;
    }).map((it) => it.key);
}

/** Key đã sắp theo NGÀY THÊM (mới nhất / cũ nhất trước). @param {Array<{key: string, addedAt: number}>} items
 * @param {boolean} newestFirst @returns {string[]} */
function sortVisualBgKeysByAddedAt(items, newestFirst) {
    return items.slice().sort((a, b) => {
        const diff = (a.addedAt || 0) - (b.addedAt || 0);
        return newestFirst ? -diff : diff;
    }).map((it) => it.key);
}

// ===================== Picker multi-select (Video/Ảnh) =====================

/** Bấm 1 tile: đang chọn thì bỏ, chưa có thì thêm CUỐI (thứ tự mảng = thứ tự chọn). @param {string[]} keys @param {string} key
 * @returns {string[]} mảng MỚI */
function toggleVisualBgPickerKey(keys, key) {
    return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
}

/** `Map<key, số thứ tự>` để vẽ lại số trên MỌI tile đang chọn. @param {string[]} keys @returns {Map<string, number>} */
function buildVisualBgPickerOrderMap(keys) {
    return new Map(keys.map((k, i) => [k, i + 1]));
}

// ===================== "Seconds per video/photo" =====================

/** Khoảng picker (ms) quanh giá trị đang lưu. @param {number} durationSeconds
 * @returns {{valueMs: number, minMs: number, maxMs: number}} */
function buildVisualBgDurationPickerRange(durationSeconds) {
    return { valueMs: durationSeconds * 1000, minMs: VISUAL_BG_DURATION_SECONDS_MIN * 1000, maxMs: VISUAL_BG_DURATION_SECONDS_MAX * 1000 };
}

/** ms từ picker -> giây làm tròn 0.1s, tối thiểu 0.5s. @param {number} resultMs @returns {number} */
function computeVisualBgDurationSeconds(resultMs) {
    return Math.max(VISUAL_BG_DURATION_SECONDS_MIN, Math.round(resultMs / 100) / 10);
}

// ===================== Nền màu (solid / gradient) =====================

/** Giá trị số từ ô nhập; không hợp lệ -> null. @param {*} value @returns {number|null} */
function parseVisualBgFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

/** Giá trị field của 1 chặng màu: 'position' đổi sang số (không hợp lệ -> null), 'color' giữ nguyên chuỗi.
 * @param {'color'|'position'} field @param {*} value @returns {*} */
function parseVisualBgGradientStopValue(field, value) {
    const num = Number(value);
    return field === 'position' ? (Number.isFinite(num) ? num : null) : value;
}

/** Ghi 1 field của chặng `index`. Chặng không tồn tại -> trả nguyên mảng. @returns {Array<{color: string, position: number}>} */
function setVisualBgGradientStopField(stops, index, field, value) {
    if (!stops[index]) return stops;
    return stops.map((s, i) => (i === index ? { ...s, [field]: value } : s));
}

/** Còn thêm/bớt chặng được không. @param {number} count @returns {{canAdd: boolean, canRemove: boolean}} */
function computeVisualBgGradientStopLimits(count) {
    return { canAdd: count < VISUAL_BG_GRADIENT_MAX_STOPS, canRemove: count > VISUAL_BG_GRADIENT_MIN_STOPS };
}

/**
 * Chuỗi CSS `linear-gradient(...)` từ danh sách chặng — tự sắp theo `position` (CSS đọc đúng thứ tự viết).
 * @param {Array<{color: string, position: number}>} stops - `position` là % (0-100) @param {number} angleDeg - chuẩn CSS
 * @returns {string} '' nếu chưa đủ 2 chặng (nơi gọi tự rơi về nền đơn sắc).
 */
function buildVisualBgGradientCss(stops, angleDeg) {
    if (!Array.isArray(stops) || stops.length < VISUAL_BG_GRADIENT_MIN_STOPS) return '';
    const parts = stops.slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => `${s.color} ${s.position}%`);
    return `linear-gradient(${angleDeg}deg, ${parts.join(', ')})`;
}

/** Chèn 1 chặng vào khoảng trống RỘNG NHẤT giữa 2 chặng liền nhau (màu lặp chặng trái). Chạm trần -> trả bản sao. */
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

/** Bỏ 1 chặng theo vị trí. Đang ở mức tối thiểu -> trả bản sao. */
function removeVisualBgGradientStop(stops, index) {
    if (stops.length <= VISUAL_BG_GRADIENT_MIN_STOPS) return stops.slice();
    return stops.filter((_, i) => i !== index);
}

// ===================== Movement (xoay/giãn gradient theo thời gian hoặc nhạc) =====================

/** Movement chạy khi nền là gradient và đã bật. @param {object} cfg @returns {boolean} */
function shouldRunVisualBgGradientMovement(cfg) {
    return cfg.colorMode === 'gradient' && cfg.gradientMovement.enabled;
}

/** Góc xoay mode 'time' — đều theo thời gian, hết 1 vòng 360° sau `durationMs` rồi lặp.
 * @param {number} nowMs @param {number} startMs @param {number} durationMs @returns {number} 0-360 */
function computeGradientTimeRotateAngle(nowMs, startMs, durationMs) {
    if (durationMs <= 0) return 0;
    return (((nowMs - startMs) % durationMs) / durationMs) * 360;
}

/** Tiến độ 0-1 của 1 pha (xoay/giãn mode 'audio', chuyển màu "Tráo màu"). @param {number} nowMs @param {number} startMs
 * @param {number} durationMs @returns {{progress: number, done: boolean}} */
function computeGradientProgress(nowMs, startMs, durationMs) {
    const progress = Math.min(1, (nowMs - startMs) / durationMs);
    return { progress, done: progress >= 1 };
}

/** Nội suy [from,to] theo hệ số 0-1 — góc xoay lẫn độ giãn stop mode 'audio'. */
function lerpGradientMovementValue(from, to, factor01) {
    const clamped = Math.max(0, Math.min(1, factor01));
    return from + (to - from) * clamped;
}

/** Hệ số tốc độ 1 pha theo nhạc — BPM/energy cao chạy nhanh hơn (cùng công thức core/visualizer/types/space.js). */
function computeMusicSpeedFactor(bpm, energy01, min, max) {
    const factor = (bpm / 120) * (0.7 + energy01 * 0.6);
    return Math.max(min, Math.min(max, factor));
}

/** Thời lượng 1 pha (ms) = mốc BPM=120 chia hệ số tốc độ nhạc lúc chốt pha. */
function computeGradientPhaseDuration(baseDurationMs, musicSpeedFactor) {
    return baseDurationMs / musicSpeedFactor;
}

/** Easing vào/ra êm cho 1 pha. */
function easeInOutSine(progress01) {
    return -(Math.cos(Math.PI * progress01) - 1) / 2;
}

/** Co/giãn vị trí % các stop đối xứng quanh tâm 50% — tỷ lệ theo khoảng cách tới tâm, không đảo thứ tự; kẹp 0-100.
 * @param {Array<{color: string, position: number}>} stops @param {number} spreadPercent - 0-50 @returns {Array} mảng MỚI */
function computeGradientStopSpread(stops, spreadPercent) {
    if (!spreadPercent) return stops.slice();
    return stops.map((s) => {
        const distanceFromCenter = (s.position - 50) / 50;
        const shifted = s.position + distanceFromCenter * spreadPercent;
        return { ...s, position: Math.max(0, Math.min(100, Math.round(shifted))) };
    });
}

/** "Tráo màu" có tới lượt bắt đầu không: chưa có lượt nào đang chuyển và đã qua đủ `intervalMs` từ lượt trước. */
function isGradientColorSwapDue(swapStartMs, lastSwapMs, intervalMs, nowMs) {
    return swapStartMs === null && nowMs - lastSwapMs >= intervalMs;
}

/** 1 lượt "Tráo màu": đổi CHỖ màu giữa các stop (Fisher-Yates trên mảng số ngẫu nhiên Workflow truyền vào), giữ vị trí %.
 * @param {Array<{color: string, position: number}>} baseStops @param {number[]} randomFactors
 * @returns {{fromColors: string[], toColors: string[]}} */
function planGradientColorSwap(baseStops, randomFactors) {
    const fromColors = baseStops.map((s) => s.color);
    const toColors = fromColors.slice();
    for (let i = toColors.length - 1; i > 0; i--) {
        const j = Math.floor((randomFactors[i] || 0) * (i + 1));
        [toColors[i], toColors[j]] = [toColors[j], toColors[i]];
    }
    return { fromColors, toColors };
}

/** Gán màu (đã nội suy sẵn) vào bộ stop cùng vị trí %. @param {Array<{color: string, position: number}>} fromStops
 * @param {string[]} colors @returns {Array<{color: string, position: number}>} */
function applyGradientStopColors(fromStops, colors) {
    return fromStops.map((s, i) => ({ ...s, color: colors[i] || s.color }));
}

/** Ghi 1 khung gradient Movement lên #visualizer-solid-bg (hiệu ứng nhất thời, không đụng config — khác
 * updateDOMBackground(), core/color-utils.js). @param {string} gradientCss */
function applyGradientCssFrame(gradientCss) {
    visualizerSolidBg.style.backgroundImage = gradientCss;
}
