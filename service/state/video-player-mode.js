/**
 * service/state/video-player-mode.js — Package STATE domain "video-player-mode" (MỚI,
 * 21/07/2026, mục 4 — phát video làm "bài hát", tách khỏi playlist nhạc thường). Xem cơ chế
 * package ở service/state.js. PHẢI nạp SAU service/state.js.
 *
 * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt: "video thừa hưởng cơ chế Playlist
 * sẵn có, không tạo cơ chế next/prev/sort riêng — có là đang tạo exception"] `videoPlaylist`/
 * `currentVideoKey` ĐÃ BỎ HẲN khỏi package này — Next/Prev giờ dùng CHUNG `displayOrder`/
 * `shuffleIndices`/`currentKey` (package `playlist`, service/state/playlist.js) cho CẢ Song lẫn
 * Video, qua ĐÚNG 1 cơ chế `playNext()`/`playPrev()` (core/player-controls.js). Package này giờ
 * CHỈ còn `isVideoPlayerMode` — cờ DUY NHẤT còn cần riêng cho Video (quyết định element nào đang
 * thực sự phát: `bgVideoElement` hay `audioPlayer`, dùng ở nhiều Router/Core khác).
 */
        AppState.definePackage('video-player-mode', {
            schema: {
                isVideoPlayerMode: 'boolean',
            },
            buildDefaults() {
                return {
                    isVideoPlayerMode: false,
                };
            },
        });
