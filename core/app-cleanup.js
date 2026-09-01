/**
 * app-cleanup.js — Dọn dẹp tài nguyên toàn app khi tab thật sự bị đóng/unload
 * (F5, đóng tab, điều hướng sang trang khác).
 *
 * Được gọi từ event/tab.js trong handler 'beforeunload'.
 *
 * Mỗi nhóm cleanup thuộc đúng module sở hữu — thêm cleanup mới vào đây,
 * không rải vào từng file core riêng lẻ.
 *
 * PHẢI nạp SAU: core/dom-refs.js (animationId, audioContext, currentObjectURL,
 *   currentCoverObjectURL), core/listen-stats.js (flushSongStats),
 *   core/player-controls.js (pendingListenSeconds), service/db.js (getMeta/setMeta),
 *   core/wakelock.js (releaseWakeLock).
 */
        function executeAppCleanup() {
            // ── Animation loop ────────────────────────────────────────────────
            const animationId = appState.get('animationId');
            if (animationId) cancelAnimationFrame(animationId);

            // ── Audio context ─────────────────────────────────────────────────
            const audioContext = appState.get('audioContext');
            if (audioContext && audioContext.state !== 'closed') audioContext.close();

            // ── Object URL (audio blob + cover) ──────────────────────────────
            const currentObjectURL = appState.get('currentObjectURL');
            const currentCoverObjectURL = appState.get('currentCoverObjectURL');
            if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
            if (currentCoverObjectURL) URL.revokeObjectURL(currentCoverObjectURL);

            // ── Listen stats: flush tổng giây nghe chưa ghi ──────────────────
            // Best-effort — IndexedDB có thể đã đóng lúc unload, bỏ qua lỗi.
            const pendingListenSeconds = appState.get('pendingListenSeconds');
            if (pendingListenSeconds > 0) {
                getMeta('totalListenSeconds')
                    .then(v => setMeta('totalListenSeconds', (v || 0) + pendingListenSeconds))
                    .catch(err => console.warn('[app-cleanup] Không ghi được totalListenSeconds lúc unload (best-effort):', err));
            }

            // ── Listen stats: flush per-song stats còn debounce ──────────────
            if (typeof flushSongStats === 'function') flushSongStats();

            // ── Wake lock ─────────────────────────────────────────────────────
            releaseWakeLock();
        }
