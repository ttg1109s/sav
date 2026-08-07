/**
 * core/visual-bg.js — Core THUẦN của domain "Visual Background" (v13, plan-v13-visual-background-
 * unification.md). Gộp phần thi hành của 3 tính năng nền màn Visualizer từng rời rạc (video nền
 * loop / ảnh nền tĩnh / slideshow album) — phần ĐIỀU PHỐI nằm ở event/workflow/visual-bg.js.
 *
 * File này KHÔNG có hậu tố `-ui` (Rule 5c) vì KHÔNG tự `createElement` cụm DOM nào — chỉ đọc/ghi
 * `classList`/`style`/`src` lên phần tử TĨNH có sẵn từ core/dom-refs.js (`bgVideoElement`,
 * `visualBgImageElement`, `visualizerSolidBg`).
 *
 * TUÂN THỦ Rule 1-5 (readme/core-function-conventions.md) — viết mới hoàn toàn, KHÔNG kế thừa nợ
 * kỹ thuật của `core/state-and-video-bg.js` cũ (các hàm `handleVideoBackground()`/
 * `enableVideoBackground()`/`disableVideoBackgroundState()`/`applyUploadedVideoBg()`/
 * `validateVideoBgOnClose()`/`applyVisualBgImage()`/`disableVisualBgImageState()` ĐÃ XOÁ HẲN — 2
 * vi phạm cụ thể bị loại bỏ: Core tự `appConfigViz.getAll()` (Rule 2) và Core gọi Core khác
 * (`handleVideoBackground()`/`saveConfig()`, Rule 3a)).
 *
 * NẠP SAU: service/state.js (appState), core/dom-refs.js (3 dom-ref trên).
 * NẠP TRƯỚC: event/workflow/visual-bg.js.
 */

/** 4 tổ hợp nguồn hợp lệ — dùng bởi Router (VirtualMachineState) + panel Settings. */
const VISUAL_BG_MEDIA_TYPES = ['color', 'image', 'video'];
const VISUAL_BG_COLOR_MODES = ['solid', 'gradient'];
/** Số chặng màu gradient tối thiểu/tối đa (Giang chốt: min 2, max 7). */
const VISUAL_BG_GRADIENT_MIN_STOPS = 2;
const VISUAL_BG_GRADIENT_MAX_STOPS = 7;
const VISUAL_BG_SOURCE_MODES = ['single', 'list'];
const VISUAL_BG_LIST_PLAYBACK_MODES = ['perSong', 'slideshow'];
const VISUAL_BG_NEXT_ORDERS = ['random', 'sequential', 'playlist'];
/** Số item TỐI THIỂU để 1 Album/Folder được coi là nguồn "danh sách" hợp lệ (Giang chốt, v13 Batch
 * B) — đúng 1 item thì không có gì để chuyển sang, bản chất vẫn là "1 ảnh/video cố định", nên phải
 * chọn nhánh `single` chứ không phải `list`. Dùng bởi CẢ Workflow (lọc danh sách trong picker) LẪN
 * `reconcileVisualBgConfigOnClose()` (làm sạch lúc đóng Settings). */
const VISUAL_BG_MIN_LIST_ITEMS = 2;

/**
 * Core THUẦN (không I/O, không đọc state, không gọi core khác) — "làm sạch" config Visual
 * Background lúc ĐÓNG Settings, gộp 2 tình huống Giang nêu thành 1 quy trình cascade DUY NHẤT
 * (plan mục 8):
 *   1. Bật `enabled` nhưng chưa chọn nguồn nào -> tự tắt `enabled`.
 *   2. Bật `sourceMode='list'` nhưng chưa chọn nguồn list -> lùi về `'single'`, RỒI kiểm tra tiếp:
 *      single có nguồn hợp lệ (đã chọn từ trước) -> giữ bật; single cũng rỗng -> tắt `enabled`.
 * Tình huống 1 chính là trường hợp riêng của 2 khi `sourceMode` vẫn đang là `'single'`.
 *
 * Rule 1 — ĐÚNG 1 tiến trình ("làm sạch config trước khi đóng"): 1 guard clause + 2 bước sửa NỐI
 * TIẾP cùng mục đích, KHÔNG phải rẽ nhánh giữa 2 nghiệp vụ khác nhau.
 * Rule 2 — nhận `cfg` qua tham số, KHÔNG tự `appConfigVisualBg.getAll()`; KHÔNG tự ghi lại state
 * (trả về bản đã sửa, Workflow tự `setAll()` nếu khác bản gốc).
 *
 * SỬA (v13 Batch B, yêu cầu Giang) — thêm `listSourceItemCount`: 1 Album/Folder chỉ là nguồn LIST
 * HỢP LỆ khi có > 1 item; đúng 1 item (hoặc 0) thì "danh sách" không còn ý nghĩa (không có gì để
 * chuyển sang) -> coi như chưa chọn, cascade tự lùi về `'single'`. Core KHÔNG tự đếm (Rule 2/3b:
 * đếm phải đọc DB = CHUẨN BỊ, việc của Workflow) — nhận sẵn con số qua tham số.
 * @param {object} cfg - snapshot `visualBgConfig` hiện tại (KHÔNG bị sửa tại chỗ).
 * @param {number} listSourceItemCount - số item THẬT của nguồn list đang chọn (0 nếu chưa chọn/mồ côi).
 * @returns {object} bản cfg MỚI đã làm sạch.
 */
