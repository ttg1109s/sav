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
 * FIX (04/07/2026, mục 1 phản hồi Giang) — GỘP 'visualizerDisplay.bgImage.pickFromLibrary' (nút
 * riêng đã xoá) vào thẳng 'visualizerDisplay.bgImage.toggle': bật toggle giờ tự mở picker, huỷ/
 * không chọn gì thì tự trả toggle về "off" (onCancel). Tắt toggle CHỈ ẩn hiển thị, KHÔNG còn xoá
 * Blob khỏi IndexedDB (đảo ngược quyết định cũ) — vì vậy `toggleBgImage({enabled:false})` không
 * còn cần shield, gọi thẳng `applyBgImageEnabled(false)` (core giờ đồng bộ). CHỈ nhánh `enabled:true`
 * (mở picker + `applyBgImage()`) còn ở workflow (>1 bước + cần shield lúc lưu).
 */
const workflowVisualizerDisplay = {

    /**
     * FIX (04/07/2026, mục 1 phản hồi Giang) — GỘP nút "Chọn thư viện" (đã xoá) VÀO ĐÂY: gạt toggle
     * lên "On" giờ TỰ mở picker chọn ảnh có sẵn trong File Manager luôn, không cần 2 control tách
     * rời (từng gây bug UX: gạt On xong đóng modal không chọn gì, toggle vẫn kẹt "on"). Huỷ/đóng
     * modal không chọn ảnh -> `onCancel` tự trả toggle về "off" (tham số của
     * openImageCarouselPickerModal, xem core/file-manager/photo-ui.js). Gạt về "off" thì chỉ tắt
     * hiển thị — KHÔNG xoá Blob đã lưu trong IndexedDB nữa (đảo ngược quyết định cũ, xem
     * applyBgImageEnabled() core/visualizer/visualizer-display.js).
     * @param {{enabled: boolean}} payload
     */
    async toggleBgImage(payload) {
        const { enabled } = payload;
        if (!enabled) { applyBgImageEnabled(false); return; } // core giờ đồng bộ (không còn đụng IndexedDB) -> gọi thẳng

        const images = await listImages(); // core có sẵn (core/file-manager/image.js), CÓ return, DÙNG ngay dưới
        // FIX (04/07/2026, mục 2 phản hồi Giang) — đổi sang carousel (1 ảnh/lúc, windowed DOM)
        // THAY lưới ảnh cũ, xem core/file-manager/photo-ui.js::openImageCarouselPickerModal.
        openImageCarouselPickerModal(images, async (imageKey) => { // core/file-manager/photo-ui.js
            const record = await getImageRecord(imageKey); // core có sẵn (service/db.js)
            if (!record) { bgImageEnableToggle.checked = false; return; } // guard: ảnh vừa bị xoá ở tab/thao tác khác -> coi như huỷ
            await withLoadingShield(t('common.loading.savingImageBg'), async () => {
                await applyBgImage(record.blob); // core có sẵn — Blob coi như File vừa chọn
            });
        }, () => {
            bgImageEnableToggle.checked = false; // MỚI — huỷ/đóng modal không chọn gì -> tự trả về "off"
        });
    }
};
