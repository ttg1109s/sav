/**
 * core/visual-bg.js — Core thuần domain "Visual Background". Phần điều phối ở event/workflow/
 * visual-bg.js (+ event/workflow/slideshow.js cho riêng render ảnh).
 * NẠP SAU: service/state.js, core/dom-refs.js. NẠP TRƯỚC: event/workflow/visual-bg.js.
 */

const VISUAL_BG_TYPES = ['photo', 'video'];
const VISUAL_BG_COLOR_MODES = ['solid', 'gradient'];
const VISUAL_BG_GRADIENT_MIN_STOPS = 2;
const VISUAL_BG_GRADIENT_MAX_STOPS = 7;
// MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement") — 2 mode LOẠI TRỪ NHAU, xem docstring
// core/config.js::DEFAULT_VISUAL_BG_CONFIG.gradientMovement.
const VISUAL_BG_GRADIENT_MOVEMENT_MODES = ['time', 'audio'];
const VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS = 1000; // picker "1s-60s" — dùng CHUNG cho rotateDurationMs LẪN colorSwapIntervalMs (CÙNG khoảng biên)
const VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS = 60000;
const VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS = 500; // picker "500ms-3s" — riêng colorSwapTransitionMs
const VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS = 3000;
const VISUAL_BG_GRADIENT_MOVEMENT_TICK_MS = 100; // nhịp tick animation — 10fps, đủ mượt cho xoay/chuyển màu chậm, nhẹ hơn hẳn 60fps (mode 'raf' CHỈ dành riêng cho render loop Visualizer, xem docstring service/task-manager.js)
const VISUAL_BG_GRADIENT_MOVEMENT_TASK = 'visualBgGradientMovement'; // tên task taskManager (Workflow dùng, xem event/workflow/visual-bg.js)
const VISUAL_BG_LIST_PLAYBACK_MODES = ['perSong', 'slideshow'];
const VISUAL_BG_NEXT_ORDERS = ['random', 'sequential', 'playlist'];
/** Số item tối thiểu để 1 Album/Folder đủ điều kiện làm nguồn "group" trong picker (Giang chốt: 2 —
 * đúng 1 item thì không có gì để chuyển sang, để chọn cũng chỉ thành `list.length===1` = phát tĩnh). */
const VISUAL_BG_MIN_LIST_ITEMS = 2;

// MỚI (13/08/2026, Giang yêu cầu — xoay gradient mượt theo PHA, không giật) — 1 pha = 1 lần xoay/
// giãn mượt từ giá trị hiện tại -> giá trị đích, chạy trọn `duration` rồi mới lấy mẫu nhạc CHỐT
// pha kế tiếp (xem event/workflow/visual-bg.js::_commitNextGradientPhase()). `duration` KHÔNG cố
// định — tính từ BPM/energy TẠI THỜI ĐIỂM chốt pha, CÙNG công thức core/visualizer/types/space.js
// dùng cho tốc độ xoay camera Space (Rule 1 — cùng khái niệm "tốc độ theo nhạc").
const VISUAL_BG_GRADIENT_PHASE_BASE_MS = 2000; // mốc tham chiếu ở BPM=120, energy trung bình
const VISUAL_BG_GRADIENT_MUSIC_FACTOR_MIN = 0.5; // nhạc chậm/yên tĩnh — pha chạy chậm hơn tối đa 2x
const VISUAL_BG_GRADIENT_MUSIC_FACTOR_MAX = 2.2; // nhạc nhanh/năng lượng cao — pha chạy nhanh hơn tối đa 2.2x

