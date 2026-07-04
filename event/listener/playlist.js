/**
 * event/listener/playlist.js — TẤT CẢ listener thuộc "module Playlist" (hành động trên 1 bài,
 * nạp nhạc mới, sắp xếp/kiểu xem/tìm kiếm) nằm CHUNG file này — ranh giới nhóm theo CHỨC NĂNG,
 * không theo tên file core cũ (actions.js/loader.js/main.js).
 *
 * QUY TẮC (giống listener/storage.js — ẩn dụ "người gửi thư"):
 *   - Listener KHÔNG biết, KHÔNG quan tâm nội dung nghiệp vụ là gì.
 *   - Mỗi handler CHỈ làm 1 việc: gom đúng data cần gửi (đọc event/dataset hiện có, KHÔNG tạo
 *     state mới, KHÔNG tính toán gì) rồi gửi 1 message qua eventBus.send().
 *   - "Địa chỉ nhà" (msg.router) LUÔN là 'playlist' cho mọi listener trong file này.
 *
 * NGOẠI LỆ: 2 listener input file (#audio-upload, #audio-upload-folder) CHỐT FileList ra Array
 * thật + reset input.value NGAY trong listener (xem comment chi tiết ở từng khối — đây là hành
 * vi gắn chặt với timing của chính sự kiện DOM 'change', không thể dời ra ngoài).
 *
 * KHÔNG tự document.getElementById trong file này — dùng lại biến đã có sẵn ở core/dom-refs.js.
 *
 * NẠP SAU CÙNG (sau bus, store, core, playlist/*, workflow, router, VÀ SAU dom-refs.js) — cần cả
 * eventBus.send() và mọi biến DOM đã sẵn sàng trước khi gắn addEventListener.
 */

// ===================== Menu 3 chấm =====================
if (songActionOverlay) {
    songActionOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.actionOverlay.click', payload: {} });
    });
}

if (songActionMenu) {
    songActionMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-menu-action]');
        if (!btn) return; // không bấm trúng 1 trong các nút hành động -> không gửi gì cả
        // MỚI (mục 1d, CHỐT 03/07/2026): addToFolder đi message RIÊNG, KHÔNG qua
        // 'playlist.actionMenu.select' (handleSongActionMenuSelect() cũ) — xem comment ở
        // components/playlist-view.js chỗ khai báo nút này.
        if (btn.dataset.menuAction === 'addToFolder') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.addToFolder', payload: {} });
            return;
        }
        eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.select', payload: { action: btn.dataset.menuAction } });
    });
}

if (playlistContainer) {
    playlistContainer.addEventListener('click', (e) => {
        const menuBtn = e.target.closest('button[data-action="menu"]');
        if (menuBtn) {
            e.stopPropagation(); // giữ nguyên hành vi gốc — tránh bắn tiếp sự kiện 'play-item' phía dưới
            eventBus.send({ router: 'playlist', type: 'playlist.item.menuClick', payload: { key: menuBtn.dataset.key, anchorBtn: menuBtn } });
            return;
        }
        const item = e.target.closest('[data-role="play-item"]');
        if (item) {
            eventBus.send({ router: 'playlist', type: 'playlist.item.playClick', payload: { key: item.dataset.key } });
        }
    });
}

// ===================== Modal: Bài hát lỗi lúc phát =====================
if (btnPlaybackErrorKeep) {
    btnPlaybackErrorKeep.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.playbackError.keep', payload: {} });
    });
}

if (btnPlaybackErrorDelete) {
    btnPlaybackErrorDelete.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.playbackError.delete', payload: {} });
    });
}

// ===================== Modal: Sửa thông tin (Thông tin + Ảnh bìa) =====================
// songEditTabButtons: NodeList nhiều nút (mỗi nút tự biết tab của mình qua dataset.editTab) —
// gắn listener trong forEach là CẦN THIẾT (mỗi nút là 1 target DOM riêng), nhưng mỗi handler vẫn
// CHỈ làm đúng 1 việc: đọc dataset của CHÍNH nút đó rồi gửi 1 message — không khác gì 1 listener
// thường về bản chất, không có state riêng theo từng nút cần xử lý ở tầng listener.
if (songEditTabButtons) {
    songEditTabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            eventBus.send({ router: 'playlist', type: 'playlist.editTab.select', payload: { tab: btn.dataset.editTab } });
        });
    });
}

