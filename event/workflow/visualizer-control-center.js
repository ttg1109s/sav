/**
 * event/workflow/visualizer-control-center.js — "THẰNG THỰC THI CUỐI" của router
 * "visualizerControlCenter".
 *
 * FIX (04/07/2026, mục 1 phản hồi Giang) — VIẾT LẠI toàn bộ 4 method liên quan video/ảnh nền
 * Visual, ĐẢO NGƯỢC 2 quyết định cũ (xem lịch sử patch):
 *   1. Bỏ hẳn 2 nút riêng "Choose"/"Chọn ảnh" — gạt toggle "On" giờ TỰ mở hộp thoại chọn file/
 *      picker ảnh LUÔN (KHÔNG còn giả định "đã biết chắc có sẵn từ trước" như
 *      `enableVideoBackground()` bản cũ — giả định đó SAI khi bật lần đầu, sinh "on ảo").
 *   2. Huỷ/đóng picker mà KHÔNG chọn gì -> tự trả toggle về "off" (bug đã báo: toggle kẹt "on").
 *   3. Tắt toggle giờ CHỈ ẩn hiển thị — KHÔNG còn xoá Blob khỏi IndexedDB (2 core function
 *      `disableVideoBackgroundState()`/`disableVisualBgImageState()` đã sửa tương ứng, xem
 *      core/state-and-video-bg.js) — vì vậy 2 nhánh "tắt" dưới đây không còn cần shield nữa.
 *
 * MỚI (04/07/2026, mục 2 phản hồi Giang; SỬA 18/07/2026, mục 1 — gộp chung 2 hàm riêng thành 1
 *   điểm đồng bộ duy nhất, xem event/workflow/slideshow.js::syncPlaybackGate()):
 *   - Video nền BẬT/TẮT giờ GỌI TRỰC TIẾP `workflowSlideshow.syncPlaybackGate()` NGAY tại đây —
 *     THAY watchdog poll 3s/lần đã XOÁ hẳn khỏi event/workflow/slideshow.js (Giang chỉ ra ĐÚNG: đã
 *     có sẵn sự kiện click bật/tắt video để biết, poll lại appState mỗi 3s là thừa). Hàm đó GIỜ
 *     CŨNG tự kiểm tra thêm điều kiện nhạc đang phát (mục 1, 18/07/2026) — KHÔNG chỉ riêng video
 *     nền nữa, nên gọi TỪ ĐÂY vẫn đúng dù lý do gọi ban đầu chỉ là video nền.
 */
