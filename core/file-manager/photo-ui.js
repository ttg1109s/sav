/**
 * core/file-manager/photo-ui.js — Vẽ UI Photo & Album (Batch 3, 03/07/2026): story slider album
 * (lazy load avatar qua IntersectionObserver — mục 3 yêu cầu gốc). Hàm THUẦN (không I/O, không
 * appState) — nơi gọi (workflow) tự đọc DB rồi truyền dữ liệu vào, đúng nguyên tắc core/file-manager/
 * folder-list-ui.js/folder-detail-ui.js đã theo.
 *
 * Object URL (story slider): TẠO LÚC LAZY-LOAD (Intersection vào viewport), LƯU trên chính node
 * (`node._objectUrl`), REVOKE khi node bị gỡ khỏi DOM (vẽ lại toàn bộ list) — cùng pattern
 * `_coverObjectUrl` đã dùng ở core/playlist/render.js. Lưới ảnh (mục dưới) KHÔNG còn dùng cơ chế
 * này nữa, xem lý do ở đúng mục đó.
 *
 * NẠP SAU: lang/lang.js (t()), components/items.js (renderItemList/computeVirtualWindowRange dùng
 * ở event/workflow/file-manager-photo.js, KHÔNG dùng trực tiếp trong file này — xem Rule 3).
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
 * PATCH mục 2 (14/07/2026, "bỏ cách cũ, áp dụng Item + window ảo") — XOÁ HẲN `renderImageMasonry()`
 * + toàn bộ hệ chunk load/collapse/restore qua IntersectionObserver (đã viết ở Patch mục 1) VÀ
 * `toggleImageSelectionBadge()` (patch DOM surgical cũ, gắn với `_masonryContainerEl` đã không còn
 * tồn tại). Group ảnh theo NGÀY (mục 1) + windowing giờ đều chuyển qua hạ tầng "Item" dùng chung:
 *   - core/file-manager/image.js::sortImagesByAddedDateDesc()/buildPhotoGridRows() — core THUẦN,
 *     chuẩn bị "hàng lưới" (header ngày hoặc cụm ảnh).
 *   - components/items.js::itemTemplateImageGridRow() — template 1 hàng (tạo object URL NGAY lúc
 *     build chuỗi — an toàn vì chỉ 1 cửa sổ nhỏ được render mỗi lần, không phải toàn bộ thư viện).
 *   - event/workflow/file-manager-photo.js::setupPhotoGridWindow() — điều phối (đo cột/chiều cao
 *     hàng, gắn `scroll` listener, gọi computeVirtualWindowRange() RỒI renderItemList() — CHỈ
 *     Workflow được gọi cả 2, xem Rule 3 core-function-conventions.md). Dùng CHUNG cho CẢ Photo &
 *     Album LẪN `openPhotoUiImagePickerModal()` (picker cover bài hát — hàm đó giờ CHỈ dựng khung
 *     modal + `<div>` grid rỗng, giao lại qua tham số `onGridReady` để Workflow tự setup, xem hàm
 *     đó bên dưới) — tránh duy trì 2 hệ windowing khác nhau trong project.
 * `_thumbnailLazyObserver`/`_observeLazyThumbnail` GIỮ NGUYÊN — vẫn phục vụ story slider Album (số
 * lượng nhỏ, không cần window ảo).
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

// ===================== Lưới ảnh — Item + Window ảo (Patch mục 2, 14/07/2026) ===================
// BỎ HẲN hệ Masonry chunk-based cũ (renderImageMasonry() + chunk load/collapse/restore qua
// IntersectionObserver, ~260 dòng) — THAY bằng hạ tầng "Item" (components/items.js::
// renderItemList()/itemTemplateImageGridRow()) + "window ảo" thật sự theo vị trí cuộn
// (components/items.js::computeVirtualWindowRange()), đúng yêu cầu Giang.
//   - Đóng gói "hàng lưới" (header ngày / cụm ảnh) — core THUẦN, xem
//     core/file-manager/image.js::buildPhotoGridRows() (còn sortImagesByAddedDateDesc() chuẩn bị
//     input đã sort).
//   - Template 1 hàng — components/items.js::itemTemplateImageGridRow() (tạo object URL NGAY lúc
//     build chuỗi, AN TOÀN vì chỉ render 1 cửa sổ nhỏ mỗi lần, không phải toàn bộ thư viện).
//   - Điều phối (đo cột/chiều cao hàng, gắn `scroll` listener, gọi computeVirtualWindowRange() RỒI
//     renderItemList() — CẢ HAI đều là "core" theo đúng cách gọi của components/items.js, nên CHỈ
//     Workflow được gọi cả 2, KHÔNG core nào ở file NÀY gọi trực tiếp, đúng Rule 3) — xem
//     event/workflow/file-manager-photo.js::setupPhotoGridWindow(). Hàm ĐÓ dùng CHUNG cho CẢ Photo
//     & Album (fileManagerPhotoPanelEl) LẪN Picker cover bài hát (openPhotoUiImagePickerModal() bên
//     dưới, gọi qua event/workflow/playlist.js — Workflow gọi Workflow miền khác, TỰ DO theo
//     event-bus-flow.md mục 4B "Tái dùng Workflow giữa các miền khác nhau"), tránh duy trì 2 hệ
//     windowing khác nhau trong project.
//   - `_thumbnailLazyObserver`/`_observeLazyThumbnail` (ngay dưới) GIỮ NGUYÊN — vẫn dùng cho story
//     slider Album (số lượng nhỏ, không cần window ảo).

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
// (Edit song info, event/workflow/playlist.js) — dùng ĐÚNG khung/style của Photo & Album, tận dụng
// NGUYÊN layout thay vì duy trì 2 kiểu lưới ảnh khác nhau trong project.
//
// SỬA (Patch mục 2, 14/07/2026) — hàm này KHÔNG còn tự vẽ lưới ảnh (renderImageMasonry() đã bỏ
// hẳn). CHỈ dựng khung modal (header/close/trạng thái rỗng) + `<div id>` GRID RỖNG, rồi gọi
// `onGridReady(gridEl)` để NƠI GỌI (Workflow — event/workflow/playlist.js) tự
// `workflowFileManagerPhoto.setupPhotoGridWindow(gridEl, gridEl, ...)`. Hàm NÀY (Core) KHÔNG được tự
// gọi `computeVirtualWindowRange()`/`renderItemList()` (Rule 3 core-function-conventions.md — 2 hàm
// đó là "core" theo đúng cách components/items.js tự gọi tên, nên CHỈ Workflow được đứng ra gọi cả
// hai, không core nào khác được gọi hộ) — đây chính xác lý do phải tách qua callback thay vì tự làm
// trong file này như bản `renderImageMasonry()` cũ.
/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 * @param {() => void} [onCancel]
 * @param {(gridEl: HTMLElement) => void} [onGridReady] - gọi NGAY SAU khi grid rỗng đã vào DOM
 *        (bỏ qua nếu `images.length === 0` — không có grid nào để giao).
 */
