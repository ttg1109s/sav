/**
 * service/state/app-misc.js — Package STATE domain "app-misc": cờ UI/trạng thái tổng của app
 * không thuộc domain nào khác cụ thể. Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('app-misc', {
            schema: {
                isGridView: 'boolean',
                // true = đang ở màn Visualizer (không phải Playlist).
                isVisualizerActive: 'boolean',
                isStatsPanelVisible: 'boolean',
                savLogoExpanded: 'boolean',
                isShieldBusy: 'boolean',
                isDestructiveTaskInProgress: 'boolean',
                dbReadyPromise: 'any',          // Promise — gán thật ở db.js bằng appState.set('dbReadyPromise', openDatabase())
                // null tới khi event/workflow/device-info.js nhận diện xong lúc boot (core/device-detect.js::summarizeDeviceInfo()).
                deviceInfo: 'any',
            },
            buildDefaults() {
                return {
                    isGridView: false,
                    isVisualizerActive: false,
                    isStatsPanelVisible: true,
                    savLogoExpanded: false,
                    isShieldBusy: false,
                    isDestructiveTaskInProgress: false,
                    dbReadyPromise: null,
                    deviceInfo: null,
                };
            },
        });
