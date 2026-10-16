/**
 * event/workflow/app-cleanup.js — Workflow "appCleanup": dọn tài nguyên toàn app khi tab thật sự bị đóng/unload (F5, đóng
 * tab, điều hướng trang khác). Gọi từ event/tab.js ('beforeunload'). Cleanup mới thêm vào đây. Mọi bước best-effort
 * (IndexedDB có thể đã đóng lúc unload).
 *
 * NẠP SAU: event/workflow/wakelock.js, core/audio-engine.js, core/listen-stats.js, service/db.js, service/blob-url.js,
 * event/workflow/listen-stats.js (chỉ cần lúc chạy). NẠP TRƯỚC: event/tab.js.
 */
const workflowAppCleanup = {

    run() {
        const { audioContext, currentObjectURL, currentCoverObjectURL, pendingListenSeconds } = appState.get([
            'audioContext', 'currentObjectURL', 'currentCoverObjectURL', 'pendingListenSeconds',
        ]);
        closeAudioContextIfOpen(audioContext); // core/audio-engine.js
        // Object URL bài đang phát + ảnh bìa (ảnh bìa mặc định không phải blob: — revoke vô hại).
        revokeBlobUrl(currentObjectURL); // service/blob-url.js
        revokeBlobUrl(currentCoverObjectURL);
        this._flushTotalListenSeconds(pendingListenSeconds);
        workflowListenStats.flush(); // event/workflow/listen-stats.js — thống kê từng media còn chờ ghi (throttle 4s)
        workflowWakeLock.release(); // event/workflow/wakelock.js
    },

    /** Tổng giây nghe toàn app chưa ghi. @param {number} pendingSeconds */
    _flushTotalListenSeconds(pendingSeconds) {
        if (!(pendingSeconds > 0)) return; // guard
        getMeta('totalListenSeconds') // service/db.js
            .then((v) => setMeta('totalListenSeconds', addTotalListenSeconds(v, pendingSeconds))) // core/listen-stats.js
            .catch((err) => console.warn('[app-cleanup] Không ghi được totalListenSeconds lúc unload (best-effort):', err));
    },
};
