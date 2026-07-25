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

        const LISTEN_CLOCK_TASK = 'listenClock';
