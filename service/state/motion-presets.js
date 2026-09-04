/**
 * service/state/motion-presets.js — Package STATE domain "motion-presets": danh sách "Cấu hình
 * Motion" (preset transition/Point Move đặt tên được, độc lập khỏi nơi tiêu thụ — xem
 * core/motion-presets.js, event/workflow/motion-presets.js) + `motionApply` (đăng ký preset nào
 * dùng được cho nơi tiêu thụ nào). Xem cơ chế package ở service/state.js.
 *
 * PHẢI nạp SAU service/state.js (cần class AppState.definePackage), TRƯỚC
 * service/state/record/index.js (dòng registry('player','all') cần package này đã đăng ký).
 */
AppState.definePackage('motion-presets', {
    schema: {
        motionPresets: 'array',
        motionApply: 'object',
    },
    buildDefaults() {
        return {
            motionPresets: [],
            motionApply: {},
        };
    },
});
