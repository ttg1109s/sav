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
 * ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa, dùng
 * thư viện") — hệ "Item + window ảo" tự viết (`computeVariableVirtualWindowRange()`/
 * `itemTemplateImageGridRow()`/`workflowVirtualList` — từng THAY `renderImageMasonry()` chunk-based
 * cũ hơn nữa ở Patch mục 2, 14/07/2026) XOÁ HẲN CẢ CỤM — nguồn gốc hàng loạt bug layout/lệch cuộn
 * đã gặp (tự đo `scrollTop`/`clientWidth`/tự tính `offsetTop` bằng tay). Lưới ảnh Photo & Album giờ
 * dùng:
 *   - core/file-manager/image.js::sortImagesByAddedDateDesc()/groupImagesByDay() — core THUẦN, CHỈ
 *     còn việc gom nhóm theo ngày (KHÔNG còn tự đóng gói "hàng lưới"/tính width nào cả).
 *   - event/workflow/photo-gallery-window.js — windowing cấp NHÓM NGÀY qua `IntersectionObserver`
 *     (API trình duyệt gốc, không tự nghe 'scroll'/tự tính offset bằng tay nào nữa) + fjGallery
 *     (thư viện thật, CDN — index.html, thuật toán Flickr/Google Photos) lo layout justified thật
 *     bên trong mỗi nhóm còn tải. Tile ảnh dựng bằng DOM node thật (`createElement`) NGAY trong file
 *     đó — KHÔNG còn qua template chuỗi HTML nào ở components/items.js nữa.
 *   - event/workflow/file-manager-photo.js::setupPhotoGridWindow() — chỉ còn 1 lệnh gọi thẳng
 *     `workflowPhotoGalleryWindow.mount()`. Dùng CHUNG cho CẢ Photo & Album LẪN picker ảnh Generic
 *     Drawer (mountKey 'genericDrawer', event/workflow/file-manager-photo.js::
 *     _openImagePickerDrawer()) — tránh duy trì 2 hệ windowing khác nhau trong project.
 * `_thumbnailLazyObserver`/`_observeLazyThumbnail` GIỮ NGUYÊN — vẫn phục vụ Slideshow Settings (chọn
 * album nền, số lượng nhỏ, không cần window ảo — story slider Album ĐÃ XOÁ ở Giai đoạn 3b).
 */

// ===================== ĐÃ GỠ (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — Story slider Album =====
// `renderAlbumStory()`/`setAlbumStoryPageVisibility()` (bản trước ở đây) XOÁ HẲN — THAY bằng Album
// List sub-panel (itemTemplateAlbumListRow(), components/items.js + openAlbumListPanel()/
// refreshAlbumListPanel(), event/workflow/file-manager-photo.js). `_thumbnailLazyObserver`/
// `_observeLazyThumbnail` (ngay dưới) GIỮ NGUYÊN — vẫn dùng cho lưới ảnh chính + picker cover bài
// hát (KHÔNG liên quan story slider đã xoá).

// ===================== ĐÃ GỠ (rewrite Photo/Album, dùng fjGallery) — Lưới ảnh — Item + Window ảo tự
// viết ==========================================================================================
// Toàn bộ hệ "Item + window ảo" tự viết (renderItemList()/itemTemplateImageGridRow()/
// computeVariableVirtualWindowRange()/workflowVirtualList — components/items.js + event/workflow/
// virtual-list.js, ĐÃ XOÁ) — nguồn gốc hàng loạt bug layout/lệch cuộn đã gặp. Lưới ảnh giờ dùng
// event/workflow/photo-gallery-window.js (windowing cấp NHÓM NGÀY qua IntersectionObserver +
// fjGallery, thư viện thật — xem docstring đầu file) — không còn gì ở photo-ui.js xử lý phần này
// nữa, KHÔNG có "Điều phối"/"Template 1 hàng" nào cần biết tới ở đây.

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

// ===================== MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — Carousel XEM ảnh trong 1
// album + XOÁ KHỎI ALBUM (không phải xoá khỏi thư viện) — mở từ icon "view" ở Album List sub-panel.
// HÀM RIÊNG (không nhét vào openImageCarouselPickerModal() ở trên dù cấu trúc DOM gần giống hệt) —
// đây là 2 NGHIỆP VỤ khác nhau thật sự (chọn 1 ảnh làm nền vs duyệt+xoá nhiều ảnh khỏi album), Rule 1
// cấm branch giữa 2 nghiệp vụ trong CÙNG 1 hàm — chấp nhận lặp lại ~60 dòng cấu trúc DOM, đúng
// tinh thần "lặp code, giữ Rule 3 rõ ràng" đã áp dụng ở core/pagination.js. CÓ dùng lại
// `computeCarouselWindowIndices()` (hàm toán THUẦN, không phải "core khác" theo nghĩa Rule 3 — cùng
// cách `resolveImageKey()` gọi thẳng `slugify()` dùng chung).
// =====================================================================================================

