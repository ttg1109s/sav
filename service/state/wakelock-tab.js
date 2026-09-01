/**
 * service/state/wakelock-tab.js — Package STATE domain "wakelock-tab". Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('wakelock-tab', {
            schema: {
                nativeWakeLock: 'any',         // WakeLockSentinel | null
            },
            buildDefaults() {
                return {
                    nativeWakeLock: null,
                };
            },
        });
