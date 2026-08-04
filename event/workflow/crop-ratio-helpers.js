/**
 * event/workflow/crop-ratio-helpers.js — dùng CHUNG cho mọi Workflow có dải tỉ lệ Crop (hiện: Video
 * Preview; Photo Edit hiện chưa có dải tỉ lệ nào — sẵn sàng nếu sau này thêm). Workflow gọi
 * Workflow/Core đều được phép (Rule 3a chỉ cấm Core gọi Core) — file này KHÔNG phải core, đặt ở
 * event/workflow/ đúng khuôn event/workflow/generic-drawer-helpers.js.
 *
 * Nhãn preset qua i18n key (`cropRatio.*`) — 1 bộ key dùng chung mọi nơi hiển thị dải tỉ lệ.
 *
 * NẠP SAU: core/crop-selector.js.
 */
const CROP_RATIO_PRESETS = [
    { labelKey: 'cropRatio.free', ratio: NaN },
    { labelKey: 'cropRatio.square', ratio: 1 },
    { labelKey: 'cropRatio.portrait919', ratio: 9 / 19 },
    { labelKey: 'cropRatio.portrait23', ratio: 2 / 3 },
    { labelKey: 'cropRatio.portrait34', ratio: 3 / 4 },
];

const workflowCropRatioHelpers = {
    /** @returns {Array<{labelKey: string, ratio: number}>} */
    getPresets() {
        return CROP_RATIO_PRESETS;
    },

    /** Đảo nghịch đảo tỉ lệ hiện tại (vd 3:4 <-> 4:3) — vô nghĩa với Tự do/1:1, guard clause thuần.
     * @param {object} session */
    applyFlip(session) {
        if (Number.isNaN(session.aspectRatio) || session.aspectRatio === 1) return;
        setCropSessionAspectRatio(session, 1 / session.aspectRatio); // core/crop-selector.js
    },

    /** @param {object} session @returns {{labelKey: string, ratio: number}|null} preset khớp `session.aspectRatio` hiện tại, null nếu không khớp preset nào (tỉ lệ tự kéo tay). */
    findActivePreset(session) {
        return CROP_RATIO_PRESETS.find((p) => (
            Number.isNaN(p.ratio) ? Number.isNaN(session.aspectRatio) : p.ratio === session.aspectRatio
        )) || null;
    },
};
