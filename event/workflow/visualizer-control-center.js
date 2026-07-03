/**
 * event/workflow/visualizer-control-center.js — "THẰNG THỰC THI CUỐI" của router
 * "visualizerControlCenter". Chỉ 2 method cần workflow (đụng IndexedDB qua delMeta/setMeta,
 * cần withLoadingShield) trong toàn bộ 7 msg.type của cụm này.
 */
const workflowVisualizerControlCenter = {

    /** Ứng với msg.type = 'visualizerControlCenter.videoEnable.change' khi TẮT — xoá blob đã lưu
     *  trong IndexedDB trước, rồi mới đồng bộ state/UI qua core. */
    async disableVideoBackground() {
        await withLoadingShield(t('common.loading.deletingVideoBg'), async () => {
            await delMeta('videoBg');
            disableVideoBackgroundState(); // core: dọn vizConfig.videoBgUrl + đồng bộ UI
        });
    },

    /** Ứng với msg.type = 'visualizerControlCenter.videoUpload.change' — lưu blob mới vào
     *  IndexedDB trước (cần shield vì IndexedDB async), rồi mới gọi "tay" applyUploadedVideoBg.
     * @param {{file: File}} payload
     */
    async uploadVideoBackground(payload) {
        const { file } = payload;
        const check = validateVideoFile(file);
        if (!check.valid) { await alertModal(check.reason); return; }
        await withLoadingShield(t('common.loading.savingVideoBg'), async () => {
            await setMeta('videoBg', file);
            applyUploadedVideoBg(file); // core: tạo blob URL + bật + đồng bộ UI (validate lại 1 lần nữa, vô hại)
        });
    },

    /** MỚI (03/07/2026, mục 2) — mở picker chọn 1 ảnh có sẵn trong File Manager làm nền tĩnh
     * Visual. Đọc danh sách ảnh RỒI mở picker -> ≥2 bước -> workflow. */
    async pickVisualBgImageFromLibrary() {
        const images = await listImages(); // core có sẵn (core/file-manager/image.js), CÓ return, DÙNG ngay dưới
        openImageLibraryPickerModal(images, async (imageKey) => { // core/file-manager/photo-ui.js
            const record = await getImageRecord(imageKey); // core có sẵn (core/db.js)
            if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
            await withLoadingShield(t('common.loading.savingImageBg'), async () => {
                await applyVisualBgImage(record.blob); // core có sẵn (core/state-and-video-bg.js)
            });
        });
    },

    /** MỚI (03/07/2026, mục 2) — tắt nền tĩnh Visual (checkbox Settings). Đụng IndexedDB qua
     * delMeta bên trong disableVisualBgImageState() -> cần shield. */
    async disableVisualBgImage() {
        await withLoadingShield(t('common.loading.deletingImageBg'), async () => {
            await disableVisualBgImageState(); // core có sẵn (core/state-and-video-bg.js)
        });
    }
};
