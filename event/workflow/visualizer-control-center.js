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
 */
const workflowVisualizerControlCenter = {

    /** MỚI (04/07/2026, mục 1) — ứng với gạt "#setting-video-enable" lên On: LUÔN mở hộp thoại
     * chọn file NGAY (input ẩn, kích hoạt qua .click()) — KHÔNG tự bật `videoBgEnabled` ở đây, chờ
     * đúng sự kiện 'change' (chọn xong) hoặc 'cancel' (huỷ, xem listener) mới quyết định. */
    async enableVideoBackgroundToggle() {
        videoUploadInput.click();
    },

    /** Ứng với msg.type = 'visualizerControlCenter.videoEnable.change' khi TẮT — CHỈ còn đồng bộ
     *  state/UI (core `disableVideoBackgroundState()` không còn đụng IndexedDB) -> không cần shield
     *  nữa, nhưng vẫn giữ wrapper async cho nhất quán interface gọi từ router. */
    async disableVideoBackground() {
        disableVideoBackgroundState(); // core: dọn vizConfig.videoBgUrl (GIỮ NGUYÊN meta.videoBg) + đồng bộ UI
    },

    /**
     * Ứng với msg.type = 'visualizerControlCenter.videoUpload.change' — lưu blob mới vào
     *  IndexedDB trước (cần shield vì IndexedDB async), rồi mới gọi "tay" applyUploadedVideoBg.
     *  File không hợp lệ hoặc lưu lỗi -> tự trả toggle về "off" (MỚI, mục 1 — tránh kẹt "on" không
     *  có gì thật phía sau).
     * @param {{file: File}} payload
     */
    async uploadVideoBackground(payload) {
        const { file } = payload;
        const check = validateVideoFile(file);
        if (!check.valid) { await alertModal(check.reason); videoEnableToggle.checked = false; return; }
        await withLoadingShield(t('common.loading.savingVideoBg'), async () => {
            await setMeta('videoBg', file);
            applyUploadedVideoBg(file); // core: tạo blob URL + bật + đồng bộ UI (validate lại 1 lần nữa, vô hại)
        });
    },

    /** MỚI (03/07/2026, mục 2; VIẾT LẠI 04/07/2026, mục 1) — ứng với gạt
     * "#setting-visual-bg-image-enable" lên On: LUÔN mở picker chọn 1 ảnh có sẵn trong File
     * Manager. Huỷ/đóng picker không chọn gì -> `onCancel` tự trả toggle về "off" (tham số mới của
     * openImageLibraryPickerModal, core/file-manager/photo-ui.js — fix đúng bug đã báo). */
    async pickVisualBgImageFromLibrary() {
        const images = await listImages(); // core có sẵn (core/file-manager/image.js), CÓ return, DÙNG ngay dưới
        openImageLibraryPickerModal(images, async (imageKey) => { // core/file-manager/photo-ui.js
            const record = await getImageRecord(imageKey); // core có sẵn (service/db.js)
            if (!record) { settingVisualBgImageEnableToggle.checked = false; return; } // guard: ảnh vừa bị xoá -> coi như huỷ
            await withLoadingShield(t('common.loading.savingImageBg'), async () => {
                await applyVisualBgImage(record.blob); // core có sẵn (core/state-and-video-bg.js)
            });
        }, () => {
            settingVisualBgImageEnableToggle.checked = false; // MỚI — huỷ/đóng modal không chọn gì -> tự trả về "off"
        });
    },

    /** MỚI (03/07/2026, mục 2) — tắt nền tĩnh Visual (checkbox Settings). FIX (04/07/2026, mục 1) —
     * core `disableVisualBgImageState()` không còn đụng IndexedDB -> không cần shield nữa. */
    async disableVisualBgImage() {
        disableVisualBgImageState(); // core có sẵn (core/state-and-video-bg.js)
    }
};