/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images - ảnh TRONG album đang xem
 *        (album đã lọc sẵn TRƯỚC khi truyền vào — hàm này không tự lọc theo albumId).
 * @param {string} albumName - MỚI (fix bug 3, Giang yêu cầu "thêm nút info hiện tên album đang
 *        xem") — hiện/ẩn qua nút info ở header, KHÔNG hiện mặc định (tránh che thêm phần ảnh).
 * @param {(imageKey: string) => void} onRemoveFromAlbum - gọi NGAY lúc bấm nút xoá (KHÔNG await —
 *        hàm này chỉ cập nhật UI local ngay lập tức/optimistic, Workflow tự lo ghi DB async song
 *        song, cùng tinh thần `toggleImageSelectionInSet()` không đợi DB).
 * @param {() => void} [onClose] - gọi khi đóng modal (X, hết ảnh, hoặc bấm ra ngoài) — dùng để nơi
 *        gọi tự refresh() lại Album List (số lượng ảnh trong album có thể đã đổi).
 */
function openImageCarouselViewModal(images, albumName, onRemoveFromAlbum, onClose) {
    const stale = document.getElementById('image-carousel-view-overlay');
    if (stale) stale.remove();

    if (images.length === 0) {
        if (typeof onClose === 'function') onClose();
        alertModal(t('fileManager.photo.image.empty'));
        return;
    }

    let currentIndex = 0;
    let localImages = [...images]; // bản sao MUTABLE riêng — xoá khỏi đây KHÔNG đụng mảng gốc nơi gọi truyền vào
    const loadedSlides = new Map(); // index -> { el, objectUrl }

    const overlay = document.createElement('div');
    overlay.id = 'image-carousel-view-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black flex flex-col';

    function closeModal() {
        loadedSlides.forEach(({ objectUrl }) => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} });
        loadedSlides.clear();
        overlay.remove();
        if (typeof onClose === 'function') onClose();
    }

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-4 py-3 shrink-0 gap-2';
    const counter = document.createElement('span');
    counter.className = 'text-sm text-slate-300 font-mono';
    header.appendChild(counter);

    const headerRight = document.createElement('div');
    headerRight.className = 'flex items-center gap-2 shrink-0';
    // MỚI (fix bug 3, Giang yêu cầu) — nút info, bấm hiện/ẩn tên album đang xem (banner nhỏ ngay
    // dưới header, KHÔNG hiện mặc định — chỉ hiện khi cần, tránh che thêm phần ảnh).
    const infoBtn = document.createElement('button');
    infoBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white';
    infoBtn.title = t('fileManager.photo.album.carousel.infoTitle');
    infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
    headerRight.appendChild(infoBtn);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    headerRight.appendChild(closeBtn);
    header.appendChild(headerRight);
    overlay.appendChild(header);

    const nameLabel = document.createElement('div');
    nameLabel.className = 'hidden px-4 pb-2 text-sm text-slate-200 font-semibold text-center shrink-0 truncate';
    nameLabel.textContent = albumName;
    overlay.appendChild(nameLabel);
    infoBtn.addEventListener('click', () => { nameLabel.classList.toggle('hidden'); });

    const viewport = document.createElement('div');
    viewport.className = 'flex-1 relative overflow-hidden';
    overlay.appendChild(viewport);

    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between gap-3 p-4 shrink-0';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0 disabled:opacity-30';
    prevBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>';
    // SỬA (chốt với Giang) — nút đáy KHÔNG phải "chọn ảnh" (openImageCarouselPickerModal() đã có
    // ý nghĩa đó) — ở ĐÂY là "Xoá khỏi album" (removeImageFromAlbum(), KHÔNG xoá khỏi thư viện).
    const removeBtn = document.createElement('button');
    removeBtn.className = 'flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors shadow';
    removeBtn.textContent = t('fileManager.photo.album.carousel.removeButton');
    const nextBtn = document.createElement('button');
    nextBtn.className = 'w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0 disabled:opacity-30';
    nextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>';
    footer.appendChild(prevBtn);
    footer.appendChild(removeBtn);
    footer.appendChild(nextBtn);
    overlay.appendChild(footer);

    function ensureSlide(index) {
        if (loadedSlides.has(index)) return;
        const image = localImages[index];
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

    function render() {
        const total = localImages.length;
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

    prevBtn.addEventListener('click', () => { currentIndex = (currentIndex - 1 + localImages.length) % localImages.length; render(); });
    nextBtn.addEventListener('click', () => { currentIndex = (currentIndex + 1) % localImages.length; render(); });
    removeBtn.addEventListener('click', () => {
        const removedKey = localImages[currentIndex].key;
        onRemoveFromAlbum(removedKey); // fire-and-forget — Workflow tự ghi DB async song song, KHÔNG await ở core (Rule 2/4)
        localImages.splice(currentIndex, 1);
        if (localImages.length === 0) { closeModal(); return; } // hết ảnh trong album -> đóng hẳn
        if (currentIndex >= localImages.length) currentIndex = localImages.length - 1;
        // Index đã lệch sau splice -> cache slide theo index cũ SAI hoàn toàn -> dọn SẠCH, để
        // ensureSlide() tự dựng lại đúng cửa sổ mới quanh currentIndex (đơn giản, an toàn hơn tự vá
        // lại từng index — xoá ảnh là thao tác không thường xuyên, không cần tối ưu chi tiết ở đây).
        loadedSlides.forEach(({ objectUrl, el }) => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} el.remove(); });
        loadedSlides.clear();
        render();
    });

    render();
    document.body.appendChild(overlay);
}
// ===================== ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 4) — Picker cover bài hát dạng
// modal riêng =====================================================================================
// `openPhotoUiImagePickerModal()` (bản trước ở đây) XOÁ HẲN — THAY bằng
// `workflowFileManagerPhoto.openCoverImagePicker()` (event/workflow/file-manager-photo.js), dùng
// CHUNG hạ tầng Generic Drawer với picker "thêm ảnh vào album" (mode single-select thay vì multi-
// select) — KHÔNG còn modal riêng ngoài luồng eventBus, gọi từ event/workflow/playlist.js::
// pickCoverFromLibrary().

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
// TRÒN — cùng shape avatar ở itemTemplateAlbumListRow() (components/items.js, Giai đoạn 3b). Album ĐANG active có viền sáng + vòng
// "đang chạy" quay quanh (.ss-picker-active, assets/css/slideshow.css); các album KHÁC bị blur mờ
// (.ss-picker-blurred) — CHỈ áp dụng khi CÓ 1 album đang active (chưa chọn gì thì hiện bình thường
// hết, không có gì để "làm nổi bật" so với phần còn lại).
/**
 * @param {HTMLElement} gridEl
 * @param {Array<{id: string, name: string, imageKeys: string[]}>} albums
 * @param {string|null} activeAlbumId
 * @param {Map<string, Object>} imageRecordsByKey - key -> {blob,...}, dùng lấy ảnh đại diện đầu
 *        tiên của mỗi album mà KHÔNG cần đọc DB lại (cùng pattern lấy ảnh đại diện đầu tiên đã dùng ở Album List sub-panel).
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

// ===================== ĐÃ GỠ (Giai đoạn 3b, rewrite Photo/Album, mục 3a/4) — Đếm số ảnh đang chọn
// (chế độ chọn nhiều NGAY TRONG lưới chính) =========================================================
// `updateImageSelectionCount()` (bản trước ở đây) XOÁ HẲN cùng lúc bỏ hẳn `imageSelectionMode`/
// `#file-manager-image-selection-bar` — "thêm ảnh vào album" giờ là picker Generic Drawer riêng
// (nút xác nhận picker KHÔNG hiện số lượng dạng text riêng, chỉ có nhãn cố định — có thể bổ sung sau
// nếu Giang thấy cần, cùng tinh thần title nút xoá nhanh đang hiện số lượng).

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
/**
 * SỬA (14/07/2026, mục cuối — menu action ảnh) — bỏ hẳn dropdown menu tự vẽ (text list, absolute
 * positioned). Menu giờ là Generic Drawer (icon hoá, xem
 * `buildPhotoActionMenuHtml()` ngay dưới) — KHÔNG dựng được ở ĐÂY (Generic Drawer là DOM TĨNH có
 * sẵn từ `dom-refs.js`, không phải "cụm DOM mới tự tạo", Rule 5a CẤM Core tự `addEventListener` cho
 * nó) — nên "..." CHỈ gọi `callbacks.onOpenMenu()`, Workflow (`event/workflow/file-manager-photo.js::
 * _openImageActionMenu()`) tự mở/wire Generic Drawer. Trả về `{ close }` để Workflow tự đóng modal
 * này SAU KHI 1 action được chọn từ menu.
 * @param {{key: string, blob: Blob, filename: string}} image
 * @param {{onOpenMenu: () => void}} callbacks
 * @returns {{close: () => void}}
 */
