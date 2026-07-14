/**
 * core/file-manager/photo-ui.js — Vẽ UI Photo & Album (Batch 3, 03/07/2026): story slider album
 * (lazy load avatar qua IntersectionObserver — mục 3 yêu cầu gốc) + masonry ảnh (CSS `columns`
 * thuần, không thêm lib — xem plan-v12-multimedia-decisions.md mục 3, câu hỏi #6 đã đóng: chưa
 * thấy lý do cần lib JS masonry cho khối lượng ảnh cá nhân). Hàm THUẦN (không I/O, không appState)
 * — nơi gọi (workflow) tự đọc DB rồi truyền dữ liệu vào, đúng nguyên tắc core/file-manager/
 * folder-list-ui.js/folder-detail-ui.js đã theo.
 *
 * Object URL: TẠO LÚC LAZY-LOAD (Intersection vào viewport), LƯU trên chính node
 * (`node._objectUrl`), REVOKE khi node bị gỡ khỏi DOM (vẽ lại toàn bộ list) — cùng pattern
 * `_coverObjectUrl` đã dùng ở core/playlist/render.js.
 *
 * NẠP SAU: lang/lang.js (t()). Batch D6 (06/07/2026): panel Photo giờ push/pop động (core/
 * settings-panel-stack.js) — `renderAlbumStory`/`renderImageMasonry`/`updateImageSelectionCount`
 * KHÔNG còn phụ thuộc core/dom-refs.js (fileManagerAlbumStory/fileManagerImageMasonry/
 * fileManagerImageEmpty/fileManagerImageSelectionCount ĐÃ XOÁ khỏi file đó) — nhận phần tử DOM qua
 * tham số. `toggleImageSelectionBadge()` dùng `_masonryContainerEl` (bookkeeping nội bộ có sẵn).
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): `renderImageMasonry()` nhận thêm 2 tham số tuỳ chọn (selectionMode/
 * selectedImageKeys) để vẽ dấu tick chọn nhiều; `openRenameAlbumModal()` — đổi tên album, cùng
 * khuôn `openRenameFolderModal()`.
 *
 * MỚI (Batch 8, 03/07/2026, slideshow nền Visual): `openAlbumPickerModal()` — picker chọn 1 ALBUM
 * (khác `openImageLibraryPickerModal()` chọn 1 ẢNH), dùng bởi Slideshow Settings Drawer.
 *
 * VIẾT LẠI (Batch 9, 04/07/2026, mục 4 phản hồi Giang): `openAlbumPickerModal()` (modal tối toàn
 * màn hình) ĐÃ XOÁ, thay bằng `renderSlideshowAlbumPickerGrid()` — chỉ vẽ GRID album hình TRÒN vào
 * panel TĨNH kiểu "notify center" đã mount sẵn (components/slideshow-settings-drawer.js, TÁI DÙNG
 * class `.glass-control-center`).
 *
 * FIX (04/07/2026, mục 1 phản hồi Giang): `openImageLibraryPickerModal()` thêm tham số `onCancel`
 * (tuỳ chọn) — gọi khi đóng modal mà CHƯA chọn ảnh nào, để nơi gọi tự trả toggle "On" về "off".
 *
 * PATCH 1 mục 1 (14/07/2026, group ảnh theo ngày tải lên — theo ảnh chụp Google Photos Giang gửi):
 * `renderImageMasonry()` giờ tự sắp xếp `images` theo `addedAt` MỚI NHẤT lên đầu trước khi render,
 * và `_loadNextMasonryChunk()` tự chèn 1 header ngăn cách NGÀY (full-width, `_buildMasonryDateHeaderTile()`)
 * ngay trước ảnh ĐẦU TIÊN của mỗi ngày mới trong lúc build từng chunk — TÁI DÙNG NGUYÊN cơ chế chunk
 * hiện có (KHÔNG đổi `MASONRY_CHUNK_SIZE`/collapse/expand — việc rà lại toàn bộ windowing để "Item +
 * window ảo" là mục 2, CHƯA làm ở patch này). Header KHÔNG nằm trong mảng `tiles` bookkeeping nên
 * không bao giờ bị thu gọn cùng chunk. Áp dụng cho MỌI nơi gọi `renderImageMasonry()` (Photo & Album
 * LẪN `openPhotoUiImagePickerModal()` — cùng 1 hàm dùng chung, xem mục "Picker cover bài hát" ở
 * dưới), do đó picker chọn ảnh bìa bài hát cũng tự có nhóm theo ngày, không cần code riêng.
 */

// ===================== Story slider Album =====================

/**
 * @param {Array<{id: string, name: string, imageKeys: string[]}>} albums
 * @param {string|null} activeAlbumId - album đang lọc (null = "Tất cả")
 * @param {Map<string, Object>} imageRecordsByKey - key -> {blob,...}, dùng lấy ảnh đại diện đầu
 *        tiên của mỗi album mà KHÔNG cần đọc DB lại (workflow đã có sẵn từ listImages()).
 * @param {HTMLElement} storyEl - Batch D6 (06/07/2026): panel Photo giờ push/pop động (core/
 *        settings-panel-stack.js) — nhận qua tham số thay vì dom-refs tĩnh `fileManagerAlbumStory`.
 */
