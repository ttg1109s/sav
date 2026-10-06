/**
 * event/workflow/playlist.js — "THẰNG THỰC THI CUỐI" của router "playlist".
 *
 * QUY TẮC (giống workflow/storage.js):
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — toàn bộ logic xử lý dữ liệu đã tồn tại SẴN
 *     dưới dạng hàm core thuần ở playlist/actions.js. Workflow chỉ là 1 CHUỖI GỌI các hàm đó
 *     ("chân tay") — đưa đúng data hàm nào cần, hàm nào không cần thì không đưa.
 *   - withLoadingShield() và alertModal()/modalChoice() ĐẶT Ở TẦNG NÀY — core hoàn toàn không
 *     biết 2 thứ này tồn tại.
 *   - QUY TẮC SHIELD/MODAL: alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của
 *     withLoadingShield() — luôn gọi SAU KHI shield đã đóng hẳn.
 *
 * Ban đầu (ver 11) chỉ 2 msg.type của router "playlist" cần phối hợp >1 hàm core (hoặc cần
 * shield) -> giao cho workflow xử lý ở đây: 'playlist.playbackError.delete' và 'playlist.edit.save'.
 * Ver 12 "Multi Media" (plan-v12-multimedia.md mục 4.b1) thêm 4 method cho "Chọn nhiều" (Phát đã
 * chọn/Xuất ZIP/Thêm vào thư mục/Xoá hàng loạt) — xem khối riêng cuối file. Mọi msg.type còn lại
 * router tự gọi thẳng 1 hàm core, KHÔNG đi qua workflow (xem router/playlist.js).
 */
/** DỜI từ event/workflow/file-manager-video.js (file đó đã xoá) — cạnh thumbnail vuông cố định
 * cho video upload, dùng bởi `uploadVideos()`/`extractVideoThumbAndMeta()` bên dưới. */
const VIDEO_THUMBNAIL_SIZE = 320;

/** MỚI (06/10/2026) — icon 2 mục dropdown "Choose" ở tab Ảnh bìa (openCoverChooseMenu()). Chuỗi SVG cố định trong
 * code (không có input người dùng) — core/dropdown-menu.js dán thẳng qua innerHTML. */
const SONG_EDIT_COVER_ICON_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
const SONG_EDIT_COVER_ICON_VIDEO = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';

/** MỚI (19/09/2026) — hằng số cho việc chụp KHUNG HÌNH ĐẦU video lúc upload (`extractVideoThumbAndMeta()`
 * và các hàm `_captureFirstFrame()`/`_probeVideoFrame()` cùng file). */
const VIDEO_MAX_CANVAS_PIXELS = 16777216; // trần diện tích canvas của Safari/iOS (4096×4096) — vượt là canvas không dùng được (ảnh đen)
const VIDEO_PROBE_SIZE = 32; // cạnh canvas nhỏ dùng đo alpha + độ sáng của khung vừa vẽ
const VIDEO_BLACK_PIXEL_LUMA = 26; // pixel coi là "đen" khi luma ≤ ngưỡng (~10% dải 0–255 — cùng mặc định pix_th của ffmpeg blackdetect)
const VIDEO_BLACK_FRAME_RATIO = 0.98; // khung coi là "đen" khi ≥ tỉ lệ này số pixel đen (cùng mặc định pic_th của ffmpeg blackdetect)
const VIDEO_BLACK_CONFIRM_COUNT = 3; // vẽ được nhưng vẫn đen chừng này lần (kể cả lần đầu) -> đen THẬT (fade-in...), chấp nhận
const VIDEO_FIRST_FRAME_RVFC_TIMEOUT_MS = 2500; // đợi requestVideoFrameCallback bắn khung đầu; quá hạn -> đường dự phòng
const VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC = 0.25; // khung rVFC đầu có mediaTime lớn hơn mốc này = không còn là khung đầu -> bỏ
const VIDEO_FIRST_FRAME_MAX_ATTEMPTS = 12; // số lần thử ở đường dự phòng / thumb vuông
const VIDEO_FIRST_FRAME_RETRY_MS = 150; // khoảng cách giữa 2 lần thử
const VIDEO_SEEK_TIMEOUT_MS = 3000; // đợi 'seeked' tối đa
const VIDEO_EXTRACT_TIMEOUT_MS = 10000; // timeout tổng 1 file (trước đây 8000)

/** MỚI (Giang yêu cầu — Photo tích hợp duration như Song/Video) — trần của time-picker mở ở
 * `openPhotoEditDurationPicker()` (dưới). SỬA (Giang chỉ ra đúng — modal `openTimePickerModal()`,
 * core/time-picker-modal.js, KHÔNG hề tự áp giới hạn gì — `maxMs` chỉ là 1 tham số config, nơi gọi
 * (TỨC file này) tự chọn giá trị) — hằng số dưới KHÔNG phải "trần của widget", mà là lựa chọn CỦA
 * RIÊNG chỗ gọi này. Ràng buộc THẬT DUY NHẤT nằm ở `buildColumn()` (core/time-picker-modal.js):
 * `count` dòng của cột thô nhất PHẢI hữu hạn (vòng lặp `appendChild()` DOM thật, không ảo hoá) —
 * truyền `Infinity` sẽ treo trình duyệt (tạo vô hạn phần tử).
 * SỬA (Giang yêu cầu — format đổi 'm-s' -> 'h-m-s') — cột thô nhất giờ là 'h' (giờ), TRẦN TỰ NHIÊN
 * (`TIME_PICKER_UNIT_CAP.h`, core/time-picker-modal.js) đã là 24 — `count = Math.max(naturalCap,
 * countFromMaxMs)` nên bất kỳ `maxMs` nào ≤ 24 giờ đều cho ĐÚNG 24 dòng giờ (0-23), trần tự nhiên
 * tự thắng, không cần chọn số to hơn nữa. Đặt thẳng 24 giờ cho rõ ý, RỘNG HƠN RẤT NHIỀU bất kỳ giá
 * trị nào computePhotoDuration() (event/workflow/file-manager-photo.js) thực tế tạo ra (~vài phút
 * ngay cả ảnh RAW cỡ trăm MB) — không phải cố tình giới hạn thấp.
 */
const PHOTO_EDIT_DURATION_PICKER_MAX_MS = 24 * 60 * 60 * 1000; // 24 giờ

/** MỚI (phản hồi Giang — "1 khung, không nhân bản, VMState theo activeMediaSource") — `accept`
 * của 2 input DÙNG CHUNG (`fileInput`/`folderInput`, core/dom-refs.js — #media-upload/
 * #media-upload-folder) đổi ĐỘNG theo Nguồn, xem `workflowPlaylist._applyUploadInputAccept()`. */
const UPLOAD_ACCEPT_BY_SOURCE = {
    song: '.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac',
    video: 'video/*',
    photo: 'image/*',
};

/** MỚI (07/09/2026, gộp 3 hàm switchToSongSource()/switchToVideoSource()/switchToPhotoSource() cũ
 * thành `switchSource(mediaType)` — 3 hàm đó chỉ khác nhau đúng 2 i18n key này, không khác luồng) —
 * dùng bởi `workflowPlaylist.switchSource()`. */
const MEDIA_SWITCH_I18N = {
    song: { loadingKey: 'playlistView.loading.withCount', placeholderKey: 'playlistView.search.placeholder' },
    video: { loadingKey: 'playlistView.loading.withCountVideo', placeholderKey: 'playlistView.search.placeholderVideo' },
    photo: { loadingKey: 'playlistView.loading.withCountPhoto', placeholderKey: 'playlistView.search.placeholderPhoto' },
};

/** MỚI (07/09/2026, gộp phần "chọn đúng get/delete record theo mediaType" — trước đây lặp lại y hệt
 * bằng ternary ở CẢ `deleteMediaFromActionMenu()` LẪN `deleteSelectedMedia()` bên dưới) — dùng bởi cả
 * 2 hàm đó, VÀ tái dùng ở `event/workflow/file-manager-storage.js::executeDeleteBroken()` (xoá
 * broken qua Quản lý dung lượng — CÙNG 3 bước get record/dọn folder/xoá record, chỉ khác nguồn key
 * đến từ đâu).
 * SỬA (07/09/2026, Giang chỉ ra "đằng nào cũng sửa, đổi tên luôn đỡ nhầm") — CẢ 3 `deleteRecord` đều
 * là hàm CRUD THUẦN (`service/db.js`, KHÔNG tự cascade folder) — đối xứng thật sự, không còn 2 tầng
 * hành vi khác nhau (trước đây `deleteVideo()`/`deleteImage()`, core/file-manager/video.js/image.js,
 * tự cascade RỒI xoá — 2 hàm đó ĐÃ XOÁ). Nơi gọi (Workflow) LUÔN tự gọi `removeSongFromAllFolders()`
 * TRƯỚC bước `deleteRecord` — ĐỒNG NHẤT cho cả 3 loại, không còn ai "tự lo" khác ai. */
// SỬA (06/10/2026, plan-media-db-split.md) — deleteSongRecord/deleteVideoRecord/deleteImageRecord ĐÃ XOÁ HẲN: xoá qua
// `deleteMediaRecord(type, key)` (3 store trong 1 transaction). `getRecord` giờ CHỈ đọc meta (chỉ cần field `folder`
// cho removeSongFromAllFolders(), không cần mở Blob).
const MEDIA_DELETE_ACCESSOR = {
    song: { getRecord: (key) => getMediaMeta('song', key), deleteRecord: (key) => deleteMediaRecord('song', key) }, // service/db.js
    video: { getRecord: (key) => getMediaMeta('video', key), deleteRecord: (key) => deleteMediaRecord('video', key) },
    photo: { getRecord: (key) => getMediaMeta('photo', key), deleteRecord: (key) => deleteMediaRecord('photo', key) },
};

/** MỚI (01/10/2026, Ghi âm) — lưu bản ghi xong: cập nhật danh sách RAM theo Nguồn đang chọn (event-bus-flow.md mục 7 —
 * object map). Chỉ Nguồn Song đụng danh sách; Video/Photo không làm gì (loader nạp lại từ DB khi chuyển sang Song). */
const RECORDED_SONG_INDEX_BY_SOURCE = {
    song: (key, record) => workflowPlaylist._indexRecordedSongInSongSource(key, record),
    other: () => {},
};

/** MỚI (02/10/2026, rà event-bus-flow.md mục 7) — switchSource(): Nguồn mới có folder Scope đang nhớ -> áp folder đó;
 * không -> cả thư viện. Trước đây if/else. Khoá boolean thật `!!folderForThisSource`. */
const SOURCE_SCOPE_APPLY_BY_HAS_FOLDER = {
    true: (folderId, mediaType, onProgress) => workflowPlaylistScope.applyFolderScope(folderId, mediaType, onProgress),
    false: (folderId, mediaType, onProgress) => workflowPlaylistScope.applyAllSongsScope(mediaType, onProgress),
};

