/**
 * core/visual-bg.js — Core thuần domain "Visual Background". Phần điều phối ở event/workflow/
 * visual-bg.js (+ event/workflow/slideshow.js cho riêng render ảnh).
 * NẠP SAU: service/state.js, core/dom-refs.js. NẠP TRƯỚC: event/workflow/visual-bg.js.
 */

const VISUAL_BG_TYPES = ['photo', 'video'];
const VISUAL_BG_COLOR_MODES = ['solid', 'gradient'];
const VISUAL_BG_GRADIENT_MIN_STOPS = 2;
const VISUAL_BG_GRADIENT_MAX_STOPS = 7;
const VISUAL_BG_LIST_PLAYBACK_MODES = ['perSong', 'slideshow'];
const VISUAL_BG_NEXT_ORDERS = ['random', 'sequential', 'playlist'];
/** Số item tối thiểu để 1 Album/Folder đủ điều kiện làm nguồn "group" trong picker (Giang chốt: 2 —
 * đúng 1 item thì không có gì để chuyển sang, để chọn cũng chỉ thành `list.length===1` = phát tĩnh). */
const VISUAL_BG_MIN_LIST_ITEMS = 2;

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
