/**
 * event/workflow/file-manager-video.js — MỚI (21/07/2026). Chỉ còn LOGIC NGHIỆP VỤ của Video
 * (thêm/xoá, phân tích thumbnail lúc upload, mở Video Editor) + picker Generic Drawer
 * "Use background video" (Visualizer Control Center, tự inline logic riêng, KHÔNG qua hàm nào
 * dưới đây — xem `event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle()`) —
 * KHÔNG còn UI panel riêng.
 *
 * XOÁ (29/07/2026, yêu cầu Giang mục 1/2 — "chỉ giữ filename/RESOLUTION/playcount/listened ở tab
 * Chi tiết") — `_extractVideoMediaInfo()` (mediainfo.js, WASM, CDN unpkg) ĐÃ XOÁ HẲN cùng thẻ
 * `<script>` CDN ở index.html — tab "Chi tiết" không còn hiển thị codec/fps/bitrate/audioCodec/
 * audioBitrate nữa nên không cần phân tích các field này lúc upload. `_extractVideoThumbAndMeta()`
 * ngay dưới giờ chụp THÊM `thumbFullBlob` (full-res, frame 1) — field MỚI, TÁCH RIÊNG với
 * `thumbBlob` (vuông, dùng lưới/cover) — KHÔNG thay thế.
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang "làm luôn 6d") — TOÀN BỘ
 * phần dựng UI/panel "File Manager → Video" (openPanel()/_buildHeaderActionHtml()/
 * _wireHeaderActionEvents()/triggerUploadInput()/refresh() — lưới CSS Grid + nút xoá nhanh) ĐÃ XOÁ
 * HẲN, cùng lúc:
 *   - `openVideoTileActionMenu()` (dropdown 3 lựa chọn trên tile) — "Set as bg video"/"Edit video"
 *     dời sang menu 3 chấm DÙNG CHUNG của Playlist (`components/playlist-view.js` +
 *     `core/playlist/actions.js::openSongActionMenu()` + `event/workflow/playlist.js::
 *     navigateToActiveMenuVideoEdit()`, TÁI DÙNG NGUYÊN `navigateToVideoEdit()` bên dưới, chỉ đổi
 *     nơi gọi). ["Set làm nền" sau đó ĐÃ BỎ HẲN khỏi dropdown này, phản hồi Giang — TỰ AUDIT LẠI lúc
 *     xoá phát hiện `setVideoAsBackground()` (hàm từng ở file này) tưởng picker "Use background
 *     video" còn dùng nhưng THỰC RA KHÔNG — picker đó tự inline logic riêng, hàm này 0 lời gọi sau
 *     khi bỏ dropdown -> XOÁ THẲNG cùng 2 lang key liên quan, không giữ code chết.] "Xoá" giờ dùng chung
 *     `window.removeSong()` (core/playlist/actions.js, ĐÃ sửa media-aware) — `confirmDeleteSingleVideo()`
 *     (modal confirm riêng, dùng `deleteVideo()`) ĐÃ XOÁ, không còn nơi gọi.
 *   - Toàn bộ "chế độ xoá nhanh" (`promptQuickDeleteMode()`/`toggleQuickDeleteMarkInSet()`/
 *     `updateQuickDeleteModeUI()`/`_updateQuickDeleteButtonTitle()`/`confirmQuickDeleteBatch()`) ĐÃ
 *     XOÁ — tính năng CHỈ tồn tại trong lưới panel đã bỏ, không có UI nào khác dùng tới.
 *   - Upload video giờ vào từ Playlist (Batch 6, mục 7 — `#video-upload-input`,
 *     event/router/playlist.js case 'playlist.upload.videoFileChange') — `uploadVideos()` GIỮ
 *     NGUYÊN 100% thân hàm lúc đó (per-file error isolation, resolveVideoKey/saveVideo/extract thumb+
 *     mediainfo, tự `refreshVideoPlaylistIfActive()`), chỉ bỏ đoạn dọn input CỦA PANEL CŨ (đã chết,
 *     input mới ở Playlist tự dọn value trong chính listener của nó). [CẬP NHẬT 29/07/2026: bước
 *     "mediainfo" trong mô tả lịch sử này ĐÃ XOÁ HẲN khỏi `uploadVideos()`, xem đầu file.]
 *   - Settings row "Video" riêng (components/settings/file-manager-section.js) ĐÃ BỎ — chỉ còn
 *     "Song & Video" (đã gộp từ Batch 5).
 *
 * `event/workflow/video-gallery-window.js` KHÔNG xoá — vẫn được dùng bởi
 * `openVideoBgPicker()`/`_teardownVideoPicker()` bên dưới (mount/unmount 'genericDrawer'), chỉ
 * riêng lời gọi `mount('videoGrid', ...)`/`setTileBadge()`/`setBadgeMode()` (của panel/lưới/xoá
 * nhanh đã xoá) không còn ai gọi tới nữa.
 *
 * XOÁ (29/07/2026, yêu cầu Giang — "loại bỏ phần boot up thumb full cho video cũ, vì đã xong") —
 * `backfillMissingVideoThumbFull()`/`_captureFullResFrame1()` (thêm cùng ngày, chạy ngầm 1 lần lúc
 * boot backfill `thumbFullBlob` cho video cũ) ĐÃ XOÁ HẲN — đã hoàn thành nhiệm vụ, không giữ code
 * chỉ chạy 1 lần rồi mãi mãi no-op về sau. Xem cuối file cũ (đã xoá) nếu cần đối chiếu lại logic.
 * THÊM LẠI (30/07/2026, yêu cầu Giang "tạo lại thumb full res frame 1 cho toàn bộ video hiện có") —
 * `_captureFullResFrame1()`/`regenerateAllVideoThumbFull()` (cuối file) — KHÁC bản cũ ở trên: bản
 * NÀY GHI ĐÈ cho TOÀN BỘ video (không chỉ video thiếu field), cờ 1-lần đổi sang `localStorage`
 * (bản cũ dùng gì thì đã xoá, không đối chiếu được nữa).
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
     *
     * MỚI (29/07/2026, yêu cầu Giang mục 2 — "thêm thumbnail blob full RESOLUTION tại frame 1") —
     * ĐỒNG THỜI chụp THÊM `thumbFullBlob`: khung hình ĐẦU TIÊN (time=0, "frame 1") ở ĐÚNG kích
     * thước GỐC (KHÔNG center-crop vuông, KHÔNG resize) — TÁCH RIÊNG HẲN với `thumbBlob` phía trên
     * (vuông, chụp ở giây `min(1, duration/2)`, dùng cho lưới/cover) — KHÔNG thay thế bất cứ phần
     * nào của luồng cũ, chỉ thêm 1 field mới. Thứ tự: seek về 0 trước (chụp full-res) RỒI seek tiếp
     * sang mốc cũ (chụp thumb vuông) — 2 bước `seeked` NỐI TIẾP trên CÙNG 1 `<video>`, không tạo
     * thêm phần tử nào khác. `thumbFullBlob` là field PHỤ (`null` nếu `canvas.toBlob()` hiếm khi
     * lỗi) — KHÔNG chặn toàn bộ Promise nếu bước này thất bại, khác `thumbBlob`/`width`/`height`/
     * `duration` vẫn là BẮT BUỘC như cũ.
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, thumbFullBlob: (Blob|null), width: number, height: number, duration: number}>}
     */
    _extractVideoThumbAndMeta(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            let settled = false;
            let thumbFullBlob = null; // MỚI — full-res frame 1, gán ở bước seek ĐẦU (trước thumb vuông)
            const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} };
            const cleanupAndReject = (err) => { if (settled) return; settled = true; cleanup(); reject(err); };
            const safetyTimeout = taskManager.once(() => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] timeout đọc video')), 8000);

            videoEl.addEventListener('loadedmetadata', () => {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                if (!width || !height) { cleanupAndReject(new Error('[_extractVideoThumbAndMeta] video không có kích thước hợp lệ')); return; }
                videoEl.currentTime = 0; // Bước 1/2 — seek về frame 1 TRƯỚC (chụp full-res)
            }, { once: true });

            // Bước seek 1/2 — time=0 ("frame 1"), chụp thumbFullBlob FULL RESOLUTION (không crop/
            // resize). QUAN TRỌNG: listener bước 2/2 (onSquareThumbSeeked) chỉ được `addEventListener`
            // BÊN TRONG callback này (ngay trước khi seek tiếp) — KHÔNG đăng ký sẵn cùng lúc với bước
            // 1 ngay từ đầu, nếu không cả 2 listener sẽ CÙNG khớp đúng sự kiện 'seeked' ĐẦU TIÊN (lúc
            // time vừa về 0), khiến thumb vuông vô tình chụp nhầm frame 1 thay vì mốc `min(1,
            // duration/2)` như thiết kế.
            videoEl.addEventListener('seeked', function onFrameOneSeeked() {
                if (settled) return;
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = width; fullCanvas.height = height;
                fullCanvas.getContext('2d').drawImage(videoEl, 0, 0, width, height);
                fullCanvas.toBlob((blob) => {
                    if (settled) return;
                    thumbFullBlob = blob; // Blob|null — field PHỤ, không chặn nếu null
                    videoEl.addEventListener('seeked', onSquareThumbSeeked, { once: true }); // Bước 2/2 — đăng ký NGAY TRƯỚC lúc seek tiếp, không sớm hơn
                    videoEl.currentTime = Math.min(1, videoEl.duration / 2 || 0); // seek bước 2/2 — mốc cũ, cho thumb vuông
                }, 'image/jpeg', 0.92);
            }, { once: true });

            // Bước seek 2/2 — mốc cũ `min(1, duration/2)`, chụp thumbBlob VUÔNG (GIỮ NGUYÊN 100% như cũ).
            function onSquareThumbSeeked() {
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
                    resolve({ thumbBlob, thumbFullBlob, width, height, duration: videoEl.duration || 0 });
                }, 'image/jpeg', 0.85);
            }

            videoEl.addEventListener('error', () => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] không đọc được video')), { once: true });
            videoEl.src = objectUrl;
        });
    },

    // ===================== Regen TOÀN BỘ thumbFullBlob — THÊM (30/07/2026, yêu cầu Giang "tạo lại
    // thumb full res frame 1 cho toàn bộ video hiện có") =====================================
    // KHÁC bản backfill cũ đã xoá (chỉ vá video THIẾU field) — bản NÀY chụp lại + GHI ĐÈ
    // `thumbFullBlob` cho TOÀN BỘ video đang có trong DB, bất kể đã có field đó hay chưa.

    /** Chụp khung hình ĐẦU TIÊN (time=0, "frame 1"), FULL RESOLUTION (không crop/resize) từ 1 Blob
     * video BẤT KỲ — TÁCH RIÊNG khỏi `_extractVideoThumbAndMeta()` ở trên: hàm đó chạy lúc UPLOAD,
     * cần tính CẢ thumbBlob vuông + width/height/duration cùng lúc; ở đây video ĐÃ CÓ SẴN trong DB
     * (đã có đủ mọi field khác rồi) nên CHỈ cần đúng 1 việc — chụp lại `thumbFullBlob` — viết hàm
     * riêng, gọn hơn, đúng Rule 1 (1 tiến trình rõ ràng, không gánh thêm việc không liên quan).
     * KHÔNG throw — trả `null` nếu lỗi/timeout (field phụ, 1 video lỗi không được chặn cả lô, xem
     * `regenerateAllVideoThumbFull()` ngay dưới).
     * @param {Blob} blob - blob video GỐC (record.blob, service/db.js).
     * @returns {Promise<Blob|null>}
     */
    _captureFullResFrame1(blob) {
        return new Promise((resolve) => {
            const objectUrl = URL.createObjectURL(blob);
            const videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            let settled = false;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                try { URL.revokeObjectURL(objectUrl); } catch (e) {}
                resolve(result);
            };
            const safetyTimeout = taskManager.once(() => finish(null), 8000);

            videoEl.addEventListener('loadedmetadata', () => {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                if (!width || !height) { finish(null); return; }
                videoEl.currentTime = 0; // seek về frame 1 — sự kiện 'seeked' bên dưới mới thật sự chụp
            }, { once: true });

            videoEl.addEventListener('seeked', () => {
                if (settled) return;
                safetyTimeout.kill();
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(videoEl, 0, 0, width, height);
                canvas.toBlob((thumbFullBlob) => finish(thumbFullBlob || null), 'image/jpeg', 0.92);
            }, { once: true });

            videoEl.addEventListener('error', () => finish(null), { once: true });
            videoEl.src = objectUrl;
        });
    },

    /** Chạy NGẦM ĐÚNG 1 LẦN lúc boot (gọi từ `event/workflow/app-boot.js::boot()`) — chụp LẠI
     * `thumbFullBlob` cho TOÀN BỘ video đang có trong DB, GHI ĐÈ cả video đã có sẵn field này (khác
     * hẳn bản backfill cũ đã xoá 29/07/2026, bản đó CHỈ vá video thiếu field).
     *
     * Cờ 1-lần ghi vào `localStorage` (KHÔNG qua IndexedDB/meta như phần lớn state khác của app —
     * Giang yêu cầu cụ thể `localStorage`, đơn giản/đồng bộ, đọc được NGAY lúc hàm này chạy mà
     * không cần mở IndexedDB trước) — CÙNG khuôn `core/resume-state-storage.js` (key `sav_..._v1`,
     * wrap try/catch phòng localStorage đầy/bị chặn — Safari riêng tư...).
     *
     * "Đồng bộ" (Giang yêu cầu) — xử lý TUẦN TỰ từng video 1 (`for` + `await`, KHÔNG `Promise.all`
     * song song) — tránh mở hàng chục `<video>` giải mã cùng lúc, tốn RAM/CPU nặng trên máy yếu/di
     * động. Bọc `withLoadingShield()` (khoá thao tác khác trong lúc chạy, CÙNG khuôn `uploadVideos()`
     * ở trên) + hiện tiến trình `x/total` qua `loadingText.textContent`, CẬP NHẬT NGAY TRONG vòng
     * lặp — CÙNG PATTERN `core/playlist/loader.js::window.loadSongsFromFiles()`.
     *
     * Lỗi 1 video (file hỏng/không đọc được) KHÔNG chặn cả lô — bắt riêng, bỏ qua đúng video đó
     * (`_captureFullResFrame1()` tự trả `null` thay vì throw). VẪN ghi cờ xong khi hết vòng lặp dù
     * có video lỗi giữa chừng — không lặp lại mãi mãi mỗi lần mở app chỉ vì 1 video hỏng.
     */
    async regenerateAllVideoThumbFull() {
        const FLAG_KEY = 'sav_videoThumbFullRegenV1Done';
        try { if (localStorage.getItem(FLAG_KEY) === '1') return; } catch (e) { return; } // đã chạy xong 1 lần, HOẶC localStorage không đọc được -> an toàn bỏ qua, không lặp lại

        const videos = await listVideos(); // core/file-manager/video.js
        if (videos.length === 0) { try { localStorage.setItem(FLAG_KEY, '1'); } catch (e) {} return; } // không có video nào -> đánh dấu xong luôn, khỏi chờ lần sau

        await withLoadingShield(tFormat('fileManager.video.thumbFullRegenProgress', { done: 0, total: videos.length }), async () => {
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                loadingText.textContent = tFormat('fileManager.video.thumbFullRegenProgress', { done: i + 1, total: videos.length });
                try {
                    const thumbFullBlob = await this._captureFullResFrame1(video.blob);
                    const record = await getVideoRecord(video.key); // service/db.js — đọc lại MỚI NHẤT, phòng video vừa bị xoá/sửa ở nơi khác giữa lúc vòng lặp dài đang chạy
                    if (!record) continue; // guard: video vừa bị xoá ở nơi khác giữa chừng — bỏ qua, không lỗi
                    record.thumbFullBlob = thumbFullBlob; // CHỈ ghi đè ĐÚNG field này, giữ nguyên mọi field khác (blob/thumbBlob/customName/...)
                    await setVideoRecord(video.key, record); // service/db.js
                } catch (err) {
                    console.error(`[regenerateAllVideoThumbFull] chụp lại thumbFullBlob thất bại cho video "${video.key}":`, err);
                }
            }
        });

        try { localStorage.setItem(FLAG_KEY, '1'); } catch (e) {} // ghi cờ SAU KHI xong hẳn vòng lặp (kể cả có video lỗi giữa chừng) — không chạy lại nữa
    },

    /** Ứng với 'playlist.upload.videoFileChange' (Batch 6, mục 7 — trước đây
     * 'fileManagerVideo.upload.change', gọi từ panel đã xoá). Lỗi 1 file (vd file hỏng) KHÔNG chặn
     * cả lô upload — bắt riêng, bỏ qua đúng file đó, tiếp tục file sau (Rule 1: vẫn 1 tiến trình
     * "upload cả lô").
     * XOÁ (29/07/2026, yêu cầu Giang mục 1/2) — bỏ hẳn bước `_extractVideoMediaInfo()` (mediainfo.js
     * WASM) — tab "Chi tiết" không còn hiển thị codec/fps/bitrate/audioCodec/audioBitrate nữa nên
     * không cần phân tích các field này lúc upload. `_extractVideoThumbAndMeta()` giờ trả THÊM
     * `thumbFullBlob` (full-res, frame 1) — truyền thẳng vào `saveVideo()`.
     * @param {FileList|File[]} files
     */
    async uploadVideos(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                try {
                    const { thumbBlob, thumbFullBlob, width, height, duration } = await this._extractVideoThumbAndMeta(file);
                    await saveVideo(file, file.name, thumbBlob, width, height, duration, thumbFullBlob); // core/file-manager/video.js
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

    /**
     * XOÁ (phản hồi Giang — "bỏ luôn set background cho dropdown của video đi") — TỰ AUDIT LẠI
     * (phát hiện lúc xoá): `setVideoAsBackground()` (hàm cũ từng ở đây) tưởng vẫn còn 1 nơi gọi là
     * picker "Use background video" — SAI, grep toàn project xác nhận picker đó (`enableVideoBackgroundToggle()`,
     * event/workflow/visualizer-control-center.js) tự inline nguyên logic riêng của nó (đọc record/
     * withLoadingShield/setMeta('videoBg',...)/applyUploadedVideoBg()), KHÔNG hề gọi hàm này —
     * `setVideoAsBackground()` chỉ từng có ĐÚNG 1 nơi gọi là dropdown "Set làm nền" (Playlist, action
     * 'setAsBgVideo') đã bỏ hẳn. XOÁ THẲNG cả hàm (0 lời gọi còn lại, đúng nguyên tắc "làm mới UI,
     * không mang code chết theo" đã áp dụng xuyên suốt Batch 6) — cùng lúc xoá 2 lang key
     * `fileManager.video.setAsBgVideo.blockedByPlayerMode`/`.success` (lang/patch/patch-file-manager.js).
     */

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
