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
        // MỚI (10/07/2026) — "Sửa phụ đề": CÙNG PRECEDENT với addToFolder ở trên (message riêng,
        // không qua handleSongActionMenuSelect() cũ — xem comment router/playlist.js).
        if (btn.dataset.menuAction === 'editSubtitles') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.editSubtitles', payload: {} });
            return;
        }
        // XOÁ (phản hồi Giang — "bỏ luôn set background cho dropdown của video đi") —
        // dispatch 'setAsBgVideo' đã bỏ hẳn cùng lúc với nút dropdown tương ứng.
        if (btn.dataset.menuAction === 'editVideoFile') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.editVideoFile', payload: {} });
            return;
        }
        // MỚI (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — "Xuất file": CÙNG PRECEDENT với
        // addToFolder/editSubtitles ở trên (message riêng, không qua handleSongActionMenuSelect()
        // cũ — hàm đó đã có sẵn nhánh if/else vi phạm Rule 1, không mở rộng thêm).
        if (btn.dataset.menuAction === 'restore') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.restore', payload: {} });
            return;
        }
        // SỬA (v13 Batch F) — 2 hành động cuối ('delete'/'edit') TÁCH thành msg.type RIÊNG, xoá
        // hẳn 'playlist.actionMenu.select' dùng chung. Đây là bước cuối của xu hướng đã chạy suốt
        // file này (addToFolder/editSubtitles/editVideoFile/restore lần lượt tách ra trước đó vì
        // `handleSongActionMenuSelect()` có if/else vi phạm Rule 1) — giờ hàm core đó không còn
        // nhánh nào, xoá luôn.
        // `songKey` ĐƯA VÀO PAYLOAD: message phải tự mô tả đối tượng nó tác động lên. Trước đây key
        // chỉ nằm trong `playlistStore` và core tự đọc — Block gate (chỉ với tới appState/appConfig/
        // payload) không kiểm được "bài sắp xoá có đang làm Visual Background không". Đọc 1 giá trị
        // để DỰNG payload cùng loại với đọc `btn.dataset`, không phải nghiệp vụ (Rule 5a).
        if (btn.dataset.menuAction === 'delete') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.delete.click', payload: { songKey: playlistStore.get('songActionMenuKey') } });
            return;
        }
        if (btn.dataset.menuAction === 'edit') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.edit.click', payload: {} });
            return;
        }
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

// MỚI (ver12 "Song/Video Unification", Batch 6, mục 7) — "Thêm video", CÙNG PATTERN
// fileInput/folderInput ngay trên (chốt FileList ra Array TRƯỚC khi đụng input.value — 1 số
// trình duyệt/WebView làm rỗng FileList sống ngay khi input.value bị set lại).
if (videoUploadInput) {
    videoUploadInput.addEventListener('change', (e) => {
        const fileList = Array.from(e.target.files || []);
        e.target.value = '';
        eventBus.send({ router: 'playlist', type: 'playlist.upload.videoFileChange', payload: { fileList } });
    });
}

// videoUploadMenu (dropdown "Thêm video" cũ) ĐÃ XOÁ (FIX 28/07/2026, "bỏ dropdown Video, input
// luôn") — #btn-upload-video giờ LÀ <label> bọc thẳng #video-upload-input (components/
// playlist-view.js) — click NATIVE lên label tự trigger input, KHÔNG cần listener JS nào ở đây,
// đúng pattern 2 label trong #upload-action-menu (Song) vốn cũng không có click listener riêng.

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

// MỚI (ver12 "Song/Video Unification", Batch 1) — select "Nguồn" (Song/Video).
if (mediaSourceSelect) {
    mediaSourceSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'playlist', type: 'playlist.mediaSource.change', payload: { source: e.target.value } });
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