function renderAlbumStory(albums, activeAlbumId, imageRecordsByKey, storyEl) {
    if (!storyEl) return; // guard

    // Revoke toàn bộ object URL cũ trước khi xoá DOM (tránh rò rỉ bộ nhớ — cùng pattern renderPlaylistDiff)
    storyEl.querySelectorAll('[data-has-object-url]').forEach((node) => {
        if (node._objectUrl) { try { URL.revokeObjectURL(node._objectUrl); } catch (e) {} }
    });
    storyEl.innerHTML = '';

    // ── "Tất cả" (bỏ lọc) ──────────────────────────────────────────────────────────────────
    const allItem = document.createElement('button');
    allItem.dataset.albumStoryAction = 'all';
    allItem.className = 'flex flex-col items-center gap-1.5 shrink-0 snap-start w-16';
    const allCircle = document.createElement('div');
    allCircle.className = `w-14 h-14 rounded-full flex items-center justify-center border-2 transition-colors ${activeAlbumId === null ? 'border-sky-400 bg-sky-500/20' : 'border-white/15 bg-white/5'}`;
    allCircle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>';
    allItem.appendChild(allCircle);
    const allLabel = document.createElement('span');
    allLabel.className = `text-[11px] truncate w-full text-center ${activeAlbumId === null ? 'text-sky-300 font-semibold' : 'text-slate-400'}`;
    allLabel.textContent = t('fileManager.photo.album.all');
    allItem.appendChild(allLabel);
    storyEl.appendChild(allItem);

    // ── Từng album ─────────────────────────────────────────────────────────────────────────
    albums.forEach((album) => {
        const isActive = album.id === activeAlbumId;
        const item = document.createElement('button');
        item.dataset.albumStoryAction = 'select';
        item.dataset.albumId = album.id;
        item.className = 'flex flex-col items-center gap-1.5 shrink-0 snap-start w-16';

        const circle = document.createElement('div');
        circle.dataset.hasObjectUrl = '1';
        circle.className = `w-14 h-14 rounded-full overflow-hidden flex items-center justify-center border-2 transition-colors bg-white/5 ${isActive ? 'border-sky-400' : 'border-white/15'}`;
        // Placeholder icon trước khi lazy-load ảnh đại diện
        circle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
        const firstImageKey = album.imageKeys.find((k) => imageRecordsByKey.has(k));
        if (firstImageKey) {
            _observeLazyThumbnail(circle, imageRecordsByKey.get(firstImageKey).blob);
        }
        item.appendChild(circle);

        const label = document.createElement('span');
        label.className = `text-[11px] truncate w-full text-center ${isActive ? 'text-sky-300 font-semibold' : 'text-slate-400'}`;
        label.textContent = album.name;
        item.appendChild(label);

        storyEl.appendChild(item);
    });

    // ── "+" tạo album mới ──────────────────────────────────────────────────────────────────
    const newItem = document.createElement('button');
    newItem.dataset.albumStoryAction = 'create';
    newItem.className = 'flex flex-col items-center gap-1.5 shrink-0 snap-start w-16';
    const newCircle = document.createElement('div');
    newCircle.className = 'w-14 h-14 rounded-full flex items-center justify-center border-2 border-dashed border-white/20 text-slate-400';
    newCircle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>';
    newItem.appendChild(newCircle);
    const newLabel = document.createElement('span');
    newLabel.className = 'text-[11px] text-slate-400 truncate w-full text-center';
    newLabel.textContent = t('fileManager.photo.album.new');
    newItem.appendChild(newLabel);
    storyEl.appendChild(newItem);
}

// ===================== Masonry ảnh =====================

/**
 * VIẾT LẠI HOÀN TOÀN (04/07/2026, mục 3 phản hồi Giang — "layout đang rất bullshit"):
 *   1. Layout đổi từ CSS `columns` (masonry cột, thứ tự duyệt LỆCH theo cột — xem
 *      components/file-manager.js) sang GRID Ô VUÔNG ĐỀU (`grid grid-cols-3 sm:grid-cols-4`,
 *      mỗi tile `aspect-square` + `object-cover`) — kiểu Google Images đơn giản hoá (không cần
 *      "justified rows" thật, vẫn thẳng hàng ngang dọc gọn gàng, KHÔNG cần biết trước tỉ lệ ảnh).
 *   2. KHÔNG còn tạo TOÀN BỘ DOM node ngay từ đầu (trước đây `images.forEach` tạo hết mọi tile dù
 *      chưa cuộn tới — hại DOM thật với thư viện lớn). Giờ chia CHUNK cố định
 *      (`MASONRY_CHUNK_SIZE` ảnh/chunk), CHỈ render chunk 0 lúc mở; cuộn gần hết chunk đang có ->
 *      tự thêm chunk kế tiếp (`_masonryGrowObserver`, sentinel cuối danh sách).
 *   3. Chunk cuộn QUÁ XA (vượt `MASONRY_KEEP_CHUNKS` chunk gần vị trí đang tải nhất) tự "thu gọn"
 *      — THAY tile ảnh thật bằng tile placeholder RỖNG CÙNG KÍCH THƯỚC Ô LƯỚI (nhờ layout đã đổi
 *      sang Ô VUÔNG ĐỀU ở bước 1, placeholder trống luôn khớp y hệt kích thước tile thật -> KHÔNG
 *      lệch layout/nhảy cuộn khi thu gọn, không cần đo `offsetHeight` gì cả). Blob GỐC vẫn còn
 *      nguyên trong tham số `images` (biến JS, không mất) — cuộn NGƯỢC lại gần 1 chunk đã thu gọn
 *      tự "khôi phục" lại tile thật NGAY (chỉ tạo lại object URL từ Blob có sẵn, KHÔNG đọc lại
 *      IndexedDB) qua observer riêng gắn trên tile đầu mỗi chunk.
 * @param {HTMLElement} containerEl - MỚI (04/07/2026, mục 3 phản hồi Giang) — tham số hoá container
 *      (trước đây hardcode `fileManagerImageMasonry`) để TÁI DÙNG ĐƯỢC toàn bộ hàm này (layout +
 *      chunk load/collapse) cho modal khác — xem `openPhotoUiImagePickerModal()` (picker cover bài
 *      hát, event/workflow/playlist.js).
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {boolean} [selectionMode]
 * @param {Set<string>} [selectedImageKeys]
 * @param {HTMLElement} [emptyEl] - Batch D6 (06/07/2026): panel Photo giờ push/pop động — nhận
 *      phần tử "rỗng" qua tham số THAY vì so sánh `containerEl === fileManagerImageMasonry` (biến
 *      toàn cục đó không còn hợp lệ nữa). Modal khác (cover picker) không có khái niệm "rỗng" nên
 *      đơn giản bỏ qua tham số này (undefined -> không toggle gì).
 */
const MASONRY_CHUNK_SIZE = 30;
const MASONRY_KEEP_CHUNKS = 3; // giữ tối đa 3 chunk (90 ảnh) "sống" (ảnh thật) quanh vị trí đang tải gần nhất

// Bookkeeping của lần renderImageMasonry() gần nhất — reset mỗi lần gọi lại từ đầu (đổi album/thư
// mục khác, hoặc bật/tắt chế độ chọn nhiều).
let _masonryContainerEl = null;
let _masonryImages = [];
let _masonrySelectionMode = false;
let _masonrySelectedKeys = null;
let _masonryChunkTiles = new Map(); // chunkIndex -> Array<tileEl> (đúng thứ tự trong chunk đó)
let _masonryHighestLoadedChunk = -1;
let _masonryGrowObserver = null;
let _masonryRestoreObservers = [];
// MỚI (Patch 1, mục 1 — group ảnh theo ngày tải lên, 14/07/2026): khoá NGÀY của tile ảnh cuối cùng
// đã render — cập nhật TUẦN TỰ qua từng chunk (chunk luôn tải đúng thứ tự tăng dần chỉ số, KHÔNG
// BAO GIỜ nhảy cóc — xem _loadNextMasonryChunk()), nên 1 biến module chạy dọc suốt phiên render là
// đủ để phát hiện đúng ranh giới ngày xuyên suốt nhiều chunk, không cần biết trước toàn bộ danh
// sách nhóm. Reset về null mỗi lần renderImageMasonry() vẽ lại từ đầu.
let _masonryLastRenderedDayKey = null;