function openImagePreviewModal(image, callbacks) {
    const stale = document.getElementById('image-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(image.blob);

    const overlay = document.createElement('div');
    overlay.id = 'image-preview-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black overflow-hidden';

    function closeModal() {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        overlay.remove();
    }

    // SỬA (14/07/2026, Giang chỉ ra: "sao ảnh nào cũng crop để full view?" — ĐÚNG, bản trước gán
    // CỨNG `object-fit: cover` cho MỌI ảnh, không tính hướng ảnh so với hướng màn hình). GIẢI THÍCH:
    // "full width + full height" và "không cắt mất ảnh" chỉ cùng đúng khi tỉ lệ ảnh ~ tỉ lệ màn
    // hình (cùng hướng: ảnh ngang trên màn ngang, ảnh dọc trên màn dọc) — cover lúc đó chỉ cắt RẤT
    // ÍT (khớp sẵn). Ảnh NGANG xem trên màn DỌC (hoặc ngược lại) mà ép cover sẽ cắt mất PHẦN LỚN nội
    // dung ảnh — không hợp lý. SỬA: đo `naturalWidth/Height` (ảnh) so `innerWidth/Height` (màn hình)
    // NGAY khi ảnh load xong — CÙNG hướng (cả 2 cùng ngang hoặc cùng dọc) mới dùng cover; LỆCH hướng
    // thì đổi qua contain (hiện trọn ảnh, dư khoảng đen 2 bên do overlay đã bg-black sẵn — KHÔNG mất
    // nội dung ảnh).
    const img = document.createElement('img');
    img.alt = image.filename;
    img.className = 'photo-preview-image';
    img.addEventListener('load', () => {
        const imageIsLandscape = img.naturalWidth >= img.naturalHeight;
        const screenIsLandscape = window.innerWidth >= window.innerHeight;
        img.style.objectFit = (imageIsLandscape === screenIsLandscape) ? 'cover' : 'contain';
    }, { once: true });
    img.src = objectUrl;
    overlay.appendChild(img);

    // ---- Header nổi: X đóng (trái) + "..." mở menu (phải) ----
    const header = document.createElement('div');
    header.className = 'photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3 gap-2';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    menuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>';
    menuBtn.addEventListener('click', callbacks.onOpenMenu);
    header.appendChild(menuBtn);
    overlay.appendChild(header);

    document.body.appendChild(overlay);
    return { close: closeModal };
}

/**
 * MỚI (14/07/2026, mục cuối) — bodyHtml cho menu action ảnh (Generic Drawer, icon hoá + tên ngắn
 * gọn — yêu cầu Giang). Hàm THUẦN (Rule 1-4): chỉ ghép chuỗi từ `ctx`, không DOM/appState/gọi core
 * khác.
 *
 * SỬA 2 LẦN (14/07/2026):
 *   - Giang chỉ ra lần 1: "độ rộng phải = tên nút dài nhất, không xuống dòng" -> đổi sang 1 hàng
 *     ngang, mỗi nút rộng theo ký tự nhãn dài nhất (đơn vị `ch`).
 *   - Giang CHỈNH LẠI lần 2 (hoàn tác lần 1): "tối thiểu 2 dòng, dài quá thì '...', tham khảo
 *     toolbar subtitle-editor" -> giờ ĐÚNG khuôn toolbar đó (`w-[70px] shrink-0 flex flex-col`,
 *     `overflow-x-auto` nếu tràn hàng), nhãn cho phép vỡ TỐI ĐA 2 dòng (`line-clamp-2`), dài hơn
 *     nữa mới cắt "…" (CSS `line-clamp` tự thêm ellipsis ở cuối dòng 2).
 * @param {{hasAlbum: boolean}} ctx
 * @returns {string}
 */
function buildPhotoActionMenuHtml(ctx) {
    const ICON_BG = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
    const ICON_VISUAL = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>';
    const ICON_EDIT_IMAGE = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3"/></svg>';
    const ICON_REMOVE_ALBUM = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6"/></svg>';
    const ICON_TRASH = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';

    const items = [
        { action: 'setPlaylistBg', label: t('fileManager.photo.image.btnSetPlaylistBg'), icon: ICON_BG },
        { action: 'setVisualBg', label: t('fileManager.photo.image.btnSetVisualBg'), icon: ICON_VISUAL },
        { action: 'editImage', label: t('fileManager.photo.image.btnEditImage'), icon: ICON_EDIT_IMAGE },
    ];
    if (ctx && ctx.hasAlbum) items.push({ action: 'removeFromAlbum', label: t('fileManager.photo.image.btnRemoveFromAlbum'), icon: ICON_REMOVE_ALBUM });
    items.push({ action: 'delete', label: t('fileManager.photo.image.btnDelete'), icon: ICON_TRASH, danger: true });

    return `
        <div class="flex items-start gap-1 overflow-x-auto px-1 pb-1">
            ${items.map((item) => `
                <button type="button" data-photo-menu-action="${item.action}" class="w-[70px] shrink-0 flex flex-col items-center gap-1.5 py-1">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center ${item.danger ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}">${item.icon}</div>
                    <span class="text-[11px] font-medium text-center leading-tight [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden ${item.danger ? 'text-rose-600' : 'text-slate-700'}">${escapeHtml(item.label)}</span>
                </button>
            `).join('')}
        </div>
    `;
}


