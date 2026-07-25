/**
 * service/state/video-player-mode.js — Package STATE domain "video-player-mode" (MỚI,
 * 21/07/2026, mục 4 — phát video làm "bài hát", tách khỏi playlist nhạc thường). Xem cơ chế
 * package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('video-player-mode', {
            schema: {
                isVideoPlayerMode: 'boolean',
                videoPlaylist: 'array',        // danh sách videoKey, thứ tự phát (cũ -> mới, KHÔNG shuffle/repeat ở bản đầu)
                currentVideoKey: 'nullable-string',
            },
            buildDefaults() {
                return {
                    isVideoPlayerMode: false,
                    videoPlaylist: [],
                    currentVideoKey: null,
                };
            },
        });
