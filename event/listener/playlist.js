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

// SỬA (02/10/2026, rà file đã đụng) — chuỗi 9 `if (btn.dataset.menuAction === '...') { send; return; }` -> bảng tra
// hành động -> message (CÙNG 9 msg.type/payload như cũ). Lịch sử tách từng message riêng: addToFolder (mục 1d,
// 03/07/2026), editSubtitles (10/07/2026), editVideoFile/editImage (19/09/2026; viewVideoThumb XOÁ 06/10/2026), restore (Batch "Export
// dọn nợ"), delete/edit (v13 Batch F — xoá 'playlist.actionMenu.select' dùng chung), removeFromFolder (09/09/2026, sót nối
// dây). `songKey` trong payload của delete/removeFromFolder: message tự mô tả đối tượng (Block gate chỉ với tới payload) —
// đọc 1 giá trị để DỰNG payload, không phải nghiệp vụ (Rule 5a).
const SONG_ACTION_MENU_MESSAGE = {
    addToFolder: () => ({ type: 'playlist.actionMenu.addToFolder', payload: {} }),
    editSubtitles: () => ({ type: 'playlist.actionMenu.editSubtitles', payload: {} }),
    editVideoFile: () => ({ type: 'playlist.actionMenu.editVideoFile', payload: {} }),
    editImage: () => ({ type: 'playlist.actionMenu.editImage', payload: {} }),
    restore: () => ({ type: 'playlist.actionMenu.restore', payload: {} }),
    delete: () => ({ type: 'playlist.actionMenu.delete.click', payload: { songKey: playlistStore.get('songActionMenuKey') } }),
    removeFromFolder: () => ({ type: 'playlist.actionMenu.removeFromFolder.click', payload: { songKey: playlistStore.get('songActionMenuKey') } }),
    edit: () => ({ type: 'playlist.actionMenu.edit.click', payload: {} }),
};

if (songActionMenu) {
    songActionMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-menu-action]');
        if (!btn) return; // không bấm trúng 1 trong các nút hành động -> không gửi gì cả
        const buildMessage = SONG_ACTION_MENU_MESSAGE[btn.dataset.menuAction];
        if (!buildMessage) return; // hành động không có trong bảng
        eventBus.send({ router: 'playlist', ...buildMessage() });
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
        if (!item) return; // bấm ra ngoài mọi item
        eventBus.send({ router: 'playlist', type: 'playlist.item.playClick', payload: { key: item.dataset.key } });
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
        const nearTargets = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
        nearTargets.forEach((target) => coverNearViewportObserver.unobserve(target)); // 1 lần là đủ
        if (!nearTargets.length) return; // guard — lượt này không node nào lại gần
        eventBus.send({ router: 'playlist', type: 'playlist.cover.nearViewport', payload: { keys: nearTargets.map((target) => target.dataset.key) } });
    }, { root: playlistContainer.parentElement, rootMargin: '100% 0px' });

    new MutationObserver((records) => {
        // Gom mọi node bị đụng trong lượt này rồi xét trạng thái CUỐI (diff dời node = 1 bản ghi gỡ + 1 bản ghi thêm).
        const touched = new Set();
        records.forEach((record) => {
            record.addedNodes.forEach((node) => touched.add(node));
            record.removedNodes.forEach((node) => touched.add(node));
        });
        // Chỉ quản lý ĐĂNG KÝ theo dõi (không quyết định nghiệp vụ): gỡ hết node vừa bị đụng, rồi đăng ký lại đúng các
        // node còn trong DOM VÀ đang chờ bìa (cùng vai trò bộ chọn `closest('[data-role=...]')` của các listener khác).
        const touchedElements = [...touched].filter((node) => node.nodeType === 1);
        touchedElements.forEach((node) => coverNearViewportObserver.unobserve(node));
        touchedElements
            .filter((node) => node.isConnected && node.dataset.coverPending === 'true')
            .forEach((node) => coverNearViewportObserver.observe(node));
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

// SỬA (06/10/2026, Giang mục 3c) — nút "Choose" chỉ bung/thu menu 2 lựa chọn ngay dưới (Photo / Video thumbnail).
if (songEditCoverChooseBtn) {
    songEditCoverChooseBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.editCover.chooseMenu.toggle', payload: {} });
    });
}

// VIẾT LẠI (04/07/2026, mục 3 phản hồi Giang) — bỏ hẳn nút Upload (#song-edit-cover-upload) + input
// file trực tiếp. SỬA (06/10/2026) — nút này giờ là dòng "Photo" trong menu của "Choose" (message GIỮ NGUYÊN,
// xem event/workflow/playlist.js::pickCoverFromLibrary).
if (songEditCoverPickLibraryBtn) {
    songEditCoverPickLibraryBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.editCover.pickFromLibrary', payload: {} });
    });
}

// MỚI (06/10/2026, Giang mục 3c) — dòng "Video thumbnail": chọn 1 video, lấy thumb cover của nó làm ảnh bìa
// (event/workflow/playlist.js::pickCoverFromVideoThumb).
if (songEditCoverPickVideoThumbBtn) {
    songEditCoverPickVideoThumbBtn.addEventListener('click', () => {
        eventBus.send({ router: 'playlist', type: 'playlist.editCover.pickFromVideoThumb', payload: {} });
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

