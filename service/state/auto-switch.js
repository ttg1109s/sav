/**
 * service/state/auto-switch.js — Package STATE domain "auto-switch" (tự động đổi hiệu ứng
 * Visualizer theo thời gian, ver 10). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 *
 * SỬA (26/09/2026, Giang "cải tiến lại Auto-Switch Effect") — bỏ `autoSwitchVisualMarks`/`_lastMarksBuiltForKey`
 * (mode 'duration' chia độ dài bài ĐÃ BỎ, thay bằng 'perMedia'). Thêm `_autoSwitchLastMediaKey`: key media gần
 * nhất mà nhánh 'perMedia' đã ghi nhận — đổi hiệu ứng CHỈ khi currentKey khác key này (tránh đổi 2 lần cho
 * cùng 1 media khi nhiều sự kiện cùng báo "media mới").
 */
        AppState.definePackage('auto-switch', {
            schema: {
                _autoSwitchLastMediaKey: 'nullable-string',
            },
            buildDefaults() {
                return {
                    _autoSwitchLastMediaKey: null,
                };
            },
        });

        // Biên HARDCODE cho mọi khoảng thời gian giữa 2 lần đổi hiệu ứng (nhánh 'fixed', const lẫn random) —
        // time picker (core/time-picker-modal.js) cũng mở đúng trong khoảng này. MAX MỚI 26/09/2026 (1 giờ).
        const AUTO_SWITCH_VISUAL_MIN_SECONDS = 10;
        const AUTO_SWITCH_VISUAL_MAX_SECONDS = 3600;
        // AUTO_SWITCH_VISUAL_TASK_TIMER — KHÔNG khai lại ở đây. Bản THẬT (SỬA 25/09/2026: dời từ core) nằm ở
        // event/workflow/auto-switch-visual.js — nơi DUY NHẤT dùng taskManager cho tính năng này.