/**
 * Core thuần — áp `nextIndex` ĐÃ TÍNH SẴN (Workflow tự gọi `pickNextSlideshowIndexSequential()` —
 * DÙNG CHUNG cho CẢ 2 nextOrder từ 08/08/2026, xem docstring `shuffleVisualBgList()` ngay dưới —
 * rồi truyền vào đây. SỬA 08/08/2026, phản hồi Giang: trước đây hàm này TỰ gọi thuật toán chọn
 * index, core-gọi-core vi phạm Rule 3, dời việc chọn thuật toán ra
 * `workflowVisualBg.advanceList()`/`firstIndex()`, xem event/workflow/visual-bg.js) vào
 * `source.list` (mảng key, có thể lẫn `null` = đã bị xoá, chờ dọn).
 * `nextIndex===0` (vừa hết 1 vòng — mọi `nextOrder` giờ đều bước tuần tự qua mảng theo cùng 1 quy
 * ước, chỉ khác THỨ TỰ mảng đã dựng/xáo sẵn TRƯỚC lúc gọi hàm này): dọn null trong mảng TRƯỚC khi
 * trả — "mảng mới, chạy lại từ đầu". Gặp null: KHÔNG tự thử index kế (Giang chốt) — trả nguyên, chờ
 * lần advance() sau (Workflow tự đánh dấu null qua markVisualBgListItemMissing() sau khi đọc DB
 * không thấy record).
 * @param {Array<string|null>} list
 * @param {number} nextIndex - do Workflow tính sẵn (Rule 3 — core không tự chọn thuật toán).
 * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn (self-heal).
 */
function advanceVisualBgList(list, nextIndex) {
    if (list.length === 0) return { list, index: -1 };
    if (nextIndex !== 0) return { list, index: nextIndex };
    const swept = list.filter((key) => key !== null);
    return { list: swept, index: swept.length > 0 ? 0 : -1 };
}

/**
 * Core thuần — xáo ngẫu nhiên (Fisher-Yates) TOÀN BỘ `list`. VIẾT LẠI (08/08/2026, phản hồi Giang —
 * phát hiện bản `shuffleVisualBgListKeepingIndex()` cũ ("giữ nguyên vị trí đang phát rồi xáo phần
 * còn lại") KHÔNG có tác dụng thật: nơi gọi vẫn chọn item KẾ TIẾP bằng random ĐỀU trên TOÀN mảng mỗi
 * bước (`pickNextSlideshowIndexRandom()`, ĐÃ XOÁ cùng đợt — xem `workflowVisualBg.advanceList()`) —
 * xáo lại VỊ TRÍ LƯU TRỮ không đổi được phân phối của `Math.random()*length`, item nằm ở đâu trong
 * mảng không ảnh hưởng gì tới việc nó có được RÚT hay không. Với mảng nhỏ (2-3 item, trường hợp phổ
 * biến nhất của "Chọn nguồn") kiểu random-loại-trừ-liền-kề đó suy biến gần như tuần tự thuần (N=2:
 * BẮT BUỘC luân phiên, không có lựa chọn nào khác về mặt toán học) — đúng hiện tượng Giang báo "list
 * không hề random, lặp lại liên tục". Thay hẳn bằng shuffle-bag ĐÚNG NGHĨA: xáo cả mảng 1 lần, bước
 * TUẦN TỰ qua mảng đã xáo (dùng chung `pickNextSlideshowIndexSequential()`), hết 1 vòng mới xáo lại
 * — đảm bảo mọi item được phát ĐỦ 1 lượt trước khi lặp, xem `workflowVisualBg.advanceList()`.
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

// ===================== Audio riêng từng video trong source list (MỚI, 08/08/2026) =====================
// `source.videoAudio` — map videoKey -> { enabled, volumePercent }. 2 hàm dưới đây THUẦN đọc/ghi map
// đó (validate + clamp), KHÔNG đụng DOM/appState — Workflow (event/workflow/visual-bg.js) tự đọc
// appConfigVisualBg + tự gán `bgVideoElement.muted`/`.volume` sau khi gọi 2 hàm này (DOM 1 dòng, cùng
// khuôn `bgVideoElement.muted = true` cũ trước đây viết thẳng ở Workflow, không cần core riêng).

const VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN = 0;
const VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX = 100;
const VISUAL_BG_VIDEO_AUDIO_DEFAULT = Object.freeze({ enabled: false, volumePercent: 50 });

/**
 * Core thuần — đọc cấu hình audio của 1 video trong map, trả mặc định (`enabled:false,
 * volumePercent:50`) nếu chưa có/dữ liệu hỏng (guard clause thuần, KHÔNG phải rẽ nhánh nghiệp vụ).
 * @param {Object<string, {enabled: boolean, volumePercent: number}>} videoAudioMap
 * @param {string} videoKey
 * @returns {{enabled: boolean, volumePercent: number}}
 */