const workflowVisualizerControlCenter = {

    /** SỬA (21/07/2026, Batch 2 module Video — Giang yêu cầu "Use background video -> mở generic
     * drawer -> video") — THAY HẲN `videoUploadInput.click()` (hộp thoại chọn file OS cũ, xem lịch
     * sử patch): giờ mở Generic Drawer chọn 1 video CÓ SẴN trong File Manager -> Video (Giang chốt
     * — mục 21/07/2026: CHỈ chọn từ thư viện có sẵn, KHÔNG có "Upload mới" ngay trong drawer, phải
     * upload trước ở File Manager -> Video).
     * DỌN DẸP (21/07/2026, cùng đợt) — xác nhận `id="setting-video-upload"` CHỈ sống thật ở ĐÚNG 1
     * nơi (components/settings/visualizer-geometry-color.js — bản trong
     * components/settings/playlist-background.js là tư liệu đối chiếu đã biết KHÔNG mount, xem
     * comment components/settings-drawer.js) — XOÁ HẲN input đó + `videoUploadInput` (core/dom-
     * refs.js) + listener 'change'/'cancel' (event/listener/visualizer-control-center.js) +
     * 2 case router tương ứng + `uploadVideoBackground()` (ngay dưới, không còn ai gọi tới).
     *
     * KHOÁ CHÉO với Video Player mode (MỚI, 21/07/2026 buổi chiều; SỬA LẦN 2 cùng ngày — Giang chỉ
     * ra "Block (event/block.js) có sẵn tính năng notify, sao phải tự viết alertModal?") — Block
     * gate ĐÃ tự chặn message 'visualizerControlCenter.videoEnable.enable.click' + tự bật notify
     * NẾU `isVideoPlayerMode===true` (đăng ký ở event/block.js) — hàm NÀY KHÔNG cần tự kiểm tra lại
     * điều kiện đó nữa (bỏ hẳn `if (...) { alertModal(...); return; }` cũ). 2 tính năng dùng CHUNG
     * `bgVideoElement` — không được cùng bật.
     * [SỬA — ver12 "Song/Video Unification", Batch 2] Chiều ĐỐI XỨNG (chặn bật Video Player mode
     * khi Video nền đang bật) TỪNG đăng ký ở event/block.js cho checkbox cũ
     * (`workflowFileManagerVideo.enablePlayerModeFromPanel()`, ĐÃ BỎ HẲN) — entry point MỚI vào
     * Video Player mode (`window.playSong()` dispatch theo mediaType, core/playlist/actions.js) tự
     * `eventBus.send()` msg.type 'videoPlayer.startFromPlaylist.click' (xem event/router/
     * video-player.js) nên đăng ký LẠI được rule đối xứng ở đúng msg.type đó (event/block.js).
     *
     * Tái dùng THẲNG `applyUploadedVideoBg()` (core/state-and-video-bg.js, di sản — KHÔNG đụng file
     * đó) — hàm này nhận `File` NHƯNG chỉ đọc `.type`/gọi `URL.createObjectURL()`, hoàn toàn hoạt
     * động đúng với 1 `Blob` đọc lại từ IndexedDB (record.blob, KHÔNG có `.name`) — đã xác nhận
     * `validateVideoFile()` (core/upload-validation.js) chỉ fallback đọc `.name` khi `.type` RỖNG,
     * mà Blob lưu qua IndexedDB LUÔN giữ nguyên `.type`. */
    async enableVideoBackgroundToggle() {
        workflowFileManagerVideo.openVideoBgPicker(async (videoKey) => { // event/workflow/file-manager-video.js
            const record = await getVideoRecord(videoKey); // service/db.js
            if (!record) { videoEnableToggle.checked = false; return; } // guard: video vừa bị xoá ở nơi khác -> coi như huỷ
            await withLoadingShield(t('common.loading.savingVideoBg'), async () => {
                await setMeta('videoBg', record.blob); // service/db.js — cùng cơ chế persist reload cũ (khoá `meta.videoBg`, xem core/config.js::loadBackgroundAssets())
                applyUploadedVideoBg(record.blob); // core/state-and-video-bg.js, di sản — tạo blob URL + bật + đồng bộ UI
            });
            if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.syncPlaybackGate();
        }, () => {
            videoEnableToggle.checked = false; // huỷ/đóng picker không chọn gì -> tự trả toggle về "off"
        });
    },

    /** Ứng với msg.type = 'visualizerControlCenter.videoEnable.change' khi TẮT — CHỈ còn đồng bộ
     *  state/UI (core `disableVideoBackgroundState()` không còn đụng IndexedDB) -> không cần shield
     *  nữa, nhưng vẫn giữ wrapper async cho nhất quán interface gọi từ router. */
    async disableVideoBackground() {
        disableVideoBackgroundState(); // core: dọn vizConfig.videoBgUrl (GIỮ NGUYÊN meta.videoBg) + đồng bộ UI
        // MỚI (mục 2) — video tắt -> báo TRỰC TIẾP cho slideshow tự resume (THAY watchdog poll đã bỏ).
        if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.syncPlaybackGate();
    },

    // SỬA (21/07/2026, dọn dẹp sau Batch 2 module Video) — `uploadVideoBackground()` (ứng với
    // msg.type cũ 'visualizerControlCenter.videoUpload.change') ĐÃ XOÁ HẲN — không còn input file
    // OS nào gọi tới nữa (xem event/router/visualizer-control-center.js, case đã xoá tương ứng).
    // Luồng "chọn video mới" giờ NẰM TRONG `enableVideoBackgroundToggle()` ngay dưới (callback
    // `onSelect` của Generic Drawer picker).


    /** MỚI (03/07/2026, mục 2; VIẾT LẠI 04/07/2026, mục 1) — ứng với gạt
     * "#setting-visual-bg-image-enable" lên On: LUÔN mở picker chọn 1 ảnh có sẵn trong File
     * Manager. Huỷ/đóng picker không chọn gì -> `onCancel` tự trả toggle về "off" (tham số của
     * openImageCarouselPickerModal, core/file-manager/photo-ui.js — fix đúng bug đã báo).
     *
     * THỬ NGHIỆM (30/07/2026, yêu cầu Giang — "test xem thực sự có full res video hay không") —
     * TẠM ĐỔI nguồn từ Photo (`listImages()`/`getImageRecord()`) sang Video full-res
     * (`listVideos()`/`thumbFullBlob`) — KHÔNG thêm entry point/UI nào khác, dùng ĐÚNG 1 điểm vào
     * cũ (gạt toggle Settings). `openImageCarouselPickerModal()` (core/file-manager/photo-ui.js)
     * KHÔNG đổi gì — hàm đó vốn đã generic, chỉ cần mảng `{key, blob, filename}` bất kỳ. Video
     * KHÔNG có `thumbFullBlob` (chưa regen xong/lỗi) bị LỌC BỎ khỏi carousel (Rule 1 — carousel chỉ
     * hiện đúng những gì thật sự chọn được, không hiện rồi báo lỗi sau khi bấm).
     * ĐÂY LÀ BẢN TEST — CHƯA quyết định giữ lại lâu dài, chưa quyết định entry point thật sự (báo
     * lại Giang trước khi làm bản chính thức).
     */
    async pickVisualBgImageFromLibrary() {
        const allVideos = await listVideos(); // core có sẵn (core/file-manager/video.js)
        const videos = allVideos.filter(v => v.thumbFullBlob); // LỌC video CÓ thumbFullBlob (Blob null bị bỏ qua)
        // THÊM (30/07/2026, phản hồi Giang — "vẫn là ảnh của photo") — log rõ ràng SỐ LƯỢNG để chẩn
        // đoán trực tiếp qua console: nếu `videos.length` = 0 dù `allVideos.length` > 0, nghĩa là
        // CHƯA video nào có thumbFullBlob thật (regen chưa chạy/chưa xong/lỗi toàn bộ — xem
        // event/workflow/file-manager-video.js::regenerateAllVideoThumbFull(), đã sửa để KHÔNG ghi
        // cờ "xong" vĩnh viễn nếu lần chạy đầu lỗi hết, sẽ tự thử lại lần boot sau).
        console.log(`[pickVisualBgImageFromLibrary] tổng video: ${allVideos.length} | có thumbFullBlob: ${videos.length}`);
        if (videos.length === 0) {
            settingVisualBgImageEnableToggle.checked = false; // huỷ, KHÔNG mở modal rỗng — tự trả toggle về "off"
            alertModal(t('fileManager.video.noFullResThumbForBgImage')); // MỚI — thông báo RIÊNG cho nhánh test này, KHÔNG dùng lại 'fileManager.photo.image.empty' (dễ gây hiểu lầm đang nói về Photo)
            return;
        }
        const items = videos.map(v => ({ key: v.key, blob: v.thumbFullBlob, filename: v.customName || v.filename })); // khớp shape {key, blob, filename} openImageCarouselPickerModal() cần
        openImageCarouselPickerModal(items, async (videoKey) => { // core/file-manager/photo-ui.js
            const record = await getVideoRecord(videoKey); // service/db.js
            if (!record || !record.thumbFullBlob) { settingVisualBgImageEnableToggle.checked = false; return; } // guard: video vừa bị xoá/mất field giữa lúc đang chọn -> coi như huỷ
            await withLoadingShield(t('common.loading.savingImageBg'), async () => {
                await applyVisualBgImage(record.thumbFullBlob); // core có sẵn (core/state-and-video-bg.js) — KHÔNG đổi gì, hàm đó chỉ nhận Blob bất kỳ
            });
        }, () => {
            settingVisualBgImageEnableToggle.checked = false; // MỚI — huỷ/đóng modal không chọn gì -> tự trả về "off"
        });
    },

    /** MỚI (03/07/2026, mục 2) — tắt nền tĩnh Visual (checkbox Settings). FIX (04/07/2026, mục 1) —
     * core `disableVisualBgImageState()` không còn đụng IndexedDB -> không cần shield nữa. */
    async disableVisualBgImage() {
        disableVisualBgImageState(); // core có sẵn (core/state-and-video-bg.js)
    },
};
