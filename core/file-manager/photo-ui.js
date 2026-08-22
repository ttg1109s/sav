/**
 * core/file-manager/photo-ui.js — Vẽ UI Photo (thư viện ảnh): modal xem ảnh, picker chọn ảnh dùng
 * chung, Edit mode UI.
 *
 * XOÁ (loại bỏ Album khỏi Photo Panel) — toàn bộ UI quản lý Album (Album List sub-panel, modal Tạo/
 * Đổi tên Album, picker chọn Album làm nguồn Visual Background, carousel xem/xoá-khỏi-album) bỏ hẳn
 * cùng tính năng. Sẽ thay bằng Folder Photo trong File Browser ở đợt riêng (pending).
 *
 * Object URL (thumbnail lazy-load): TẠO LÚC LAZY-LOAD (Intersection vào viewport), LƯU trên chính
 * node (`node._objectUrl`), REVOKE khi node bị gỡ khỏi DOM — cùng pattern `_coverObjectUrl` đã dùng
 * ở core/playlist/render.js. Lưới ảnh chính KHÔNG dùng cơ chế này, xem lý do ở đúng mục đó.
 *
 * NẠP SAU: lang/lang.js (t()), components/items.js (renderItemList/computeVirtualWindowRange dùng
 * ở event/workflow/file-manager-photo.js, KHÔNG dùng trực tiếp trong file này — xem Rule 3).
 *
 * FIX (04/07/2026, mục 1 phản hồi Giang): `openImageLibraryPickerModal()` thêm tham số `onCancel`
 * (tuỳ chọn) — gọi khi đóng modal mà CHƯA chọn ảnh nào, để nơi gọi tự trả toggle "On" về "off".
 *
 * ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa, dùng
 * thư viện") — hệ "Item + window ảo" tự viết (`computeVariableVirtualWindowRange()`/
 * `itemTemplateImageGridRow()`/`workflowVirtualList` — từng THAY `renderImageMasonry()` chunk-based
 * cũ hơn nữa ở Patch mục 2, 14/07/2026) XOÁ HẲN CẢ CỤM — nguồn gốc hàng loạt bug layout/lệch cuộn
 * đã gặp (tự đo `scrollTop`/`clientWidth`/tự tính `offsetTop` bằng tay). Lưới ảnh chính giờ dùng:
 *   - core/file-manager/image.js::sortImagesByAddedDateDesc()/groupImagesByDay() — core THUẦN, CHỈ
 *     còn việc gom nhóm theo ngày (KHÔNG còn tự đóng gói "hàng lưới"/tính width nào cả).
 *   - event/workflow/photo-gallery-window.js — windowing cấp NHÓM NGÀY qua `IntersectionObserver`
 *     (API trình duyệt gốc, không tự nghe 'scroll'/tự tính offset bằng tay nào nữa) + fjGallery
 *     (thư viện thật, CDN — index.html, thuật toán Flickr/Google Photos) lo layout justified thật
 *     bên trong mỗi nhóm còn tải. Tile ảnh dựng bằng DOM node thật (`createElement`) NGAY trong file
 *     đó — KHÔNG còn qua template chuỗi HTML nào ở components/items.js nữa.
 *   - event/workflow/file-manager-photo.js::setupPhotoGridWindow() — chỉ còn 1 lệnh gọi thẳng
 *     `workflowPhotoGalleryWindow.mount()`. Dùng CHUNG cho lưới ảnh chính LẪN picker ảnh Generic
 *     Drawer (mountKey 'genericDrawer', event/workflow/file-manager-photo.js::
 *     _openImagePickerDrawer()) — tránh duy trì 2 hệ windowing khác nhau trong project.
 * `_thumbnailLazyObserver`/`_observeLazyThumbnail` GIỮ NGUYÊN — vẫn phục vụ Slideshow Settings (chọn
 * ảnh nền đơn/Album cover cũ đã xoá).
 */

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

