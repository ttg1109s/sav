/**
 * service/state/listen-stats.js — Package STATE domain "listen-stats". Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('listen-stats', {
            schema: {
                songStatsMap: 'map',
                _songStatsDirty: 'boolean',
            },
            buildDefaults() {
                return {
                    songStatsMap: new Map(),
                    _songStatsDirty: false,
                };
            },
        });

        // LISTEN_CLOCK_TASK — KHÔNG khai lại ở đây. Bản THẬT đã tồn tại sẵn trong
        // core/player-controls.js — ĐÃ XOÁ bản trùng gây SyntaxError lúc parse (xem giải thích đầy
        // đủ ở service/state/player.js, cùng lỗi).