function getVisualBgVideoAudioSetting(videoAudioMap, videoKey) {
    const entry = videoAudioMap ? videoAudioMap[videoKey] : null;
    if (!entry || typeof entry !== 'object') return { ...VISUAL_BG_VIDEO_AUDIO_DEFAULT };
    const enabled = typeof entry.enabled === 'boolean' ? entry.enabled : VISUAL_BG_VIDEO_AUDIO_DEFAULT.enabled;
    const rawVolume = typeof entry.volumePercent === 'number' ? entry.volumePercent : VISUAL_BG_VIDEO_AUDIO_DEFAULT.volumePercent;
    const volumePercent = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, rawVolume));
    return { enabled, volumePercent };
}

/**
 * Core thuần — patch cấu hình audio của 1 video vào map, trả map MỚI (không sửa map gốc). Nhận
 * `current` qua tham số (Workflow tự gọi `getVisualBgVideoAudioSetting()` trước — Rule 3b, core
 * không được tự gọi core khác) làm nền, `patch` đè lên trên rồi mới validate/clamp lại.
 * @param {Object<string, {enabled: boolean, volumePercent: number}>} videoAudioMap
 * @param {string} videoKey
 * @param {{enabled: boolean, volumePercent: number}} current - Workflow đọc sẵn qua getVisualBgVideoAudioSetting().
 * @param {{enabled?: boolean, volumePercent?: number}} patch
 * @returns {Object<string, {enabled: boolean, volumePercent: number}>} map MỚI.
 */
function setVisualBgVideoAudioSetting(videoAudioMap, videoKey, current, patch) {
    const merged = { ...current, ...patch };
    const enabled = typeof merged.enabled === 'boolean' ? merged.enabled : VISUAL_BG_VIDEO_AUDIO_DEFAULT.enabled;
    const rawVolume = typeof merged.volumePercent === 'number' ? merged.volumePercent : VISUAL_BG_VIDEO_AUDIO_DEFAULT.volumePercent;
    const volumePercent = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, rawVolume));
    return { ...(videoAudioMap || {}), [videoKey]: { enabled, volumePercent } };
}

// FIX (12/08/2026, Giang báo "video bg 50% đã át gần hết tiếng song") — 100% trên UI/DB (thang đo
// người dùng thấy + gõ vào picker) GIỮ NGUYÊN 0-100 như cũ (KHÔNG đổi ý nghĩa `volumePercent` lưu
// DB, tránh vỡ dữ liệu cũ + hiển thị "100%" vẫn đúng "100%" trên UI) — CHỈ trần GAIN THẬT áp vào
// bgVideoElement.volume/GainNode ở 90% để luôn còn "chỗ thở" cho tiếng bài hát chính dù người dùng
// kéo audio video nền lên tối đa. 1 hàm THUẦN riêng (KHÔNG sửa 2 hàm get/set ở trên — 2 hàm đó chỉ
// validate/clamp con số LƯU DB 0-100, không phải nơi tính gain thật) — Workflow (event/workflow/
// visual-bg.js) gọi hàm NÀY thay vì tự chia `volumePercent / 100` như trước ở 2 chỗ gán
// bgVideoElement.volume/setVideoBgGain() (core/video-player.js).
const VISUAL_BG_VIDEO_AUDIO_GAIN_CEILING = 0.9;

/** Core thuần — đổi `volumePercent` (0-100, thang UI/DB) sang gain thật (0-0.9) áp vào
 * bgVideoElement.volume/GainNode — trần cố định 90%, xem giải thích ở comment ngay trên.
 * @param {number} volumePercent - 0-100 @returns {number} 0-0.9 */
function resolveVisualBgVideoAudioGain(volumePercent) {
    const clamped = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, volumePercent));
    return (clamped / 100) * VISUAL_BG_VIDEO_AUDIO_GAIN_CEILING;
}

// ===================== Áp DOM — nền ẢNH tĩnh (#visual-bg-image) =====================

/**
 * DỜI NGUYÊN từ `core/state-and-video-bg.js` (v13 Batch A — hàm này thuộc domain Visual
 * Background, không còn lý do sống lẫn trong file state playlist/video di sản). GIỮ NGUYÊN 100%
 * thân hàm + hành vi: chỉ `.hidden` (display:none) quyết định hiện/ẩn, KHÔNG dùng `style.opacity`
 * (đổi từ 30/07/2026 — Video Player mode cần "cưỡng chế hiện" lớp này tức thời làm khung chớp
 * thumb, xem core/video-player.js::forceShowVisualBgImageForVideoPlayer()).
 * Rule 2: nhận `objectUrl` qua tham số, KHÔNG tự đọc state/DB.
 * @param {boolean} enabled
 * @param {string} objectUrl - '' hoặc URL không hợp lệ -> coi như ẩn (guard clause thuần).
 */
