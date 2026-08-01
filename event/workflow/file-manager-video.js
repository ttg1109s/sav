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
 * THÊM LẠI RỒI XOÁ HẲN (30/07/2026, cùng ngày) — `_captureFullResThumbFrame()`/
 * `regenerateAllVideoThumbFull()` (chạy ngầm lúc boot, quét lại TOÀN BỘ video cũ) từng thêm rồi xoá
 * lại NGAY TRONG CÙNG NGÀY sau khi Giang xác nhận kỹ thuật chụp khung đầu (readyState>=2 +
 * play()/pause() nudge, xem `_extractVideoThumbAndMeta()` bên dưới) hoạt động đúng qua test thật —
 * quyết định CHỈ áp dụng kỹ thuật đó cho video UPLOAD MỚI, không cần thêm 1 lượt quét lại video cũ
 * nữa. Video cũ (upload trước batch này) nếu vẫn thiếu/lỗi `thumbFullBlob` sẽ KHÔNG được vá lại trừ
 * khi tự re-upload.
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
     * do đặt ở Workflow (không phải core/file-manager/video.js) như `resizeImageForThumbnail()`
     * (file-manager-photo.js): cần `<video>`/`canvas` — DOM API, core không được đụng theo Rule 1-4.
     * Chụp khung hình tại giây `min(1, duration/2)` — tránh giây đầu tiên hay bị đen/mờ (video vừa
     * mở), cũng tránh vọt quá xa nếu video ngắn hơn 1 giây.
     * `width`/`height` trả về là kích thước GỐC của video (KHÔNG phải kích thước thumb) — vẫn lưu
     * riêng như cũ, dùng chỗ khác nếu cần tỉ lệ thật (đúng plan mục 4).
     *
     * MỚI (29/07/2026, yêu cầu Giang mục 2 — "thêm thumbnail blob full RESOLUTION tại frame 1") —
     * ĐỒNG THỜI chụp THÊM `thumbFullBlob`: khung hình ĐẦU VIDEO ở ĐÚNG kích thước GỐC (KHÔNG
     * center-crop vuông, KHÔNG resize) — TÁCH RIÊNG HẲN với `thumbBlob` phía trên (vuông, chụp ở
     * giây `min(1, duration/2)`, dùng cho lưới/cover) — KHÔNG thay thế bất cứ phần nào của luồng cũ,
     * chỉ thêm 1 field mới.
     *
     * SỬA (30/07/2026, phản hồi Giang — "có tồn tại ảnh full res nhưng đen xì, frame đầu phải khớp
     * đầu video, đừng để duration/2") — bản đầu chụp thumbFullBlob bằng `currentTime = 0` + đợi 1
     * mình sự kiện `seeked` — KHÔNG đủ chắc: nhiều engine/thiết bị không bắn `seeked` đáng tin cậy
     * ngay tại time=0 (video chưa từng seek lần nào), khiến canvas vẽ ra khung TRẮNG/ĐEN của
     * `<video>` chưa kịp có dữ liệu thật, chứ KHÔNG PHẢI nội dung thật của video tại đó — ĐÚNG kỹ
     * thuật đã dùng ở `event/workflow/video-editor.js::_onMetadataReady()` (vẽ khung đầu tiên,
     * cùng vấn đề): nghe CẢ 3 sự kiện (`loadeddata`/`canplay`/`seeked`, cái nào tới trước chụp
     * trước, chụp thêm lần cũng vô hại nhờ cờ `fullFrameCaptured`) + ép trình duyệt SEEK THẬT bằng
     * cách gán `currentTime = 0.0001` RỒI `= 0` ngay sau (một số engine bỏ qua yêu cầu seek nếu
     * `currentTime` đang SẴN LÀ giá trị đích) + vẽ NGAY nếu khung hình đã sẵn có
     * (`readyState >= 2`, HAVE_CURRENT_DATA — phòng cả 3 sự kiện trên đã bắn TRƯỚC khi kịp đăng ký).
     * Thứ tự: chụp full-res ĐÚNG khung đầu TRƯỚC, RỒI mới seek tiếp sang mốc cũ (chụp thumb vuông) —
     * vẫn CHỈ 1 `<video>` duy nhất, không tạo thêm phần tử nào khác. `thumbFullBlob` là field PHỤ
     * (`null` nếu `canvas.toBlob()` hiếm khi lỗi) — KHÔNG chặn toàn bộ Promise nếu bước này thất
     * bại, khác `thumbBlob`/`width`/`height`/`duration` vẫn là BẮT BUỘC như cũ.
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
            let thumbFullBlob = null; // gán ở bước chụp full-res ĐẦU (trước thumb vuông)
            let fullFrameCaptured = false; // chặn chụp full-res quá 1 lần (3 sự kiện CÙNG nghe, xem docstring)
            const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} };
            const cleanupAndReject = (err) => { if (settled) return; settled = true; cleanup(); reject(err); };
            const safetyTimeout = taskManager.once(() => cleanupAndReject(new Error('[_extractVideoThumbAndMeta] timeout đọc video')), 8000);

            let nudgedFullRes = false; // chặn play()/pause() ép decode quá 1 lần

            // Bước 1/2 — chụp full-res ĐÚNG khung đầu video thật (CÙNG kỹ thuật event/workflow/
            // video-editor.js::_onMetadataReady(), xem docstring trên vì sao cần robust hơn 1 mình
            // 'seeked'). QUAN TRỌNG: seek bước 2/2 (onSquareThumbSeeked) chỉ được đăng ký BÊN TRONG
            // callback này (ngay trước khi seek tiếp) — không đăng ký sẵn từ đầu, tránh khớp nhầm
            // đúng sự kiện 'seeked' của bước 1.
            // SỬA (30/07/2026, Giang test thật xác nhận qua log — 3 sự kiện có thể bắn TRƯỚC khi
            // `readyState` thật sự đạt HAVE_CURRENT_DATA, canvas vẽ ra rỗng dù đã seek "xong" theo
            // sự kiện) — THÊM guard `readyState >= 2` NGAY TRONG hàm, chưa đủ thì KHÔNG vẽ vội, ép
            // "nhá" `play()`/`pause()` 1 lần (muted, không bị chặn autoplay) để buộc trình duyệt bắt
            // đầu decode thật, nghe thêm `playing` làm cơ hội chụp lại — ÁP DỤNG LẠI y hệt
            // `_captureFullResThumbFrame()` (đã xoá, dùng lúc regen — xem lịch sử patch) vì đã xác
            // nhận hoạt động đúng qua test thật.
            function captureFullResFrame() {
                if (settled || fullFrameCaptured) return;
                if (videoEl.readyState < 2) {
                    if (!nudgedFullRes) {
                        nudgedFullRes = true;
                        videoEl.addEventListener('playing', captureFullResFrame, { once: true });
                        videoEl.play().then(() => videoEl.pause()).catch(() => {});
                    }
                    return; // còn cơ hội ở lần bắn sau, KHÔNG set fullFrameCaptured
                }
                fullFrameCaptured = true;
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
            }

            videoEl.addEventListener('loadedmetadata', () => {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                if (!width || !height) { cleanupAndReject(new Error('[_extractVideoThumbAndMeta] video không có kích thước hợp lệ')); return; }
                videoEl.addEventListener('loadeddata', captureFullResFrame, { once: true });
                videoEl.addEventListener('canplay', captureFullResFrame, { once: true });
                videoEl.addEventListener('seeked', captureFullResFrame, { once: true });
                videoEl.currentTime = 0.0001; // ép trình duyệt SEEK THẬT (một số engine bỏ qua nếu currentTime đã sẵn là 0)
                videoEl.currentTime = 0; // rồi về ĐÚNG khung đầu tiên thật sự
                if (videoEl.readyState >= 2) captureFullResFrame(); // đã có sẵn khung hình (HAVE_CURRENT_DATA) — chụp ngay, phòng 3 sự kiện trên đã bắn TRƯỚC khi kịp đăng ký
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

    // XOÁ (30/07/2026, yêu cầu Giang — kỹ thuật readyState>=2 + play()/pause() nudge đã áp dụng
    // THẲNG vào `_extractVideoThumbAndMeta()` ở trên cho video upload MỚI, không cần thêm 1 lượt
    // "quét lại toàn bộ video cũ" nữa) — `_captureFullResThumbFrame()`/`regenerateAllVideoThumbFull()`
    // (thêm cùng ngày, chạy ngầm lúc boot) ĐÃ XOÁ HẲN — không giữ code chết. Video ĐÃ CÓ trong DB
    // trước batch này (nếu thumbFullBlob vẫn null/đen do 3 lần fix trước) sẽ KHÔNG được vá lại nữa
    // trừ khi tự re-upload — lang key `fileManager.video.thumbFullRegenProgress` (lang/patch/
    // patch-file-manager.js) xoá theo, không còn ai dùng.

    /** Ứng với 'playlist.upload.videoFileChange' (Batch 6, mục 7 — trước đây
     * 'fileManagerVideo.upload.change', gọi từ panel đã xoá). Lỗi 1 file (vd file hỏng) KHÔNG chặn
     * cả lô upload — bắt riêng, bỏ qua đúng file đó, tiếp tục file sau (Rule 1: vẫn 1 tiến trình
     * "upload cả lô").
     * MỚI (31/07/2026) — hiện tiến trình "X/Y" qua `loadingText.textContent`, ĐÚNG pattern
     * `handleAudioFiles()` (Song, core/playlist/loader.js) — tái dùng NGUYÊN lang key
     * `common.upload.loadingProgress` (đã generic sẵn, không riêng "song"), TRƯỚC ĐÂY chỉ hiện
     * text tĩnh `common.loading.savingInfo` suốt cả lô, không biết đang xử lý tới đâu.
     * @param {FileList|File[]} files
     */
    async uploadVideos(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(tFormat('common.upload.loadingProgress', { done: 1, total: fileArray.length }), async () => {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                loadingText.textContent = tFormat('common.upload.loadingProgress', { done: i + 1, total: fileArray.length });
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
     * Video). SỬA ("Song/Video Unification" v12, gộp Video Editor vào Modal xem Video) — TRƯỚC
     * ĐÂY điều hướng sang trang `video-editor.html` (window.location.href, ĐÃ XOÁ HẲN cùng trang
     * đó) — GIỜ mở thẳng modal xem Video tại chỗ (đúng khuôn modal xem Ảnh — mục 2 yêu cầu Giang),
     * KHÔNG còn điều hướng trang nào cả. Đổi tên hàm giữ NGUYÊN (nơi gọi — event/workflow/
     * playlist.js::navigateToActiveMenuVideoEdit() — không cần sửa gì).
     * @param {string} videoKey
     */
    navigateToVideoEdit(videoKey) {
        workflowVideoPreview.open(videoKey); // event/workflow/video-preview.js
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

        // SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") —
        // TOÀN BỘ phần dựng Generic Drawer + wire closeBtn/delegated click tile ĐÃ DỜI sang
        // core/file-manager/video-ui.js::openVideoPickerDrawerUi().
        openVideoPickerDrawerUi(t('fileManager.video.pickerTitle'), this._buildVideoPickerBodyHtml()); // core/file-manager/video-ui.js

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
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        _videoPickerSession = null;
    },
};
