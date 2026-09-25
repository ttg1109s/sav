/**
 * service/state/wakelock-tab.js — Package STATE domain "wakelock-tab". Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 *
 * MỚI (25/09/2026, Giang yêu cầu "ẩn tab/PWA chỉ để audio Song phát nền, dừng mọi render Visualizer ở chế độ
 * không Game") — `isBackgroundSuspended`: app đang ẩn VÀ đã vào chế độ nền tối giản (chỉ bật khi ẩn lúc
 * gameplayPhase === 'idle'). CHỈ event/workflow/app-visibility.js ghi; Visual Background đọc để coi như "Song
 * đang dừng" (không phát video nền/Motion/đổi ảnh theo giờ) — xem workflowVisualBg._isSongActiveForVbg().
 */
        AppState.definePackage('wakelock-tab', {
            schema: {
                nativeWakeLock: 'any',         // WakeLockSentinel | null
                isBackgroundSuspended: 'boolean',
            },
            buildDefaults() {
                return {
                    nativeWakeLock: null,
                    isBackgroundSuspended: false,
                };
            },
        });
