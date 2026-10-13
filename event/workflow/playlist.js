/**
 * event/workflow/playlist.js — Workflow của router "playlist": xoá/sửa/xuất từng mục, ảnh bìa, đổi Nguồn, upload,
 * picker "Thêm vào thư mục", chọn nhiều (phát/xuất ZIP/thêm vào thư mục/xoá hàng loạt), lưu/khôi phục cấu hình Playlist.
 *
 * Shield/modal đặt ở tầng này (core không biết tới). alertModal() không bao giờ gọi bên trong callback của
 * withLoadingShield() — luôn gọi sau khi shield đã đóng.
 */

/** Icon 2 mục dropdown "Choose" ở tab Ảnh bìa (openCoverChooseMenu()) — tên trong kho icon, không có input người dùng. */
const SONG_EDIT_COVER_ICON_PHOTO = iconSvg('photograph');
const SONG_EDIT_COVER_ICON_VIDEO = iconSvg('video-camera');

/** Trần time-picker thời lượng Photo (`openPhotoEditDurationPicker()`) — lựa chọn của chỗ gọi, không phải giới hạn của
 * widget. Phải hữu hạn: cột thô nhất của time-picker dựng đủ `count` dòng DOM thật. Cột 'h' có trần tự nhiên 24, nên
 * 24 giờ cho đúng 24 dòng; rộng hơn nhiều mọi giá trị computePhotoDuration() thực tế tạo ra. */
const PHOTO_EDIT_DURATION_PICKER_MAX_MS = 24 * 60 * 60 * 1000; // 24 giờ

/** `accept` của 2 input upload dùng chung (#media-upload/#media-upload-folder, core/dom-refs.js) theo Nguồn — xem
 * `workflowPlaylist._applyUploadInputAccept()`. */
const UPLOAD_ACCEPT_BY_SOURCE = {
    song: '.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac',
    video: 'video/*',
    photo: 'image/*',
};

/** i18n key theo Nguồn — dùng bởi `workflowPlaylist.switchSource()`. */
const MEDIA_SWITCH_I18N = {
    song: { loadingKey: 'playlistView.loading.withCount', placeholderKey: 'playlistView.search.placeholder' },
    video: { loadingKey: 'playlistView.loading.withCountVideo', placeholderKey: 'playlistView.search.placeholderVideo' },
    photo: { loadingKey: 'playlistView.loading.withCountPhoto', placeholderKey: 'playlistView.search.placeholderPhoto' },
};

/** mediaType -> đọc meta (chỉ cần field `folder` cho workflowFolder.removeItemFromAllFolders()) + xoá record (3 store/1
 * transaction). Dùng bởi deleteMediaFromActionMenu(), deleteSelectedMedia() và
 * event/workflow/file-manager-storage.js::executeDeleteBroken(). Nơi gọi luôn gỡ khỏi folder TRƯỚC khi xoá record. */
const MEDIA_DELETE_ACCESSOR = {
    song: { getRecord: (key) => getMediaMeta('song', key), deleteRecord: (key) => deleteMediaRecord('song', key) }, // service/db.js
    video: { getRecord: (key) => getMediaMeta('video', key), deleteRecord: (key) => deleteMediaRecord('video', key) },
    photo: { getRecord: (key) => getMediaMeta('photo', key), deleteRecord: (key) => deleteMediaRecord('photo', key) },
};

/** Đọc meta cho modal Sửa thông tin: Video/Photo cần field chỉ có trên record (customName/filename/album/width/height)
 * — chỉ store meta, không mở Blob; Song dùng thẳng playlistCache. */
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

/** Icon dùng trong tab "Chi tiết" (tên trong kho assets/icon/icons.js). */
const SONG_INFO_ICON = {
    file: 'document-text',
    resolution: 'arrows-expand',
    album: 'album',
    playCount: 'music-notes',
    clock: 'clock',
    size: 'drive',
    title: 'music-note',
    artist: 'user',
};

/** HTML tab "Chi tiết" theo loại media. renderSongInfoRowHtml(): components/playlist-view.js; formatListenTime():
 * core/listen-stats.js; formatBytes(): core/about-stats.js; formatTime(): core/playlist/state.js. */
const SONG_EDIT_DETAILS_HTML = {
    video: (cached, meta, stats) => {
        const emptyVal = t('playlistView.songInfo.empty');
        const resolutionText = (meta && meta.width && meta.height) ? `${meta.width}×${meta.height}` : emptyVal;
        return renderSongInfoRowHtml(SONG_INFO_ICON.file, 'sky', t('playlistView.songInfo.fieldFilename'), (meta && meta.filename) ? escapeHtml(meta.filename) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.resolution, 'emerald', t('playlistView.songInfo.fieldResolution'), resolutionText)
            + renderSongInfoRowHtml(SONG_INFO_ICON.album, 'fuchsia', t('playlistView.songInfo.fieldAlbum'), (meta && meta.album) ? escapeHtml(meta.album) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.playCount, 'rose', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count }))
            + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'indigo', t('playlistView.songInfo.fieldViewDuration'), formatListenTime(stats.totalTime))
            + renderSongInfoRowHtml(SONG_INFO_ICON.size, 'teal', t('playlistView.songInfo.fieldSize'), formatBytes(cached.size));
    },
    photo: (cached, meta, stats) => {
        const emptyVal = t('playlistView.songInfo.empty');
        const resolutionText = (cached.width && cached.height) ? `${cached.width}×${cached.height}` : emptyVal;
        return renderSongInfoRowHtml(SONG_INFO_ICON.file, 'sky', t('playlistView.songInfo.fieldFilename'), (meta && meta.filename) ? escapeHtml(meta.filename) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.resolution, 'emerald', t('playlistView.songInfo.fieldResolution'), resolutionText)
            + renderSongInfoRowHtml(SONG_INFO_ICON.album, 'fuchsia', t('playlistView.songInfo.fieldAlbum'), (meta && meta.album) ? escapeHtml(meta.album) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'amber', t('playlistView.songInfo.fieldDuration'), formatTime(cached.duration))
            + renderSongInfoRowHtml(SONG_INFO_ICON.playCount, 'rose', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count }))
            + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'indigo', t('playlistView.songInfo.fieldViewDuration'), formatListenTime(stats.totalTime))
            + renderSongInfoRowHtml(SONG_INFO_ICON.size, 'teal', t('playlistView.songInfo.fieldSize'), formatBytes(cached.size));
    },
    song: (cached, meta, stats) => {
        const emptyVal = t('playlistView.songInfo.empty');
        return renderSongInfoRowHtml(SONG_INFO_ICON.title, 'sky', t('playlistView.songInfo.fieldTitle'), cached.tag.title ? escapeHtml(cached.tag.title) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.artist, 'violet', t('playlistView.songInfo.fieldArtist'), cached.tag.artist ? escapeHtml(cached.tag.artist) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.album, 'emerald', t('playlistView.songInfo.fieldAlbum'), cached.tag.album ? escapeHtml(cached.tag.album) : emptyVal)
            + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'amber', t('playlistView.songInfo.fieldDuration'), formatTime(cached.duration))
            + renderSongInfoRowHtml(SONG_INFO_ICON.playCount, 'rose', t('playlistView.songInfo.fieldPlayCount'), tFormat('playlistView.songInfo.fieldPlayCountValue', { n: stats.count }))
            + renderSongInfoRowHtml(SONG_INFO_ICON.clock, 'indigo', t('playlistView.songInfo.fieldListened'), formatListenTime(stats.totalTime))
            + renderSongInfoRowHtml(SONG_INFO_ICON.size, 'teal', t('playlistView.songInfo.fieldSize'), formatBytes(cached.size));
    },
};

/** Ghi âm — lưu bản ghi xong: chỉ Nguồn Song cập nhật danh sách RAM; Video/Photo không làm gì (loader nạp lại từ DB
 * khi chuyển sang Song). */
const RECORDED_SONG_INDEX_BY_SOURCE = {
    song: (key, record) => workflowPlaylist._indexRecordedSongInSongSource(key, record),
    other: () => {},
};

