/**
 * event/workflow/media-transform-helpers.js — ĐỔI TÊN (04/08/2026, phản hồi Giang) từ
 * event/workflow/crop-ratio-helpers.js, khớp `core/media-transform.js` (gộp crop/zoom-pan/rotate).
 * Dùng CHUNG cho mọi Workflow có thao tác hình học trên media (hiện: Video Preview; Photo Edit sẵn
 * sàng dùng nếu sau này thêm dải tỉ lệ/xoay). Workflow gọi Workflow/Core đều được phép (Rule 3a chỉ
 * cấm Core gọi Core) — file này KHÔNG phải core, đặt ở event/workflow/.
 *
 * CHỈ giữ những gì có LOGIC THẬT (guard clause/tính toán riêng, không chỉ relay 1:1 sang core — xem
 * Rule 3d, readme/core-function-conventions.md). `cycleRotation()` KHÔNG có mặt ở đây — nó là
 * transform thuần không cần session/logic phụ, mỗi Workflow gọi THẲNG `core/media-transform.js`.
 *
 * Nhãn preset qua i18n key (`cropRatio.*`, lang/patch/patch-common.js).
 * NẠP SAU: core/media-transform.js.
 *
 * SỬA (05/08/2026, phản hồi Giang) — bỏ `applyFlip()` (đảo nghịch đảo tỉ lệ Crop, vd 3:4↔4:3) — Giang
 * chỉ ra "flip" phải lật CẢ ảnh/video, không phải riêng khung Crop. Nút flip trong `ratioGroupEl`
 * giờ bắn CHUNG event với nút Flip toolbar (`videoPreview.flip.click` →
 * `workflowVideoPreview.handleFlipClick()`, lật `videoPreviewFlipH` — event/workflow/
 * video-preview.js), không còn liên quan tỉ lệ Crop nữa.
 */
const CROP_RATIO_PRESETS = [
    { labelKey: 'cropRatio.free', ratio: NaN },
    { labelKey: 'cropRatio.square', ratio: 1 },
    { labelKey: 'cropRatio.portrait916', ratio: 9 / 16 }, // SỬA (05/08/2026, mục 4) — giá trị cũ 9/19 sai, tỉ lệ dọc phổ biến là 9:16
    { labelKey: 'cropRatio.portrait23', ratio: 2 / 3 },
    { labelKey: 'cropRatio.portrait34', ratio: 3 / 4 },
];

const workflowMediaTransformHelpers = {
    /** @returns {Array<{labelKey: string, ratio: number}>} */
    getPresets() {
        return CROP_RATIO_PRESETS;
    },

    /** @param {object} session @returns {{labelKey: string, ratio: number}|null} preset khớp `session.aspectRatio` hiện tại, null nếu không khớp preset nào (tỉ lệ tự kéo tay). */
    findActivePreset(session) {
        return CROP_RATIO_PRESETS.find((p) => (
            Number.isNaN(p.ratio) ? Number.isNaN(session.aspectRatio) : p.ratio === session.aspectRatio
        )) || null;
    },
};
