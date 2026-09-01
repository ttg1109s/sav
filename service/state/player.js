/**
 * service/state/player.js — Package STATE domain "player" (listen tick).
 * Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('player', {
            schema: {
                _listenLastTick: 'number',
                pendingListenSeconds: 'number',
                // MỚI (09/08/2026, phản hồi Giang — tín hiệu "hết hẳn playlist" cho domain khác,
                // vd `visualBg`) — phân biệt pause TẠM (user bấm nút/nghe giữa chừng) với pause do
                // ĐÃ HẾT HẲN danh sách phát (không lặp/không có bài kế, xem
                // core/player-controls.js::stopPlaybackAtPlaylistEnd()) — CẢ 2 chỉ bắn CHUNG 1 sự
                // kiện 'pause' của audioPlayer, không có cách nào phân biệt nếu không có cờ này.
                playbackStoppedAtPlaylistEnd: 'boolean',
            },
            buildDefaults() {
                return {
                    _listenLastTick: 0,
                    pendingListenSeconds: 0,
                    playbackStoppedAtPlaylistEnd: false,
                };
            },
        });
