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
 * NẠP SAU: core/dom-refs.js (fileManagerAlbumStory/fileManagerImageMasonry/fileManagerImageEmpty),
 * lang/lang.js (t()).
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): `renderImageMasonry()` nhận thêm 2 tham số tuỳ chọn (selectionMode/
 * selectedImageKeys) để vẽ dấu tick chọn nhiều; `openRenameAlbumModal()` — đổi tên album, cùng
 * khuôn `openRenameFolderModal()`.
 */

// ===================== Story slider Album =====================

/**
 * @param {Array<{id: string, name: string, imageKeys: string[]}>} albums
 * @param {string|null} activeAlbumId - album đang lọc (null = "Tất cả")
 * @param {Map<string, Object>} imageRecordsByKey - key -> {blob,...}, dùng lấy ảnh đại diện đầu
 *        tiên của mỗi album mà KHÔNG cần đọc DB lại (workflow đã có sẵn từ listImages()).
 */
function renderAlbumStory(albums, activeAlbumId, imageRecordsByKey) {
    if (!fileManagerAlbumStory) return; // guard

    // Revoke toàn bộ object URL cũ trước khi xoá DOM (tránh rò rỉ bộ nhớ — cùng pattern renderPlaylistDiff)
    fileManagerAlbumStory.querySelectorAll('[data-has-object-url]').forEach((node) => {
        if (node._objectUrl) { try { URL.revokeObjectURL(node._objectUrl); } catch (e) {} }
    });
    fileManagerAlbumStory.innerHTML = '';

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
    fileManagerAlbumStory.appendChild(allItem);

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

        fileManagerAlbumStory.appendChild(item);
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
    fileManagerAlbumStory.appendChild(newItem);
}

// ===================== Masonry ảnh =====================

/**
 * MỚI (batch tiếp theo 03/07/2026, mục 2.3) — thêm 2 tham số selectionMode/selectedImageKeys, hàm
 * VẪN THUẦN (không I/O, không appState — Rule 2 N/A cho hàm dựng UI nhưng vẫn giữ đúng tinh thần
 * "nhận qua tham số" cho nhất quán). Khi selectionMode=true, mỗi tile thêm 1 dấu tick tròn góc trên
 * phải (đã chọn = nền sky-500, chưa chọn = viền trắng mờ) — click tile lúc này KHÔNG mở preview mà
 * toggle chọn/bỏ (xem event/router/file-manager-photo.js).
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {boolean} [selectionMode]
 * @param {Set<string>} [selectedImageKeys]
 */
