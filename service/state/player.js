/**
 * service/state/player.js — Package STATE domain "player" (resume modal, listen tick).
 * Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('player', {
            schema: {
                lastStoppedKey: 'nullable-string',
                lastStoppedTime: 'number',
                isResumeModalOpen: 'boolean',
                _isPlaylistReadyForResumeModal: 'boolean',
                _resumeModalPendingKey: 'nullable-string',
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
                    lastStoppedKey: null,
                    lastStoppedTime: 0,
                    isResumeModalOpen: false,
                    _isPlaylistReadyForResumeModal: false,
                    _resumeModalPendingKey: null,
                    _listenLastTick: 0,
                    pendingListenSeconds: 0,
                    playbackStoppedAtPlaylistEnd: false,
                };
            },
        });

        // RESUME_STATE_STORAGE_KEY/RESUME_FLAG_KEY — KHÔNG khai lại ở đây. Bản THẬT đã tồn tại sẵn
        // (từ trước đợt tái cấu trúc) ngay trong core/resume-state-storage.js — file DUY NHẤT
        // dùng 2 hằng số này. Đợt tái cấu trúc 25/07/2026 từng lỡ khai TRÙNG tên ở đây (2 `const`
        // top-level cùng tên trong cùng 1 global scope không có module → SyntaxError "đã được
        // khai báo" ngay lúc parse, sập cả app boot) — ĐÃ XOÁ bản trùng, giữ nguyên bản gốc.
