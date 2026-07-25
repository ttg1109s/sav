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

        /** Key localStorage cho snapshot resume + cờ resume — chỉ core/resume-state-storage.js dùng. */
        const RESUME_STATE_STORAGE_KEY = 'sav_pendingResumeState_v1';
        const RESUME_FLAG_KEY = 'sav_resumeFlag_v1';
