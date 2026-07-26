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
                };
            },
        });

        // RESUME_STATE_STORAGE_KEY/RESUME_FLAG_KEY — KHÔNG khai lại ở đây. Bản THẬT đã tồn tại sẵn
        // (từ trước đợt tái cấu trúc) ngay trong core/resume-state-storage.js — file DUY NHẤT
        // dùng 2 hằng số này. Đợt tái cấu trúc 25/07/2026 từng lỡ khai TRÙNG tên ở đây (2 `const`
        // top-level cùng tên trong cùng 1 global scope không có module → SyntaxError "đã được
        // khai báo" ngay lúc parse, sập cả app boot) — ĐÃ XOÁ bản trùng, giữ nguyên bản gốc.