// ===================== XOÁ (loại bỏ Album khỏi Photo Panel) — Đổi tên Album (modal) bỏ hẳn cùng
// tính năng (openRenameAlbumModal(), consumer duy nhất là Album List sub-panel đã xoá). ===========

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
    overlay.className = 'fixed inset-0 bg-black flex flex-col';
    overlay.style.zIndex = String(Z_INDEX.IMAGE_CAROUSEL_PICKER); // SỬA 25/07/2026 — trước đây hardcode class Tailwind tĩnh `z-[130]`

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

// ===================== XOÁ (loại bỏ Album khỏi Photo Panel) — Carousel XEM ảnh trong 1 album +
// XOÁ KHỎI ALBUM bỏ hẳn cùng tính năng (openImageCarouselViewModal() — đã là dead code TỪ TRƯỚC,
// Album List sub-panel đổi sang tái dùng lưới ảnh chính thay vì carousel này từ 17/07/2026, xem
// lịch sử event/workflow/file-manager-photo.js). computeCarouselWindowIndices() GIỮ NGUYÊN — vẫn
// dùng bởi openImageCarouselPickerModal() ngay trên (không liên quan Album). ======================
// ===================== ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 4) — Picker cover bài hát dạng
// modal riêng =====================================================================================
// `openPhotoUiImagePickerModal()` (bản trước ở đây) XOÁ HẲN — THAY bằng
// `workflowFileManagerPhoto.openCoverImagePicker()` (event/workflow/file-manager-photo.js), dùng
// CHUNG hạ tầng Generic Drawer picker ảnh — KHÔNG còn modal riêng ngoài luồng eventBus, gọi từ
// event/workflow/playlist.js::pickCoverFromLibrary().

// ===================== Picker chọn 1 ảnh dùng chung (MỚI batch 03/07/2026) =====================
// Dùng bởi tab "Ảnh bìa" (modal Sửa thông tin bài hát, components/playlist-view.js) — xem
// readme/song-cover-background-relations.md mục 2/3. Lưới ảnh CHỈ ĐỌC (không xoá), bấm 1 ảnh là
// chọn luôn + đóng modal — khác hẳn lưới ảnh chính (xem/quản lý thư viện).
/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 */
// XOÁ (v13, dọn dead code) — `openImageLibraryPickerModal()`: 0 nơi gọi NGAY TRONG BẢN GỐC
// (đã kiểm bằng grep toàn repo), là tàn dư của luồng chọn ảnh cũ trước khi Generic Drawer picker
// (`openPhotoImagePickerDrawerUi()` + `workflowFileManagerPhoto.openCoverImagePicker()`) thay thế.

// ===================== XOÁ (loại bỏ Album khỏi Photo Panel) — renderAlbumPickerGrid()/
// wireAlbumPickerDrawerActions() (picker chọn Album làm nguồn Visual Background) bỏ hẳn cùng tính
// năng — caller duy nhất (event/workflow/visual-bg.js::openListAlbumPicker()) đã xoá. Visual
// Background mất tuỳ chọn "Nhóm ảnh" tạm thời, sẽ thay bằng Folder Photo (File Browser overhaul,
// đợt riêng, pending).

// ===================== ĐÃ GỠ (Giai đoạn 3b, rewrite Photo/Album, mục 3a/4) — Đếm số ảnh đang chọn
// (chế độ chọn nhiều NGAY TRONG lưới chính) =========================================================
// `updateImageSelectionCount()` (bản trước ở đây) XOÁ HẲN cùng lúc bỏ hẳn `imageSelectionMode`/
// `#file-manager-image-selection-bar` — "thêm ảnh vào album" giờ là picker Generic Drawer riêng
// (nút xác nhận picker KHÔNG hiện số lượng dạng text riêng, chỉ có nhãn cố định — có thể bổ sung sau
// nếu Giang thấy cần, cùng tinh thần title nút xoá nhanh đang hiện số lượng).