/** switchSource(): Nguồn mới có folder Scope đang nhớ -> áp folder đó; không -> cả thư viện. */
const SOURCE_SCOPE_APPLY_BY_HAS_FOLDER = {
    true: (folderId, mediaType, onProgress) => workflowPlaylistScope.applyFolderScope(folderId, mediaType, onProgress),
    false: (folderId, mediaType, onProgress) => workflowPlaylistScope.applyAllSongsScope(mediaType, onProgress),
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

    /** Đường đóng duy nhất của menu 3 chấm từ Workflow/Router: đóng menu rồi chạy lượt cuộn tới bài đang phát nếu bị
     * hoãn lúc menu còn mở (`workflowPlaylistRender.flushPendingScrollToCurrent()`). */
    closeActionMenu() {
        closeSongActionMenu(); // core/playlist/actions.js
        workflowPlaylistRender.flushPendingScrollToCurrent(); // no-op nếu không có cuộn nào đang chờ
    },

    /** Đổi `accept` của 2 input upload dùng chung theo Nguồn hiện tại. Gọi từ switchSource() và
     * loadPersistedPlaylistConfigOnBoot() — 2 nơi activeMediaSource có thể đổi.
     * @param {'song'|'video'|'photo'} source
     */
    _applyUploadInputAccept(source) {
        const accept = UPLOAD_ACCEPT_BY_SOURCE[source] || UPLOAD_ACCEPT_BY_SOURCE.song;
        if (fileInput) fileInput.accept = accept;
        if (folderInput) folderInput.accept = accept;
    },

    /** Ứng với 'playlist.actionMenu.delete.click' — xoá 1 mục (Song/Video/Photo). Chặn nếu đang phát thật; xoá xong
     * mà là currentKey thì dọn player/UI.
     * @param {string} mediaKey - key do listener đọc sẵn từ `playlistStore` và đặt vào payload.
     */
    deleteMediaFromActionMenu(mediaKey) {
        if (!mediaKey) return; // guard: menu không mở/không xác định được bài nào
        workflowPlaylist.closeActionMenu(); // core/playlist/actions.js

        const cached = appState.get('playlistCache').get(mediaKey);
        const title = cached && cached.tag && cached.tag.title ? cached.tag.title : (cached ? cached.filename : mediaKey);
        // `||` làm lưới an toàn: mediaType falsy vì bất kỳ lý do gì -> coi như Song.
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
            // Gỡ khỏi folder TRƯỚC khi xoá record — tránh "ghost" trong folder.
            const { getRecord, deleteRecord } = MEDIA_DELETE_ACCESSOR[mediaType];
            const record = await getRecord(mediaKey);
            if (record) await workflowFolder.removeItemFromAllFolders(record); // event/workflow/folder.js
            await deleteRecord(mediaKey);
            workflowListenStats.forget(mediaType, mediaKey); // event/workflow/listen-stats.js — dọn thống kê RAM của media đã xoá
            workflowPlaylistOrder.removeKeyFromDisplay(mediaKey); // event/workflow/playlist-order.js

            if (isCurrent && isVideo) {
                // Video đang là currentKey (đã pause, hoặc chưa từng phát) — dọn bgVideoElement/
                // trạng thái Video Player mode qua ĐÚNG hàm đã có sẵn (event/workflow/video-player.js).
                if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode();
                appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
            } else if (isCurrent) {
                // Mục vừa xoá là currentKey (đang pause) — dọn player/UI để không còn currentKey "ma".
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js
                workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js
                if (typeof setVisualizerActiveFalse === 'function') setVisualizerActiveFalse();
            }
        }).then(() => {
            // Shield đã đóng hẳn — an toàn để hiện modal (shield z-200 đè modalChoice z-130).
            alertModal(tFormat('playlistView.songMenu.deleteSuccess', { title }));
        });
    },

    /** Ứng với 'playlist.actionMenu.edit.click'. Đọc key thẳng từ `playlistStore` (chỉ nhánh xoá cần key trong payload
     * để Block gate kiểm "mục này có đang làm Visual Background không"). */
    openSongEditFromActionMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return; // guard: menu không mở
        workflowPlaylist.closeActionMenu(); // core/playlist/actions.js
        this.openSongEditModal(key);
    },

    /**
     * Modal Sửa thông tin dùng chung Song/Video/Photo (rẽ theo `cached.mediaType` bằng object map). Workflow đọc mọi thứ
     * (playlistCache, meta Video/Photo, thống kê), tạo blob URL preview cover, rồi gọi các bước ghi DOM ở
     * core/playlist/actions.js.
     * @param {string} key
     */
    async openSongEditModal(key) {
        const cached = appState.get('playlistCache').get(key);
        if (!cached) return; // guard
        const mediaType = cached.mediaType || 'song';
        const stats = workflowListenStats.getStats(mediaType, key); // event/workflow/listen-stats.js
        const meta = await SONG_EDIT_META_READER[mediaType](key);
        playlistStore.set({ songEditCurrentKey: key, songEditPendingCover: null });
        console.log(`writer: "workflowPlaylist.openSongEditModal", page: "playlistStore.songEditCurrentKey", content: "${key} (${mediaType})"`);
        revokeSongEditPendingPreview(); // core/playlist/actions.js — dọn preview còn sót từ lần mở trước
        toggleSongEditFieldGroups(mediaType); // core/playlist/actions.js
        SONG_EDIT_FIELDS_FILLER[mediaType](cached, meta);
        setSongEditDetailsHtml(SONG_EDIT_DETAILS_HTML[mediaType](cached, meta, stats)); // core/playlist/actions.js
        // Nội dung tab "Chi tiết" là DOM dựng động — không tự ăn theme lúc boot, phải áp ngay ở đây.
        if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(songEditTabDetails, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        setSongEditTab('details'); // core/playlist/actions.js — mở tab "Chi tiết" trước
        showSongEditModal(); // core/playlist/actions.js
    },

    /** Điền tab "Sửa" Song: tag + preview cover HIỆN TẠI (blob URL sống tới lúc đóng modal / đổi ảnh — lưu vào
     * songEditPendingCoverPreviewUrl để được thu hồi đồng bộ). */
    _fillSongEditFields(cached) {
        fillSongEditFields(cached.tag); // core/playlist/actions.js
        const coverUrl = cached.cover ? createBlobUrl(cached.cover) : DEFAULT_VINYL; // service/blob-url.js
        setSongEditCoverPreview(coverUrl); // core/playlist/actions.js
        if (!cached.cover) return;
        playlistStore.set({ songEditPendingCoverPreviewUrl: coverUrl });
        console.log(`writer: "workflowPlaylist._fillSongEditFields", page: "playlistStore.songEditPendingCoverPreviewUrl", content: "blob mới"`);
    },

    /** Điền tab "Sửa" Photo + thời lượng pending (chỉ ghi thật lúc bấm Lưu, cùng nguyên tắc pendingCover của Song). */
    _fillPhotoEditFields(cached, meta) {
        fillPhotoEditFields(meta ? (meta.customName || stripFileExtension(meta.filename)) : '', meta ? (meta.album || '') : '', formatTime(cached.duration)); // core/playlist/actions.js, core/file-manager/video.js, core/playlist/state.js
        playlistStore.set({ songEditPendingPhotoDurationSec: cached.duration || 0 });
        console.log(`writer: "workflowPlaylist._fillPhotoEditFields", page: "playlistStore.songEditPendingPhotoDurationSec", content: "${cached.duration || 0}"`);
    },

    /** Ứng với 'playlist.playbackError.keep' (nút "Giữ lại") — đọc key + ẩn modal (`getAndClearPlaybackErrorKey()`),
     * ghi nhận giữ bài lỗi, bỏ khỏi danh sách hiển thị.
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
     * Ứng với 'playlist.playbackError.delete' — đọc key đang chờ xoá rồi xoá trong shield.
     */
    async executePlaybackErrorDelete() {
        const key = getAndClearPlaybackErrorKey();
        if (!key) return; // không có gì đang mở -> no-op

        await withLoadingShield(t('common.loading.deleting'), async () => {
            await deleteMediaRecord('song', key); // service/db.js
            workflowListenStats.forget('song', key); // event/workflow/listen-stats.js
            workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
        });
        // Luồng này không hiện thông báo sau khi xoá.
    },

    /** Ứng với 'playlist.editCover.choose.click' — dropdown nổi dùng chung (core/dropdown-menu.js) neo dưới nút "Choose";
     * z-index mặc định 127 > modal Sửa thông tin (z-120). Mỗi mục chỉ bắn eventBus (Rule 5a). */
    openCoverChooseMenu() {
        if (!songEditCoverChooseBtn) return; // guard: template chưa mount
        const send = (type) => () => eventBus.send({ router: 'playlist', type, payload: {} });
        openDropdownMenu(songEditCoverChooseBtn, [ // core/dropdown-menu.js
            { icon: SONG_EDIT_COVER_ICON_PHOTO, name: t('playlistView.songEdit.coverFromPhoto'), callback: send('playlist.editCover.pickFromLibrary') },
            { icon: SONG_EDIT_COVER_ICON_VIDEO, name: t('playlistView.songEdit.coverFromVideoThumb'), callback: send('playlist.editCover.pickFromVideoThumb') },
        ]);
    },

    /** "Choose" -> "Photo": picker chọn 1 ảnh thư viện (event/workflow/file-manager-photo.js). */
    pickCoverFromLibrary() {
        workflowFileManagerPhoto.openCoverImagePicker((imageKey) => { // event/workflow/file-manager-photo.js
            this.applyCoverFromLibrary(imageKey);
        });
    },

    // ===================== Ảnh bìa từ thumb video =====================
    // "Choose" -> "Video thumbnail": picker video (Generic Drawer, single-select) -> `thumbBlob` (vuông 320px; record cũ
    // thiếu thì lùi về `thumbFullBlob`) -> `File` -> changeSongEditCover(): ảnh chỉ là pending, Lưu mới ghi DB + APIC.
    // Mở mới (modal Sửa thông tin không nằm trong Generic Drawer), đợi drawer trượt xong rồi mới đọc DB + dựng lưới.
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

    /** Callback picker ảnh — bọc Blob thành `File` (File là Blob) rồi changeSongEditCover() (pending).
     * @param {string} imageKey
     */
    async applyCoverFromLibrary(imageKey) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const file = new File([record.blob], record.filename, { type: record.blob.type });
        const result = changeSongEditCover(file); // core/playlist/actions.js
        if (result.status === 'invalid') {
            await alertModal(result.reason);
        }
    },

    /** "Dọn dẹp sau khi lưu" 1 media: vẽ lại đúng hàng đó, đổi tên có thể ảnh hưởng sort -> cập nhật thứ tự hiển thị (chỉ
     * khi 'az'/'za') + thứ tự render rồi diff lại danh sách.
     * @param {string} key */
    _refreshAfterMediaEditSave(key) {
        workflowPlaylistRender.refreshSongNode(key); // event/workflow/playlist-render.js — ảnh cũ trong DOM không tự đổi
        const nameMode = appState.get('displaySortMode');
        if (nameMode === 'az' || nameMode === 'za') workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
    },

    /**
     * Ứng với 'playlist.edit.save' — rẽ theo loại media (object map); ghi qua `updateMediaMeta()` (chỉ store meta) với
     * meta mới do core thuần dựng (`build*EditMeta`, core/playlist/actions.js); cập nhật RAM/DOM sau khi lưu ở
     * `_syncEdited*Runtime()`.
     */
    async executeSaveEdit() {
        const key = playlistStore.get('songEditCurrentKey');
        if (!key) return; // không có modal nào đang mở -> no-op
        const cached = appState.get('playlistCache').get(key);
        const mediaType = (cached && cached.mediaType) || 'song';
        const saveByType = {
            video: () => this._saveVideoEdit(key),
            photo: () => this._savePhotoEdit(key),
            song: () => this._saveSongEdit(key),
        };
        const result = await saveByType[mediaType]();
        // Shield đã đóng hẳn — an toàn để hiện modal.
        if (result.status === 'notFound') await alertModal(t('common.songEdit.notFound'));
        closeSongEditModal(); // core/playlist/actions.js — đóng modal trong mọi trường hợp
        this._refreshAfterMediaEditSave(key);
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

    /** Cập nhật RAM/DOM sau khi lưu tab "Sửa" Video (playlistCache, songNameIndex, tiêu đề player, Media Session). */
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

    /** Bản Photo của `_syncEditedVideoRuntime()`. */
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

    /** Bản Song. Ảnh bìa trong RAM/DOM chỉ đổi khi người dùng
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

    /** Thay URL ảnh bìa bài đang phát (thu hồi URL blob cũ) + gán lại #record-art. Dùng chung với
     * workflowPlayer.reloadCurrentSongKeepingPosition() (`mediaInUse`). #record-art tạo lại qua innerHTML mỗi lần đổi bài
     * nên getElementById tại chỗ; gắn lại fallback mỗi lần đổi src.
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

    /** Nút duration ở tab "Sửa" của Photo — mở time-picker h-m-s (core/time-picker-modal.js). Chỉ có sàn; `maxMs` là
     * config của chỗ gọi (`PHOTO_EDIT_DURATION_PICKER_MAX_MS`). Giá trị trong DB không bị kẹp — vượt 24 giờ thì picker chỉ
     * kẹp phần hiển thị. */
    openPhotoEditDurationPicker() {
        const currentSec = playlistStore.get('songEditPendingPhotoDurationSec') || 0;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('playlistView.songEdit.durationPickerTitle'),
            format: 'h-m-s',
            valueMs: currentSec * 1000,
            minMs: DURATION_MIN_SEC * 1000, // event/workflow/file-manager-photo.js — cùng sàn computePhotoDuration()
            maxMs: PHOTO_EDIT_DURATION_PICKER_MAX_MS,
            onConfirm: (resultMs) => {
                const resultSec = Math.round(resultMs / 1000 * 100) / 100;
                playlistStore.set({ songEditPendingPhotoDurationSec: resultSec });
                if (songEditPhotoDurationValueEl) songEditPhotoDurationValueEl.textContent = formatTime(resultSec); // core/playlist/state.js
            },
        });
    },

    // ===================== Chọn nhiều =====================
    // Render danh sách (render.js) không đọc selectionMode/selectedMediaKeys — lớp chọn là DOM-patch riêng
    // (core/playlist/selection.js, hàm thuần nhận state qua tham số). Workflow đọc appState rồi gọi nối tiếp.

    /** Dọn dẹp dùng chung khi thoát chế độ chọn (4 hành động dưới gọi sau khi xong việc). */
    _exitSelectionMode() {
        // Chỉ gỡ dấu ở node ĐÃ CHỌN (vòng trống của node còn lại là CSS theo class `is-selecting`). Lấy danh sách TRƯỚC khi
        // disableSelectionMode() xoá tập chọn.
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
        const selectedKeysBefore = [...appState.get('selectedMediaKeys')]; // lấy TRƯỚC khi disableSelectionMode() xoá tập chọn
        VirtualMachineState.run([
            { state: enabled, operation: '===', value: true, callback: () => enableSelectionMode() },
            { state: enabled, operation: '===', value: false, callback: () => disableSelectionMode() },
        ]);
        const selectedMediaKeys = appState.get('selectedMediaKeys'); // đọc LẠI sau khi core ghi xong (disableSelectionMode có thể vừa clear nó)
        const domNodesByKey = appState.get('domNodesByKey');
        const themeClasses = this._selectionThemeClasses();
        // Chỉ lặp qua key ĐÃ CHỌN — vòng tròn trống + ẩn nút 3 chấm là CSS theo class `is-selecting` (applySelectionChrome()).
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
        // Đang ở trong chế độ chọn (router chỉ gọi khi selectionMode=true) -> luôn showSelectionIndicator; chọn/bỏ chọn
        // chỉ đổi màu/tick bên trong.
        showSelectionIndicator(node, key, selectedMediaKeys, this._selectionThemeClasses());
        updateSelectionActionBar(appState.get('selectionMode'), selectedMediaKeys.size);
    },

    /** Class theo theme đang active cho chỉ báo chọn nhiều — tra 1 lần ở Workflow rồi truyền xuống
     * `showSelectionIndicator()` (core lá, không tự tra theme). `selectionTintBg`/`btnPrimaryPillBg`/`textOnAccent`: core/ui-theme/*.js.
     * @returns {{tint:string, indicatorSelected:string}} */
    _selectionThemeClasses() {
        return {
            tint: resolveUiThemeClass(_activeUiThemeKeyList, 'selectionTintBg'), // core/ui-theme/registry.js + apply-ui.js
            indicatorSelected: `${resolveUiThemeClass(_activeUiThemeKeyList, 'btnPrimaryPillBg')} ${resolveUiThemeClass(_activeUiThemeKeyList, 'textOnAccent')}`,
        };
    },

    /** Ứng với 'playlist.uploadMenu.open' khi selectionMode=true — chỉ hiện modal báo chặn, không mở menu upload. */
    async showUploadBlockedBySelectionModal() {
        await alertModal(t('playlistView.selection.uploadBlocked'));
    },

    // ===================== Chụp khung hình đầu video lúc upload =====================
    // Cửa ngõ tới event/workflow/video-thumb-extract.js (workflowVideoThumbExtract) cho uploadVideos(),
    // workflowFileManagerStorage.

    /** Xem workflowVideoThumbExtract.extract() (event/workflow/video-thumb-extract.js).
     * @param {File|Blob} file @returns {Promise<{thumbBlob: Blob, thumbFullBlob: Blob, thumbFullIsBlack: boolean, width: number, height: number, duration: number}>} */
    extractVideoThumbAndMeta(file) {
        return workflowVideoThumbExtract.extract(file); // event/workflow/video-thumb-extract.js
    },

    /** Xem workflowVideoThumbExtract.probeFrame(). @returns {{drawn: boolean, isBlack: boolean}} */
    _probeVideoFrame(source) {
        return workflowVideoThumbExtract.probeFrame(source); // event/workflow/video-thumb-extract.js
    },

    // ===================== Upload Song =====================

    /**
     * Đưa 1 record Song vừa ghi DB vào danh sách RAM (Nguồn Song). `isNew` = key chưa có trong playlistOrder. Object ghi
     * vào cache đủ addedAt/size như `buildSongPlaylistCache()`. Chỉ gọi khi Nguồn là Song (Video/Photo dùng chung các map).
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
     * Làm mới danh sách sau khi thêm bài (Nguồn Song).
     * @param {string[]} newlyAddedKeys - CHỈ key mới (không gồm ghi đè)
     */
    _refreshPlaylistAfterSongsAdded(newlyAddedKeys) {
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.applyNewSongsToDisplayOrder(newlyAddedKeys); // (B) hàng đợi phát: nối cuối / pending
        workflowPlaylistOrder.recomputeRenderOrder(); // (A) UI: sắp xếp lại NGAY
        workflowPlaylistRender.renderPlaylistDiff();
    },

    /**
     * Đọc `folder_song` của folder đích rồi `addSongsToFolder()` (core/file-manager/folder.js); folder không tồn tại thì
     * dừng. Dùng chung mọi nơi thêm media vào folder (upload, ghi âm, picker "Thêm vào thư mục", Video editor "Lưu mới").
     * @param {string[]} keys @param {string} folderId @param {'song'|'video'|'photo'} mediaType
     * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
     */
    async addMediaToFolder(keys, folderId, mediaType) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        if (!folderMap) return { status: 'notFound', addedCount: 0 };
        return addSongsToFolder(keys, folderId, mediaType, folderMap); // core/file-manager/folder.js
    },

    /** Đang Scope 1 folder Song thì gắn mọi key (mới hoặc ghi đè) vào folder đó — 1 lượt bulk. Đọc
     * `activePlayListFolder.song` — đúng folder Song kể cả khi Nguồn đang là Video (Ghi âm lúc phát Video).
     * @param {string[]} keys */
    async _attachSongsToActiveSongFolder(keys) {
        const activeFolderIdForSong = appState.get('activePlayListFolder').song;
        if (!activeFolderIdForSong || keys.length === 0) return;
        await this.addMediaToFolder(keys, activeFolderIdForSong, 'song');
    },

    /**
     * Ghi âm — lưu bản ghi thành 1 Song mới (tên có dấu thời gian tới giây -> không đè). Luôn ghi DB + gắn folder Song đang
     * active. Danh sách RAM chỉ cập nhật khi Nguồn là Song; Nguồn khác thì chuyển sang Song loader tự nạp lại.
     * @param {{filename:string, blob:Blob, tag:{title:string, artist:string, album:string}, cover:Blob|null, duration:number}} song
     * @returns {Promise<string>} key vừa lưu
     */
    async addRecordedSong(song) {
        const key = await resolveSongKey(song.filename); // service/db.js
        // Cover lấy từ playlistCache (Blob đọc từ IndexedDB) -> vật chất hoá thành Blob mới trước khi ghi sang record khác.
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

    /** Nạp 1 FileList Song (input file rời hoặc cả thư mục — webkitdirectory trả mọi file kể cả không phải nhạc,
     * validateAudioFile() loại bớt). */
    async uploadSongs(fileList) {
      try {
        const allFiles = Array.from(fileList); if (allFiles.length === 0) return;
        playlistEmpty.classList.add('hidden');

        const failedFiles = [];
        const newlyAddedKeys = [];
        // Mọi key ghi thành công (mới hoặc ghi đè) — gắn folder đang active cuối hàm.
        const allProcessedKeys = [];

        // Lọc định dạng + dung lượng (core/upload-validation.js) ngay khi nhận file — `accept` chỉ là gợi ý. File không hợp lệ
        // liệt kê chung với failedFiles, không vào IndexedDB/playlist. Báo lỗi đầu tiên gặp phải.
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
        // Set tra cứu O(1) thay `playlistOrder.includes()` trong vòng lặp; thêm key ngay khi push (2 file trùng tên trong cùng
        // lượt có thể ra cùng 1 key).
        const playlistOrderSet = new Set(appState.get('playlistOrder'));

        // withLoadingShield() im lặng bỏ qua nếu shield đang bận tác vụ khác — theo dõi qua cờ để báo rõ.
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
                                                // jsmediatags có thể trả `format` rỗng/không phải MIME ảnh (tag hỏng) — Blob
                                                // vẫn tạo được nhưng <img> không decode. Kiểm bằng VALID_IMAGE_MIME_TYPES, sai
                                                // thì bỏ cover (fallback DEFAULT_VINYL).
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

                    // iOS: File của ô chọn file có thể trỏ tới file tạm của trình chọn — vào nền thì bị thu/dọn, nguồn phát
                    // chết. Vật chất hoá thành Blob trong RAM trước khi ghi (chỉ Song — phát nền).
                    const ownedBlob = await rematerializeBlob(file); // service/db.js
                    const record = { filename: file.name, blob: ownedBlob, tag, cover, subtitles: [], duration, addedAt: Date.now() };
                    if (isOverwrite) {
                        // Chỉ đọc meta. Ghi đè giữ lại phụ đề + folder / thống kê / điểm Game.
                        const old = await getMediaMeta('song', key); // service/db.js
                        if (old) Object.assign(record, { subtitles: old.subtitles || [], folder: old.folder, stats: old.stats, game: old.game });
                    }
                    await createMediaRecord('song', key, record); // service/db.js — 3 store, file + cover đều là Blob mới
                    // Báo `mediaInUse`: mục này đang phát/đang dùng thì tự nạp lại.
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'song', key } });
                    // Gom key (cả mới lẫn ghi đè) — gắn folder hàng loạt sau vòng lặp.
                    allProcessedKeys.push(key);

                    if (!isOverwrite) { playlistOrderSet.add(key); newlyAddedKeys.push(key); }
                    this._indexSongInPlaylistState(key, record, !isOverwrite);
                } catch (err) {
                    console.error(`[playlist] Không nạp được "${file.name}":`, err);
                    const errMsg = (err && err.name && err.message) ? `${err.name}: ${err.message}` : String(err && err.message || err || t('common.unknownError'));
                    failedFiles.push(`${escapeHtml(file.name)} — ${escapeHtml(errMsg)}`);
                }
            }
            this._refreshPlaylistAfterSongsAdded(newlyAddedKeys);
            await this._attachSongsToActiveSongFolder(allProcessedKeys);
        });

        if (!shieldRan) {
            // withLoadingShield() bỏ qua vì đang bận tác vụ khác — báo rõ thay vì im lặng.
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

    /** Input chọn file rời (#media-upload, dùng chung 3 Nguồn — router chỉ gọi hàm này khi Nguồn là Song).
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

    /** Input chọn cả thư mục (#media-upload-folder — router chỉ gọi khi Nguồn là Song).
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

    /** Upload Video (2 input dùng chung, router rẽ theo activeMediaSource). Lỗi 1 file không chặn cả lô — bỏ qua file đó.
     * Tiến trình "X/Y" qua `loadingText` (`common.upload.loadingProgress`). File thiếu khung full-res bị
     * extractVideoThumbAndMeta() reject -> skip, cuối lô báo riêng danh sách tên + khuyến nghị upload lại.
     * @param {FileList|File[]} files
     */
    async uploadVideos(files) {
        // Tách file quá 500MB ra trước vòng nạp, báo riêng cuối hàm.
        const { acceptedFiles: fileArray, oversizedLines } = this._splitOversizedFiles(files);
        if (fileArray.length === 0) { await this._alertOversizedFiles(oversizedLines); return; }

        let failedCount = 0;
        const skippedFilenames = []; // tên file bị skip, báo cuối lô
        const uploadedVideoKeys = []; // gắn folder hàng loạt sau vòng lặp
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
                try {
                    const { thumbBlob, thumbFullBlob, thumbFullIsBlack, width, height, duration } = await this.extractVideoThumbAndMeta(file);
                    const videoKey = await resolveVideoKey(file.name); // service/db.js
                    await saveVideo(videoKey, file, file.name, thumbBlob, width, height, duration, thumbFullBlob, thumbFullIsBlack); // core/file-manager/video.js
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'video', key: videoKey } }); // trùng tên = ghi đè, trung tâm tự nạp lại nếu đ
                    uploadedVideoKeys.push(videoKey);
                } catch (err) {
                    console.error(`[uploadVideos] chụp thumbnail/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                    skippedFilenames.push(file.name);
                }
            }
            // Đang Scope 1 folder Video -> gắn mọi file vừa upload vào folder đó.
            const activeFolderIdForVideo = appState.get('activePlayListFolder').video;
            if (activeFolderIdForVideo && uploadedVideoKeys.length > 0) {
                await this.addMediaToFolder(uploadedVideoKeys, activeFolderIdForVideo, 'video');
            }
        });
        // input tự dọn value trong chính listener của nó (event/listener/playlist.js, fileInput/folderInput dùng chung).
        // Playlist đang ở Nguồn Video -> làm mới ngay để Next/Prev thấy video vừa upload.
        await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard activeMediaSource, no-op nếu Playlist không ở nguồn Video
        const successCount = fileArray.length - failedCount;
        await this._alertOversizedFiles(oversizedLines); // file quá 500MB bị bỏ qua
        // Báo file bị skip trước (tên file là dữ liệu người dùng -> escapeHtml()), rồi mới báo thành công.
        if (skippedFilenames.length > 0) {
            const namesHtml = skippedFilenames.map((n) => escapeHtml(n)).join(', ');
            await alertModal(tFormat('fileManager.video.uploadSkipped', { count: skippedFilenames.length, names: namesHtml }), { title: t('fileManager.video.uploadSkippedTitle') });
        }
        if (successCount > 0) {
            await alertModal(tFormat('fileManager.video.uploadSuccess', { count: successCount }));
        }
    },

    /** Ứng với 'playlist.upload.fileChange'/'playlist.upload.folderChange' khi activeMediaSource=
     * 'photo' — cùng khuôn uploadVideos(): shield + tiến trình "X/Y" + bắt lỗi từng file. Mỗi file: resize thumbnail +
     * tính duration (workflowFileManagerPhoto) rồi `saveImage()`. Xong thì làm mới Playlist nếu đang ở Nguồn Photo.
     * @param {FileList|File[]} files
     */
    async uploadPhotos(files) {
        // Giới hạn 500MB/file như uploadVideos().
        const { acceptedFiles: fileArray, oversizedLines } = this._splitOversizedFiles(files);
        if (fileArray.length === 0) { await this._alertOversizedFiles(oversizedLines); return; }

        let failedCount = 0;
        const uploadedImageKeys = []; // gắn folder hàng loạt sau vòng lặp
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
                try {
                    const { thumbBlob, width, height } = await workflowFileManagerPhoto.resizeImageForThumbnail(file); // event/workflow/file-manager-photo.js
                    const duration = await workflowFileManagerPhoto.computePhotoDuration(file, width, height); // event/workflow/file-manager-photo.js
                    const imageKey = await resolveImageKey(file.name); // service/db.js
                    await saveImage(imageKey, file, file.name, thumbBlob, width, height, duration); // core/file-manager/image.js
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'photo', key: imageKey } }); // trùng tên = ghi đè
                    uploadedImageKeys.push(imageKey);
                } catch (err) {
                    console.error(`[uploadPhotos] resize/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
            // Đang Scope 1 folder Photo -> gắn mọi ảnh vừa upload vào folder đó.
            const activeFolderIdForPhoto = appState.get('activePlayListFolder').photo;
            if (activeFolderIdForPhoto && uploadedImageKeys.length > 0) {
                await this.addMediaToFolder(uploadedImageKeys, activeFolderIdForPhoto, 'photo');
            }
        });
        // input tự dọn value trong chính listener của nó (event/listener/playlist.js, fileInput/folderInput dùng chung).
        // Làm mới Playlist ngay nếu đang ở Nguồn Photo — apply*Scope() tự nạp lại đúng phạm vi + Filter + render.
        if (appState.get('activeMediaSource') === 'photo') {
            const activeFolderIdForPhotoRefresh = appState.get('activePlayListFolder').photo;
            if (activeFolderIdForPhotoRefresh) await workflowPlaylistScope.applyFolderScope(activeFolderIdForPhotoRefresh, 'photo');
            else await workflowPlaylistScope.applyAllSongsScope('photo');
            console.log(`writer: "uploadPhotos", page: "playlistOrder", content: "${appState.get('playlistOrder').length} ảnh (làm mới sau upload)"`);
        }
        const successCount = fileArray.length - failedCount;
        await this._alertOversizedFiles(oversizedLines); // file quá 500MB bị bỏ qua
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: successCount })); // tái dùng NGUYÊN lang key cũ của Photo Panel
    },

    /**
     * Giới hạn 500MB/file — dùng chung uploadVideos()/uploadPhotos():
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
     * "Phát bài đã chọn" — sắp tập đã chọn theo displaySortMode hiện tại (sortKeysByMode()), đặt sectionQueueActive=true
     * (2 nút to Phát/Trộn bài biết cần chèn lại top-level trước khi phát) và, nếu Shuffle đang bật, resync shuffleIndices
     * theo section mới (tránh Next/Prev đầu tiên tràn sang top-level).
     */
    playSelectedSongs() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return; // guard — chưa chọn gì thì không làm gì

        const { displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache: cache, mediaStatsMap, activeMediaSource } = appState.get(['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap', 'activeMediaSource']);
        const sorted = sortKeysByMode(keys, nameMode, statField, statDirection, songNameIndex, cache, mediaStatsMap, activeMediaSource); // core/playlist/order.js
        appState.set('displayOrder', sorted);
        console.log(`writer: "playSelectedSongs", page: "displayOrder", content: "${sorted.length} bài đã chọn, sort theo displaySortMode hiện tại"`);
        appState.mutate('pendingResortKeys', s => s.clear());
        console.log(`writer: "playSelectedSongs", page: "pendingResortKeys", content: "clear toàn bộ"`);

        appState.set('sectionQueueActive', true);
        console.log(`writer: "playSelectedSongs", page: "sectionQueueActive", content: "true"`);
        if (appState.get('isShuffle')) {
            updateShuffleArrayFromQueue(sorted, appState.get('playlistOrder'), true); // core/playlist/order.js
        }

        this._exitSelectionMode(); // thoát chế độ chọn trước khi chuyển màn hình phát
        workflowPlayer.playMedia(sorted[0]); // event/workflow/player.js
    },

    /**
     * "Xuất ZIP" (Song) — gắn tag mới nhất cho từng bài (buildTaggedBlob(), core/id3-export.js) rồi nén qua
     * workflowZipDownload (chia phần <= 500MB). Không dùng exportSongWithTag() (mỗi lần tự bọc shield — lồng shield bị chặn)
     * và giữ đường riêng để đếm `failedCount` bài phải dùng file gốc.
     */
    async exportSelectedSongsZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let failedCount = 0;
        let zipParts;
        // Chữ + % tiến độ như zipAndDownloadOrFallback(): `common.storage.zippingStart`, rồi `common.storage.zippingProgress`.
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            const entries = [];
            for (const key of keys) {
                const record = await getSongRecord(key);
                if (!record) { failedCount++; continue; } // guard: bài không còn tồn tại (race) — bỏ qua
                try {
                    const taggedBlob = await buildTaggedBlob(record); // core/id3-export.js
                    entries.push({ filename: record.filename, blob: taggedBlob });
                } catch (e) {
                    console.error('[workflow:playlist] Lỗi ghi tag lúc xuất ZIP hàng loạt, dùng file gốc thay thế:', e);
                    entries.push({ filename: record.filename, blob: record.blob });
                    failedCount++;
                }
            }
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilename')); // event/workflow/zip-download.js
        });

        this._exitSelectionMode();
        // Shield đã đóng hẳn — an toàn để hiện modal. Tải xuống qua modal "File đã sẵn sàng" (nút trong modal gọi
        // triggerDownload() với user-activation mới — PWA iOS không mở Quick Look).
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — 1 phần: modal cũ; nhiều phần: modal danh sách; tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất file" 1 bài Song (ghi tag ID3).
     */
    async exportSongWithTag(key) {
        // Không await alertModal() bên trong withLoadingShield() (shield chỉ giải phóng sau khi fn() resolve -> lồng nhau làm
        // shield treo đè modal). Mang kết quả ra ngoài bằng cờ, hiện modal sau khi shield đóng.
        let resultFlag = null; // null = ổn (không cần báo gì) | 'notFound' | 'tagWriteFailed'
        let successBlob = null; let successFilename = null; // mang blob thành công ra ngoài shield để prompt download sau
        let failedRecord = null; // giữ lại record gốc khi ghi tag lỗi — dùng để tải file gốc ở ngoài, tránh query lại DB lần 2
        await withLoadingShield(t('common.loading.exportingFile'), async () => {
            const record = await getSongRecord(key);
            if (!record) { resultFlag = 'notFound'; return; }
            try {
                const taggedBlob = await buildTaggedBlob(record); // core/id3-export.js
                successBlob = taggedBlob; successFilename = record.filename;
            } catch (e) {
                console.error('[workflow:playlist] Lỗi ghi tag lúc xuất file:', e);
                resultFlag = 'tagWriteFailed';
                failedRecord = record;
                // Thứ tự: báo lỗi xong rồi mới tải file gốc (chưa ghi tag).
            }
        });

        // Shield đã đóng hẳn — an toàn để hiện modal.
        if (resultFlag === 'notFound') {
            await alertModal(t('common.export.notFound'));
        } else if (resultFlag === 'tagWriteFailed') {
            await alertModal(t('common.export.tagWriteFailed'));
            await workflowZipDownload.promptSingle(failedRecord.blob, failedRecord.filename); // event/workflow/zip-download.js
        } else {
            await workflowZipDownload.promptSingle(successBlob, successFilename); // event/workflow/zip-download.js
        }
    },

    /**
     * "Xuất file" 1 Video — tải thẳng record.blob/filename gốc (Video không có tag ID3; `customName` không ghi vào file).
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
        await workflowZipDownload.promptSingle(blob, filename); // event/workflow/zip-download.js
    },

    /**
     * "Xuất file" 1 ảnh — tải thẳng record.blob/filename gốc.
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
        await workflowZipDownload.promptSingle(blob, filename); // event/workflow/zip-download.js
    },

    /**
     * "Xuất ZIP" (Video) — như exportSelectedSongsZip(), không gắn tag.
     */
    async exportSelectedVideosZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let zipParts;
        let entries;
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            entries = await workflowZipDownload.collectEntries('video', keys); // event/workflow/zip-download.js — tự bỏ qua key không còn tồn tại
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilenameVideo')); // event/workflow/zip-download.js
        });
        const failedCount = keys.length - entries.length; // key bị bỏ qua (không còn tồn tại)

        this._exitSelectionMode();
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất ZIP" (Photo) — như exportSelectedVideosZip().
     */
    async exportSelectedImagesZip() {
        const keys = Array.from(appState.get('selectedMediaKeys'));
        if (keys.length === 0) return;

        let zipParts;
        let entries;
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            entries = await workflowZipDownload.collectEntries('photo', keys); // event/workflow/zip-download.js — tự bỏ qua key không còn tồn tại
            zipParts = await workflowZipDownload.compressInParts(entries, t('playlistView.selection.exportZipFilenamePhoto')); // event/workflow/zip-download.js
        });
        const failedCount = keys.length - entries.length; // key bị bỏ qua (không còn tồn tại)

        this._exitSelectionMode();
        await workflowZipDownload.deliver(zipParts); // event/workflow/zip-download.js — tự dọn file tạm OPFS
        if (failedCount > 0) await alertModal(t('playlistView.selection.exportPartialFail'));
    },

    /**
     * "Xuất file" cho mục đang mở menu 3 chấm: đọc key, đóng menu, rẽ theo `activeMediaSource` (mục luôn cùng loại với
     * Nguồn) — Song: exportSongWithTag(); Video: exportVideoFile(); Photo: exportImageFile().
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
     * "Sửa phụ đề" trong menu 3 chấm: đọc key, đóng menu, rồi `workflowSubtitleModal.navigateToEditor()` (cùng điều hướng
     * với nút Sub ở Control Center).
     */
    openSubtitleEditorForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowSubtitleModal.navigateToEditor(key);
    },

    /**
     * "Sửa video" trong menu 3 chấm — chuyển sang trang pages/video-editor.html (key mã hoá qua service/song-key-cipher.js).
     */
    navigateToActiveMenuVideoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        window.location.href = `pages/video-editor.html?video=${encodeSongKeyForUrl(key)}`;
    },

    /** "Edit image" trong menu 3 chấm — mở modal xem/sửa ảnh (event/workflow/file-manager-photo.js). */
    navigateToActiveMenuPhotoEdit() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();
        workflowFileManagerPhoto.openImagePreview(key); // event/workflow/file-manager-photo.js
    },

    /** Lọc danh sách folder cho picker "Thêm vào thư mục" — loại 2 loại folder không hợp lệ làm đích:
     *   - Folder ĐANG là Scope hiện tại của ĐÚNG Nguồn này — thêm vào chính folder đang xem không
     *     có ý nghĩa (bài đã hiển thị THÔNG QUA scope đó rồi).
     *   - Folder Read-only.
     * Nhận `folders` (đã đọc qua `workflowFolder.list()`) qua tham số.
     * @param {Array<{id:string, isReadOnly?:boolean}>} folders
     * @param {'song'|'video'|'photo'} mediaType
     * @returns {Array}
     */
    _filterFoldersForAddPicker(folders, mediaType) {
        const activeFolderId = appState.get('activePlayListFolder')[mediaType];
        return folders.filter((f) => f.id !== activeFolderId && !f.isReadOnly);
    },

    /**
     * "Thêm vào thư mục" cho 1 mục từ menu 3 chấm. Tách khỏi bản chọn nhiều (openAddToFolderPicker()) vì nguồn key khác
     * (`songActionMenuKey` trong playlistStore vs `selectedMediaKeys`) và đóng menu khác nhau; cả 2 dùng chung
     * `_openFolderPickerDrawer()`, chỉ khác `onPick`. Picker chỉ hiện folder đúng type của Nguồn đang active.
     */
    async openAddToFolderPickerForSongMenu() {
        const key = playlistStore.get('songActionMenuKey');
        if (!key) return;
        workflowPlaylist.closeActionMenu();

        const mediaType = appState.get('activeMediaSource');
        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await this.addMediaToFolder([key], folderId, mediaType);
            });
            // Thêm vào folder chỉ đổi dữ liệu trong folder, không áp lại Playlist đang chạy (lần áp Scope kế tiếp tự đọc).
            await alertModal(tFormat(mediaType === 'video' ? 'fileManager.folderPicker.addSuccessVideo' : mediaType === 'photo' ? 'fileManager.folderPicker.addSuccessPhoto' : 'fileManager.folderPicker.addSuccess', { count: 1 }));
        }, { folders: this._filterFoldersForAddPicker(await workflowFolder.list(mediaType), mediaType) }); // event/workflow/folder.js
    },

    /**
     * "Thêm vào thư mục" (chọn nhiều) — cùng `_openFolderPickerDrawer()` với bản 1-bài ở trên, chỉ
     * khác `onPick` (nhiều key + thoát chế độ chọn).
     */
    async openAddToFolderPicker() {
        const { selectedMediaKeys, activeMediaSource: mediaType } = appState.get(['selectedMediaKeys', 'activeMediaSource']);
        const keys = Array.from(selectedMediaKeys);
        if (keys.length === 0) return;
        // Lọc danh sách folder theo ĐÚNG type của Nguồn đang active (cùng bản 1-bài ngay trên).
        await this._openFolderPickerDrawer(async (folderId) => {
            let result;
            await withLoadingShield(t('common.loading.savingInfo'), async () => {
                result = await this.addMediaToFolder(keys, folderId, mediaType);
            });
            // Không áp lại Playlist đang chạy (xem bản 1 mục).
            this._exitSelectionMode();
            await alertModal(tFormat(mediaType === 'video' ? 'fileManager.folderPicker.addSuccessVideo' : mediaType === 'photo' ? 'fileManager.folderPicker.addSuccessPhoto' : 'fileManager.folderPicker.addSuccess', { count: keys.length }));
        }, { folders: this._filterFoldersForAddPicker(await workflowFolder.list(mediaType), mediaType) }); // event/workflow/folder.js
    },

    // ===================== Picker "Thêm vào thư mục" — Generic Drawer grid =====================
    // Grid folder (components/items.js::itemTemplateFolderTile()) + tile "Tạo folder mới" cuối grid (bấm tạo ngay 1 folder
    // tên tự động, vào thẳng chế độ sửa tên). Mọi tương tác trong Drawer đi qua eventBus.

    _folderPickerShowAddTile: true, // false khi nơi gọi không cho tạo folder mới giữa chừng
    _folderPickerEmptyMsg: '',      // câu hiển thị khi danh sách rỗng (rỗng = grid trống)
    _folderPickerFolders: [], // danh sách folder ĐANG hiển thị trong grid — cache RAM, chỉ dùng lúc Drawer đang mở
    _folderPickerEditingId: null, // folderId đang ở chế độ sửa tên (null = không có)
    _folderPickerOnPick: null, // callback(folderId) HOẶC callback(folderIds[], type) nếu multiSelect — set bởi entry method, gọi khi user CHỌN xong
    // Chế độ multi-select (Visual Background "Thư mục" — gộp nhiều folder). Tắt = tap 1 tile là chọn ngay + đóng.
    _folderPickerMultiSelect: false,
    _folderPickerSelectedIds: [], // ordered — thứ tự CHỌN, chỉ dùng khi multiSelect
    _folderPickerTypeOptions: null, // { current: 'video'|'photo' } | null — có giá trị -> hiện dropdown đổi loại trong header
    _folderPickerOnTypeChange: null, // callback(newType) — nơi gọi (Visual Background) tự lo re-fetch + gọi lại _openFolderPickerDrawer(isUpdate=true)

    /** Mở Drawer lần đầu (hoặc vẽ lại TẠI CHỖ nếu `isUpdate`) — đọc danh sách folder, vẽ grid, wire
     * sự kiện. */
    async _openFolderPickerDrawer(onPick, options, isUpdate) {
        // `options` (tuỳ chọn — không truyền = 2 luồng "Thêm vào thư mục" của Playlist):
        //   `folders`      — danh sách đã lọc sẵn do nơi gọi chuẩn bị.
        //   `showAddTile`  — false để bỏ tile "Tạo folder mới" (Visual Background: folder mới luôn rỗng, không làm nguồn được).
        //   `emptyMsg`     — câu hiển thị khi danh sách rỗng.
        //   `onClose`      — gọi THAY `closeFully()` khi đóng picker (bấm X hoặc chọn xong) — nơi gọi sống chung Generic
        //                    Drawer (Visual Background) tự mở lại màn của mình.
        //   `multiSelect`  — tap tile bật/tắt chọn, header có nút "Chọn (N)"; `onPick(folderIds[], type)`.
        //   `typeOptions`  — `{ current: 'video'|'photo' }` -> header có dropdown đổi loại folder.
        //   `onTypeChange` — callback(newType): nơi gọi re-fetch đúng loại + gọi lại hàm này (isUpdate=true).
        //   `selectedIds`  — khôi phục lựa chọn đang dở khi vẽ lại tại chỗ.
        // @param {boolean} [isUpdate] - true: vẽ lại tại chỗ (picker đang mở); bỏ trống: mở mới.
        const opts = options || {};
        this._folderPickerFolders = opts.folders || await workflowFolder.list(); // event/workflow/folder.js
        this._folderPickerShowAddTile = opts.showAddTile !== false;
        this._folderPickerEmptyMsg = opts.emptyMsg || '';
        this._folderPickerEditingId = null;
        this._folderPickerOnPick = onPick;
        this._folderPickerOnClose = opts.onClose || null;
        this._folderPickerMultiSelect = !!opts.multiSelect;
        this._folderPickerSelectedIds = opts.multiSelect ? (opts.selectedIds || []) : [];
        this._folderPickerTypeOptions = opts.typeOptions || null;
        this._folderPickerOnTypeChange = opts.onTypeChange || null;
        this._renderFolderPickerGrid(!isUpdate, true); // mở/đổi loại = danh sách mới -> cuộn từ đầu
    },

    /** Vẽ lại grid (mở lần đầu HOẶC sau khi thêm/sửa tên 1 folder, toggle chọn, đổi loại).
     * @param {boolean} isFirstOpen - true: mở Generic Drawer; false: thay nội dung Drawer đang mở
     * @param {boolean} [scrollReset] - true = danh sách mới (mở/đổi loại) -> cuộn từ đầu; mặc định false = vẽ lại tại chỗ
     *        -> giữ vị trí cuộn. */
    _renderFolderPickerGrid(isFirstOpen, scrollReset = false) {
        // multiSelect: Map<folderId, thứ tự chọn> cho badge số trên tile; không multiSelect -> null (không badge).
        const selectedOrder = this._folderPickerMultiSelect ? computeFolderSelectionOrder(this._folderPickerSelectedIds) : null; // core/file-manager/folder.js
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

    /** msg.type = 'playlist.folderPicker.tile.click' — multiSelect: bật/tắt chọn tile (vẽ lại tại chỗ, không đóng);
     * mặc định (2 luồng "Thêm vào thư mục" của Playlist): chọn NGAY + đóng. */
    async pickFolderInPicker(folderId) {
        await FOLDER_PICKER_TAP_BY_MULTI_SELECT[this._folderPickerMultiSelect](folderId);
    },

    /** Tap tile khi multiSelect — chọn/bỏ chọn, số thứ tự + nút "Chọn (N)" cập nhật theo. */
    _toggleFolderPickerSelection(folderId) {
        this._folderPickerSelectedIds = toggleFolderSelection(this._folderPickerSelectedIds, folderId); // core/file-manager/folder.js
        this._renderFolderPickerGrid(false);
    },

    /** Tap tile khi KHÔNG multiSelect — đóng picker rồi giao `onPick`. */
    async _pickSingleFolder(folderId) {
        const onPick = this._folderPickerOnPick;
        this.closeFolderPicker();
        if (onPick) await onPick(folderId);
    },

    /** msg.type = 'playlist.folderPicker.confirm.click' (chỉ hiện khi multiSelect). Commit `_folderPickerSelectedIds`
     * (đúng thứ tự chọn) + `type` đang duyệt. */
    async confirmFolderPickerSelection() {
        if (!this._folderPickerMultiSelect || this._folderPickerSelectedIds.length === 0) return; // guard — nút đã disabled, phòng thủ kép
        const onPick = this._folderPickerOnPick;
        const ids = this._folderPickerSelectedIds.slice();
        const type = this._folderPickerTypeOptions ? this._folderPickerTypeOptions.current : null;
        this.closeFolderPicker();
        if (onPick) await onPick(ids, type);
    },

    /** msg.type = 'playlist.folderPicker.typeChange' (dropdown header, chỉ hiện khi có `typeOptions`). Re-fetch là việc
     * của `onTypeChange` (nơi gọi biết tiêu chí lọc của miền mình). */
    async changeFolderPickerType(value) {
        const cb = this._folderPickerOnTypeChange;
        if (!cb) return;
        await cb(value);
    },

    /** msg.type = 'playlist.folderPicker.close.click' (và sau khi chọn xong) — nơi mở có truyền `onClose` (Visual
     * Background sống chung Generic Drawer) thì giao nó, mặc định đóng hẳn Drawer. */
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

    /** msg.type = 'playlist.folderPicker.addTile.click' — tạo NGAY 1 folder tên tự động (không trùng tên folder nào trong
     * grid), type = Nguồn đang active (tile "+" chỉ có ở 2 luồng "Thêm vào thư mục" của Playlist; picker Visual Background
     * dùng `showAddTile: false`), vẽ lại grid với tile mới ở chế độ sửa tên. KHÔNG tự chọn folder mới — user vẫn tap
     * tile như mọi tile khác (tạo ≠ chọn). */
    async createFolderInPicker() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = computeNextPickerFolderName(this._folderPickerFolders); // core/file-manager/folder.js
        const result = await workflowFolder.create(defaultName, mediaType); // event/workflow/folder.js
        if (result.status !== 'ok') return; // hiếm — trùng tên do race, im lặng bỏ qua
        this._folderPickerFolders.push({ id: result.folderId, name: defaultName, type: mediaType });
        this._folderPickerEditingId = result.folderId;
        this._renderFolderPickerGrid(false);
    },

    /** msg.type = 'playlist.folderPicker.rename.commit' — blur/Enter của ô sửa tên: thoát chế độ sửa, đổi tên nếu hợp lệ,
     * vẽ lại grid. */
    async commitFolderPickerRename(folderId, name) {
        this._folderPickerEditingId = null;
        await this._renameFolderInPicker(this._folderPickerFolders.find((f) => f.id === folderId), normalizeFolderNameInput(name)); // core/file-manager/folder.js
        this._renderFolderPickerGrid(false);
    },

    /** Tên rỗng / không đổi -> bỏ qua. Trùng tên folder khác -> im lặng giữ tên cũ (không alertModal giữa lúc thao tác
     * nhanh; Folder Browser thì vẫn báo). */
    async _renameFolderInPicker(folder, name) {
        if (!folder || !name || name === folder.name) return; // guard
        const result = await workflowFolder.rename(folder.id, name); // event/workflow/folder.js — kèm cập nhật badge Scope
        if (result.status === 'ok') folder.name = name;
    },

    /**
     * "Xoá hàng loạt" (đã chọn, cùng 1 Nguồn): mục đang phát nằm trong tập xoá thì ép dừng + về UI Playlist ngay (không
     * hỏi/không chặn — khác `deleteMediaFromActionMenu()`) -> shield -> xoá -> modal "đã xoá".
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
                // Dừng player Video + dọn RAM (event/workflow/video-player.js).
                if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode();
                appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                workflowPlayerControls.returnToPlaylistUI(); // event/workflow/player-controls.js
            } else {
                // Dừng player + dọn RAM để không còn currentKey "ma" — ép dừng vô điều kiện (không kiểm audioPlayer.paused).
                if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
                if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
                audioPlayer.pause(); audioPlayer.src = ''; appState.set('currentKey', null);
                playerTitle.textContent = t('bottomPlayer.noSongSelected'); playerArtist.textContent = '---';
                workflowAutoSwitchVisual.killAllTasks(); // event/workflow/auto-switch-visual.js
                workflowPlayerControls.returnToPlaylistUI(); // ép UI về màn Playlist ngay, TRƯỚC khi hiện shield
                setVisualizerActiveFalse();
            }
        }

        let deletedCount = 0;
        await withLoadingShield(t('common.loading.deleting'), async () => {
            // Mỗi mục: đọc meta, gỡ khỏi folder, xoá record, quên thống kê (MEDIA_DELETE_ACCESSOR tra 1 lần — mediaType không
            // đổi trong lô). Video đang làm Visual Background không cần chặn: VBG tự phát hiện record mất ở lượt advance/apply.
            const { getRecord, deleteRecord } = MEDIA_DELETE_ACCESSOR[mediaType];
            const deletedKeys = [];
            for (const key of keys) {
                const record = await getRecord(key);
                if (!record) continue; // guard: đã bị xoá từ trước (hiếm, race) — bỏ qua, không chặn cả lô
                await workflowFolder.removeItemFromAllFolders(record); // event/workflow/folder.js
                await deleteRecord(key);
                workflowListenStats.forget(mediaType, key); // event/workflow/listen-stats.js
                deletedKeys.push(key);
            }
            deletedCount = deletedKeys.length;

            // Đồng bộ appState (core/playlist/bulk-actions.js, nhận state qua tham số) rồi vẽ lại.
            removeKeysFromDisplayState(deletedKeys, appState.get('playlistOrder'), appState.get('displayOrder'));
            workflowPlaylistOrder.updateShuffleArray();
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
            workflowPlaylistRender.syncEmptyState();
        });

        this._exitSelectionMode();
        // Shield đã đóng hẳn — an toàn để hiện modal.
        await alertModal(tFormat('playlistView.selection.deleteSuccess', { count: deletedCount }));
    },

    /** "Gỡ khỏi thư mục" — Selection mode: gỡ các item đã chọn khỏi DANH SÁCH của folder đang Scope (không đụng
     * bản ghi gốc/thư viện, khác `deleteSelectedMedia()`). Chỉ hiện trong menu khi đang Scope 1 folder không Read-only
     * (event/router/playlist.js, case 'playlist.selection.moreMenu.open'). */
    async removeSelectedSongsFromFolder() {
        const { selectedMediaKeys, activeMediaSource: mediaType, activePlayListFolder, isActiveFolderReadOnly } = appState.get(['selectedMediaKeys', 'activeMediaSource', 'activePlayListFolder', 'isActiveFolderReadOnly']);
        const keys = Array.from(selectedMediaKeys);
        if (keys.length === 0) return;
        const folderId = activePlayListFolder[mediaType];
        if (!folderId) return; // guard hiếm: nút lẽ ra đã ẩn nếu không có Scope, phòng vệ thêm
        // Folder đang Scope Read-only thì không cho gỡ — nút lẽ ra đã ẩn (event/router/playlist.js, case
        // 'playlist.selection.moreMenu.open'), guard này là lớp phòng vệ thứ 2.
        if (isActiveFolderReadOnly) return;
        await this._removeKeysFromScopeFolder(keys, folderId, mediaType);
        this._exitSelectionMode();
    },

    /** "Gỡ khỏi thư mục" — 1 item lẻ qua menu 3-chấm, cùng ý nghĩa/cùng guard Read-only với
     * `removeSelectedSongsFromFolder()`. @param {string} songKey */
    async removeSongFromFolderMenu(songKey) {
        workflowPlaylist.closeActionMenu(); // mọi hành động từ menu 3-chấm đều đóng menu trước khi chạy
        const { activeMediaSource: mediaType, activePlayListFolder, isActiveFolderReadOnly } = appState.get(['activeMediaSource', 'activePlayListFolder', 'isActiveFolderReadOnly']);
        const folderId = activePlayListFolder[mediaType];
        if (!folderId) return; // guard hiếm — cùng lý do removeSelectedSongsFromFolder()
        if (isActiveFolderReadOnly) return; // guard: Read-only — nút lẽ ra đã ẩn, phòng vệ thêm
        await this._removeKeysFromScopeFolder([songKey], folderId, mediaType);
    },

    /** Phần chung của 2 lối "Gỡ khỏi thư mục": gỡ khỏi folder_song -> gỡ khỏi danh sách đang hiển thị -> vẽ lại; folder
     * trống hẳn thì tự thoát Scope về "Tất cả". */
    async _removeKeysFromScopeFolder(keys, folderId, mediaType) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const folderMap = await workflowFolder.removeItems(keys, folderId, mediaType); // event/workflow/folder.js
            const { playlistOrder, displayOrder } = appState.get(['playlistOrder', 'displayOrder']);
            removeKeysFromDisplayState(keys, playlistOrder, displayOrder); // core/playlist/bulk-actions.js
            workflowPlaylistOrder.updateShuffleArray();
            workflowPlaylistOrder.recomputeRenderOrder();
            workflowPlaylistRender.renderPlaylistDiff();
            workflowPlaylistRender.syncEmptyState();
            await this._exitScopeIfFolderEmpty(folderMap, mediaType);
        });
    },

    /** Folder đang Scope vừa trống hẳn -> thoát Scope về "Tất cả" ngay. */
    async _exitScopeIfFolderEmpty(folderMap, mediaType) {
        if (!folderMap || !isFolderEmpty(folderMap)) return; // guard — core/file-manager/folder.js
        await workflowPlaylistScope.persistScopeChoice(null, mediaType);
        await workflowPlaylistScope.applyAllSongsScope(mediaType);
    },

    // ===================== Đổi Nguồn (Song/Video/Photo) =====================

    /**
     * Đổi Nguồn Playlist (select "Nguồn" ở Settings → Playlist). Thoát chọn nhiều -> set activeMediaSource -> trong shield:
     * apply*Scope() nạp đúng phạm vi + Filter + render, rồi cuộn tới media đang phát nếu có trong Nguồn mới (không thì về
     * đầu); ngoài shield: placeholder tìm kiếm + `accept` upload + hiện nút Phát/Trộn + lưu bền Nguồn. Không reset
     * `displaySortMode` (dùng chung cho cả 3 Nguồn).
     * @param {'song'|'video'|'photo'} mediaType
     */
    async switchSource(mediaType) {
        // Thoát Selection Mode ngay: 3 Nguồn sinh key theo cùng kiểu slug filename -> key trùng có thể làm Xoá/Phát hàng loạt
        // nhắm nhầm record.
        this._exitSelectionMode();

        // Cùng gốc key trùng: renderPlaylistDiff() tái dùng node DOM cũ của key "vẫn còn" — đổi hẳn Nguồn thì node của Song
        // (có thể mang icon "đang phát") bị hiện lại cho Video/Photo trùng key. Dọn domNodesByKey khi Nguồn thật sự đổi ->
        // renderPlaylistDiff() tự dựng lại toàn bộ. Không đổi Nguồn thì giữ tối ưu diff.
        this._dropDomNodesIfSourceChanged(mediaType);

        appState.set('activeMediaSource', mediaType);
        console.log(`writer: "switchSource", page: "activeMediaSource", content: "${mediaType}"`);

        const i18n = MEDIA_SWITCH_I18N[mediaType];
        await withLoadingShield(t('playlistView.loading.generic'), async () => {
            const folderForThisSource = appState.get('activePlayListFolder')[mediaType];
            const onProgress = (done, total) => { loadingText.textContent = tFormat(i18n.loadingKey, { done, total }); };
            await SOURCE_SCOPE_APPLY_BY_HAS_FOLDER[!!folderForThisSource](folderForThisSource, mediaType, onProgress);
            // Nguồn mới có media đang phát -> cuộn tới nó; không có -> về đầu.
            workflowPlaylistRender.scrollToCurrentOrTop(); // event/workflow/playlist-render.js
        });
        if (playlistSearchInput) playlistSearchInput.placeholder = t(i18n.placeholderKey);
        this._applyUploadInputAccept(mediaType); // nút upload dùng chung 3 Nguồn, chỉ đổi accept
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this._persistPlaylistConfig(); // lưu bền Nguồn để không mất sau reload
    },
    /** Nguồn thật sự đổi thì dọn hẳn domNodesByKey (xem switchSource()); bấm lại đúng Nguồn đang xem thì giữ nguyên.
     * @param {'song'|'video'|'photo'} mediaType */
    _dropDomNodesIfSourceChanged(mediaType) {
        if (mediaType === appState.get('activeMediaSource')) return; // guard — Nguồn không đổi
        appState.get('domNodesByKey').forEach(revokeNodeCoverUrl); // core/playlist/render.js
        appState.mutate('domNodesByKey', m => m.clear());
        console.log(`writer: "workflowPlaylist._dropDomNodesIfSourceChanged", page: "domNodesByKey", content: "clear (đổi Nguồn sang ${mediaType})"`);
    },

    /**
     * "Sắp xếp" đổi giá trị (Settings → Playlist) — đổi + lưu bền.
     */
    async changeSortMode(mode) {
        workflowPlaylistOrder.setDisplaySortMode(mode); // event/workflow/playlist-order.js
        await this._persistPlaylistConfig();
    },

    /** Sort trục thống kê — field (panel "Sắp xếp"). */
    async changeStatSortField(field) {
        workflowPlaylistOrder.setDisplayStatSortField(field); // event/workflow/playlist-order.js
        // Hiện/ẩn dropdown "hướng" ngay khi đổi field (chỉ có nghĩa khi field khác 'none'). Panel sống trong genericDrawerBody.
        this._syncSortStatDependents(genericDrawerBody, field);
        await this._persistPlaylistConfig();
    },

    /** Sort trục thống kê — hướng (chỉ hiện khi field khác 'none'). */
    async changeStatSortDirection(direction) {
        workflowPlaylistOrder.setDisplayStatSortDirection(direction); // event/workflow/playlist-order.js
        await this._persistPlaylistConfig();
    },

    /**
     * "Kiểu xem" đổi giá trị (Settings → Playlist) — ghi + vẽ lại toàn bộ + lưu bền.
     */
    async changeViewMode(mode) {
        setPlaylistViewMode(mode); // core/playlist/main.js — ghi isGridView + className
        applySelectionChrome(appState.get('selectionMode')); // className vừa bị gán lại, mất class `is-selecting` (vòng tròn chọn CSS) nếu đang chọn
        workflowPlaylistRender.renderPlaylistFull(); // event/workflow/playlist-render.js — grid/list đổi cấu trúc node, không diff được
        await this._persistPlaylistConfig();
    },

    /**
     * Ghi bền 3 lựa chọn Playlist (Nguồn/Sắp xếp/Kiểu xem) vào `appConfigPlaylist` + `meta.playlistConfig` (setMeta mỗi lần
     * đổi, tần suất thấp). Chủ ý không gồm 3 field "Giải phóng bộ nhớ" (mediaScope/downloadEnabled/deleteEnabled) — lưu bền
     * sẽ vô hiệu 1 lớp an toàn cho hành động phá dữ liệu (xem core/config.js::DEFAULT_PLAYLIST_CONFIG).
     */
    async _persistPlaylistConfig() {
        appConfigPlaylist.setAll({
            activeMediaSource: appState.get('activeMediaSource'),
            displaySortMode: appState.get('displaySortMode'),
            displayStatSortField: appState.get('displayStatSortField'),
            displayStatSortDirection: appState.get('displayStatSortDirection'),
            isGridView: appState.get('isGridView'),
        });
        await setMeta('playlistConfig', appConfigPlaylist.getAll());
    },

    /**
     * Khôi phục 3 lựa chọn Playlist lúc boot (event/workflow/app-boot.js, TRƯỚC bước nạp playlistCache — phải biết
     * `activeMediaSource` trước). Đồng bộ lại UI qua `syncPlaylistSettingsUI()` (lần bootstrap ở cuối core/playlist/main.js
     * chạy trước khi đọc xong IndexedDB).
     */
    async loadPersistedPlaylistConfigOnBoot() {
        const saved = await getMeta('playlistConfig');
        if (saved && typeof saved === 'object') {
            appConfigPlaylist.mutateAll((cfg) => Object.assign(cfg, saved));
        }
        const cfg = appConfigPlaylist.getAll();
        // Nguồn lạ/thiếu -> 'song'.
        const validSources = ['song', 'video', 'photo'];
        appState.set('activeMediaSource', validSources.includes(cfg.activeMediaSource) ? cfg.activeMediaSource : 'song');
        appState.set('displaySortMode', cfg.displaySortMode || 'az');
        appState.set('displayStatSortField', cfg.displayStatSortField || 'none');
        appState.set('displayStatSortDirection', cfg.displayStatSortDirection || 'desc');
        appState.set('isGridView', !!cfg.isGridView);
        console.log(`writer: "loadPersistedPlaylistConfigOnBoot", page: "activeMediaSource/displaySortMode/isGridView", content: "khôi phục từ meta.playlistConfig"`);
        const restoredSource = appState.get('activeMediaSource');
        if (playlistSearchInput) playlistSearchInput.placeholder = t(restoredSource === 'video' ? 'playlistView.search.placeholderVideo' : restoredSource === 'photo' ? 'playlistView.search.placeholderPhoto' : 'playlistView.search.placeholder');
        // Đồng bộ `accept` của 2 input upload dùng chung theo Nguồn vừa khôi phục.
        this._applyUploadInputAccept(restoredSource);
        // Hàng Phát/Trộn bài luôn hiện (boot không đi qua switchSource()).
        if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
        if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        await this.syncPlaylistSettingsUI();
    },

    // ===================== Filter / Sort subpanel =====================

    /** Khôi phục Filter lúc boot (TRƯỚC khối Scope ở app-boot.js) — giao workflowPlaylistFilterPresets.loadOnBoot(). */
    async loadPersistedFilterConfigOnBoot() {
        await workflowPlaylistFilterPresets.loadOnBoot(); // event/workflow/playlist-filter-presets.js
    },

    /** Panel "Sắp xếp" vừa mở (bodyHtml do event/workflow/app-settings.js dựng) — đồng bộ giá trị hiện tại vào
     * `genericDrawerBody`; dropdown hướng chỉ hiện khi field khác 'none'. */
    openSortPanel() {
        const panelEl = genericDrawerBody;
        panelEl.querySelector('#setting-playlist-sort-name').value = appState.get('displaySortMode');
        const statField = appState.get('displayStatSortField');
        panelEl.querySelector('#setting-playlist-sort-stat-field').value = statField;
        panelEl.querySelector('#setting-playlist-sort-stat-direction').value = appState.get('displayStatSortDirection');
        this._syncSortStatDependents(panelEl, statField);
    },

    /** Ẩn/hiện 2 phần tử chỉ có nghĩa khi Stats chọn field khác 'none': hàng Hướng +
     * icon (i) giải thích cạnh nhãn Tên/Ngày (thay dòng gợi ý chữ cũ). Panel không mở (phần tử null) -> bỏ qua.
     * @param {HTMLElement} panelEl @param {string} statField */
    _syncSortStatDependents(panelEl, statField) {
        const isOff = statField === 'none';
        ['[data-sort-direction-row]', '[data-sort-stat-info]'].forEach((selector) => {
            const el = panelEl.querySelector(selector);
            if (el) el.classList.toggle('hidden', isOff);
        });
    },

    /** Nút X ở badge "đang Scope folder nào" (components/playlist-view.js) — thoát Scope của Nguồn hiện tại, áp "Tất cả"
     * (applyAllSongsScope() tự ẩn badge). */
    async exitActiveFolderScope() {
        const mediaType = appState.get('activeMediaSource');
        await withLoadingShield(t('common.loading.generic'), async () => {
            await workflowPlaylistScope.persistScopeChoice(null, mediaType);
            await workflowPlaylistScope.applyAllSongsScope(mediaType);
            workflowPlaylistRender.scrollToCurrentOrTop(); // event/workflow/playlist-render.js
        });
    },

    /**
     * Đồng bộ các control Playlist Settings (Kiểu xem, Nguồn) theo appState — Workflow đọc state rồi gọi từng method của
     * `PlaylistMain` (core/playlist/main.js). Dùng sau khi khôi phục cấu hình lúc boot.
     */
    async syncPlaylistSettingsUI() {
        if (typeof PlaylistMain === 'undefined') return; // guard
        PlaylistMain.initViewMode(appState.get('isGridView'));
        PlaylistMain.initMediaSource(genericDrawerBody.querySelector('#setting-playlist-media-source'), appState.get('activeMediaSource')); // core/playlist/main.js
    }
};

