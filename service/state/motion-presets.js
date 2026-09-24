/**
 * service/state/motion-presets.js — Package STATE domain "motion-presets": danh sách "Cấu hình
 * Motion" (preset transition/Point Move đặt tên được, độc lập khỏi nơi tiêu thụ — xem
 * core/motion-presets.js, event/workflow/motion-presets.js). Xem cơ chế package ở service/state.js.
 *
 * XOÁ (25/09/2026, Giang duyệt — nguyên tắc tua vít) — key `motionRunning` (id preset engine VBG-Photo
 * đang render, để màn Edit Motion áp sống công tắc Point Move bằng cách gọi THẲNG engine VBG). Thay bằng
 * broadcast `notifyMotionPointMoveEnabledChanged()` (event/workflow/motion-point-move-runner.js) — mỗi
 * Runner tự biết mình đang chạy preset nào, áp sống cho MỌI nơi tiêu thụ.
 *
 * XOÁ (24/09/2026, Giang yêu cầu "xoá cơ chế đăng ký motion vào nơi tiêu thụ") — key `motionApply`
 * (đăng ký preset nào dùng được cho nơi tiêu thụ nào) BỎ khỏi package — nơi tiêu thụ chọn thẳng từ
 * danh sách Motion (chế độ Chọn), xem event/workflow/motion-presets.js::openPicker().
 *
 * PHẢI nạp SAU service/state.js (cần class AppState.definePackage), TRƯỚC
 * service/state/record/index.js (dòng registry('player','all') cần package này đã đăng ký).
 */
AppState.definePackage('motion-presets', {
    schema: {
        motionPresets: 'array',
    },
    buildDefaults() {
        return {
            motionPresets: [],
        };
    },
});
