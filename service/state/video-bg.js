/**
 * service/state/video-bg.js — Package STATE domain "video-bg". Xem cơ chế package ở
 * service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('video-bg', {
            schema: {
                _videoBgLoadedUrl: 'nullable-string',
            },
            buildDefaults() {
                return {
                    _videoBgLoadedUrl: null,
                };
            },
        });