function applyVisualBgImageToDOM(enabled, objectUrl) {
    if (!visualBgImageElement) return; // guard: DOM chưa sẵn sàng (hiếm, race lúc mount)
    if (enabled && objectUrl) {
        visualBgImageElement.style.backgroundImage = `url(${objectUrl})`;
        visualBgImageElement.classList.remove('hidden');
    } else {
        visualBgImageElement.classList.add('hidden');
    }
}

// ===================== Nền VIDEO (#bg-video) — XOÁ khỏi file này =====================
// XOÁ (Giang chốt — bỏ hẳn hành vi video tự viết ở Visual Background) — `showVisualBgVideoElement()`/
// `setVisualBgVideoVisible()`/`hideVisualBgVideoElement()` (3 hàm core DOM riêng cho `bgVideoElement`)
// ĐÃ XOÁ HẲN khỏi file này. Toàn bộ vòng đời `bgVideoElement` (đổi nguồn/ẩn/hiện/dọn object URL) giờ
// sống ĐÚNG 1 NƠI DUY NHẤT: `workflowVideoPlayer` (event/workflow/video-player.js —
// `swapBgVideoSource()`/`waitBgVideoReady()`/`clearBgVideoSource()`), dùng CHUNG cho cả Video Player
// mode thật LẪN Visual Background trang trí (event/workflow/visual-bg.js gọi liên tuyến domain) —
// trước đây 2 nơi tự viết 2 bản riêng, lệch hành vi + lặp lại đúng loại bug (chớp đen) nhiều lần.

/**
 * Đồng bộ play/pause của video nền theo nhạc — KHÔNG đụng src/hidden (2 việc khác nhau, tách hàm
 * theo Rule 1). Gọi mỗi lần nhạc play/pause hoặc Next/Prev.
 * @param {boolean} isAudioPaused - `audioPlayer.paused` do Workflow đọc sẵn (Rule 2).
 */
function syncVisualBgVideoPlayback(isAudioPaused) {
    if (!bgVideoElement || bgVideoElement.classList.contains('hidden')) return; // guard: video nền đang không hiện
    if (isAudioPaused) bgVideoElement.pause(); else bgVideoElement.play().catch(() => {});
}

// NỀN ĐEN cưỡng chế phía sau video nền: KHÔNG viết core riêng ở đây — `updateDOMBackground()`
// (core/color-utils.js) đã là chủ sở hữu DUY NHẤT của màu `#visualizer-solid-bg` và đã tự đọc
// `visualBgConfig` để quyết định đen/màu cấu hình. Workflow domain này gọi THẲNG hàm đó (liên
// tuyến domain, event-bus-flow.md mục 3a) thay vì tạo 1 core song song cùng ghi 1 thuộc tính.

// ===================== Thứ tự nguồn kế tiếp trong 1 LIST (nextOrder='playlist') =====================
// Song song `sortKeysByMode()` (core/playlist/order.js) nhưng chạy trên danh sách ẢNH/VIDEO của
// Album/Folder đang chọn — KHÔNG tái dùng thẳng hàm đó được vì input khác hẳn (ảnh không có
// `songNameIndex`/`playlistCache`). CÙNG TIÊU CHÍ sắp xếp với `displaySortMode` của Playlist:
// Workflow đọc `appConfigPlaylist.getAll().displaySortMode` tại thời điểm build order rồi tự chọn
// gọi hàm nào — KHÔNG lưu 1 bản sao riêng của lựa chọn đó.
//
// TÁCH 2 hàm (KHÔNG gộp 1 hàm rồi if/else theo `mode`) — "sắp theo TÊN" và "sắp theo NGÀY THÊM" là
// 2 tiến trình nghiệp vụ khác nhau (Rule 1, đúng khuôn pickNextSlideshowIndexSequential/Random đã
// tách sẵn ở core/file-manager/slideshow.js). Tham số `descending` KHÔNG phải rẽ nhánh tiến trình —
// cùng 1 phép so sánh, chỉ đổi dấu.

