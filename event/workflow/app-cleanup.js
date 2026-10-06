/**
 * event/workflow/app-cleanup.js — Workflow "appCleanup": dọn tài nguyên toàn app khi tab thật sự bị đóng/unload
 * (F5, đóng tab, điều hướng sang trang khác). Gọi từ event/tab.js (handler 'beforeunload').
 *
 * DỜI (06/10/2026, dọn nợ Rule 2/3 — Giang yêu cầu "xử lý nốt nợ kỹ thuật") từ core/app-cleanup.js::executeAppCleanup()
 * (core tự appState.get, tự đọc DB, gọi core khác) — đúng vai Workflow (đọc state + gọi nhiều bước). Thân giữ nguyên,
 * thêm bước ghi nốt thống kê từng media (trước nằm riêng ở event/tab.js). Mỗi nhóm cleanup thuộc đúng module sở hữu —
 * thêm cleanup mới vào đây, không rải vào từng file riêng lẻ. Mọi bước best-effort (IndexedDB có thể đã đóng lúc unload).
 *
 * NẠP SAU: core/wakelock.js (releaseWakeLock), service/db.js (getMeta/setMeta), event/workflow/listen-stats.js
 * (chỉ cần lúc chạy). NẠP TRƯỚC: event/tab.js.
 */
const workflowAppCleanup = {

    run() {
        // ── Animation loop ────────────────────────────────────────────────
        const animationId = appState.get('animationId');
        if (animationId) cancelAnimationFrame(animationId);

        // ── Audio context ─────────────────────────────────────────────────
        const audioContext = appState.get('audioContext');
        if (audioContext && audioContext.state !== 'closed') audioContext.close();

        // ── Object URL (audio blob + cover) ──────────────────────────────
        const currentObjectURL = appState.get('currentObjectURL');
        const currentCoverObjectURL = appState.get('currentCoverObjectURL');
        if (currentObjectURL) revokeBlobUrl(currentObjectURL); // service/blob-url.js
        if (currentCoverObjectURL && currentCoverObjectURL.startsWith('blob:')) revokeBlobUrl(currentCoverObjectURL);

        // ── Tổng giây nghe toàn app chưa ghi ─────────────────────────────
        const pendingListenSeconds = appState.get('pendingListenSeconds');
        if (pendingListenSeconds > 0) {
            getMeta('totalListenSeconds') // service/db.js
                .then((v) => setMeta('totalListenSeconds', (v || 0) + pendingListenSeconds))
                .catch((err) => console.warn('[app-cleanup] Không ghi được totalListenSeconds lúc unload (best-effort):', err));
        }

        // ── Thống kê từng media còn chờ ghi (throttle 4s) ─────────────────
        workflowListenStats.flush(); // event/workflow/listen-stats.js

        // ── Wake lock ─────────────────────────────────────────────────────
        releaseWakeLock(); // core/wakelock.js
    },
};
