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
        // MỚI (19/09/2026, Giang yêu cầu — "thêm nút xem thumb full res cho video playlist") — CÙNG
        // PRECEDENT với 'editImage' ngay trên.
        if (btn.dataset.menuAction === 'viewVideoThumb') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.viewVideoThumb', payload: {} });
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
        // MỚI (09/09/2026, Giang báo bug "Gỡ khỏi thư mục ở menu 1 item không dùng được") — action
        // NÀY đã có nút trong HTML (song-menu-btn-remove-from-folder, components/playlist-view.js)
        // + hàm workflow xử lý sẵn (workflowPlaylist.removeSongFromFolderMenu(), event/workflow/
        // playlist.js) TỪ TRƯỚC (06/09/2026, hợp nhất Folder vào Playlist) nhưng LỠ SÓT không nối
        // dây ở listener này — bấm không gửi msg nào, hàm workflow không bao giờ được gọi. Cùng
        // PRECEDENT với 'delete' ngay trên (cần songKey trong payload).
        if (btn.dataset.menuAction === 'removeFromFolder') {
            eventBus.send({ router: 'playlist', type: 'playlist.actionMenu.removeFromFolder.click', payload: { songKey: playlistStore.get('songActionMenuKey') } });
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

// MỚI (02/10/2026, Giang chốt phương án A — `content-visibility: auto` cho item Playlist) — khung cuộn Playlist (div
// `overflow-y-auto` bọc #playlist-container, components/playlist-view.js) đổi kích thước -> báo Router kèm BỀ RỘNG mới
// (Workflow chỉ đo lại chiều cao ước lượng của item khi bề rộng đổi — tile Grid cao theo bề rộng cột, xoay máy là đổi).
// ResizeObserver tự gom về 1 lần/khung hình.
if (playlistContainer && playlistContainer.parentElement && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver((entries) => {
        const width = entries[entries.length - 1].contentRect.width;
        eventBus.send({ router: 'playlist', type: 'playlist.viewport.resize', payload: { width } });
    }).observe(playlistContainer.parentElement);
}

// MỚI (02/10/2026, tối ưu 10000 item — Giang duyệt) — ảnh bìa gắn THEO NHU CẦU: buildSongNode() dựng node bìa thật ở
// trạng thái chờ (`data-cover-pending="true"`, <img> chưa có src). MutationObserver bám #playlist-container: node chờ bìa
// được thêm vào -> IntersectionObserver theo dõi; node rời DOM -> thôi theo dõi (IntersectionObserver giữ tham chiếu
// mạnh tới mục tiêu — không gỡ là rò node cũ). Node lại gần khung nhìn (cách 1 màn hình trên/dưới) -> thôi theo dõi
// (1 lần là đủ) + báo Router danh sách key để Workflow gắn object URL (event/workflow/playlist-render.js::
// attachCoverUrls()). Node ẩn vì Search (display:none) không bao giờ "giao nhau" nên chưa tải cho tới khi hiện lại.
if (playlistContainer && playlistContainer.parentElement
    && typeof IntersectionObserver !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const coverNearViewportObserver = new IntersectionObserver((entries) => {
        const keys = [];
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            coverNearViewportObserver.unobserve(entry.target);
            keys.push(entry.target.dataset.key);
        });
        if (!keys.length) return;
        eventBus.send({ router: 'playlist', type: 'playlist.cover.nearViewport', payload: { keys } });
    }, { root: playlistContainer.parentElement, rootMargin: '100% 0px' });

    new MutationObserver((records) => {
        // Gom mọi node bị đụng trong lượt này rồi xét trạng thái CUỐI (diff dời node = 1 bản ghi gỡ + 1 bản ghi thêm).
        const touched = new Set();
        records.forEach((record) => {
            record.addedNodes.forEach((node) => touched.add(node));
            record.removedNodes.forEach((node) => touched.add(node));
        });
        touched.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.isConnected && node.dataset.coverPending === 'true') coverNearViewportObserver.observe(node);
            else coverNearViewportObserver.unobserve(node);
        });
    }).observe(playlistContainer, { childList: true });
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

// XOÁ (06/09/2026, Giang chỉ ra bug liên quan) — listener cũ gắn lên biến toàn cục
// `mediaSourceSelect` (core/dom-refs.js), capture 1 LẦN qua document.getElementById() lúc script
// nạp — TỪ LÚC Settings migrate sang Generic Drawer content-swap, phần tử `<select>` này chỉ tồn
// tại đúng lúc màn Playlist Settings đang MỞ (bị huỷ/dựng lại mỗi lần đóng/mở), nên biến đó luôn
// `null` cả phiên -> guard `if (mediaSourceSelect)` chặn HẲN, listener này CHẾT, chưa từng thật sự
// gắn được. Listener THẬT đang chạy là `wireAppSettingsPlaylist()` (core/app-settings-ui.js),
// query lại `#setting-playlist-media-source` SỐNG mỗi lần render — dọn hẳn bản chết ở đây, tránh
// nhầm 2 nơi cùng lo 1 việc. Biến `mediaSourceSelect` (dom-refs.js) cũng đã xoá theo, xem
// core/dom-refs.js.

// MỚI (mục 1b, Sort subpanel) — nút mở panel "Sắp xếp" (Main list, tĩnh).
if (btnOpenPlaylistSort) {
    btnOpenPlaylistSort.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.sortPanel.open.click', payload: {} });
    });
}

// MỚI (mục 1d, Filter subpanel) — nút mở panel "Lọc" (Main list, tĩnh). SỬA (08/09/2026, hệ
// "Playlist Filter Presets") — mở danh sách preset (router "playlistFilterPresets", CÙNG lối vào
// Settings → Playlist → "Quản lý bộ lọc") thay vì thẳng bộ rule sống cũ.
if (btnOpenPlaylistFilter) {
    btnOpenPlaylistFilter.addEventListener('click', () => {
        eventBus.send({ router: 'playlistFilterPresets', type: 'playlistFilterPresets.openManage.click', payload: {} });
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

if (genericDrawerBody) { // SỬA (đợt tái cấu trúc bottom nav) — settingsStackBody nay thuộc Photo, nội dung này sống trong genericDrawerBody
    genericDrawerBody.addEventListener('change', handlePlaylistSortPanelChange);
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

// MỚI (06/09/2026, hợp nhất Folder vào Playlist, Batch 3) — nút X badge "đang Scope folder nào",
// xem components/playlist-view.js. Tĩnh, KHÔNG thuộc Generic Drawer content-swap — wiring 1 lần ở
// đây an toàn (đối xứng playlistSearchClear ngay trên), xem dom-refs.js.
if (playlistActiveFolderBadgeClose) {
    playlistActiveFolderBadgeClose.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.activeFolderBadge.exit.click', payload: {} });
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