/**
 * Core thuần: sắp danh sách item nền theo TÊN hiển thị (A-Z / Z-A). Không sửa mảng gốc.
 * @param {Array<{name: string}>} items
 * @param {boolean} descending - true = Z-A.
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
 * @param {Array<{addedAt: number}>} items
 * @param {boolean} newestFirst
 * @returns {Array} mảng MỚI đã sắp.
 */
function sortVisualBgItemsByAddedAt(items, newestFirst) {
    return items.slice().sort((a, b) => {
        const diff = (a.addedAt || 0) - (b.addedAt || 0);
        return newestFirst ? -diff : diff;
    });
}

// XOÁ (v14) — `splitVisualBgProtectedKeys()` không còn ai gọi: 2 luồng xoá hàng loạt
// (file-manager-photo.js/playlist.js) đã bỏ hẳn khái niệm "bảo vệ item đang tham chiếu" (self-heal
// lười thay thế, xem event/workflow/visual-bg.js::_markCurrentMissing()).

/**
 * Core THUẦN — dựng chuỗi CSS `linear-gradient(...)` từ danh sách chặng màu.
 * Tự sắp theo `position` tăng dần TRƯỚC khi ghép: CSS đọc các chặng theo đúng thứ tự viết ra, nếu
 * người dùng kéo chặng thứ 3 về trước chặng thứ 2 mà không sắp lại thì trình duyệt kẹp chúng dính
 * vào nhau (ra vạch cứng thay vì chuyển màu). Sắp xếp là MỘT PHẦN của việc dựng chuỗi, không phải
 * tiến trình thứ hai — vẫn đúng Rule 1.
 * @param {Array<{color: string, position: number}>} stops - 2..7 chặng, `position` là % (0-100).
 * @param {number} angleDeg - góc xoay, chuẩn CSS (0deg = từ dưới lên trên).
 * @returns {string} '' nếu chưa đủ 2 chặng (nơi gọi tự rơi về nền đơn sắc).
 */
function buildVisualBgGradientCss(stops, angleDeg) {
    if (!Array.isArray(stops) || stops.length < VISUAL_BG_GRADIENT_MIN_STOPS) return ''; // guard
    const parts = stops.slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => `${s.color} ${s.position}%`);
    return `linear-gradient(${angleDeg}deg, ${parts.join(', ')})`;
}

/**
 * Core THUẦN — chèn 1 chặng màu mới vào danh sách, đặt ở KHOẢNG TRỐNG RỘNG NHẤT giữa 2 chặng liền
 * nhau (màu lấy trung bình 2 đầu mút thì phải nội suy — không làm, chỉ lặp màu chặng bên trái để
 * người dùng tự đổi). Trả mảng MỚI; trả nguyên mảng cũ nếu đã chạm trần.
 * @param {Array<{color: string, position: number}>} stops
 * @returns {Array<{color: string, position: number}>}
 */