function openPhotoUiImagePickerModal(images, onSelect, onCancel, onGridReady) {
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
        grid.className = 'flex-1 overflow-y-auto px-2 pb-4';
        overlay.appendChild(grid);

        // Click chọn — delegated riêng cho modal này (KHÁC listener của File Manager, đóng ngay +
        // gọi onSelect thay vì mở preview), cùng chuẩn `data-image-key` mà
        // itemTemplateImageGridRow() (components/items.js) đặt trên mọi tile.
        grid.addEventListener('click', (e) => {
            const tile = e.target.closest('button[data-image-key]');
            if (!tile) return;
            hasSelected = true;
            const imageKey = tile.dataset.imageKey;
            closeModal();
            onSelect(imageKey);
        });

        if (typeof onGridReady === 'function') onGridReady(grid);
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

// ===================== Đếm số ảnh đang chọn (chế độ chọn nhiều) ==================================
// TRƯỚC ĐÂY còn có `toggleImageSelectionBadge()` (patch DOM surgical, chỉ đổi 1 tile để tránh nhấp
// nháy cả lưới) — XOÁ ở Patch mục 2 (14/07/2026) cùng lúc bỏ `renderImageMasonry()`/
// `_masonryContainerEl`: giờ mỗi lần chọn/bỏ chọn 1 ảnh, Workflow gọi lại ĐÚNG closure vẽ cửa sổ
// hiện tại (`setupPhotoGridWindow()` trả về, xem event/workflow/file-manager-photo.js) — chỉ vẽ lại
// ~1 cửa sổ nhỏ (visible + buffer, không phải toàn bộ thư viện như bản Masonry cũ), nên KHÔNG còn
// cần patch surgical riêng nữa, nhấp nháy không đáng kể.

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