// ===================== XOÁ (loại bỏ Album khỏi Photo Panel) — Tạo Album (modal) bỏ hẳn cùng tính
// năng (openCreateAlbumModal(), consumer duy nhất là Album List sub-panel đã xoá). ==================
/**
 * Modal xem ảnh full-screen — dựng cụm DOM MỚI (Rule 5a: cụm DOM mới tự tạo bằng `createElement`,
 * ĐƯỢC PHÉP tự `addEventListener`, miễn callback CHỈ bắn `eventBus.send()` + gom cuối hàm — xem
 * đúng khuôn ở cuối hàm này). Menu "..." mở dropdown (core/dropdown-menu.js) do Workflow tự dựng
 * SAU khi nhận eventBus — không dựng ở đây (dropdown cần biết đang ở mode nào, dữ liệu đó Core
 * không được tự đọc, xem Rule 2).
 * SỬA (31/07/2026, Rule 5a — audit lại theo yêu cầu Giang) — TRƯỚC ĐÂY nhận `callbacks` (onOpenMenu/
 * onCloseClick/onEditClick) rồi gọi THẲNG tham số đó trong addEventListener — vi phạm điều kiện 1
 * Rule 5a ("callback CHỈ được bắn eventBus.send(), không gọi tham số/hàm khác"), xem readme/core-
 * function-conventions.md. Giờ KHÔNG còn nhận `callbacks` nữa — cả 3 nút tự bắn thẳng eventBus
 * NGAY TRONG hàm này (gom cuối hàm, sau khi cây DOM dựng xong hoàn toàn — đúng điều kiện 2), Workflow
 * (event/workflow/file-manager-photo.js) đọc `_activeImageKey` (instance field đã lưu sẵn lúc mở
 * modal) thay vì phải truyền qua closure tham số như trước.
 * @param {{key: string, blob: Blob, filename: string}} image
 * @returns {{close: () => void, imgEl: HTMLImageElement, canvasWrap: HTMLElement, baseCanvas: HTMLCanvasElement, renderCanvas: HTMLCanvasElement, interactCanvas: HTMLCanvasElement, toolsBtn: HTMLElement}}
 */
