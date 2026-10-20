/**
 * event/workflow/playlist.js — Workflow router "playlist": xoá/sửa/xuất từng mục, ảnh bìa, đổi Nguồn, upload, picker
 * "Thêm vào thư mục", chọn nhiều (phát/xuất ZIP/thêm vào thư mục/xoá), lưu/khôi phục cấu hình Playlist.
 *
 * alertModal() luôn gọi sau khi withLoadingShield() đóng (shield z-200 đè modal). Modal render HTML: mọi giá trị lấy từ
 * file/người dùng (tag ID3, tên file, lý do lỗi) phải qua escapeHtml() (core/modal-choice-ui.js) hoặc render*Html() ở
 * components/playlist-view.js.
 */

/** Icon 2 mục dropdown "Choose" ở tab Ảnh bìa (openCoverChooseMenu()). */
const SONG_EDIT_COVER_ICON_PHOTO = iconSvg('photograph');
const SONG_EDIT_COVER_ICON_VIDEO = iconSvg('video-camera');

/** Trần time-picker thời lượng Photo — phải hữu hạn (cột 'h' dựng đủ `count` dòng DOM); 24 giờ = 24 dòng. */
const PHOTO_EDIT_DURATION_PICKER_MAX_MS = 24 * 60 * 60 * 1000;

/** Đóng menu "Thêm nhạc" sau 1 nhịp khi bấm 1 trong 2 <label> (closeUploadMenuAfterLabelClick()). */
const UPLOAD_MENU_LABEL_CLOSE_DELAY_MS = 10;
const UPLOAD_MENU_LABEL_CLOSE_TASK = 'uploadMenuLabelClose';

/** Hết giờ đọc tag ID3 1 file (jsmediatags không gọi lại) -> nạp với tag mặc định. */
const ID3_READ_TIMEOUT_MS = 5000;

/** `accept` của 2 input upload dùng chung (#media-upload/#media-upload-folder) theo Nguồn. */
const UPLOAD_ACCEPT_BY_SOURCE = {
    song: '.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac',
    video: 'video/*',
    photo: 'image/*',
};

/** i18n key theo Nguồn: chữ tiến độ lúc nạp + placeholder ô tìm kiếm. */
const MEDIA_SWITCH_I18N = {
    song: { loadingKey: 'playlistView.loading.withCount', placeholderKey: 'playlistView.search.placeholder' },
    video: { loadingKey: 'playlistView.loading.withCountVideo', placeholderKey: 'playlistView.search.placeholderVideo' },
    photo: { loadingKey: 'playlistView.loading.withCountPhoto', placeholderKey: 'playlistView.search.placeholderPhoto' },
};

/** mediaType -> đọc meta (field `folder` cho workflowFolder.removeItemFromAllFolders()) + xoá record (3 store/1
 * transaction). Dùng cả ở event/workflow/file-manager-storage.js. Nơi gọi gỡ khỏi folder TRƯỚC khi xoá record. */
const MEDIA_DELETE_ACCESSOR = {
    song: { getRecord: (key) => getMediaMeta('song', key), deleteRecord: (key) => deleteMediaRecord('song', key) }, // service/db.js
    video: { getRecord: (key) => getMediaMeta('video', key), deleteRecord: (key) => deleteMediaRecord('video', key) },
    photo: { getRecord: (key) => getMediaMeta('photo', key), deleteRecord: (key) => deleteMediaRecord('photo', key) },
};

/** Xoá từ menu 3 chấm trúng media đang chọn (đã dừng): Video -> thoát Video Player; Song/Photo -> dọn audio + về Playlist. */
const CURRENT_RELEASE_BY_MENU_DELETE = {
    song: () => workflowPlaylist._releaseCurrentSong(),
    video: () => workflowPlaylist._releaseCurrentVideo(),
    none: () => Promise.resolve(),
};

/** Xoá hàng loạt trúng media đang phát: ép dừng như trên, Video cũng về màn Playlist ngay. */
const CURRENT_RELEASE_BY_BULK_DELETE = {
    song: () => workflowPlaylist._releaseCurrentSong(),
    video: async () => {
        await workflowPlaylist._releaseCurrentVideo();
        workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js
    },
    none: () => Promise.resolve(),
};

/** Thoát Video Player mode chỉ khi đang ở mode đó. */
const VIDEO_PLAYER_EXIT_BY_MODE = {
    true: () => workflowVideoPlayer.exitVideoPlayerMode(), // event/workflow/video-player.js
    false: () => Promise.resolve(),
};

/** Đọc meta cho modal Sửa thông tin: Video/Photo cần field chỉ có trên record (store meta, không mở Blob); Song dùng
 * thẳng playlistCache. */
const SONG_EDIT_META_READER = {
    song: () => Promise.resolve(null),
    video: (key) => getMediaMeta('video', key), // service/db.js
    photo: (key) => getMediaMeta('photo', key),
};

/** Điền tab "Sửa" theo loại media. */
const SONG_EDIT_FIELDS_FILLER = {
    song: (cached) => workflowPlaylist._fillSongEditFields(cached),
    video: (cached, meta) => fillVideoEditFields(meta ? (meta.customName || stripFileExtension(meta.filename)) : '', meta ? (meta.album || '') : ''), // core/playlist/actions.js
    photo: (cached, meta) => workflowPlaylist._fillPhotoEditFields(cached, meta),
};

/** HTML tab "Chi tiết" theo loại media (components/playlist-view.js). Nhãn thời gian/dung lượng định dạng sẵn:
 * formatTime() core/playlist/state.js, formatListenTime() core/listen-stats.js, formatBytes() core/about-stats.js. */
const SONG_EDIT_DETAILS_HTML = {
    video: (cached, meta, stats) => renderVideoEditDetailsHtml({
        ...(meta || {}), playCount: stats.count, listenLabel: formatListenTime(stats.totalTime), sizeLabel: formatBytes(cached.size),
    }),
    photo: (cached, meta, stats) => renderPhotoEditDetailsHtml({
        filename: meta && meta.filename, album: meta && meta.album, width: cached.width, height: cached.height,
        durationLabel: formatTime(cached.duration), playCount: stats.count, listenLabel: formatListenTime(stats.totalTime), sizeLabel: formatBytes(cached.size),
    }),
    song: (cached, meta, stats) => renderSongEditDetailsHtml({
        ...cached.tag, durationLabel: formatTime(cached.duration), playCount: stats.count, listenLabel: formatListenTime(stats.totalTime), sizeLabel: formatBytes(cached.size),
    }),
};

/** Lưu tab "Sửa" theo loại media. */
const SONG_EDIT_SAVER = {
    video: (key) => workflowPlaylist._saveVideoEdit(key),
    photo: (key) => workflowPlaylist._savePhotoEdit(key),
    song: (key) => workflowPlaylist._saveSongEdit(key),
};

/** Ảnh bìa Song lúc Lưu (resolvePendingCoverChange(), core/playlist/actions.js): ghi store thumb / xoá / giữ nguyên. */
const SONG_EDIT_COVER_WRITE_BY_CHANGE = {
    file: (key, pendingCover) => setMediaThumbs('song', key, { cover: pendingCover }), // service/db.js
    remove: (key) => setMediaThumbs('song', key, { cover: null }),
    keep: () => Promise.resolve(),
};

/** Ảnh bìa trong playlistCache sau khi lưu. */
const SONG_EDIT_CACHED_COVER_BY_CHANGE = {
    file: (pendingCover) => pendingCover,
    remove: () => null,
    keep: (pendingCover, cached) => (cached ? cached.cover : null),
};

/** #record-art của bài đang phát sau khi lưu -> URL ảnh bìa đang dùng. */
const SONG_EDIT_COVER_URL_BY_CHANGE = {
    file: (pendingCover) => workflowPlaylist.replaceCurrentCoverUrl(createBlobUrl(pendingCover)), // service/blob-url.js
    remove: () => workflowPlaylist.replaceCurrentCoverUrl(DEFAULT_VINYL),
    keep: (pendingCover, currentCoverUrl) => currentCoverUrl,
};

/** Upload Song: ghi đè bài đã có -> đọc meta cũ để giữ phụ đề/folder/thống kê/điểm Game. */
const SONG_OVERWRITE_META_BY_IS_OVERWRITE = {
    true: (key) => getMediaMeta('song', key), // service/db.js
    false: () => Promise.resolve(undefined),
};

/** "Xuất file" 1 bài Song: kết quả trong shield -> báo/tải sau khi shield đóng. */
const SONG_EXPORT_DELIVER_BY_STATUS = {
    skipped: () => Promise.resolve(), // shield đang bận tác vụ khác
    notFound: () => alertModal(t('common.export.notFound')),
    tagWriteFailed: async (result) => {
        await alertModal(t('common.export.tagWriteFailed'));
        await workflowZipDownload.promptSingle(result.blob, result.filename); // event/workflow/zip-download.js — file gốc
    },
    ok: (result) => workflowZipDownload.promptSingle(result.blob, result.filename),
};

/** "Xuất file" mục đang mở menu 3 chấm theo Nguồn (mục luôn cùng loại với Nguồn). */
const MENU_EXPORT_BY_SOURCE = {
    song: (key) => workflowPlaylist.exportSongWithTag(key),
    video: (key) => workflowPlaylist._exportOriginalFile(getVideoRecord, key), // service/db.js
    photo: (key) => workflowPlaylist._exportOriginalFile(getImageRecord, key),
};

/** Câu báo "đã thêm vào thư mục" theo loại media. */
const FOLDER_ADD_SUCCESS_KEY_BY_TYPE = {
    song: 'fileManager.folderPicker.addSuccess',
    video: 'fileManager.folderPicker.addSuccessVideo',
    photo: 'fileManager.folderPicker.addSuccessPhoto',
};

/** Ghi âm lưu xong: chỉ Nguồn Song cập nhật danh sách RAM; Nguồn khác nạp lại từ DB khi chuyển sang Song. */
const RECORDED_SONG_INDEX_BY_SOURCE = {
    song: (key, record) => workflowPlaylist._indexRecordedSongInSongSource(key, record),
    other: () => {},
};

// Picker "Thêm vào thư mục" (Generic Drawer) — mở lần đầu vs thay nội dung Drawer đang mở.
const FOLDER_PICKER_DRAWER_MOUNT_BY_FIRST_OPEN = { // event/workflow/generic-drawer-helpers.js
    true: (config) => workflowGenericDrawerHelpers.open(config),
    false: (config) => workflowGenericDrawerHelpers.update(config),
};
// Tap 1 tile: multiSelect -> bật/tắt chọn; không -> chọn ngay + đóng.
const FOLDER_PICKER_TAP_BY_MULTI_SELECT = {
    true: (folderId) => workflowPlaylist._toggleFolderPickerSelection(folderId),
    false: (folderId) => workflowPlaylist._pickSingleFolder(folderId),
};
// Đóng picker: nơi mở có truyền `onClose` -> giao nó; không -> đóng hẳn Drawer.
const FOLDER_PICKER_CLOSE_BY_HAS_ON_CLOSE = {
    true: (onClose) => onClose(),
    false: () => workflowGenericDrawerHelpers.closeFully(), // event/workflow/generic-drawer-helpers.js
};

