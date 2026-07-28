/**
 * event/workflow/file-manager-video.js — MỚI (21/07/2026). Chỉ còn LOGIC NGHIỆP VỤ của Video
 * (thêm/xoá, phân tích thumbnail+mediainfo lúc upload, set làm nền, mở Video Editor) + picker
 * Generic Drawer "Use background video" (Visualizer Control Center) — KHÔNG còn UI panel riêng.
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang "làm luôn 6d") — TOÀN BỘ
 * phần dựng UI/panel "File Manager → Video" (openPanel()/_buildHeaderActionHtml()/
 * _wireHeaderActionEvents()/triggerUploadInput()/refresh() — lưới CSS Grid + nút xoá nhanh) ĐÃ XOÁ
 * HẲN, cùng lúc:
 *   - `openVideoTileActionMenu()` (dropdown 3 lựa chọn trên tile) — "Set as bg video"/"Edit video"
 *     dời sang menu 3 chấm DÙNG CHUNG của Playlist (2 nút mới, ẩn/hiện theo mediaType —
 *     `components/playlist-view.js` + `core/playlist/actions.js::openSongActionMenu()` +
 *     `event/workflow/playlist.js::setActiveMenuVideoAsBackground()`/
 *     `navigateToActiveMenuVideoEdit()`, TÁI DÙNG NGUYÊN `setVideoAsBackground()`/
 *     `navigateToVideoEdit()` bên dưới, chỉ đổi nơi gọi). "Xoá" giờ dùng chung
 *     `window.removeSong()` (core/playlist/actions.js, ĐÃ sửa media-aware) — `confirmDeleteSingleVideo()`
 *     (modal confirm riêng, dùng `deleteVideo()`) ĐÃ XOÁ, không còn nơi gọi.
 *   - Toàn bộ "chế độ xoá nhanh" (`promptQuickDeleteMode()`/`toggleQuickDeleteMarkInSet()`/
 *     `updateQuickDeleteModeUI()`/`_updateQuickDeleteButtonTitle()`/`confirmQuickDeleteBatch()`) ĐÃ
 *     XOÁ — tính năng CHỈ tồn tại trong lưới panel đã bỏ, không có UI nào khác dùng tới.
 *   - Upload video giờ vào từ Playlist (Batch 6, mục 7 — `#video-upload-input`,
 *     event/router/playlist.js case 'playlist.upload.videoFileChange') — `uploadVideos()` GIỮ
 *     NGUYÊN 100% thân hàm (per-file error isolation, resolveVideoKey/saveVideo/extract thumb+
 *     mediainfo, tự `refreshVideoPlaylistIfActive()`), chỉ bỏ đoạn dọn input CỦA PANEL CŨ (đã chết,
 *     input mới ở Playlist tự dọn value trong chính listener của nó).
 *   - Settings row "Video" riêng (components/settings/file-manager-section.js) ĐÃ BỎ — chỉ còn
 *     "Song & Video" (đã gộp từ Batch 5).
 *
 * `event/workflow/video-gallery-window.js` KHÔNG xoá — vẫn được dùng bởi
 * `openVideoBgPicker()`/`_teardownVideoPicker()` bên dưới (mount/unmount 'genericDrawer'), chỉ
 * riêng lời gọi `mount('videoGrid', ...)`/`setTileBadge()`/`setBadgeMode()` (của panel/lưới/xoá
 * nhanh đã xoá) không còn ai gọi tới nữa.
 *
 * NẠP SAU: core/file-manager/video.js, core/generic-drawer.js, event/workflow/video-gallery-
 * window.js, event/workflow/video-player.js (workflowVideoPlayer — dùng bởi
 * refreshVideoPlaylistIfActive() ngay dưới).
 */
let _videoPickerSession = null; // session picker Generic Drawer (chọn 1 video làm nền), cùng khuôn _imagePickerSession (file-manager-photo.js)

