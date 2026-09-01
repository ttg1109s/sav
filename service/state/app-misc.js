/**
 * service/state/app-misc.js — Package STATE domain "app-misc": cờ UI/trạng thái tổng của app
 * không thuộc domain nào khác cụ thể. Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('app-misc', {
            schema: {
                isGridView: 'boolean',
                // true = đang ở màn Visualizer (không phải Playlist) lúc này. Set ở
                // core/player-controls.js::switchToVisualizer() (true)/forceBackToPlaylistUI()+
                // setVisualizerActiveFalse() (false).
                isVisualizerActive: 'boolean',
                isStatsPanelVisible: 'boolean',
                savLogoExpanded: 'boolean',
                isShieldBusy: 'boolean',
                isDestructiveTaskInProgress: 'boolean',
                dbReadyPromise: 'any',          // Promise — gán thật ở db.js bằng appState.set('dbReadyPromise', openDatabase())
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
                };
            },
        });

        // SHIELD_FADE_MS — KHÔNG khai lại ở đây. Bản THẬT đã tồn tại sẵn trong
        // core/loading-shield-util.js — ĐÃ XOÁ bản trùng gây SyntaxError lúc parse (xem giải thích
        // đầy đủ ở service/state/player.js, cùng lỗi).