const workflowPlaylist = {

    /** Đường đóng duy nhất của menu 3 chấm: đóng menu rồi chạy lượt cuộn tới bài đang phát nếu bị hoãn lúc menu mở. */
    closeActionMenu() {
        closeSongActionMenu(); // core/playlist/actions.js
        workflowPlaylistRender.flushPendingScrollToCurrent(); // event/workflow/playlist-render.js — no-op nếu không có cuộn chờ
    },

    /** Ứng với 'playlist.item.menuClick' — mục nào hiện tuỳ loại media + Scope folder hiện tại.
     * @param {string} key @param {HTMLElement} anchorBtn */
    openActionMenu(key, anchorBtn) {
        const { playlistCache, activePlayListFolder, activeMediaSource, isActiveFolderReadOnly } =
            appState.get(['playlistCache', 'activePlayListFolder', 'activeMediaSource', 'isActiveFolderReadOnly']);
        const cached = playlistCache.get(key);
        const mediaType = (cached && cached.mediaType) || 'song'; // thiếu cache -> coi như Song
        const view = resolveSongActionMenuView(mediaType, activePlayListFolder[activeMediaSource], isActiveFolderReadOnly); // core/playlist/actions.js
        openSongActionMenu(key, anchorBtn, view); // core/playlist/actions.js
    },

    /** Ứng với 'playlist.actionMenu.delete.click' — xoá 1 mục. Đang phát thật -> chặn; là mục đang chọn (đã dừng) ->
     * dọn player/UI sau khi xoá. @param {string} mediaKey - listener đọc sẵn từ `playlistStore` */
    deleteMediaFromActionMenu(mediaKey) {
        if (!mediaKey) return; // guard: menu không mở
        workflowPlaylist.closeActionMenu();
        const { playlistCache, currentKey, isVideoPlayerMode } = appState.get(['playlistCache', 'currentKey', 'isVideoPlayerMode']);
        const plan = resolveMediaDeletePlan(mediaKey, playlistCache.get(mediaKey), currentKey, isVideoPlayerMode, bgVideoElement.paused, audioPlayer.paused); // core/playlist/actions.js
        const title = escapeHtml(plan.title); // core/modal-choice-ui.js — tag ID3 / tên file
        if (plan.blockedLabelKey) { alertModal(tFormat(plan.blockedLabelKey, { title })); return; }

        return withLoadingShield(t('common.loading.deleting'), async () => {
            const { getRecord, deleteRecord } = MEDIA_DELETE_ACCESSOR[plan.mediaType];
            const record = await getRecord(mediaKey);
            if (record) await workflowFolder.removeItemFromAllFolders(record); // event/workflow/folder.js — tránh "ghost" trong folder
            await deleteRecord(mediaKey);
            workflowListenStats.forget(plan.mediaType, mediaKey); // event/workflow/listen-stats.js
            workflowPlaylistOrder.removeKeyFromDisplay(mediaKey); // event/workflow/playlist-order.js
            await CURRENT_RELEASE_BY_MENU_DELETE[plan.currentCleanup]();
        }).then(() => { alertModal(tFormat('playlistView.songMenu.deleteSuccess', { title })); }); // không chờ modal đóng
    },

    /** Dọn bài đang chọn (Song/Photo) vừa bị xoá: thu hồi URL, dừng audio, xoá currentKey, về màn Playlist. */
    _releaseCurrentSong() {
        const { currentObjectURL, currentCoverObjectURL } = appState.get(['currentObjectURL', 'currentCoverObjectURL']);
        revokeBlobUrl(currentObjectURL); // service/blob-url.js
        revokeBlobUrl(currentCoverObjectURL);
        appState.set('currentObjectURL', null);
        appState.set('currentCoverObjectURL', null);
        console.log(`writer: "workflowPlaylist._releaseCurrentSong", page: "currentObjectURL/currentCoverObjectURL", content: "null"`);
        pauseMediaElement(audioPlayer); // core/media-element-ui.js
        setMediaElementSource(audioPlayer, '');
        appState.set('currentKey', null);
        console.log(`writer: "workflowPlaylist._releaseCurrentSong", page: "currentKey", content: "null"`);
        setPlayerTrackLabels(t('bottomPlayer.noSongSelected'), '---'); // core/player-controls.js
        workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js
        workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js
        setVisualizerActiveFalse(); // core/player-controls.js — returnToPlaylistUI() không tự set cờ này
    },

    /** Dọn Video đang chọn vừa bị xoá: thoát Video Player (nếu đang ở mode đó), xoá currentKey. */
    async _releaseCurrentVideo() {
        await VIDEO_PLAYER_EXIT_BY_MODE[!!appState.get('isVideoPlayerMode')]();
        appState.set('currentKey', null);
        console.log(`writer: "workflowPlaylist._releaseCurrentVideo", page: "currentKey", content: "null"`);
        setPlayerTrackLabels(t('bottomPlayer.noSongSelected'), '---'); // core/player-controls.js
    },

    /** Ứng với 'playlist.actionMenu.edit.click'. */
    openSongEditFromActionMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return; // guard: menu không mở
        workflowPlaylist.closeActionMenu();
        this.openSongEditModal(key);
    },

    /** Modal Sửa thông tin dùng chung Song/Video/Photo: đọc cache + meta + thống kê, dọn preview cũ, điền 2 tab.
     * @param {string} key */
    async openSongEditModal(key) {
        const cached = appState.get('playlistCache').get(key);
        if (!cached) return; // guard
        const mediaType = cached.mediaType || 'song';
        const stats = workflowListenStats.getStats(mediaType, key); // event/workflow/listen-stats.js
        const meta = await SONG_EDIT_META_READER[mediaType](key);
        revokeBlobUrl(playlistStore.get('songEditPendingCoverPreviewUrl')); // service/blob-url.js — preview còn sót từ lần trước
        playlistStore.set({ songEditCurrentKey: key, songEditPendingCover: null, songEditPendingCoverPreviewUrl: null });
        console.log(`writer: "workflowPlaylist.openSongEditModal", page: "playlistStore.songEditCurrentKey", content: "${key} (${mediaType})"`);
        toggleSongEditFieldGroups(mediaType); // core/playlist/actions.js
        SONG_EDIT_FIELDS_FILLER[mediaType](cached, meta);
        setSongEditDetailsHtml(SONG_EDIT_DETAILS_HTML[mediaType](cached, meta, stats)); // core/playlist/actions.js
        applyUiThemeToDom(songEditTabDetails, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — DOM vừa dựng chưa ăn theme
        setSongEditTab('details'); // core/playlist/actions.js
        showSongEditModal();
    },

    /** Điền tab "Sửa" Song: tag + preview cover hiện tại (blob URL lưu vào songEditPendingCoverPreviewUrl để thu hồi
     * cùng lúc đóng modal / đổi ảnh). */
    _fillSongEditFields(cached) {
        fillSongEditFields(cached.tag); // core/playlist/actions.js
        const coverUrl = cached.cover ? createBlobUrl(cached.cover) : DEFAULT_VINYL; // service/blob-url.js
        setSongEditCoverPreview(coverUrl); // core/playlist/actions.js
        if (!cached.cover) return;
        playlistStore.set({ songEditPendingCoverPreviewUrl: coverUrl });
        console.log(`writer: "workflowPlaylist._fillSongEditFields", page: "playlistStore.songEditPendingCoverPreviewUrl", content: "blob mới"`);
    },

    /** Điền tab "Sửa" Photo + thời lượng chờ lưu (chỉ ghi DB lúc bấm Lưu). */
    _fillPhotoEditFields(cached, meta) {
        fillPhotoEditFields(meta ? (meta.customName || stripFileExtension(meta.filename)) : '', meta ? (meta.album || '') : '', formatTime(cached.duration)); // core/playlist/actions.js, core/file-manager/video.js, core/playlist/state.js
        playlistStore.set({ songEditPendingPhotoDurationSec: cached.duration || 0 });
        console.log(`writer: "workflowPlaylist._fillPhotoEditFields", page: "playlistStore.songEditPendingPhotoDurationSec", content: "${cached.duration || 0}"`);
    },

    /** Key của modal lỗi lúc phát đang mở + đóng modal. @returns {string|null} null nếu không có modal nào mở */
    _takePlaybackErrorKey() {
        const key = playlistStore.get('playbackErrorKey');
        if (!key) return null;
        closePlaybackErrorModal(); // core/playlist/actions.js
        return key;
    },

    /** Ứng với 'playlist.playbackError.keep' — ghi nhận giữ bài lỗi, bỏ khỏi danh sách hiển thị. @returns {{status: string}} */
    keepBrokenSong() {
        const key = this._takePlaybackErrorKey();
        if (!key) return { status: 'noop' };
        appState.mutate('confirmedBrokenKeys', s => s.add(key));
        console.log(`writer: "workflowPlaylist.keepBrokenSong", page: "confirmedBrokenKeys", content: "+${key}"`);
        workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
        return { status: 'ok' };
    },

    /** Ứng với 'playlist.playbackError.delete' — xoá bài lỗi trong shield (không báo sau khi xoá). */
    async executePlaybackErrorDelete() {
        const key = this._takePlaybackErrorKey();
        if (!key) return; // guard: không có modal nào mở
        await withLoadingShield(t('common.loading.deleting'), async () => {
            await deleteMediaRecord('song', key); // service/db.js
            workflowListenStats.forget('song', key); // event/workflow/listen-stats.js
            workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
        });
    },

    /** Ứng với 'playlist.editCover.choose.click' — dropdown nổi (core/dropdown-menu.js, z-127 > modal z-120) neo dưới
     * nút "Choose"; mỗi mục chỉ bắn eventBus. */
    openCoverChooseMenu() {
        if (!songEditCoverChooseBtn) return; // guard: template chưa mount
        const send = (type) => () => eventBus.send({ router: 'playlist', type, payload: {} });
        openDropdownMenu(songEditCoverChooseBtn, [ // core/dropdown-menu.js
            { icon: SONG_EDIT_COVER_ICON_PHOTO, name: t('playlistView.songEdit.coverFromPhoto'), callback: send('playlist.editCover.pickFromLibrary') },
            { icon: SONG_EDIT_COVER_ICON_VIDEO, name: t('playlistView.songEdit.coverFromVideoThumb'), callback: send('playlist.editCover.pickFromVideoThumb') },
        ]);
    },

    /** "Choose" -> "Photo": picker chọn 1 ảnh thư viện. */
    pickCoverFromLibrary() {
        workflowFileManagerPhoto.openCoverImagePicker((imageKey) => { // event/workflow/file-manager-photo.js
            this.applyCoverFromLibrary(imageKey);
        });
    },

    // ===================== Ảnh bìa từ thumb video =====================
    // Picker video (Generic Drawer, single-select) -> `thumbBlob` (vuông 320px; record cũ thiếu thì `thumbFullBlob`) ->
    // `File` -> _changePendingCover() (chờ lưu). Đợi drawer trượt xong rồi mới đọc DB + dựng lưới.
    _coverVideoPickerOpen: false, // picker đang mở (đóng nhanh lúc đang đọc DB / tap đua)

    /** Ứng với 'playlist.editCover.pickFromVideoThumb'. */
    async pickCoverFromVideoThumb() {
        const scrollId = 'song-edit-cover-video-picker-scroll', emptyId = 'song-edit-cover-video-picker-empty';
        workflowGenericDrawerHelpers.mountMediaPicker({ // event/workflow/generic-drawer-helpers.js
            routerName: 'playlist', msgPrefix: 'playlist.editCover.videoPicker',
            title: t('fileManager.video.pickerTitle'),
            bodyHtml: renderMediaPickerBodyHtml(scrollId, emptyId, t('fileManager.video.empty'), 'textSecondary'), // components/media-gallery.js
            tileSelector: '.video-tile', tileDataKey: 'videoKey',
        });
        this._coverVideoPickerOpen = true;

        await new Promise((resolve) => { taskManager.once(resolve, GENERIC_DRAWER_ANIM_MS, 'songEditCoverVideoPickerOpenSettle'); }); // core/generic-drawer.js
        if (!this._coverVideoPickerOpen) return; // guard — picker bị đóng lúc drawer đang trượt

        const videos = await workflowPlaylistScope.listPickableMedia('video'); // event/workflow/playlist-scope.js — bỏ item folder Hidden
        if (!this._coverVideoPickerOpen) return; // guard — picker bị đóng lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector(`#${scrollId}`);
        setMediaPickerEmptyUi(genericDrawerBody.querySelector(`#${emptyId}`), videos.length === 0); // core/file-manager/gallery-window-ui.js
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null }); // event/workflow/video-gallery-window.js
    },

    /** Ứng với 'playlist.editCover.videoPicker.tile.click' — chọn ngay + đóng picker. @param {string} videoKey */
    async handleCoverVideoPickerTileClick(videoKey) {
        if (!this._coverVideoPickerOpen) return; // guard: picker đã đóng
        this._teardownCoverVideoPicker();
        await this.applyCoverFromVideoThumb(videoKey);
    },

    /** Ứng với 'playlist.editCover.videoPicker.close.click' — huỷ, giữ ảnh bìa đang chờ. */
    handleCoverVideoPickerCloseClick() {
        if (!this._coverVideoPickerOpen) return;
        this._teardownCoverVideoPicker();
    },

    /** Gỡ lưới windowing (revoke object URL) + đóng drawer. */
    _teardownCoverVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer'); // event/workflow/video-gallery-window.js
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        this._coverVideoPickerOpen = false;
    },

    /** Record video -> thumb (vuông, lùi về full-res) -> `File` -> ảnh bìa chờ lưu. @param {string} videoKey */
    async applyCoverFromVideoThumb(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) return; // guard: video vừa bị xoá
        const thumb = record.thumbBlob || record.thumbFullBlob;
        if (!thumb) {
            await alertModal(t('playlistView.songEdit.coverVideoThumbMissing'));
            return;
        }
        const file = new File([thumb], `${stripFileExtension(record.filename)}.jpg`, { type: thumb.type || 'image/jpeg' }); // core/file-manager/video.js
        await this._changePendingCover(file);
    },

    /** Callback picker ảnh — bọc Blob thành `File` rồi đặt làm ảnh bìa chờ lưu. @param {string} imageKey */
    async applyCoverFromLibrary(imageKey) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record) return; // guard: ảnh vừa bị xoá
        const file = new File([record.blob], record.filename, { type: record.blob.type });
        await this._changePendingCover(file);
    },

    /** Ảnh bìa mới chờ lưu: sai định dạng -> báo lỗi; hợp lệ -> preview. @param {File} file */
    async _changePendingCover(file) {
        const check = validateFileType(file, IMAGE_UPLOAD_RULE); // core/upload-validation.js
        if (!check.valid) { await alertModal(escapeHtml(check.reason)); return; } // lý do chứa tên file / MIME thô
        this._setPendingCover(file, createBlobUrl(file)); // service/blob-url.js
    },

    /** Ứng với 'playlist.editCover.remove' — chờ lưu: xoá ảnh, preview về đĩa than mặc định. */
    removePendingCover() {
        this._setPendingCover('remove', null);
    },

    /** Ghi ảnh bìa chờ lưu (thu hồi preview cũ) + vẽ preview. Ghi DB lúc bấm "Lưu" (_saveSongEdit()).
     * @param {File|'remove'} cover @param {string|null} previewUrl - blob URL của `cover`; null -> đĩa than mặc định */
    _setPendingCover(cover, previewUrl) {
        revokeBlobUrl(playlistStore.get('songEditPendingCoverPreviewUrl')); // service/blob-url.js
        playlistStore.set({ songEditPendingCover: cover, songEditPendingCoverPreviewUrl: previewUrl });
        console.log(`writer: "workflowPlaylist._setPendingCover", page: "playlistStore.songEditPendingCover", content: "${previewUrl ? 'ảnh mới' : 'remove'}"`);
        setSongEditCoverPreview(previewUrl); // core/playlist/actions.js
    },

    /** Ứng với 'playlist.edit.cancel' và sau khi Lưu — bỏ ảnh bìa chờ lưu rồi đóng modal. */
    closeEditModal() {
        revokeBlobUrl(playlistStore.get('songEditPendingCoverPreviewUrl')); // service/blob-url.js
        playlistStore.set({ songEditPendingCover: null, songEditPendingCoverPreviewUrl: null });
        console.log(`writer: "workflowPlaylist.closeEditModal", page: "playlistStore.songEditPendingCover", content: "null"`);
        closeSongEditModal(); // core/playlist/actions.js
    },

    /** Sau khi lưu 1 media: vẽ lại hàng đó; đổi tên ảnh hưởng thứ tự khi sort theo tên -> cập nhật hàng đợi phát, rồi
     * thứ tự render + diff. @param {string} key */
    _refreshAfterMediaEditSave(key) {
        workflowPlaylistRender.refreshSongNode(key); // event/workflow/playlist-render.js
        if (isNameSortMode(appState.get('displaySortMode'))) workflowPlaylistOrder.recomputeDisplayOrder(); // core/playlist/order.js + event/workflow/playlist-order.js
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
    },

    /** Ứng với 'playlist.edit.save' — lưu theo loại media (meta mới do build*EditMeta() dựng, chỉ ghi store meta), báo
     * nếu record đã mất, đóng modal, làm mới danh sách. */
    async executeSaveEdit() {
        const key = playlistStore.get('songEditCurrentKey');
        if (!key) return; // guard: không có modal nào mở
        const cached = appState.get('playlistCache').get(key);
        const result = await SONG_EDIT_SAVER[(cached && cached.mediaType) || 'song'](key);
        if (result.status === 'notFound') await alertModal(t('common.songEdit.notFound'));
        this.closeEditModal();
        this._refreshAfterMediaEditSave(key);
    },

    async _saveVideoEdit(key) {
        const { customName, album } = readVideoEditInputs(); // core/playlist/actions.js
        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            result = await updateMediaMeta('video', key, (meta) => buildVideoEditMeta(meta, customName, album)); // service/db.js + core/playlist/actions.js
        });
        if (result.status === 'ok') this._syncEditedVideoRuntime(key, result.meta);
        return result;
    },

    async _savePhotoEdit(key) {
        const { customName, album } = readPhotoEditInputs(); // core/playlist/actions.js
        const durationSec = playlistStore.get('songEditPendingPhotoDurationSec');
        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            result = await updateMediaMeta('photo', key, (meta) => buildPhotoEditMeta(meta, customName, durationSec, album)); // service/db.js + core/playlist/actions.js
        });
        if (result.status === 'ok') this._syncEditedPhotoRuntime(key, result.meta);
        return result;
    },

    async _saveSongEdit(key) {
        const newTag = readSongEditTagInputs(); // core/playlist/actions.js
        const pendingCover = playlistStore.get('songEditPendingCover');
        const coverChange = resolvePendingCoverChange(pendingCover); // core/playlist/actions.js
        let result;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            result = await updateMediaMeta('song', key, (meta) => buildSongEditMeta(meta, newTag)); // service/db.js + core/playlist/actions.js
            if (result.status === 'ok') await SONG_EDIT_COVER_WRITE_BY_CHANGE[coverChange](key, pendingCover);
        });
        if (result.status === 'ok') this._syncEditedSongRuntime(key, result.meta, coverChange, pendingCover);
        return result;
    },

    /** Cập nhật RAM/DOM sau khi lưu tab "Sửa" Video (playlistCache, songNameIndex, tên trên player, Media Session). */
    _syncEditedVideoRuntime(key, meta) {
        const currentKey = appState.get('currentKey');
        const displayName = meta.customName || stripFileExtension(meta.filename); // core/file-manager/video.js
        appState.mutate('playlistCache', (m) => {
            const cached = m.get(key);
            if (!cached) return; // guard: mục không còn trong danh sách
            cached.tag.title = displayName;
            cached.tag.album = meta.album || ''; // tìm kiếm/Filter đọc field này
        });
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(displayName))); // core/song-search.js
        console.log(`writer: "workflowPlaylist._syncEditedVideoRuntime", page: "playlistCache/songNameIndex", content: "${key} -> ${displayName}"`);
        if (key !== currentKey) return;
        setPlayerTrackLabels(displayName, ''); // core/player-controls.js — Video không có artist
        setMediaSessionMetadata(displayName, '', []);
    },

    /** Bản Photo của `_syncEditedVideoRuntime()` — thêm thời lượng (ảnh đang hiện đổi thời lượng ngay). */
    _syncEditedPhotoRuntime(key, meta) {
        const currentKey = appState.get('currentKey');
        const displayName = meta.customName || stripFileExtension(meta.filename); // core/file-manager/video.js
        appState.mutate('playlistCache', (m) => {
            const cached = m.get(key);
            if (!cached) return; // guard: mục không còn trong danh sách
            cached.tag.title = displayName;
            cached.tag.album = meta.album || '';
            cached.duration = meta.duration;
        });
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(displayName))); // core/song-search.js
        console.log(`writer: "workflowPlaylist._syncEditedPhotoRuntime", page: "playlistCache/songNameIndex", content: "${key} -> ${displayName}"`);
        if (key !== currentKey) return;
        setPlayerTrackLabels(displayName, ''); // core/player-controls.js
        appState.set('photoPlayerDurationSec', meta.duration, { skipCheck: true }); // event/workflow/photo-player.js đọc mỗi tick
        console.log(`writer: "workflowPlaylist._syncEditedPhotoRuntime", page: "photoPlayerDurationSec", content: "${meta.duration}"`);
        setMediaSessionMetadata(displayName, '', []);
    },

    /** Bản Song. Ảnh bìa trong RAM/DOM chỉ đổi khi chọn ảnh mới / xoá ảnh; giữ nguyên thì URL đang hiện dùng tiếp.
     * @param {string} key @param {object} meta @param {'file'|'remove'|'keep'} coverChange @param {File|string|null} pendingCover */
    _syncEditedSongRuntime(key, meta, coverChange, pendingCover) {
        const { playlistCache, currentKey, currentCoverObjectURL } = appState.get(['playlistCache', 'currentKey', 'currentCoverObjectURL']);
        const cover = SONG_EDIT_CACHED_COVER_BY_CHANGE[coverChange](pendingCover, playlistCache.get(key));
        appState.mutate('playlistCache', (m) => {
            const cached = m.get(key);
            if (!cached) return; // guard: mục không còn trong danh sách
            cached.tag = meta.tag;
            cached.cover = cover || null;
        });
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(meta.tag.title))); // core/song-search.js
        console.log(`writer: "workflowPlaylist._syncEditedSongRuntime", page: "playlistCache/songNameIndex", content: "${key} -> ${meta.tag.title}"`);
        if (key !== currentKey) return;
        setPlayerTrackLabels(meta.tag.title, meta.tag.artist); // core/player-controls.js
        const coverUrl = SONG_EDIT_COVER_URL_BY_CHANGE[coverChange](pendingCover, currentCoverObjectURL);
        const session = resolveSongMediaSessionInfo(meta.tag, cover, coverUrl); // core/playlist/actions.js
        setMediaSessionMetadata(session.title, session.artist, session.artwork); // core/player-controls.js
    },

    /** Thay URL ảnh bìa bài đang phát (thu hồi URL cũ) + #record-art (gắn lại fallback lỗi ảnh). Dùng chung với
     * workflowPlayer.reloadCurrentSongKeepingPosition(). @param {string} url @returns {string} url */
    replaceCurrentCoverUrl(url) {
        revokeBlobUrl(appState.get('currentCoverObjectURL')); // service/blob-url.js — URL không phải blob: thu hồi vô hại
        appState.set('currentCoverObjectURL', url);
        console.log(`writer: "workflowPlaylist.replaceCurrentCoverUrl", page: "currentCoverObjectURL", content: "${url.startsWith('blob:') ? 'blob mới' : url}"`);
        const recordArtEl = setRecordArtSrc(url); // core/record-art-ui.js
        if (recordArtEl) attachCoverFallback(recordArtEl); // core/playlist/render.js
        return url;
    },

    /** Nút thời lượng ở tab "Sửa" Photo — time-picker h-m-s, sàn DURATION_MIN_SEC (core/file-manager/image.js). Giá trị
     * DB không bị kẹp — vượt trần thì picker chỉ kẹp phần hiển thị. */
    openPhotoEditDurationPicker() {
        const { valueMs, minMs } = computePhotoEditPickerMs(playlistStore.get('songEditPendingPhotoDurationSec'), DURATION_MIN_SEC); // core/playlist/actions.js
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('playlistView.songEdit.durationPickerTitle'),
            format: 'h-m-s',
            valueMs,
            minMs,
            maxMs: PHOTO_EDIT_DURATION_PICKER_MAX_MS,
            onConfirm: (resultMs) => {
                const resultSec = resolvePickedPhotoDurationSec(resultMs); // core/playlist/actions.js
                playlistStore.set({ songEditPendingPhotoDurationSec: resultSec });
                console.log(`writer: "workflowPlaylist.openPhotoEditDurationPicker", page: "playlistStore.songEditPendingPhotoDurationSec", content: "${resultSec}"`);
                setPhotoEditDurationText(formatTime(resultSec)); // core/playlist/actions.js + core/playlist/state.js
            },
        });
    },

    // ===================== Chọn nhiều =====================
    // Render danh sách không đọc selectionMode/selectedMediaKeys — lớp chọn là DOM-patch riêng (core/playlist/selection.js).

    /** Thoát chế độ chọn — dùng chung sau mọi hành động hàng loạt. Chỉ gỡ dấu ở node đã chọn (vòng trống của node còn lại
     * là CSS theo class `is-selecting`); lấy danh sách trước khi disableSelectionMode() xoá tập chọn. */
    _exitSelectionMode() {
        const { selectedMediaKeys, domNodesByKey } = appState.get(['selectedMediaKeys', 'domNodesByKey']);
        const selectedKeysBefore = [...selectedMediaKeys];
        disableSelectionMode(); // core/playlist/selection.js
        selectedKeysBefore.forEach((key) => hideSelectionIndicator(domNodesByKey.get(key)));
        updateSelectionActionBar(false, 0);
        applySelectionChrome(false);
    },

    /** Ứng với 'playlist.selection.toggle'. */
    toggleSelectionMode() {
        const { selectionMode, selectedMediaKeys, domNodesByKey } = appState.get(['selectionMode', 'selectedMediaKeys', 'domNodesByKey']);
        const enabled = !selectionMode;
        const selectedKeysBefore = [...selectedMediaKeys]; // trước khi disableSelectionMode() xoá tập chọn (Set dùng chung tham chiếu)
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => enableSelectionMode() },
            { state: enabled, operation: '===', value: false, callback: () => disableSelectionMode() },
        ]);
        const themeClasses = this._selectionThemeClasses();
        // Chỉ lặp key đã chọn — vòng trống + ẩn nút 3 chấm là CSS theo `is-selecting` (applySelectionChrome()).
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => selectedKeysBefore.forEach((key) => showSelectionIndicator(domNodesByKey.get(key), key, selectedMediaKeys, themeClasses)) },
            { state: enabled, operation: '===', value: false, callback: () => selectedKeysBefore.forEach((key) => hideSelectionIndicator(domNodesByKey.get(key))) },
        ]);
        updateSelectionActionBar(enabled, selectedMediaKeys.size);
        applySelectionChrome(enabled);
    },

    /** Ứng với 'playlist.item.playClick' khi selectionMode=true (router chỉ gọi lúc đó) — chọn/bỏ chọn chỉ đổi màu/tick. */
    toggleSongSelectionAndRefresh(key) {
        const { selectedMediaKeys, domNodesByKey, selectionMode } = appState.get(['selectedMediaKeys', 'domNodesByKey', 'selectionMode']);
        const isCurrentlySelected = selectedMediaKeys.has(key);
        VirtualMachineState.run([
            { state: isCurrentlySelected, operation: '===', value: true, callback: () => deselectMedia(key) },
            { state: isCurrentlySelected, operation: '===', value: false, callback: () => selectMedia(key) },
        ]);
        showSelectionIndicator(domNodesByKey.get(key), key, selectedMediaKeys, this._selectionThemeClasses()); // core/playlist/selection.js — Set đã cập nhật tại chỗ
        updateSelectionActionBar(selectionMode, selectedMediaKeys.size);
    },

    /** Class chỉ báo chọn theo theme đang active — tra ở Workflow rồi truyền xuống showSelectionIndicator().
     * @returns {{tint:string, indicatorHtml:string}} */
    _selectionThemeClasses() {
        return {
            tint: resolveUiThemeClass(_activeUiThemeKeyList, 'selectionTintBg'), // core/ui-theme/registry.js + apply-ui.js
            indicatorHtml: renderSelectionIndicatorHtml(`${resolveUiThemeClass(_activeUiThemeKeyList, 'btnPrimaryPillBg')} ${resolveUiThemeClass(_activeUiThemeKeyList, 'textOnAccent')}`), // components/playlist-view.js
        };
    },

    /** Ứng với 'playlist.uploadMenu.open' khi selectionMode=true — chỉ báo chặn. */
    async showUploadBlockedBySelectionModal() {
        await alertModal(t('playlistView.selection.uploadBlocked'));
    },

    /** Ứng với 'playlist.uploadMenu.labelClick' — đóng menu "Thêm nhạc" sau 1 nhịp: ẩn ngay trong cùng tick thì vài trình
     * duyệt chưa kịp mở hộp chọn file của <input> bọc trong <label>. */
    closeUploadMenuAfterLabelClick() {
        taskManager.once(() => closeUploadActionMenu(), UPLOAD_MENU_LABEL_CLOSE_DELAY_MS, UPLOAD_MENU_LABEL_CLOSE_TASK); // core/playlist/loader.js
    },

    // ===================== Upload Song =====================

    /**
     * Đưa 1 record Song vừa ghi DB vào danh sách RAM (chỉ khi Nguồn là Song). Cache đủ addedAt/size như
     * buildSongPlaylistCache(). @param {string} key @param {object} record @param {boolean} isNew - key chưa có trong playlistOrder
     */
    _indexSongInPlaylistState(key, record, isNew) {
        if (isNew) appState.mutate('playlistOrder', arr => arr.push(key));
        appState.mutate('playlistCache', m => m.set(key, { filename: record.filename, tag: record.tag, cover: record.cover, duration: record.duration, addedAt: record.addedAt, size: record.blob.size || 0 }));
        appState.mutate('songNameIndex', m => m.set(key, normalizeSongName(record.tag.title))); // core/song-search.js
        appState.mutate('confirmedBrokenKeys', s => s.delete(key));
        console.log(`writer: "workflowPlaylist._indexSongInPlaylistState", page: "playlistOrder/playlistCache/songNameIndex/confirmedBrokenKeys", content: "${key} (${isNew ? 'mới' : 'ghi đè'})"`);
    },

    /** Làm mới danh sách sau khi thêm bài (Nguồn Song). @param {string[]} newlyAddedKeys - chỉ key mới (không gồm ghi đè) */
    _refreshPlaylistAfterSongsAdded(newlyAddedKeys) {
        workflowPlaylistOrder.updateShuffleArray(); // event/workflow/playlist-order.js
        workflowPlaylistOrder.applyNewSongsToDisplayOrder(newlyAddedKeys); // hàng đợi phát: nối cuối / chờ
        workflowPlaylistOrder.recomputeRenderOrder(); // UI: sắp lại ngay
        workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
    },

    /**
     * Thêm key vào 1 folder — dùng chung mọi nơi (upload, ghi âm, picker "Thêm vào thư mục", Video editor "Lưu mới").
     * @param {string[]} keys @param {string} folderId @param {'song'|'video'|'photo'} mediaType
     * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
     */
    async addMediaToFolder(keys, folderId, mediaType) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        if (!folderMap) return { status: 'notFound', addedCount: 0 };
        return addSongsToFolder(keys, folderId, mediaType, folderMap); // core/file-manager/folder.js
    },

    /** Đang Scope 1 folder của `mediaType` thì gắn mọi key vừa nạp (mới hoặc ghi đè) vào folder đó — 1 lượt. Đọc theo
     * `mediaType`, không theo Nguồn đang xem (Ghi âm lúc phát Video vẫn vào folder Song). */
    async _attachKeysToActiveFolder(keys, mediaType) {
        const folderId = appState.get('activePlayListFolder')[mediaType];
        if (!folderId || keys.length === 0) return; // guard
        await this.addMediaToFolder(keys, folderId, mediaType);
    },

    /**
     * Ghi âm — lưu bản ghi thành 1 Song mới (tên có dấu thời gian tới giây -> không đè), gắn folder Song đang active.
     * Danh sách RAM chỉ cập nhật khi Nguồn là Song.
     * @param {{filename:string, blob:Blob, tag:{title:string, artist:string, album:string}, cover:Blob|null, duration:number}} song
     * @returns {Promise<string>} key vừa lưu
     */
    async addRecordedSong(song) {
        const key = await resolveSongKey(song.filename); // service/db.js
        const cover = song.cover ? await rematerializeBlob(song.cover) : null; // service/db.js — Blob đọc từ IndexedDB -> Blob mới trước khi ghi sang record khác
        const record = { filename: song.filename, blob: song.blob, tag: song.tag, cover, subtitles: [], duration: song.duration, addedAt: Date.now() };
        await createMediaRecord('song', key, record); // service/db.js
        console.log(`writer: "workflowPlaylist.addRecordedSong", page: "db.songs", content: "${key} (${song.blob.type || 'không rõ MIME'}, ${song.blob.size} byte)"`);
        const activeMediaSource = appState.get('activeMediaSource');
        (RECORDED_SONG_INDEX_BY_SOURCE[activeMediaSource] || RECORDED_SONG_INDEX_BY_SOURCE.other)(key, record);
        await this._attachKeysToActiveFolder([key], 'song');
        return key;
    },

    /** Nhánh 'song' của RECORDED_SONG_INDEX_BY_SOURCE — key đã có (hiếm: trùng tên file) -> ghi đè. */
    _indexRecordedSongInSongSource(key, record) {
        const isNew = !appState.get('playlistOrder').includes(key);
        this._indexSongInPlaylistState(key, record, isNew);
        this._refreshPlaylistAfterSongsAdded(isNew ? [key] : []);
    },

    /** Đọc tag ID3 bằng jsmediatags. Không có thư viện / lỗi / quá ID3_READ_TIMEOUT_MS -> null (bài vẫn nạp, tag mặc định).
     * @param {File} file @returns {Promise<object|null>} `tags` của jsmediatags */
    _readId3Tags(file) {
        return new Promise((resolve) => {
            let settled = false;
            const settle = (tags) => { if (settled) return; settled = true; resolve(tags); };
            const safetyTimeout = taskManager.once(() => settle(null), ID3_READ_TIMEOUT_MS);
            const finish = (tags) => { safetyTimeout.kill(); settle(tags); };
            if (!window.jsmediatags) { finish(null); return; } // guard: thư viện chưa nạp
            try {
                jsmediatags.read(file, {
                    onSuccess: (result) => finish(result.tags),
                    onError: (err) => { console.warn(`[playlist] jsmediatags không đọc được tag của "${file.name}":`, err); finish(null); },
                });
            } catch (readErr) {
                console.error(`[playlist] jsmediatags.read lỗi đồng bộ với "${file.name}":`, readErr);
                finish(null);
            }
        });
    },

    /** Nạp 1 FileList Song (file rời hoặc cả thư mục — webkitdirectory trả mọi file, kiểm định dạng loại bớt). File bị
     * loại + file nạp lỗi báo chung 1 danh sách cuối lượt. */
    async uploadSongs(fileList) {
      try {
        const allFiles = Array.from(fileList); if (allFiles.length === 0) return;
        hidePlaylistEmpty(); // core/playlist/render.js

        // `accept` chỉ là gợi ý — kiểm định dạng + dung lượng thật ở đây, file bị loại không vào IndexedDB.
        const { accepted: files, rejected: failedFiles } = partitionFileChecks(allFiles.map((file) => ({
            file, checks: [validateFileType(file, AUDIO_UPLOAD_RULE), validateMediaFileSize(file)], // core/upload-validation.js
        }))); // core/playlist/loader.js
        if (files.length === 0) { await this._alertFailedFiles(failedFiles); return; }

        const newlyAddedKeys = [];
        const allProcessedKeys = []; // mới + ghi đè — gắn folder đang active sau vòng lặp
        // Set tra O(1); thêm key ngay khi nạp (2 file trùng tên trong cùng lượt ra cùng 1 key).
        const playlistOrderSet = new Set(appState.get('playlistOrder'));

        let shieldRan = false; // withLoadingShield() im lặng bỏ qua nếu shield đang bận tác vụ khác
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: files.length }), async () => {
            shieldRan = true;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setLoadingShieldText(tFormat('common.upload.loadingProgress', { done: i + 1, total: files.length })); // core/loading-shield-util.js
                try {
                    const { tag, picture } = buildSongTagFromId3(file.name, await this._readId3Tags(file), t('common.song.unknownArtist')); // core/playlist/loader.js
                    const cover = buildId3CoverBlob(picture, file.name); // core/playlist/loader.js
                    const duration = await workflowAudioDuration.read(file); // event/workflow/audio-duration.js
                    const key = await resolveSongKey(file.name); // service/db.js
                    const isOverwrite = playlistOrderSet.has(key);
                    // iOS: File của ô chọn file có thể trỏ tới file tạm của trình chọn, vào nền bị dọn -> nguồn phát chết.
                    const ownedBlob = await rematerializeBlob(file); // service/db.js
                    const record = mergeOverwrittenSongRecord( // core/playlist/loader.js
                        { filename: file.name, blob: ownedBlob, tag, cover, subtitles: [], duration, addedAt: Date.now() },
                        await SONG_OVERWRITE_META_BY_IS_OVERWRITE[isOverwrite](key));
                    await createMediaRecord('song', key, record); // service/db.js — 3 store, file + cover đều là Blob mới
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'song', key } }); // mục đang phát/đang dùng tự nạp lại
                    allProcessedKeys.push(key);
                    if (!isOverwrite) { playlistOrderSet.add(key); newlyAddedKeys.push(key); }
                    this._indexSongInPlaylistState(key, record, !isOverwrite);
                } catch (err) {
                    console.error(`[playlist] Không nạp được "${file.name}":`, err);
                    failedFiles.push({ filename: file.name, reason: formatUploadErrorMessage(err, t('common.unknownError')) }); // core/playlist/loader.js
                }
            }
            this._refreshPlaylistAfterSongsAdded(newlyAddedKeys);
            await this._attachKeysToActiveFolder(allProcessedKeys, 'song');
        });

        if (!shieldRan) {
            console.warn('[upload] uploadSongs bị bỏ qua: loading shield đang bận tác vụ khác (isShieldBusy=true).');
            await alertModal(t('common.upload.shieldBusy'));
            return;
        }
        await this._alertFailedFiles(failedFiles);
      } catch (err) {
          console.error('[upload] Lỗi không xác định trong uploadSongs:', err);
          await alertModal(tFormat('common.upload.genericError', { message: renderUploadErrorMessageHtml(err) })); // components/playlist-view.js
      }
    },

    /** Input chọn file rời (#media-upload, dùng chung 3 Nguồn — router chỉ gọi khi Nguồn là Song). @param {File[]} fileList */
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
            await alertModal(tFormat('common.upload.fileError', { message: renderUploadErrorMessageHtml(err) })); // components/playlist-view.js
        }
    },

    /** Input chọn cả thư mục (#media-upload-folder — router chỉ gọi khi Nguồn là Song). @param {File[]} fileList */
    async handleSongFolderPickerChange(fileList) {
        try {
            console.log(`[upload] #media-upload-folder change (Song): ${fileList.length} file được chọn (cả thư mục con).`);
            if (fileList.length === 0) {
                console.warn('[upload] #media-upload-folder (Song): FileList rỗng — thư mục trống hoặc bị chặn quyền đọc.');
                await alertModal(t('common.upload.folderEmpty'));
                return;
            }
            await this.uploadSongs(fileList);
        } catch (err) {
            console.error('[upload] Lỗi không xác định khi xử lý thư mục đã chọn (#media-upload-folder, Song):', err);
            await alertModal(tFormat('common.upload.folderError', { message: renderUploadErrorMessageHtml(err) })); // components/playlist-view.js
        }
    },

    /** Upload Video (router rẽ theo activeMediaSource). Lỗi 1 file (vd thiếu khung full-res) không chặn cả lô — bỏ qua,
     * cuối lô báo riêng danh sách tên + khuyến nghị upload lại. @param {FileList|File[]} files */
    async uploadVideos(files) {
        const { accepted: fileArray, rejected: oversizedFiles } = this._splitOversizedFiles(files);
        if (fileArray.length === 0) { await this._alertFailedFiles(oversizedFiles); return; }

        const skippedFilenames = [];
        const uploadedVideoKeys = [];
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                setLoadingShieldText(tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length })); // core/loading-shield-util.js
                try {
                    const { thumbBlob, thumbFullBlob, thumbFullIsBlack, width, height, duration } = await workflowVideoThumbExtract.extract(file); // event/workflow/video-thumb-extract.js
                    const videoKey = await resolveVideoKey(file.name); // service/db.js
                    await saveVideo(videoKey, file, file.name, thumbBlob, width, height, duration, thumbFullBlob, thumbFullIsBlack); // core/file-manager/video.js
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'video', key: videoKey } }); // trùng tên = ghi đè
                    uploadedVideoKeys.push(videoKey);
                } catch (err) {
                    console.error(`[uploadVideos] chụp thumbnail/lưu thất bại cho file "${file.name}":`, err);
                    skippedFilenames.push(file.name);
                }
            }
            await this._attachKeysToActiveFolder(uploadedVideoKeys, 'video');
        });
        // Input tự dọn value trong listener (event/listener/playlist.js). Nguồn Video -> làm mới để Next/Prev thấy video mới.
        await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard Nguồn
        await this._alertFailedFiles(oversizedFiles);
        if (skippedFilenames.length > 0) {
            await alertModal(tFormat('fileManager.video.uploadSkipped', { count: skippedFilenames.length, names: renderUploadSkippedNamesHtml(skippedFilenames) }), { title: t('fileManager.video.uploadSkippedTitle') }); // components/playlist-view.js
        }
        if (uploadedVideoKeys.length > 0) await alertModal(tFormat('fileManager.video.uploadSuccess', { count: uploadedVideoKeys.length }));
    },

    /** Upload Photo — cùng khuôn uploadVideos(): mỗi file resize thumbnail + tính thời lượng rồi `saveImage()`.
     * @param {FileList|File[]} files */
    async uploadPhotos(files) {
        const { accepted: fileArray, rejected: oversizedFiles } = this._splitOversizedFiles(files);
        if (fileArray.length === 0) { await this._alertFailedFiles(oversizedFiles); return; }

        const uploadedImageKeys = [];
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                setLoadingShieldText(tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length })); // core/loading-shield-util.js
                try {
                    const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(file); // event/workflow/file-manager-photo.js
                    const duration = await workflowPhotoDuration.compute(file, width, height); // event/workflow/photo-duration.js
                    const imageKey = await resolveImageKey(file.name); // service/db.js
                    await saveImage(imageKey, file, file.name, thumbBlob, width, height, duration); // core/file-manager/image.js
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'photo', key: imageKey } }); // trùng tên = ghi đè
                    uploadedImageKeys.push(imageKey);
                } catch (err) {
                    console.error(`[uploadPhotos] resize/lưu thất bại cho file "${file.name}":`, err);
                }
            }
            await this._attachKeysToActiveFolder(uploadedImageKeys, 'photo');
        });
        await this._refreshPhotoPlaylistIfActive();
        await this._alertFailedFiles(oversizedFiles);
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: uploadedImageKeys.length }));
    },

    /** Nguồn đang là Photo -> nạp lại đúng phạm vi đang nhớ (Filter + render). */
    async _refreshPhotoPlaylistIfActive() {
        const { activeMediaSource, activePlayListFolder } = appState.get(['activeMediaSource', 'activePlayListFolder']);
        if (activeMediaSource !== 'photo') return; // guard
        await workflowPlaylistScope.applyRememberedScope(activePlayListFolder.photo, 'photo'); // event/workflow/playlist-scope.js
    },

    /** Giới hạn 500MB/file của Video/Photo (Song kiểm chung trong uploadSongs()).
     * @param {FileList|File[]} files @returns {{accepted: File[], rejected: Array<{filename: string, reason: string}>}} */
    _splitOversizedFiles(files) {
        return partitionFileChecks(Array.from(files).map((file) => ({ file, checks: [validateMediaFileSize(file)] }))); // core/playlist/loader.js + core/upload-validation.js
    },

    /** Báo danh sách file bị loại / nạp lỗi (`common.upload.failedList`). Không có gì thì bỏ qua.
     * @param {Array<{filename: string, reason: string}>} failedFiles */
    async _alertFailedFiles(failedFiles) {
        if (failedFiles.length === 0) return;
        await alertModal(tFormat('common.upload.failedList', { n: failedFiles.length, list: renderUploadFailedListHtml(failedFiles) })); // components/playlist-view.js
    },

    /**
     * "Phát bài đã chọn" — sắp tập đã chọn theo cài đặt Sắp xếp hiện tại, bật sectionQueueActive (2 nút Phát/Trộn biết
     * cần chèn lại top-level trước khi phát) và resync shuffle theo section mới nếu Shuffle đang bật.
     */
    playSelectedSongs() {
        const state = appState.get(['selectedMediaKeys', 'isShuffle', 'playlistOrder', ...PLAYLIST_SORT_STATE_KEYS]);
        const keys = Array.from(state.selectedMediaKeys);
        if (keys.length === 0) return; // guard: chưa chọn gì

        const sorted = workflowPlaylistOrder.sortKeys(keys, state); // event/workflow/playlist-order.js
        appState.set('displayOrder', sorted);
        console.log(`writer: "playSelectedSongs", page: "displayOrder", content: "${sorted.length} bài đã chọn, sort theo cài đặt hiện tại"`);
        appState.mutate('pendingResortKeys', s => s.clear());
        console.log(`writer: "playSelectedSongs", page: "pendingResortKeys", content: "clear toàn bộ"`);
        appState.set('sectionQueueActive', true);
        console.log(`writer: "playSelectedSongs", page: "sectionQueueActive", content: "true"`);
        if (state.isShuffle) updateShuffleArrayFromQueue(sorted, state.playlistOrder, true); // core/playlist/order.js

        this._exitSelectionMode(); // trước khi chuyển màn hình phát
        workflowPlayer.playMedia(sorted[0]); // event/workflow/player.js
    },

    /**
     * "Xuất ZIP" (Song) — gắn tag mới nhất cho từng bài (buildTaggedBlob(), core/id3-export.js) rồi nén qua
     * workflowZipDownload (chia phần <= 500MB). Không gọi exportSongWithTag() (tự bọc shield — lồng shield bị chặn); bài ghi
     * tag lỗi dùng file gốc và được đếm để báo.
     */
    async exportSelectedSongsZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let failedCount = 0;
        let zipParts;
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            const entries = [];
            for (const key of keys) {
                const record = await getSongRecord(key); // service/db.js
                if (!record) { failedCount++; continue; } // guard: bài vừa bị xoá — bỏ qua
                try {
                    entries.push({ filename: record.filename, blob: await buildTaggedBlob(record) }); // core/id3-export.js
                } catch (e) {
                    console.error('[workflow:playlist] Lỗi ghi tag lúc xuất ZIP hàng loạt, dùng file gốc thay thế:', e);
                    entries.push({ filename: record.filename, blob: record.blob });
                    failedCount++;
                }
            }
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilename')); // event/workflow/zip-download.js
        });

        this._exitSelectionMode();
        // Tải qua modal "File đã sẵn sàng" (nút trong modal có user-activation mới — PWA iOS không mở Quick Look).
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /** "Xuất ZIP" (Video/Photo) — file gốc, không gắn tag. Key không còn tồn tại bị bỏ qua và được báo.
     * @param {'video'|'photo'} mediaType @param {string} zipNameKey */
    async _exportSelectedOriginalsZip(mediaType, zipNameKey) {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let zipParts;
        let entries;
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            entries = await workflowZipDownload.collectEntries(mediaType, keys); // event/workflow/zip-download.js
            zipParts = await workflowZipDownload.compressInParts(entries, t(zipNameKey));
        });

        this._exitSelectionMode();
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS
        if (entries.length < keys.length) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    async exportSelectedVideosZip() {
        await this._exportSelectedOriginalsZip('video', 'playlistView.selection.exportZipFilenameVideo');
    },

    async exportSelectedImagesZip() {
        await this._exportSelectedOriginalsZip('photo', 'playlistView.selection.exportZipFilenamePhoto');
    },

    /** "Xuất file" 1 bài Song (ghi tag ID3). Kết quả mang ra ngoài shield — modal chỉ hiện sau khi shield đóng. */
    async exportSongWithTag(key) {
        let result = { status: 'skipped' };
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getSongRecord(key); // service/db.js
            result = { status: 'notFound' };
            if (!record) return; // guard
            try {
                result = { status: 'ok', blob: await buildTaggedBlob(record), filename: record.filename }; // core/id3-export.js
            } catch (e) {
                console.error('[workflow:playlist] Lỗi ghi tag lúc xuất file:', e);
                result = { status: 'tagWriteFailed', blob: record.blob, filename: record.filename }; // báo lỗi rồi tải file gốc
            }
        });
        await SONG_EXPORT_DELIVER_BY_STATUS[result.status](result);
    },

    /** "Xuất file" 1 Video/ảnh — tải thẳng blob/filename gốc (không có tag; `customName` không ghi vào file).
     * @param {function(string): Promise<object|undefined>} readRecord - getVideoRecord / getImageRecord (service/db.js) */
    async _exportOriginalFile(readRecord, key) {
        let record = null;
        await withLoadingShield(t('common.loading.exportingFile'), async () => { record = await readRecord(key); });
        if (!record) { await alertModal(t('common.export.notFound')); return; }
        await workflowZipDownload.promptSingle(record.blob, record.filename); // event/workflow/zip-download.js
    },

    /** "Xuất file" cho mục đang mở menu 3 chấm — rẽ theo Nguồn. */
    async exportActiveMenuItem() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        await MENU_EXPORT_BY_SOURCE[appState.get('activeMediaSource')](key);
    },

    /** "Sửa phụ đề" trong menu 3 chấm — cùng điều hướng với nút Sub ở Control Center. */
    openSubtitleEditorForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowSubtitleModal.navigateToEditor(key);
    },

    /** "Sửa video" trong menu 3 chấm — sang pages/video-editor.html (key mã hoá qua service/song-key-cipher.js). */
    navigateToActiveMenuVideoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        window.location.href = `pages/video-editor.html?video=${encodeSongKeyForUrl(key)}`;
    },

    /** "Edit image" trong menu 3 chấm — modal xem/sửa ảnh. */
    navigateToActiveMenuPhotoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowFileManagerPhoto.openImagePreview(key); // event/workflow/file-manager-photo.js
    },

    /** Folder làm đích được của Nguồn hiện tại (bỏ folder đang Scope + Read-only). @param {'song'|'video'|'photo'} mediaType */
    async _listFoldersForAddPicker(mediaType, activeFolderId) {
        return pickFoldersForAddPicker(await workflowFolder.list(mediaType), activeFolderId); // event/workflow/folder.js + core/file-manager/folder.js
    },

    /** "Thêm vào thư mục" cho 1 mục từ menu 3 chấm — dùng chung _openFolderPickerDrawer() với bản chọn nhiều, chỉ khác
     * nguồn key + `onPick`. Thêm vào folder không áp lại Playlist đang chạy (lần áp Scope kế tiếp tự đọc). */
    async openAddToFolderPickerForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        const { activeMediaSource: mediaType, activePlayListFolder } = appState.get(['activeMediaSource', 'activePlayListFolder']);
        await this._openFolderPickerDrawer(async (folderId) => {
            await withLoadingShield(t('common.loading.savingInfo'), () => this.addMediaToFolder([key], folderId, mediaType));
            await alertModal(tFormat(FOLDER_ADD_SUCCESS_KEY_BY_TYPE[mediaType], { count: 1 }));
        }, { folders: await this._listFoldersForAddPicker(mediaType, activePlayListFolder[mediaType]) });
    },

    /** "Thêm vào thư mục" (chọn nhiều) — như bản 1 mục, thêm thoát chế độ chọn. */
    async openAddToFolderPicker() {
        const { selectedMediaKeys, activeMediaSource: mediaType, activePlayListFolder } = appState.get(['selectedMediaKeys', 'activeMediaSource', 'activePlayListFolder']);
        const keys = Array.from(selectedMediaKeys);
        if (keys.length === 0) return;
        await this._openFolderPickerDrawer(async (folderId) => {
            await withLoadingShield(t('common.loading.savingInfo'), () => this.addMediaToFolder(keys, folderId, mediaType));
            this._exitSelectionMode();
            await alertModal(tFormat(FOLDER_ADD_SUCCESS_KEY_BY_TYPE[mediaType], { count: keys.length }));
        }, { folders: await this._listFoldersForAddPicker(mediaType, activePlayListFolder[mediaType]) });
    },

    // ===================== Picker "Thêm vào thư mục" — Generic Drawer grid =====================
    // Grid folder (components/items.js) + tile "Tạo folder mới" cuối grid (tạo ngay 1 folder tên tự động, vào thẳng chế độ
    // sửa tên). Mọi tương tác trong Drawer đi qua eventBus. Visual Background dùng chung (multiSelect/typeOptions).

    _folderPickerShowAddTile: true, // false khi nơi gọi không cho tạo folder mới giữa chừng
    _folderPickerEmptyMsg: '',      // câu hiển thị khi danh sách rỗng
    _folderPickerFolders: [], // folder đang hiển thị trong grid — chỉ dùng lúc Drawer mở
    _folderPickerEditingId: null, // folderId đang sửa tên
    _folderPickerOnPick: null, // callback(folderId), hoặc callback(folderIds[], type) khi multiSelect
    _folderPickerOnClose: null, // gọi thay closeFully() khi đóng (nơi gọi sống chung Generic Drawer tự mở lại màn của mình)
    _folderPickerMultiSelect: false, // Visual Background "Thư mục" — gộp nhiều folder; tắt = tap là chọn ngay + đóng
    _folderPickerSelectedIds: [], // thứ tự chọn, chỉ dùng khi multiSelect
    _folderPickerTypeOptions: null, // { current: 'video'|'photo' } -> header có dropdown đổi loại
    _folderPickerOnTypeChange: null, // callback(newType) — nơi gọi re-fetch rồi gọi lại _openFolderPickerDrawer(…, true)

    /**
     * Mở Drawer lần đầu (hoặc vẽ lại tại chỗ nếu `isUpdate`). `options` (resolveFolderPickerOptions(),
     * core/file-manager/folder.js): `folders` (lọc sẵn; thiếu -> mọi folder), `showAddTile`, `emptyMsg`, `onClose`,
     * `multiSelect` (header có nút "Chọn (N)"), `typeOptions`, `onTypeChange`, `selectedIds` (giữ lựa chọn khi vẽ lại).
     * @param {function} onPick @param {object} [options] @param {boolean} [isUpdate]
     */
    async _openFolderPickerDrawer(onPick, options, isUpdate) {
        const opts = resolveFolderPickerOptions(options); // core/file-manager/folder.js
        this._folderPickerFolders = opts.folders || await workflowFolder.list(); // event/workflow/folder.js
        this._folderPickerShowAddTile = opts.showAddTile;
        this._folderPickerEmptyMsg = opts.emptyMsg;
        this._folderPickerEditingId = null;
        this._folderPickerOnPick = onPick;
        this._folderPickerOnClose = opts.onClose;
        this._folderPickerMultiSelect = opts.multiSelect;
        this._folderPickerSelectedIds = opts.selectedIds;
        this._folderPickerTypeOptions = opts.typeOptions;
        this._folderPickerOnTypeChange = opts.onTypeChange;
        this._renderFolderPickerGrid(!isUpdate, true); // danh sách mới -> cuộn từ đầu
    },

    /** Vẽ lại grid (mở lần đầu, thêm/sửa tên folder, toggle chọn, đổi loại).
     * @param {boolean} isFirstOpen - true: mở Generic Drawer; false: thay nội dung Drawer đang mở
     * @param {boolean} [scrollReset] - true: cuộn từ đầu; mặc định giữ vị trí cuộn */
    _renderFolderPickerGrid(isFirstOpen, scrollReset = false) {
        const selectedOrder = computeFolderSelectionOrder(this._folderPickerSelectedIds, this._folderPickerMultiSelect); // core/file-manager/folder.js — badge số thứ tự
        const itemsHtml = renderItemList(this._folderPickerFolders, itemTemplateFolderTile, { editingFolderId: this._folderPickerEditingId, selectedOrder }); // components/items.js
        const bodyHtml = buildFolderPickerBodyHtml(itemsHtml, this._folderPickerShowAddTile, this._folderPickerEmptyMsg, this._folderPickerFolders.length === 0); // components/items.js
        FOLDER_PICKER_DRAWER_MOUNT_BY_FIRST_OPEN[isFirstOpen]({
            scrollKey: 'playlist:folderPicker',
            scrollReset,
            height: 'auto',     // panel co theo nội dung thật
            maxHeight: '60vh',  // nhiều folder -> kẹp, body tự cuộn (bodyClass)
            headerHtml: this._buildFolderPickerHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        });
        wireFolderPickerDrawerEvents('playlist', 'playlist.folderPicker'); // core/file-manager/folder-picker-ui.js
    },

    /** Header picker: tiêu đề + (tuỳ chọn) dropdown đổi loại (`typeOptions`) + nút "Chọn (N)" (`multiSelect`). */
    _buildFolderPickerHeaderHtml() {
        const actionsHtml = buildFolderPickerHeaderActionsHtml(this._folderPickerTypeOptions, this._folderPickerMultiSelect, this._folderPickerSelectedIds.length); // components/items.js
        return buildDrawerHeaderHtml({ title: t('fileManager.folderPicker.title'), actionsHtml }); // components/generic-drawer.js
    },

    /** 'playlist.folderPicker.tile.click' — multiSelect: bật/tắt chọn (vẽ lại tại chỗ); không: chọn ngay + đóng. */
    async pickFolderInPicker(folderId) {
        await FOLDER_PICKER_TAP_BY_MULTI_SELECT[this._folderPickerMultiSelect](folderId);
    },

    /** Tap tile khi multiSelect — số thứ tự + nút "Chọn (N)" cập nhật theo. */
    _toggleFolderPickerSelection(folderId) {
        this._folderPickerSelectedIds = toggleFolderSelection(this._folderPickerSelectedIds, folderId); // core/file-manager/folder.js
        this._renderFolderPickerGrid(false);
    },

    /** Tap tile khi không multiSelect — đóng picker rồi giao `onPick`. */
    async _pickSingleFolder(folderId) {
        const onPick = this._folderPickerOnPick;
        this.closeFolderPicker();
        if (onPick) await onPick(folderId);
    },

    /** 'playlist.folderPicker.confirm.click' (chỉ có khi multiSelect) — giao id đã chọn (đúng thứ tự) + loại đang duyệt. */
    async confirmFolderPickerSelection() {
        if (!this._folderPickerMultiSelect || this._folderPickerSelectedIds.length === 0) return; // guard — nút đã disabled
        const onPick = this._folderPickerOnPick;
        const ids = this._folderPickerSelectedIds.slice();
        const type = resolveFolderPickerType(this._folderPickerTypeOptions); // core/file-manager/folder.js
        this.closeFolderPicker();
        if (onPick) await onPick(ids, type);
    },

    /** 'playlist.folderPicker.typeChange' (dropdown header) — nơi gọi tự re-fetch trong `onTypeChange`. */
    async changeFolderPickerType(value) {
        const cb = this._folderPickerOnTypeChange;
        if (!cb) return;
        await cb(value);
    },

    /** 'playlist.folderPicker.close.click' (và sau khi chọn xong) — có `onClose` thì giao nó, không thì đóng hẳn Drawer. */
    closeFolderPicker() {
        this._folderPickerOnPick = null;
        const onClose = this._folderPickerOnClose;
        this._folderPickerOnClose = null;
        this._folderPickerMultiSelect = false;
        this._folderPickerSelectedIds = [];
        this._folderPickerTypeOptions = null;
        this._folderPickerOnTypeChange = null;
        FOLDER_PICKER_CLOSE_BY_HAS_ON_CLOSE[!!onClose](onClose);
    },

    /** 'playlist.folderPicker.addTile.click' — tạo ngay 1 folder tên tự động (không trùng trong grid), loại = Nguồn đang
     * active, vẽ lại với tile mới ở chế độ sửa tên. Không tự chọn folder mới (tạo ≠ chọn). */
    async createFolderInPicker() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = computeNextPickerFolderName(this._folderPickerFolders); // core/file-manager/folder.js
        const result = await workflowFolder.create(defaultName, mediaType); // event/workflow/folder.js
        if (result.status !== 'ok') return; // hiếm — trùng tên do race
        this._folderPickerFolders.push({ id: result.folderId, name: defaultName, type: mediaType });
        this._folderPickerEditingId = result.folderId;
        this._renderFolderPickerGrid(false);
    },

    /** 'playlist.folderPicker.rename.commit' — blur/Enter ô sửa tên: thoát chế độ sửa, đổi tên nếu hợp lệ, vẽ lại. */
    async commitFolderPickerRename(folderId, name) {
        this._folderPickerEditingId = null;
        await this._renameFolderInPicker(findFolderById(this._folderPickerFolders, folderId), normalizeFolderNameInput(name)); // core/file-manager/folder.js
        this._renderFolderPickerGrid(false);
    },

    /** Tên rỗng / không đổi -> bỏ qua. Trùng tên folder khác -> im lặng giữ tên cũ (Folder Browser thì báo). */
    async _renameFolderInPicker(folder, name) {
        if (!folder || !name || name === folder.name) return; // guard
        const result = await workflowFolder.rename(folder.id, name); // event/workflow/folder.js — kèm cập nhật badge Scope
        if (result.status === 'ok') folder.name = name;
    },

    /**
     * "Xoá hàng loạt" (cùng 1 Nguồn): mục đang phát nằm trong tập xoá thì ép dừng + về màn Playlist ngay (không hỏi/không
     * chặn — khác deleteMediaFromActionMenu()) -> shield -> xoá -> báo "đã xoá". Video đang làm Visual Background không cần
     * chặn: VBG tự phát hiện record mất ở lượt kế.
     */
    async deleteSelectedMedia() {
        const { selectedMediaKeys, activeMediaSource: mediaType, currentKey } = appState.get(['selectedMediaKeys', 'activeMediaSource', 'currentKey']);
        const keys = Array.from(selectedMediaKeys);
        if (keys.length === 0) return;
        await CURRENT_RELEASE_BY_BULK_DELETE[resolveBulkDeleteRelease(keys, currentKey, mediaType)](); // core/playlist/bulk-actions.js — trước khi hiện shield

        let deletedCount = 0;
        await withLoadingShield(t('common.loading.deleting'), async () => {
            const { getRecord, deleteRecord } = MEDIA_DELETE_ACCESSOR[mediaType];
            const deletedKeys = [];
            for (const key of keys) {
                const record = await getRecord(key);
                if (!record) continue; // guard: đã bị xoá từ trước — không chặn cả lô
                await workflowFolder.removeItemFromAllFolders(record); // event/workflow/folder.js
                await deleteRecord(key);
                workflowListenStats.forget(mediaType, key); // event/workflow/listen-stats.js
                deletedKeys.push(key);
            }
            deletedCount = deletedKeys.length;
            const { playlistOrder, displayOrder } = appState.get(['playlistOrder', 'displayOrder']);
            removeKeysFromDisplayState(deletedKeys, playlistOrder, displayOrder); // core/playlist/bulk-actions.js
            workflowPlaylistOrder.updateShuffleArray(); // event/workflow/playlist-order.js
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
            workflowPlaylistRender.syncEmptyState();
        });

        this._exitSelectionMode();
        await alertModal(tFormat('playlistView.selection.deleteSuccess', { count: deletedCount }));
    },

    /** "Gỡ khỏi thư mục" (chọn nhiều) — gỡ khỏi danh sách của folder đang Scope, không đụng thư viện (khác
     * deleteSelectedMedia()). Nút chỉ hiện khi Scope 1 folder không Read-only (event/router/playlist.js); guard dưới là
     * lớp phòng vệ thứ 2. */
    async removeSelectedSongsFromFolder() {
        const { selectedMediaKeys, activeMediaSource: mediaType, activePlayListFolder, isActiveFolderReadOnly } = appState.get(['selectedMediaKeys', 'activeMediaSource', 'activePlayListFolder', 'isActiveFolderReadOnly']);
        const keys = Array.from(selectedMediaKeys);
        if (keys.length === 0) return;
        const folderId = activePlayListFolder[mediaType];
        if (!folderId || isActiveFolderReadOnly) return; // guard
        await this._removeKeysFromScopeFolder(keys, folderId, mediaType);
        this._exitSelectionMode();
    },

    /** "Gỡ khỏi thư mục" 1 mục qua menu 3 chấm — cùng guard với removeSelectedSongsFromFolder(). @param {string} songKey */
    async removeSongFromFolderMenu(songKey) {
        workflowPlaylist.closeActionMenu();
        const { activeMediaSource: mediaType, activePlayListFolder, isActiveFolderReadOnly } = appState.get(['activeMediaSource', 'activePlayListFolder', 'isActiveFolderReadOnly']);
        const folderId = activePlayListFolder[mediaType];
        if (!folderId || isActiveFolderReadOnly) return; // guard
        await this._removeKeysFromScopeFolder([songKey], folderId, mediaType);
    },

    /** Phần chung 2 lối "Gỡ khỏi thư mục": gỡ khỏi folder -> khỏi danh sách đang hiển thị -> vẽ lại; folder trống hẳn
     * thì thoát Scope về "Tất cả". */
    async _removeKeysFromScopeFolder(keys, folderId, mediaType) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const folderMap = await workflowFolder.removeItems(keys, folderId, mediaType); // event/workflow/folder.js
            const { playlistOrder, displayOrder } = appState.get(['playlistOrder', 'displayOrder']);
            removeKeysFromDisplayState(keys, playlistOrder, displayOrder); // core/playlist/bulk-actions.js
            workflowPlaylistOrder.updateShuffleArray(); // event/workflow/playlist-order.js
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
            workflowPlaylistRender.syncEmptyState();
            await this._exitScopeIfFolderEmpty(folderMap, mediaType);
        });
    },

    /** Folder đang Scope vừa trống hẳn -> thoát Scope về "Tất cả" ngay. */
    async _exitScopeIfFolderEmpty(folderMap, mediaType) {
        if (!folderMap || !isFolderEmpty(folderMap)) return; // guard — core/file-manager/folder.js
        await workflowPlaylistScope.persistScopeChoice(null, mediaType); // event/workflow/playlist-scope.js
        await workflowPlaylistScope.applyAllSongsScope(mediaType);
    },

    // ===================== Đổi Nguồn (Song/Video/Photo) =====================

    /**
     * Đổi Nguồn Playlist (Settings → Playlist). Thoát chọn nhiều -> set activeMediaSource -> trong shield nạp đúng phạm vi
     * đang nhớ + cuộn tới media đang phát (không có thì về đầu) -> giao diện theo Nguồn -> lưu bền. `displaySortMode` dùng
     * chung 3 Nguồn, không reset.
     * @param {'song'|'video'|'photo'} mediaType
     */
    async switchSource(mediaType) {
        // 3 Nguồn sinh key cùng kiểu slug filename -> key trùng có thể làm thao tác hàng loạt nhắm nhầm record.
        this._exitSelectionMode();
        this._dropDomNodesIfSourceChanged(mediaType);
        appState.set('activeMediaSource', mediaType);
        console.log(`writer: "switchSource", page: "activeMediaSource", content: "${mediaType}"`);

        const i18n = MEDIA_SWITCH_I18N[mediaType];
        await withLoadingShield(t('playlistView.loading.generic'), async () => {
            const onProgress = (done, total) => setLoadingShieldText(tFormat(i18n.loadingKey, { done, total })); // core/loading-shield-util.js
            await workflowPlaylistScope.applyRememberedScope(appState.get('activePlayListFolder')[mediaType], mediaType, onProgress); // event/workflow/playlist-scope.js
            workflowPlaylistRender.scrollToCurrentOrTop(); // event/workflow/playlist-render.js
        });
        applyPlaylistSourceChrome(t(i18n.placeholderKey), UPLOAD_ACCEPT_BY_SOURCE[mediaType]); // core/playlist/main.js
        await this._persistPlaylistConfig();
    },

    /** Nguồn thật sự đổi -> dọn domNodesByKey: renderPlaylistDiff() tái dùng node của key "vẫn còn", node Song (có thể mang
     * icon "đang phát") sẽ hiện lại cho Video/Photo trùng key. Bấm lại đúng Nguồn đang xem thì giữ tối ưu diff.
     * @param {'song'|'video'|'photo'} mediaType */
    _dropDomNodesIfSourceChanged(mediaType) {
        const { activeMediaSource, domNodesByKey } = appState.get(['activeMediaSource', 'domNodesByKey']);
        if (mediaType === activeMediaSource) return; // guard — Nguồn không đổi
        domNodesByKey.forEach(revokeNodeCoverUrl); // core/playlist/render.js
        appState.mutate('domNodesByKey', m => m.clear());
        console.log(`writer: "workflowPlaylist._dropDomNodesIfSourceChanged", page: "domNodesByKey", content: "clear (đổi Nguồn sang ${mediaType})"`);
    },

    /** "Sắp xếp" đổi giá trị — đổi + lưu bền. */
    async changeSortMode(mode) {
        workflowPlaylistOrder.setDisplaySortMode(mode); // event/workflow/playlist-order.js
        await this._persistPlaylistConfig();
    },

    /** Sort trục thống kê — field. Hàng "Hướng" chỉ hiện khi field khác 'none' (panel nằm trong genericDrawerBody). */
    async changeStatSortField(field) {
        workflowPlaylistOrder.setDisplayStatSortField(field); // event/workflow/playlist-order.js
        toggleSortStatDependents(genericDrawerBody, field); // core/playlist/main.js
        await this._persistPlaylistConfig();
    },

    /** Sort trục thống kê — hướng. */
    async changeStatSortDirection(direction) {
        workflowPlaylistOrder.setDisplayStatSortDirection(direction); // event/workflow/playlist-order.js
        await this._persistPlaylistConfig();
    },

    /** "Kiểu xem" đổi — ghi + vẽ lại toàn bộ (grid/list khác cấu trúc node, không diff được) + lưu bền. */
    async changeViewMode(mode) {
        setPlaylistViewMode(mode); // core/playlist/main.js — ghi isGridView + className
        applySelectionChrome(appState.get('selectionMode')); // className vừa gán lại làm mất `is-selecting` nếu đang chọn
        workflowPlaylistRender.renderPlaylistFull(); // event/workflow/playlist-render.js
        await this._persistPlaylistConfig();
    },

    /**
     * Ghi bền lựa chọn Playlist (Nguồn/Sắp xếp/Kiểu xem) vào `appConfigPlaylist` + `meta.playlistConfig`. Chủ ý không gồm
     * 3 field "Giải phóng bộ nhớ" — lưu bền sẽ bỏ 1 lớp an toàn cho hành động phá dữ liệu (core/config.js::DEFAULT_PLAYLIST_CONFIG).
     */
    async _persistPlaylistConfig() {
        appConfigPlaylist.setAll(appState.get(['activeMediaSource', 'displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'isGridView']));
        console.log(`writer: "workflowPlaylist._persistPlaylistConfig", page: "appConfigPlaylist", content: "Nguồn/Sắp xếp/Kiểu xem"`);
        await setMeta('playlistConfig', appConfigPlaylist.getAll()); // service/db.js
    },

    /**
     * Khôi phục lựa chọn Playlist lúc boot (event/workflow/app-boot.js, trước khi nạp playlistCache — phải biết Nguồn
     * trước), rồi đồng bộ giao diện. Boot không đi qua switchSource() nên áp giao diện theo Nguồn ở đây.
     */
    async loadPersistedPlaylistConfigOnBoot() {
        const saved = await getMeta('playlistConfig'); // service/db.js
        if (saved && typeof saved === 'object') appConfigPlaylist.mutateAll((cfg) => Object.assign(cfg, saved));
        const cfg = sanitizePlaylistConfig(appConfigPlaylist.getAll()); // core/playlist/main.js
        appState.set('activeMediaSource', cfg.activeMediaSource);
        appState.set('displaySortMode', cfg.displaySortMode);
        appState.set('displayStatSortField', cfg.displayStatSortField);
        appState.set('displayStatSortDirection', cfg.displayStatSortDirection);
        appState.set('isGridView', cfg.isGridView);
        console.log(`writer: "loadPersistedPlaylistConfigOnBoot", page: "activeMediaSource/displaySort*/isGridView", content: "khôi phục từ meta.playlistConfig"`);
        applyPlaylistSourceChrome(t(MEDIA_SWITCH_I18N[cfg.activeMediaSource].placeholderKey), UPLOAD_ACCEPT_BY_SOURCE[cfg.activeMediaSource]); // core/playlist/main.js
        await this.syncPlaylistSettingsUI();
    },

    // ===================== Filter / Sort subpanel =====================

    /** Khôi phục Filter lúc boot (trước khối Scope ở app-boot.js). */
    async loadPersistedFilterConfigOnBoot() {
        await workflowPlaylistFilterPresets.loadOnBoot(); // event/workflow/playlist-filter-presets.js
    },

    /** Panel "Sắp xếp" vừa mở (bodyHtml do event/workflow/app-settings.js dựng) — điền giá trị hiện tại. */
    openSortPanel() {
        const { displaySortMode, displayStatSortField, displayStatSortDirection } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection']);
        syncSortPanelValues(genericDrawerBody, displaySortMode, displayStatSortField, displayStatSortDirection); // core/playlist/main.js
        toggleSortStatDependents(genericDrawerBody, displayStatSortField);
    },

    /** Nút X ở badge "đang Scope folder" — thoát Scope của Nguồn hiện tại, áp "Tất cả" (tự ẩn badge). */
    async exitActiveFolderScope() {
        const mediaType = appState.get('activeMediaSource');
        await withLoadingShield(t('common.loading.generic'), async () => {
            await workflowPlaylistScope.persistScopeChoice(null, mediaType); // event/workflow/playlist-scope.js
            await workflowPlaylistScope.applyAllSongsScope(mediaType);
            workflowPlaylistRender.scrollToCurrentOrTop(); // event/workflow/playlist-render.js
        });
    },

    /** Đồng bộ control Playlist Settings (Kiểu xem, Nguồn) theo appState — dùng sau khi khôi phục cấu hình lúc boot. */
    async syncPlaylistSettingsUI() {
        const { isGridView, activeMediaSource } = appState.get(['isGridView', 'activeMediaSource']);
        PlaylistMain.initViewMode(isGridView); // core/playlist/main.js
        PlaylistMain.initMediaSource(activeMediaSource);
    }
};