function reconcileVisualBgConfigOnClose(cfg, listSourceItemCount) {
    const next = { ...cfg };
    if (!next.enabled) return next; // guard clause: đang tắt sẵn -> không có gì để làm sạch
    if (next.mediaType === 'color') return next; // guard: nền MÀU luôn có sẵn nguồn, không bao giờ "on ảo"

    const listRefEmpty = next.mediaType === 'video' ? !next.listFolderId : !next.listAlbumId;
    const listSourceEmpty = listRefEmpty || listSourceItemCount <= 1; // <=1 item: xem VISUAL_BG_MIN_LIST_ITEMS
    if (next.sourceMode === 'list' && listSourceEmpty) next.sourceMode = 'single';

    const singleSourceEmpty = next.mediaType === 'video' ? !next.singleVideoKey : !next.singleImageKey;
    if (next.sourceMode === 'single' && singleSourceEmpty) next.enabled = false;

    return next;
}

/**
 * Core THUẦN — nguồn hiện tại (theo `mediaType`×`sourceMode`) đã được chọn hay chưa. Dùng bởi
 * Workflow để quyết định có áp dụng nền hay chỉ hiển thị "Chưa chọn" trong panel Settings.
 * KHÔNG gọi từ `reconcileVisualBgConfigOnClose()` (Rule 3a cấm core gọi core) — logic ở đó viết
 * tường minh 2 dòng riêng, chấp nhận trùng lặp nhỏ đổi lấy ranh giới rõ ràng.
 * @param {object} cfg
 * @returns {string|null} key/id nguồn đang chọn, `null` nếu chưa chọn.
 */
function readVisualBgActiveSourceRef(cfg) {
    if (cfg.mediaType === 'video') {
        return cfg.sourceMode === 'list' ? (cfg.listFolderId || null) : (cfg.singleVideoKey || null);
    }
    return cfg.sourceMode === 'list' ? (cfg.listAlbumId || null) : (cfg.singleImageKey || null);
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

// ===================== Áp DOM — nền VIDEO (#bg-video) =====================

/**
 * Hiện video nền + gán nguồn. THAY nhánh "bật" của `handleVideoBackground()` cũ (di sản, đã xoá) —
 * khác 3 điểm: (1) nhận `objectUrl` qua tham số thay vì tự `appConfigViz.getAll()` (Rule 2);
 * (2) KHÔNG tự gọi `setupVideoBgSource()`/`syncVideoBgToAudio()`/`saveConfig()` (Rule 3a — Workflow
 * tự gọi từng hàm theo thứ tự); (3) LUÔN bật `loop` (Visual Background video LOOP liên tục, chỉ đổi
 * video khi bài hát đổi — plan mục 3).
 * Gán lại `src` chỉ khi URL THẬT SỰ đổi (`loadedUrl` do Workflow truyền vào) — tránh reload video
 * thừa mỗi lần Next/Prev, đúng ý đồ `setupVideoBgSource()` cũ.
 * @param {string} objectUrl - blob: URL của video nền.
 * @param {string|null} loadedUrl - URL đang gán sẵn trên thẻ (appState.visualBgVideoLoadedUrl).
 */
function showVisualBgVideoElement(objectUrl, loadedUrl) {
    if (!bgVideoElement || !objectUrl) return; // guard: chưa có nguồn -> không làm gì
    bgVideoElement.loop = true;
    bgVideoElement.classList.remove('hidden');
    if (loadedUrl === objectUrl && bgVideoElement.getAttribute('src') === objectUrl) return; // guard: đã đúng nguồn
    bgVideoElement.src = objectUrl;
    appState.set('visualBgVideoLoadedUrl', objectUrl);
    console.log(`writer: "showVisualBgVideoElement", page: "visualBgVideoLoadedUrl", content: "${objectUrl}"`);
}

/** Ẩn hẳn video nền + dọn nguồn khỏi thẻ. THAY nhánh "tắt" của `handleVideoBackground()` cũ. */
function hideVisualBgVideoElement() {
    if (!bgVideoElement) return; // guard: DOM chưa sẵn sàng
    bgVideoElement.pause();
    bgVideoElement.classList.add('hidden');
    bgVideoElement.removeAttribute('src');
    bgVideoElement.src = '';
    appState.set('visualBgVideoLoadedUrl', null);
    console.log(`writer: "hideVisualBgVideoElement", page: "visualBgVideoLoadedUrl", content: "null"`);
}

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

/**
 * Core THUẦN — tách 1 tập key thành phần ĐƯỢC PHÉP xoá và phần BỊ GIỮ LẠI vì đang làm Visual
 * Background. Dùng bởi các luồng xoá HÀNG LOẠT (delete mode ảnh, selection mode Playlist, xoá sạch
 * thư viện) — những luồng có target là 1 TẬP nên KHÔNG đăng ký Block gate: ref chỉ làm hỏng vài
 * phần tử, không hỏng cả thao tác, nên loại phần tử đó ra rồi xoá phần còn lại mới đúng.
 * (Ngược lại 4 luồng xoá ĐƠN — target nguyên khối — chặn hẳn ở event/block.js.)
 * Rule 2: nhận `protectedKey` qua tham số, KHÔNG tự đọc `appConfigVisualBg`.
 * @param {string[]} keys - tập key người dùng chọn xoá.
 * @param {string} protectedKey - key đang được tham chiếu ('' nếu không có).
 * @returns {{allowed: string[], blocked: string[]}}
 */
function splitVisualBgProtectedKeys(keys, protectedKey) {
    if (!protectedKey) return { allowed: keys.slice(), blocked: [] }; // guard: không có gì phải giữ
    return {
        allowed: keys.filter((k) => k !== protectedKey),
        blocked: keys.filter((k) => k === protectedKey),
    };
}

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