const workflowPlaylist = {

    /** MỚI (21/09/2026, Giang yêu cầu — cuộn hoãn khi menu 3 chấm đang mở) — ĐƯỜNG ĐÓNG DUY NHẤT của menu 3 chấm
     * từ tầng Workflow/Router: đóng menu (core `closeSongActionMenu()`) RỒI chạy lượt cuộn tới bài đang phát nếu
     * bị hoãn lúc menu còn mở (`workflowPlaylistRender.scrollToCurrentOrDefer()`, event/workflow/playlist-render.js).
     * Mọi nơi trước đây gọi thẳng `closeSongActionMenu()` giờ gọi hàm này. */
    closeActionMenu() {
        closeSongActionMenu(); // core/playlist/actions.js
        workflowPlaylistRender.flushPendingScrollToCurrent(); // no-op nếu không có cuộn nào đang chờ
    },

    /** MỚI (phản hồi Giang — "1 khung, không nhân bản, VMState theo activeMediaSource") — đổi
     * `accept` của 2 input upload DÙNG CHUNG theo Nguồn hiện tại. Gọi từ CẢ 3 hàm switchTo*Source()
     * LẪN loadPersistedPlaylistConfigOnBoot() (khôi phục Nguồn lúc boot) — 4 nơi DUY NHẤT
     * activeMediaSource có thể đổi giá trị.
     * @param {'song'|'video'|'photo'} source
     */
    _applyUploadInputAccept(source) {
        const accept = UPLOAD_ACCEPT_BY_SOURCE[source] || UPLOAD_ACCEPT_BY_SOURCE.song;
        if (fileInput) fileInput.accept = accept;
        if (folderInput) folderInput.accept = accept;
    },

    /** MỚI (v13 Batch F) — ứng với 'playlist.actionMenu.delete.click'. THAY nhánh `action==='delete'`
     * của core `handleSongActionMenuSelect()` (đã xoá).
     * SỬA (07/09/2026, "đưa về chuẩn event bus + core rule") — GỘP THẲNG thân `window.removeSong()`
     * cũ (core/playlist/actions.js, ĐÃ XOÁ) vào đây thay vì gọi chéo qua `window.` — hàm đó vốn
     * mixed core/workflow (tự gọi alertModal/withLoadingShield, "core không biết shield/modal"
     * không áp dụng) và CHỈ CÓ ĐÚNG 1 caller (chính hàm này, đã kiểm tra toàn project), nên gộp về
     * ĐÚNG tầng Workflow thay vì giữ 2 lớp giả không cần thiết. Các bước con (get record theo
     * mediaType, removeSongFromAllFolders/deleteRecord/removeSongStats/removeKeyFromDisplay) VẪN LÀ
     * core thuần (core/file-manager/*.js, core/playlist/actions.js, service/db.js), giữ nguyên 100%
     * — chỉ orchestration đổi CHỖ GỌI.
     * ĐỔI TÊN (07/09/2026, Giang chỉ ra "đằng nào cũng sửa, đổi tên đỡ nhầm") — `deleteSongFromActionMenu`
     * (cũ, tên gợi ý CHỈ xử lý Song dù đã xử lý cả Video/Photo từ lâu — CÙNG kiểu nhầm lẫn tên gọi
     * đã sửa cho `window.removeSong`) đổi thành `deleteMediaFromActionMenu` cho khớp thực tế.
     * @param {string} mediaKey - key do listener đọc sẵn từ `playlistStore` và đặt vào payload.
     */
    deleteMediaFromActionMenu(mediaKey) {
        if (!mediaKey) return; // guard: menu không mở/không xác định được bài nào
        workflowPlaylist.closeActionMenu(); // core/playlist/actions.js

        const cached = appState.get('playlistCache').get(mediaKey);
        const title = cached && cached.tag && cached.tag.title ? cached.tag.title : (cached ? cached.filename : mediaKey);
        // FIX (Giang báo bug "Xoá Song không hoạt động") — TRƯỚC ĐÂY `cached ? cached.mediaType :
        // 'song'` chỉ fallback lúc `cached` không tồn tại — Song's `cached.mediaType` từng luôn
        // `undefined` (thiếu field, xem core/playlist/loader.js::buildSongPlaylistCache()) nên
        // NHÁNH ĐÓ không chạy dù cached tồn tại, ra `mediaType=undefined`, phá
        // `MEDIA_DELETE_ACCESSOR[undefined]`. ĐÃ SỬA GỐC ở loader.js (giờ Song luôn có
        // `mediaType:'song'` thật), NHƯNG giữ luôn `||` ở đây làm lưới an toàn thứ 2 — fallback
        // đúng cả khi `cached.mediaType` falsy vì BẤT KỲ lý do gì khác trong tương lai.
        const mediaType = (cached && cached.mediaType) || 'song'; // 'song'|'video'|'photo'
        const isVideo = mediaType === 'video';
        const isCurrent = mediaKey === appState.get('currentKey');
        const isActuallyPlaying = isVideo ? (appState.get('isVideoPlayerMode') && !bgVideoElement.paused) : !audioPlayer.paused;

        if (isCurrent && isActuallyPlaying) {
            // Ngôn ngữ theo ngữ cảnh Song/Video — bản Song nói "Pause the song first", sai ngữ
            // cảnh khi chặn xoá 1 Video đang phát.
            alertModal(tFormat(isVideo ? 'playlistView.songMenu.deleteBlockedPlayingVideo' : 'playlistView.songMenu.deleteBlockedPlaying', { title }));
            return;
        }

        return withLoadingShield(t('common.loading.deleting'), async () => {
            // Dọn tham chiếu folder TRƯỚC khi xoá record — tránh để lại "ghost" trong folder_song
            // nếu bài/video/ảnh đó đang nằm trong 1 folder (cùng thứ tự deleteSelectedMedia(), xoá
            // hàng loạt, ngay trong file này).
            const { getRecord, deleteRecord } = MEDIA_DELETE_ACCESSOR[mediaType];
            const record = await getRecord(mediaKey);
            if (record) await removeSongFromAllFolders(record); // core/file-manager/folder.js
            await deleteRecord(mediaKey);
            workflowListenStats.forget(mediaType, mediaKey); // event/workflow/listen-stats.js — dọn thống kê RAM của media đã xoá (SỬA 06/10/2026: đúng loại)
            workflowPlaylistOrder.removeKeyFromDisplay(mediaKey); // event/workflow/playlist-order.js (dời từ core 24/09/2026)

            if (isCurrent && isVideo) {
                // Video đang là currentKey (đã pause, hoặc chưa từng phát) — dọn bgVideoElement/
                // trạng thái Video Player mode qua ĐÚNG hàm đã có sẵn (event/workflow/video-player.js).
                if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode();
                appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
            } else if (isCurrent) {
                // Bài vừa xoá là currentKey (đang pause) — dọn player/UI giống hệt khối tương ứng
                // trong clearAllStoredData() (storage-manager.js) để không còn currentKey "ma".
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js (dời từ core 25/09/2026)
                workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js — SỬA 24/09/2026 (thay core forceBackToPlaylistUI())
                if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse();
            }
        }).then(() => {
            // Shield đã đóng hẳn tới đây — an toàn để hiện modal, không bị #loading-shield
            // (z-[200]) đè lên modalChoice (z-[130]).
            alertModal(tFormat('playlistView.songMenu.deleteSuccess', { title }));
        });
    },

    /** MỚI (v13 Batch F) — ứng với 'playlist.actionMenu.edit.click'. THAY nhánh `action==='edit'`.
     * KHÔNG nhận key qua payload: chỉ nhánh XOÁ mới cần key trong payload (để Block gate kiểm được
     * "bài này có đang làm Visual Background không"); nhánh sửa đọc thẳng `playlistStore` tại đây —
     * Workflow được phép đọc store. */
    openSongEditFromActionMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return; // guard: menu không mở
        workflowPlaylist.closeActionMenu(); // core/playlist/actions.js
        // SỬA (06/10/2026, plan-media-db-split.md mục 6) — Workflow đọc sẵn thống kê ĐÚNG loại media rồi truyền vào (core cũ tự
        // gọi getSongStats(key) — core gọi core, và key trùng giữa các loại bị cộng chung).
        const cached = appState.get('playlistCache').get(key);
        const stats = workflowListenStats.getStats((cached && cached.mediaType) || 'song', key); // event/workflow/listen-stats.js
        openSongEditModal(key, stats); // core/playlist/actions.js
    },

    /** MỚI (24/09/2026, dọn nợ "Core gọi Workflow") — ứng với 'playlist.playbackError.keep' (nút "Giữ lại"). THAY
     * core `confirmKeepBrokenSong()` (tự đọc playlistStore + gọi removeKeyFromDisplay). Tái dùng core
     * `getAndClearPlaybackErrorKey()` (đọc key + ẩn modal + xoá state context — y hệt nhánh "Xoá").
     * @returns {{status: string}} */
    keepBrokenSong() {
        const key = getAndClearPlaybackErrorKey(); // core/playlist/actions.js
        if (!key) return { status: 'noop' };
        appState.mutate('confirmedBrokenKeys', s => s.add(key));
        console.log(`writer: "workflowPlaylist.keepBrokenSong", page: "confirmedBrokenKeys", content: "+${key}"`);
        workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
        return { status: 'ok' };
    },

    /**
     * Ứng với msg.type = 'playlist.playbackError.delete' — cần ĐỌC state (key đang chờ xoá) rồi
     * PHỐI HỢP shield + hàm core xoá -> rõ ràng là workflow (>1 hàm).
     */
    async executePlaybackErrorDelete() {
        // getAndClearPlaybackErrorKey() là core THUẦN, không shield — đọc xong là ẩn modal ngay
        // (thuần UI), TRẢ VỀ key để workflow tự quyết định có cần xoá hay không.
        const key = getAndClearPlaybackErrorKey();
        if (!key) return; // không có gì đang mở -> no-op, giống hành vi gốc (if (!playbackErrorKey) return;)

        await withLoadingShield(t('common.loading.deleting'), async () => {
            // SỬA (24/09/2026) — 3 bước của core `deleteBrokenSongByKey()` cũ đứng cạnh nhau ở đây (bản cũ: core gọi
            // core removeSongStats + removeKeyFromDisplay). Thứ tự giữ nguyên.
            await deleteMediaRecord('song', key); // service/db.js — SỬA 06/10/2026 (3 store, plan-media-db-split.md)
            workflowListenStats.forget('song', key); // event/workflow/listen-stats.js (SỬA 06/10/2026)
            workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
        });
        // Bản gốc KHÔNG hiện alertModal nào sau khi xoá xong ở luồng này — giữ đúng hành vi cũ,
        // không tự thêm thông báo mới.
    },

    /** MỚI (03/07/2026); VIẾT LẠI (04/07/2026, mục 3 phản hồi Giang — bỏ hẳn nút Upload, chỉ còn
     * "Choose photo") — mở picker chọn 1 ảnh có sẵn trong File Manager làm cover.
     *
     * VIẾT LẠI (Giai đoạn 4, rewrite Photo/Album, mục 4, Giang yêu cầu "render ở file manager photo
     * thế nào thì Generic Drawer như thế") — THAY HẲN `openPhotoUiImagePickerModal()` (modal riêng,
     * core/file-manager/photo-ui.js — ĐÃ XOÁ) bằng `workflowFileManagerPhoto.openCoverImagePicker()`
     * (Generic Drawer, TÁI DÙNG NGUYÊN hạ tầng picker vừa xây cho "thêm ảnh vào album" — event/
     * workflow/file-manager-photo.js, chỉ khác mode single-select). Workflow gọi Workflow miền khác,
     * TỰ DO theo event-bus-flow.md mục 4B — KHÔNG cần tự đọc `listImages()`/tự gọi
     * `setupPhotoGridWindow()` ở đây nữa (picker MỚI tự lo toàn bộ, kể cả đọc DB). */
    /** MỚI (06/10/2026, Giang: "nút Choose xổ xuống dropdown") — ứng với 'playlist.editCover.choose.click'. Dropdown
     * nổi DÙNG CHUNG (core/dropdown-menu.js) neo dưới nút "Choose"; z-index mặc định 127 > modal Sửa thông tin
     * (z-[120]) nên không cần truyền riêng. Mỗi mục CHỈ bắn eventBus (Rule 5a). */
    openCoverChooseMenu() {
        if (!songEditCoverChooseBtn) return; // guard: template chưa mount
        const send = (type) => () => eventBus.send({ router: 'playlist', type, payload: {} });
        openDropdownMenu(songEditCoverChooseBtn, [ // core/dropdown-menu.js
            { icon: SONG_EDIT_COVER_ICON_PHOTO, name: t('playlistView.songEdit.coverFromPhoto'), callback: send('playlist.editCover.pickFromLibrary') },
            { icon: SONG_EDIT_COVER_ICON_VIDEO, name: t('playlistView.songEdit.coverFromVideoThumb'), callback: send('playlist.editCover.pickFromVideoThumb') },
        ]);
    },

    pickCoverFromLibrary() {
        workflowFileManagerPhoto.openCoverImagePicker((imageKey) => { // event/workflow/file-manager-photo.js
            this.applyCoverFromLibrary(imageKey);
        });
    },

    // ===================== Ảnh bìa từ thumb video — MỚI (06/10/2026, Giang mục 3c) =====================
    // "Choose" -> "Video thumbnail": picker video (Generic Drawer, single-select — bấm tile chọn NGAY, không nút xác
    // nhận) -> lấy `thumbBlob` của video (thumb VUÔNG 320px — đúng "cover" video đang hiện ở lưới Playlist, xem
    // extractVideoThumbAndMeta()); record cũ thiếu `thumbBlob` thì lùi về `thumbFullBlob` (khung đầu, kích thước gốc).
    // Bọc thành `File` rồi TÁI DÙNG NGUYÊN changeSongEditCover() — y hệt nhánh Photo (applyCoverFromLibrary()): ảnh
    // chỉ là PENDING, Lưu mới ghi DB + APIC, Huỷ bỏ hết.
    // Hạ tầng picker: workflowGenericDrawerHelpers.mountMediaPicker() + workflowVideoGalleryWindow (CÙNG khuôn
    // picker video nền của workflowTheme.pickBackgroundMedia()); mở MỚI (không updateInPlace — modal Sửa thông tin
    // không nằm trong Generic Drawer) rồi đợi drawer trượt xong mới đọc DB + dựng lưới (CÙNG khuôn
    // workflowFileManagerPhoto._openImagePickerDrawer()).
    _coverVideoPickerOpen: false, // guard: picker đang mở hay không (đóng rất nhanh lúc đang đọc DB / race tap)

    /** Ứng với 'playlist.editCover.pickFromVideoThumb'. */
    async pickCoverFromVideoThumb() {
        const scrollId = 'song-edit-cover-video-picker-scroll', emptyId = 'song-edit-cover-video-picker-empty';
        workflowGenericDrawerHelpers.mountMediaPicker({ // event/workflow/generic-drawer-helpers.js
            routerName: 'playlist', msgPrefix: 'playlist.editCover.videoPicker',
            title: t('fileManager.video.pickerTitle'),
            bodyHtml: `
                <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">
                    <p id="${emptyId}" class="hidden text-sm text-center py-10 px-6" data-uitk="textSecondary">${t('fileManager.video.empty')}</p>
                </div>
            `,
            tileSelector: '.video-tile', tileDataKey: 'videoKey',
        });
        this._coverVideoPickerOpen = true;

        await new Promise((resolve) => { taskManager.once(resolve, GENERIC_DRAWER_ANIM_MS, 'songEditCoverVideoPickerOpenSettle'); }); // core/generic-drawer.js
        if (!this._coverVideoPickerOpen) return; // guard — picker bị đóng trong lúc drawer đang trượt

        const videos = await workflowPlaylistScope.listPickableMedia('video'); // event/workflow/playlist-scope.js — bỏ item thuộc folder Hidden
        if (!this._coverVideoPickerOpen) return; // guard — picker bị đóng trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector(`#${scrollId}`);
        const emptyEl = genericDrawerBody.querySelector(`#${emptyId}`);
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null }); // event/workflow/video-gallery-window.js
    },

    /** Ứng với 'playlist.editCover.videoPicker.tile.click' — bấm là chọn NGAY + đóng picker. @param {string} videoKey */
    async handleCoverVideoPickerTileClick(videoKey) {
        if (!this._coverVideoPickerOpen) return; // guard: picker đã đóng (race hiếm)
        this._teardownCoverVideoPicker();
        await this.applyCoverFromVideoThumb(videoKey);
    },

    /** Ứng với 'playlist.editCover.videoPicker.close.click' — nút X: huỷ, giữ nguyên ảnh bìa đang chờ. */
    handleCoverVideoPickerCloseClick() {
        if (!this._coverVideoPickerOpen) return;
        this._teardownCoverVideoPicker();
    },

    /** Gỡ lưới windowing (revoke object URL ngay) + đóng drawer — dùng chung cho chọn xong / huỷ. */
    _teardownCoverVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer'); // event/workflow/video-gallery-window.js
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        this._coverVideoPickerOpen = false;
    },

    /** Đọc record video -> thumb (vuông, lùi về full-res) -> `File` -> changeSongEditCover() (pending, chưa ghi DB).
     * @param {string} videoKey */
    async applyCoverFromVideoThumb(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) return; // guard: video vừa bị xoá ở tab/thao tác khác
        const thumb = record.thumbBlob || record.thumbFullBlob;
        if (!thumb) {
            await alertModal(t('playlistView.songEdit.coverVideoThumbMissing'));
            return;
        }
        const file = new File([thumb], `${stripFileExtension(record.filename)}.jpg`, { type: thumb.type || 'image/jpeg' }); // core/file-manager/video.js (stripFileExtension)
        const result = changeSongEditCover(file); // core/playlist/actions.js — CÓ return, DÙNG ngay dưới
        if (result.status === 'invalid') {
            await alertModal(result.reason);
        }
    },

    /** Callback của picker ở trên — bọc Blob đã có sẵn thành `File` rồi TÁI DÙNG NGUYÊN
     * changeSongEditCover() (không sửa gì ở core/playlist/actions.js — File LÀ MỘT Blob, luồng lưu/
     * export/hiển thị cover cũ chạy y nguyên, xem mục 2 tài liệu trên).
     * @param {string} imageKey
     */
    async applyCoverFromLibrary(imageKey) {
        const record = await getImageRecord(imageKey); // core có sẵn (service/db.js), CÓ return, DÙNG ngay dưới
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const file = new File([record.blob], record.filename, { type: record.blob.type });
        const result = changeSongEditCover(file); // core có sẵn, CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
        if (result.status === 'invalid') {
            await alertModal(result.reason);
        }
    },

    /**
     * Ứng với msg.type = 'playlist.edit.save' — cần ĐỌC state form (key/newTag/pendingCover) rồi
     * PHỐI HỢP shield + hàm core lưu + (có thể) alertModal not-found + dọn dẹp UI sau khi lưu ->
     * rõ ràng là workflow (nhiều hàm, có rẽ nhánh theo status).
     * SỬA (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — rẽ nhánh Song/Video NGAY
     * ĐẦU (đọc `cached.mediaType` — quyết định "gọi cặp core nào", đúng tinh thần VMState ở Router
     * cho cấp Song/Video, nhưng đặt Ở ĐÂY vì cần đọc playlistStore.songEditCurrentKey TRƯỚC —
     * Router không có context đó). 2 nhánh gọi 2 CẶP core HOÀN TOÀN riêng (không core nào gọi core
     * khác) — song vẫn dùng chung `closeSongEditModal()`/`this._refreshAfterMediaEditSave()` (2 hàm đó
     * hoàn toàn trung lập, không có gì "của riêng Song").
     */
    /** DỜI (24/09/2026, rà soát refresh DOM) từ core/playlist/actions.js::refreshAfterSongEditSave() — thân GIỮ
     * NGUYÊN. "Dọn dẹp sau khi lưu" 1 media (Song/Video/Photo): vẽ lại đúng hàng đó (ảnh/tên mới), đổi tên có thể
     * ảnh hưởng sort -> cập nhật hàng đợi phát (chỉ khi 'az'/'za') + thứ tự hiển thị rồi diff lại danh sách. Bản cũ
     * nằm ở core nhưng tự `appState.get()` + gọi 3 hàm Workflow — đúng vai Workflow nên dời hẳn về đây.
     * @param {string} key */
    _refreshAfterMediaEditSave(key) {
        workflowPlaylistRender.refreshSongNode(key); // event/workflow/playlist-render.js — ảnh cũ trong DOM không tự đổi
        const nameMode = appState.get('displaySortMode');
        if (nameMode === 'az' || nameMode === 'za') workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
    },

    /**
     * SỬA (06/10/2026, plan-media-db-split.md) — ghi qua `updateMediaMeta()` (service/db.js — CHỈ store meta, không
     * ghi lại Blob nào) với meta mới do core thuần dựng (`buildVideoEditMeta`/`buildPhotoEditMeta`/`buildSongEditMeta`,
     * core/playlist/actions.js). Phần cập nhật RAM/DOM sau khi lưu (playlistCache, songNameIndex, tiêu đề player,
     * Media Session) trước đây nằm trong 3 hàm core `apply*EditAndSave()` (tự appState.get + DOM — vi phạm Rule 2/3)
     * giờ ở `_syncEdited*Runtime()` ngay dưới. Rẽ nhánh theo loại media qua object map (event-bus-flow.md mục 7).
     */
    async executeSaveEdit() {
        const key = playlistStore.get('songEditCurrentKey');
        if (!key) return; // không có modal nào đang mở -> no-op, giống hành vi gốc
        const cached = appState.get('playlistCache').get(key);
        const mediaType = (cached && cached.mediaType) || 'song';
        const saveByType = {
            video: () => this._saveVideoEdit(key),
            photo: () => this._savePhotoEdit(key),
            song: () => this._saveSongEdit(key),
        };
        const result = await saveByType[mediaType]();
        // Shield đã đóng HẲN tới đây — an toàn để hiện modal (xem quy tắc shield/modal đầu file).
        if (result.status === 'notFound') await alertModal(t('common.songEdit.notFound'));
        closeSongEditModal(); // core thuần UI — đóng modal trong MỌI trường hợp (giống bản gốc)
        this._refreshAfterMediaEditSave(key); // vẽ lại danh sách/sắp xếp lại nếu cần
    },

    async _saveVideoEdit(key) {
        const { customName, album } = captureVideoEditFormState(); // core THUẦN
        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            result = await updateMediaMeta('video', key, (meta) => buildVideoEditMeta(meta, customName, album)); // service/db.js + core/playlist/actions.js
        });
        if (result.status === 'ok') this._syncEditedVideoRuntime(key, result.meta);
        return result;
    },

    async _savePhotoEdit(key) {
        const { customName, durationSec, album } = capturePhotoEditFormState(); // core THUẦN
        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            result = await updateMediaMeta('photo', key, (meta) => buildPhotoEditMeta(meta, customName, durationSec, album)); // service/db.js + core/playlist/actions.js
        });
        if (result.status === 'ok') this._syncEditedPhotoRuntime(key, result.meta);
        return result;
    },

    async _saveSongEdit(key) {
        const { newTag, pendingCover } = captureSongEditFormState(); // core THUẦN — chỉ đọc form + playlistStore
        // Ảnh bìa: File mới -> ghi Blob mới vào store thumb; 'remove' -> xoá thumb; còn lại giữ nguyên (không ghi gì).
        const coverChange = (pendingCover instanceof File && 'file') || (pendingCover === 'remove' && 'remove') || 'keep';
        const writeCoverByChange = {
            file: () => setMediaThumbs('song', key, { cover: pendingCover }), // service/db.js
            remove: () => setMediaThumbs('song', key, { cover: null }),
            keep: () => Promise.resolve(),
        };
        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            result = await updateMediaMeta('song', key, (meta) => buildSongEditMeta(meta, newTag)); // service/db.js + core/playlist/actions.js
            if (result.status === 'ok') await writeCoverByChange[coverChange]();
        });
        if (result.status === 'ok') this._syncEditedSongRuntime(key, result.meta, coverChange, pendingCover);
        return result;
    },

    /** Cập nhật RAM/DOM sau khi lưu tab "Sửa" Video — thân DỜI từ core `applyVideoEditAndSave()` (06/10/2026), bỏ phần
     * trỏ lại `cached.cover` (chỉ tồn tại để chữa lỗi round-trip, giờ Blob không bị ghi lại nên cover cũ vẫn dùng được). */
    _syncEditedVideoRuntime(key, meta) {
        const displayName = meta.customName || stripFileExtension(meta.filename); // core/file-manager/video.js
        const cached = appState.get('playlistCache').get(key);
        if (cached) {
            cached.tag.title = displayName;
            cached.tag.album = meta.album || ''; // search/filter đọc field này (core/playlist/order.js, core/playlist/filter.js)
        }
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(displayName)));
        console.log(`writer: "workflowPlaylist._syncEditedVideoRuntime", page: "songNameIndex", content: "${key} -> ${displayName}"`);
        if (key !== appState.get('currentKey')) return;
        playerTitle.textContent = displayName;
        if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: displayName, artist: '', artwork: [] });
    },

    /** Bản Photo của `_syncEditedVideoRuntime()` — thân DỜI từ core `applyPhotoEditAndSave()` (06/10/2026). */
    _syncEditedPhotoRuntime(key, meta) {
        const displayName = meta.customName || stripFileExtension(meta.filename); // core/file-manager/video.js
        const cached = appState.get('playlistCache').get(key);
        if (cached) {
            cached.tag.title = displayName;
            cached.tag.album = meta.album || '';
            cached.duration = meta.duration;
        }
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(displayName)));
        console.log(`writer: "workflowPlaylist._syncEditedPhotoRuntime", page: "songNameIndex", content: "${key} -> ${displayName}"`);
        if (key !== appState.get('currentKey')) return;
        playerTitle.textContent = displayName;
        appState.set('photoPlayerDurationSec', meta.duration, { skipCheck: true }); // event/workflow/photo-player.js đọc mỗi tick — ảnh đang hiện đổi thời lượng ngay
        console.log(`writer: "workflowPlaylist._syncEditedPhotoRuntime", page: "photoPlayerDurationSec", content: "${meta.duration}"`);
        if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: displayName, artist: '', artwork: [] });
    },

    /** Bản Song — thân DỜI từ core `applySongEditAndSave()` (06/10/2026). Ảnh bìa trong RAM/DOM chỉ đổi khi người dùng
     * chọn ảnh mới / xoá ảnh (`coverChange`); giữ nguyên thì URL cover đang hiện vẫn dùng tiếp.
     * @param {string} key @param {object} meta @param {'file'|'remove'|'keep'} coverChange @param {File|string|null} pendingCover */
    _syncEditedSongRuntime(key, meta, coverChange, pendingCover) {
        const cached = appState.get('playlistCache').get(key);
        const cachedCoverByChange = { file: () => pendingCover, remove: () => null, keep: () => (cached ? cached.cover : null) };
        const cover = cachedCoverByChange[coverChange]();
        if (cached) { cached.tag = meta.tag; cached.cover = cover || null; }
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(meta.tag.title)));
        console.log(`writer: "workflowPlaylist._syncEditedSongRuntime", page: "songNameIndex", content: "${key} -> ${meta.tag.title}"`);
        if (key !== appState.get('currentKey')) return;
        playerTitle.textContent = meta.tag.title; playerArtist.textContent = meta.tag.artist;
        const refreshCoverUrlByChange = {
            file: () => this.replaceCurrentCoverUrl(createBlobUrl(pendingCover)), // service/blob-url.js
            remove: () => this.replaceCurrentCoverUrl(DEFAULT_VINYL),
            keep: () => {},
        };
        refreshCoverUrlByChange[coverChange]();
        if ('mediaSession' in navigator) {
            const coverUrl = appState.get('currentCoverObjectURL');
            navigator.mediaSession.metadata = new MediaMetadata({
                title: meta.tag.title || "Visual Master",
                artist: meta.tag.artist || "Unknown Artist",
                artwork: cover ? [{ src: coverUrl, sizes: '512x512', type: cover.type || 'image/jpeg' }] : []
            });
        }
    },

    /** Thay URL ảnh bìa bài ĐANG phát (thu hồi URL blob cũ) + gán lại #record-art. DÙNG CHUNG với
     * workflowPlayer.reloadCurrentSongKeepingPosition() (request trung tâm mediaInUse, 06/10/2026). #record-art là phần tử ĐỘNG (tạo lại
     * qua innerHTML mỗi lần đổi bài) nên tự getElementById tại chỗ; gắn lại fallback mỗi lần đổi src (core/playlist/render.js).
     * @param {string} url */
    replaceCurrentCoverUrl(url) {
        const oldUrl = appState.get('currentCoverObjectURL');
        if (oldUrl && oldUrl.startsWith('blob:')) revokeBlobUrl(oldUrl); // service/blob-url.js
        appState.set('currentCoverObjectURL', url);
        console.log(`writer: "workflowPlaylist.replaceCurrentCoverUrl", page: "currentCoverObjectURL", content: "${url.startsWith('blob:') ? 'blob mới' : url}"`);
        const recordArtEl = document.getElementById('record-art');
        if (!recordArtEl) return;
        recordArtEl.src = url;
        attachCoverFallback(recordArtEl); // core/playlist/render.js
    },

    /** Ứng với click nút duration ở tab "Sửa" của nhóm field Photo — mở time-picker (core/time-
     * picker-modal.js, dùng chung với Slideshow/Visual Background gradient) thay vì input số tay
     * (Giang chỉ định "dùng time picker, có min nhưng không max"). SỬA (Giang yêu cầu — format
     * 'h-m-s', trước đây chỉ 'm-s') — thêm cột giờ. `maxMs` KHÔNG phải giới hạn của widget, chỉ là
     * 1 config nơi gọi tự chọn (xem docstring `PHOTO_EDIT_DURATION_PICKER_MAX_MS` đầu file) — 24
     * giờ, rộng hơn rất nhiều bất kỳ giá trị nào `computePhotoDuration()` (event/workflow/file-
     * manager-photo.js) thực tế tạo ra. Giá trị THẬT lưu trong DB không hề bị hàm nào clamp — nếu 1
     * ảnh có duration vượt 24 giờ (chưa từng xảy ra với công thức hiện tại), mở picker sẽ tự kẹp
     * hiển thị về 24 giờ, không đụng gì tới số đã lưu. Chỉ set `min` — không có ý định giới hạn
     * trên thật nào. */
    openPhotoEditDurationPicker() {
        const currentSec = playlistStore.get('songEditPendingPhotoDurationSec') || 0;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('playlistView.songEdit.durationPickerTitle'),
            format: 'h-m-s',
            valueMs: currentSec * 1000,
            minMs: DURATION_MIN_SEC * 1000, // event/workflow/file-manager-photo.js — CÙNG sàn computePhotoDuration() áp lúc upload
            maxMs: PHOTO_EDIT_DURATION_PICKER_MAX_MS, // xem docstring hằng số đầu file — KHÔNG phải trần widget, chỉ là config
            onConfirm: (resultMs) => {
                const resultSec = Math.round(resultMs / 1000 * 100) / 100;
                playlistStore.set({ songEditPendingPhotoDurationSec: resultSec });
                if (songEditPhotoDurationValueEl) songEditPhotoDurationValueEl.textContent = formatTime(resultSec); // core/playlist/state.js
            },
        });
    },

    // ===================== Ver 12 "Multi Media" — Chọn nhiều (plan-v12-multimedia.md mục 4.b1) =====================
    // Cụm sở hữu ĐÃ CHỐT: `playlist` (không phải `fileManagerSong`).
    //
    // SỬA (sau trao đổi Rule 1/2/VMState): render.js (buildSongNode/renderPlaylistFull/
    // renderPlaylistDiff) KHÔNG được sửa để tự đọc selectionMode/selectedMediaKeys — những field đó
    // CHỈ ảnh hưởng 1 lớp DOM-patch riêng, tách hẳn theo tiến trình đơn tuyến (showSelectionIndicator/
    // hideSelectionIndicator/updateSelectionActionBar/applySelectionChrome,
    // core/playlist/selection.js — hàm THUẦN, nhận state qua tham số, tự chọn hàm nào chạy qua
    // VirtualMachineState thay vì if/else). Nơi ĐỌC appState rồi gọi các hàm thuần đó nối tiếp nhau
    // LÀ ĐÂY (workflow) — đúng vai trò được appState.get() tự do.

    /** Dọn dẹp DÙNG CHUNG khi thoát chế độ chọn (gọi từ 4 hành động dưới sau khi xong việc) —
     * KHÔNG phải core (workflow không bị 4 rule ràng buộc), chỉ là helper nội bộ tránh lặp code. */
    _exitSelectionMode() {
        // SỬA (02/10/2026, tối ưu 10000 item) — chỉ gỡ dấu ở node ĐÃ CHỌN (vòng trống của các node còn lại là CSS, tắt theo
        // class `is-selecting` ở applySelectionChrome(false)). Lấy danh sách TRƯỚC khi disableSelectionMode() xoá tập chọn.
        const selectedKeysBefore = [...appState.get('selectedMediaKeys')];
        disableSelectionMode();
        const domNodesByKey = appState.get('domNodesByKey');
        selectedKeysBefore.forEach((key) => hideSelectionIndicator(domNodesByKey.get(key)));
        updateSelectionActionBar(false, 0);
        applySelectionChrome(false);
    },

    /** Ứng với 'playlist.selection.toggle'. */
    toggleSelectionMode() {
        const enabled = !appState.get('selectionMode');
        const selectedKeysBefore = [...appState.get('selectedMediaKeys')]; // SỬA (02/10/2026) — lấy TRƯỚC khi disableSelectionMode() xoá tập chọn
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => enableSelectionMode() },
            { state: enabled, operation: '===', value: false, callback: () => disableSelectionMode() },
        ]);
        const selectedMediaKeys = appState.get('selectedMediaKeys'); // đọc LẠI sau khi core ghi xong (disableSelectionMode có thể vừa clear nó)
        const domNodesByKey = appState.get('domNodesByKey');
        const themeClasses = this._selectionThemeClasses();
        // SỬA (02/10/2026, tối ưu 10000 item) — trước đây lặp qua MỌI node (đo 10000 item: ~1,4 s). Vòng tròn trống + ẩn nút
        // 3 chấm giờ là CSS theo class `is-selecting` (applySelectionChrome() ngay dưới), nên chỉ còn lặp qua các key ĐÃ
        // CHỌN (thường rỗng lúc bật, vài key lúc tắt).
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => selectedKeysBefore.forEach((key) => showSelectionIndicator(domNodesByKey.get(key), key, selectedMediaKeys, themeClasses)) },
            { state: enabled, operation: '===', value: false, callback: () => selectedKeysBefore.forEach((key) => hideSelectionIndicator(domNodesByKey.get(key))) },
        ]);
        updateSelectionActionBar(enabled, selectedMediaKeys.size);
        applySelectionChrome(enabled);
    },

    /** Ứng với 'playlist.item.playClick' khi selectionMode=true (xem router). */
    toggleSongSelectionAndRefresh(key) {
        const isCurrentlySelected = appState.get('selectedMediaKeys').has(key);
        VirtualMachineState.run([
            { state: isCurrentlySelected, operation: '===', value: true, callback: () => deselectMedia(key) },
            { state: isCurrentlySelected, operation: '===', value: false, callback: () => selectMedia(key) },
        ]);

        const selectedMediaKeys = appState.get('selectedMediaKeys'); // đọc LẠI sau khi core ghi xong ở trên
        const node = appState.get('domNodesByKey').get(key);
        // Không cần VMState ở đây: đang Ở TRONG chế độ chọn (hàm này chỉ được router gọi khi
        // selectionMode=true, xem router/playlist.js), nên LUÔN showSelectionIndicator — việc
        // chọn/bỏ-chọn CHỈ đổi màu/tick bên trong nó (ternary trình bày thuần theo isSelected,
        // không phải rẽ nhánh tiến trình, khác hẳn quyết định BẬT/TẮT cả chế độ chọn ở trên).
        showSelectionIndicator(node, key, selectedMediaKeys, this._selectionThemeClasses());
        updateSelectionActionBar(appState.get('selectionMode'), selectedMediaKeys.size);
    },

    /** MỚI 23/09/2026 (rà soát theme) — class theo theme đang active cho chỉ báo chọn nhiều, tra 1 lần ở Workflow rồi truyền xuống
     * `showSelectionIndicator()` (core lá, không tự tra theme). `selectionTintBg`/`btnPrimaryPillBg`/`textOnAccent`: core/ui-theme/*.js.
     * @returns {{tint:string, indicatorSelected:string}} */
    _selectionThemeClasses() {
        return {
            tint: resolveUiThemeClass(_activeUiThemeKeyList, 'selectionTintBg'), // core/ui-theme/registry.js + apply-ui.js
            indicatorSelected: `${resolveUiThemeClass(_activeUiThemeKeyList, 'btnPrimaryPillBg')} ${resolveUiThemeClass(_activeUiThemeKeyList, 'textOnAccent')}`,
        };
    },

    /** Ứng với 'playlist.uploadMenu.open' khi selectionMode=true (xem router) — CHỈ hiện modal,
     * không mở menu upload. alertModal() chỉ tồn tại ở tầng workflow (core không biết), nên dù chỉ
     * 1 lời gọi vẫn thuộc workflow, không thể gọi thẳng từ router. */
    async showUploadBlockedBySelectionModal() {
        await alertModal(t('playlistView.selection.uploadBlocked'));
    },

    // ===================== Upload Video — DỜI từ event/workflow/file-manager-video.js (phản hồi
    // Giang — file đó đã xoá hẳn, cụm này lúc đó CHỈ được gọi từ input riêng `#video-upload-input`
    // ở Playlist, nên chuyển thẳng về đây thay vì giữ 1 file/router/listener riêng chỉ để relay).
    // GIỮ NGUYÊN 100% thân hàm. [CẬP NHẬT — phản hồi Giang "1 khung, không nhân bản"] input riêng
    // đó ĐÃ XOÁ — giờ gọi từ `fileInput`/`folderInput` DÙNG CHUNG (case 'playlist.upload.
    // fileChange'/'playlist.upload.folderChange', event/router/playlist.js, VirtualMachineState
    // theo activeMediaSource) — xem docstring uploadVideos() ngay dưới. =====

    // ===================== Chụp khung hình đầu video lúc upload — VIẾT LẠI (19/09/2026) =====================
    // Giang chốt "quan trọng nhất là lấy chính xác frame đầu khi upload để làm full res". Bản cũ chụp ở
    // sự kiện nào tới trước (loadeddata/canplay/seeked) rồi KHÓA LUÔN bằng cờ, không nhìn vào pixel —
    // khung chưa sẵn sàng thì `drawImage()` không vẽ gì (canvas trong suốt), JPEG ép nền ĐEN, blob vẫn
    // khác null nên lọt vào record. Bản mới: (1) chụp qua ĐÚNG đường player sẽ hiện — phát từ t=0 rồi lấy
    // khung ĐẦU TIÊN mà trình duyệt thật sự present (requestVideoFrameCallback, có `mediaTime`), không
    // seek epsilon; (2) kiểm tra ngay sau khi vẽ: alpha=0 -> KHÔNG vẽ được (thử lại), alpha đủ + đen ->
    // đen (thử lại vài lần rồi coi là đen THẬT, vd fade-in); (3) canvas không vượt trần 16.777.216 px của
    // Safari/iOS, và luôn thu nhỏ về 0 sau khi dùng; (4) `<video>` được giải phóng thật sự (gỡ src + load()).

    /** Đợi 1 sự kiện của `<video>` hoặc hết `timeoutMs`. @returns {Promise<boolean>} true nếu sự kiện bắn, false nếu hết giờ. */
    _waitVideoEvent(videoEl, eventName, timeoutMs) {
        return new Promise((resolve) => {
            let done = false;
            const onEvent = () => finish(true);
            const finish = (ok) => {
                if (done) return;
                done = true;
                videoEl.removeEventListener(eventName, onEvent);
                timer.kill();
                resolve(ok);
            };
            const timer = taskManager.once(() => finish(false), timeoutMs);
            videoEl.addEventListener(eventName, onEvent, { once: true });
        });
    },

    /** Ngủ `ms` — qua taskManager (quy ước project, thay setTimeout). */
    _sleep(ms) {
        return new Promise((resolve) => { taskManager.once(resolve, ms); });
    },

    /** Seek `videoEl` tới `timeSec` và đợi 'seeked' (+ 60ms cho khung kịp sẵn sàng). Đã đứng đúng mốc thì bỏ qua (không có 'seeked' để đợi). */
    async _seekVideoTo(videoEl, timeSec) {
        if (Math.abs(videoEl.currentTime - timeSec) < 0.0001) return;
        const seeked = this._waitVideoEvent(videoEl, 'seeked', VIDEO_SEEK_TIMEOUT_MS); // đăng ký TRƯỚC khi gán currentTime
        videoEl.currentTime = timeSec;
        await seeked;
        await this._sleep(60);
    },

    /** Vẽ khung hình HIỆN TẠI của `source` (`<video>`, hoặc `<img>` đã decode — dùng cho scan thumb cũ,
     * xem workflowFileManagerStorage._classifyThumbBlob()) xuống canvas nhỏ rồi đo. `drawn=false` khi không vẽ được gì
     * (drawImage ném lỗi, hoặc mọi pixel alpha=0 — theo spec `drawImage()` không vẽ gì nếu video chưa có
     * khung); `isBlack=true` khi ≥ VIDEO_BLACK_FRAME_RATIO số pixel có luma ≤ VIDEO_BLACK_PIXEL_LUMA.
     * Không đọc được pixel (getImageData lỗi) -> coi như vẽ được + không đen (không đủ dữ kiện để từ chối). */
    _probeVideoFrame(source) {
        const size = VIDEO_PROBE_SIZE;
        const probeCanvas = document.createElement('canvas');
        probeCanvas.width = size; probeCanvas.height = size;
        let drawn = false, isBlack = false;
        let data = null;
        try {
            const ctx = probeCanvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0, size, size);
            try { data = ctx.getImageData(0, 0, size, size).data; }
            catch (readErr) { drawn = true; } // vẽ được nhưng không đo được
        } catch (drawErr) { drawn = false; } // Firefox/Safari có thể ném lỗi khi video chưa có khung
        if (data) {
            let blackPixels = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) drawn = true;
                const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
                if (luma <= VIDEO_BLACK_PIXEL_LUMA) blackPixels++;
            }
            isBlack = drawn && (blackPixels / (size * size)) >= VIDEO_BLACK_FRAME_RATIO;
        }
        probeCanvas.width = 0; probeCanvas.height = 0;
        return { drawn, isBlack };
    },

    /** Chụp full-res khung hình HIỆN TẠI — ĐỒNG BỘ (đo + vẽ trong CÙNG 1 tick, không thể lệch khung).
     * Cạnh canvas giữ nguyên kích thước gốc, chỉ thu nhỏ đều nếu vượt VIDEO_MAX_CANVAS_PIXELS (Safari/iOS).
     * @returns {{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement|null}} */
    _grabFullFrame(videoEl, width, height) {
        const probe = this._probeVideoFrame(videoEl);
        if (!probe.drawn) return { drawn: false, isBlack: false, canvas: null };
        const scale = Math.min(1, Math.sqrt(VIDEO_MAX_CANVAS_PIXELS / (width * height)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(height * scale));
        try {
            canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        } catch (err) {
            canvas.width = 0; canvas.height = 0;
            return { drawn: false, isBlack: false, canvas: null };
        }
        return { drawn: true, isBlack: probe.isBlack, canvas };
    },

    /** canvas -> JPEG Blob, rồi thu nhỏ canvas về 0 (giải phóng bộ nhớ — Safari giữ canvas rất lâu). */
    _canvasToJpegBlob(canvas, quality) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                canvas.width = 0; canvas.height = 0;
                resolve(blob);
            }, 'image/jpeg', quality);
        });
    },

    /** KHUNG ĐẦU TIÊN của video — đúng thứ player sẽ hiện lúc bắt đầu phát (xem docstring extractVideoThumbAndMeta()).
     * Đường chính: `requestVideoFrameCallback` — play() từ t=0 (không seek), callback bắn khi khung đầu THẬT SỰ
     * được present; chụp NGAY trong callback rồi pause(). Khung có `mediaTime` > VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC
     * không còn là khung đầu -> bỏ. Đường dự phòng (không có rVFC / hết giờ / khung không vẽ được hoặc đen):
     * seek về 0 rồi thử lại tối đa VIDEO_FIRST_FRAME_MAX_ATTEMPTS lần. Đen ≥ VIDEO_BLACK_CONFIRM_COUNT lần liên
     * tiếp (mà vẫn VẼ ĐƯỢC) = đen THẬT (fade-in...) -> chấp nhận, KHÔNG đổi sang khung khác.
     * @returns {Promise<{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement}>} ném lỗi nếu không lần nào vẽ được. */
    async _captureFirstFrame(videoEl, width, height) {
        let best = null;
        let blackCount = 0;
        const releaseCanvas = (c) => { if (c) { c.width = 0; c.height = 0; } };
        const consider = (grab) => { // 'ok' | 'black' | 'none'
            if (!grab || !grab.drawn) return 'none';
            if (best) releaseCanvas(best.canvas);
            best = grab;
            return grab.isBlack ? 'black' : 'ok';
        };
        const isDone = (verdict) => {
            if (verdict === 'ok') return true;
            if (verdict === 'black') { blackCount++; return blackCount >= VIDEO_BLACK_CONFIRM_COUNT; }
            return false;
        };

        // ---- Đường chính: requestVideoFrameCallback ----
        if (typeof videoEl.requestVideoFrameCallback === 'function') {
            let abandoned = false; // callback tới trễ sau khi đã hết giờ -> bỏ, không tạo canvas mồ côi
            const grabbed = await new Promise((resolve) => {
                const timer = taskManager.once(() => { abandoned = true; resolve(null); }, VIDEO_FIRST_FRAME_RVFC_TIMEOUT_MS);
                videoEl.requestVideoFrameCallback((now, metadata) => {
                    if (abandoned) return;
                    timer.kill();
                    let grab = this._grabFullFrame(videoEl, width, height); // ĐỒNG BỘ trong callback = đúng khung vừa present
                    if (metadata && metadata.mediaTime > VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC) { releaseCanvas(grab.canvas); grab = null; }
                    videoEl.pause();
                    resolve(grab);
                });
                videoEl.play().catch(() => {}); // muted + playsInline — autoplay được phép
            });
            if (isDone(consider(grabbed))) return best;
        }

        // ---- Đường dự phòng / thử lại ----
        videoEl.pause();
        await this._seekVideoTo(videoEl, 0);
        let nudged = false; // chỉ "nhá" play() ép decode 1 lần (iOS không tải khung nếu chưa play)
        for (let i = 0; i < VIDEO_FIRST_FRAME_MAX_ATTEMPTS; i++) {
            if (videoEl.readyState >= 2) {
                if (isDone(consider(this._grabFullFrame(videoEl, width, height)))) return best;
            } else if (!nudged) {
                nudged = true;
                try { await Promise.race([videoEl.play(), this._sleep(1500)]); } catch (e) {}
                videoEl.pause();
                await this._seekVideoTo(videoEl, 0);
            }
            await this._sleep(VIDEO_FIRST_FRAME_RETRY_MS);
        }
        if (best) return best; // các lần vẽ được đều đen -> đen thật
        throw new Error('[extractVideoThumbAndMeta] không vẽ được khung hình đầu (video không cho khung nào sau nhiều lần thử)');
    },

    /** Thumb VUÔNG (lưới/cover) ở mốc `min(1, duration/2)` — center-crop `VIDEO_THUMBNAIL_SIZE`. Thử lại tới khi vẽ được. @returns {Promise<Blob|null>} */
    async _captureSquareThumb(videoEl) {
        await this._seekVideoTo(videoEl, Math.min(1, videoEl.duration / 2 || 0));
        for (let i = 0; i < VIDEO_FIRST_FRAME_MAX_ATTEMPTS; i++) {
            if (videoEl.readyState >= 2 && this._probeVideoFrame(videoEl).drawn) {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const side = Math.min(width, height);
                const sx = (width - side) / 2, sy = (height - side) / 2;
                const canvas = document.createElement('canvas');
                canvas.width = VIDEO_THUMBNAIL_SIZE; canvas.height = VIDEO_THUMBNAIL_SIZE;
                try {
                    canvas.getContext('2d').drawImage(videoEl, sx, sy, side, side, 0, 0, VIDEO_THUMBNAIL_SIZE, VIDEO_THUMBNAIL_SIZE);
                    return await this._canvasToJpegBlob(canvas, 0.85);
                } catch (err) {
                    canvas.width = 0; canvas.height = 0; // rớt xuống thử lại
                }
            }
            await this._sleep(VIDEO_FIRST_FRAME_RETRY_MS);
        }
        return null;
    },

    /** Đọc thời lượng/kích thước + chụp 2 thumbnail của 1 file video:
     *   - `thumbFullBlob`: KHUNG HÌNH ĐẦU TIÊN ở kích thước GỐC (không crop) — đúng khung mà Video Player
     *     mode sẽ hiện lúc bắt đầu phát (dùng làm lớp nền dự phòng lúc Next/Prev, xem
     *     workflowVideoPlayer.swapBgVideoSource()). Chụp bằng `_captureFirstFrame()`.
     *   - `thumbBlob`: thumb VUÔNG `VIDEO_THUMBNAIL_SIZE` (center-crop), mốc `min(1, duration/2)` — lưới/cover.
     * `width`/`height` trả về là kích thước GỐC của video (KHÔNG phải kích thước thumb). Đặt ở Workflow
     * (không phải core) vì cần `<video>`/`canvas` — DOM API, core không được đụng theo Rule 1-4.
     *
     * VIẾT LẠI (19/09/2026, Giang: "quan trọng nhất là lấy chính xác frame đầu khi upload") — bản cũ chụp ở
     * sự kiện tới trước (loadeddata/canplay/seeked), khóa bằng cờ, không nhìn pixel; hỏng ở ~10% video
     * (khung chưa sẵn sàng -> drawImage không vẽ gì -> JPEG đen; hoặc frame đầu có timestamp > 0 nên seek
     * 0.0001 không có khung để hiện). Xem các hàm `_captureFirstFrame()`/`_probeVideoFrame()` ngay trên.
     * `<video>` giờ được giải phóng thật (pause + gỡ src + load()) ở MỌI đường thoát, timeout tổng
     * VIDEO_EXTRACT_TIMEOUT_MS (trước đây 8000ms).
     *
     * Reject nếu không đọc được video / không vẽ được khung nào / toBlob null (như bản 18/09/2026) — nơi gọi
     * (`uploadVideos()`) skip đúng file đó, KHÔNG lưu record.
     * Tên PUBLIC (bỏ `_`) vì TÁI DÙNG chéo miền: `workflowFileManagerStorage.executeRepairBroken()` gọi lại
     * đúng hàm này để tạo lại thumb cho video ĐÃ lưu (event-bus-flow.md mục 4B).
     * @param {File|Blob} file - File lúc upload MỚI, hoặc `record.blob` của 1 video ĐÃ LƯU.
     * @returns {Promise<{thumbBlob: Blob, thumbFullBlob: Blob, thumbFullIsBlack: boolean, width: number, height: number, duration: number}>}
     *   `thumbFullIsBlack` (MỚI 19/09/2026): khung đầu VẼ ĐƯỢC nhưng đen sau nhiều lần chụp = đen THẬT — nơi gọi
     *   ghi xuống record (`saveVideo()`/`setVideoThumbnails()`) để scan không báo lỗi lặp.
     */
    extractVideoThumbAndMeta(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.preload = 'auto';
            let settled = false;
            const dispose = () => {
                try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (e) {} // giải phóng decoder thật sự, không chờ GC
                try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            };
            const safetyTimeout = taskManager.once(() => fail(new Error('[extractVideoThumbAndMeta] timeout đọc video')), VIDEO_EXTRACT_TIMEOUT_MS);
            const fail = (err) => { if (settled) return; settled = true; safetyTimeout.kill(); dispose(); reject(err); };
            const succeed = (result) => { if (settled) return; settled = true; safetyTimeout.kill(); dispose(); resolve(result); };
            videoEl.addEventListener('error', () => fail(new Error('[extractVideoThumbAndMeta] không đọc được video')), { once: true });

            (async () => {
                try {
                    await new Promise((resolveMeta) => {
                        videoEl.addEventListener('loadedmetadata', resolveMeta, { once: true });
                        videoEl.src = objectUrl;
                    });
                    const width = videoEl.videoWidth, height = videoEl.videoHeight;
                    if (!width || !height) throw new Error('[extractVideoThumbAndMeta] video không có kích thước hợp lệ');

                    const first = await this._captureFirstFrame(videoEl, width, height);
                    const thumbFullBlob = await this._canvasToJpegBlob(first.canvas, 0.92);
                    if (!thumbFullBlob) throw new Error('[extractVideoThumbAndMeta] chụp full-res thất bại (canvas.toBlob trả về null)');

                    const thumbBlob = await this._captureSquareThumb(videoEl);
                    if (!thumbBlob) throw new Error('[extractVideoThumbAndMeta] không chụp được thumb vuông');

                    succeed({ thumbBlob, thumbFullBlob, thumbFullIsBlack: !!first.isBlack, width, height, duration: videoEl.duration || 0 });
                } catch (err) {
                    fail(err);
                }
            })();
        });
    },

    // ===================== Upload Song — DỜI (24/09/2026) từ core/playlist/loader.js =====================

    /**
     * TÁCH (01/10/2026, Ghi âm — Giang duyệt) từ vòng lặp `uploadSongs()` — đưa 1 record Song VỪA ghi DB vào danh sách
     * đang hiện trong RAM (Nguồn Song). `isNew` = key chưa có trong playlistOrder (bài mới, không phải ghi đè).
     * FIX cũ giữ nguyên (Giang báo "song mới upload thiếu addedAt/size trong playlistCache"): object ghi vào cache có
     * ĐỦ addedAt/size giống `buildSongPlaylistCache()` (core/playlist/loader.js) — đọc `record.blob.size` cho khớp 100%.
     * CHỈ gọi khi Nguồn đang là Song — Video/Photo dùng chung các map này cho danh sách CỦA CHÚNG.
     * @param {string} key @param {{filename:string, tag:object, cover:Blob|null, duration:number, addedAt:number, blob:Blob}} record @param {boolean} isNew
     */
    _indexSongInPlaylistState(key, record, isNew) {
        if (isNew) appState.mutate('playlistOrder', arr => arr.push(key));
        appState.mutate('playlistCache', m => m.set(key, { filename: record.filename, tag: record.tag, cover: record.cover, duration: record.duration, addedAt: record.addedAt, size: record.blob.size || 0 }));
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(record.tag.title)));
        appState.mutate('confirmedBrokenKeys', s => s.delete(key));
        console.log(`writer: "workflowPlaylist._indexSongInPlaylistState", page: "playlistOrder/playlistCache/songNameIndex/confirmedBrokenKeys", content: "${key} (${isNew ? 'mới' : 'ghi đè'})"`);
    },

    /**
     * TÁCH (01/10/2026) từ `uploadSongs()` — làm mới danh sách sau khi thêm bài (Nguồn Song). updateShuffleArray()/
     * applyNewSongsToDisplayOrder()/recomputeRenderOrder() thuộc event/workflow/playlist-order.js (workflowPlaylistOrder).
     * @param {string[]} newlyAddedKeys - CHỈ key mới (không gồm ghi đè)
     */
    _refreshPlaylistAfterSongsAdded(newlyAddedKeys) {
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.applyNewSongsToDisplayOrder(newlyAddedKeys); // (B) hàng đợi phát: nối cuối / pending
        workflowPlaylistOrder.recomputeRenderOrder(); // (A) UI: sắp xếp lại NGAY
        workflowPlaylistRender.renderPlaylistDiff();
    },

    /**
     * TÁCH (01/10/2026) từ `uploadSongs()` (MỚI 06/09/2026, hợp nhất Folder vào Playlist, Batch 6) — đang Scope 1 folder
     * Song thì gắn mọi key (mới HOẶC ghi đè) vào ĐÚNG folder đó — 1 lượt bulk. Đọc `activePlayListFolder.song` — đúng
     * folder Song kể cả khi Nguồn đang là Video (Ghi âm lúc phát Video, Giang chốt).
     * @param {string[]} keys
     */
    /**
     * MỚI (06/10/2026, plan-media-db-split.md — Rule 3b) — Workflow CHUẨN BỊ cho core `addSongsToFolder()` (core/file-manager/
     * folder.js — giờ không tự đọc DB): đọc `folder_song` của folder đích, folder không tồn tại thì dừng. DÙNG CHUNG mọi
     * nơi thêm media vào folder (upload, ghi âm, picker "Thêm vào thư mục", Video editor "Lưu mới").
     * @param {string[]} keys @param {string} folderId @param {'song'|'video'|'photo'} mediaType
     * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
     */
    async addMediaToFolder(keys, folderId, mediaType) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        if (!folderMap) return { status: 'notFound', addedCount: 0 };
        return addSongsToFolder(keys, folderId, mediaType, folderMap); // core/file-manager/folder.js
    },

    async _attachSongsToActiveSongFolder(keys) {
        const activeFolderIdForSong = appState.get('activePlayListFolder').song;
        if (!activeFolderIdForSong || keys.length === 0) return;
        await this.addMediaToFolder(keys, activeFolderIdForSong, 'song'); // workflowPlaylist.addMediaToFolder() — SỬA 06/10/2026 (đọc folder_song rồi gọi core addSongsToFolder)
    },

    /**
     * MỚI (01/10/2026, Ghi âm — Giang chốt) — lưu bản ghi thành 1 Song MỚI (tên file có dấu thời gian tới giây -> không
     * đè bài cũ). LUÔN ghi DB `songs` + gắn folder Song đang active. Danh sách trong RAM (playlistOrder/playlistCache/
     * songNameIndex) CHỈ cập nhật khi Nguồn đang là Song — đang ở Video thì để nguyên (các map đó đang chứa danh sách
     * Video), chuyển sang Nguồn Song loader tự nạp lại từ DB nên bài ghi âm có mặt.
     * @param {{filename:string, blob:Blob, tag:{title:string, artist:string, album:string}, cover:Blob|null, duration:number}} song
     * @returns {Promise<string>} key vừa lưu
     */
    async addRecordedSong(song) {
        const key = await resolveSongKey(song.filename); // service/db.js
        // SỬA (06/10/2026, plan-media-db-split.md) — cover gốc lấy từ playlistCache (Blob ĐỌC TỪ IndexedDB của bài/video
        // nguồn) nên vật chất hoá thành Blob mới trước khi ghi sang record khác (tránh lỗi round-trip); file ghi âm vốn
        // là Blob mới. Ghi qua createMediaRecord() (3 store).
        const cover = song.cover ? await rematerializeBlob(song.cover) : null; // service/db.js
        const record = { filename: song.filename, blob: song.blob, tag: song.tag, cover, subtitles: [], duration: song.duration, addedAt: Date.now() };
        await createMediaRecord('song', key, record); // service/db.js
        console.log(`writer: "workflowPlaylist.addRecordedSong", page: "db.songs", content: "${key} (${song.blob.type || 'không rõ MIME'}, ${song.blob.size} byte)"`);
        const activeMediaSource = appState.get('activeMediaSource');
        (RECORDED_SONG_INDEX_BY_SOURCE[activeMediaSource] || RECORDED_SONG_INDEX_BY_SOURCE.other)(key, record);
        await this._attachSongsToActiveSongFolder([key]);
        return key;
    },

    /** Nhánh 'song' của RECORDED_SONG_INDEX_BY_SOURCE — key đã có trong playlistOrder (hiếm: trùng tên file) -> ghi đè. */
    _indexRecordedSongInSongSource(key, record) {
        const isNew = !appState.get('playlistOrder').includes(key);
        this._indexSongInPlaylistState(key, record, isNew);
        this._refreshPlaylistAfterSongsAdded(isNew ? [key] : []);
    },


    /** DỜI (24/09/2026, dọn nợ "Core gọi Workflow") từ core/playlist/loader.js::handleAudioFiles() — thân GIỮ NGUYÊN.
     *
     * Xử lý 1 FileList bất kỳ (từ input chọn file rời HOẶC input "Chọn cả thư mục") — TÁCH
     * RA thành hàm riêng (ver 8 refine) để 2 input dùng chung 100% logic, không lặp code.
     * webkitdirectory trả về FileList chứa MỌI file trong thư mục + thư mục con (ảnh, txt,
     * .DS_Store, v.v., không chỉ nhạc) — validateAudioFile() ở vòng lọc bên dưới tự loại các
     * file không phải nhạc, y hệt cách input file rời lọc file sai định dạng cố tình chọn.
     */
    async uploadSongs(fileList) {
      try {
        const allFiles = Array.from(fileList); if (allFiles.length === 0) return;
        playlistEmpty.classList.add('hidden');

        const failedFiles = [];
        const newlyAddedKeys = [];
        // MỚI (06/09/2026, Batch 6) — mọi key THẬT SỰ setSongRecord() thành công trong lượt
        // này (mới HOẶC ghi đè) — xem chỗ push ở vòng lặp bên dưới + gắn folder cuối hàm.
        const allProcessedKeys = [];

        // (3a) Lọc định dạng nhạc NGAY khi nhận file — accept="" của <input> chỉ là gợi ý UI,
        // không chặn thật (xem upload-validation.js). File không hợp lệ bị loại khỏi danh sách
        // xử lý và liệt kê chung với failedFiles, KHÔNG được đưa vào IndexedDB/playlist.
        // SỬA (06/10/2026, Giang chốt "file <= 500MB mới được upload") — kiểm thêm dung lượng
        // (core/upload-validation.js::validateMediaFileSize()), lấy lỗi ĐẦU TIÊN gặp phải để báo.
        const files = [];
        for (const file of allFiles) {
            const firstFail = [validateAudioFile(file), validateMediaFileSize(file)].find((check) => !check.valid); // core/upload-validation.js
            if (!firstFail) files.push(file);
            else failedFiles.push(`${escapeHtml(file.name)} — ${firstFail.reason}`);
        }
        if (files.length === 0) {
            if (failedFiles.length > 0) await alertModal(tFormat('common.upload.failedList', { n: failedFiles.length, list: failedFiles.join('\n\n') }));
            return;
        }
        // TỐI ƯU (v7): trước đây dùng `playlistOrder.includes(key)` NGAY TRONG vòng `for` qua
        // từng file -> O(files.length × playlistOrder.length), O(n²) khi nạp nhiều file vào
        // playlist đã lớn. Dựng 1 Set tra cứu O(1) trước vòng lặp, đồng bộ thêm phần tử mỗi khi
        // push key mới (kể cả khi 2 file trùng tên trong CÙNG 1 lượt chọn — resolveSongKey() có
        // thể trả cùng 1 key cho 2 file liên tiếp, Set phải thấy được key đó NGAY để không bị
        // hiểu sai thành "bài mới" ở vòng lặp kế). Kết quả/logic giữ nguyên 100% so với bản cũ.
        const playlistOrderSet = new Set(appState.get('playlistOrder'));

        // FIX (ver 8 refine #2): withLoadingShield() im lặng return (không làm gì, không throw)
        // nếu đã có 1 tác vụ khác đang dùng shield (isShieldBusy = true) — ví dụ người dùng bấm
        // "Thêm nhạc" 2 lần liên tiếp quá nhanh, hoặc 1 tác vụ nền (xóa bài, lưu ảnh nền...) còn
        // đang chạy. Trước đây trường hợp này HOÀN TOÀN im lặng: người dùng chọn file/thư mục
        // xong, không thấy gì xảy ra, không có lỗi nào để biết nguyên nhân. Theo dõi qua biến cờ
        // riêng để log + alert rõ ràng thay vì im lặng bỏ qua.
        let shieldRan = false;
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: files.length }), async () => {
            shieldRan = true;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: files.length });

                try {
                    let tag = { title: file.name.replace(/\.[^/.]+$/, ""), artist: t('common.song.unknownArtist'), album: "" };
                    let cover = null;

                    await new Promise(resolve => {
                        let settled = false;
                        const safeResolve = () => { if (!settled) { settled = true; resolve(); } };
                        const safetyTimeout = taskManager.once(safeResolve, 5000);

                        if (window.jsmediatags) {
                            try {
                                jsmediatags.read(file, {
                                    onSuccess: function(tagResult) {
                                        try {
                                            if (tagResult.tags.title) tag.title = tagResult.tags.title;
                                            if (tagResult.tags.artist) tag.artist = tagResult.tags.artist;
                                            if (tagResult.tags.album) tag.album = tagResult.tags.album;
                                            if (tagResult.tags.picture && tagResult.tags.picture.data) {
                                                const data = tagResult.tags.picture.data;
                                                const format = tagResult.tags.picture.format;
                                                // Ver 8 refine (mục 4 — lỗi ảnh cover không hiển thị): jsmediatags đôi khi trả
                                                // `format` RỖNG hoặc KHÔNG PHẢI MIME ảnh hợp lệ (file MP3 ghi tag ID3 không
                                                // chuẩn, hoặc bị cắt cụt) — Blob constructor KHÔNG throw lỗi dù `type` rác,
                                                // nhưng <img> sau đó không decode được (hiện ảnh vỡ) vì browser không biết
                                                // coi nội dung đó là ảnh gì. Validate MIME bằng VALID_IMAGE_MIME_TYPES (đã
                                                // có sẵn ở upload-validation.js) NGAY tại nguồn — nếu sai, bỏ cover (null)
                                                // thay vì lưu 1 Blob chắc chắn không hiển thị được; bài hát vẫn nạp bình
                                                // thường, chỉ là không có ảnh bìa (fallback DEFAULT_VINYL, không phải lỗi).
                                                const normalizedFormat = (format || '').toLowerCase().trim();
                                                if (normalizedFormat && VALID_IMAGE_MIME_TYPES.has(normalizedFormat) && data && data.length > 0) {
                                                    cover = new Blob([new Uint8Array(data)], { type: normalizedFormat });
                                                } else {
                                                    console.warn(`[playlist] Cover ID3 của "${file.name}" có định dạng không hợp lệ ("${format}") hoặc rỗng — bỏ qua cover, vẫn nạp bài.`);
                                                    cover = null;
                                                }
                                            }
                                        } catch (tagErr) {
                                            console.error(`[playlist] Lỗi đọc cover/tag của "${file.name}", bỏ qua cover, vẫn nạp bài:`, tagErr);
                                            cover = null;
                                        }
                                        safetyTimeout.kill(); safeResolve();
                                    },
                                    onError: function(err) {
                                        console.warn(`[playlist] jsmediatags không đọc được tag của "${file.name}":`, err);
                                        safetyTimeout.kill(); safeResolve();
                                    }
                                });
                            } catch (readErr) {
                                console.error(`[playlist] jsmediatags.read lỗi đồng bộ với "${file.name}":`, readErr);
                                safetyTimeout.kill(); safeResolve();
                            }
                        } else { safetyTimeout.kill(); safeResolve(); }
                    });

                    const duration = await readAudioDuration(file);
                    const key = await resolveSongKey(file.name);
                    const isOverwrite = playlistOrderSet.has(key);

                    const record = { filename: file.name, blob: file, tag, cover, subtitles: [], duration, addedAt: Date.now() };
                    if (isOverwrite) {
                        // SỬA (06/10/2026, plan-media-db-split.md) — chỉ đọc meta (không mở Blob). Ghi đè giữ lại phụ đề
                        // (như cũ) + folder / thống kê / điểm Game (giờ nằm trong meta — trước đây field folder bị mất khi ghi đè).
                        const old = await getMediaMeta('song', key); // service/db.js
                        if (old) Object.assign(record, { subtitles: old.subtitles || [], folder: old.folder, stats: old.stats, game: old.game });
                    }
                    await createMediaRecord('song', key, record); // service/db.js — 3 store, file + cover đều là Blob mới
                    // MỚI (06/10/2026, plan mục 7) — báo request trung tâm: nếu bài này đang phát/đang dùng thì tự nạp lại.
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'song', key } });
                    // MỚI (06/09/2026, hợp nhất Folder vào Playlist, Batch 6 — "upload tự gắn
                    // vào folder đang active") — gom key vào ĐÂY (CẢ 2 nhánh mới/ghi đè, xem
                    // docstring cuối vòng lặp for) — gắn folder hàng loạt SAU vòng lặp, không
                    // gọi addSongsToFolder() N lần riêng lẻ trong lúc lặp (tốn kém, xem docstring
                    // addSongsToFolder()/removeSongsFromFolder(), core/file-manager/folder.js).
                    allProcessedKeys.push(key);

                    if (!isOverwrite) { playlistOrderSet.add(key); newlyAddedKeys.push(key); }
                    // SỬA (01/10/2026, Ghi âm — Giang duyệt tách) — 4 lần mutate playlistOrder/playlistCache/songNameIndex/
                    // confirmedBrokenKeys dời vào `_indexSongInPlaylistState()` (dùng chung với `addRecordedSong()`), thứ tự
                    // và nội dung GIỮ NGUYÊN (gồm fix addedAt/size trong playlistCache — xem docblock method đó).
                    this._indexSongInPlaylistState(key, record, !isOverwrite);
                } catch (err) {
                    console.error(`[playlist] Không nạp được "${file.name}":`, err);
                    const errMsg = (err && err.name && err.message) ? `${err.name}: ${err.message}` : String(err && err.message || err || t('common.unknownError'));
                    failedFiles.push(`${escapeHtml(file.name)} — ${escapeHtml(errMsg)}`);
                }
            }
            // SỬA (01/10/2026, Ghi âm — Giang duyệt tách) — 4 bước làm mới danh sách + gắn folder đang active dời vào
            // `_refreshPlaylistAfterSongsAdded()`/`_attachSongsToActiveSongFolder()` (dùng chung với `addRecordedSong()`),
            // thứ tự và nội dung GIỮ NGUYÊN.
            this._refreshPlaylistAfterSongsAdded(newlyAddedKeys);
            await this._attachSongsToActiveSongFolder(allProcessedKeys);
        });

        if (!shieldRan) {
            // withLoadingShield() đã bỏ qua lệnh gọi này vì đang bận tác vụ khác — KHÔNG có file
            // nào được xử lý dù người dùng đã chọn xong. Báo rõ thay vì im lặng.
            console.warn('[upload] handleAudioFiles bị bỏ qua: đang có 1 tác vụ khác dùng loading shield (isShieldBusy=true). Hãy thử lại sau khi tác vụ hiện tại xong.');
            await alertModal(t('common.upload.shieldBusy'));
            return;
        }

        if (failedFiles.length > 0) {
            await alertModal(tFormat('common.upload.failedList', { n: failedFiles.length, list: failedFiles.join('\n\n') }));
        }
      } catch (err) {
          console.error('[upload] Lỗi không xác định trong handleAudioFiles:', err);
          await alertModal(tFormat('common.upload.genericError', { message: escapeHtml(err && err.message ? err.message : err) }));
      }
    },

    /** DỜI (24/09/2026) từ core/playlist/loader.js::handleFilePickerChange() — thân GIỮ NGUYÊN (chỉ đổi lời gọi handleAudioFiles -> this.uploadSongs).
     *
     * Xử lý FileList đã chốt (Array thật) từ input chọn FILE RỜI (#media-upload — DÙNG CHUNG
     * Song/Video/Photo từ phản hồi Giang "1 khung, không nhân bản"; hàm NÀY chỉ được router
     * gọi khi activeMediaSource='song', xem event/router/playlist.js). Core THUẦN nhận Array
     * qua tham số — KHÔNG tự đọc input/FileList (đã chốt ở listener, xem comment phía trên).
     * Giữ NGUYÊN try/catch + alertModal() bên trong (giống handleAudioFiles() — đây vẫn là 1
     * hàm core "lớn" có sẵn shield/modal nội bộ, KHÔNG tách ra workflow, theo đúng quyết định
     * đã chốt khi tách cụm này vào /event/).
     * @param {File[]} fileList
     */
    async handleSongFilePickerChange(fileList) {
        try {
            console.log(`[upload] #media-upload change (Song): ${fileList.length} file được chọn.`);
            if (fileList.length === 0) {
                console.warn('[upload] #media-upload (Song): FileList rỗng sau khi chọn — trình duyệt không trả về file nào.');
                return;
            }
            await this.uploadSongs(fileList);
        } catch (err) {
            console.error('[upload] Lỗi không xác định khi xử lý file đã chọn (#media-upload, Song):', err);
            await alertModal(tFormat('common.upload.fileError', { message: escapeHtml(err && err.message ? err.message : err) }));
        }
    },

    /** DỜI (24/09/2026) từ core/playlist/loader.js::handleFolderPickerChange() — thân GIỮ NGUYÊN (chỉ đổi lời gọi handleAudioFiles -> this.uploadSongs).
     *
     * Xử lý FileList đã chốt từ input chọn CẢ THƯ MỤC (#media-upload-folder — DÙNG CHUNG Song/
     * Video/Photo, cùng lý do handleFilePickerChange() ngay trên; hàm NÀY chỉ được router gọi
     * khi activeMediaSource='song'). Core THUẦN, cùng nguyên tắc như handleFilePickerChange()
     * ở trên.
     * @param {File[]} fileList
     */
    async handleSongFolderPickerChange(fileList) {
        try {
            console.log(`[upload] #media-upload-folder change (Song): ${fileList.length} file được chọn (toàn bộ thư mục + thư mục con).`);
            if (fileList.length === 0) {
                console.warn('[upload] #media-upload-folder (Song): FileList rỗng sau khi chọn thư mục — trình duyệt không trả về file nào (thư mục trống, hoặc bị chặn quyền đọc thư mục).');
                await alertModal(t('common.upload.folderEmpty'));
                return;
            }
            await this.uploadSongs(fileList);
        } catch (err) {
            console.error('[upload] Lỗi không xác định khi xử lý thư mục đã chọn (#media-upload-folder, Song):', err);
            await alertModal(tFormat('common.upload.folderError', { message: escapeHtml(err && err.message ? err.message : err) }));
        }
    },

    /** Ứng với 'playlist.upload.fileChange'/'playlist.upload.folderChange' khi activeMediaSource=
     * 'video' (SỬA — phản hồi Giang "1 khung, không nhân bản": trước đây có msg.type riêng
     * 'playlist.upload.videoFileChange' từ input riêng #video-upload-input, ĐÃ XOÁ — giờ dùng
     * CHUNG 2 input với Song/Photo, router (event/router/playlist.js) rẽ nhánh VirtualMachineState
     * theo activeMediaSource, cả 2 case đều gọi hàm NÀY — hàm không phân biệt file đến từ input
     * "chọn file" hay "chọn thư mục", chỉ cần 1 mảng File). Lỗi 1 file (vd file hỏng) KHÔNG chặn cả
     * lô upload — bắt riêng, bỏ qua đúng file đó, tiếp tục file sau (Rule 1: vẫn 1 tiến trình
     * "upload cả lô"). Hiện tiến trình "X/Y" qua `loadingText.textContent`, ĐÚNG pattern
     * `handleAudioFiles()` (Song, core/playlist/loader.js) — tái dùng NGUYÊN lang key
     * `common.upload.loadingProgress`.
     *
     * SỬA (18/09/2026, Giang yêu cầu "thiếu full-res lúc upload cũng là lỗi thật... cần thông báo
     * với người dùng, khuyến nghị upload lại") — `extractVideoThumbAndMeta()` giờ reject luôn nếu
     * thiếu full-res (xem SỬA cùng ngày ở hàm đó), rơi vào ĐÚNG nhánh catch có sẵn bên dưới — file
     * đó tự động bị skip (KHÔNG lưu record), không cần đổi gì ở vòng lặp. Cái THIẾU trước đây: catch
     * chỉ đếm số (`failedCount`), không nhớ TÊN file nào bị skip để báo — thêm `skippedFilenames`,
     * cuối hàm nếu có ít nhất 1 file bị skip thì hiện THÊM 1 modal riêng liệt kê tên + khuyến nghị
     * upload lại (TÁCH khỏi modal "Đã thêm N video" thành công cho rõ, không gộp chung 1 câu).
     * @param {FileList|File[]} files
     */
    async uploadVideos(files) {
        // SỬA (06/10/2026, Giang chốt "file <= 500MB mới được upload") — tách file quá cỡ ra TRƯỚC
        // vòng nạp (không chụp thumbnail, không lưu), báo riêng ở cuối hàm.
        const { acceptedFiles: fileArray, oversizedLines } = this._splitOversizedFiles(files);
        if (fileArray.length === 0) { await this._alertOversizedFiles(oversizedLines); return; }

        let failedCount = 0;
        const skippedFilenames = []; // MỚI (18/09/2026) — tên từng file bị skip, để báo cuối lô
        const uploadedVideoKeys = []; // MỚI (06/09/2026, Batch 6) — gắn folder hàng loạt SAU vòng lặp, xem cuối hàm
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
                try {
                    const { thumbBlob, thumbFullBlob, thumbFullIsBlack, width, height, duration } = await this.extractVideoThumbAndMeta(file);
                    const videoKey = await resolveVideoKey(file.name); // service/db.js — SỬA 06/10/2026: key resolve ở Workflow (Rule 3)
                    await saveVideo(videoKey, file, file.name, thumbBlob, width, height, duration, thumbFullBlob, thumbFullIsBlack); // core/file-manager/video.js
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'video', key: videoKey } }); // MỚI 06/10/2026 — trùng tên = ghi đè, trung tâm tự nạp lại nếu đang dùng
                    uploadedVideoKeys.push(videoKey);
                } catch (err) {
                    console.error(`[uploadVideos] chụp thumbnail/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                    skippedFilenames.push(file.name);
                }
            }
            // MỚI (06/09/2026, hợp nhất Folder vào Playlist, Batch 6) — nếu đang Scope 1 folder
            // Video, gắn LUÔN mọi file vừa upload vào ĐÚNG folder đó, CÙNG LÝ DO/CÙNG CHỖ GỌI
            // handleAudioFiles() (core/playlist/loader.js).
            const activeFolderIdForVideo = appState.get('activePlayListFolder').video;
            if (activeFolderIdForVideo && uploadedVideoKeys.length > 0) {
                await this.addMediaToFolder(uploadedVideoKeys, activeFolderIdForVideo, 'video'); // workflowPlaylist.addMediaToFolder() — SỬA 06/10/2026 (đọc folder_song rồi gọi core addSongsToFolder)
            }
        });
        // input tự dọn value trong chính listener của nó (event/listener/playlist.js, fileInput/folderInput dùng chung).
        // MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — nếu Playlist đang
        // browse nguồn Video, làm mới playlistCache/playlistOrder NGAY để Next/Prev thấy được video
        // vừa upload — KHÔNG cần đổi Nguồn tắt/bật lại.
        await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard activeMediaSource, no-op nếu Playlist không ở nguồn Video
        const successCount = fileArray.length - failedCount;
        await this._alertOversizedFiles(oversizedLines); // MỚI (06/10/2026) — file quá 500MB bị bỏ qua
        // MỚI (18/09/2026) — báo riêng danh sách file bị skip TRƯỚC, rồi mới báo thành công (nếu
        // có) — `r.filename`-style dữ liệu NGƯỜI DÙNG (tên file), PHẢI escapeHtml() trước khi nhúng,
        // cùng nguyên tắc đã áp dụng ở renderScanResultUI() (core/storage-manager.js).
        if (skippedFilenames.length > 0) {
            const namesHtml = skippedFilenames.map((n) => escapeHtml(n)).join(', ');
            await alertModal(tFormat('fileManager.video.uploadSkipped', { count: skippedFilenames.length, names: namesHtml }), { title: t('fileManager.video.uploadSkippedTitle') });
        }
        if (successCount > 0) {
            await alertModal(tFormat('fileManager.video.uploadSuccess', { count: successCount }));
        }
    },

    /** Ứng với 'playlist.upload.fileChange'/'playlist.upload.folderChange' khi activeMediaSource=
     * 'photo' — MỚI (phản hồi Giang "1 khung, không nhân bản" + "quá trình cũ của up photo có thể
     * tái dùng nhưng phải đúng quy trình mẫu của song/video đã làm ở giao diện playlist"). TÁI
     * DÙNG "quá trình cũ" ở đúng phần lõi (resize thumbnail — `workflowFileManagerPhoto.
     * resizeImageForThumbnail()`, event/workflow/file-manager-photo.js, Workflow gọi Workflow miền
     * khác, TỰ DO theo event-bus-flow.md mục 4B — KHÔNG viết lại thuật toán resize) + `saveImage()`
     * (core/file-manager/image.js, không đổi) — nhưng KHÔNG gọi thẳng `uploadImages()` (hàm đó
     * mang theo hành lý riêng của Photo Panel: check `photoPanel.classList.contains('hidden')`,
     * tự dọn `#file-manager-image-upload-input`, tự `this.refresh()` lưới CỦA NÓ, tự alertModal
     * theo ngữ cảnh Photo Panel — không khớp giao diện Playlist). Thân hàm NÀY viết MỚI, đúng
     * KHUÔN `uploadVideos()` ngay trên (shield + tiến trình "X/Y" + bắt lỗi riêng từng file + xong
     * thì tự làm mới Playlist nếu đang đứng ở Nguồn Photo, qua applyFolderScope()/applyAllSongsScope()
     * — event/workflow/playlist-scope.js).
     * SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — thêm bước gọi
     * `workflowFileManagerPhoto.computePhotoDuration()` (cùng file với `resizeImageForThumbnail()`,
     * cùng lý do TỰ DO gọi chéo Workflow) TRƯỚC `saveImage()`, `saveImage()` giờ nhận thêm `duration`.
     * @param {FileList|File[]} files
     */
    async uploadPhotos(files) {
        // SỬA (06/10/2026) — cùng giới hạn 500MB/file như uploadVideos() ngay trên.
        const { acceptedFiles: fileArray, oversizedLines } = this._splitOversizedFiles(files);
        if (fileArray.length === 0) { await this._alertOversizedFiles(oversizedLines); return; }

        let failedCount = 0;
        const uploadedImageKeys = []; // MỚI (06/09/2026, Batch 6) — gắn folder hàng loạt SAU vòng lặp, xem cuối hàm
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
                try {
                    const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(file); // event/workflow/file-manager-photo.js — tái dùng NGUYÊN thuật toán resize cũ
                    const duration = await workflowFileManagerPhoto.computePhotoDuration(file, width, height); // MỚI — Photo tích hợp duration như Song/Video (event/workflow/file-manager-photo.js)
                    const imageKey = await resolveImageKey(file.name); // service/db.js — SỬA 06/10/2026: key resolve ở Workflow (Rule 3)
                    await saveImage(imageKey, file, file.name, thumbBlob, width, height, duration); // core/file-manager/image.js
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'photo', key: imageKey } }); // MỚI 06/10/2026 — trùng tên = ghi đè
                    uploadedImageKeys.push(imageKey);
                } catch (err) {
                    console.error(`[uploadPhotos] resize/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
            // MỚI (06/09/2026, hợp nhất Folder vào Playlist, Batch 6) — CÙNG LÝ DO uploadVideos() ngay trên.
            const activeFolderIdForPhoto = appState.get('activePlayListFolder').photo;
            if (activeFolderIdForPhoto && uploadedImageKeys.length > 0) {
                await this.addMediaToFolder(uploadedImageKeys, activeFolderIdForPhoto, 'photo'); // workflowPlaylist.addMediaToFolder() — SỬA 06/10/2026 (đọc folder_song rồi gọi core addSongsToFolder)
            }
        });
        // input tự dọn value trong chính listener của nó (event/listener/playlist.js, fileInput/folderInput dùng chung).
        // Làm mới Playlist NGAY nếu đang đứng ở Nguồn Photo — applyFolderScope()/applyAllSongsScope()
        // (event/workflow/playlist-scope.js) tự nạp lại cache ĐÚNG phạm vi (folder đang active nếu
        // có, nhặt luôn ảnh vừa upload) + Filter + render, không cần tự gọi gì thêm.
        if (appState.get('activeMediaSource') === 'photo') {
            const activeFolderIdForPhotoRefresh = appState.get('activePlayListFolder').photo;
            if (activeFolderIdForPhotoRefresh) await workflowPlaylistScope.applyFolderScope(activeFolderIdForPhotoRefresh, 'photo');
            else await workflowPlaylistScope.applyAllSongsScope('photo');
            console.log(`writer: "uploadPhotos", page: "playlistOrder", content: "${appState.get('playlistOrder').length} ảnh (làm mới sau upload)"`);
        }
        const successCount = fileArray.length - failedCount;
        await this._alertOversizedFiles(oversizedLines); // MỚI (06/10/2026) — file quá 500MB bị bỏ qua
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: successCount })); // tái dùng NGUYÊN lang key cũ của Photo Panel
    },

    /**
     * MỚI (06/10/2026, Giang chốt "file <= 500MB mới được upload") — DÙNG CHUNG uploadVideos()/uploadPhotos():
     * tách file vượt giới hạn (core/upload-validation.js::validateMediaFileSize()) khỏi danh sách nạp, trả kèm
     * từng dòng báo lỗi đã escape sẵn (tên file là dữ liệu người dùng). Song tự kiểm trong vòng lọc định dạng
     * riêng của uploadSongs() (gộp chung danh sách failedFiles có sẵn).
     * @param {FileList|File[]} files
     * @returns {{acceptedFiles: File[], oversizedLines: string[]}}
     */
    _splitOversizedFiles(files) {
        const checked = Array.from(files).map((file) => ({ file, check: validateMediaFileSize(file) })); // core/upload-validation.js
        return {
            acceptedFiles: checked.filter((x) => x.check.valid).map((x) => x.file),
            oversizedLines: checked.filter((x) => !x.check.valid).map((x) => `${escapeHtml(x.file.name)} — ${x.check.reason}`),
        };
    },

    /** Báo danh sách file bị bỏ qua vì quá cỡ — tái dùng NGUYÊN key `common.upload.failedList` của Song. Không có gì thì bỏ qua.
     * @param {string[]} oversizedLines */
    async _alertOversizedFiles(oversizedLines) {
        if (oversizedLines.length === 0) return;
        await alertModal(tFormat('common.upload.failedList', { n: oversizedLines.length, list: oversizedLines.join('\n\n') }));
    },

    /**
     * "Phát bài đã chọn" — áp displaySortMode hiện tại NHƯNG chỉ trong tập đã chọn (tái dùng
     * sortKeysByMode() có sẵn ở core/playlist/order.js, chỉ đổi input thành tập con).
     *
     * SỬA (fix 03/07/2026, mục 3a/3b yêu cầu) — đây chính là "section chọn bài -> phát" phải KHÁC
     * "danh sách phát của playlist": trước đây chỉ ghi đè displayOrder, không đánh dấu gì, khiến
     * app không còn cách nào biết "đang ở trong 1 section" để quay lại top-level. Giờ đặt
     * sectionQueueActive=true (đọc bởi 2 nút to Phát/Trộn bài — event/workflow/playlist-empty-state.js
     * — để biết cần chèn lại top-level trước khi phát) VÀ, nếu Shuffle đang BẬT sẵn từ trước khi
     * vào section này, resync NGAY shuffleIndices theo section mới (updateShuffleArrayFromQueue) —
     * tránh Next/Prev đầu tiên trong section "tràn" ngay sang top-level vì shuffleIndices cũ còn
     * thuộc phạm vi khác.
     */
    playSelectedSongs() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return; // guard — chưa chọn gì thì không làm gì

        // MỚI (ver12 Batch1) — sortKeysByMode() đổi chữ ký, nhận tham số thay vì tự appState.get()
        // (Rule 2, xem comment tại định nghĩa hàm, core/playlist/order.js) — gộp 1 lần get([...]).
        // FIX (regression, phản hồi Giang — "Chọn nhiều -> Phát ném TypeError") — sortKeysByMode()
        // SAU ĐÓ đổi chữ ký THÊM LẦN NỮA (mục 3, tách trục thống kê: statField/statDirection chen
        // vào GIỮA nameMode và songNameIndex, thêm mediaStatsMap cuối cùng — core/playlist/
        // order.js) nhưng caller NÀY sót lại, vẫn gọi theo VỊ TRÍ CŨ 4 tham số — `songNameIndex`/
        // `playlistCache` bị đẩy LỆCH xuống đúng vị trí `statField`/`statDirection`, 3 tham số
        // cuối cùng (`songNameIndex`/`playlistCache`/`mediaStatsMap` THẬT) luôn `undefined` ->
        // `_buildStatComparator()` rơi vào nhánh mặc định 'duration', gọi `playlistCache.get(k)`
        // trên `undefined` -> TypeError ngay lần so sánh đầu (chắc chắn xảy ra khi chọn ≥2 bài).
        // Đọc ĐỦ 6 field, gọi ĐÚNG thứ tự 7 tham số — CÙNG khuôn đã dùng đúng ở
        // recomputeRenderOrder()/recomputeDisplayOrder() (core/playlist/order.js).
        const { displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache: cache, mediaStatsMap, activeMediaSource } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap', 'activeMediaSource']);
        const sorted = sortKeysByMode(keys, nameMode, statField, statDirection, songNameIndex, cache, mediaStatsMap, activeMediaSource); // core/playlist/order.js — SỬA 06/10/2026: + loại media (key thống kê `type:key`)
        appState.set('displayOrder', sorted);
        console.log(`writer: "playSelectedSongs", page: "displayOrder", content: "${sorted.length} bài đã chọn, sort theo displaySortMode hiện tại"`);
        // FIX (vi phạm Rule 4 — core-function-conventions.md, mỗi lượt ghi appState phải có log)
        // — dòng mutate() này TỪ TRƯỚC đã thiếu console.log, sót lại trong lúc hàm chỉ được sửa vì
        // bug sortKeysByMode() ở trên — tiện sửa LUÔN, CÙNG khuôn "writer" đã dùng cho 2 lượt ghi
        // còn lại trong CHÍNH hàm này, và đúng tiền lệ recomputeDisplayOrder() (core/playlist/
        // order.js) đã bổ sung log cho ĐÚNG dòng `pendingResortKeys` y hệt.
        appState.mutate('pendingResortKeys', s => s.clear());
        console.log(`writer: "playSelectedSongs", page: "pendingResortKeys", content: "clear toàn bộ"`);

        appState.set('sectionQueueActive', true);
        console.log(`writer: "playSelectedSongs", page: "sectionQueueActive", content: "true"`);
        if (appState.get('isShuffle')) {
            updateShuffleArrayFromQueue(sorted, appState.get('playlistOrder'), true); // core mới (order.js), CÓ tham số -> Rule 2 hợp lệ
        }

        this._exitSelectionMode(); // thoát chế độ chọn trước khi chuyển màn hình phát
        workflowPlayer.playMedia(sorted[0]); // [SỬA — plan-playmedia-reorg.md] thay window.playSong() cũ, Workflow gọi Workflow khác miền, tự do
    },

    /**
     * "Xuất ZIP" — build tag mới nhất cho từng bài (tái dùng buildTaggedBlob() có sẵn ở
     * core/id3-export.js), gom vào 1 file .zip (`_compressZipEntries()`, core/storage-manager.js —
     * SỬA 10/09/2026, ưu tiên streaming OPFS qua zip.js thay JSZip trực tiếp) rồi tải xuống 1 lần —
     * KHÔNG gọi exportSongWithTag() có sẵn (mỗi lần tự bọc withLoadingShield() riêng — lồng shield
     * sẽ bị chặn bởi isShieldBusy, xem loading-shield-util.js).
     */
    async exportSelectedSongsZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let failedCount = 0;
        let zipParts; // SỬA (06/10/2026) — nhiều phần zip <= 500MB (event/workflow/zip-download.js), trước là 1 zipBlob
        // SỬA (10/09/2026, Giang yêu cầu "làm giống Folder Download/Storage Management") — TRƯỚC ĐÂY
        // dùng `t('common.loading.exportingFile')` (chữ TĨNH, không hiện %) suốt cả quá trình — giờ
        // ĐỔI sang ĐÚNG chữ + cách cập nhật % y hệt `zipAndDownloadOrFallback()`
        // (event/workflow/file-manager-storage.js): `common.storage.zippingStart` lúc bắt đầu, rồi
        // `onProgress` cập nhật `loadingText.textContent` theo `common.storage.zippingProgress`.
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            const entries = [];
            for (const key of keys) {
                const record = await getSongRecord(key);
                if (!record) { failedCount++; continue; } // guard: bài không còn tồn tại (race) — bỏ qua
                try {
                    const taggedBlob = await buildTaggedBlob(record); // core có sẵn, CÓ return, DÙNG ngay dưới
                    entries.push({ filename: record.filename, blob: taggedBlob });
                } catch (e) {
                    console.error('[workflow:playlist] Lỗi ghi tag lúc xuất ZIP hàng loạt, dùng file gốc thay thế:', e);
                    entries.push({ filename: record.filename, blob: record.blob });
                    failedCount++;
                }
            }
            // XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") — TRƯỚC ĐÂY dùng thẳng
            // `new JSZip()...generateAsync()` ở đây; giờ giao hẳn cho `_compressZipEntries()`
            // (core/storage-manager.js — ĐƯỜNG DUY NHẤT để nén zip, JSZip đã bỏ hẳn khỏi app).
            // SỬA (Giang báo bug "Storage Manager bỏ qua tag mp3") — `buildAllSongsZipBlob()`
            // (core/storage-manager.js) GIỜ ĐÃ tự gọi `buildTaggedBlob()` cho từng file qua
            // `_collectZipEntries()`, lẽ ra dùng lại được — nhưng hàm này VẪN giữ code riêng vì có
            // thêm resilience per-file RIÊNG (`failedCount` báo người dùng biết CHÍNH XÁC bao nhiêu
            // bài bị fallback, xem catch() ngay trên) mà `buildAllSongsZipBlob()` không trả ra
            // ngoài (chỉ tự log console) — giữ 2 đường tách nhau CÓ CHỦ Ý cho khác biệt UI này.
            // SỬA (06/10/2026, Giang yêu cầu chia zip >500MB) — nén qua workflowZipDownload (tự chia nhóm + cập nhật %).
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilename')); // event/workflow/zip-download.js
        });

        this._exitSelectionMode();
        // Shield đã đóng HẲN tới đây — an toàn để hiện modal.
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — KHÔNG
        // triggerDownload() thẳng ngay đây nữa (user-activation của lượt bấm gốc gần như chắc chắn
        // đã hết hạn sau khi chờ build zip xong) — giao cho promptDownloadReady() (core/
        // id3-export.js), nút "Tải xuống" bên trong modal đó mới thật sự gọi triggerDownload() với
        // activation MỚI/còn nguyên.
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — 1 phần: modal cũ; nhiều phần: modal danh sách; tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất file" — bản 1 file lẻ, dành cho Song. DỜI từ `core/id3-export.js::exportSongWithTag()`
     * (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — hàm này tự đọc DB + tự bọc
     * `withLoadingShield()` + tự gọi `alertModal()`, đúng HÌNH DẠNG WORKFLOW, KHÔNG đổi 1 dòng logic
     * bên trong, chỉ đổi NƠI Ở cho đúng kiến trúc.
     */
    async exportSongWithTag(key) {
        // FIX (xung đột shield/modal): KHÔNG await alertModal() bên trong fn() của
        // withLoadingShield() — xem giải thích chi tiết ở event/workflow/player.js (workflowPlayer.playMedia,
        // [SỬA — plan-playmedia-reorg.md] dời từ core/playlist/actions.js::window.playSong() cũ).
        // Tóm tắt: isShieldBusy chỉ giải phóng SAU KHI fn() resolve, còn alertModal() chỉ resolve
        // khi người dùng bấm OK -> lồng vào nhau làm #loading-shield (z-[200]) treo, đè lên trên
        // modalChoice() (z-[130]) suốt thời gian chờ. Dùng cờ mang thông tin ra ngoài, hiện modal
        // SAU KHI withLoadingShield() đã resolve hoàn toàn.
        let resultFlag = null; // null = ổn (không cần báo gì) | 'notFound' | 'tagWriteFailed'
        let successBlob = null; let successFilename = null; // MỚI (10/09/2026) — mang blob THÀNH CÔNG ra ngoài shield để prompt download sau, CÙNG lý do failedRecord ngay dưới
        let failedRecord = null; // giữ lại record gốc khi ghi tag lỗi — dùng để tải file gốc ở ngoài, tránh query lại DB lần 2
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getSongRecord(key);
            if (!record) { resultFlag = 'notFound'; return; }
            try {
                const taggedBlob = await buildTaggedBlob(record); // core có sẵn (core/id3-export.js)
                successBlob = taggedBlob; successFilename = record.filename;
            } catch (e) {
                console.error('[workflow:playlist] Lỗi ghi tag lúc xuất file:', e);
                resultFlag = 'tagWriteFailed';
                failedRecord = record;
                // Giữ ĐÚNG thứ tự hành vi gốc: alertModal() chạy XONG rồi mới tới bước tải file gốc
                // — người dùng đọc thông báo lỗi TRƯỚC khi file (chưa ghi tag) được tải xuống.
            }
        });

        // Shield đã đóng HẲN tới đây — an toàn để hiện modal.
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — KHÔNG
        // triggerDownload() thẳng nữa, giao cho promptDownloadReady() (core/id3-export.js) — xem
        // docstring hàm đó/exportSelectedSongsZip() ngay trên.
        if (resultFlag === 'notFound') {
            await alertModal(t('common.export.notFound'));
        } else if (resultFlag === 'tagWriteFailed') {
            await alertModal(t('common.export.tagWriteFailed'));
            await promptDownloadReady(failedRecord.blob, failedRecord.filename); // core/id3-export.js
        } else {
            await promptDownloadReady(successBlob, successFilename); // core/id3-export.js
        }
    },

    /**
     * "Xuất file" cho Video — bản 1 file lẻ, MỚI (Batch "Export dọn nợ kiến trúc", phản hồi Giang,
     * plan-v12-song-video-unification.md mục 6f) — CÙNG CẤU TRÚC exportSongWithTag() ngay trên,
     * CHỈ BỎ bước buildTaggedBlob() (Video không có 3 tag ID3, `customName` KHÔNG remux vào file —
     * đã chốt ở mục 6c/6f) — tải thẳng record.blob/record.filename GỐC.
     */
    async exportVideoFile(key) {
        let notFound = false;
        let blob = null; let filename = null;
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getVideoRecord(key); // service/db.js
            if (!record) { notFound = true; return; }
            blob = record.blob; filename = record.filename;
        });
        if (notFound) { await alertModal(t('common.export.notFound')); return; }
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — xem
        // docstring exportSelectedSongsZip()/promptDownloadReady() (core/id3-export.js).
        await promptDownloadReady(blob, filename); // core/id3-export.js
    },

    /**
     * "Xuất file" cho Photo — bản 1 ảnh lẻ, MỚI (Giang yêu cầu — "thêm export file/download ảnh vào
     * dropdown action menu photo playlist") — CÙNG CẤU TRÚC exportVideoFile() ngay trên (ảnh cũng
     * không có tag ID3 gì để ghi, tải thẳng record.blob/record.filename GỐC — không cần bước
     * buildTaggedBlob() như exportSongWithTag()).
     */
    async exportImageFile(key) {
        let notFound = false;
        let blob = null; let filename = null;
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getImageRecord(key); // service/db.js
            if (!record) { notFound = true; return; }
            blob = record.blob; filename = record.filename;
        });
        if (notFound) { await alertModal(t('common.export.notFound')); return; }
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — xem
        // docstring exportSelectedSongsZip()/promptDownloadReady() (core/id3-export.js).
        await promptDownloadReady(blob, filename); // core/id3-export.js
    },

    /**
     * "Xuất ZIP" cho Video — bản hàng loạt, MỚI (cùng batch với exportVideoFile() ngay trên) — CÙNG
     * CẤU TRÚC exportSelectedSongsZip(), CHỈ BỎ bước gắn tag (zip thẳng record.blob/filename gốc,
     * không cần try/catch riêng vì không có bước ghi tag nào có thể lỗi).
     */
    async exportSelectedVideosZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let zipParts; // SỬA (06/10/2026) — nhiều phần zip, xem exportSelectedSongsZip()
        let entries;
        // SỬA (10/09/2026, Giang yêu cầu "làm giống Folder Download/Storage Management") — xem lý do
        // đầy đủ ở exportSelectedSongsZip() ngay trên.
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            // XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") — TRƯỚC ĐÂY dùng thẳng
            // `new JSZip()...generateAsync()` ở đây; giờ giao cho `_collectZipEntries()` +
            // `_compressZipEntries()` (core/storage-manager.js — ĐƯỜNG DUY NHẤT để nén zip, JSZip
            // đã bỏ hẳn khỏi app, xem docstring đầy đủ ở đó/core/streaming-zip.js).
            entries = await _collectZipEntries(keys, getVideoRecord, '.mp4'); // core/storage-manager.js — tự bỏ qua key không còn tồn tại (record undefined)
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilenameVideo')); // event/workflow/zip-download.js
        });
        const failedCount = keys.length - entries.length; // key bị bỏ qua trong _collectZipEntries() (video không còn tồn tại, race) — CÙNG cách đếm cũ, không đọc lại DB lần 2

        this._exitSelectionMode();
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — xem
        // docstring exportSelectedSongsZip()/promptDownloadReady() (core/id3-export.js).
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất ZIP" cho Photo — bản hàng loạt, MỚI (06/09/2026, Giang chốt mục 3.5 — "Photo cũng cần
     * Download riêng ở Selection mode") — CÙNG CẤU TRÚC `exportSelectedVideosZip()` ngay trên
     * (Photo cũng không có tag ID3 gì để ghi, zip thẳng `record.blob`/`record.filename` GỐC).
     * Trước đây Photo rơi NHẦM vào nhánh Song ở router (đọc `getSongRecord()` trên photo key, luôn
     * rỗng) — xem SỬA event/router/playlist.js, case 'playlist.selection.moreMenu.select'.
     */
    async exportSelectedImagesZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let zipParts; // SỬA (06/10/2026) — nhiều phần zip, xem exportSelectedSongsZip()
        let entries;
        // SỬA (10/09/2026, Giang yêu cầu "làm giống Folder Download/Storage Management") — xem lý do
        // đầy đủ ở exportSelectedSongsZip() ngay trên.
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            entries = await _collectZipEntries(keys, getImageRecord, '.jpg'); // core/storage-manager.js — tự bỏ qua key không còn tồn tại (record undefined)
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilenamePhoto')); // event/workflow/zip-download.js
        });
        const failedCount = keys.length - entries.length; // CÙNG cách đếm ở exportSelectedVideosZip() ngay trên

        this._exitSelectionMode();
        // FIX (10/09/2026, Giang báo bug "PWA mở Quick Look thay vì tải xuống thật") — xem
        // docstring exportSelectedSongsZip()/promptDownloadReady() (core/id3-export.js).
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất file" cho ĐÚNG 1 item đang mở menu 3 chấm — MỚI (Batch "Export dọn nợ kiến trúc", phản
     * hồi Giang) — TÁCH RIÊNG khỏi handleSongActionMenuSelect() cũ (core/playlist/actions.js, đã có
     * sẵn nhánh if/else vi phạm Rule 1 — không mở rộng thêm, CÙNG PRECEDENT với addToFolder/
     * editSubtitles/navigateToActiveMenuVideoEdit ở trên: đọc key đang mở menu, đóng menu, rồi rẽ
     * theo `activeMediaSource` — CÙNG CÔNG THỨC openAddToFolderPickerForSongMenu() phía trên
     * (Playlist chỉ browse ĐÚNG 1 nguồn tại 1 thời điểm, item đang mở menu luôn cùng loại với nguồn
     * đang active) — Song -> exportSongWithTag() (kèm bước ghi tag ID3), Video -> exportVideoFile()
     * (bỏ qua bước tag).
     * SỬA (Giang yêu cầu — "thêm export file/download ảnh vào dropdown action menu photo playlist")
     * — thêm nhánh thứ 3 'photo' -> exportImageFile() ngay trên (cùng công thức Video, ảnh không có
     * tag ID3 gì để ghi). `activeMediaSource` giờ đọc TRỰC TIẾP (3 giá trị hợp lệ song/video/photo
     * — xem loadPersistedPlaylistConfigOnBoot()), không còn ternary chỉ phân 2 nhánh video/song như
     * bản cũ (bản cũ gộp LUÔN 'photo' vào default 'song' — SAI, gọi nhầm exportSongWithTag() cho ảnh
     * nếu lỡ dropdown Photo có bấm được nút này trước khi được hiện đúng ở trên).
     */
    async exportActiveMenuItem() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        const mediaType = appState.get('activeMediaSource');
        if (mediaType === 'video') await this.exportVideoFile(key);
        else if (mediaType === 'photo') await this.exportImageFile(key);
        else await this.exportSongWithTag(key);
    },

    /**
     * MỚI (mục 1d, CHỐT 03/07/2026) — "Thêm vào thư mục" cho ĐÚNG 1 bài từ menu 3 chấm đơn lẻ.
     * Song song với openAddToFolderPicker() ở dưới (chọn nhiều) — KHÔNG gộp chung 1 method vì 2
     * message trigger khác nhau (đơn lẻ đọc `songActionMenuKey` trong playlistStore, chọn nhiều
     * đọc `selectedMediaKeys` trong appState) và cần đóng đúng menu tương ứng (songActionMenu vs
     * chế độ chọn nhiều) — viết chung sẽ phải rẽ nhánh theo "nguồn nào gọi tới", đúng thứ vi phạm
     * Rule 1 nếu đặt trong core, và không cần thiết ở tầng workflow (workflow không bị Rule 1 ràng
     * buộc, nhưng tách riêng vẫn rõ ràng hơn khi đọc). CẢ 2 giờ dùng CHUNG `_openFolderPickerDrawer()`
     * (grid Generic Drawer, xem MỚI 14/07/2026 bên dưới) — chỉ khác `onPick` callback.
     */
    /**
     * MỚI (10/07/2026) — "Sửa phụ đề" trong menu 3 chấm: đọc key bài đang mở menu, đóng menu, rồi
     * TÁI DÙNG `workflowSubtitleModal.navigateToEditor()` (miền KHÁC — "subtitleModal" — nhưng
     * CÙNG logic điều hướng với nút Sub ở Control Center, xem giải thích đầy đủ ở đó VÀ
     * readme/event-bus-flow.md) — Workflow gọi Workflow khác MIỀN tự do, không bị Rule 3 (rule đó
     * CHỈ áp cho Core).
     */
    openSubtitleEditorForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowSubtitleModal.navigateToEditor(key);
    },

    /**
     * "Sửa video" trong menu 3 chấm. SỬA (phản hồi Giang — dẹp tầng trung gian) — TRƯỚC ĐÂY gọi
     * `workflowFileManagerVideo.navigateToVideoEdit()` (hàm 1 dòng, chỉ relay tiếp sang
     * `workflowVideoPreview.open()`, KHÔNG làm gì thêm) — file `file-manager-video.js` đã xoá hẳn
     * (mọi logic thật của nó dời sang playlist.js/visualizer-control-center.js theo đúng người gọi
     * thật) nên gọi THẲNG `workflowVideoPreview.open()` ở đây, bỏ hẳn 1 tầng relay vô nghĩa.
     * XOÁ (phản hồi Giang — "bỏ luôn set background cho dropdown của video đi") —
     * `setActiveMenuVideoAsBackground()` (action "setAsBgVideo") đã bỏ hẳn cùng lúc với nút dropdown
     * tương ứng. TỰ AUDIT LẠI lúc xoá: `workflowFileManagerVideo.setVideoAsBackground()` tưởng còn
     * picker "Use background video" dùng — THỰC RA KHÔNG (picker tự inline logic riêng) — đã XOÁ
     * THẲNG hàm đó (0 lời gọi) cùng 2 lang key liên quan.
     */
    navigateToActiveMenuVideoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowVideoPreview.open(key); // event/workflow/video-preview.js
    },

    /** MỚI (Giang yêu cầu — "thêm dropdown edit image -> mở openImagePreview()") — mirror ĐÚNG
     * khuôn navigateToActiveMenuVideoEdit() ngay trên, đích đến khác: modal xem/sửa ảnh (zoom/
     * crop/rotate) đã có sẵn từ trước khi Photo được unified vào Playlist. */
    navigateToActiveMenuPhotoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowFileManagerPhoto.openImagePreview(key); // event/workflow/file-manager-photo.js
    },

    // XOÁ (06/10/2026, Giang yêu cầu "xoá action view thumb full res ở video playlist") — openActiveMenuVideoThumb()
    // (mở thumbFullBlob của video trong modal xem ảnh ở chế độ chỉ xem) bỏ hẳn cùng action.

    /** Lọc danh sách folder cho picker "Thêm vào thư mục" — MỚI (06/09/2026, hợp nhất Folder vào
     * Playlist, mục 2 + 4b). Loại 2 loại folder KHÔNG hợp lệ làm đích "thêm vào":
     *   - Folder ĐANG là Scope hiện tại của ĐÚNG Nguồn này — thêm vào chính folder đang xem không
     *     có ý nghĩa (bài đã hiển thị THÔNG QUA scope đó rồi).
     *   - Folder Read-only (mục 4b, Giang chốt "không cho add thêm item").
     * Pure — nhận `folders` (đã fetch qua `listFolders()`) qua tham số, không tự đọc DB (Rule 2).
     * @param {Array<{id:string, isReadOnly?:boolean}>} folders
     * @param {'song'|'video'|'photo'} mediaType
     * @returns {Array}
     */
    _filterFoldersForAddPicker(folders, mediaType) {
        const activeFolderId = appState.get('activePlayListFolder')[mediaType];
        return folders.filter((f) => f.id !== activeFolderId && !f.isReadOnly);
    },

    async openAddToFolderPickerForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();

        // SỬA (hợp nhất Photo vào Playlist) — `activeMediaSource` giờ LÀ ĐÚNG mediaType cần dùng
        // (3 giá trị hợp lệ duy nhất: song/video/photo — xem loadPersistedPlaylistConfigOnBoot()),
        // không cần ternary fallback nữa. TRUYỀN THÊM `options.folders` = danh sách ĐÃ LỌC theo ĐÚNG
        // type này (CHỐT Giang — "playlist source nào thì chỉ hiển thị type folder của source tương
        // ứng") — picker giờ KHÔNG còn hiện lẫn folder khác type (trước đây hiện TOÀN BỘ, chỉ báo
        // lỗi typeMismatch SAU KHI chọn nhầm — trải nghiệm kém).
        const mediaType = appState.get('activeMediaSource');
        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await this.addMediaToFolder([key], folderId, mediaType); // workflowPlaylist.addMediaToFolder() — SỬA 06/10/2026 (đọc folder_song rồi gọi core addSongsToFolder)
            });
            // XOÁ (hợp nhất Photo vào Playlist, cấu trúc folderIndex) — check `status==='typeMismatch'`
            // bỏ hẳn: addSongsToFolder() không còn trả trạng thái đó nữa (picker giờ CHỈ đưa vào
            // folder ĐÚNG type — không còn khả năng lệch để phải xử lý).
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — thêm bài
            // không đổi "folder nào đang active", chỉ đổi DỮ LIỆU trong nó. Lần tải trang kế tiếp
            // (hoặc lần bấm "Áp dụng" kế tiếp) sẽ tự đọc đúng danh sách mới — xem
            // event/workflow/playlist-scope.js.
            // SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — trước đây LUÔN
            // "Added X song(s)" kể cả khi vừa thêm Video. MỞ RỘNG (hợp nhất Photo) — thêm nhánh photo.
            await alertModal(tFormat(mediaType === 'video' ? 'fileManager.folderPicker.addSuccessVideo' : mediaType === 'photo' ? 'fileManager.folderPicker.addSuccessPhoto' : 'fileManager.folderPicker.addSuccess', { count: 1 }));
        }, { folders: this._filterFoldersForAddPicker(await listFolders(mediaType), mediaType) });
    },

    /**
     * "Thêm vào thư mục" (chọn nhiều) — cùng `_openFolderPickerDrawer()` với bản 1-bài ở trên, chỉ
     * khác `onPick` (nhiều key + thoát chế độ chọn).
     */
    async openAddToFolderPicker() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        // SỬA (hợp nhất Photo vào Playlist) — cùng lý do openAddToFolderPickerForSongMenu() ngay
        // trên: đọc thẳng activeMediaSource + lọc danh sách folder theo ĐÚNG type.
        const mediaType = appState.get('activeMediaSource');
        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await this.addMediaToFolder(keys, folderId, mediaType); // workflowPlaylist.addMediaToFolder() — SỬA 06/10/2026 (đọc folder_song rồi gọi core addSongsToFolder)
            });
            // XOÁ (hợp nhất Photo vào Playlist, cấu trúc folderIndex) — cùng lý do bản 1-bài phía
            // trên: check `status==='typeMismatch'` bỏ hẳn.
            // SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy — xem lý do
            // ở finishAdd() bản 1-bài phía trên (openAddToFolderPickerForSongMenu).
            this._exitSelectionMode();
            await alertModal(tFormat(mediaType === 'video' ? 'fileManager.folderPicker.addSuccessVideo' : mediaType === 'photo' ? 'fileManager.folderPicker.addSuccessPhoto' : 'fileManager.folderPicker.addSuccess', { count: keys.length }));
        }, { folders: this._filterFoldersForAddPicker(await listFolders(mediaType), mediaType) });
    },

    // ===================== Add to Folder — Generic Drawer grid (MỚI 14/07/2026) =====================
    // Trước đây: modal riêng (core/file-manager/folder-picker-ui.js::openFolderPickerModal() — ĐÃ
    // XOÁ HẲN 14/07/2026, không còn nơi gọi nào).
    // Giờ: Generic Drawer + grid folder (icon trên + tên dưới tối đa 2 dòng, xem
    // components/items.js::itemTemplateFolderTile()) + 1 tile "Tạo folder mới" cố định cuối grid
    // (buildAddFolderTileHtml()) — bấm vào tạo NGAY 1 folder tên tự động, vào thẳng chế độ sửa tên
    // (input, focus sẵn). Toàn bộ tương tác trong Drawer (tap chọn folder/tap tạo mới/sửa tên/đóng)
    // ĐỀU bắn qua eventBus (Rule 5a MỚI, readme/core-function-conventions.md — code MỚI viết từ
    // 13/07/2026 không còn ngoại lệ "gọi thẳng tham số" như modalChoice()).

    _folderPickerShowAddTile: true, // v13 — false khi nơi gọi không cho tạo folder mới giữa chừng
    _folderPickerEmptyMsg: '',      // v13 — câu hiển thị khi danh sách rỗng (rỗng = dùng grid trống như cũ)
    _folderPickerFolders: [], // danh sách folder ĐANG hiển thị trong grid — cache RAM, chỉ dùng lúc Drawer đang mở
    _folderPickerEditingId: null, // folderId đang ở chế độ sửa tên (null = không có)
    _folderPickerOnPick: null, // callback(folderId) HOẶC callback(folderIds[], type) nếu multiSelect — set bởi entry method, gọi khi user CHỌN xong
    // MỚI (29/08/2026) — 3 field cho chế độ multi-select (Visual Background "Thư mục" — gộp nhiều
    // folder). false/rỗng/null = hành vi CŨ y nguyên (2 luồng "Thêm vào thư mục" của Playlist tự
    // thân, tap 1 tile là chọn NGAY + đóng, không đổi gì).
    _folderPickerMultiSelect: false,
    _folderPickerSelectedIds: [], // ordered — thứ tự CHỌN, chỉ dùng khi multiSelect
    _folderPickerTypeOptions: null, // { current: 'video'|'photo' } | null — có giá trị -> hiện dropdown đổi loại trong header
    _folderPickerOnTypeChange: null, // callback(newType) — nơi gọi (Visual Background) tự lo re-fetch + gọi lại _openFolderPickerDrawer(isUpdate=true)

    /** Mở Drawer lần đầu (hoặc vẽ lại TẠI CHỖ nếu `isUpdate`) — đọc danh sách folder, vẽ grid, wire
     * sự kiện. */
    async _openFolderPickerDrawer(onPick, options, isUpdate) {
        // SỬA (v13) — thêm `options` TUỲ CHỌN (không truyền -> hành vi CŨ y nguyên cho 2 luồng
        // "Thêm vào thư mục" của Playlist):
        //   `folders`     — danh sách ĐÃ LỌC SẴN do nơi gọi chuẩn bị (Rule 3b: lọc là chuẩn bị dữ
        //                   liệu, thuộc Workflow gọi; hàm này không tự biết tiêu chí của từng miền).
        //   `showAddTile` — false để bỏ tile "Tạo folder mới" (Visual Background: folder vừa tạo
        //                   luôn rỗng nên không bao giờ là nguồn hợp lệ, bày ra chỉ gây hiểu nhầm).
        //   `emptyMsg`    — câu hiển thị khi danh sách rỗng, thay vì grid trống trơn.
        //   `onClose`     — MỚI (phản hồi Giang — sửa lỗ hổng "Cancel picker thư mục Visual
        //                   Background không tự quay lại") — hàm gọi THAY VÌ `closeFully()` khi
        //                   đóng picker (dù bấm X HAY vừa CHỌN xong — cả 2 đường đều đi qua
        //                   `closeFolderPicker()` bên dưới) — dùng bởi nơi gọi ĐANG SỐNG CHUNG
        //                   Generic Drawer với picker này (Visual Background, xem
        //                   event/workflow/visual-bg.js::_openFolderPickerForType()) để tự mở lại
        //                   đúng màn của mình thay vì đóng trắng cả Setting. KHÔNG truyền -> giữ
        //                   NGUYÊN hành vi cũ (đóng hẳn) cho 2 luồng Playlist tự thân.
        //   `multiSelect` — MỚI (29/08/2026) — true: tap tile TOGGLE chọn (không đóng ngay), header
        //                   thêm nút "Chọn (N)" xác nhận — `onPick` nhận `(folderIds[], type)` thay
        //                   vì `(folderId)`. false/không truyền -> hành vi CŨ (tap = chọn NGAY).
        //   `typeOptions` — MỚI (29/08/2026) — `{ current: 'video'|'photo' }`, có giá trị -> header
        //                   thêm dropdown đổi loại folder đang duyệt.
        //   `onTypeChange`— MỚI (29/08/2026) — callback(newType), bắt buộc nếu có `typeOptions` —
        //                   nơi gọi tự re-fetch folder đúng loại mới + gọi lại hàm NÀY (isUpdate=true).
        //   `selectedIds` — MỚI (29/08/2026) — khôi phục lựa chọn đang dở khi vẽ lại TẠI CHỖ (đổi
        //                   loại folder KHÔNG xoá lựa chọn cũ nếu id đó vẫn còn trong danh sách mới
        //                   — hiếm khi trùng giữa 2 loại khác nhau nên thực tế luôn rỗng, giữ tham số
        //                   để đúng nguyên tắc "Workflow chuẩn bị dữ liệu", không hardcode ở đây).
        // @param {boolean} [isUpdate] - true: vẽ lại TẠI CHỖ (`updateGenericDrawer()`, không đóng/mở
        //        lại) — dùng khi gọi lại từ chính picker đang mở (đổi loại/toggle chọn). Bỏ trống/
        //        false: mở MỚI (`openGenericDrawer()`, hành vi CŨ).
        const opts = options || {};
        this._folderPickerFolders = opts.folders || await listFolders(); // core có sẵn, CÓ return, DÙNG ngay dưới
        this._folderPickerShowAddTile = opts.showAddTile !== false;
        this._folderPickerEmptyMsg = opts.emptyMsg || '';
        this._folderPickerEditingId = null;
        this._folderPickerOnPick = onPick;
        this._folderPickerOnClose = opts.onClose || null;
        this._folderPickerMultiSelect = !!opts.multiSelect;
        this._folderPickerSelectedIds = opts.multiSelect ? (opts.selectedIds || []) : [];
        this._folderPickerTypeOptions = opts.typeOptions || null;
        this._folderPickerOnTypeChange = opts.onTypeChange || null;
        this._renderFolderPickerGrid(!isUpdate, true); // SỬA (24/09/2026) — mở/đổi loại = danh sách mới -> từ đầu
    },

    /** Vẽ lại grid (mở lần đầu HOẶC sau khi thêm/sửa tên 1 folder, toggle chọn, đổi loại) —
     * `isFirstOpen` quyết định open vs update Generic Drawer (core/generic-drawer.js — 2 hàm khác
     * nhau tuỳ Drawer đang đóng hay đã mở sẵn, xem docstring ở đó).
     * @param {boolean} isFirstOpen
     * @param {boolean} [scrollReset] - MỚI (24/09/2026) — true = danh sách mới (mở/đổi loại) -> cuộn từ đầu; mặc định
     *        false = vẽ lại tại chỗ -> giữ vị trí cuộn. */
    _renderFolderPickerGrid(isFirstOpen, scrollReset = false) {
        // MỚI (29/08/2026) — `selectedOrder`: Map<folderId, order> cho multiSelect, đọc bởi
        // `itemTemplateFolderTile()` (components/items.js) để vẽ badge số thứ tự — null khi không
        // multiSelect (hành vi CŨ, không badge nào).
        const selectedOrder = this._folderPickerMultiSelect ? new Map(this._folderPickerSelectedIds.map((id, i) => [id, i + 1])) : null;
        const itemsHtml = renderItemList(null, this._folderPickerFolders, itemTemplateFolderTile, { editingFolderId: this._folderPickerEditingId, selectedOrder }); // components/items.js
        // SỬA (14/07/2026, Giang yêu cầu) — justify-center -> justify-start (căn trái thay vì căn
        // giữa cả cụm khi hàng cuối chưa đầy).
        // SỬA THÊM (06/09/2026, Giang chỉ ra bug tiếp — hàng ĐẦY vẫn dồn trái, thừa khoảng trống
        // bên phải) — `justify-start` KHÔNG giải quyết được cùng lúc "hàng đầy giãn đều" VÀ "hàng
        // cuối lẻ căn trái", đổi hẳn sang `buildFolderGridWrapperHtml()` (components/items.js, CSS
        // Grid `auto-fill`/`minmax` — xem docstring ở đó cho lý do đầy đủ).
        const addTileHtml = this._folderPickerShowAddTile ? buildAddFolderTileHtml() : ''; // components/items.js
        const bodyHtml = (this._folderPickerFolders.length === 0 && !this._folderPickerShowAddTile && this._folderPickerEmptyMsg)
            ? `<p class="text-sm text-center py-10 px-6" data-uitk="textSecondary">${this._folderPickerEmptyMsg}</p>`
            : buildFolderGridWrapperHtml(`${itemsHtml}${addTileHtml}`); // components/items.js
        const config = {
            // MỚI (24/09/2026, Giang báo "vẽ lại panel mất scroll cũ") — vẽ lại TẠI CHỖ (toggle chọn/thêm/sửa tên
            // folder) giữ vị trí cuộn; mở mới/đổi loại (`scrollReset`) từ đầu — core/generic-drawer.js.
            scrollKey: 'playlist:folderPicker',
            scrollReset,
            // SỬA (14/07/2026, Giang báo — "layout grid thừa khoảng trống") — TRƯỚC ĐÂY height cố
            // định '60vh' bất kể có bao nhiêu folder, để lại khoảng trống lớn phía dưới khi chỉ có
            // vài tile. Giờ height:'auto' (panel tự co theo ĐÚNG nội dung thật) + maxHeight:'60vh'
            // (không bao giờ vượt quá, nội dung dài tự cuộn nhờ bodyClass overflow-y-auto có sẵn) —
            // xem docstring core/generic-drawer.js::openGenericDrawer(). Test thật bằng Chromium
            // xác nhận: ít item -> panel co nhỏ đúng theo nội dung; nhiều item -> kẹp đúng ở maxHeight.
            height: 'auto',
            maxHeight: '60vh',
            // SỬA (14/07/2026) — BỎ `zIndex: 40` cứng (thấp hơn #app-stack z-[60], gây Drawer bị đè
            // khi mở từ Playlist) — rơi về GENERIC_DRAWER_DEFAULT_Z_INDEX (128) mặc định, xem
            // docstring core/generic-drawer.js.
            headerHtml: this._buildFolderPickerHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        };
        if (isFirstOpen) workflowGenericDrawerHelpers.open(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        else workflowGenericDrawerHelpers.update(config); // event/workflow/generic-drawer-helpers.js (nhớ cuộn theo scrollKey) -> core/generic-drawer.js
        wireFolderPickerDrawerEvents('playlist', 'playlist.folderPicker'); // core/file-manager/folder-picker-ui.js — hàm GỘP (v13 Batch B), msg.type KHÔNG đổi
    },

    /** MỚI (29/08/2026) — thêm dropdown đổi loại (`typeOptions`) + nút "Chọn (N)" xác nhận
     * (`multiSelect`) vào header CŨ — CẢ 2 đều tuỳ chọn, không truyền gì -> header y hệt trước
     * (2 luồng "Thêm vào thư mục" của Playlist không đụng gì). */
    _buildFolderPickerHeaderHtml() {
        const typeDropdownHtml = this._folderPickerTypeOptions ? `
            <select id="playlist-folder-picker-type" class="rounded-lg px-2 py-1 text-xs outline-none" data-uitk="inputBg inputBorder inputText">
                <option value="video" ${this._folderPickerTypeOptions.current === 'video' ? 'selected' : ''}>${t('visualBgSettingsDrawer.folderPicker.typeVideo')}</option>
                <option value="photo" ${this._folderPickerTypeOptions.current === 'photo' ? 'selected' : ''}>${t('visualBgSettingsDrawer.folderPicker.typePhoto')}</option>
            </select>` : '';
        const confirmCount = this._folderPickerSelectedIds.length;
        const confirmBtnHtml = this._folderPickerMultiSelect ? `
            <button type="button" id="playlist-folder-picker-confirm" class="text-xs font-semibold px-1 disabled:opacity-40 disabled:cursor-not-allowed" data-uitk="accentText" ${confirmCount === 0 ? 'disabled' : ''}>${confirmCount === 0 ? t('visualBgSettingsDrawer.picker.confirmEmpty') : tFormat('visualBgSettingsDrawer.picker.confirm', { count: confirmCount })}</button>` : '';
        return `
            <div class="flex justify-between items-center px-5 pb-3 gap-2" data-uitk="headerBorder">
                <h3 class="text-base font-bold shrink-0" data-uitk="headerTitle">${t('fileManager.folderPicker.title')}</h3>
                <div class="flex items-center gap-2 shrink-0">
                    ${typeDropdownHtml}
                    ${confirmBtnHtml}
                    <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        `;
    },

    /** msg.type = 'playlist.folderPicker.tile.click'. SỬA (29/08/2026) — nhánh multiSelect: TOGGLE
     * chọn + vẽ lại grid TẠI CHỖ (số thứ tự/nút "Chọn" cập nhật theo), KHÔNG đóng picker. Nhánh
     * mặc định (2 luồng Playlist) giữ NGUYÊN — tap = chọn NGAY + đóng. */
    async pickFolderInPicker(folderId) {
        if (this._folderPickerMultiSelect) {
            const idx = this._folderPickerSelectedIds.indexOf(folderId);
            if (idx >= 0) this._folderPickerSelectedIds.splice(idx, 1); else this._folderPickerSelectedIds.push(folderId);
            this._renderFolderPickerGrid(false);
            return;
        }
        const onPick = this._folderPickerOnPick;
        this.closeFolderPicker();
        if (onPick) await onPick(folderId);
    },

    /** MỚI (29/08/2026) — msg.type = 'playlist.folderPicker.confirm.click' (chỉ hiện khi
     * multiSelect). Commit `_folderPickerSelectedIds` (đúng thứ tự chọn) + `type` đang duyệt. */
    async confirmFolderPickerSelection() {
        if (!this._folderPickerMultiSelect || this._folderPickerSelectedIds.length === 0) return; // guard — nút đã disabled, phòng thủ kép
        const onPick = this._folderPickerOnPick;
        const ids = this._folderPickerSelectedIds.slice();
        const type = this._folderPickerTypeOptions ? this._folderPickerTypeOptions.current : null;
        this.closeFolderPicker();
        if (onPick) await onPick(ids, type);
    },

    /** MỚI (29/08/2026) — msg.type = 'playlist.folderPicker.typeChange' (dropdown header, chỉ hiện
     * khi có `typeOptions`). KHÔNG tự re-fetch ở đây — giao lại cho `onTypeChange` (nơi gọi biết
     * đúng tiêu chí lọc của miền mình, Rule 3b) — hàm này chỉ relay. */
    async changeFolderPickerType(value) {
        const cb = this._folderPickerOnTypeChange;
        if (!cb) return;
        await cb(value);
    },

    /** msg.type = 'playlist.folderPicker.close.click'. SỬA (phản hồi Giang — sửa lỗ hổng picker
     * thư mục Visual Background) — ưu tiên `onClose` nếu nơi mở picker có truyền (xem docstring
     * `_openFolderPickerDrawer()`), mặc định vẫn đóng hẳn như cũ. */
    closeFolderPicker() {
        this._folderPickerOnPick = null;
        const onClose = this._folderPickerOnClose;
        this._folderPickerOnClose = null;
        this._folderPickerMultiSelect = false;
        this._folderPickerSelectedIds = [];
        this._folderPickerTypeOptions = null;
        this._folderPickerOnTypeChange = null;
        if (onClose) onClose(); else workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** msg.type = 'playlist.folderPicker.addTile.click' — tạo NGAY 1 folder tên tự động (không
     * trùng tên bất kỳ folder CÙNG TYPE nào đang có trong grid), thêm vào cache RAM, vẽ lại grid
     * với tile MỚI ở chế độ sửa tên (focus sẵn, xem _wireFolderPickerEvents()). KHÔNG tự "chọn"
     * folder này luôn — user vẫn cần tap vào tile (sau khi sửa tên xong) như MỌI tile khác để hoàn
     * tất việc chọn, giữ đúng 1 mô hình tương tác duy nhất cho toàn bộ grid (tạo ≠ chọn, tách 2
     * hành động RÕ RÀNG).
     * CHỐT Giang (hợp nhất Photo vào Playlist) — "Playlist source nào -> tạo folder và gán luôn
     * type cho nó": type gán NGAY = `activeMediaSource` hiện tại (đọc thẳng, không cần biết context
     * nào gọi tới — hàm này CHỈ reachable từ 2 luồng Add-to-Folder gốc của Playlist, picker Visual
     * Background dùng `showAddTile: false` nên tile "+" không hề xuất hiện ở đó, xem
     * event/workflow/visual-bg.js::_openFolderPickerForType()).
     */
    async createFolderInPicker() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = this._computeDefaultFolderName();
        // SỬA (14/07/2026, tự audit lại Rule 3) — createFolder() đổi chữ ký, không còn tự
        // resolveFolderId() nội bộ, xem docstring createFolder() (core/file-manager/folder.js).
        const folderId = await resolveFolderId(defaultName, mediaType); // core
        const result = await createFolder(folderId, defaultName, mediaType); // core có sẵn (core/file-manager/folder.js)
        if (result.status !== 'ok') return; // hiếm — trùng tên dù đã tự tính tên không trùng (race hiếm gặp), im lặng bỏ qua
        this._folderPickerFolders.push({ id: result.folderId, name: defaultName, type: mediaType });
        this._folderPickerEditingId = result.folderId;
        this._renderFolderPickerGrid(false);
    },

    /** Tính tên mặc định KHÔNG trùng bất kỳ folder nào đang hiển thị trong grid — "Thư mục mới",
     * "Thư mục mới 2", "Thư mục mới 3"... */
    _computeDefaultFolderName() {
        const base = t('fileManager.folderPicker.defaultNewFolderName');
        const existingNames = new Set(this._folderPickerFolders.map((f) => f.name));
        if (!existingNames.has(base)) return base;
        let n = 2;
        while (existingNames.has(`${base} ${n}`)) n++;
        return `${base} ${n}`;
    },

    /** msg.type = 'playlist.folderPicker.rename.commit' — blur/Enter của ô sửa tên. Tên rỗng hoặc
     * giữ nguyên tên tự động -> bỏ qua (KHÔNG gọi renameFolder() vô ích), chỉ thoát chế độ sửa. */
    async commitFolderPickerRename(folderId, name) {
        this._folderPickerEditingId = null;
        const trimmed = (name || '').trim();
        const folder = this._folderPickerFolders.find((f) => f.id === folderId);
        if (trimmed && folder && trimmed !== folder.name) {
            const result = await renameFolder(folderId, trimmed); // core có sẵn
            if (result.status === 'ok') folder.name = trimmed;
            // 'duplicateName' (hiếm — user tự gõ trùng tên folder khác) -> im lặng giữ tên cũ,
            // không alertModal giữa lúc đang thao tác nhanh (khác hẳn form Sửa tên đầy đủ ở
            // Settings -> File Manager -> Song, nơi đó VẪN báo lỗi rõ ràng).
        }
        this._renderFolderPickerGrid(false);
    },

    /**
     * "Xoá hàng loạt" — ĐÚNG luồng bác chốt (câu 4 mục 6 plan): nếu bài đang phát nằm trong tập bị
     * xoá, ép DỪNG phát + về UI Playlist NGAY (không hỏi/không chặn, khác hẳn `deleteMediaFromActionMenu()`
     * đơn lẻ vốn chặn xoá nếu đang thực sự phát) -> bật shield -> xoá -> tắt shield -> modal "đã xoá".
     * SỬA (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — media-aware: chọn
     * nhiều CHỈ xảy ra trong ĐÚNG 1 nguồn tại 1 thời điểm (Playlist chỉ browse 1 nguồn) nên đọc
     * `activeMediaSource` MỘT LẦN cho CẢ LÔ, không cần kiểm tra từng key. TRƯỚC ĐÂY hardcode
     * getSongRecord/deleteSongRecord — Video sẽ ÂM THẦM không xoá được gì (record nằm store khác).
     * ĐỔI TÊN (07/09/2026, cùng lý do `deleteSongFromActionMenu` -> `deleteMediaFromActionMenu`) —
     * hàm này CŨNG xử lý cả Video/Photo từ Batch 6, tên cũ `deleteSelectedSongs` gây hiểu lầm y hệt.
     * SỬA TIẾP (07/09/2026, "xử lý luôn") — `appState.selectedSongKeys` CŨNG đổi tên thành
     * `selectedMediaKeys` (service/state/file-manager.js, cùng `selectSong()`/`deselectSong()` ->
     * `selectMedia()`/`deselectMedia()`, core/playlist/selection.js) — cùng lý do, xử lý triệt để
     * thay vì để dở dang.
     */
    async deleteSelectedMedia() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;
        const mediaType = appState.get('activeMediaSource'); // 'song'|'video'|'photo'
        const isVideo = mediaType === 'video';

        const currentKey = appState.get('currentKey');
        const wasPlayingSelected = currentKey != null && keys.includes(currentKey);

        if (wasPlayingSelected) {
            if (isVideo) {
                // Dừng player Video + dọn RAM — dùng ĐÚNG hàm có sẵn (event/workflow/video-
                // player.js), tránh tự inline lại logic cần _objectUrl riêng của Workflow đó.
                if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode();
                appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js — SỬA 24/09/2026
            } else {
                // Dừng player + dọn RAM — GIỐNG HỆT khối tương ứng trong deleteMediaFromActionMenu() (đơn lẻ)/
                // clearAllStoredData() (storage-manager.js) khi currentKey biến mất, để không còn
                // currentKey "ma". Khác 2 nơi đó: KHÔNG kiểm tra audioPlayer.paused — ép dừng vô điều
                // kiện, đúng ý bác (không chặn/không hỏi, chỉ dừng rồi xoá).
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js (dời từ core 25/09/2026)
                workflowPlayerControls.returnToPlaylistUI(); // "về playui" — ép UI về màn Playlist ngay, TRƯỚC khi hiện shield (SỬA 24/09/2026 — thay core forceBackToPlaylistUI())
                setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa
            }
        }

        let deletedCount = 0;
        await withLoadingShield(t('common.loading.deleting'), async () => {
            // Vòng lặp xoá ĐẶT THẲNG ở đây (workflow), KHÔNG bọc qua 1 lớp "core" giả — mỗi bước
            // (đọc record, cascade folder, xoá record, xoá stat) là 1 hàm core void nối tiếp nhau,
            // đúng vai trò workflow (Rule 3: core không được làm việc này, workflow thì được).
            // XOÁ (v14) — `splitVisualBgProtectedKeys()`/chặn video đang làm Visual Background:
            // nguồn giờ là 1 mảng key riêng của workflowVisualBg (đã copy tách khỏi Playlist), xoá
            // video gốc ở đây không cần biết gì tới nó — lần advance()/apply() kế tiếp bên đó tự
            // phát hiện record mất + tự chữa lành.
            // MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh 'photo' (store `images`) — trước
            // đây thiếu nhánh này sẽ khiến deleteSongRecord() gọi nhầm lên key không tồn tại trong
            // store `songs`, âm thầm KHÔNG xoá được gì.
            // SỬA (07/09/2026) — tra bảng `MEDIA_DELETE_ACCESSOR` (đầu file) 1 LẦN trước vòng lặp
            // (mediaType KHÔNG đổi trong suốt lô, = activeMediaSource) thay vì lặp lại ternary bên
            // trong `for` — rẻ hơn, cùng registry dùng ở `deleteMediaFromActionMenu()`.
            const { getRecord, deleteRecord } = MEDIA_DELETE_ACCESSOR[mediaType];
            const deletedKeys = [];
            for (const key of keys) {
                const record = await getRecord(key);
                if (!record) continue; // guard: đã bị xoá từ trước (hiếm, race) — bỏ qua, không chặn cả lô
                await removeSongFromAllFolders(record); // core có sẵn (core/file-manager/folder.js) — nhận record THÔ qua tham số, generic cho cả Song/Video/Photo
                await deleteRecord(key);
                workflowListenStats.forget(mediaType, key); // event/workflow/listen-stats.js (SỬA 06/10/2026: đúng loại)
                deletedKeys.push(key);
            }
            deletedCount = deletedKeys.length;

            // Đồng bộ appState (core THUẦN, xem core/playlist/bulk-actions.js) rồi vẽ lại — đọc
            // playlistOrder/displayOrder hiện tại TRƯỚC khi gọi (Rule 2: core không tự đọc).
            removeKeysFromDisplayState(deletedKeys, appState.get('playlistOrder'), appState.get('displayOrder'));
            // SỬA (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ") — updateShuffleArray()/
            // recomputeRenderOrder() ĐÃ DỜI hẳn sang event/workflow/playlist-order.js
            // (workflowPlaylistOrder) — gọi trực tiếp, tự đọc playlistOrder MỚI (đã gỡ deletedKeys
            // ở removeKeysFromDisplayState() trên) qua appState, không cần truyền tham số nữa.
            workflowPlaylistOrder.updateShuffleArray();
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js (dời từ core/playlist/render.js)
            workflowPlaylistRender.syncEmptyState(); // SỬA (02/10/2026) — thay core updateEmptyState() // event/workflow/playlist-render.js (dời từ core/playlist/render.js)
        });

        this._exitSelectionMode();
        // Shield đã đóng HẲN tới đây — an toàn để hiện modal.
        await alertModal(tFormat('playlistView.selection.deleteSuccess', { count: deletedCount }));
    },

    /**
     * "Gỡ khỏi thư mục" — Selection mode, MỚI (06/09/2026, hợp nhất Folder vào Playlist, Batch 5).
     * KHÁC hẳn `deleteSelectedMedia()` ngay trên: KHÔNG đụng bản ghi gốc/thư viện, chỉ gỡ khỏi
     * DANH SÁCH của folder đang Scope — dùng `removeSongsFromFolder()` (core/file-manager/
     * folder.js, bulk-subset, MỚI cùng đợt) rồi splice các key đó khỏi `playlistOrder`/
     * `displayOrder` đang hiển thị (CÙNG khuôn `removeKeysFromDisplayState()`,
     * core/playlist/bulk-actions.js, TÁI DÙNG NGUYÊN — bản chất đều là "gỡ N key khỏi danh sách
     * đang hiển thị", không cần viết hàm core mới). Chỉ hiện được trong menu khi đang Scope 1
     * folder (xem event/router/playlist.js, case 'playlist.selection.moreMenu.open'), nên
     * `folderId` ở đây LUÔN có giá trị — không cần guard `!folderId`.
     * Folder trống hẳn sau khi gỡ (gỡ hết mọi item còn lại) -> tự thoát Scope NGAY (áp sống, cùng
     * chủ trương `removeItem()`/`confirmRemoveAllItems()` bản Read cũ đã bỏ — hành vi giữ nguyên,
     * chỉ đổi nơi gọi).
     */
    async removeSelectedSongsFromFolder() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;
        const mediaType = appState.get('activeMediaSource');
        const folderId = appState.get('activePlayListFolder')[mediaType];
        if (!folderId) return; // guard hiếm: nút lẽ ra đã ẩn nếu không có Scope, phòng vệ thêm
        // MỚI (06/09/2026, hợp nhất Folder vào Playlist, mục 4b — "Read-only") — folder đang active
        // Read-only thì không cho gỡ item — nút lẽ ra đã ẩn (xem event/router/playlist.js, case
        // 'playlist.selection.moreMenu.open'), guard này là lớp phòng vệ thứ 2.
        if (appState.get('isActiveFolderReadOnly')) return;

        await withLoadingShield(t('common.loading.generic'), async () => {
            await removeSongsFromFolder(keys, folderId, mediaType); // core/file-manager/folder.js
            removeKeysFromDisplayState(keys, appState.get('playlistOrder'), appState.get('displayOrder')); // core/playlist/bulk-actions.js
            workflowPlaylistOrder.updateShuffleArray();
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff();
            workflowPlaylistRender.syncEmptyState(); // SỬA (02/10/2026) — thay core updateEmptyState()

            const folderMap = await getFolderSongMap(folderId); // service/db.js
            if (isFolderEmpty(folderMap)) { // core/file-manager/folder.js
                await workflowPlaylistScope.persistScopeChoice(null, mediaType);
                await workflowPlaylistScope.applyAllSongsScope(mediaType);
            }
        });

        this._exitSelectionMode();
    },

    /** "Gỡ khỏi thư mục" — 1 item lẻ qua menu 3-chấm (khác hẳn bản Selection mode ngay trên: 1 key
     * thay vì mảng đã chọn, không cần `_exitSelectionMode()`). MỚI (06/09/2026, hợp nhất Folder vào
     * Playlist) — CÙNG ý nghĩa/CÙNG guard Read-only (mục 4b) với `removeSelectedSongsFromFolder()}`
     * ngay trên — không đụng bản ghi gốc/thư viện, chỉ gỡ khỏi DANH SÁCH của folder đang Scope.
     * @param {string} songKey
     */
    async removeSongFromFolderMenu(songKey) {
        workflowPlaylist.closeActionMenu(); // core/playlist/actions.js — SỬA (09/09/2026, cùng đợt nối dây lại action này) — mọi hành động khác từ menu 3-chấm đều tự đóng menu trước khi chạy (xem deleteMediaFromActionMenu() ngay trên), hàm này thiếu luôn từ đầu
        const mediaType = appState.get('activeMediaSource');
        const folderId = appState.get('activePlayListFolder')[mediaType];
        if (!folderId) return; // guard hiếm — cùng lý do removeSelectedSongsFromFolder()
        if (appState.get('isActiveFolderReadOnly')) return; // guard: Read-only (mục 4b) — nút lẽ ra đã ẩn, phòng vệ thêm

        await withLoadingShield(t('common.loading.generic'), async () => {
            await removeSongFromFolder(songKey, folderId, mediaType); // core/file-manager/folder.js
            removeKeysFromDisplayState([songKey], appState.get('playlistOrder'), appState.get('displayOrder')); // core/playlist/bulk-actions.js
            workflowPlaylistOrder.updateShuffleArray();
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff();
            workflowPlaylistRender.syncEmptyState(); // SỬA (02/10/2026) — thay core updateEmptyState()

            const folderMap = await getFolderSongMap(folderId); // service/db.js
            if (isFolderEmpty(folderMap)) { // core/file-manager/folder.js
                await workflowPlaylistScope.persistScopeChoice(null, mediaType);
                await workflowPlaylistScope.applyAllSongsScope(mediaType);
            }
        });
    },

    // ===================== Ver 12 "Song/Video Unification" — Batch 1 (mục 1-2); GỘP 07/09/2026 =====================
    // Ứng với select "Nguồn" ở Settings → Playlist đổi giá trị (event/router/playlist.js gọi thẳng
    // `switchSource(source)`, KHÔNG cần VMState chọn hàm nữa — xem docstring dưới).

    /**
     * Đổi Nguồn Playlist (Song/Video/Photo) — GỘP (07/09/2026) từ 3 hàm switchToSongSource()/
     * switchToVideoSource()/switchToPhotoSource() cũ, vốn giống hệt nhau ngoài 2 i18n key
     * (`MEDIA_SWITCH_I18N`). Luồng: exit selection mode -> set activeMediaSource -> trong 1
     * `withLoadingShield()`: `applyFolderScope()`/`applyAllSongsScope()` (event/workflow/
     * playlist-scope.js) tự lo HẾT — nạp cache ĐÚNG phạm vi (folder đang nhớ cho Nguồn này nếu có)
     * + Filter + render 1 LẦN DUY NHẤT — rồi cuộn tới media đang phát nếu có trong Nguồn mới, không thì về đầu
     * (workflowPlaylistRender.scrollToCurrentOrTop(), SỬA 02/10/2026); ngoài shield: đổi search
     * placeholder + upload accept + hiện 2 nút Play/Shuffle + lưu bền Nguồn.
     * KHÔNG reset `displaySortMode` — sort mode là 1 lựa chọn CHUNG, độc lập Nguồn (Giang chốt
     * "dùng chung hết" 4 kiểu sort az/za/newest/oldest cho cả 3).
     * @param {'song'|'video'|'photo'} mediaType
     */
    async switchSource(mediaType) {
        // FIX (Giang báo — "đổi Source khi đang Multi-select không clear selection") — selection
        // không phụ thuộc Nguồn, chỉ clear khi tắt Selection Mode; 2 Nguồn có key trùng slug
        // filename (Exclude collision, core/file-manager/folder.js::getExcludedSongKeysFromFolders())
        // có thể khiến Xoá/Phát hàng loạt nhắm nhầm record — thoát Selection Mode NGAY khi đổi Nguồn.
        this._exitSelectionMode();

        // FIX (10/09/2026, Giang báo bug "chuyển qua lại giữa các playlist bị thừa icon 'đang
        // phát'") — CÙNG gốc key-trùng-slug-filename đã ghi nhận ở comment trên (Song/Video/Photo
        // SINH KEY THEO CÙNG kiểu slug filename dù 3 namespace DB khác nhau): renderPlaylistDiff()
        // (event/workflow/playlist-render.js) coi 1 key "vẫn còn trong playlistOrder MỚI" là CHỈ
        // ẨN/HIỆN LẠI node DOM CŨ (tái dùng nguyên, KHÔNG buildSongNode() lại) — ĐÚNG ý đồ thiết kế
        // cho tình huống nó viết ra (gõ rồi xoá ô tìm kiếm, CÙNG 1 Nguồn) nhưng SAI khi đổi HẲN
        // Nguồn: nếu 1 Video/Photo tình cờ trùng key (trùng tên file) với Song đang chiếm dòng đó
        // trong domNodesByKey, node CŨ (đã build lúc còn là Song — có thể đang mang icon "đang
        // phát" nếu Song đó chính là currentKey) bị giữ nguyên hiện lại CHO Video/Photo hoàn toàn
        // khác, không hề gọi lại buildSongNode() để tính lại đúng nội dung/trạng thái. Dọn hẳn
        // domNodesByKey NGAY khi Nguồn thật sự đổi — kích hoạt đúng lưới an toàn có sẵn của
        // renderPlaylistDiff() (playlistContainer.children.length lệch domNodesByKey.size -> tự
        // renderPlaylistFull() dựng lại HOÀN TOÀN MỚI mọi node), loại bỏ hẳn rủi ro tái dùng nhầm.
        // KHÔNG áp dụng khi mediaType KHÔNG đổi (vd bấm lại đúng Nguồn đang xem) — giữ nguyên tối
        // ưu diff cho các lượt gọi applyFolderScope()/applyAllSongsScope() khác (tap folder, upload-
        // refresh...) vốn không đổi Nguồn nên không có rủi ro trùng key này.
        this._dropDomNodesIfSourceChanged(mediaType); // SỬA (02/10/2026, rà event-bus-flow.md mục 7) — bước tuỳ chọn -> method mở đầu bằng guard

        appState.set('activeMediaSource', mediaType);
        console.log(`writer: "switchSource", page: "activeMediaSource", content: "${mediaType}"`);

        const i18n = MEDIA_SWITCH_I18N[mediaType];
        await withLoadingShield(t('playlistView.loading.generic'), async () => {
            const folderForThisSource = appState.get('activePlayListFolder')[mediaType];
            const onProgress = (done, total) => { loadingText.textContent = tFormat(i18n.loadingKey, { done, total }); };
            await SOURCE_SCOPE_APPLY_BY_HAS_FOLDER[!!folderForThisSource](folderForThisSource, mediaType, onProgress); // SỬA (02/10/2026, mục 7) — if/else -> object map
            // SỬA (02/10/2026, Giang yêu cầu "current video -> đổi Nguồn Photo -> về lại Video -> phải về current") — trước
            // đây LUÔN resetPlaylistScrollTop() (về 0). Giờ theo quy tắc A: Nguồn mới có media đang phát -> tới thẳng nó
            // (tức thì); không có -> về 0 như cũ.
            workflowPlaylistRender.scrollToCurrentOrTop(); // event/workflow/playlist-render.js
        });
        if (playlistSearchInput) playlistSearchInput.placeholder = t(i18n.placeholderKey);
        this._applyUploadInputAccept(mediaType); // "1 khung, không nhân bản" — nút upload dùng chung cho cả 3 Nguồn, chỉ đổi accept
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this._persistPlaylistConfig(); // lưu bền Nguồn để không mất sau reload
    },
    /** Tách từ switchSource() (02/10/2026, event-bus-flow.md mục 7 — bước tuỳ chọn) — Nguồn THẬT SỰ đổi thì dọn hẳn
     * domNodesByKey (lý do: xem comment FIX 10/09/2026 trong switchSource()); bấm lại đúng Nguồn đang xem thì giữ nguyên.
     * @param {'song'|'video'|'photo'} mediaType */
    _dropDomNodesIfSourceChanged(mediaType) {
        if (mediaType === appState.get('activeMediaSource')) return; // guard — Nguồn không đổi
        appState.get('domNodesByKey').forEach(revokeNodeCoverUrl); // core/playlist/render.js
        appState.mutate('domNodesByKey', m => m.clear());
        console.log(`writer: "workflowPlaylist._dropDomNodesIfSourceChanged", page: "domNodesByKey", content: "clear (đổi Nguồn sang ${mediaType})"`);
    },


    /**
     * "Sắp xếp" đổi giá trị (Settings → Playlist) — MỚI, tách khỏi router (phản hồi Giang, mục 5
     * "Đồng bộ lại config Playlist Settings"): trước đây router gọi thẳng `setDisplaySortMode()`
     * (đúng "1 hàm core" theo quy ước router này) — giờ cần thêm bước lưu bền
     * (`_persistPlaylistConfig()`), thành ≥2 bước -> đúng quy ước router "giao cho Workflow" (xem
     * docstring đầu event/router/playlist.js).
     */
    async changeSortMode(mode) {
        workflowPlaylistOrder.setDisplaySortMode(mode); // event/workflow/playlist-order.js (dời từ core/playlist/order.js, Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ")
        await this._persistPlaylistConfig();
    },

    /** Trục (2) — field thống kê (mục 1b/1c, panel "Sắp xếp", dropdown (1)) — SỬA (mục 3) tách
     * khỏi hướng. CÙNG LÝ DO tách khỏi router như changeSortMode() ngay trên. */
    async changeStatSortField(field) {
        workflowPlaylistOrder.setDisplayStatSortField(field); // event/workflow/playlist-order.js (dời từ core/playlist/order.js)
        // MỚI (mục 3) — hiện/ẩn dropdown (2) "hướng" NGAY khi đổi field — CHỈ có ý nghĩa khi field
        // khác 'none'. SỬA (đợt tái cấu trúc bottom nav App Panel) — panel Sắp xếp giờ sống trong
        // `genericDrawerBody` (core/generic-drawer.js), KHÔNG còn qua `peekTopSettingsPanel()`
        // (đó là stack CŨ, nay thuộc về Photo — xem event/workflow/app-settings.js).
        {
            const directionRow = genericDrawerBody.querySelector('[data-sort-direction-row]');
            if (directionRow) directionRow.classList.toggle('hidden', field === 'none');
        }
        await this._persistPlaylistConfig();
    },

    /** Trục (2) — hướng (mục 3, phản hồi Giang, dropdown (2), CHỈ hiện khi field khác 'none'). */
    async changeStatSortDirection(direction) {
        workflowPlaylistOrder.setDisplayStatSortDirection(direction); // event/workflow/playlist-order.js (dời từ core/playlist/order.js)
        await this._persistPlaylistConfig();
    },

    /**
     * "Kiểu xem" đổi giá trị (Settings → Playlist) — CÙNG LÝ DO tách khỏi router như changeSortMode() ngay trên.
     * SỬA (05/08/2026, Rule 3a, phản hồi Giang "xử lý triệt để") — `setPlaylistViewMode()` (core/
     * playlist/main.js) KHÔNG còn tự gọi `renderPlaylistFull()` nội bộ (core gọi core, cấm) — 2
     * lời gọi core độc lập này giờ đứng CẠNH NHAU ở đây, đúng vai Workflow điều phối.
     */
    async changeViewMode(mode) {
        setPlaylistViewMode(mode); // core (core/playlist/main.js) — chỉ ghi isGridView + className
        applySelectionChrome(appState.get('selectionMode')); // MỚI (02/10/2026) — className vừa bị gán lại, mất class `is-selecting` (vòng tròn chọn CSS) nếu đang chọn
        workflowPlaylistRender.renderPlaylistFull(); // event/workflow/playlist-render.js (dời từ core/playlist/render.js) — layout grid/list đổi cấu trúc node hoàn toàn, không diff được
        await this._persistPlaylistConfig();
    },

    /**
     * Ghi bền 3 lựa chọn "Playlist Settings" (Nguồn/Sắp xếp/Kiểu xem) vào `appConfigPlaylist` +
     * `meta.playlistConfig` (IndexedDB) — CÙNG KHUÔN domain 'slideshow' (event/workflow/
     * slideshow.js, setMeta trực tiếp mỗi lần đổi, KHÔNG debounce như domain 'viz' vì tần suất đổi
     * thấp). CHỦ Ý KHÔNG gồm 3 field "Giải phóng bộ nhớ" (mediaScope/downloadEnabled/deleteEnabled,
     * event/router/file-manager-song.js) — xem giải thích đầy đủ ở core/config.js::
     * DEFAULT_PLAYLIST_CONFIG (lưu bền sẽ vô hiệu hoá 1 lớp an toàn đã có chủ đích cho hành động
     * phá huỷ dữ liệu — router đó CHỦ ĐỘNG reset 3 field này mỗi lần mở panel).
     */
    async _persistPlaylistConfig() {
        appConfigPlaylist.setAll({
            activeMediaSource: appState.get('activeMediaSource'),
            displaySortMode: appState.get('displaySortMode'),
            // SỬA (mục 3) — displayStatSortMode (gộp) tách thành 2 field riêng.
            displayStatSortField: appState.get('displayStatSortField'),
            displayStatSortDirection: appState.get('displayStatSortDirection'),
            isGridView: appState.get('isGridView'),
        });
        await setMeta('playlistConfig', appConfigPlaylist.getAll());
    },

    /**
     * Khôi phục 3 lựa chọn "Playlist Settings" đã lưu bền LÚC BOOT — gọi từ event/workflow/
     * app-boot.js, TRƯỚC bước quyết định nạp playlistCache theo nguồn nào (LƯU Ý THỨ TỰ, phản hồi
     * Giang: phải biết `activeMediaSource` đã lưu TRƯỚC khi nạp cache đúng Nguồn — xem app-boot.js).
     * Đồng bộ lại UI 4
     * <select>/badge qua `this.syncPlaylistSettingsUI()` (đã có sẵn, chỉ gán lại theo appState) vì
     * lần gọi ĐẦU của nó (cuối core/playlist/main.js, lúc nạp script) chạy TRƯỚC khi hàm này kịp
     * đọc xong IndexedDB (bất đồng bộ) — không gọi lại thì UI hiện sai giá trị dù state runtime đã đúng.
     */
    async loadPersistedPlaylistConfigOnBoot() {
        const saved = await getMeta('playlistConfig');
        if (saved && typeof saved === 'object') {
            appConfigPlaylist.mutateAll((cfg) => Object.assign(cfg, saved));
        }
        const cfg = appConfigPlaylist.getAll();
        // SỬA (hợp nhất Photo vào Playlist) — ternary nhị phân cũ (bất kỳ giá trị nào khác 'video'
        // đều rơi về 'song') sẽ ÂM THẦM ép 'photo' đã lưu bền quay lại 'song' mỗi lần mở app — THAY
        // bằng danh sách hợp lệ tường minh, giá trị lạ/thiếu mới rơi về 'song' (mặc định an toàn).
        const validSources = ['song', 'video', 'photo'];
        appState.set('activeMediaSource', validSources.includes(cfg.activeMediaSource) ? cfg.activeMediaSource : 'song');
        appState.set('displaySortMode', cfg.displaySortMode || 'az');
        appState.set('displayStatSortField', cfg.displayStatSortField || 'none'); // SỬA (mục 3)
        appState.set('displayStatSortDirection', cfg.displayStatSortDirection || 'desc');
        appState.set('isGridView', !!cfg.isGridView);
        console.log(`writer: "loadPersistedPlaylistConfigOnBoot", page: "activeMediaSource/displaySortMode/isGridView", content: "khôi phục từ meta.playlistConfig"`);
        const restoredSource = appState.get('activeMediaSource');
        if (playlistSearchInput) playlistSearchInput.placeholder = t(restoredSource === 'video' ? 'playlistView.search.placeholderVideo' : restoredSource === 'photo' ? 'playlistView.search.placeholderPhoto' : 'playlistView.search.placeholder');
        // SỬA (phản hồi Giang — "1 khung, không nhân bản") — thay cho việc toggle 'hidden' giữa
        // btnUploadAudio/btnUploadVideo (2 nút riêng ĐÃ XOÁ), giờ chỉ cần đồng bộ lại `accept` của
        // 2 input DÙNG CHUNG theo đúng Nguồn vừa khôi phục — nút bấm mở menu LUÔN hiện, không đổi.
        this._applyUploadInputAccept(restoredSource);
        // MỚI (hợp nhất Photo vào Playlist) — cùng lý do, hàng "Phát/Trộn bài" cũng phải tự đồng bộ
        // ở đây (KHÔNG đi qua switchSource() lúc boot). SỬA (Giang yêu cầu — "bỏ ẩn cho 2
        // nút phát và shuffle") — TRƯỚC ĐÂY toggle theo `restoredSource === 'photo'` (ẩn khi boot
        // thẳng vào Photo) — giờ Photo không còn ẩn 2 nút này nữa, LUÔN
        // gỡ 'hidden' bất kể Nguồn nào, khớp đúng cách switchSource() làm.
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this.syncPlaylistSettingsUI();
    },

    // ===================== Ver 12 "Filter/Sort subpanel" (mục 1b/1c/1d) =====================

    /**
     * Khôi phục `playlistFilterConfig` đã lưu bền LÚC BOOT — gọi từ event/workflow/app-boot.js,
     * TRƯỚC khối Scope (applyAllSongsScope()/applyFolderScope() đọc field này để lọc
     * playlistOrder, xem event/workflow/playlist-scope.js) — CÙNG VỊ TRÍ/LÝ DO THỨ TỰ với
     * loadPersistedPlaylistConfigOnBoot() ngay trên. Không tìm thấy `meta.playlistFilterConfig`
     * (lần đầu mở app) -> giữ nguyên default rỗng đã seed sẵn ở buildDefaults()
     * (service/state/playlist.js) — mọi field `null`, applyPlaylistFilter() fast-path trả nguyên
     * playlistOrder, hành vi giống hệt trước khi có Filter.
     */
    /** SỬA (08/09/2026, hệ "Playlist Filter Presets") — TRƯỚC ĐÂY hàm này tự đọc/migrate
     * `meta.playlistFilterConfig` (bộ rule sống DUY NHẤT). Giờ chỉ delegate THẲNG sang
     * `workflowPlaylistFilterPresets.loadOnBoot()` (event/workflow/playlist-filter-presets.js) —
     * GIỮ NGUYÊN tên hàm + điểm gọi (event/workflow/app-boot.js, TRƯỚC khối Scope) để KHÔNG phải
     * sửa app-boot.js, chỉ đổi NƠI logic thật sự sống. `meta.playlistFilterConfig` cũ KHÔNG migrate
     * (CHỐT Giang — "bắt đầu lại từ đầu"), giờ mồ côi trong DB, an toàn (không nơi nào còn đọc). */
    async loadPersistedFilterConfigOnBoot() {
        await workflowPlaylistFilterPresets.loadOnBoot(); // liên tuyến domain, event/workflow/playlist-filter-presets.js
    },


    /** Push panel "Sắp xếp" (mục 1b/1c; SỬA mục 3 — dropdown Stats tách field/hướng riêng, dropdown
     * hướng CHỈ hiện khi field khác 'none') — đồng bộ giá trị hiện tại lúc mở. SỬA (đợt tái cấu
     * trúc bottom nav + phân phối lại Settings) — KHÔNG còn `pushSettingsPanel()`, bodyHtml do
     * event/workflow/app-settings.js cung cấp SẴN qua `navigateTo()` — chỉ còn đồng bộ giá trị vào
     * `genericDrawerBody`. */
    openSortPanel() {
        const panelEl = genericDrawerBody;
        panelEl.querySelector('#setting-playlist-sort-name').value = appState.get('displaySortMode');
        const statField = appState.get('displayStatSortField');
        panelEl.querySelector('#setting-playlist-sort-stat-field').value = statField;
        panelEl.querySelector('#setting-playlist-sort-stat-direction').value = appState.get('displayStatSortDirection');
        panelEl.querySelector('[data-sort-direction-row]').classList.toggle('hidden', statField === 'none');
    },

    // XOÁ (08/09/2026, hệ "Playlist Filter Presets") — openFilterPanel()/_syncFilterPanelUI()/
    // openFilterTimePicker()/setFilterField()/applyFilterChanges() (bộ rule sống DUY NHẤT, nút
    // "Áp dụng" đơn) đã thay bằng workflowPlaylistFilterPresets (event/workflow/
    // playlist-filter-presets.js) — danh sách preset đặt tên, mirror EQ/Motion. _syncFilterPanelUI()
    // ĐÃ PORT sang workflowPlaylistFilterPresets._syncEditUI() (đọc preset đang sửa thay vì
    // playlistFilterConfig sống); 4 hàm còn lại có bản mirror bên đó (openFilterTimePicker/
    // setFilterField giữ nguyên tên, "Áp dụng" đổi tên thành selectPreset() — "chọn áp dụng").


    /** Ứng với nút X ở badge "đang Scope folder nào" (components/playlist-view.js) — MỚI (06/09/2026,
     * hợp nhất Folder vào Playlist, Batch 3). Thoát Scope của ĐÚNG Nguồn hiện tại, áp SỐNG (xem
     * event/workflow/playlist-scope.js) — `applyAllSongsScope()` tự ẩn badge lại (updateActiveFolderBadge()). */
    async exitActiveFolderScope() {
        const mediaType = appState.get('activeMediaSource');
        await withLoadingShield(t('common.loading.generic'), async () => {
            await workflowPlaylistScope.persistScopeChoice(null, mediaType);
            await workflowPlaylistScope.applyAllSongsScope(mediaType);
            workflowPlaylistRender.scrollToCurrentOrTop(); // SỬA (02/10/2026) — quy tắc A, CÙNG lý do applyFolderFromTile() (event/workflow/file-manager-folder-browser.js)
        });
    },

    /**
     * MỚI (05/08/2026, Rule 3a, phản hồi Giang "xử lý triệt để... theo event bus, rule core") —
     * thay thế `PlaylistMain.init()` đã BỊ BỎ (core/playlist/main.js): hàm đó cũ gọi lần lượt 4
     * method core khác NGAY BÊN TRONG chính nó — core gọi core, vi phạm Rule 3a. Việc GỌI TUẦN TỰ
     * 4 method (điều phối, không phải nghiệp vụ) giờ chuyển hẳn ra đây — Workflow CHUẨN BỊ tham số
     * (`appState.get('isGridView')`) rồi gọi từng Core method riêng biệt, đúng Rule 3b.
     * Dùng lại ở MỌI nơi trước đây gọi `PlaylistMain.init()`: loadPersistedPlaylistConfigOnBoot()
     * ngay trên, và event/workflow/app-boot.js (2 chỗ khôi phục lệch loại folder Scope).
     */
    async syncPlaylistSettingsUI() {
        if (typeof PlaylistMain === 'undefined') return; // guard clause thuần (Rule 1) — giữ đúng kiểu phòng thủ cũ ở mọi nơi từng gọi PlaylistMain.init()
        PlaylistMain.initViewMode(appState.get('isGridView'));
        // XOÁ (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") — truy vấn
        // `mediaSourceSelectEl` + gọi `PlaylistMain.updateActiveFolderUI(...)` từng ở đây đã bỏ hẳn
        // cùng hàm đó — badge mới tự cập nhật từ event/workflow/playlist-scope.js, không cần đồng
        // bộ gì thêm ở đây nữa.
        PlaylistMain.initMediaSource(genericDrawerBody.querySelector('#setting-playlist-media-source'), appState.get('activeMediaSource')); // SỬA (02/10/2026) — core nhận tham số (Rule 2)
    }
};