function renderImageMasonry(containerEl, images, selectionMode, selectedImageKeys, emptyEl) {
    if (!containerEl) return; // guard

    // MỚI (Patch 1, mục 1) — mới nhất lên đầu (kiểu Google Photos), làm nền để _loadNextMasonryChunk()
    // phát hiện ranh giới ngày lúc build từng chunk. Sắp xếp NGAY TẠI ĐÂY (không tách hàm core riêng
    // ở image.js) — đây là bước CHUẨN BỊ nội bộ của CHÍNH quy trình "render lưới ảnh" này, không phải
    // 1 nghiệp vụ khác đứng riêng, nên không vi phạm Rule 3 (Core gọi Core). Tạo mảng MỚI, không mutate
    // tham số `images` gốc (nơi gọi có thể đang giữ tham chiếu khác tới cùng mảng đó).
    images = [...images].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    _teardownMasonryWatchers();
    containerEl.querySelectorAll('[data-has-object-url]').forEach((node) => {
        if (node._objectUrl) { try { URL.revokeObjectURL(node._objectUrl); } catch (e) {} }
    });
    containerEl.innerHTML = '';

    if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);

    _masonryContainerEl = containerEl;
    _masonryImages = images;
    _masonrySelectionMode = selectionMode;
    _masonrySelectedKeys = selectedImageKeys;
    _masonryChunkTiles = new Map();
    _masonryHighestLoadedChunk = -1;
    _masonryLastRenderedDayKey = null; // MỚI (Patch 1, mục 1)

    if (images.length === 0) return;

    const sentinel = document.createElement('div');
    sentinel.className = 'masonry-bottom-sentinel col-span-full h-px';
    containerEl.appendChild(sentinel);

    _loadNextMasonryChunk(); // chunk 0 — hiện ngay, không chờ cuộn

    _masonryGrowObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) _loadNextMasonryChunk();
    }, { root: null, rootMargin: '800px' });
    _masonryGrowObserver.observe(sentinel);
}

/** Tổng số chunk của lần render hiện tại — tính lại mỗi lần gọi (rẻ, không cần cache riêng). */
function _masonryTotalChunks() {
    return Math.ceil(_masonryImages.length / MASONRY_CHUNK_SIZE);
}

// ===================== MỚI (Patch 1, mục 1, 14/07/2026) — Group ảnh theo ngày tải lên =============
// Header ngăn cách CHỈ chèn xen giữa các tile ẢNH lúc build chunk (_loadNextMasonryChunk() dưới),
// KHÔNG được đưa vào mảng `tiles` (bookkeeping collapse/expand) — nhờ vậy header LUÔN hiện, không
// bao giờ bị thu gọn thành placeholder rỗng như tile ảnh (đúng hành vi Google Photos: nhãn ngày vẫn
// đứng yên dù ảnh bên dưới đã bị giải phóng bộ nhớ).

/** Khoá NGÀY (giờ địa phương máy người dùng) từ `addedAt` — CHỈ dùng để SO SÁNH 2 ảnh có cùng ngày
 * hay không, KHÔNG dùng để hiển thị (xem _buildMasonryDateHeaderTile() cho phần hiển thị). Hàm
 * THUẦN — không appState, không DOM, không gọi core khác. */
