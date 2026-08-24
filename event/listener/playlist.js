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
 * NGOẠI LỆ: 2 listener input file (#media-upload, #media-upload-folder — DÙNG CHUNG cho cả 3
 * Nguồn Song/Video/Photo, phản hồi Giang "1 khung, không nhân bản") CHỐT FileList ra Array
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
        // MỚI (Giang yêu cầu — "thêm dropdown edit image -> mở openImagePreview()") — CÙNG
        // PRECEDENT với 'editVideoFile' ngay trên.
        if (btn.dataset.menuAction === 'editImage') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.editImage', payload: {} });
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

// MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video) — nút duration trong tab "Sửa" của
// nhóm field Photo, mở time-picker (xem event/workflow/playlist.js::openPhotoEditDurationPicker()).
if (songEditPhotoDurationBtn) {
    songEditPhotoDurationBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.edit.photoDuration.click', payload: {} });
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

// ===================== Nạp media mới (file rời / cả thư mục) — DÙNG CHUNG Song/Video/Photo,
// router (event/router/playlist.js) tự rẽ nhánh theo activeMediaSource =====================
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

// XOÁ (phản hồi Giang — "1 khung, không nhân bản") — listener riêng của #video-upload-input
// (msg.type 'playlist.upload.videoFileChange') bỏ hẳn cùng lúc element đó bị xoá — Video giờ bắn
// CHUNG 'playlist.upload.fileChange'/'playlist.upload.folderChange' qua fileInput/folderInput ở
// trên với Song/Photo, router (event/router/playlist.js) tự rẽ nhánh VirtualMachineState theo
// activeMediaSource để gọi đúng hàm xử lý từng Nguồn.

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
// SỬA (mục 1b, Sort subpanel) — `sortSelect` (select tĩnh cũ ở Main list) ĐÃ XOÁ khỏi DOM
// (components/settings/playlist-view.js) — "Sắp xếp" giờ là 1 SUBPANEL riêng (btnOpenPlaylistSort
// mở panel + 2 <select> BÊN TRONG panel, delegate trên settingsStackBody — xem khối cuối file).

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

// MỚI (mục 1b, Sort subpanel) — nút mở panel "Sắp xếp" (Main list, tĩnh).
if (btnOpenPlaylistSort) {
    btnOpenPlaylistSort.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.sortPanel.open.click', payload: {} });
    });
}

// MỚI (mục 1d, Filter subpanel) — nút mở panel "Lọc" (Main list, tĩnh).
if (btnOpenPlaylistFilter) {
    btnOpenPlaylistFilter.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.filterPanel.open.click', payload: {} });
    });
}

// ===================== Panel "Sắp xếp" (settings-stack, delegate) =====================
// 3 <select> BÊN TRONG panel — id CỐ ĐỊNH, xem components/playlist-sort-drawer.js. SỬA (mục 3,
// phản hồi Giang — "tách field/hướng thành 2 dropdown riêng") — thêm `payloadKey` vì mỗi msg.type
// dùng tên field payload khác nhau ('mode'/'field'/'direction').
const PLAYLIST_SORT_PANEL_INPUT_MAP = {
    'setting-playlist-sort-name': { type: 'playlist.sortMode.change', payloadKey: 'mode' },
    'setting-playlist-sort-stat-field': { type: 'playlist.statSortField.change', payloadKey: 'field' },
    'setting-playlist-sort-stat-direction': { type: 'playlist.statSortDirection.change', payloadKey: 'direction' },
};

function handlePlaylistSortPanelChange(e) {
    const entry = PLAYLIST_SORT_PANEL_INPUT_MAP[e.target.id];
    if (!entry) return;
    eventBus.send({ router: 'playlist', type: entry.type, payload: { [entry.payloadKey]: e.target.value } });
}

// ===================== Panel "Lọc" (settings-stack, delegate) =====================
// Field theo Nguồn (name/album/artist/addedAt/count/totalTime/size) — mỗi control mang
// data-filter-field/data-filter-prop TƯỜNG MINH (xem components/playlist-filter-drawer.js) —
// KHÔNG suy field/prop từ `id` (khối "đơn"/"range" của field số CÙNG prop 'value' nhưng khác id).

function handlePlaylistFilterPanelEvent(e) {
    if (e.type === 'click' && e.target.closest('#btn-playlist-filter-apply')) {
        eventBus.send({ router: 'playlist', type: 'playlist.filterPanel.apply.click', payload: {} });
        return;
    }
    const el = e.target.closest('[data-filter-field]');
    if (!el) return;
    const { filterField: field, filterProp: prop } = el.dataset;
    if (!field || !prop) return;
    // MỚI (phản hồi Giang — "totalTime/duration dùng time picker modal") — nút mở time-picker
    // (data-filter-time-trigger) là 'click' THẬT SỰ (KHÔNG như op/mode/value/valueTo thường —
    // những cái đó chỉ nghe 'change'/'input', xem 2 guard clause ngay dưới) — bắt TRƯỚC 2 guard đó.
    if (el.hasAttribute('data-filter-time-trigger')) {
        if (e.type !== 'click') return;
        eventBus.send({ router: 'playlist', type: 'playlist.filterPanel.openTimePicker.click', payload: { field, prop } });
        return;
    }
    if (prop === 'enabled' && e.type !== 'change') return; // checkbox chỉ nghe 'change'
    if (prop !== 'enabled' && e.type === 'click') return; // op/mode/value/valueTo không có 'click'
    const value = prop === 'enabled' ? el.checked : el.value;
    eventBus.send({ router: 'playlist', type: 'playlist.filterPanel.field.change', payload: { field, prop, value } });
}

if (genericDrawerBody) { // SỬA (đợt tái cấu trúc bottom nav) — settingsStackBody nay thuộc Photo, nội dung này sống trong genericDrawerBody
    genericDrawerBody.addEventListener('change', handlePlaylistSortPanelChange);
    genericDrawerBody.addEventListener('change', handlePlaylistFilterPanelEvent);
    genericDrawerBody.addEventListener('input', handlePlaylistFilterPanelEvent);
    // nút "Áp dụng" (bare click, id `btn-playlist-filter-apply`) — CÙNG handler, nhánh riêng ở đầu
    // hàm (KHÔNG khớp regex `filter-*` nên phải bắt TRƯỚC, xem đầu handlePlaylistFilterPanelEvent()).
    genericDrawerBody.addEventListener('click', handlePlaylistFilterPanelEvent);
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

