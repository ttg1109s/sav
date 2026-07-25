/**
 * service/state/shuffle-repeat.js — Package STATE domain "shuffle-repeat". Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('shuffle-repeat', {
            schema: {
                isShuffle: 'boolean',
                shuffleIndices: 'array',
                repeatMode: 'number',
            },
            buildDefaults() {
                return {
                    isShuffle: false,
                    shuffleIndices: [],
                    repeatMode: 0,
                };
            },
        });