function _masonryDayKey(addedAt) {
    const d = new Date(addedAt || 0);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Dựng 1 hàng NGĂN CÁCH NGÀY (full-width, không phải ảnh, không bấm được — không có
 * `data-image-key` nên listener delegated `button[data-image-key]` không kích hoạt gì trên nó).
 * Nhãn theo `navigator.language` (locale trình duyệt) — KHÔNG qua t()/tFormat() vì tên thứ/tháng
 * không thuộc bộ key dịch hiện có (chỉ chứa chuỗi tĩnh), dùng thẳng Intl.DateTimeFormat cho đúng
 * ngôn ngữ hệ điều hành người dùng, cùng kiểu "Thứ Bảy, 14 thg 2" như Google Photos. Thêm năm nếu
 * KHÁC năm hiện tại. */
function _buildMasonryDateHeaderTile(addedAt) {
    const d = new Date(addedAt || 0);
    const opts = { weekday: 'long', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    const header = document.createElement('div');
    header.className = 'col-span-full px-1 pt-3 pb-1.5 first:pt-0 text-sm font-semibold text-slate-200';
    header.textContent = new Intl.DateTimeFormat(navigator.language, opts).format(d);
    return header;
}

/** Nạp chunk KẾ TIẾP (chưa từng tải) — gọi lúc mở lần đầu (chunk 0) VÀ mỗi khi sentinel cuối danh
 * sách lọt vào viewport. Tự dừng hẳn (disconnect observer) khi đã tải hết toàn bộ chunk. */
function _loadNextMasonryChunk() {
    const nextIndex = _masonryHighestLoadedChunk + 1;
    if (nextIndex >= _masonryTotalChunks()) {
        if (_masonryGrowObserver) { _masonryGrowObserver.disconnect(); _masonryGrowObserver = null; }
        return;
    }
    const start = nextIndex * MASONRY_CHUNK_SIZE;
    const end = Math.min(start + MASONRY_CHUNK_SIZE, _masonryImages.length);
    const sentinel = _masonryContainerEl.querySelector('.masonry-bottom-sentinel'); // SCOPED (04/07/2026, mục 3) — không còn getElementById toàn cục, tránh đụng độ id nếu 2 masonry cùng tồn tại (File Manager + picker cover bài hát)
    const tiles = [];
    for (let i = start; i < end; i++) {
        const image = _masonryImages[i];

        // MỚI (Patch 1, mục 1) — guard clause thuần (Rule 1 core-function-conventions.md): xoá `if`
        // này đi, vòng lặp vẫn còn ĐÚNG 1 kịch bản duy nhất ("chèn header ngăn cách cho ảnh đang
        // xét"), chỉ mất phần "bỏ qua khi ảnh này CÙNG NGÀY với ảnh render gần nhất" — KHÔNG phải rẽ
        // nhánh giữa 2 tiến trình nghiệp vụ khác nhau.
        const dayKey = _masonryDayKey(image.addedAt);
        if (dayKey !== _masonryLastRenderedDayKey) {
            _masonryContainerEl.insertBefore(_buildMasonryDateHeaderTile(image.addedAt), sentinel);
            _masonryLastRenderedDayKey = dayKey;
        }

        const tile = _buildMasonryTile(image);
        _masonryContainerEl.insertBefore(tile, sentinel); // chèn TRƯỚC sentinel — sentinel luôn ở cuối cùng
        tiles.push(tile);
    }
    _masonryChunkTiles.set(nextIndex, tiles);
    _masonryHighestLoadedChunk = nextIndex;

    _collapseFarMasonryChunks();
    _watchMasonryChunkForRestore(nextIndex);
}

/** Thu gọn MỌI chunk cũ hơn `MASONRY_KEEP_CHUNKS` chunk tính từ chunk mới nhất vừa tải. */
function _collapseFarMasonryChunks() {
    const oldestToKeep = _masonryHighestLoadedChunk - MASONRY_KEEP_CHUNKS + 1;
    _masonryChunkTiles.forEach((tiles, chunkIndex) => {
        if (chunkIndex < oldestToKeep && tiles[0] && tiles[0].dataset.collapsed !== '1') {
            _collapseMasonryChunk(chunkIndex);
        }
    });
}

/** Thu gọn 1 chunk — thay từng tile ảnh thật bằng placeholder RỖNG CÙNG class kích thước ô lưới
 * (`aspect-square`) nên KHÔNG lệch layout. Revoke hết object URL đang giữ (giải phóng bộ nhớ thật
 * — đây chính là phần "để trong RAM cache tạm" mà Giang nhắc: Blob GỐC vẫn còn trong `_masonryImages`,
 * chỉ object URL runtime bị dọn). */
function _collapseMasonryChunk(chunkIndex) {
    const tiles = _masonryChunkTiles.get(chunkIndex);
    if (!tiles) return;
    tiles.forEach((tile) => {
        if (tile._objectUrl) { try { URL.revokeObjectURL(tile._objectUrl); } catch (e) {} tile._objectUrl = null; }
        _thumbnailLazyObserver.unobserve(tile); // phòng tile đang chờ lazy-load dở dang lúc bị thu gọn
        tile.replaceChildren();
        tile.className = 'aspect-square rounded-xl bg-white/5 border border-white/5';
        tile.removeAttribute('data-image-key'); // MẤU CHỐT: listener delegated lọc theo 'button[data-image-key]' — bỏ thuộc tính này để bấm vào placeholder không kích hoạt gì
        tile.dataset.collapsed = '1';
    });
}

/** Khôi phục 1 chunk đã bị thu gọn — dựng lại đúng nội dung tile thật từ `_masonryImages` (Blob
 * vẫn còn nguyên trong RAM, KHÔNG đọc lại IndexedDB). */
function _expandMasonryChunk(chunkIndex) {
    const tiles = _masonryChunkTiles.get(chunkIndex);
    if (!tiles) return;
    const start = chunkIndex * MASONRY_CHUNK_SIZE;
    tiles.forEach((tile, offset) => {
        const image = _masonryImages[start + offset];
        if (!image) return;
        tile.className = 'relative block aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10';
        delete tile.dataset.collapsed;
        _fillMasonryTile(tile, image);
    });
}

/** Dựng 1 tile MỚI (chunk vừa tải lần đầu) — khung ngoài + gọi `_fillMasonryTile()` để đổ nội dung. */
function _buildMasonryTile(image) {
    const tile = document.createElement('button');
    tile.className = 'relative block aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10';
    _fillMasonryTile(tile, image);
    return tile;
}

/** Đổ nội dung THẬT (ảnh + badge chọn nhiều nếu có) vào 1 tile — dùng CHUNG bởi `_buildMasonryTile()`
 * (tile mới) VÀ `_expandMasonryChunk()` (tile được khôi phục sau khi thu gọn). */
function _fillMasonryTile(tile, image) {
    tile.dataset.imageKey = image.key;
    tile.dataset.hasObjectUrl = '1';
    tile.replaceChildren();

    const img = document.createElement('img');
    img.className = 'w-full h-full object-cover block';
    img.alt = image.filename;
    tile.appendChild(img);

    if (_masonrySelectionMode) {
        const isSelected = _masonrySelectedKeys.has(image.key);
        const badge = document.createElement('span');
        badge.className = `absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-sky-500 border-sky-400' : 'bg-black/40 border-white/60'}`;
        if (isSelected) {
            badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>';
        }
        tile.appendChild(badge);
    }

    _observeLazyThumbnail(tile, image.blob, img);
}

/** Gắn 1 observer "canh chừng" cho tile ĐẦU của 1 chunk vừa tải — phát hiện lúc cuộn NGƯỢC lại gần
 * 1 chunk ĐÃ bị thu gọn (ở tương lai) thì tự khôi phục. Chỉ cần theo dõi 1 tile đại diện/chunk là đủ
 * (cả chunk luôn cùng vào/ra viewport gần như đồng thời — không cần observer riêng cho từng tile). */
function _watchMasonryChunkForRestore(chunkIndex) {
    const tiles = _masonryChunkTiles.get(chunkIndex);
    if (!tiles || tiles.length === 0) return;
    const anchor = tiles[0];
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && anchor.dataset.collapsed === '1') _expandMasonryChunk(chunkIndex);
    }, { root: null, rootMargin: '800px' });
    observer.observe(anchor);
    _masonryRestoreObservers.push(observer);
}

/** Dọn sạch MỌI observer của lần render trước — gọi ở ĐẦU `renderImageMasonry()` mỗi lần render
 * lại từ đầu, tránh rò rỉ observer của danh sách ảnh cũ. */
function _teardownMasonryWatchers() {
    if (_masonryGrowObserver) { _masonryGrowObserver.disconnect(); _masonryGrowObserver = null; }
    _masonryRestoreObservers.forEach((o) => o.disconnect());
    _masonryRestoreObservers = [];
}

// ===================== Lazy-load thuần (IntersectionObserver) =====================

/** 1 observer DÙNG CHUNG cho toàn bộ thumbnail (story + masonry) — rẻ hơn 1 observer/phần tử. */
const _thumbnailLazyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const node = entry.target;
        _thumbnailLazyObserver.unobserve(node);
        const url = URL.createObjectURL(node._pendingBlob);
        node._objectUrl = url;
        if (node._imgEl) {
            node._imgEl.src = url; // masonry: <img> con
        } else {
            node.style.backgroundImage = `url(${url})`; // story: chính node là khung tròn, dùng background-image
            node.style.backgroundSize = 'cover';
            node.style.backgroundPosition = 'center';
            node.innerHTML = ''; // xoá icon placeholder
        }
        node._pendingBlob = null;
    });
}, { root: null, rootMargin: '200px' });

