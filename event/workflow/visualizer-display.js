/**
 * event/workflow/visualizer-display.js — "THẰNG THỰC THI CUỐI" của router "visualizerDisplay".
 *
 * QUY TẮC (giống workflow/storage.js, workflow/playlist.js):
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — chỉ gọi các hàm core thuần đã có ở
 *     visualizers/visualizer-display.js.
 *   - withLoadingShield() và alertModal() ĐẶT Ở TẦNG NÀY — core hoàn toàn không biết 2 thứ này
 *     tồn tại.
 *   - QUY TẮC SHIELD/MODAL: alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của
 *     withLoadingShield() — luôn gọi SAU KHI shield đã đóng hẳn.
 *
 * Chỉ 2 msg.type của router "visualizerDisplay" cần shield (đụng IndexedDB qua setMeta/delMeta)
 * -> được giao cho workflow xử lý ở đây: 'visualizerDisplay.bgImage.pickFromLibrary' và
 * 'visualizerDisplay.bgImage.toggle'. Mọi msg.type còn lại router tự gọi thẳng 1 hàm core, KHÔNG
 * đi qua workflow (xem router/visualizer-display.js).
 */
const workflowVisualizerDisplay = {

    /**
     * FIX (03/07/2026, mục 1) — thay 'visualizerDisplay.bgImage.upload' (upload file trực tiếp)
     * bằng picker chọn ảnh có sẵn trong File Manager. Đọc danh sách ảnh RỒI mở picker -> ≥2 bước
     * -> workflow. Callback chọn xong TÁI DÙNG NGUYÊN applyBgImage() có sẵn (Blob từ store `images`
     * coi như 1 File vừa "upload" — xem readme/song-cover-background-relations.md).
     */
    async pickBgImageFromLibrary() {
        const images = await listImages(); // core có sẵn (core/file-manager/image.js), CÓ return, DÙNG ngay dưới
        openImageLibraryPickerModal(images, async (imageKey) => { // core/file-manager/photo-ui.js
            const record = await getImageRecord(imageKey); // core có sẵn (core/db.js)
            if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
            await withLoadingShield(t('common.loading.savingImageBg'), async () => {
                await applyBgImage(record.blob); // core có sẵn (core/visualizer/visualizer-display.js) — Blob coi như File vừa chọn
            });
        });
    },

    /**
     * Ứng với msg.type = 'visualizerDisplay.bgImage.toggle' — cần PHỐI HỢP shield (đụng
     * IndexedDB qua setMeta/delMeta bên trong applyBgImageEnabled) -> workflow, dù chỉ gọi 1 hàm
     * core (tiêu chí shield, không phải tiêu chí "đếm số hàm core" — xem mục 2 quy tắc 4 của
     * plan.md: bất kỳ msg.type cần shield/modal đều qua workflow).
     * @param {{enabled: boolean}} payload
     */
    async toggleBgImage(payload) {
        const { enabled } = payload;
        await withLoadingShield(enabled ? t('common.loading.generic') : t('common.loading.deletingImageBg'), async () => {
            await applyBgImageEnabled(enabled); // "tay" cần enabled -> đưa enabled
        });
    }
};