function openImagePreviewModal(image) {
    const stale = document.getElementById('image-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(image.blob);

    const overlay = document.createElement('div');
    overlay.id = 'image-preview-overlay';
    overlay.className = 'fixed inset-0 bg-black overflow-hidden';
    overlay.style.zIndex = String(Z_INDEX.IMAGE_PREVIEW); // SỬA 25/07/2026 — trước đây hardcode class Tailwind tĩnh `z-[130]`

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
    img.src = objectUrl;
    overlay.appendChild(img);

    // ---- Khung canvas cho Edit mode (base/render/interact) — MỚI (31/07/2026), ẩn mặc định, chỉ
    // hiện khi vào Edit mode (workflowImageEdit.enterEditMode() dựng nội dung + gỡ 'hidden').
    // Đúng khuôn prototype "Lumina Pro" Giang cung cấp: base = pixel gốc sau thao tác vĩnh viễn,
    // render = kết quả filter hiện tại (không phá base, cho phép chỉnh lại), interact = overlay
    // tương tác (khung crop/nét vẽ nháp — CHƯA dùng ở bản đầu, chỉ mục "Điều chỉnh").
    const canvasWrap = document.createElement('div');
    canvasWrap.id = 'image-edit-canvas-wrap';
    canvasWrap.className = 'hidden absolute inset-0 flex items-center justify-center';
    const baseCanvas = document.createElement('canvas');
    baseCanvas.id = 'image-edit-base-canvas';
    baseCanvas.className = 'absolute max-w-full max-h-full';
    const renderCanvas = document.createElement('canvas');
    renderCanvas.id = 'image-edit-render-canvas';
    renderCanvas.className = 'absolute max-w-full max-h-full';
    const interactCanvas = document.createElement('canvas');
    interactCanvas.id = 'image-edit-interact-canvas';
    interactCanvas.className = 'absolute max-w-full max-h-full';
    canvasWrap.append(baseCanvas, renderCanvas, interactCanvas);
    overlay.appendChild(canvasWrap);

    // ---- Slider popup cho nhóm "Điều chỉnh" (brightness/contrast/...) — MỚI (31/07/2026), ẩn mặc
    // định, Workflow tự hiện lúc chọn 1 tool điều chỉnh từ Generic Drawer grid. Live-preview trực
    // tiếp (không có bước Cancel/Apply riêng như Crop — kéo tới đâu áp tới đó vào renderCanvas,
    // đúng khuôn "Lumina Pro" — đóng popup KHÔNG hoàn tác giá trị vừa chỉnh).
    const adjustPopup = document.createElement('div');
    adjustPopup.id = 'image-edit-adjust-popup';
    adjustPopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    adjustPopup.innerHTML = `
        <div class="flex justify-between items-center mb-3 text-sm">
            <span id="image-edit-adjust-label" class="text-white/90 font-medium"></span>
            <div class="flex items-center gap-2">
                <span id="image-edit-adjust-value" class="text-primary font-mono bg-white/10 px-2 py-0.5 rounded"></span>
                <button id="image-edit-adjust-done" type="button" class="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </button>
            </div>
        </div>
        <input type="range" id="image-edit-adjust-slider" min="-100" max="100" value="0" class="w-full">
    `;
    overlay.appendChild(adjustPopup);

    // ---- Context bar (Huỷ / tiêu đề / Áp dụng) — MỚI (31/07/2026), thay THẾ header lúc đang ở
    // Crop/Vẽ/Text (3 tool CẦN bước xác nhận riêng, khác "Điều chỉnh" live-preview không cần) —
    // Workflow tự ẩn header + hiện contextBar lúc vào 1 trong 3 tool này, đổi lại lúc thoát.
    const contextBar = document.createElement('div');
    contextBar.id = 'image-edit-context-bar';
    contextBar.className = 'hidden photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3';
    contextBar.innerHTML = `
        <button id="image-edit-context-cancel" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <span id="image-edit-context-title" class="text-white text-sm font-semibold tracking-wide"></span>
        <button id="image-edit-context-apply" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-primary hover:bg-blue-500 transition-colors text-white shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </button>
    `;
    overlay.appendChild(contextBar);

    // ---- Khung gõ chữ nổi (tool Text) — MỚI (31/07/2026), ẩn mặc định, kéo tay di chuyển được.
    const floatingText = document.createElement('div');
    floatingText.id = 'image-edit-floating-text';
    floatingText.contentEditable = 'true';
    floatingText.spellcheck = false;
    floatingText.className = 'hidden absolute z-20 bg-black/40 border border-dashed border-white text-white font-bold text-3xl px-4 py-2 min-w-[60px] text-center whitespace-pre-wrap break-words rounded-lg shadow-lg';
    floatingText.style.cursor = 'move';
    floatingText.textContent = t('fileManager.photo.image.editTextPlaceholder');
    overlay.appendChild(floatingText);

    // ---- Popup điều khiển Vẽ (Cọ/Tẩy + màu + cỡ nét) — MỚI (31/07/2026), ẩn mặc định.
    const drawControlsPopup = document.createElement('div');
    drawControlsPopup.id = 'image-edit-draw-popup';
    drawControlsPopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    drawControlsPopup.innerHTML = `
        <div class="flex justify-between items-center w-full mb-3">
            <div class="flex gap-4">
                <button id="image-edit-draw-brush" type="button" class="text-primary text-sm font-medium">${t('fileManager.photo.image.editDrawBrush')}</button>
                <button id="image-edit-draw-eraser" type="button" class="text-white/60 text-sm font-medium">${t('fileManager.photo.image.editDrawEraser')}</button>
            </div>
            <input type="color" id="image-edit-draw-color" value="#0A84FF" class="w-7 h-7 rounded-full p-0 border-0 bg-transparent overflow-hidden">
        </div>
        <input type="range" id="image-edit-draw-size" min="1" max="100" value="10" class="w-full">
    `;
    overlay.appendChild(drawControlsPopup);

    // ---- Popup dung sai màu (tool Tách nền) — MỚI (31/07/2026), ẩn mặc định.
    const magicPopup = document.createElement('div');
    magicPopup.id = 'image-edit-magic-popup';
    magicPopup.className = 'hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8';
    magicPopup.innerHTML = `
        <div class="flex justify-between text-xs text-white/70 mb-2">
            <span>${t('fileManager.photo.image.editMagicTolerance')}</span>
            <span id="image-edit-magic-value" class="font-mono">30</span>
        </div>
        <input type="range" id="image-edit-magic-slider" min="1" max="150" value="30" class="w-full">
        <p class="text-[11px] text-center text-white/50 mt-2">${t('fileManager.photo.image.editMagicHint')}</p>
    `;
    overlay.appendChild(magicPopup);

    // ---- Header nổi: X đóng (trái) + Edit/"..." (phải, gộp nhóm) ----
    const header = document.createElement('div');
    header.className = 'photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3 gap-2';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    header.appendChild(closeBtn);

    // SỬA (31/07/2026, mục 2/4 phản hồi Giang) — nút Edit RIÊNG (`editBtn` toggle mode) ĐÃ XOÁ khỏi
    // header — "Edit" giờ là 1 item TOGGLE trong dropdown "...", cùng khuôn "Zoom view" (xem
    // openImageActionMenu(), event/workflow/file-manager-photo.js). THAY vào chỗ đó: `toolsBtn` —
    // nút mở LẠI lưới tool Edit mode (Generic Drawer) sau khi người dùng tự tay đóng Drawer đi (nút
    // X trên Drawer) — TRƯỚC bản sửa này KHÔNG có cách nào mở lại (mục 4 Giang chỉ ra). ẨN mặc định
    // (`hidden`) — CHỈ Workflow hiện ra lúc `enterEditMode()`/ẩn lại lúc thoát Edit mode (xem
    // `exitEditMode()`, event/workflow/image-edit.js), cùng khuôn ẩn/hiện `canvasWrap`.
    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex items-center gap-2';
    const toolsBtn = document.createElement('button');
    toolsBtn.className = 'hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    toolsBtn.title = t('fileManager.photo.image.editGridTitle');
    toolsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>';
    rightGroup.appendChild(toolsBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    menuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>';
    rightGroup.appendChild(menuBtn);
    header.appendChild(rightGroup);
    overlay.appendChild(header);

    document.body.appendChild(overlay);

    // --- addEventListener: gom cuối hàm, sau khi cây DOM đã dựng xong hoàn toàn (Rule 5a) ---
    // `img` 'load' KHÔNG bắn eventBus — đây không phải quyết định nghiệp vụ theo tương tác người
    // dùng (Rule 5a chỉ áp cho đó), chỉ là chỉnh object-fit thuần trình bày dựa trên kích thước ảnh
    // vừa đo được, không ai cần biết/quyết định gì thêm ở Router/Workflow.
    img.addEventListener('load', () => {
        const imageIsLandscape = img.naturalWidth >= img.naturalHeight;
        const screenIsLandscape = window.innerWidth >= window.innerHeight;
        img.style.objectFit = (imageIsLandscape === screenIsLandscape) ? 'cover' : 'contain';
    }, { once: true });
    // KHÔNG gọi closeModal()/callback tham số nữa (SAI Rule 5a, xem docstring) — bắn thẳng eventBus,
    // Router (event/router/file-manager-photo.js) quyết định có bị Block gate chặn hay không.
    closeBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.close.click', payload: {} }));
    toolsBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.tools.click', payload: {} }));
    menuBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.menu.click', payload: { menuBtn } }));
    // SỬA (31/07/2026, Giang chỉ ra vi phạm Rule 5a mục 5) — 5 nút Edit mode dưới đây TRƯỚC ĐÂY bị
    // `event/workflow/image-edit.js` tự gán LẠI `.onclick` mỗi lần vào/thoát sub-tool khác nhau
    // (rải rác ở 4 hàm `_startXxxTool()` khác nhau, KHÔNG "gom cuối hàm", callback gọi thẳng
    // `this.xxx()` thay vì `eventBus.send()`) — SAI CẢ 2 điều kiện Rule 5a. Giờ wire ĐÚNG 1 LẦN ở
    // đây, msg.type CỐ ĐỊNH bất kể tool nào đang mở — Router (`imageEdit`) tự đọc
    // `workflowImageEdit.getActiveSubTool()` qua VirtualMachineState để chọn hàm Áp dụng đúng (Rule
    // 1: nơi gọi chọn hàm, không phải nút tự đổi nghĩa). `contextCancelBtn`/`adjustDoneBtn` hành vi
    // GIỐNG HỆT bất kể tool nào (`exitSubTool()`/`exitAdjustTool()`), không cần Router phân nhánh.
    contextBar.querySelector('#image-edit-context-cancel').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.subTool.cancel.click', payload: {} }));
    contextBar.querySelector('#image-edit-context-apply').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.subTool.apply.click', payload: {} }));
    adjustPopup.querySelector('#image-edit-adjust-done').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.adjust.done.click', payload: {} }));
    drawControlsPopup.querySelector('#image-edit-draw-brush').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.draw.selectBrush.click', payload: {} }));
    drawControlsPopup.querySelector('#image-edit-draw-eraser').addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.draw.selectEraser.click', payload: {} }));

    // SỬA (31/07/2026, Giang chỉ ra "Nhóm B không có ngoại lệ nào trong tài liệu") — pointer
    // Crop/Vẽ/Tách nền (`interactCanvas`) + kéo Text (`floatingText`) + 2 slider (Điều chỉnh/dung
    // sai Tách nền) TRƯỚC ĐÂY bị Workflow tự `addEventListener`/`removeEventListener` theo vòng đời
    // từng sub-tool — SAI Rule 5a y hệt 5 nút phía trên, KHÔNG có ngoại lệ nào miễn cho tần suất
    // event cao (Rule 4 chỉ miễn `console.log`, không miễn `addEventListener`/`eventBus`). Wire
    // ĐÚNG 1 LẦN ở đây, callback tính sẵn toạ độ/giá trị rồi CHỈ `eventBus.send()` — Router
    // (`imageEdit`) tự đọc `getActiveSubTool()` mỗi lần nhận để quyết định chạy gì (kể cả KHÔNG
    // chạy gì nếu đang 'none'/tool không liên quan — an toàn, hàm rẻ).
    const computeInteractPos = (clientX, clientY) => {
        const rect = interactCanvas.getBoundingClientRect();
        const scale = interactCanvas.width / (rect.width || interactCanvas.width || 1); // guard chia 0 hiếm (canvas chưa layout xong)
        return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
    };
    interactCanvas.addEventListener('pointerdown', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerDown', payload: computeInteractPos(e.clientX, e.clientY) }));
    interactCanvas.addEventListener('pointermove', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerMove', payload: computeInteractPos(e.clientX, e.clientY) }));
    interactCanvas.addEventListener('pointerup', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerUp', payload: {} }));
    interactCanvas.addEventListener('pointerleave', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.interactCanvas.pointerUp', payload: {} })); // trượt ra ngoài canvas lúc đang kéo = coi như nhả tay, cùng msg.type

    // `floatingText.pointerdown` wire Ở ĐÂY (phần tử ĐỘNG, tạo mới mỗi lần mở modal — đúng chỗ).
    // `document.pointermove`/`pointerup` theo dõi TIẾP quá trình kéo KHÔNG được wire ở đây — `document`
    // KHÔNG phải phần tử động của modal này (không tự mất khi modal đóng), wire lại mỗi lần mở modal
    // sẽ CHỒNG CHẤT listener qua nhiều lần mở/đóng — 2 listener đó wire ĐÚNG 1 LẦN DUY NHẤT ở
    // event/listener/image-edit.js (DOM tĩnh thật sự, đúng tầng Listener — xem file đó).
    floatingText.addEventListener('pointerdown', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.floatingText.pointerDown', payload: {} }));

    const adjustSliderEl = adjustPopup.querySelector('#image-edit-adjust-slider');
    adjustSliderEl.addEventListener('input', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.adjust.slider.input', payload: { value: parseInt(e.target.value, 10) } }));
    const magicSliderEl = magicPopup.querySelector('#image-edit-magic-slider');
    magicSliderEl.addEventListener('input', (e) => eventBus.send({ router: 'imageEdit', type: 'imageEdit.magic.slider.input', payload: { value: parseInt(e.target.value, 10) } }));

    // SỬA (31/07/2026, mục 2/4 phản hồi Giang) — thêm canvasWrap/base/render/interact/toolsBtn
    // (THAY `editBtn` đã xoá) cho Zoom→giữ nguyên, Edit mode dùng. imgEl vẫn trả nguyên (Zoom
    // mode/view thường đọc) — Edit mode tự ẩn imgEl, hiện canvasWrap + toolsBtn, xem
    // enterEditMode()/exitImagePreviewMode() (event/workflow/file-manager-photo.js).
    return {
        close: closeModal, imgEl: img, canvasWrap, baseCanvas, renderCanvas, interactCanvas, toolsBtn,
        header,
        adjustPopup, adjustLabelEl: adjustPopup.querySelector('#image-edit-adjust-label'),
        adjustValueEl: adjustPopup.querySelector('#image-edit-adjust-value'),
        adjustSliderEl,
        adjustDoneBtn: adjustPopup.querySelector('#image-edit-adjust-done'),
        contextBar, contextCancelBtn: contextBar.querySelector('#image-edit-context-cancel'),
        contextTitleEl: contextBar.querySelector('#image-edit-context-title'),
        contextApplyBtn: contextBar.querySelector('#image-edit-context-apply'),
        floatingText,
        drawControlsPopup, drawBrushBtn: drawControlsPopup.querySelector('#image-edit-draw-brush'),
        drawEraserBtn: drawControlsPopup.querySelector('#image-edit-draw-eraser'),
        drawColorEl: drawControlsPopup.querySelector('#image-edit-draw-color'),
        drawSizeEl: drawControlsPopup.querySelector('#image-edit-draw-size'),
        magicPopup, magicValueEl: magicPopup.querySelector('#image-edit-magic-value'),
        magicSliderEl,
    };
}

// ===================== "Nhóm A" (31/07/2026, Giang chỉ ra) =====================
// `event/workflow/file-manager-photo.js`/`image-edit.js` TRƯỚC ĐÂY tự `addEventListener` cho DOM
// ĐỘNG (panel push bởi `pushSettingsPanel()`, Generic Drawer bởi `openGenericDrawer()`) — SAI: Rule
// 5a cấp quyền `addEventListener` cho DOM động là quyền của CORE (hàm dựng ra cụm DOM đó), KHÔNG
// phải Workflow, dù callback có tuân đúng "chỉ gọi eventBus.send()" hay không — vấn đề là NƠI ĐẶT
// lệnh `addEventListener`, không phải nội dung callback. 5 hàm dưới đây dời TOÀN BỘ phần
// wire/`addEventListener` từ Workflow sang đây — Workflow giờ CHỈ còn gọi các hàm này NGAY SAU khi
// gọi `pushSettingsPanel()`/`openGenericDrawer()` (Workflow gọi Core, không tự cầm DOM API).
// KHÔNG dời phần "đợi transitionend rồi resolve/gọi tiếp" (mở picker, đóng Drawer) — đó là ĐIỀU PHỐI
// tuần tự giữa 2 lời gọi Core (cùng vai trò `taskManager` — Rule 3b cấm `taskManager` trong Core),
// vẫn ĐÚNG chỗ ở Workflow (xem `event/workflow/generic-drawer-helpers.js::closeFully()` — cùng lý
// do, KHÔNG đổi).

/** Wire 2 nút header panel Photo (upload/xoá nhanh, `headerActionHtml` của `pushSettingsPanel()`) —
 * gọi NGAY SAU `pushSettingsPanel()`, CHỈ 1 lần/lần mở panel.
 * @param {HTMLElement} panelEl
 */
function wirePhotoPanelHeaderActions(panelEl) {
    const uploadBtn = panelEl.querySelector('#btn-file-manager-image-upload-trigger');
    if (uploadBtn) uploadBtn.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.uploadTrigger.click', payload: {} });
    });
    const deleteModeBtn = panelEl.querySelector('#btn-file-manager-image-delete-mode');
    if (deleteModeBtn) deleteModeBtn.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.image.deleteMode.click', payload: {} });
    });
}

// XOÁ (loại bỏ Album khỏi Photo Panel) — wireAlbumListPanelHeaderActions() (nút "+" tạo album
// trong Album List sub-panel) bỏ hẳn cùng tính năng — panel đó đã xoá.

// DỜI ĐI (v13) — hàm mở Generic Drawer picker ĐÃ CHUYỂN sang core/media-picker-drawer-helper.js
// (`openMediaPickerDrawerUi()`). Lý do: nó phục vụ CẢ lưới ảnh lẫn lưới video, để nguyên tên
// `openPhotoImagePickerDrawerUi` trong file `photo-ui.js` thì tên hàm lẫn vị trí file đều KHÔNG
// phản ánh đúng nơi gọi thật.

/** Mở Generic Drawer lưới tool Edit mode — dựng headerHtml + gọi `openGenericDrawer()` + wire NGAY
 * closeBtn, TẤT CẢ Ở ĐÂY (Rule 5a, cùng lý do `openPhotoImagePickerDrawerUi()`).
 * @param {string} title @param {string} bodyHtml
 */
function openPhotoEditToolGridDrawerUi(title, bodyHtml) {
    openGenericDrawer({ // core/generic-drawer.js
        height: 'auto', maxHeight: '70vh',
        zIndex: Z_INDEX.IMAGE_ACTION_MENU_DRAWER, // service/z-index.js (131) — TRÊN modal xem ảnh (130), DƯỚI dropdown "..." (132)
        headerHtml: `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `,
        bodyHtml,
        bodyClass: 'overflow-y-auto',
    });
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.toolGrid.close.click', payload: {} }));
}

/** Wire delegated click trên `genericDrawerBody` cho tile lưới tool Edit mode (`[data-edit-tool]`)
 * — gọi ĐÚNG 1 lần/phiên Edit mode (`enterEditMode()`), KHÔNG gọi lại mỗi lần
 * `openPhotoEditToolGridDrawerUi()` mở lại lưới (listener cũ không tự mất theo `innerHTML`, gắn lại
 * sẽ chồng chất — xem cách dùng ở `event/workflow/image-edit.js::_wireEditToolGridDelegation()`).
 * Cùng lý do "PHẢI tự wire/gỡ theo vòng đời" như `openPhotoImagePickerDrawerUi()` ở trên.
 * @returns {() => void} hàm gỡ — Workflow tự lưu, gọi lúc thoát Edit mode.
 */
function wirePhotoEditToolGridDelegation() {
    const handler = (e) => {
        const tile = e.target.closest('[data-edit-tool]');
        if (!tile) return;
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.toolGrid.tile.click', payload: { tool: tile.dataset.editTool } });
    };
    genericDrawerBody.addEventListener('click', handler);
    return () => genericDrawerBody.removeEventListener('click', handler);
}

// SỬA (21/07/2026, Giang yêu cầu "menu action ảnh chuyển từ Generic Drawer sang dropdown") —
// `buildPhotoActionMenuHtml()` (bodyHtml cho Generic Drawer, icon hoá) ĐÃ XOÁ HẲN — menu action giờ
// dùng `openDropdownMenu()` (core/dropdown-menu.js), xem event/workflow/file-manager-photo.js::
// openImageActionMenu() (5 icon SVG dời sang thẳng đó, dùng lại nguyên văn).