/** Đăng ký 1 node để tự tải ảnh khi cuộn tới gần viewport (200px trước khi thật sự vào khung hình). */
function _observeLazyThumbnail(node, blob, imgEl) {
    node._pendingBlob = blob;
    if (imgEl) node._imgEl = imgEl;
    _thumbnailLazyObserver.observe(node);
}

// ===================== Đổi tên Album (modal) — batch tiếp theo 03/07/2026, mục 2.2 =====================
// Cùng khuôn mẫu openRenameFolderModal() ở core/file-manager/folder-picker-ui.js — viết RIÊNG,
// KHÔNG gộp với openCreateAlbumModal() (đúng lý do đã ghi ở comment openCreateAlbumModal phía
// trên: 2 modal khác title/hành vi, gộp sẽ phải rẽ nhánh theo "loại nào gọi tới").
/**
 * @param {string} currentName
 * @param {(newName: string) => void} onConfirm
 */
function openRenameAlbumModal(currentName, onConfirm) {
    const stale = document.getElementById('rename-album-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rename-album-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t('fileManager.photo.album.renameTitle');
    card.appendChild(titleEl);

    function closeModal() { overlay.remove(); }

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.value = currentName;
    inputEl.className = 'bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors';
    card.appendChild(inputEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    cancelBtn.addEventListener('click', closeModal);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t('common.ok');
    saveBtn.addEventListener('click', () => {
        const name = inputEl.value.trim();
        if (!name) return; // guard clause thuần — chưa nhập tên thì không làm gì
        closeModal();
        onConfirm(name);
    });
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    inputEl.focus();
}

// ===================== Carousel chọn 1 ẢNH nền (Visual/Playlist) — MỚI 04/07/2026, mục 2 =========
// THAY openImageLibraryPickerModal() (lưới ảnh, ngay dưới) CHO RIÊNG 2 chỗ "Use Visualizer/
// Playlist background image" (event/workflow/visualizer-control-center.js,
// event/workflow/visualizer-display.js) — hiện ĐÚNG 1 ảnh lớn/lúc, prev/next VÔ HẠN (ảnh cuối
// next về ảnh đầu, vòng lặp qua modulo), CHỈ giữ tối đa 5 ảnh (current ± 2) trong DOM cùng lúc —
// tránh quá tải DOM với thư viện ảnh lớn (yêu cầu Giang). KHÔNG đụng openImageLibraryPickerModal()
// — vẫn dùng riêng cho picker chọn cover bài hát (event/workflow/playlist.js), ngữ cảnh đó hợp lý
// hơn với dạng lưới để quét nhanh nhiều ảnh cùng lúc.
const CAROUSEL_WINDOW_RADIUS = 2; // giữ current ± 2 = tối đa 5 ảnh trong DOM cùng lúc

/**
 * Tính tập index CẦN giữ trong DOM quanh `currentIndex` — vòng lặp vô hạn qua modulo, bán kính
 * `radius` mỗi phía. Tự khử trùng lặp khi `totalLength` nhỏ hơn cả cửa sổ (vd chỉ có 3 ảnh,
 * radius=2 vẫn chỉ trả tối đa 3 index duy nhất, không lặp lại).
 * @param {number} currentIndex
 * @param {number} totalLength
 * @param {number} radius
 * @returns {number[]}
 */
function computeCarouselWindowIndices(currentIndex, totalLength, radius) {
    if (totalLength <= 0) return [];
    const seen = new Set();
    for (let offset = -radius; offset <= radius; offset++) {
        seen.add(((currentIndex + offset) % totalLength + totalLength) % totalLength);
    }
    return [...seen];
}

/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 * @param {() => void} [onCancel] - gọi khi đóng modal MÀ CHƯA chọn ảnh nào (nút X/bấm ra ngoài) —
 *   dùng để nơi gọi tự trả toggle "On" về "off" (cùng cơ chế đã thống nhất ở mục 1, 04/07/2026).
 */
function openImageCarouselPickerModal(images, onSelect, onCancel) {
    const stale = document.getElementById('image-carousel-picker-overlay');
    if (stale) stale.remove();

    if (images.length === 0) {
        if (typeof onCancel === 'function') onCancel();
        alertModal(t('fileManager.photo.image.empty'));
        return;
    }

    let currentIndex = 0;
    let hasSelected = false;
    const loadedSlides = new Map(); // index -> { el, objectUrl }

    const overlay = document.createElement('div');
    overlay.id = 'image-carousel-picker-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black flex flex-col';

    function closeModal() {
        loadedSlides.forEach(({ objectUrl }) => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} });
        loadedSlides.clear();
        overlay.remove();
        if (!hasSelected && typeof onCancel === 'function') onCancel();
    }

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-4 py-3 shrink-0';
    const counter = document.createElement('span');
    counter.className = 'text-sm text-slate-300 font-mono';
    header.appendChild(counter);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const viewport = document.createElement('div');
    viewport.className = 'flex-1 relative overflow-hidden';
    overlay.appendChild(viewport);

    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between gap-3 p-4 shrink-0';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0 disabled:opacity-30';
    prevBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shadow';
    confirmBtn.textContent = t('fileManager.photo.carousel.confirmButton');
    const nextBtn = document.createElement('button');
    nextBtn.className = 'w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0 disabled:opacity-30';
    nextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>';
    footer.appendChild(prevBtn);
    footer.appendChild(confirmBtn);
    footer.appendChild(nextBtn);
    overlay.appendChild(footer);

    /** Đảm bảo slide tại `index` đã có trong DOM (tạo mới nếu chưa) — object URL CHỈ tạo lúc này. */
    function ensureSlide(index) {
        if (loadedSlides.has(index)) return;
        const image = images[index];
        const el = document.createElement('div');
        el.className = 'absolute inset-0 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200';
        const img = document.createElement('img');
        img.className = 'max-w-full max-h-full object-contain';
        img.alt = image.filename;
        const objectUrl = URL.createObjectURL(image.blob);
        img.src = objectUrl;
        el.appendChild(img);
        viewport.appendChild(el);
        loadedSlides.set(index, { el, objectUrl });
    }

    /** Vẽ lại toàn bộ: đảm bảo đúng cửa sổ (current ± CAROUSEL_WINDOW_RADIUS) đang tồn tại trong
     * DOM, dọn slide đã rớt khỏi cửa sổ (revoke object URL luôn), rồi hiện đúng slide active. */
    function render() {
        const total = images.length;
        counter.textContent = `${currentIndex + 1} / ${total}`;
        prevBtn.disabled = total <= 1;
        nextBtn.disabled = total <= 1;

        const windowIndices = computeCarouselWindowIndices(currentIndex, total, CAROUSEL_WINDOW_RADIUS);
        windowIndices.forEach((idx) => ensureSlide(idx));

        Array.from(loadedSlides.keys()).forEach((idx) => {
            if (windowIndices.includes(idx)) return;
            const { el, objectUrl } = loadedSlides.get(idx);
            try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            el.remove();
            loadedSlides.delete(idx);
        });

        loadedSlides.forEach(({ el }, idx) => {
            el.classList.toggle('opacity-100', idx === currentIndex);
            el.classList.toggle('opacity-0', idx !== currentIndex);
        });
    }

    prevBtn.addEventListener('click', () => { currentIndex = (currentIndex - 1 + images.length) % images.length; render(); });
    nextBtn.addEventListener('click', () => { currentIndex = (currentIndex + 1) % images.length; render(); });
    confirmBtn.addEventListener('click', () => {
        hasSelected = true;
        const key = images[currentIndex].key;
        closeModal();
        onSelect(key);
    });

    render();
    document.body.appendChild(overlay);
}

