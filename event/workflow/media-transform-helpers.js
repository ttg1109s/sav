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
 */
const CROP_RATIO_PRESETS = [
    { labelKey: 'cropRatio.free', ratio: NaN },
    { labelKey: 'cropRatio.square', ratio: 1 },
    { labelKey: 'cropRatio.portrait919', ratio: 9 / 19 },
    { labelKey: 'cropRatio.portrait23', ratio: 2 / 3 },
    { labelKey: 'cropRatio.portrait34', ratio: 3 / 4 },
];

const workflowMediaTransformHelpers = {
    /** @returns {Array<{labelKey: string, ratio: number}>} */
    getPresets() {
        return CROP_RATIO_PRESETS;
    },

    /** Đảo nghịch đảo tỉ lệ hiện tại (vd 3:4 <-> 4:3) — vô nghĩa với Tự do/1:1, guard clause thuần.
     * @param {object} session */
    applyFlip(session) {
        if (Number.isNaN(session.aspectRatio) || session.aspectRatio === 1) return;
        setCropSessionAspectRatio(session, 1 / session.aspectRatio); // core/media-transform.js
    },

    /** @param {object} session @returns {{labelKey: string, ratio: number}|null} preset khớp `session.aspectRatio` hiện tại, null nếu không khớp preset nào (tỉ lệ tự kéo tay). */
    findActivePreset(session) {
        return CROP_RATIO_PRESETS.find((p) => (
            Number.isNaN(p.ratio) ? Number.isNaN(session.aspectRatio) : p.ratio === session.aspectRatio
        )) || null;
    },
};
