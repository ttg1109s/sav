/**
 * service/state/motion-presets.js — Package STATE domain "motion-presets": danh sách "Cấu
 * hình Motion" (preset transition/Ken Burns đặt tên được, độc lập khỏi Visual Background — xem
 * core/motion-presets.js, event/workflow/motion-presets.js). Xem cơ chế package ở
 * service/state.js.
 *
 * MỚI (29/08/2026) — BUG đã sửa: field `motionPresets` được dùng khắp
 * event/workflow/motion-presets.js/app-settings.js/motion.js qua `appState.get()`/`.set()`
 * NHƯNG CHƯA TỪNG được đăng ký package nào — `appState.get('motionPresets')` luôn trả
 * `undefined` (fail SILENT theo thiết kế AppState, KHÔNG throw ở tầng đó), khiến
 * `renderMotionListBody(undefined, ...)` crash NGANG giữa chừng (đọc `.length`/`.map()` trên
 * `undefined`) TRƯỚC KHI `_render()` kịp chạy — Generic Drawer vẫn đứng yên ở màn CŨ dù
 * `_screenStack` đã push xong (nên nút Back vẫn hoạt động đúng, chỉ nội dung không đổi).
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
