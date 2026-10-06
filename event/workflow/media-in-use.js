/**
 * event/workflow/media-in-use.js — Workflow "mediaInUse": REQUEST TRUNG TÂM nạp lại media đang được dùng (MỚI 06/10/2026,
 * plan-media-db-split.md mục 7, Giang chốt).
 *
 * VÌ SAO: app phát/hiện media qua blob URL tạo từ Blob trong IndexedDB. Khi NỘI DUNG file của chính media đó bị thay
 * (upload ghi đè trùng tên, Video editor "Ghi đè", sửa ảnh "Ghi đè", sửa thumbnail video), Blob cũ có thể bị WebKit bỏ
 * đi -> blob URL đang dùng chết (nhạc câm, video đen, ảnh vỡ). Sửa thông tin (tag/phụ đề/folder/thống kê/điểm Game)
 * KHÔNG còn gây việc này vì chỉ ghi store meta.
 *
 * QUY ƯỚC: nơi thay file ghi DB xong CHỈ bắn `eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced',
 * payload: { type, key } })` — không tự kiểm ai đang dùng. Workflow này TỰ đọc state để biết media đó đang được dùng ở
 * đâu, rồi TỰ quyết định gọi đúng hàm nạp lại của workflow chủ quản:
 *   - node Playlist (đang xem đúng Nguồn, có trong playlistCache) -> trỏ `cached.cover` sang thumb mới + vẽ lại node;
 *   - Player chính (đúng key + đúng loại đang phát) -> workflowPlayer / workflowVideoPlayer / workflowPhotoPlayer;
 *   - Visual Background (không ở Player Video/Photo, VBG đúng type, đúng item đang chạy) -> workflowVisualBg.
 * Media không được dùng ở đâu -> không làm gì. Rẽ nhánh bằng object map (readme/event-bus-flow.md mục 7).
 *
 * NẠP SAU: service/db.js, core/playlist/render.js (resolvePlayingMediaType), event/workflow/player.js, video-player.js,
 * photo-player.js, visual-bg-*.js, playlist-render.js (chỉ cần lúc chạy). NẠP TRƯỚC: event/router/media-in-use.js.
 */

/** Chạy bước nạp lại khi media đang được dùng ở nơi đó, không thì bỏ qua. */
const MEDIA_IN_USE_RUN_IF = {
    true: (step) => step(),
    false: () => Promise.resolve(),
};

/** Player chính đã THẬT SỰ nạp media chưa — Song: `playingMediaType` mặc định 'song' kể cả khi chưa phát gì, nên kiểm thêm
 * audioPlayer đã có nguồn; Video/Photo: đã ở đúng mode là đã nạp. */
const MEDIA_IN_USE_MAIN_PLAYER_LOADED = {
    song: () => !!appState.get('currentObjectURL'),
    video: () => true,
    photo: () => true,
};

const MEDIA_IN_USE_MAIN_PLAYER_RELOAD = {
    song: () => workflowPlayer.reloadCurrentSongKeepingPosition(), // event/workflow/player.js
    video: () => workflowVideoPlayer.reloadCurrentVideoKeepingPosition(), // event/workflow/video-player.js
    photo: () => workflowPhotoPlayer.reloadCurrentPhoto(), // event/workflow/photo-player.js
};

/** Key VBG đang dùng theo loại — VBG không dùng Song. */
const MEDIA_IN_USE_VBG_CURRENT_KEY = {
    song: () => null,
    video: () => workflowVisualBg.getCurrentVideoKey(), // event/workflow/visual-bg-video.js
    photo: () => workflowVisualBg.getCurrentPhotoKey(), // event/workflow/visual-bg-photo.js
};

const MEDIA_IN_USE_VBG_RELOAD = {
    song: () => Promise.resolve(),
    video: () => workflowVisualBg.reloadCurrentVideoKeepingPosition(),
    photo: () => workflowVisualBg.reloadCurrentPhoto(),
};

/** Cover trong playlistCache — KHỚP core/playlist/loader.js::buildAdaptedPlaylistCache() (Photo rơi về ảnh gốc). */
const MEDIA_IN_USE_PLAYLIST_COVER_OF = {
    song: (record) => record.cover || null,
    video: (record) => record.thumbBlob || null,
    photo: (record) => record.thumbBlob || record.blob || null,
};

const workflowMediaInUse = {

    /**
     * Ứng với 'mediaInUse.contentReplaced'. Đọc state 1 lần, tính 3 nơi có thể đang dùng, chạy tuần tự từng bước nạp lại.
     * @param {'song'|'video'|'photo'} type @param {string} key
     */
    async handleContentReplaced(type, key) {
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        const isPhotoPlayerMode = appState.get('isPhotoPlayerMode');
        const playingMediaType = resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode); // core/playlist/render.js
        const usage = {
            playlistNode: appState.get('activeMediaSource') === type && appState.get('playlistCache').has(key),
            mainPlayer: appState.get('currentKey') === key && playingMediaType === type && MEDIA_IN_USE_MAIN_PLAYER_LOADED[type](),
            visualBg: !isVideoPlayerMode && !isPhotoPlayerMode
                && appConfigVisualBg.getAll().type === type && MEDIA_IN_USE_VBG_CURRENT_KEY[type]() === key,
        };
        console.log(`[workflowMediaInUse] ${type} "${key}" vừa thay nội dung — đang dùng ở: playlist=${usage.playlistNode}, player=${usage.mainPlayer}, vbg=${usage.visualBg}`);
        await MEDIA_IN_USE_RUN_IF[usage.playlistNode](() => this._refreshPlaylistNode(type, key));
        await MEDIA_IN_USE_RUN_IF[usage.mainPlayer](MEDIA_IN_USE_MAIN_PLAYER_RELOAD[type]);
        await MEDIA_IN_USE_RUN_IF[usage.visualBg](MEDIA_IN_USE_VBG_RELOAD[type]);
    },

    /** Trỏ `cached.cover` sang thumb MỚI (Blob cũ có thể đã chết) rồi vẽ lại đúng node đó. */
    async _refreshPlaylistNode(type, key) {
        const record = await getMediaRecord(type, key); // service/db.js
        const cached = appState.get('playlistCache').get(key);
        if (!record || !cached) return; // guard: vừa bị xoá / đổi Nguồn giữa chừng
        cached.cover = MEDIA_IN_USE_PLAYLIST_COVER_OF[type](record);
        console.log(`writer: "workflowMediaInUse._refreshPlaylistNode", page: "playlistCache", content: "${key}.cover -> thumb mới"`);
        workflowPlaylistRender.refreshSongNode(key); // event/workflow/playlist-render.js
    },
};