function addVisualBgGradientStop(stops) {
    if (stops.length >= VISUAL_BG_GRADIENT_MAX_STOPS) return stops.slice(); // guard: đã đủ 7
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
 * Core THUẦN — bỏ 1 chặng màu theo vị trí trong mảng. Trả nguyên mảng cũ nếu đang ở mức tối thiểu
 * (gradient cần ít nhất 2 chặng mới có nghĩa).
 * @param {Array<{color: string, position: number}>} stops
 * @param {number} index
 * @returns {Array<{color: string, position: number}>}
 */
function removeVisualBgGradientStop(stops, index) {
    if (stops.length <= VISUAL_BG_GRADIENT_MIN_STOPS) return stops.slice(); // guard: không xuống dưới 2
    return stops.filter((_, i) => i !== index);
}

// ===================== Movement (MỚI, 12/08/2026, Giang yêu cầu mục 6) =====================
// 4 hàm THUẦN dưới đây phục vụ event/workflow/visual-bg.js::_tickGradientMovement() — KHÔNG hàm
// nào tự đọc appState/Date.now(), mọi input qua tham số (Rule 1/2), KHÔNG hàm nào gọi hàm core
// khác (Rule 3, kể cả buildVisualBgGradientCss() ở trên — Workflow tự gọi RIÊNG từng hàm rồi mới
// gọi buildVisualBgGradientCss() với kết quả).

/** Góc xoay mode 'time' — chạy ĐỀU theo thời gian, hết đúng 1 vòng 360° sau `durationMs` rồi lặp
 * lại (KHÔNG dùng easing — tuyến tính, đúng nghĩa "kim đồng hồ").
 * @param {number} elapsedMs - thời gian đã trôi kể từ lúc bật Movement (KHÔNG phải Date.now() thô
 *        — Workflow tự trừ mốc bắt đầu trước khi truyền vào, xem docstring _tickGradientMovement()).
 * @param {number} durationMs - 1000-60000, thời gian hết 1 vòng.
 * @returns {number} 0-360 */
function computeGradientTimeRotateAngle(elapsedMs, durationMs) {
    if (durationMs <= 0) return 0;
    return ((elapsedMs % durationMs) / durationMs) * 360;
}

/** Nội suy tuyến tính 1 giá trị trong khoảng [from,to] theo hệ số 0-1 — DÙNG CHUNG cho cả góc xoay
 * LẪN độ giãn stop ở mode 'audio' (2 phép tính CÙNG BẢN CHẤT toán học, khác đơn vị/khoảng giá trị —
 * xem Rule 1 "cùng process, khác giá trị vẫn là 1 hàm"). smoothedEnergy ĐÃ 0-1 sẵn (core/
 * audio-analysis.js), không cần chuẩn hoá thêm ở đây.
 * @param {number} from @param {number} to @param {number} factor01 - 0-1 (smoothedEnergy)
 * @returns {number} */
function lerpGradientMovementValue(from, to, factor01) {
    const clamped = Math.max(0, Math.min(1, factor01));
    return from + (to - from) * clamped;
}

/** Hệ số tốc độ 1 pha xoay/giãn gradient theo nhạc — BPM cao/energy cao chạy NHANH hơn (hệ số >1),
 * ngược lại CHẬM hơn (hệ số <1) — CÙNG công thức core/visualizer/types/space.js dùng cho tốc độ
 * xoay camera Space, tái dùng Ở ĐÂY cho 1 khái niệm domain khác (Rule 1). */
function computeMusicSpeedFactor(bpm, energy01, min, max) {
    const factor = (bpm / 120) * (0.7 + energy01 * 0.6);
    return Math.max(min, Math.min(max, factor));
}

/** Thời lượng 1 pha (ms) — `baseDurationMs` (mốc tham chiếu BPM=120) chia cho hệ số tốc độ nhạc,
 * tính TẠI THỜI ĐIỂM pha cũ vừa xong (Giang chốt: KHÔNG hằng số cố định, lấy theo BPM lúc đó). */
function computeGradientPhaseDuration(baseDurationMs, musicSpeedFactor) {
    return baseDurationMs / musicSpeedFactor;
}

/** Easing vào/ra êm cho 1 pha xoay/giãn — tránh cảm giác "máy móc" của nội suy tuyến tính thô. */
function easeInOutSine(progress01) {
    return -(Math.cos(Math.PI * progress01) - 1) / 2;
}

/** Co/giãn vị trí % của các stop ĐỐI XỨNG QUANH TÂM 50% — `spreadPercent` càng lớn, stop càng
 * "toé" xa tâm (stop < 50% dịch XUỐNG thêm, stop > 50% dịch LÊN thêm, tỷ lệ theo khoảng cách hiện
 * tại tới tâm) — tạo cảm giác gradient "thở" theo nhạc mà KHÔNG đảo thứ tự stop cho nhau (an toàn,
 * không cần sort lại). Kẹp cứng 0-100 sau khi dịch (biên vật lý của CSS %).
 * @param {Array<{color: string, position: number}>} stops @param {number} spreadPercent - 0-50
 * @returns {Array<{color: string, position: number}>} mảng MỚI */
function computeGradientStopSpread(stops, spreadPercent) {
    if (!spreadPercent) return stops.slice();
    return stops.map((s) => {
        const distanceFromCenter = (s.position - 50) / 50; // -1..1
        const shifted = s.position + distanceFromCenter * spreadPercent;
        return { ...s, position: Math.max(0, Math.min(100, Math.round(shifted))) };
    });
}

/** "Tráo màu ngẫu nhiên" — đổi CHỖ màu cho nhau giữa các stop (Fisher-Yates), GIỮ NGUYÊN vị trí %
 * (chỉ hoán vị mảng màu, không đụng position) — KHÔNG nhận `random` qua tham số kiểu hàm (core
 * không nhận callback sống, Rule 3d) mà nhận THẲNG 1 mảng số ngẫu nhiên ĐÃ TẠO SẴN (Workflow tự
 * `Math.random()` rồi truyền vào — giữ hàm này THUẦN, test được, không side-effect ẩn).
 * @param {Array<{color: string, position: number}>} stops
 * @param {number[]} randomFactors - CÙNG độ dài `stops`, mỗi phần tử 0-1 (Workflow tự Math.random())
 * @returns {Array<{color: string, position: number}>} mảng MỚI, position GIỮ NGUYÊN theo thứ tự gốc */
function shuffleGradientStopColors(stops, randomFactors) {
    const colors = stops.map((s) => s.color);
    for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor((randomFactors[i] || 0) * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return stops.map((s, i) => ({ ...s, color: colors[i] }));
}

/** Nội suy màu CHÉO giữa 2 bộ stop CÙNG vị trí % (chỉ khác màu) — dùng cho hiệu ứng chuyển cảnh
 * mượt lúc "tráo màu" (colorSwapTransitionMs). DÙNG LẠI interpolateColor() (core/color-utils.js,
 * CÙNG FILE core layer khác — VI PHẠM Rule 3 nếu gọi trực tiếp!) — KHÔNG, hàm NÀY nhận màu ĐÃ NỘI
 * SUY qua tham số `interpolatedColors` (Workflow tự gọi interpolateColor() cho từng cặp rồi truyền
 * mảng kết quả vào đây) — hàm này chỉ GHÉP mảng màu đã tính sẵn vào ĐÚNG position của `fromStops`,
 * giữ đúng Rule 3 (không core gọi core).
 * @param {Array<{color: string, position: number}>} fromStops - dùng vị trí % (position GIỮ NGUYÊN)
 * @param {string[]} interpolatedColors - CÙNG độ dài fromStops, màu ĐÃ nội suy sẵn (rgb(...) string)
 * @returns {Array<{color: string, position: number}>} */
function applyGradientStopColors(fromStops, interpolatedColors) {
    return fromStops.map((s, i) => ({ ...s, color: interpolatedColors[i] || s.color }));
}

/** Core thuần — ghi TRỰC TIẾP 1 chuỗi CSS gradient (ĐÃ dựng sẵn qua buildVisualBgGradientCss(),
 * Workflow tự gọi TRƯỚC rồi truyền chuỗi vào đây — Rule 3, không core gọi core dù cùng file) lên
 * #visualizer-solid-bg — dùng cho Movement (mỗi tick animation), KHÔNG đọc/ghi appConfigVisualBg
 * (khác updateDOMBackground(), core/color-utils.js — hàm ĐÓ đọc cfg LƯU DB; giá trị Movement mỗi
 * khung hình chỉ là hiệu ứng NHẤT THỜI, không nên ép ghi ngược DB liên tục).
 * @param {string} gradientCss */
function applyGradientCssFrame(gradientCss) {
    visualizerSolidBg.style.backgroundImage = gradientCss;
}

/** Fill style NỀN VBG hiện tại, SẴN SÀNG gán `ctx.fillStyle` — solid: trả thẳng hex string.
 * gradient: dựng CanvasGradient khớp ĐÚNG khung hình đang hiển thị (đọc khung Movement LIVE nếu
 * đang chạy — appState `visualBgGradientLiveAngle`/`visualBgGradientLiveStops`, ghi bởi
 * event/workflow/visual-bg.js::_tickGradientMovement() — tĩnh gradientAngleDeg/gradientStops nếu
 * Movement tắt). Dùng bởi visual 2D cần tô nền theo màu VBG thay vì bịa màu riêng — xem
 * core/visualizer/types/rain.js. @param {CanvasRenderingContext2D} ctx @param {number} width
 * @param {number} height */
function getVisualBgFillStyle(ctx, width, height) {
    const vb = appConfigVisualBg.getAll();
    if (vb.colorMode !== 'gradient') return vb.solidColor;
    const liveAngle = appState.get('visualBgGradientLiveAngle');
    const liveStops = appState.get('visualBgGradientLiveStops');
    const angle = liveAngle !== null ? liveAngle : vb.gradientAngleDeg;
    const stops = liveStops || vb.gradientStops;
    return buildCanvasLinearGradient(ctx, angle, width, height, stops); // core/color-utils.js
}
