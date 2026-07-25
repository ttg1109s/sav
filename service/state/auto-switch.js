/**
 * service/state/auto-switch.js — Package STATE domain "auto-switch" (tự động đổi hiệu ứng
 * Visualizer theo thời gian, ver 10). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('auto-switch', {
            schema: {
                autoSwitchVisualMarks: 'array',
                _lastMarksBuiltForKey: 'nullable-string',
            },
            buildDefaults() {
                return {
                    autoSwitchVisualMarks: [],
                    _lastMarksBuiltForKey: null,
                };
            },
        });

        // Ngưỡng tối thiểu HARDCODE cho mọi cách tính thời gian giữa 2 lần đổi hiệu ứng — xem
        // core/config.js::DEFAULT_VIZ_CONFIG cho ý nghĩa chi tiết 3 mode fixed/random/duration.
        const AUTO_SWITCH_VISUAL_MIN_SECONDS = 10;
        const AUTO_SWITCH_VISUAL_TASK_TIMER = 'autoSwitchVisualTimer';
        const AUTO_SWITCH_VISUAL_TASK_MARKS = 'autoSwitchVisualMarks';