// ===================== Picker cover bài hát — TÁI DÙNG view Photo UI mới (04/07/2026, mục 3) =====
// THAY hẳn openImageLibraryPickerModal() (lưới columns cũ) cho RIÊNG chỗ "Chọn ảnh" ở tab Cover
// (Edit song info, event/workflow/playlist.js) — dùng ĐÚNG `renderImageMasonry()` (grid ô vuông +
// chunk load/collapse, xem comment hàm đó) vừa viết lại cho Photo & Album, tận dụng NGUYÊN layout/
// hiệu năng đó thay vì duy trì 2 kiểu lưới ảnh khác nhau trong project.
/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 * @param {() => void} [onCancel]
 */
function openPhotoUiImagePickerModal(images, onSelect, onCancel) {
    const stale = document.getElementById('photo-ui-image-picker-overlay');
    if (stale) stale.remove();

    let hasSelected = false;

    const overlay = document.createElement('div');
    overlay.id = 'photo-ui-image-picker-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black flex flex-col';

    function closeModal() {
        overlay.remove();
        if (!hasSelected && typeof onCancel === 'function') onCancel();
    }

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-4 py-3 shrink-0';
    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t('playlistView.songEdit.coverPickLibrary');
    header.appendChild(titleEl);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    if (images.length === 0) {
        const emptyEl = document.createElement('p');
        emptyEl.className = 'flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-8';
        emptyEl.textContent = t('fileManager.photo.image.empty');
        overlay.appendChild(emptyEl);
    } else {
        const grid = document.createElement('div');
        grid.className = 'flex-1 overflow-y-auto px-2 pb-4 grid grid-cols-3 sm:grid-cols-4 gap-1';
        overlay.appendChild(grid);
        renderImageMasonry(grid, images, false, null); // core/file-manager/photo-ui.js — TÁI DÙNG NGUYÊN layout + chunk load/collapse

        // Click chọn — delegated riêng cho modal này (KHÁC listener của File Manager, đóng ngay +
        // gọi onSelect thay vì mở preview), cùng chuẩn `data-image-key` mà renderImageMasonry() đặt
        // trên mọi tile (kể cả sau khi 1 chunk được thu gọn/khôi phục).
        grid.addEventListener('click', (e) => {
            const tile = e.target.closest('button[data-image-key]');
            if (!tile) return;
            hasSelected = true;
            const imageKey = tile.dataset.imageKey;
            closeModal();
            onSelect(imageKey);
        });
    }

    document.body.appendChild(overlay);
}

// ===================== Picker chọn 1 ảnh dùng chung (MỚI batch 03/07/2026) =====================
// Dùng bởi tab "Ảnh bìa" (modal Sửa thông tin bài hát, components/playlist-view.js) — xem
// readme/song-cover-background-relations.md mục 2/3. Lưới ảnh CHỈ ĐỌC (không xoá/không album),
// bấm 1 ảnh là chọn luôn + đóng modal — khác hẳn masonry Photo & Album (xem/quản lý thư viện).
/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 */
/**
 * FIX (04/07/2026, mục 1 phản hồi Giang) — thêm tham số `onCancel` (tuỳ chọn): gọi khi modal bị
 * đóng qua nút X hoặc bấm ra ngoài overlay MÀ CHƯA chọn ảnh nào — trước đây KHÔNG có, nên khi dùng
 * picker này để mở TỪ 1 CÔNG TẮC (gạt On -> mở picker), đóng modal mà không chọn gì khiến công tắc
 * kẹt ở "on" dù chưa thật sự có ảnh nào được set (bug đã báo). Nơi gọi (workflow) dùng `onCancel`
 * để tự trả công tắc về "off". KHÔNG đổi hành vi cũ của các nơi gọi không cần `onCancel` (tham số
 * tuỳ chọn, bỏ qua nếu không truyền).
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 * @param {() => void} [onCancel]
 */