/** MỚI (ver12 "Song/Video Unification", Batch 3, mục 4 plan) — cạnh thumbnail vuông cố định, THAY
 * hẳn `VIDEO_THUMBNAIL_SCALE_RATIO` cũ (resize theo tỉ lệ gốc, không vuông — không đồng nhất với
 * cover Song/thumbnail Photo, đều vuông). CHỈ áp dụng cho video upload MỚI từ đây trở đi (video cũ
 * đã regen 1 lần qua tool đã xoá ở Batch 4, xem readme/changelog/v12.md mục 20). */
const VIDEO_THUMBNAIL_SIZE = 320;

const workflowFileManagerVideo = {

    /** Chụp 1 khung hình + đọc thời lượng của 1 file video, crop VUÔNG cố định
     * `VIDEO_THUMBNAIL_SIZE`×`VIDEO_THUMBNAIL_SIZE` (center-crop cạnh dài về giữa — MỚI, ver12
     * "Song/Video Unification", Batch 3, mục 4 plan, THAY hẳn resize theo tỉ lệ gốc cũ) — CÙNG lý
     * do đặt ở Workflow (không phải core/file-manager/video.js) như `_resizeImageForThumbnail()`
     * (file-manager-photo.js): cần `<video>`/`canvas` — DOM API, core không được đụng theo Rule 1-4.
     * Chụp khung hình tại giây `min(1, duration/2)` — tránh giây đầu tiên hay bị đen/mờ (video vừa
     * mở), cũng tránh vọt quá xa nếu video ngắn hơn 1 giây.
     * `width`/`height` trả về là kích thước GỐC của video (KHÔNG phải kích thước thumb) — vẫn lưu
     * riêng như cũ, dùng chỗ khác nếu cần tỉ lệ thật (đúng plan mục 4).
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, width: number, height: number, duration: number}>}
     */
    _extractVideoThumbAndMeta(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            let settled = false;
            const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} };
            const cleanupAndReject = (err) => { if (settled) return; settled = true; cleanup(); reject(err); };
            const safetyTimeout = taskManager.once(() => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] timeout đọc video')), 8000);

            videoEl.addEventListener('loadedmetadata', () => {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                if (!width || !height) { cleanupAndReject(new Error('[_extractVideoThumbAndMeta] video không có kích thước hợp lệ')); return; }
                videoEl.currentTime = Math.min(1, videoEl.duration / 2 || 0);
            }, { once: true });

            videoEl.addEventListener('seeked', () => {
                if (settled) return;
                safetyTimeout.kill();
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const side = Math.min(width, height);
                const sx = (width - side) / 2, sy = (height - side) / 2;
                const canvas = document.createElement('canvas');
                canvas.width = VIDEO_THUMBNAIL_SIZE; canvas.height = VIDEO_THUMBNAIL_SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, VIDEO_THUMBNAIL_SIZE, VIDEO_THUMBNAIL_SIZE);
                canvas.toBlob((thumbBlob) => {
                    settled = true; cleanup();
                    if (!thumbBlob) { reject(new Error('[_extractVideoThumbAndMeta] canvas.toBlob trả về null')); return; }
                    resolve({ thumbBlob, width, height, duration: videoEl.duration || 0 });
                }, 'image/jpeg', 0.85);
            }, { once: true });

            videoEl.addEventListener('error', () => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] không đọc được video')), { once: true });
            videoEl.src = objectUrl;
        });
    },

    /** MỚI (ver12 "Song/Video Unification", Batch 5, mục 6c) — chạy mediainfo.js (WASM, CDN unpkg,
     * global `MediaInfo`, xem index.html) phân tích 1 file video, trả format/codec/fps/bitrate cho
     * tab "Chi tiết" (đọc-chỉ). CÙNG lý do đặt ở Workflow (không phải core) như
     * `_extractVideoThumbAndMeta()` ngay trên: thư viện ngoài + đọc Blob theo chunk, core không
     * được đụng theo Rule 1-4. KHÔNG throw — trả object RỖNG nếu lỗi/CDN chưa tải kịp, để 1 file
     * lỗi phân tích KHÔNG chặn cả lô upload (đúng tinh thần try/catch quanh
     * `_extractVideoThumbAndMeta()` ở `uploadVideos()` ngay dưới — mediainfo chỉ là dữ liệu PHỤ,
     * không có cũng không sao, khác hẳn thumbnail/duration là BẮT BUỘC).
     * @param {Blob} blob - blob video GỐC.
     * @returns {Promise<{codec: string, fps: string, bitrate: number, audioCodec: string, audioBitrate: number}>}
     */
    async _extractVideoMediaInfo(blob) {
        if (typeof MediaInfo === 'undefined') return {}; // guard: CDN lỗi mạng/chưa tải kịp — không chặn upload
        let mediainfo;
        try {
            mediainfo = await MediaInfo.default({ format: 'object', coverData: false });
            const readChunk = (chunkSize, offset) => blob.slice(offset, offset + chunkSize).arrayBuffer().then((buf) => new Uint8Array(buf));
            const result = await mediainfo.analyzeData(blob.size, readChunk);
            const tracks = (result && result.media && result.media.track) || [];
            const generalTrack = tracks.find((tr) => tr['@type'] === 'General') || {};
            const videoTrack = tracks.find((tr) => tr['@type'] === 'Video') || {};
            const audioTrack = tracks.find((tr) => tr['@type'] === 'Audio') || {};
            return {
                codec: videoTrack.Format || videoTrack.CodecID || '',
                fps: videoTrack.FrameRate || generalTrack.FrameRate || '',
                bitrate: Number(videoTrack.BitRate || generalTrack.OverallBitRate || 0) || 0,
                audioCodec: audioTrack.Format || audioTrack.CodecID || '',
                audioBitrate: Number(audioTrack.BitRate || 0) || 0,
            };
        } catch (err) {
            console.error('[_extractVideoMediaInfo] mediainfo.js phân tích thất bại:', err);
            return {};
        } finally {
            if (mediainfo) mediainfo.close();
        }
    },

    /** Ứng với 'playlist.upload.videoFileChange' (Batch 6, mục 7 — trước đây
     * 'fileManagerVideo.upload.change', gọi từ panel đã xoá). Lỗi 1 file (vd file hỏng) KHÔNG chặn
     * cả lô upload — bắt riêng, bỏ qua đúng file đó, tiếp tục file sau (Rule 1: vẫn 1 tiến trình
     * "upload cả lô").
     * @param {FileList|File[]} files
     */
    async uploadVideos(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                try {
                    const { thumbBlob, width, height, duration } = await this._extractVideoThumbAndMeta(file);
                    // MỚI (Batch 5, mục 6c) — mediaInfo là dữ liệu PHỤ (KHÔNG throw nếu lỗi, xem
                    // docstring _extractVideoMediaInfo()) nên gọi TÁCH RIÊNG try/catch của bước
                    // trên — 1 file lỗi phân tích mediainfo vẫn upload bình thường, chỉ thiếu
                    // codec/fps/bitrate ở tab Chi tiết.
                    const mediaInfo = await this._extractVideoMediaInfo(file);
                    await saveVideo(file, file.name, thumbBlob, width, height, duration, mediaInfo); // core/file-manager/video.js
                } catch (err) {
                    console.error(`[uploadVideos] chụp thumbnail/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
        });
        // XOÁ (Batch 6, mục 6d) — đoạn dọn `#file-manager-video-upload-input` (input CỦA PANEL CŨ,
        // đã xoá hẳn) từng nằm ở đây — input MỚI (`#video-upload-input`, Playlist) tự dọn value
        // NGAY trong chính listener của nó (event/listener/playlist.js), không cần workflow lo.
        // MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — nếu Playlist đang
        // browse nguồn Video, làm mới playlistCache/playlistOrder NGAY để Next/Prev thấy được video
        // vừa upload — KHÔNG cần đổi Nguồn tắt/bật lại.
        await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard activeMediaSource, no-op nếu Playlist không ở nguồn Video
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.video.uploadSuccess', { count: successCount }));
    },

    /** Ứng với 'playlist.actionMenu.setAsBgVideo' (menu 3 chấm Playlist, chỉ hiện khi item là
     * Video — xem event/workflow/playlist.js::setActiveMenuVideoAsBackground()). GIỮ NGUYÊN 100%
     * thân hàm so với bản cũ (dropdown tile "File Manager → Video" đã xoá, Batch 6 mục 6d) — chỉ
     * đổi NƠI GỌI.
     * SAO KHÔNG DÙNG Block gate cho guard "đang ở Video Player mode" — điều kiện chặn cần đọc
     * `appState.get('isVideoPlayerMode')` (1 field appState, không so với payload) — VỀ LÝ THUYẾT
     * Block gate làm được, nhưng giữ code thủ công ở đây để CÙNG 1 chỗ với logic
     * `withLoadingShield`/`alertModal` ngay sau, dễ đọc hơn tách rời 2 nơi.
     * @param {string} videoKey
     */
    async setVideoAsBackground(videoKey) {
        if (appState.get('isVideoPlayerMode')) {
            await alertModal(t('fileManager.video.setAsBgVideo.blockedByPlayerMode'));
            return;
        }
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) return; // guard: video vừa bị xoá ở nơi khác
        await withLoadingShield(t('common.loading.savingVideoBg'), async () => {
            await setMeta('videoBg', record.blob); // service/db.js
            applyUploadedVideoBg(record.blob); // core/state-and-video-bg.js, di sản — tự set videoBgEnabled=true + đồng bộ UI + saveConfig()
        });
        if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.syncPlaybackGate();
        await alertModal(t('fileManager.video.setAsBgVideo.success'));
    },

    /** Ứng với 'playlist.actionMenu.editVideoFile' (menu 3 chấm Playlist, chỉ hiện khi item là
     * Video). GIỮ NGUYÊN 100% — MỚI (Batch 1, module Video Editor), THAY placeholder cũ. Điều
     * hướng sang trang `video-editor.html`, CÙNG KHUÔN `workflowFileManagerPhoto.
     * navigateToImageEdit()` (`window.location.href` toàn trang, KHÔNG iframe/popup — 2 trang cùng
     * origin `file://`, dùng chung IndexedDB). TÁI DÙNG NGUYÊN `encodeSongKeyForUrl()`
     * (service/song-key-cipher.js) — hàm đó chỉ mã hoá 1 chuỗi key bất kỳ, không có gì đặc thù
     * "video".
     * @param {string} videoKey
     */
    navigateToVideoEdit(videoKey) {
        window.location.href = `video-editor.html?video=${encodeSongKeyForUrl(videoKey)}`; // service/song-key-cipher.js
    },

    // ===================== Batch 2 (21/07/2026) — Picker Generic Drawer cho "Use background
    // video" (event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle()). Mirror
    // ĐÚNG `openCoverImagePicker()`/`_openImagePickerDrawer()` (file-manager-photo.js) — nhưng đơn
    // giản hơn hẳn: Video CHỈ có 1 chế độ picker DUY NHẤT (single-select, tap = chọn ngay) — Giang
    // chốt KHÔNG có "Upload mới ngay trong drawer" (khác Photo, đôi khi có confirmButton cho
    // multi-select album) — nên KHÔNG cần field `mode`/`showConfirmButton` nào trong session, đơn
    // giản hoá tối đa so với bản Photo. KHÔNG bị đụng bởi Batch 6/6d — độc lập hoàn toàn với panel
    // "File Manager → Video" đã xoá. =====================================================

    /** Mở Generic Drawer chọn 1 video CÓ SẴN trong thư viện Video — DÙNG CHUNG cho MỌI nơi cần
     * "chọn 1 video làm nền" (hiện tại chỉ có Settings -> "Use background video", nhưng viết tổng
     * quát qua tham số `onSelect`/`onCancel`, không hardcode nghiệp vụ video nền ở ĐÂY — cùng triết
     * lý `openCoverImagePicker()` Photo).
     * @param {(videoKey: string) => void} onSelect
     * @param {() => void} [onCancel] - gọi khi đóng picker MÀ CHƯA chọn gì (nút X).
     */
    async openVideoBgPicker(onSelect, onCancel) {
        _videoPickerSession = { onSelect, onCancel, hasSelected: false };

        openGenericDrawer({ // core/generic-drawer.js
            height: '90vh',
            zIndex: Z_INDEX.GENERIC_DRAWER, // core/config.js — mặc định, không có modal nào khác mở đồng thời picker này
            headerHtml: this._buildVideoPickerHeaderHtml(t('fileManager.video.pickerTitle')),
            bodyHtml: this._buildVideoPickerBodyHtml(),
            bodyClass: 'flex flex-col',
        });

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.videoPicker.close.click', payload: {} });
        });

        // Click tile — delegated NGAY TRÊN genericDrawerBody (Generic Drawer là ANH EM của
        // #app-stack, KHÔNG nằm trong settingsStackBody — PHẢI tự wire riêng ở đây, cùng khuôn
        // `_openImagePickerDrawer()` Photo).
        genericDrawerBody.addEventListener('click', (e) => {
            const tile = e.target.closest('[data-video-key]');
            if (!tile) return;
            eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.videoPicker.tile.click', payload: { videoKey: tile.dataset.videoKey } });
        });

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        const videos = await listVideos(); // core/file-manager/video.js
        if (!_videoPickerSession) return; // guard — user đóng picker RẤT NHANH trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null, selectedKeys: new Set() }); // event/workflow/video-gallery-window.js — single-select, KHÔNG badge, tap = chọn ngay
    },

    _buildVideoPickerHeaderHtml(title) {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    _buildVideoPickerBodyHtml() {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-video-picker-scroll">
                <p id="file-manager-video-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.video.empty')}</p>
            </div>
        `;
    },

    /** Ứng với 'fileManagerVideo.videoPicker.tile.click' — LUÔN single-select (khác Photo không cần
     * branch theo `mode`) — bấm là chọn NGAY, đóng drawer luôn.
     * @param {string} videoKey
     */
    handleVideoPickerTileClick(videoKey) {
        if (!_videoPickerSession) return; // guard: picker đã đóng (race hiếm, vd đóng đúng lúc tap)
        _videoPickerSession.hasSelected = true;
        const onSelect = _videoPickerSession.onSelect;
        this._teardownVideoPicker();
        onSelect(videoKey);
    },

    /** Ứng với 'fileManagerVideo.videoPicker.close.click' — đóng picker qua nút X (huỷ, chưa chọn
     * gì) — `onCancel` CHỈ gọi khi CHƯA `hasSelected` (tránh gọi 2 lần nếu race hiếm). */
    handleVideoPickerCloseClick() {
        if (!_videoPickerSession) return;
        const { onCancel, hasSelected } = _videoPickerSession;
        this._teardownVideoPicker();
        if (!hasSelected && typeof onCancel === 'function') onCancel();
    },

    /** Dọn session + unmount windowing (revoke object URL NGAY) + đóng drawer — DÙNG CHUNG cho MỌI
     * lối thoát picker (chọn xong/huỷ). */
    _teardownVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer'); // event/workflow/video-gallery-window.js
        this._closeGenericDrawerFully();
        _videoPickerSession = null;
    },

    /** Trượt Generic Drawer xuống RỒI ẩn hẳn sau `transitionend` — cùng khuôn `_closeGenericDrawerFully()`
     * ở event/workflow/file-manager-photo.js (Core `core/generic-drawer.js` KHÔNG được tự
     * `addEventListener` cho DOM tĩnh, Rule 5a — chỉ Workflow được làm). Viết riêng bản của Video
     * (Rule 3: mỗi domain module tự chứa, không gọi chéo Workflow khác cho tiện ích nhỏ này). */
    _closeGenericDrawerFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
    },
};