function renderImageMasonry(images, selectionMode, selectedImageKeys) {
    if (!fileManagerImageMasonry) return; // guard

    fileManagerImageMasonry.querySelectorAll('[data-has-object-url]').forEach((node) => {
        if (node._objectUrl) { try { URL.revokeObjectURL(node._objectUrl); } catch (e) {} }
    });
    fileManagerImageMasonry.innerHTML = '';

    if (fileManagerImageEmpty) fileManagerImageEmpty.classList.toggle('hidden', images.length > 0);

    images.forEach((image) => {
        const tile = document.createElement('button');
        tile.dataset.imageKey = image.key;
        tile.dataset.hasObjectUrl = '1';
        tile.className = 'relative block w-full mb-2 break-inside-avoid rounded-xl overflow-hidden bg-white/5 border border-white/10';

        const img = document.createElement('img');
        img.className = 'w-full h-auto block';
        img.alt = image.filename;
        tile.appendChild(img);

        if (selectionMode) {
            const isSelected = selectedImageKeys.has(image.key);
            const badge = document.createElement('span');
            badge.className = `absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-sky-500 border-sky-400' : 'bg-black/40 border-white/60'}`;
            if (isSelected) {
                badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>';
            }
            tile.appendChild(badge);
        }

        _observeLazyThumbnail(tile, image.blob, img);
        fileManagerImageMasonry.appendChild(tile);
    });
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

// ===================== Picker chọn 1 ảnh dùng chung (MỚI batch 03/07/2026) =====================
// Dùng bởi tab "Ảnh bìa" (modal Sửa thông tin bài hát, components/playlist-view.js) — xem
// readme/song-cover-background-relations.md mục 2/3. Lưới ảnh CHỈ ĐỌC (không xoá/không album),
// bấm 1 ảnh là chọn luôn + đóng modal — khác hẳn masonry Photo & Album (xem/quản lý thư viện).
/**
 * @param {Array<{key: string, blob: Blob, filename: string}>} images
 * @param {(imageKey: string) => void} onSelect
 */
function openImageLibraryPickerModal(images, onSelect) {
    const stale = document.getElementById('image-library-picker-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'image-library-picker-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex flex-col';

    function closeModal() { overlay.remove(); }

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
            tile.addEventListener('click', () => { closeModal(); onSelect(image.key); });
            grid.appendChild(tile);
        });
    }
    overlay.appendChild(grid);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    document.body.appendChild(overlay);
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
// MỚI (batch 03/07/2026, hạ tầng z-index nền Visual) — mục "đặt làm ảnh nền Playlist/Visual" (nối
// nốt phần đã hoãn ở Batch 3, nay 2 field vizConfig liên quan — bgImageKey/visualBgImageKey — ĐÃ
// tồn tại, xem service/state.js) — thêm 2 nút trong 1 hàng riêng dưới ảnh + 2 callback MỚI
// onSetPlaylistBg/onSetVisualBg (event/workflow/file-manager-photo.js tự nối logic thật).
/**
 * @param {{key: string, blob: Blob, filename: string}} image
 * @param {{onDelete: () => void, onSetPlaylistBg: () => void, onSetVisualBg: () => void}} callbacks
 */
function openImagePreviewModal(image, callbacks) {
    const stale = document.getElementById('image-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(image.blob);

    const overlay = document.createElement('div');
    overlay.id = 'image-preview-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex flex-col';

    function closeModal() {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        overlay.remove();
    }

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-4 py-3 shrink-0';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'px-4 py-2 rounded-full bg-rose-600/90 hover:bg-rose-500 transition-colors text-white text-sm font-semibold';
    deleteBtn.textContent = t('fileManager.photo.image.btnDelete');
    deleteBtn.addEventListener('click', () => { closeModal(); callbacks.onDelete(); });
    header.appendChild(deleteBtn);
    overlay.appendChild(header);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'flex-1 flex items-center justify-center px-4 pb-6 min-h-0';
    const img = document.createElement('img');
    img.src = objectUrl;
    img.alt = image.filename;
    img.className = 'max-w-full max-h-full object-contain rounded-lg';
    imgWrap.appendChild(img);
    overlay.appendChild(imgWrap);

    // MỚI — hàng "Đặt làm nền", 2 nút ngang bằng nhau, dưới ảnh, trên safe-area đáy màn hình.
    const setBgRow = document.createElement('div');
    setBgRow.className = 'flex gap-3 px-4 pb-6 shrink-0';
    const setPlaylistBgBtn = document.createElement('button');
    setPlaylistBgBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-semibold transition-colors';
    setPlaylistBgBtn.textContent = t('fileManager.photo.image.btnSetPlaylistBg');
    setPlaylistBgBtn.addEventListener('click', () => { closeModal(); callbacks.onSetPlaylistBg(); });
    const setVisualBgBtn = document.createElement('button');
    setVisualBgBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-semibold transition-colors';
    setVisualBgBtn.textContent = t('fileManager.photo.image.btnSetVisualBg');
    setVisualBgBtn.addEventListener('click', () => { closeModal(); callbacks.onSetVisualBg(); });
    setBgRow.appendChild(setPlaylistBgBtn);
    setBgRow.appendChild(setVisualBgBtn);
    overlay.appendChild(setBgRow);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    document.body.appendChild(overlay);
}