function openImageLibraryPickerModal(images, onSelect, onCancel) {
    const stale = document.getElementById('image-library-picker-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'image-library-picker-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex flex-col';

    let hasSelected = false;
    function closeModal() {
        overlay.remove();
        if (!hasSelected && typeof onCancel === 'function') onCancel();
    }

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-4 py-3 shrink-0';
    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t('playlistView.songEdit.coverPickLibrary');
    header.appendChild(titleEl);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'flex-1 overflow-y-auto px-3 pb-6 columns-2 sm:columns-3 gap-2';
    if (images.length === 0) {
        const emptyEl = document.createElement('p');
        emptyEl.className = 'text-sm text-slate-400 text-center py-10';
        emptyEl.textContent = t('fileManager.photo.image.empty');
        overlay.appendChild(emptyEl);
    } else {
        images.forEach((image) => {
            const tile = document.createElement('button');
            tile.dataset.hasObjectUrl = '1';
            tile.className = 'block w-full mb-2 break-inside-avoid rounded-xl overflow-hidden bg-white/5 border border-white/10';
            const img = document.createElement('img');
            img.className = 'w-full h-auto block';
            img.alt = image.filename;
            tile.appendChild(img);
            _observeLazyThumbnail(tile, image.blob, img);
            tile.addEventListener('click', () => { hasSelected = true; overlay.remove(); onSelect(image.key); });
            grid.appendChild(tile);
        });
    }
    overlay.appendChild(grid);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    document.body.appendChild(overlay);
}

// ===================== Grid chọn Album kiểu "notify center" (Batch 9, 04/07/2026, mục 4) ========
// THAY openAlbumPickerModal() cũ (modal tối toàn màn hình, Batch 8) — panel container tĩnh
// (#slideshow-album-picker-panel, components/slideshow-settings-drawer.js) đã mount sẵn, hàm này
// CHỈ vẽ lại GRID bên trong mỗi lần mở (event/workflow/slideshow.js::openAlbumPicker). Album hình
// TRÒN — cùng shape avatar ở renderAlbumStory() phía trên. Album ĐANG active có viền sáng + vòng
// "đang chạy" quay quanh (.ss-picker-active, assets/css/slideshow.css); các album KHÁC bị blur mờ
// (.ss-picker-blurred) — CHỈ áp dụng khi CÓ 1 album đang active (chưa chọn gì thì hiện bình thường
// hết, không có gì để "làm nổi bật" so với phần còn lại).
/**
 * @param {HTMLElement} gridEl
 * @param {Array<{id: string, name: string, imageKeys: string[]}>} albums
 * @param {string|null} activeAlbumId
 * @param {Map<string, Object>} imageRecordsByKey - key -> {blob,...}, dùng lấy ảnh đại diện đầu
 *        tiên của mỗi album mà KHÔNG cần đọc DB lại (cùng pattern renderAlbumStory()).
 * @param {(albumId: string) => void} onSelect
 */
function renderSlideshowAlbumPickerGrid(gridEl, albums, activeAlbumId, imageRecordsByKey, onSelect) {
    if (!gridEl) return;

    gridEl.querySelectorAll('[data-has-object-url]').forEach((node) => {
        if (node._objectUrl) { try { URL.revokeObjectURL(node._objectUrl); } catch (e) {} }
    });
    gridEl.innerHTML = '';

    albums.forEach((album) => {
        const isActive = album.id === activeAlbumId;
        const isBlurred = !!activeAlbumId && !isActive;

        const tile = document.createElement('button');
        tile.className = `ss-album-tile${isBlurred ? ' ss-picker-blurred' : ''}${isActive ? ' ss-picker-active' : ''}`;

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'ss-album-tile-avatar-wrap';
        const ring = document.createElement('div');
        ring.className = 'ss-album-running-ring';
        avatarWrap.appendChild(ring);

        const avatar = document.createElement('div');
        avatar.dataset.hasObjectUrl = '1';
        avatar.className = 'ss-album-tile-avatar flex items-center justify-center text-slate-500';
        avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
        const firstImageKey = album.imageKeys.find((k) => imageRecordsByKey.has(k));
        if (firstImageKey) _observeLazyThumbnail(avatar, imageRecordsByKey.get(firstImageKey).blob);
        avatarWrap.appendChild(avatar);
        tile.appendChild(avatarWrap);

        const label = document.createElement('span');
        label.className = `text-xs truncate max-w-[4.5rem] text-center ${isActive ? 'text-sky-300 font-semibold' : 'text-slate-300'}`;
        label.textContent = album.name;
        tile.appendChild(label);

        tile.addEventListener('click', () => onSelect(album.id));
        gridEl.appendChild(tile);
    });
}

// ===================== Patch DOM surgical cho chế độ chọn nhiều (MỚI batch 03/07/2026, mục 3) ===
// FIX nhấp nháy: renderImageMasonry() ở trên XÂY LẠI TOÀN BỘ DOM (revoke + tạo lại mọi object URL)
// — hợp lý cho lần vẽ ĐẦU (vào chế độ chọn / thoát chế độ chọn), nhưng NẾU gọi lại mỗi lần CHỌN/BỎ
// CHỌN 1 ảnh (workflow cũ làm vậy) thì mọi ảnh khác cũng bị revoke+load lại object URL dù không
// đổi gì -> nhấp nháy toàn bộ lưới chỉ vì chạm 1 ô. 2 hàm THUẦN dưới đây chỉ đổi ĐÚNG 1 ô (badge)
// hoặc 1 dòng text (số lượng đã chọn) — dùng SAU LẦN VẼ ĐẦU, không đụng DOM node nào khác. Cùng
// tinh thần core/playlist/selection.js (showSelectionIndicator/hideSelectionIndicator) — 1 lớp
// patch DOM tách riêng khỏi pipeline render chính.

/**
 * Đổi trạng thái chọn/bỏ chọn NGAY TRÊN 1 tile đã có sẵn trong DOM (không revoke/tạo lại object
 * URL của tile đó hay bất kỳ tile nào khác).
 * @param {string} imageKey
 * @param {boolean} isSelected
 */
/** Batch D6 (06/07/2026) — dùng `_masonryContainerEl` (biến bookkeeping nội bộ, luôn trỏ đúng
 * container của lần renderImageMasonry() gần nhất) THAY vì dom-ref tĩnh `fileManagerImageMasonry`
 * — panel Photo giờ push/pop động, biến toàn cục đó không còn hợp lệ. */
function toggleImageSelectionBadge(imageKey, isSelected) {
    if (!_masonryContainerEl) return; // guard
    const tile = _masonryContainerEl.querySelector(`[data-image-key="${imageKey}"]`);
    if (!tile) return; // guard: hiếm, ảnh không còn trong DOM (race)

    let badge = tile.querySelector('[data-role="selection-badge"]');
    if (!badge) {
        badge = document.createElement('span');
        badge.dataset.role = 'selection-badge';
        tile.appendChild(badge);
    }
    badge.className = `absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-sky-500 border-sky-400' : 'bg-black/40 border-white/60'}`;
    badge.innerHTML = isSelected
        ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>'
        : '';
}

/** Đổi text "N selected" mà không đụng DOM nào khác. Batch D6 — nhận `countEl` qua tham số.
 * @param {number} count @param {HTMLElement} [countEl] */
function updateImageSelectionCount(count, countEl) {
    if (countEl) countEl.textContent = tFormat('fileManager.photo.album.selectedCount', { count });
}

// ===================== Tạo Album (modal) =====================
// Cùng khuôn mẫu openRenameFolderModal() ở core/file-manager/folder-picker-ui.js — KHÔNG có sẵn
// 1 "prompt modal" dùng chung nào trong project nên viết riêng, KHÔNG cố gộp (2 modal có
// title/placeholder/hành vi khác nhau, gộp sẽ phải rẽ nhánh theo "loại nào gọi tới").
/** @param {(name: string) => void} onConfirm */
function openCreateAlbumModal(onConfirm) {
    const stale = document.getElementById('create-album-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'create-album-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t('fileManager.photo.album.createTitle');
    card.appendChild(titleEl);

    function closeModal() { overlay.remove(); }

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = t('fileManager.photo.album.namePlaceholder');
    inputEl.className = 'bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors';
    card.appendChild(inputEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    cancelBtn.addEventListener('click', closeModal);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t('fileManager.photo.album.btnCreate');
    saveBtn.addEventListener('click', () => {
        const name = inputEl.value.trim();
        closeModal();
        if (name) onConfirm(name);
    });
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    inputEl.focus();
}
// Hàm dựng UI thuần (giống openRenameFolderModal/openFolderPickerModal ở
// core/file-manager/folder-picker-ui.js) — KHÔNG thuộc phạm vi 4 rule core-function-conventions.md
// (rule đó áp cho hàm NGHIỆP VỤ, không áp cho hàm dựng UI).
//
// VIẾT LẠI HOÀN TOÀN (04/07/2026, mục 2 phản hồi Giang):
//   1. GOM tất cả nút (Gỡ khỏi album/Đặt làm nền Playlist/Đặt làm nền Visual/Xoá) vào 1 menu
//      dropdown mở qua nút "..." — CHỈ còn X (đóng) đứng riêng như cũ.
//   2. THÊM tính năng CAPTION — hiện caption hiện có (nếu có) dưới ảnh, bấm vào để sửa (input +
//      Lưu/Huỷ), lưu qua `callbacks.onSaveCaption(caption)`.
/**
 * @param {{key: string, blob: Blob, filename: string, caption?: string}} image
 * @param {{onDelete: () => void, onSetPlaylistBg: () => void, onSetVisualBg: () => void, onRemoveFromAlbum?: () => void, onSaveCaption: (caption: string) => void}} callbacks
 *        onRemoveFromAlbum TUỲ CHỌN — chỉ truyền khi đang lọc theo 1 album cụ thể, mục "Gỡ khỏi
 *        album" CHỈ hiện trong menu khi có callback này.
 */
function openImagePreviewModal(image, callbacks) {
    const stale = document.getElementById('image-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(image.blob);
    let currentCaption = image.caption || '';

    const overlay = document.createElement('div');
    overlay.id = 'image-preview-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex flex-col';

    function closeModal() {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        overlay.remove();
    }

    // ---- Header: X đóng (trái) + "..." menu (phải) ----
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-4 py-3 shrink-0 gap-2 relative';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    menuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>';
    header.appendChild(menuBtn);

    const menu = document.createElement('div');
    menu.className = 'hidden absolute top-14 right-3 z-10 w-56 rounded-2xl bg-[#1a1a1e] border border-white/10 shadow-2xl overflow-hidden flex flex-col py-1';
    function closeMenu() { menu.classList.add('hidden'); }
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });

    function addMenuItem(label, danger, onClick) {
        const item = document.createElement('button');
        item.className = `text-left px-4 py-3 text-sm font-medium hover:bg-white/10 transition-colors ${danger ? 'text-rose-400' : 'text-white'}`;
        item.textContent = label;
        item.addEventListener('click', () => { closeMenu(); closeModal(); onClick(); });
        menu.appendChild(item);
    }
    addMenuItem(t('fileManager.photo.image.btnSetPlaylistBg'), false, callbacks.onSetPlaylistBg);
    addMenuItem(t('fileManager.photo.image.btnSetVisualBg'), false, callbacks.onSetVisualBg);
    if (callbacks.onRemoveFromAlbum) addMenuItem(t('fileManager.photo.image.btnRemoveFromAlbum'), false, callbacks.onRemoveFromAlbum);
    addMenuItem(t('fileManager.photo.image.btnDelete'), true, callbacks.onDelete);
    header.appendChild(menu);
    overlay.appendChild(header);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'flex-1 flex items-center justify-center px-4 pb-2 min-h-0';
    const img = document.createElement('img');
    img.src = objectUrl;
    img.alt = image.filename;
    img.className = 'max-w-full max-h-full object-contain rounded-lg';
    imgWrap.appendChild(img);
    overlay.appendChild(imgWrap);

    // ---- MỚI (mục 2) — hàng Caption: hiện caption hiện có (hoặc placeholder mời nhập), bấm vào
    // để sửa (input + Lưu/Huỷ). ----
    const captionRow = document.createElement('div');
    captionRow.className = 'px-4 pb-4 shrink-0';
    overlay.appendChild(captionRow);

    function renderCaptionDisplay() {
        captionRow.replaceChildren();
        const displayBtn = document.createElement('button');
        displayBtn.className = 'w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors';
        const label = document.createElement('div');
        label.className = 'text-[11px] text-slate-400 uppercase tracking-wider mb-0.5';
        label.textContent = t('fileManager.photo.image.captionLabel');
        displayBtn.appendChild(label);
        const textEl = document.createElement('div');
        textEl.className = currentCaption ? 'text-sm text-white' : 'text-sm text-slate-500 italic';
        textEl.textContent = currentCaption || t('fileManager.photo.image.captionPlaceholder');
        displayBtn.appendChild(textEl);
        displayBtn.addEventListener('click', renderCaptionEditor);
        captionRow.appendChild(displayBtn);
    }

    function renderCaptionEditor() {
        captionRow.replaceChildren();
        const box = document.createElement('div');
        box.className = 'px-4 py-3 rounded-xl bg-white/5 border border-sky-500/40 flex flex-col gap-2';
        const inputEl = document.createElement('textarea');
        inputEl.className = 'w-full bg-transparent text-sm text-white outline-none resize-none placeholder:text-slate-500';
        inputEl.rows = 2;
        inputEl.maxLength = 200;
        inputEl.placeholder = t('fileManager.photo.image.captionPlaceholder');
        inputEl.value = currentCaption;
        box.appendChild(inputEl);
        const btnRow = document.createElement('div');
        btnRow.className = 'flex justify-end gap-2';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors';
        cancelBtn.textContent = t('common.cancel');
        cancelBtn.addEventListener('click', renderCaptionDisplay);
        const saveBtn = document.createElement('button');
        saveBtn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors';
        saveBtn.textContent = t('common.save');
        saveBtn.addEventListener('click', () => {
            currentCaption = inputEl.value.trim();
            callbacks.onSaveCaption(currentCaption);
            renderCaptionDisplay();
        });
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        box.appendChild(btnRow);
        captionRow.appendChild(box);
        inputEl.focus();
    }

    renderCaptionDisplay();

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); else closeMenu(); });

    document.body.appendChild(overlay);
}
