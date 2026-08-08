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
 * Core thuần — bước 1 nhịp trong `source.list` (mảng key, có thể lẫn `null` = đã bị xoá, chờ dọn).
 * Gặp null: KHÔNG tự thử index kế (Giang chốt) — trả nguyên, chờ lần advance() sau (Workflow tự
 * đánh dấu null qua markVisualBgListItemMissing() sau khi đọc DB không thấy record).
 * Index tính ra rơi về 0 (hết 1 vòng): dọn null trong mảng TRƯỚC khi trả — "mảng mới, chạy lại từ đầu".
 * @param {Array<string|null>} list
 * @param {number} currentIndex - -1 nếu chưa phát gì
 * @param {boolean} isRandom - true nếu `nextOrder==='random'`; 'sequential'/'playlist' cùng bước tuần tự
 *   (chỉ khác THỨ TỰ mảng đã dựng sẵn lúc chọn/Làm tươi, không khác cách bước tiếp).
 * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn (self-heal).
 */
function advanceVisualBgList(list, currentIndex, isRandom) {
    if (list.length === 0) return { list, index: -1 };
    const nextIndex = isRandom
        ? pickNextSlideshowIndexRandom(currentIndex, list.length)      // core/file-manager/slideshow.js
        : pickNextSlideshowIndexSequential(currentIndex, list.length); // core/file-manager/slideshow.js
    if (nextIndex !== 0) return { list, index: nextIndex };
    const swept = list.filter((key) => key !== null);
    return { list: swept, index: swept.length > 0 ? 0 : -1 };
}

/** Core thuần — đánh dấu 1 vị trí trong `source.list` là mất (record không còn tồn tại). Trả mảng MỚI. */
function markVisualBgListItemMissing(list, index) {
    if (index < 0 || index >= list.length) return list;
    const next = list.slice();
    next[index] = null;
    return next;
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