// VIẾT LẠI (04/07/2026, mục 3 phản hồi Giang) — bỏ hẳn nút Upload (#song-edit-cover-upload) + input
// file trực tiếp: chỉ còn nút "Choose photo" mở picker (xem
// event/workflow/playlist.js::pickCoverFromLibrary).
if (songEditCoverPickLibraryBtn) {
    songEditCoverPickLibraryBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.editCover.pickFromLibrary', payload: {} });
    });
}

if (songEditCoverRemoveBtn) {
    songEditCoverRemoveBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.editCover.remove', payload: {} });
    });
}

if (btnSongEditCancel) {
    btnSongEditCancel.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.edit.cancel', payload: {} });
    });
}

if (btnSongEditSave) {
    btnSongEditSave.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.edit.save', payload: {} });
    });
}

// ===================== Modal: Thông tin chi tiết bài hát =====================
if (btnSongInfoClose) {
    btnSongInfoClose.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.info.close', payload: {} });
    });
}

if (btnSongInfoExport) {
    btnSongInfoExport.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.info.export', payload: {} });
    });
}

// ===================== Nạp nhạc mới (file rời / cả thư mục) =====================
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        // FIX (ver 8 refine #2): e.target.files là FileList SỐNG, gắn trực tiếp với <input> — một
        // số trình duyệt/WebView làm RỖNG nó NGAY khi input.value bị set lại. Chốt ra Array thật
        // (Array.from) TRƯỚC khi đụng e.target.value, để payload gửi đi không bị ảnh hưởng bởi
        // bất kỳ thay đổi nào lên input sau đó (xem comment đầy đủ ở core/playlist/loader.js).
        const fileList = Array.from(e.target.files || []);
        e.target.value = '';
        eventBus.send({ router: 'playlist', type: 'playlist.upload.fileChange', payload: { fileList } });
    });
}

if (folderInput) {
    folderInput.addEventListener('change', (e) => {
        const fileList = Array.from(e.target.files || []);
        e.target.value = '';
        eventBus.send({ router: 'playlist', type: 'playlist.upload.folderChange', payload: { fileList } });
    });
}

if (btnUploadAudio) {
    btnUploadAudio.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.uploadMenu.open', payload: {} });
    });
}

if (songActionOverlay) {
    songActionOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.uploadMenu.overlayClick', payload: {} });
    });
}

if (uploadActionMenu) {
    uploadActionMenu.addEventListener('click', (e) => {
        eventBus.send({ router: 'playlist', type: 'playlist.uploadMenu.labelClick', payload: { target: e.target } });
    });
}

// ===================== Sắp xếp / Kiểu xem / Tìm kiếm =====================
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'playlist', type: 'playlist.sortMode.change', payload: { mode: e.target.value } });
    });
}

if (viewModeSelect) {
    viewModeSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'playlist', type: 'playlist.viewMode.change', payload: { mode: e.target.value } });
    });
}

if (playlistSearchInput) {
    playlistSearchInput.addEventListener('input', (e) => {
        eventBus.send({ router: 'playlist', type: 'playlist.search.input', payload: { value: e.target.value } });
    });
}

if (playlistSearchClear) {
    playlistSearchClear.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.search.clear', payload: {} });
    });
}

// ===================== Ver 12 "Multi Media" — Chọn nhiều (mục 4.b1) =====================
if (btnToggleSelection) {
    btnToggleSelection.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.selection.toggle', payload: {} });
    });
}

if (btnSelectionMore) {
    btnSelectionMore.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.selection.moreMenu.open', payload: {} });
    });
}

if (selectionMoreMenu) {
    selectionMoreMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-menu-action]');
        if (!btn) return; // không bấm trúng 1 trong 4 hành động -> không gửi gì cả, giống songActionMenu
        eventBus.send({ router: 'playlist', type: 'playlist.selection.moreMenu.select', payload: { action: btn.dataset.menuAction } });
    });
}

if (songActionOverlay) {
    // Listener THỨ 3 trên CÙNG #song-action-overlay (2 listener khác đã có cho song-action-menu/
    // upload-action-menu, xem đầu file) — mỗi menu tự đóng menu CỦA MÌNH khi bấm ra ngoài, không
    // ảnh hưởng nhau (đóng 1 menu đã ẩn sẵn là no-op vô hại), đúng pattern đã có.
    songActionOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.selection.moreMenu.close', payload: {} });
    });
}

