/**
 * service/state/motion-presets.js — Package STATE domain "motion-presets": danh sách "Cấu hình
 * Motion" (preset transition/Point Move đặt tên được, độc lập khỏi nơi tiêu thụ — xem
 * core/motion-presets.js, event/workflow/motion-presets.js) + `motionApply` (đăng ký preset nào
 * dùng được cho nơi tiêu thụ nào) + `motionRunning` (id preset ĐANG THẬT SỰ render lúc này, do
 * chính engine render — hiện DUY NHẤT Motion Engine, event/workflow/motion-engine.js — ghi mỗi
 * lần kích hoạt, KHÔNG phải "cấu hình chọn" (`motionPresetId` phía nơi tiêu thụ) — 2 khái niệm
 * khác nhau: null/khác nơi tiêu thụ đang chọn, engine không chạy gì cả thì vẫn null). Dùng để màn
 * Edit Motion biết mình có đang là preset ĐANG CHẠY hay không mà áp SỐNG toggle Point Move/React
 * Beat Audio, KHÔNG cần biết/gọi qua nơi tiêu thụ nào (Motion Engine + Motion Preset đều là
 * Motion, cùng 1 domain). Xem cơ chế package ở service/state.js.
 *
 * PHẢI nạp SAU service/state.js (cần class AppState.definePackage), TRƯỚC
 * service/state/record/index.js (dòng registry('player','all') cần package này đã đăng ký).
 */
AppState.definePackage('motion-presets', {
    schema: {
        motionPresets: 'array',
        motionApply: 'object',
        motionRunning: 'nullable-string',
    },
    buildDefaults() {
        return {
            motionPresets: [],
            motionApply: {},
            motionRunning: null,
        };
    },
});
